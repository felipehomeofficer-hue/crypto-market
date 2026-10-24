#!/bin/bash
# CryptoMart Server Startup Script

echo "🚀 Starting CryptoMart Backend..."

# Check if .env exists
if [ ! -f .env ]; then
  echo "⚠️  No .env file found. Copying from template..."
  cp server/.env.example .env
  echo "📝 Please edit .env with your API keys"
fi

# Create data directory
mkdir -p server/data
mkdir -p server/uploads/products
mkdir -p server/uploads/avatars
mkdir -p server/uploads/labels

# Start server
node server/index.js
