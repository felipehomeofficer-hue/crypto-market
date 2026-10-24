import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../database.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

/**
 * GET /api/chat/threads
 * Get all chat threads for current user
 */
router.get('/threads', authenticate, (req, res) => {
  try {
    // Get unique conversation partners
    const conversations = db.prepare(`
      SELECT 
        CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END as partner_id,
        MAX(created_at) as last_message_time,
        COUNT(CASE WHEN is_read = 0 AND receiver_id = ? THEN 1 END) as unread_count
      FROM messages
      WHERE sender_id = ? OR receiver_id = ?
      GROUP BY partner_id
      ORDER BY last_message_time DESC
    `).all(req.user.id, req.user.id, req.user.id, req.user.id);

    const threads = conversations.map(conv => {
      const partner = db.prepare('SELECT id, username, display_name, avatar_url FROM users WHERE id = ?').get(conv.partner_id);
      const lastMessage = db.prepare(`
        SELECT * FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at DESC LIMIT 1
      `).get(req.user.id, conv.partner_id, conv.partner_id, req.user.id);

      return {
        partnerId: conv.partner_id,
        partnerUsername: partner?.username,
        partnerDisplayName: partner?.display_name,
        partnerAvatar: partner?.avatar_url,
        lastMessage: lastMessage?.text,
        lastMessageTime: conv.last_message_time,
        unreadCount: conv.unread_count,
      };
    });

    res.json({ threads });
  } catch (error) {
    console.error('Chat threads error:', error);
    res.status(500).json({ error: 'Failed to fetch threads' });
  }
});

/**
 * GET /api/chat/messages/:partnerId
 * Get messages with a specific user
 */
router.get('/messages/:partnerId', authenticate, (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const messages = db.prepare(`
      SELECT * FROM messages
      WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, req.params.partnerId, req.params.partnerId, req.user.id, parseInt(limit), offset);

    // Mark messages as read
    db.prepare(`
      UPDATE messages SET is_read = 1
      WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
    `).run(req.params.partnerId, req.user.id);

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error('Messages error:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/chat/messages
 * Send a message
 */
router.post('/messages', authenticate, (req, res) => {
  try {
    const { receiverId, text, orderId } = req.body;
    if (!receiverId || !text) {
      return res.status(400).json({ error: 'Receiver ID and text are required' });
    }

    // Check receiver exists
    const receiver = db.prepare('SELECT id FROM users WHERE id = ?').get(receiverId);
    if (!receiver) return res.status(404).json({ error: 'Receiver not found' });

    const messageId = uuidv4();
    db.prepare(`
      INSERT INTO messages (id, sender_id, receiver_id, order_id, text)
      VALUES (?, ?, ?, ?, ?)
    `).run(messageId, req.user.id, receiverId, orderId || null, text);

    // Create notification for receiver
    db.prepare(`
      INSERT INTO notifications (id, user_id, type, title, message, data)
      VALUES (?, ?, 'new_message', 'New Message', ?, ?)
    `).run(
      uuidv4(), receiverId,
      `${req.user.display_name || req.user.username}: ${text.substring(0, 100)}`,
      JSON.stringify({ senderId: req.user.id, messageId })
    );

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    res.status(201).json({ message });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

export default router;
