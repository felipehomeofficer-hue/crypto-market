import db from '../database.js';
import * as fedexService from './fedex.js';

/**
 * Pricing Engine
 * 
 * Formula:
 *   custoTotal = precoProduto + custoEmbalagem + freteFedex
 *   divisor = 1 - (taxasImpostos + margemLucroDesejada)
 *   precoFinalVenda = custoTotal / divisor
 * 
 * Each seller per order has their own final price calculated.
 */

/**
 * Get current pricing configuration
 */
export function getPricingConfig() {
  return db.prepare('SELECT * FROM pricing_config WHERE id = 1').get();
}

/**
 * Update pricing configuration (admin only)
 */
export function updatePricingConfig(updates, adminUserId) {
  const current = getPricingConfig();
  const newConfig = {
    tax_rate: updates.taxRate ?? current.tax_rate,
    profit_margin: updates.profitMargin ?? current.profit_margin,
    packaging_cost: updates.packagingCost ?? current.packaging_cost,
    btc_gateway_fee: updates.btcGatewayFee ?? current.btc_gateway_fee,
  };

  db.prepare(`
    UPDATE pricing_config 
    SET tax_rate = ?, profit_margin = ?, packaging_cost = ?, btc_gateway_fee = ?,
        updated_at = CURRENT_TIMESTAMP, updated_by = ?
    WHERE id = 1
  `).run(newConfig.tax_rate, newConfig.profit_margin, newConfig.packaging_cost, newConfig.btc_gateway_fee, adminUserId);

  // Log change
  db.prepare(`
    INSERT INTO analytics_events (event_type, user_id, data)
    VALUES ('pricing_config_updated', ?, ?)
  `).run(adminUserId, JSON.stringify(newConfig));

  return newConfig;
}

/**
 * Calculate final price for a product
 * @param {number} basePrice - Product base price (seller's price)
 * @param {number} packagingCost - Packaging/embalagem cost
 * @param {number} shippingCost - FedEx shipping cost
 * @param {Object} config - Optional pricing config override
 * @returns {Object} Price breakdown
 */
export function calculateFinalPrice(basePrice, packagingCost, shippingCost, configOverride = null) {
  const pricingConfig = configOverride || getPricingConfig();

  // Total taxes = tax rate + BTC gateway fee
  const totalTaxRate = pricingConfig.tax_rate + pricingConfig.btc_gateway_fee;
  const profitMargin = pricingConfig.profit_margin;

  // Cost total = product price + packaging + shipping
  const totalCost = basePrice + packagingCost + shippingCost;

  // Markup divisor
  const divisor = 1 - (totalTaxRate + profitMargin);

  if (divisor <= 0) {
    throw new Error('Invalid pricing config: tax rate + profit margin must be less than 100%');
  }

  // Final price
  const finalPrice = totalCost / divisor;

  // Breakdown
  const taxAmount = finalPrice * totalTaxRate;
  const platformProfit = finalPrice * profitMargin;
  const sellerReceives = basePrice; // Seller gets their listed price

  return {
    basePrice: round(basePrice),
    packagingCost: round(packagingCost),
    shippingCost: round(shippingCost),
    totalCost: round(totalCost),
    taxRate: totalTaxRate,
    profitMargin,
    divisor: round(divisor),
    finalPrice: round(finalPrice),
    taxAmount: round(taxAmount),
    platformProfit: round(platformProfit),
    sellerReceives: round(sellerReceives),
    markup: round(((finalPrice - totalCost) / totalCost) * 100),
  };
}

/**
 * Calculate final price for an order including FedEx shipping
 * @param {string} productId 
 * @param {Object} buyerAddress - Buyer's shipping address
 * @param {number} quantity
 * @returns {Object} Complete price breakdown with shipping options
 */
export async function calculateOrderPrice(productId, buyerAddress, quantity = 1) {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product) throw new Error('Product not found');

  // Find nearest distribution center
  const dcs = db.prepare('SELECT * FROM distribution_centers WHERE is_active = 1').all();
  if (dcs.length === 0) throw new Error('No distribution centers available');

  const dc = dcs[0]; // Use first active DC (could implement nearest DC logic)

  // Get FedEx rates from DC to buyer
  let shippingRates = [];
  try {
    shippingRates = await fedexService.getRates(
      {
        street: dc.address_street,
        city: dc.address_city,
        state: dc.address_state,
        zip: dc.address_zip,
        country: dc.address_country,
      },
      {
        street: buyerAddress.street,
        city: buyerAddress.city,
        state: buyerAddress.state,
        zip: buyerAddress.zip,
        country: buyerAddress.country || 'US',
      },
      {
        weight_kg: product.weight_kg * quantity,
        length_cm: product.length_cm,
        width_cm: product.width_cm,
        height_cm: product.height_cm,
      }
    );
  } catch (err) {
    // If FedEx API fails, use estimated rate
    shippingRates = [
      { serviceType: 'FEDEX_GROUND', serviceName: 'FedEx Ground', amount: 12.99, currency: 'USD', deliveryDays: 5 },
      { serviceType: 'FEDEX_EXPRESS_SAVER', serviceName: 'FedEx Express Saver', amount: 24.99, currency: 'USD', deliveryDays: 3 },
      { serviceType: 'FEDEX_2_DAY', serviceName: 'FedEx 2Day', amount: 34.99, currency: 'USD', deliveryDays: 2 },
      { serviceType: 'PRIORITY_OVERNIGHT', serviceName: 'FedEx Priority Overnight', amount: 59.99, currency: 'USD', deliveryDays: 1 },
    ];
  }

  const packagingCost = product.packaging_cost || getPricingConfig().packaging_cost;

  // Calculate final price for each shipping option
  const options = shippingRates.map(rate => {
    const priceBreakdown = calculateFinalPrice(
      product.base_price * quantity,
      packagingCost,
      rate.amount
    );

    return {
      shippingService: rate.serviceType,
      shippingName: rate.serviceName,
      deliveryDays: rate.deliveryDays,
      ...priceBreakdown,
    };
  });

  return {
    product: {
      id: product.id,
      title: product.title,
      basePrice: product.base_price,
      cryptoCurrency: product.crypto_currency,
      weight: product.weight_kg,
      dimensions: `${product.length_cm}x${product.width_cm}x${product.height_cm} cm`,
    },
    quantity,
    distributionCenter: {
      id: dc.id,
      name: dc.name,
      city: dc.address_city,
      state: dc.address_state,
    },
    shippingOptions: options,
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
