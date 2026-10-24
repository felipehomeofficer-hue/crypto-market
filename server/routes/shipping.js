import { Router } from 'express';
import db from '../database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { getRates, trackShipment, generateSellerToDCLabel, generateDCToBuyerLabel } from '../services/fedex.js';

const router = Router();

/**
 * POST /api/shipping/rates
 * Get FedEx shipping rates
 */
router.post('/rates', authenticate, async (req, res) => {
  try {
    const { productId, destinationAddress } = req.body;

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Get nearest active distribution center
    const dc = db.prepare('SELECT * FROM distribution_centers WHERE is_active = 1 LIMIT 1').get();
    if (!dc) return res.status(400).json({ error: 'No distribution centers available' });

    const origin = {
      street: dc.address_street,
      city: dc.address_city,
      state: dc.address_state,
      zip: dc.address_zip,
      country: dc.address_country,
    };

    const destination = destinationAddress || {
      street: req.user.address_street,
      city: req.user.address_city,
      state: req.user.address_state,
      zip: req.user.address_zip,
      country: req.user.address_country || 'US',
    };

    const rates = await getRates(origin, destination, {
      weight_kg: product.weight_kg,
      length_cm: product.length_cm,
      width_cm: product.width_cm,
      height_cm: product.height_cm,
    });

    res.json({
      rates,
      origin: { name: dc.name, city: dc.address_city, state: dc.address_state },
      packageDetails: {
        weight: product.weight_kg,
        dimensions: `${product.length_cm}x${product.width_cm}x${product.height_cm} cm`,
      },
    });
  } catch (error) {
    console.error('Shipping rates error:', error);
    res.status(500).json({ error: error.message || 'Failed to get shipping rates' });
  }
});

/**
 * POST /api/shipping/generate-seller-label
 * Admin generates shipping label for seller → DC
 */
router.post('/generate-seller-label', authenticate, requireAdmin, async (req, res) => {
  try {
    const { orderId, distributionCenterId } = req.body;
    if (!orderId || !distributionCenterId) {
      return res.status(400).json({ error: 'Order ID and distribution center ID are required' });
    }

    const result = await generateSellerToDCLabel(orderId, distributionCenterId);

    // Log admin action
    db.prepare(`
      INSERT INTO analytics_events (event_type, user_id, order_id, data)
      VALUES ('admin_label_generated', ?, ?, ?)
    `).run(req.user.id, orderId, JSON.stringify({ type: 'seller_to_dc', ...result }));

    res.json({
      message: 'Seller shipping label generated',
      ...result,
    });
  } catch (error) {
    console.error('Generate seller label error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate shipping label' });
  }
});

/**
 * POST /api/shipping/generate-buyer-label
 * Admin generates shipping label for DC → Buyer
 */
router.post('/generate-buyer-label', authenticate, requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID is required' });

    // Verify order was received at DC
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const result = await generateDCToBuyerLabel(orderId);

    // Log admin action
    db.prepare(`
      INSERT INTO analytics_events (event_type, user_id, order_id, data)
      VALUES ('admin_label_generated', ?, ?, ?)
    `).run(req.user.id, orderId, JSON.stringify({ type: 'dc_to_buyer', ...result }));

    res.json({
      message: 'Buyer shipping label generated',
      ...result,
    });
  } catch (error) {
    console.error('Generate buyer label error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate shipping label' });
  }
});

/**
 * POST /api/shipping/mark-received-at-dc
 * Admin marks package as received at distribution center
 */
router.post('/mark-received-at-dc', authenticate, requireAdmin, (req, res) => {
  try {
    const { orderId } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    db.prepare(`
      UPDATE orders SET status = 'received_at_dc', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(orderId);

    // Update seller shipment status
    db.prepare(`
      UPDATE shipments SET status = 'delivered', updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ? AND type = 'seller_to_dc'
    `).run(orderId);

    // Notify buyer
    const { v4: uuidv4 } = await import('uuid');
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, data)
      VALUES (?, ?, 'received_at_dc', 'Product Received at Distribution Center', ?, ?)
    `).run(
      uuidv4(), order.buyer_id,
      `Your order #${orderId.slice(0, 8)} has been received at our distribution center and will be shipped to you soon.`,
      JSON.stringify({ orderId })
    );

    res.json({ message: 'Package marked as received at DC' });
  } catch (error) {
    console.error('Mark received error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/shipping/track/:trackingNumber
 * Track a FedEx shipment
 */
router.get('/track/:trackingNumber', authenticate, async (req, res) => {
  try {
    const result = await trackShipment(req.params.trackingNumber);
    res.json(result);
  } catch (error) {
    console.error('Tracking error:', error);
    res.status(500).json({ error: error.message || 'Failed to track shipment' });
  }
});

/**
 * GET /api/shipping/shipments/:orderId
 * Get all shipments for an order
 */
router.get('/shipments/:orderId', authenticate, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.buyer_id !== req.user.id && order.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const shipments = db.prepare('SELECT * FROM shipments WHERE order_id = ? ORDER BY created_at').all(req.params.orderId);

    res.json({
      shipments: shipments.map(s => ({
        id: s.id,
        type: s.type,
        trackingNumber: s.fedex_tracking_number,
        labelBase64: s.fedex_label_base64,
        serviceType: s.service_type,
        rateAmount: s.rate_amount,
        status: s.status,
        estimatedDelivery: s.estimated_delivery,
        createdAt: s.created_at,
      })),
    });
  } catch (error) {
    console.error('Shipments fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch shipments' });
  }
});

/**
 * GET /api/shipping/distribution-centers
 * List active distribution centers (public)
 */
router.get('/distribution-centers', (req, res) => {
  const centers = db.prepare('SELECT * FROM distribution_centers WHERE is_active = 1').all();
  res.json({
    centers: centers.map(dc => ({
      id: dc.id,
      name: dc.name,
      city: dc.address_city,
      state: dc.address_state,
      country: dc.address_country,
    })),
  });
});

export default router;
