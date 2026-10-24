import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import config from './config.js';

// Ensure data directory exists
const dbDir = path.dirname(config.DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(config.DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    -- Users & authentication
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      wallet_address TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE,
      display_name TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      role TEXT DEFAULT 'user' CHECK(role IN ('user','seller','admin')),
      is_verified INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      total_sales INTEGER DEFAULT 0,
      total_reviews INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

      -- Address fields
      address_street TEXT,
      address_city TEXT,
      address_state TEXT,
      address_zip TEXT,
      address_country TEXT DEFAULT 'US',
      address_phone TEXT
    );

    -- Admin-managed wallets (platform wallets for receiving payments)
    CREATE TABLE IF NOT EXISTS platform_wallets (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      currency TEXT NOT NULL CHECK(currency IN ('BTC','ETH','USDT','SOL')),
      address TEXT NOT NULL,
      percentage REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Distribution centers
    CREATE TABLE IF NOT EXISTS distribution_centers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      address_street TEXT NOT NULL,
      address_city TEXT NOT NULL,
      address_state TEXT NOT NULL,
      address_zip TEXT NOT NULL,
      address_country TEXT DEFAULT 'US',
      phone TEXT,
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Admin margin/pricing configuration
    CREATE TABLE IF NOT EXISTS pricing_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tax_rate REAL NOT NULL DEFAULT 0.10,
      profit_margin REAL NOT NULL DEFAULT 0.20,
      packaging_cost REAL NOT NULL DEFAULT 5.00,
      btc_gateway_fee REAL NOT NULL DEFAULT 0.01,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_by TEXT REFERENCES users(id)
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      base_price REAL NOT NULL,
      final_price REAL,
      crypto_currency TEXT NOT NULL CHECK(crypto_currency IN ('BTC','ETH','USDT','SOL')),
      category TEXT DEFAULT '',
      condition TEXT DEFAULT 'New' CHECK(condition IN ('New','Like New','Good','Fair','Used')),
      seller_id TEXT NOT NULL REFERENCES users(id),
      stock INTEGER DEFAULT 1,
      tags TEXT DEFAULT '[]',
      shipping_info TEXT DEFAULT '',
      rating REAL DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      views INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,

      -- Shipping dimensions (required for FedEx)
      weight_kg REAL NOT NULL DEFAULT 0,
      length_cm REAL NOT NULL DEFAULT 0,
      width_cm REAL NOT NULL DEFAULT 0,
      height_cm REAL NOT NULL DEFAULT 0,
      packaging_cost REAL DEFAULT 0,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Product images
    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Orders
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL REFERENCES users(id),
      seller_id TEXT NOT NULL REFERENCES users(id),
      product_id TEXT NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL DEFAULT 1,

      -- Pricing breakdown
      base_price REAL NOT NULL,
      packaging_cost REAL DEFAULT 0,
      shipping_cost REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      platform_fee REAL DEFAULT 0,
      total_price REAL NOT NULL,
      crypto_currency TEXT NOT NULL,
      crypto_amount REAL,

      -- Status
      status TEXT DEFAULT 'pending_payment' CHECK(status IN (
        'pending_payment','paid','escrow_held','seller_notified',
        'label_generated','shipped_to_dc','received_at_dc',
        'shipped_to_buyer','delivered','completed','disputed','refunded','cancelled'
      )),

      -- Payment / escrow
      btcpay_invoice_id TEXT,
      payment_tx_hash TEXT,
      escrow_tx_hash TEXT,
      escrow_released_at DATETIME,

      -- Shipping
      distribution_center_id TEXT REFERENCES distribution_centers(id),
      seller_shipping_label_url TEXT,
      seller_tracking_number TEXT,
      buyer_shipping_label_url TEXT,
      buyer_tracking_number TEXT,
      fedex_rate_id TEXT,

      -- Addresses
      shipping_address_street TEXT,
      shipping_address_city TEXT,
      shipping_address_state TEXT,
      shipping_address_zip TEXT,
      shipping_address_country TEXT,
      shipping_address_phone TEXT,

      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      paid_at DATETIME,
      shipped_at DATETIME,
      delivered_at DATETIME
    );

    -- Notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT DEFAULT '',
      data TEXT DEFAULT '{}',
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Chat messages
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id),
      receiver_id TEXT NOT NULL REFERENCES users(id),
      order_id TEXT REFERENCES orders(id),
      text TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Reviews
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL REFERENCES products(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      order_id TEXT REFERENCES orders(id),
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Escrow ledger
    CREATE TABLE IF NOT EXISTS escrow_ledger (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      type TEXT NOT NULL CHECK(type IN ('hold','release','refund','dispute')),
      amount REAL NOT NULL,
      crypto_currency TEXT NOT NULL,
      tx_hash TEXT,
      from_address TEXT,
      to_address TEXT,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','confirmed','failed')),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- FedEx shipment tracking
    CREATE TABLE IF NOT EXISTS shipments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id),
      type TEXT NOT NULL CHECK(type IN ('seller_to_dc','dc_to_buyer')),
      fedex_tracking_number TEXT,
      fedex_label_url TEXT,
      fedex_label_base64 TEXT,
      origin_address TEXT NOT NULL,
      destination_address TEXT NOT NULL,
      weight_kg REAL,
      dimensions TEXT,
      service_type TEXT DEFAULT 'FEDEX_GROUND',
      rate_amount REAL,
      rate_currency TEXT DEFAULT 'USD',
      status TEXT DEFAULT 'created' CHECK(status IN ('created','label_printed','picked_up','in_transit','delivered','exception')),
      estimated_delivery DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Analytics events
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      user_id TEXT,
      product_id TEXT,
      order_id TEXT,
      data TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Insert default pricing config if not exists
    INSERT OR IGNORE INTO pricing_config (id, tax_rate, profit_margin, packaging_cost, btc_gateway_fee)
    VALUES (1, 0.10, 0.20, 5.00, 0.01);

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
    CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
    CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_events(created_at);
  `);

  console.log('✅ Database initialized successfully');
}

export default db;
