# CryptoMart Backend Server

Real production-ready backend for the CryptoMart P2P crypto marketplace.

## Features

- **🔐 JWT Authentication** — Wallet-based login (MetaMask, Phantom, etc.)
- **📸 Product Photo Upload** — Multi-image upload with Sharp optimization (thumbnails + optimized)
- **₿ Real Bitcoin Payments** — BTCPay Server integration with escrow
- **📦 FedEx Shipping** — Real API for rates, labels, and tracking
- **💰 Automated Pricing** — Markup calculation: `finalPrice = (cost + packaging + freight) / (1 - (tax + margin))`
- **🔒 Escrow System** — Hold → Release/Refund with dispute resolution
- **💬 Real-time Chat** — WebSocket-based messaging
- **📊 Admin Analytics** — Revenue, users, orders, daily stats
- **🏢 Distribution Centers** — Multi-DC support for label routing
- **💳 Platform Wallets** — Admin-managed crypto wallets with split percentages

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy environment template
cp server/.env.example .env

# 3. Configure your API keys in .env
#    - BTCPay Server (for Bitcoin payments)
#    - FedEx Developer API (for shipping)

# 4. Build frontend
npm run build

# 5. Start the server
node server/index.js
```

Server runs at http://localhost:3001

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/connect` | Connect wallet (login/register) |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/profile` | Update profile |
| PUT | `/api/auth/address` | Update shipping address |

### Products
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/products` | List products (search, filter, paginate) |
| GET | `/api/products/:id` | Get product details |
| POST | `/api/products` | Create product (with image upload) |
| PUT | `/api/products/:id` | Update product |
| DELETE | `/api/products/:id` | Delete product |
| POST | `/api/products/:id/reviews` | Add review |

### Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/orders/calculate-price` | Calculate order price with shipping |
| POST | `/api/orders` | Create order |
| GET | `/api/orders` | List user's orders |
| GET | `/api/orders/:id` | Get order details |
| GET | `/api/orders/:id/payment-status` | Check payment via BTCPay |
| POST | `/api/orders/:id/confirm-delivery` | Buyer confirms delivery |
| POST | `/api/orders/:id/dispute` | Open dispute |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/webhook` | BTCPay webhook |
| POST | `/api/payments/manual-confirm` | Admin: confirm payment |
| POST | `/api/payments/release-escrow` | Admin: release escrow |
| POST | `/api/payments/refund` | Admin: refund order |
| GET | `/api/payments/escrow-ledger` | Get escrow records |
| GET | `/api/payments/platform-wallets` | Get platform wallets |

### Shipping
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/shipping/rates` | Get FedEx rates |
| POST | `/api/shipping/generate-seller-label` | Admin: label seller→DC |
| POST | `/api/shipping/generate-buyer-label` | Admin: label DC→buyer |
| POST | `/api/shipping/mark-received-at-dc` | Admin: mark received |
| GET | `/api/shipping/track/:tracking` | Track shipment |
| GET | `/api/shipping/distribution-centers` | List DCs |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/admin/pricing` | Pricing configuration |
| CRUD | `/api/admin/wallets` | Platform wallets |
| CRUD | `/api/admin/distribution-centers` | Distribution centers |
| GET | `/api/admin/users` | User management |
| PUT | `/api/admin/users/:id/role` | Change user role |
| GET | `/api/admin/orders` | All orders |
| GET | `/api/admin/analytics/overview` | Full analytics |
| GET | `/api/admin/analytics/revenue` | Revenue breakdown |

### Chat
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/chat/threads` | Get conversation threads |
| GET | `/api/chat/messages/:partnerId` | Get messages |
| POST | `/api/chat/messages` | Send message |

## Order Flow

```
1. Buyer creates order → status: pending_payment
2. BTCPay invoice created → buyer pays in BTC
3. BTCPay webhook confirms → status: escrow_held
4. Admin generates seller→DC label → seller notified
5. Seller ships to distribution center
6. Admin marks received at DC → status: received_at_dc
7. Admin generates DC→buyer label → status: shipped_to_buyer
8. Buyer receives → confirms delivery → status: delivered
9. After 48h (no dispute) → escrow auto-released → status: completed
```

## Pricing Formula

```
finalPrice = (productPrice + packagingCost + fedexShipping) / (1 - (taxRate + profitMargin))

Example:
- Product: $100
- Packaging: $5
- FedEx: $15
- Tax rate: 10% (includes BTC gateway fee ~1%)
- Profit margin: 20%

finalPrice = (100 + 5 + 15) / (1 - (0.10 + 0.20))
           = 120 / 0.70
           = $171.43
```

## External Service Setup

### BTCPay Server
1. Deploy BTCPay Server (Docker recommended): https://docs.btcpayserver.org/Docker/
2. Create a store and generate API key
3. Set up webhook pointing to `/api/payments/webhook`
4. Configure `.env` with your credentials

### FedEx Developer
1. Register at https://developer.fedex.com/
2. Create a project and get API credentials
3. Use sandbox URL for testing
4. Configure `.env` with your credentials

## WebSocket Events

Connect to `ws://localhost:3001/ws`

### Client → Server
- `{ type: "auth", token: "jwt..." }` — Authenticate
- `{ type: "chat_message", receiverId: "...", text: "..." }` — Send message
- `{ type: "ping" }` — Keepalive

### Server → Client
- `{ type: "auth_success", userId: "..." }` — Auth confirmed
- `{ type: "new_message", message: {...} }` — New chat message
- `{ type: "notification", notification: {...} }` — Push notification
- `{ type: "pong" }` — Keepalive response
