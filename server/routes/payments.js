import { Router } from 'express';
import crypto from 'crypto';
import db from '../database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { processWebhookEvent, verifyWebhookSignature, markPaymentReceived } from '../services/bitcoin.js';
import { releaseEscrow, refundEscrow, processAutoReleases } from '../services/escrow.js';
import config from '../config.js';

const router = Router();

/**
 * POST /api/payments/webhook
 * BTCPay Server webhook endpoint
 * Receives payment notifications
 */
router.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['btcpay-sig'];
    const rawBody = JSON.stringify(req.body);

    // Verify webhook signature
    if (config.BTCPAY_WEBHOOK_SECRET && signature) {
      if (!verifyWebhookSignature(rawBody, signature)) {
        console.warn('Invalid webhook signature');
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const event = req.body;
    console.log(`BTCPay webhook received: ${event.type} for invoice ${event.invoiceId}`);

    await processWebhookEvent(event);

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/payments/manual-confirm
 * Admin manually confirms a payment (for testing or manual BTC verification)
 */
router.post('/manual-confirm', authenticate, requireAdmin, (req, res) => {
  try {
    const { orderId, txHash } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID is required' });

    const result = markPaymentReceived(orderId, txHash || `manual_${Date.now()}`);

    // Log admin action
    db.prepare(`
      INSERT INTO analytics_events (event_type, user_id, order_id, data)
      VALUES ('admin_manual_payment', ?, ?, ?)
    `).run(req.user.id, orderId, JSON.stringify({ txHash }));

    res.json({ message: 'Payment confirmed', order: result });
  } catch (error) {
    console.error('Manual confirm error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/release-escrow
 * Admin releases escrow for an order
 */
router.post('/release-escrow', authenticate, requireAdmin, (req, res) => {
  try {
    const { orderId } = req.body;
    if (!orderId) return res.status(400).json({ error: 'Order ID is required' });

    const result = releaseEscrow(orderId, req.user.id);
    res.json({ message: 'Escrow released', ...result });
  } catch (error) {
    console.error('Release escrow error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/refund
 * Admin refunds an order
 */
router.post('/refund', authenticate, requireAdmin, (req, res) => {
  try {
    const { orderId, reason } = req.body;
    if (!orderId || !reason) return res.status(400).json({ error: 'Order ID and reason are required' });

    const result = refundEscrow(orderId, reason, req.user.id);
    res.json({ message: 'Refund issued', ...result });
  } catch (error) {
    console.error('Refund error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/payments/process-auto-releases
 * Trigger auto-release check (can be called by cron or admin)
 */
router.post('/process-auto-releases', authenticate, requireAdmin, (req, res) => {
  try {
    const results = processAutoReleases();
    res.json({ message: `Processed ${results.length} auto-releases`, results });
  } catch (error) {
    console.error('Auto-release error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/payments/escrow-ledger
 * Get escrow ledger (admin or order participants)
 */
router.get('/escrow-ledger', authenticate, (req, res) => {
  try {
    const { orderId } = req.query;
    let records;

    if (req.user.role === 'admin') {
      if (orderId) {
        records = db.prepare('SELECT * FROM escrow_ledger WHERE order_id = ? ORDER BY created_at DESC').all(orderId);
      } else {
        records = db.prepare('SELECT * FROM escrow_ledger ORDER BY created_at DESC LIMIT 100').all();
      }
    } else {
      if (!orderId) return res.status(400).json({ error: 'Order ID required' });
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (!order || (order.buyer_id !== req.user.id && order.seller_id !== req.user.id)) {
        return res.status(403).json({ error: 'Not authorized' });
      }
      records = db.prepare('SELECT * FROM escrow_ledger WHERE order_id = ? ORDER BY created_at DESC').all(orderId);
    }

    res.json({ records });
  } catch (error) {
    console.error('Escrow ledger error:', error);
    res.status(500).json({ error: 'Failed to fetch escrow ledger' });
  }
});

/**
 * GET /api/payments/platform-wallets
 * Get platform wallet addresses (public)
 */
router.get('/platform-wallets', (req, res) => {
  const wallets = db.prepare('SELECT * FROM platform_wallets WHERE is_active = 1').all();
  res.json({
    wallets: wallets.map(w => ({
      id: w.id,
      label: w.label,
      currency: w.currency,
      address: w.address,
      percentage: w.percentage,
    })),
  });
});

export default router;
