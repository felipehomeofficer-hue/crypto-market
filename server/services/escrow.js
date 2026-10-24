import db from '../database.js';
import config from '../config.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Escrow Service
 * 
 * Flow:
 * 1. Buyer pays → funds held in BTCPay (escrow_held)
 * 2. Seller ships to DC → status updates
 * 3. DC receives → ships to buyer
 * 4. Buyer receives & confirms → escrow released to seller
 * 5. Auto-release after ESCROW_RELEASE_DELAY_HOURS if no dispute
 * 
 * Dispute Flow:
 * - Buyer opens dispute within ESCROW_DISPUTE_WINDOW_HOURS
 * - Admin resolves: refund buyer OR release to seller
 */

/**
 * Hold funds in escrow (called after payment confirmed)
 */
export function holdEscrow(orderId, amount, cryptoCurrency, txHash) {
  const escrowId = uuidv4();

  db.prepare(`
    INSERT INTO escrow_ledger (id, order_id, type, amount, crypto_currency, tx_hash, status)
    VALUES (?, ?, 'hold', ?, ?, ?, 'confirmed')
  `).run(escrowId, orderId, amount, cryptoCurrency, txHash);

  db.prepare(`
    UPDATE orders SET status = 'escrow_held', escrow_tx_hash = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(txHash, orderId);

  return escrowId;
}

/**
 * Release escrow to seller
 * Triggers actual payment from platform wallet to seller wallet
 */
export function releaseEscrow(orderId, adminUserId = null) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Order not found');

  if (!['escrow_held', 'delivered', 'shipped_to_buyer'].includes(order.status)) {
    throw new Error(`Cannot release escrow for order in status: ${order.status}`);
  }

  const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(order.seller_id);
  if (!seller) throw new Error('Seller not found');

  // Get pricing config for fee calculation
  const pricingConfig = db.prepare('SELECT * FROM pricing_config WHERE id = 1').get();
  const platformFee = order.total_price * (pricingConfig.profit_margin + pricingConfig.tax_rate);
  const sellerPayout = order.total_price - platformFee;

  // Record escrow release
  const releaseId = uuidv4();
  db.prepare(`
    INSERT INTO escrow_ledger (id, order_id, type, amount, crypto_currency, to_address, status)
    VALUES (?, ?, 'release', ?, ?, ?, 'pending')
  `).run(releaseId, orderId, sellerPayout, order.crypto_currency, seller.wallet_address);

  // Update order
  db.prepare(`
    UPDATE orders 
    SET status = 'completed', 
        escrow_released_at = CURRENT_TIMESTAMP,
        platform_fee = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(platformFee, orderId);

  // Update seller stats
  db.prepare(`
    UPDATE users SET total_sales = total_sales + 1 WHERE id = ?
  `).run(order.seller_id);

  // Notify seller
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, data)
    VALUES (?, ?, 'escrow_released', 'Payment Released!', ?, ?)
  `).run(
    uuidv4(), order.seller_id,
    `Escrow for order #${orderId.slice(0, 8)} has been released. ${sellerPayout} ${order.crypto_currency} sent to your wallet.`,
    JSON.stringify({ orderId, amount: sellerPayout, currency: order.crypto_currency })
  );

  // Notify buyer
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, data)
    VALUES (?, ?, 'order_completed', 'Order Completed', ?, ?)
  `).run(
    uuidv4(), order.buyer_id,
    `Order #${orderId.slice(0, 8)} is now complete. Thank you for your purchase!`,
    JSON.stringify({ orderId })
  );

  // Log analytics
  db.prepare(`
    INSERT INTO analytics_events (event_type, user_id, order_id, data)
    VALUES ('escrow_released', ?, ?, ?)
  `).run(adminUserId || 'system', orderId, JSON.stringify({
    totalPrice: order.total_price,
    platformFee,
    sellerPayout,
    currency: order.crypto_currency,
  }));

  return {
    releaseId,
    sellerPayout,
    platformFee,
    sellerWallet: seller.wallet_address,
  };
}

