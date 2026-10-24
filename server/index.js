import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import http from 'http';

import config from './config.js';
import { initDatabase } from './database.js';
import db from './database.js';
import { v4 as uuidv4 } from 'uuid';
import { generateToken } from './middleware/auth.js';

// Route imports
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payments.js';
import shippingRoutes from './routes/shipping.js';
import adminRoutes from './routes/admin.js';
import chatRoutes from './routes/chat.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize database
initDatabase();

const app = express();
const server = http.createServer(app);

// ========== MIDDLEWARE ==========

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,
  message: { error: 'Too many requests, please try again later' },
});
app.use('/api/', limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend (production)
app.use(express.static(path.join(__dirname, '..', 'dist')));

// ========== API ROUTES ==========

app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/shipping', shippingRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);

// Health check
app.get('/api/health', (req, res) => {
  const dbCheck = db.prepare('SELECT 1 as ok').get();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbCheck ? 'connected' : 'error',
    version: '1.0.0',
    services: {
      btcpay: !!config.BTCPAY_API_KEY ? 'configured' : 'not configured',
      fedex: !!config.FEDEX_CLIENT_ID ? 'configured' : 'not configured',
    },
  });
});

// ========== WEBSOCKET (Real-time chat & notifications) ==========

const wss = new WebSocketServer({ server, path: '/ws' });
const clients = new Map(); // userId -> ws connection

wss.on('connection', (ws, req) => {
  let userId = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());

      switch (msg.type) {
        case 'auth': {
          // Authenticate WebSocket connection
          const jwt = require('jsonwebtoken');
          try {
            const decoded = jwt.verify(msg.token, config.JWT_SECRET);
            userId = decoded.userId;
            clients.set(userId, ws);
            ws.send(JSON.stringify({ type: 'auth_success', userId }));
          } catch {
            ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid token' }));
          }
          break;
        }

        case 'chat_message': {
          if (!userId) return;
          // Save message to DB
          const messageId = uuidv4();
          db.prepare(`
            INSERT INTO messages (id, sender_id, receiver_id, text)
            VALUES (?, ?, ?, ?)
          `).run(messageId, userId, msg.receiverId, msg.text);

          // Send to recipient if online
          const recipientWs = clients.get(msg.receiverId);
          if (recipientWs && recipientWs.readyState === 1) {
            recipientWs.send(JSON.stringify({
              type: 'new_message',
              message: {
                id: messageId,
                senderId: userId,
                receiverId: msg.receiverId,
                text: msg.text,
                createdAt: new Date().toISOString(),
              },
            }));
          }

          // Confirm to sender
          ws.send(JSON.stringify({
            type: 'message_sent',
            message: {
              id: messageId,
              senderId: userId,
              receiverId: msg.receiverId,
              text: msg.text,
              createdAt: new Date().toISOString(),
            },
          }));
          break;
        }

        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    if (userId) clients.delete(userId);
  });
});

// Broadcast notification to a specific user
export function sendNotification(userId, notification) {
  const ws = clients.get(userId);
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'notification', notification }));
  }
}

// ========== SEED DEFAULT ADMIN ==========

function seedAdmin() {
  const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
  if (!adminExists) {
    const adminId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, wallet_address, username, display_name, role, is_verified)
      VALUES (?, ?, ?, ?, 'admin', 1)
    `).run(adminId, '0xADMIN_WALLET_ADDRESS', 'admin', 'Platform Admin');

    const token = generateToken(adminId);
    console.log('🔑 Admin account created!');
    console.log(`   Admin ID: ${adminId}`);
    console.log(`   Admin Token: ${token}`);
    console.log('   ⚠️  Change the admin wallet address in the database!\n');
  }
}

seedAdmin();

// ========== AUTO-RELEASE ESCROW CRON ==========

import { processAutoReleases } from './services/escrow.js';

// Run every hour
setInterval(() => {
  try {
    const released = processAutoReleases();
    if (released.length > 0) {
      console.log(`⏰ Auto-released ${released.length} escrow(s)`);
    }
  } catch (err) {
    console.error('Auto-release error:', err);
  }
}, 60 * 60 * 1000);

// ========== CATCH-ALL (SPA) ==========

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'dist', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ========== START SERVER ==========

server.listen(config.PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║           🚀 CryptoMart Backend Server          ║
╠══════════════════════════════════════════════════╣
║                                                  ║
║  Server:    http://localhost:${config.PORT}               ║
║  API:       http://localhost:${config.PORT}/api           ║
║  WebSocket: ws://localhost:${config.PORT}/ws              ║
║  Health:    http://localhost:${config.PORT}/api/health    ║
║                                                  ║
║  Services:                                       ║
║  • BTCPay:  ${config.BTCPAY_API_KEY ? '✅ Configured' : '⚠️  Not configured'}                    ║
║  • FedEx:   ${config.FEDEX_CLIENT_ID ? '✅ Configured' : '⚠️  Not configured'}                    ║
║                                                  ║
║  Database:  ${config.DB_PATH}        ║
║  Uploads:   ${config.UPLOAD_DIR}              ║
║                                                  ║
╚══════════════════════════════════════════════════╝
  `);
});

export default app;
