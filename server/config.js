import dotenv from 'dotenv';
dotenv.config();

export default {
  // Server
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || 'development',
  JWT_SECRET: process.env.JWT_SECRET || 'change-me-in-production-cryptomart-2024',

  // Database
  DB_PATH: process.env.DB_PATH || './server/data/cryptomart.db',

  // File uploads
  UPLOAD_DIR: process.env.UPLOAD_DIR || './server/uploads',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],

  // BTCPay Server (Self-hosted Bitcoin payment processor)
  BTCPAY_URL: process.env.BTCPAY_URL || 'https://your-btcpay-server.com',
  BTCPAY_API_KEY: process.env.BTCPAY_API_KEY || '',
  BTCPAY_STORE_ID: process.env.BTCPAY_STORE_ID || '',
  BTCPAY_WEBHOOK_SECRET: process.env.BTCPAY_WEBHOOK_SECRET || '',

  // FedEx API
  FEDEX_API_URL: process.env.FEDEX_API_URL || 'https://apis-sandbox.fedex.com',
  FEDEX_CLIENT_ID: process.env.FEDEX_CLIENT_ID || '',
  FEDEX_CLIENT_SECRET: process.env.FEDEX_CLIENT_SECRET || '',
  FEDEX_ACCOUNT_NUMBER: process.env.FEDEX_ACCOUNT_NUMBER || '',

  // Platform pricing
  DEFAULT_TAX_RATE: parseFloat(process.env.DEFAULT_TAX_RATE || '0.10'),
  DEFAULT_PROFIT_MARGIN: parseFloat(process.env.DEFAULT_PROFIT_MARGIN || '0.20'),
  DEFAULT_PACKAGING_COST: parseFloat(process.env.DEFAULT_PACKAGING_COST || '5.00'),

  // Escrow
  ESCROW_RELEASE_DELAY_HOURS: parseInt(process.env.ESCROW_RELEASE_DELAY_HOURS || '48'),
  ESCROW_DISPUTE_WINDOW_HOURS: parseInt(process.env.ESCROW_DISPUTE_WINDOW_HOURS || '168'), // 7 days
};