/**
 * Refund escrow to buyer
 */
export function refundEscrow(orderId, reason, adminUserId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Order not found');

  const buyer = db.prepare('SELECT * FROM users WHERE id = ?').get(order.buyer_id);
  if (!buyer) throw new Error('Buyer not found');

  const refundId = uuidv4();
  db.prepare(`
    INSERT INTO escrow_ledger (id, order_id, type, amount, crypto_currency, to_address, status)
    VALUES (?, ?, 'refund', ?, ?, ?, 'pending')
  `).run(refundId, orderId, order.total_price, order.crypto_currency, buyer.wallet_address);

  db.prepare(`
    UPDATE orders SET status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(orderId);

  // Notify buyer
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, data)
    VALUES (?, ?, 'refund_issued', 'Refund Issued', ?, ?)
  `).run(
    uuidv4(), order.buyer_id,
    `A refund of ${order.total_price} ${order.crypto_currency} for order #${orderId.slice(0, 8)} has been issued. Reason: ${reason}`,
    JSON.stringify({ orderId, amount: order.total_price, reason })
  );

  // Notify seller
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, data)
    VALUES (?, ?, 'order_refunded', 'Order Refunded', ?, ?)
  `).run(
    uuidv4(), order.seller_id,
    `Order #${orderId.slice(0, 8)} has been refunded to the buyer. Reason: ${reason}`,
    JSON.stringify({ orderId, reason })
  );

  return { refundId, amount: order.total_price, currency: order.crypto_currency };
}

/**
 * Open dispute on an order
 */
export function openDispute(orderId, buyerId, reason) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Order not found');
  if (order.buyer_id !== buyerId) throw new Error('Only the buyer can open a dispute');

  // Check dispute window
  const deliveredAt = order.delivered_at ? new Date(order.delivered_at) : new Date(order.paid_at);
  const windowMs = config.ESCROW_DISPUTE_WINDOW_HOURS * 60 * 60 * 1000;
  if (Date.now() - deliveredAt.getTime() > windowMs) {
    throw new Error('Dispute window has closed');
  }

  db.prepare(`
    UPDATE orders SET status = 'disputed', updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `).run(orderId);

  const disputeId = uuidv4();
  db.prepare(`
    INSERT INTO escrow_ledger (id, order_id, type, amount, crypto_currency, status)
    VALUES (?, ?, 'dispute', ?, ?, 'pending')
  `).run(disputeId, orderId, order.total_price, order.crypto_currency);

  // Notify admin
  const admins = db.prepare("SELECT id FROM users WHERE role = 'admin'").all();
  admins.forEach(admin => {
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, data)
      VALUES (?, ?, 'dispute_opened', 'New Dispute', ?, ?)
    `).run(
      uuidv4(), admin.id,
      `Dispute opened for order #${orderId.slice(0, 8)}: ${reason}`,
      JSON.stringify({ orderId, buyerId, reason })
    );
  });

  return { disputeId, orderId };
}

/**
 * Auto-release check - run periodically
 * Releases escrow for delivered orders past the delay window
 */
export function processAutoReleases() {
  const delayMs = config.ESCROW_RELEASE_DELAY_HOURS * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - delayMs).toISOString();

  const eligibleOrders = db.prepare(`
    SELECT * FROM orders 
    WHERE status = 'delivered' 
    AND delivered_at <= ?
    AND id NOT IN (SELECT order_id FROM escrow_ledger WHERE type = 'dispute')
  `).all(cutoff);

  const results = [];
  for (const order of eligibleOrders) {
    try {
      const result = releaseEscrow(order.id, 'auto-release');
      results.push({ orderId: order.id, ...result });
    } catch (err) {
      console.error(`Auto-release failed for order ${order.id}:`, err.message);
    }
  }

  return results;
}
