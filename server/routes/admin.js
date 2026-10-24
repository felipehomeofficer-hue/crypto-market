import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { updatePricingConfig, getPricingConfig } from '../services/pricing.js';

const router = Router();

// ========== PRICING CONFIG ==========

/**
 * GET /api/admin/pricing
 */
router.get('/pricing', authenticate, requireAdmin, (req, res) => {
  const config = getPricingConfig();
  res.json({ pricing: config });
});

/**
 * PUT /api/admin/pricing
 */
router.put('/pricing', authenticate, requireAdmin, (req, res) => {
  try {
    const result = updatePricingConfig(req.body, req.user.id);
    res.json({ message: 'Pricing config updated', pricing: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== PLATFORM WALLETS ==========

/**
 * GET /api/admin/wallets
 */
router.get('/wallets', authenticate, requireAdmin, (req, res) => {
  const wallets = db.prepare('SELECT * FROM platform_wallets ORDER BY created_at DESC').all();
  res.json({ wallets });
});

/**
 * POST /api/admin/wallets
 */
router.post('/wallets', authenticate, requireAdmin, (req, res) => {
  try {
    const { label, currency, address, percentage } = req.body;
    if (!label || !currency || !address) {
      return res.status(400).json({ error: 'Label, currency, and address are required' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO platform_wallets (id, label, currency, address, percentage)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, label, currency, address, parseFloat(percentage || 0));

    db.prepare(`
      INSERT INTO analytics_events (event_type, user_id, data)
      VALUES ('wallet_added', ?, ?)
    `).run(req.user.id, JSON.stringify({ id, label, currency, address }));

    const wallet = db.prepare('SELECT * FROM platform_wallets WHERE id = ?').get(id);
    res.status(201).json({ wallet });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/wallets/:id
 */
router.put('/wallets/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { label, address, percentage, isActive } = req.body;
    db.prepare(`
      UPDATE platform_wallets 
      SET label = COALESCE(?, label), address = COALESCE(?, address),
          percentage = COALESCE(?, percentage), is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(label, address, percentage != null ? parseFloat(percentage) : null, isActive != null ? (isActive ? 1 : 0) : null, req.params.id);

    const wallet = db.prepare('SELECT * FROM platform_wallets WHERE id = ?').get(req.params.id);
    res.json({ wallet });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/wallets/:id
 */
router.delete('/wallets/:id', authenticate, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM platform_wallets WHERE id = ?').run(req.params.id);
  res.json({ message: 'Wallet deleted' });
});

// ========== DISTRIBUTION CENTERS ==========

/**
 * GET /api/admin/distribution-centers
 */
router.get('/distribution-centers', authenticate, requireAdmin, (req, res) => {
  const centers = db.prepare('SELECT * FROM distribution_centers ORDER BY created_at DESC').all();
  res.json({ centers });
});

/**
 * POST /api/admin/distribution-centers
 */
router.post('/distribution-centers', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, addressStreet, addressCity, addressState, addressZip, addressCountry, phone, email } = req.body;
    if (!name || !addressStreet || !addressCity || !addressState || !addressZip) {
      return res.status(400).json({ error: 'Name and full address are required' });
    }

    const id = uuidv4();
    db.prepare(`
      INSERT INTO distribution_centers (id, name, address_street, address_city, address_state, address_zip, address_country, phone, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, addressStreet, addressCity, addressState, addressZip, addressCountry || 'US', phone || '', email || '');

    const center = db.prepare('SELECT * FROM distribution_centers WHERE id = ?').get(id);
    res.status(201).json({ center });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/distribution-centers/:id
 */
router.put('/distribution-centers/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { name, addressStreet, addressCity, addressState, addressZip, addressCountry, phone, email, isActive } = req.body;
    db.prepare(`
      UPDATE distribution_centers 
      SET name = COALESCE(?, name), address_street = COALESCE(?, address_street),
          address_city = COALESCE(?, address_city), address_state = COALESCE(?, address_state),
          address_zip = COALESCE(?, address_zip), address_country = COALESCE(?, address_country),
          phone = COALESCE(?, phone), email = COALESCE(?, email),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(name, addressStreet, addressCity, addressState, addressZip, addressCountry, phone, email,
      isActive != null ? (isActive ? 1 : 0) : null, req.params.id);

    const center = db.prepare('SELECT * FROM distribution_centers WHERE id = ?').get(req.params.id);
    res.json({ center });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/distribution-centers/:id
 */
router.delete('/distribution-centers/:id', authenticate, requireAdmin, (req, res) => {
  db.prepare('UPDATE distribution_centers SET is_active = 0 WHERE id = ?').run(req.params.id);
  res.json({ message: 'Distribution center deactivated' });
});

// ========== USER MANAGEMENT ==========

/**
 * GET /api/admin/users
 */
router.get('/users', authenticate, requireAdmin, (req, res) => {
  const { page = 1, limit = 50, role, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = [];
  const params = [];

  if (role) { where.push('role = ?'); params.push(role); }
  if (search) { where.push('(username LIKE ? OR display_name LIKE ? OR wallet_address LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) as count FROM users ${whereClause}`).get(...params).count;
  const users = db.prepare(`SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(limit), offset);

  res.json({
    users: users.map(u => ({
      id: u.id, username: u.username, displayName: u.display_name, role: u.role,
      walletAddress: u.wallet_address, isVerified: !!u.is_verified, rating: u.rating,
      totalSales: u.total_sales, createdAt: u.created_at,
    })),
    pagination: { total, page: parseInt(page), limit: parseInt(limit) },
  });
});

/**
 * PUT /api/admin/users/:id/role
 */
router.put('/users/:id/role', authenticate, requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['user', 'seller', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, req.params.id);
  res.json({ message: 'User role updated' });
});

/**
 * PUT /api/admin/users/:id/verify
 */
router.put('/users/:id/verify', authenticate, requireAdmin, (req, res) => {
  const { verified } = req.body;
  db.prepare('UPDATE users SET is_verified = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(verified ? 1 : 0, req.params.id);
  res.json({ message: 'User verification updated' });
});

// ========== ORDER MANAGEMENT ==========

/**
 * GET /api/admin/orders
 */
router.get('/orders', authenticate, requireAdmin, (req, res) => {
  const { status, page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  let where = [];
  const params = [];

  if (status) { where.push('o.status = ?'); params.push(status); }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = db.prepare(`SELECT COUNT(*) as count FROM orders o ${whereClause}`).get(...params).count;

  const orders = db.prepare(`
    SELECT o.*, p.title as product_title,
           buyer.display_name as buyer_name, seller.display_name as seller_name
    FROM orders o
    LEFT JOIN products p ON o.product_id = p.id
    LEFT JOIN users buyer ON o.buyer_id = buyer.id
    LEFT JOIN users seller ON o.seller_id = seller.id
    ${whereClause}
    ORDER BY o.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  res.json({ orders, pagination: { total, page: parseInt(page), limit: parseInt(limit) } });
});

/**
 * PUT /api/admin/orders/:id/status
 */
router.put('/orders/:id/status', authenticate, requireAdmin, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['pending_payment', 'paid', 'escrow_held', 'seller_notified', 'label_generated',
    'shipped_to_dc', 'received_at_dc', 'shipped_to_buyer', 'delivered', 'completed', 'disputed', 'refunded', 'cancelled'];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, req.params.id);
  res.json({ message: 'Order status updated' });
});

// ========== ANALYTICS ==========

/**
 * GET /api/admin/analytics/overview
 */
router.get('/analytics/overview', authenticate, requireAdmin, (req, res) => {
  try {
    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').get().count;
    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;

    const revenue = db.prepare(`
      SELECT crypto_currency, SUM(total_price) as total, COUNT(*) as orders
      FROM orders WHERE status IN ('completed', 'delivered', 'escrow_held', 'shipped_to_buyer')
      GROUP BY crypto_currency
    `).all();

    const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending_payment'").get().count;
    const escrowHeld = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'escrow_held'").get().count;
    const disputes = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'disputed'").get().count;

    // Daily stats for last 30 days
    const dailyStats = db.prepare(`
      SELECT DATE(created_at) as date,
             COUNT(*) as orders,
             SUM(total_price) as revenue
      FROM orders
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all();

    // Daily signups
    const dailySignups = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM users
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY DATE(created_at)
      ORDER BY date
    `).all();

    // Top products
    const topProducts = db.prepare(`
      SELECT p.id, p.title, p.views, p.rating, p.review_count,
             COUNT(o.id) as order_count, SUM(o.total_price) as total_revenue
      FROM products p
      LEFT JOIN orders o ON p.id = o.product_id AND o.status NOT IN ('cancelled', 'refunded')
      WHERE p.is_active = 1
      GROUP BY p.id
      ORDER BY order_count DESC
      LIMIT 10
    `).all();

    // Top sellers
    const topSellers = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.rating, u.total_sales,
             COUNT(o.id) as order_count, SUM(o.total_price) as total_revenue
      FROM users u
      LEFT JOIN orders o ON u.id = o.seller_id AND o.status NOT IN ('cancelled', 'refunded')
      WHERE u.role IN ('seller', 'admin')
      GROUP BY u.id
      ORDER BY total_revenue DESC
      LIMIT 10
    `).all();

    // Recent events
    const recentEvents = db.prepare(`
      SELECT * FROM analytics_events ORDER BY created_at DESC LIMIT 50
    `).all();

    // Category breakdown
    const categories = db.prepare(`
      SELECT category, COUNT(*) as count, SUM(views) as total_views
      FROM products WHERE is_active = 1
      GROUP BY category ORDER BY count DESC
    `).all();

    res.json({
      overview: {
        totalUsers, totalProducts, totalOrders, pendingOrders, escrowHeld, disputes,
        revenue,
      },
      dailyStats,
      dailySignups,
      topProducts,
      topSellers,
      recentEvents,
      categories,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/admin/analytics/revenue
 * Detailed revenue breakdown
 */
router.get('/analytics/revenue', authenticate, requireAdmin, (req, res) => {
  try {
    const { period = '30' } = req.query;

    const revenue = db.prepare(`
      SELECT DATE(created_at) as date,
             crypto_currency,
             COUNT(*) as orders,
             SUM(total_price) as total,
             SUM(platform_fee) as platform_fees,
             SUM(shipping_cost) as shipping_costs,
             SUM(tax_amount) as taxes
      FROM orders
      WHERE created_at >= datetime('now', '-${parseInt(period)} days')
        AND status NOT IN ('cancelled', 'refunded')
      GROUP BY DATE(created_at), crypto_currency
      ORDER BY date
    `).all();

    const escrowSummary = db.prepare(`
      SELECT type, crypto_currency, SUM(amount) as total, COUNT(*) as count
      FROM escrow_ledger
      WHERE created_at >= datetime('now', '-${parseInt(period)} days')
      GROUP BY type, crypto_currency
    `).all();

    res.json({ revenue, escrowSummary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch revenue data' });
  }
});

// ========== NOTIFICATIONS ==========

/**
 * GET /api/admin/notifications
 */
router.get('/notifications', authenticate, (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const notifications = db.prepare(`
    SELECT * FROM notifications WHERE user_id = ?
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(req.user.id, parseInt(limit), offset);

  const unreadCount = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0'
  ).get(req.user.id).count;

  res.json({ notifications, unreadCount });
});

/**
 * PUT /api/admin/notifications/:id/read
 */
router.put('/notifications/:id/read', authenticate, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'Notification marked as read' });
});

/**
 * PUT /api/admin/notifications/read-all
 */
router.put('/notifications/read-all', authenticate, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ message: 'All notifications marked as read' });
});

export default router;
