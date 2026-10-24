import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { authenticate, generateToken } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/auth/connect
 * Connect wallet (login or register)
 * Body: { walletAddress, walletType }
 */
router.post('/connect', (req, res) => {
  try {
    const { walletAddress, walletType } = req.body;
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    const normalizedAddress = walletAddress.toLowerCase().trim();

    // Check if user exists
    let user = db.prepare('SELECT * FROM users WHERE wallet_address = ?').get(normalizedAddress);

    if (!user) {
      // Create new user
      const userId = uuidv4();
      const username = `user_${normalizedAddress.slice(0, 8)}`;

      db.prepare(`
        INSERT INTO users (id, wallet_address, username, display_name, role)
        VALUES (?, ?, ?, ?, 'user')
      `).run(userId, normalizedAddress, username, username);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

      // Log registration
      db.prepare(`
        INSERT INTO analytics_events (event_type, user_id, data)
        VALUES ('user_registered', ?, ?)
      `).run(userId, JSON.stringify({ walletType, walletAddress: normalizedAddress }));

      // Welcome notification
      db.prepare(`
        INSERT INTO notifications (id, user_id, type, title, message)
        VALUES (?, ?, 'welcome', 'Welcome to CryptoMart!', 'Your account has been created. Start buying and selling with crypto!')
      `).run(uuidv4(), userId);
    }

    const token = generateToken(user.id);

    // Log login
    db.prepare(`
      INSERT INTO analytics_events (event_type, user_id, data)
      VALUES ('user_login', ?, ?)
    `).run(user.id, JSON.stringify({ walletType }));

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (error) {
    console.error('Auth connect error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticate, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: sanitizeUser(user) });
});

/**
 * PUT /api/auth/profile
 * Update user profile
 */
router.put('/profile', authenticate, (req, res) => {
  try {
    const { displayName, username, bio, avatarUrl } = req.body;

    // Check username uniqueness
    if (username) {
      const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username, req.user.id);
      if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
      }
    }

    db.prepare(`
      UPDATE users 
      SET display_name = COALESCE(?, display_name),
          username = COALESCE(?, username),
          bio = COALESCE(?, bio),
          avatar_url = COALESCE(?, avatar_url),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(displayName, username, bio, avatarUrl, req.user.id);

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: sanitizeUser(updatedUser) });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * PUT /api/auth/address
 * Update user shipping address
 */
router.put('/address', authenticate, (req, res) => {
  try {
    const { street, city, state, zip, country, phone } = req.body;

    if (!street || !city || !state || !zip) {
      return res.status(400).json({ error: 'Street, city, state, and zip are required' });
    }

    db.prepare(`
      UPDATE users 
      SET address_street = ?, address_city = ?, address_state = ?,
          address_zip = ?, address_country = ?, address_phone = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(street, city, state, zip, country || 'US', phone, req.user.id);

    const updatedUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    res.json({ user: sanitizeUser(updatedUser) });
  } catch (error) {
    console.error('Address update error:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

/**
 * GET /api/auth/user/:id
 * Get public user profile
 */
router.get('/user/:id', (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user: sanitizeUser(user) });
});

function sanitizeUser(user) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.display_name,
    avatarUrl: user.avatar_url,
    bio: user.bio,
    role: user.role,
    isVerified: !!user.is_verified,
    rating: user.rating,
    totalSales: user.total_sales,
    totalReviews: user.total_reviews,
    walletAddress: user.wallet_address,
    createdAt: user.created_at,
    address: user.address_street ? {
      street: user.address_street,
      city: user.address_city,
      state: user.address_state,
      zip: user.address_zip,
      country: user.address_country,
      phone: user.address_phone,
    } : null,
  };
}

export default router;
