import axios from 'axios';
import crypto from 'crypto';
import config from '../config.js';
import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * BTCPay Server Greenfield API Integration
 * Handles invoice creation, payment verification, and webhook processing
 * Docs: https://docs.btcpayserver.org/API/Greenfield/v1/
 */

const btcpayClient = axios.create({
  baseURL: config.BTCPAY_URL,
  headers: {
    'Authorization': `token ${config.BTCPAY_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

/**
 * Create a BTCPay Server invoice for an order
 * @param {Object} order - Order details
 * @param {number} amountUSD - Amount in USD (BTCPay handles conversion)
 * @returns {Object} BTCPay invoice object
 */
export async function createInvoice(order, amountUSD) {
  try {
    const response = await btcpayClient.post(
      `/api/v1/stores/${config.BTCPAY_STORE_ID}/invoices`,
      {
        amount: amountUSD.toString(),
        currency: 'USD',
        metadata: {
          orderId: order.id,
          buyerId: order.buyer_id,
          sellerId: order.seller_id,
          productId: order.product_id,
        },
        checkout: {
          speedPolicy: 'MediumSpeed', // 1 confirmation
          paymentMethods: ['BTC', 'BTC-LightningNetwork'],
          expirationMinutes: 60,
          monitoringMinutes: 1440,
          redirectURL: `${config.FRONTEND_URL || 'http://localhost:5173'}/order/${order.id}`,
          redirectAutomatically: true,
        },
        receipt: {
          enabled: true,
          showQR: true,
        },
      }
    );

    // Store invoice reference
    db.prepare(`
      UPDATE orders SET btcpay_invoice_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(response.data.id, order.id);

    // Log analytics event
    db.prepare(`
      INSERT INTO analytics_events (event_type, user_id, order_id, data)
      VALUES ('invoice_created', ?, ?, ?)
    `).run(order.buyer_id, order.id, JSON.stringify({
      invoiceId: response.data.id,
      amount: amountUSD,
    }));

    return {
      invoiceId: response.data.id,
      checkoutLink: response.data.checkoutLink,
      status: response.data.status,
      amount: response.data.amount,
      currency: response.data.currency,
      btcAddress: response.data.addresses?.BTC,
      lightningInvoice: response.data.addresses?.['BTC-LN'],
      expiresAt: response.data.expirationTime,
      qrCode: `${config.BTCPAY_URL}/i/${response.data.id}`,
    };
  } catch (error) {
    console.error('BTCPay invoice creation failed:', error.response?.data || error.message);
    throw new Error(`Payment invoice creation failed: ${error.message}`);
  }
}

/**
 * Get invoice status from BTCPay Server
 */
export async function getInvoiceStatus(invoiceId) {
  try {
    const response = await btcpayClient.get(
      `/api/v1/stores/${config.BTCPAY_STORE_ID}/invoices/${invoiceId}`
    );

    return {
      invoiceId: response.data.id,
      status: response.data.status, // New, Processing, Settled, Expired, Invalid
      additionalStatus: response.data.additionalStatus,
      amount: response.data.amount,
      amountPaid: response.data.receipt?.amountPaid,
      txHash: response.data.receipt?.txId,
    };
  } catch (error) {
    console.error('BTCPay status check failed:', error.response?.data || error.message);
    throw new Error(`Payment status check failed: ${error.message}`);
  }
}

/**
 * Get payment details for an invoice (includes BTC address, amount, etc.)
 */
export async function getPaymentMethods(invoiceId) {
  try {
    const response = await btcpayClient.get(
      `/api/v1/stores/${config.BTCPAY_STORE_ID}/invoices/${invoiceId}/payment-methods`
    );

    return response.data.map(pm => ({
      paymentMethod: pm.paymentMethod,
      destination: pm.destination, // BTC address or LN invoice
      amount: pm.amount,
      rate: pm.rate,
      amountPaid: pm.totalPaid,
      networkFee: pm.networkFee,
    }));
  } catch (error) {
    console.error('Payment methods fetch failed:', error.response?.data || error.message);
    throw new Error(`Payment methods fetch failed: ${error.message}`);
  }
}

/**
 * Verify BTCPay webhook signature
 */
export function verifyWebhookSignature(body, signature) {
  const hmac = crypto.createHmac('sha256', config.BTCPAY_WEBHOOK_SECRET);
  hmac.update(body);
  const expectedSig = `sha256=${hmac.digest('hex')}`;
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSig)
  );
}

