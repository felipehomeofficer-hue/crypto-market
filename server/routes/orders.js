import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { authenticate } from '../middleware/auth.js';
import { calculateFinalPrice, getPricingConfig, calculateOrderPrice } from '../services/pricing.js';
import { createInvoice, getInvoiceStatus, getPaymentMethods } from '../services/bitcoin.js';

const router = Router();

/**
 * POST /api/orders/calculate-price
 * Calculate order price including shipping
 */
router.post('/calculate-price', authenticate, async (req, res) => {
  try {
    const { productId, quantity = 1, shippingAddress } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    // Use buyer's saved address or provided address
    const address = shippingAddress || {
      street: req.user.address_street,
      city: req.user.address_city,
      state: req.user.address_state,
      zip: req.user.address_zip,
      country: req.user.address_country || 'US',
    };

    if (!address.street || !address.city || !address.zip) {
      return res.status(400).json({ error: 'Shipping address is required' });
    }

    const priceDetails = await calculateOrderPrice(productId, address, parseInt(quantity));
    res.json(priceDetails);
  } catch (error) {
    console.error('Price calculation error:', error);
    res.status(500).json({ error: error.message || 'Price calculation failed' });
  }
});

/**
 * POST /api/orders
 * Create a new order
 */
router.post('/', authenticate, async (req, res) => {
  try {
    const { productId, quantity = 1, shippingServiceType = 'FEDEX_GROUND', shippingAddress } = req.body;

    // Validate product
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND is_active = 1').get(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    if (product.stock < quantity) return res.status(400).json({ error: 'Insufficient stock' });
    if (product.seller_id === req.user.id) return res.status(400).json({ error: 'Cannot buy your own product' });

    // Get shipping address
    const address = shippingAddress || {
      street: req.user.address_street,
      city: req.user.address_city,
      state: req.user.address_state,
      zip: req.user.address_zip,
      country: req.user.address_country || 'US',
      phone: req.user.address_phone,
    };

    if (!address.street || !address.city || !address.zip) {
      return res.status(400).json({ error: 'Shipping address is required' });
    }

    // Calculate price with shipping
    const priceDetails = await calculateOrderPrice(productId, address, parseInt(quantity));
    const selectedShipping = priceDetails.shippingOptions.find(
      o => o.shippingService === shippingServiceType
    ) || priceDetails.shippingOptions[0];

    if (!selectedShipping) {
      return res.status(400).json({ error: 'No shipping options available' });
    }

    const orderId = uuidv4();

    // Create order
    db.prepare(`
      INSERT INTO orders (
        id, buyer_id, seller_id, product_id, quantity,
        base_price, packaging_cost, shipping_cost, tax_amount, platform_fee, total_price,
        crypto_currency, crypto_amount,
        shipping_address_street, shipping_address_city, shipping_address_state,
        shipping_address_zip, shipping_address_country, shipping_address_phone,
        distribution_center_id, fedex_rate_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_payment')
    `).run(
      orderId, req.user.id, product.seller_id, productId, parseInt(quantity),
      selectedShipping.basePrice, selectedShipping.packagingCost,
      selectedShipping.shippingCost, selectedShipping.taxAmount,
      selectedShipping.platformProfit, selectedShipping.finalPrice,
      product.crypto_currency, selectedShipping.finalPrice,
      address.street, address.city, address.state,
      address.zip, address.country || 'US', address.phone || '',
      priceDetails.distributionCenter.id, shippingServiceType
    );

    // Decrease stock
    db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(parseInt(quantity), productId);

    // Create BTCPay invoice
    let paymentInfo = null;
    try {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      paymentInfo = await createInvoice(order, selectedShipping.finalPrice);
    } catch (paymentErr) {
      console.warn('BTCPay invoice creation failed (running without BTCPay?):', paymentErr.message);
      // Store a placeholder for manual payment
      paymentInfo = {
        invoiceId: `manual_${orderId}`,
        status: 'awaiting_manual_payment',
        amount: selectedShipping.finalPrice,
        message: 'BTCPay Server not configured. Use admin panel to manually confirm payment.',
      };
    }

    // Log event
    db.prepare(`
      INSERT INTO analytics_events (event_type, user_id, order_id, product_id, data)
      VALUES ('order_created', ?, ?, ?, ?)
    `).run(req.user.id, orderId, productId, JSON.stringify({
      totalPrice: selectedShipping.finalPrice,
      currency: product.crypto_currency,
      shippingService: shippingServiceType,
    }));

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);

    res.status(201).json({
      order: formatOrder(order),
      payment: paymentInfo,
      priceBreakdown: selectedShipping,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(500).json({ error: error.message || 'Failed to create order' });
  }
});

/**
 * GET /api/orders
 * List user's orders (buyer or seller)
 */
router.get('/', authenticate, (req, res) => {
  try {
    const { role = 'buyer', status, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let where = [];
    const params = [];

    if (role === 'seller') {
      where.push('o.seller_id = ?');
      params.push(req.user.id);
    } else {
      where.push('o.buyer_id = ?');
      params.push(req.user.id);
    }

    if (status) {
      where.push('o.status = ?');
      params.push(status);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as count FROM orders o ${whereClause}`).get(...params).count;

    const orders = db.prepare(`
      SELECT o.*, p.title as product_title, p.base_price as product_base_price,
             p.crypto_currency as product_currency,
             buyer.display_name as buyer_name, buyer.wallet_address as buyer_wallet,
             seller.display_name as seller_name, seller.wallet_address as seller_wallet
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN users buyer ON o.buyer_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      ${whereClause}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    // Get product images for each order
    const result = orders.map(o => {
      const image = db.prepare(
        'SELECT file_name FROM product_images WHERE product_id = ? ORDER BY sort_order LIMIT 1'
      ).get(o.product_id);

      return {
        ...formatOrder(o),
        productTitle: o.product_title,
        productImage: image ? `/uploads/products/${image.file_name}` : null,
        buyerName: o.buyer_name,
        sellerName: o.seller_name,
      };
    });

    res.json({
      orders: result,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    console.error('Orders list error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

/**
 * GET /api/orders/:id
 * Get order details
 */
router.get('/:id', authenticate, (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, p.title as product_title, p.description as product_description,
             p.weight_kg, p.length_cm, p.width_cm, p.height_cm,
             buyer.display_name as buyer_name, buyer.wallet_address as buyer_wallet,
             seller.display_name as seller_name, seller.wallet_address as seller_wallet,
             dc.name as dc_name, dc.address_city as dc_city, dc.address_state as dc_state
      FROM orders o
      LEFT JOIN products p ON o.product_id = p.id
      LEFT JOIN users buyer ON o.buyer_id = buyer.id
      LEFT JOIN users seller ON o.seller_id = seller.id
      LEFT JOIN distribution_centers dc ON o.distribution_center_id = dc.id
      WHERE o.id = ?
    `).get(req.params.id);

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Access control
    if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get shipments
    const shipments = db.prepare('SELECT * FROM shipments WHERE order_id = ? ORDER BY created_at').all(order.id);

    // Get escrow records
    const escrowRecords = db.prepare('SELECT * FROM escrow_ledger WHERE order_id = ? ORDER BY created_at').all(order.id);

    // Get product image
    const image = db.prepare(
      'SELECT file_name FROM product_images WHERE product_id = ? ORDER BY sort_order LIMIT 1'
    ).get(order.product_id);

    res.json({
      order: {
        ...formatOrder(order),
        productTitle: order.product_title,
        productDescription: order.product_description,
        productImage: image ? `/uploads/products/${image.file_name}` : null,
        buyerName: order.buyer_name,
        sellerName: order.seller_name,
        dcName: order.dc_name,
        dcLocation: order.dc_city ? `${order.dc_city}, ${order.dc_state}` : null,
        shipments: shipments.map(s => ({
          id: s.id,
          type: s.type,
          trackingNumber: s.fedex_tracking_number,
          labelUrl: s.fedex_label_url,
          status: s.status,
          estimatedDelivery: s.estimated_delivery,
          createdAt: s.created_at,
        })),
        escrowRecords: escrowRecords.map(e => ({
          id: e.id,
          type: e.type,
          amount: e.amount,
          currency: e.crypto_currency,
          txHash: e.tx_hash,
          status: e.status,
          createdAt: e.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('Order detail error:', error);
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

/**
 * GET /api/orders/:id/payment-status
 * Check payment status via BTCPay
 */
router.get('/:id/payment-status', authenticate, async (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (!order.btcpay_invoice_id || order.btcpay_invoice_id.startsWith('manual_')) {
      return res.json({ status: order.status, message: 'Manual payment mode' });
    }

    const invoiceStatus = await getInvoiceStatus(order.btcpay_invoice_id);
    const paymentMethods = await getPaymentMethods(order.btcpay_invoice_id);

    res.json({
      orderStatus: order.status,
      invoiceStatus: invoiceStatus.status,
      paymentMethods,
    });
  } catch (error) {
    console.error('Payment status error:', error);
    res.status(500).json({ error: 'Failed to check payment status' });
  }
});

/**
 * POST /api/orders/:id/confirm-delivery
 * Buyer confirms delivery (triggers escrow release countdown)
 */
router.post('/:id/confirm-delivery', authenticate, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.buyer_id !== req.user.id) return res.status(403).json({ error: 'Only buyer can confirm delivery' });

    db.prepare(`
      UPDATE orders SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(order.id);

    // Notify seller
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, data)
      VALUES (?, ?, 'delivery_confirmed', 'Delivery Confirmed!', ?, ?)
    `).run(
      uuidv4(), order.seller_id,
      `Buyer confirmed delivery for order #${order.id.slice(0, 8)}. Escrow will be released soon.`,
      JSON.stringify({ orderId: order.id })
    );

    res.json({ message: 'Delivery confirmed. Escrow will be released after review period.' });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({ error: 'Failed to confirm delivery' });
  }
});

/**
 * POST /api/orders/:id/dispute
 * Open a dispute
 */
router.post('/:id/dispute', authenticate, (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Dispute reason is required' });

    const { openDispute } = require('../services/escrow.js');
    const result = openDispute(req.params.id, req.user.id, reason);
    res.json(result);
  } catch (error) {
    console.error('Dispute error:', error);
    res.status(500).json({ error: error.message || 'Failed to open dispute' });
  }
});

function formatOrder(o) {
  return {
    id: o.id,
    buyerId: o.buyer_id,
    sellerId: o.seller_id,
    productId: o.product_id,
    quantity: o.quantity,
    basePrice: o.base_price,
    packagingCost: o.packaging_cost,
    shippingCost: o.shipping_cost,
    taxAmount: o.tax_amount,
    platformFee: o.platform_fee,
    totalPrice: o.total_price,
    cryptoCurrency: o.crypto_currency,
    cryptoAmount: o.crypto_amount,
    status: o.status,
    btcpayInvoiceId: o.btcpay_invoice_id,
    paymentTxHash: o.payment_tx_hash,
    escrowTxHash: o.escrow_tx_hash,
    sellerTrackingNumber: o.seller_tracking_number,
    buyerTrackingNumber: o.buyer_tracking_number,
    sellerShippingLabelUrl: o.seller_shipping_label_url,
    buyerShippingLabelUrl: o.buyer_shipping_label_url,
    shippingAddress: o.shipping_address_street ? {
      street: o.shipping_address_street,
      city: o.shipping_address_city,
      state: o.shipping_address_state,
      zip: o.shipping_address_zip,
      country: o.shipping_address_country,
      phone: o.shipping_address_phone,
    } : null,
    createdAt: o.created_at,
    paidAt: o.paid_at,
    shippedAt: o.shipped_at,
    deliveredAt: o.delivered_at,
  };
}

export default router;
