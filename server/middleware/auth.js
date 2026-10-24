import jwt from 'jsonwebtoken';
import config from '../config.js';
import db from '../database.js';

/**
 * JWT authentication middleware
 * Extracts token from Authorization header: Bearer <token>
 */
export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, config.JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Admin-only middleware (must be used after authenticate)
 */
export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

/**
 * Seller-or-admin middleware
 */
export function requireSeller(req, res, next) {
  if (!req.user || (req.user.role !== 'seller' && req.user.role !== 'admin')) {
    return res.status(403).json({ error: 'Seller access required' });
  }
  next();
}

/**
 * Generate JWT token for a user
 */
export function generateToken(userId) {
  return jwt.sign({ userId }, config.JWT_SECRET, { expiresIn: '30d' });
}

/**
 * Optional auth - doesn't fail if no token, just sets req.user if valid
 */
export function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET);
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
      if (user) req.user = user;
    } catch (err) {
      // Token invalid, continue without user
    }
  }
  next();
}