/**
 * Process BTCPay webhook event
 * Handles: InvoiceSettled, InvoicePaymentSettled, InvoiceExpired, InvoiceInvalid
 */
export async function processWebhookEvent(event) {
  const { type, invoiceId } = event;

  const order = db.prepare(
    'SELECT * FROM orders WHERE btcpay_invoice_id = ?'
  ).get(invoiceId);

  if (!order) {
    console.warn(`Webhook: No order found for invoice ${invoiceId}`);
    return;
  }

  switch (type) {
    case 'InvoicePaymentSettled': {
      // Payment received and confirmed
      const invoiceStatus = await getInvoiceStatus(invoiceId);

      // Update order status
      db.prepare(`
        UPDATE orders 
        SET status = 'paid', 
            payment_tx_hash = ?,
            paid_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(invoiceStatus.txHash || '', order.id);

      // Create escrow hold record
      db.prepare(`
        INSERT INTO escrow_ledger (id, order_id, type, amount, crypto_currency, tx_hash, status)
        VALUES (?, ?, 'hold', ?, ?, ?, 'confirmed')
      `).run(uuidv4(), order.id, order.crypto_amount, order.crypto_currency, invoiceStatus.txHash);

      // Update order to escrow status
      db.prepare(`
        UPDATE orders SET status = 'escrow_held', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(order.id);

      // Notify seller
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, data)
        VALUES (?, ?, 'order_paid', 'New Order Received!', ?, ?)
      `).run(
        uuidv4(), order.seller_id,
        `Order #${order.id.slice(0, 8)} has been paid. Please ship your product to the distribution center.`,
        JSON.stringify({ orderId: order.id, productId: order.product_id })
      );

      // Notify buyer
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, data)
        VALUES (?, ?, 'payment_confirmed', 'Payment Confirmed!', ?, ?)
      `).run(
        uuidv4(), order.buyer_id,
        `Your payment for order #${order.id.slice(0, 8)} has been confirmed. Funds are held in escrow.`,
        JSON.stringify({ orderId: order.id })
      );

      // Log event
      db.prepare(`
        INSERT INTO analytics_events (event_type, user_id, order_id, data)
        VALUES ('payment_confirmed', ?, ?, ?)
      `).run(order.buyer_id, order.id, JSON.stringify({
        txHash: invoiceStatus.txHash,
        amount: order.crypto_amount,
        currency: order.crypto_currency,
      }));

      break;
    }

    case 'InvoiceExpired': {
      db.prepare(`
        UPDATE orders SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(order.id);

      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message, data)
        VALUES (?, ?, 'payment_expired', 'Payment Expired', ?, ?)
      `).run(
        uuidv4(), order.buyer_id,
        `Payment for order #${order.id.slice(0, 8)} has expired. Please create a new order.`,
        JSON.stringify({ orderId: order.id })
      );
      break;
    }

    case 'InvoiceInvalid': {
      db.prepare(`
        UPDATE orders SET status = 'disputed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(order.id);
      break;
    }
  }

  return order;
}

/**
 * Manually mark payment (for testing / admin override)
 */
export function markPaymentReceived(orderId, txHash) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Order not found');

  db.prepare(`
    UPDATE orders 
    SET status = 'escrow_held', payment_tx_hash = ?, paid_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(txHash, orderId);

  db.prepare(`
    INSERT INTO escrow_ledger (id, order_id, type, amount, crypto_currency, tx_hash, status)
    VALUES (?, ?, 'hold', ?, ?, ?, 'confirmed')
  `).run(uuidv4(), orderId, order.crypto_amount || order.total_price, order.crypto_currency, txHash);

  // Notify seller
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, data)
    VALUES (?, ?, 'order_paid', 'New Order Received!', ?, ?)
  `).run(
    uuidv4(), order.seller_id,
    `Order #${orderId.slice(0, 8)} paid. Ship your item to the distribution center.`,
    JSON.stringify({ orderId })
  );

  return order;
}
