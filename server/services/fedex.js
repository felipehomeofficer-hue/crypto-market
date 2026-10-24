import axios from 'axios';
import config from '../config.js';
import db from '../database.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * FedEx REST API Integration
 * Docs: https://developer.fedex.com/api/en-us/catalog.html
 * 
 * Flow:
 * 1. Seller ships product TO distribution center (seller label)
 * 2. Admin receives at DC, generates label TO buyer
 * 3. Product ships from DC to buyer
 */

let fedexToken = null;
let tokenExpiresAt = 0;

/**
 * Get FedEx OAuth token
 */
async function getAuthToken() {
  if (fedexToken && Date.now() < tokenExpiresAt) {
    return fedexToken;
  }

  try {
    const response = await axios.post(
      `${config.FEDEX_API_URL}/oauth/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.FEDEX_CLIENT_ID,
        client_secret: config.FEDEX_CLIENT_SECRET,
      }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 15000,
      }
    );

    fedexToken = response.data.access_token;
    tokenExpiresAt = Date.now() + (response.data.expires_in - 60) * 1000;
    return fedexToken;
  } catch (error) {
    console.error('FedEx auth failed:', error.response?.data || error.message);
    throw new Error('FedEx authentication failed');
  }
}

/**
 * Create FedEx API client with authentication
 */
async function getFedExClient() {
  const token = await getAuthToken();
  return axios.create({
    baseURL: config.FEDEX_API_URL,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-locale': 'en_US',
    },
    timeout: 30000,
  });
}

/**
 * Get shipping rates from FedEx
 * @param {Object} origin - Origin address
 * @param {Object} destination - Destination address
 * @param {Object} packageDetails - Package dimensions and weight
 * @returns {Array} Available rates
 */
export async function getRates(origin, destination, packageDetails) {
  try {
    const client = await getFedExClient();

    const response = await client.post('/rate/v1/rates/quotes', {
      accountNumber: { value: config.FEDEX_ACCOUNT_NUMBER },
      requestedShipment: {
        shipper: {
          address: {
            streetLines: [origin.street],
            city: origin.city,
            stateOrProvinceCode: origin.state,
            postalCode: origin.zip,
            countryCode: origin.country || 'US',
          },
        },
        recipient: {
          address: {
            streetLines: [destination.street],
            city: destination.city,
            stateOrProvinceCode: destination.state,
            postalCode: destination.zip,
            countryCode: destination.country || 'US',
          },
        },
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        rateRequestType: ['ACCOUNT', 'LIST'],
        requestedPackageLineItems: [
          {
            weight: {
              units: 'KG',
              value: packageDetails.weight_kg,
            },
            dimensions: {
              length: Math.ceil(packageDetails.length_cm),
              width: Math.ceil(packageDetails.width_cm),
              height: Math.ceil(packageDetails.height_cm),
              units: 'CM',
            },
          },
        ],
      },
    });

    const rateDetails = response.data.output?.rateReplyDetails || [];
    return rateDetails.map(rate => ({
      serviceType: rate.serviceType,
      serviceName: rate.serviceName,
      amount: parseFloat(rate.ratedShipmentDetails?.[0]?.totalNetCharge || 0),
      currency: rate.ratedShipmentDetails?.[0]?.currency || 'USD',
      deliveryDays: rate.commit?.dateDetail?.dayCount,
      deliveryDate: rate.commit?.dateDetail?.dayFormat,
      transitTime: rate.commit?.transitDays?.description,
    }));
  } catch (error) {
    console.error('FedEx rate quote failed:', error.response?.data || error.message);
    throw new Error(`FedEx rate quote failed: ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
}

/**
 * Create a FedEx shipment and get shipping label
 * @param {Object} shipper - Shipper details (name, address, phone)
 * @param {Object} recipient - Recipient details
 * @param {Object} packageDetails - Package dimensions and weight
 * @param {string} serviceType - FedEx service type
 * @returns {Object} Shipment with tracking number and label
 */
export async function createShipment(shipper, recipient, packageDetails, serviceType = 'FEDEX_GROUND') {
  try {
    const client = await getFedExClient();

    const response = await client.post('/ship/v1/shipments', {
      accountNumber: { value: config.FEDEX_ACCOUNT_NUMBER },
      labelResponseOptions: 'LABEL',
      requestedShipment: {
        shipper: {
          contact: {
            personName: shipper.name,
            phoneNumber: shipper.phone || '0000000000',
          },
          address: {
            streetLines: [shipper.street],
            city: shipper.city,
            stateOrProvinceCode: shipper.state,
            postalCode: shipper.zip,
            countryCode: shipper.country || 'US',
          },
        },
        recipients: [
          {
            contact: {
              personName: recipient.name,
              phoneNumber: recipient.phone || '0000000000',
            },
            address: {
              streetLines: [recipient.street],
              city: recipient.city,
              stateOrProvinceCode: recipient.state,
              postalCode: recipient.zip,
              countryCode: recipient.country || 'US',
            },
          },
        ],
        pickupType: 'DROPOFF_AT_FEDEX_LOCATION',
        serviceType,
        packagingType: 'YOUR_PACKAGING',
        shippingChargesPayment: {
          paymentType: 'SENDER',
          payor: {
            responsibleParty: {
              accountNumber: { value: config.FEDEX_ACCOUNT_NUMBER },
            },
          },
        },
        labelSpecification: {
          labelFormatType: 'COMMON2D',
          imageType: 'PDF',
          labelStockType: 'PAPER_85X11_TOP_HALF_LABEL',
        },
        requestedPackageLineItems: [
          {
            weight: {
              units: 'KG',
              value: packageDetails.weight_kg,
            },
            dimensions: {
              length: Math.ceil(packageDetails.length_cm),
              width: Math.ceil(packageDetails.width_cm),
              height: Math.ceil(packageDetails.height_cm),
              units: 'CM',
            },
          },
        ],
      },
    });

    const shipment = response.data.output?.transactionShipments?.[0];
    const pieceResponses = shipment?.pieceResponses?.[0];

    return {
      masterTrackingNumber: shipment?.masterTrackingNumber,
      trackingNumber: pieceResponses?.trackingNumber,
      labelBase64: pieceResponses?.packageDocuments?.[0]?.encodedLabel,
      labelUrl: pieceResponses?.packageDocuments?.[0]?.url,
      serviceType: shipment?.serviceType,
      shipDatestamp: shipment?.shipDatestamp,
    };
  } catch (error) {
    console.error('FedEx shipment creation failed:', error.response?.data || error.message);
    throw new Error(`FedEx shipment creation failed: ${error.response?.data?.errors?.[0]?.message || error.message}`);
  }
}

/**
 * Track a FedEx shipment
 */
export async function trackShipment(trackingNumber) {
  try {
    const client = await getFedExClient();

    const response = await client.post('/track/v1/trackingnumbers', {
      includeDetailedScans: true,
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber,
          },
        },
      ],
    });

    const trackResult = response.data.output?.completeTrackResults?.[0]?.trackResults?.[0];

    return {
      trackingNumber,
      status: trackResult?.latestStatusDetail?.statusByLocale,
      statusCode: trackResult?.latestStatusDetail?.code,
      description: trackResult?.latestStatusDetail?.description,
      estimatedDelivery: trackResult?.estimatedDeliveryTimeWindow?.window?.ends,
      events: (trackResult?.scanEvents || []).map(event => ({
        date: event.date,
        description: event.eventDescription,
        city: event.scanLocation?.city,
        state: event.scanLocation?.stateOrProvinceCode,
        country: event.scanLocation?.countryCode,
      })),
    };
  } catch (error) {
    console.error('FedEx tracking failed:', error.response?.data || error.message);
    throw new Error(`FedEx tracking failed: ${error.message}`);
  }
}

/**
 * Generate seller-to-DC shipping label
 * Called by admin after order is paid
 */
export async function generateSellerToDCLabel(orderId, distributionCenterId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Order not found');

  const seller = db.prepare('SELECT * FROM users WHERE id = ?').get(order.seller_id);
  if (!seller) throw new Error('Seller not found');

  const dc = db.prepare('SELECT * FROM distribution_centers WHERE id = ?').get(distributionCenterId);
  if (!dc) throw new Error('Distribution center not found');

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(order.product_id);
  if (!product) throw new Error('Product not found');

  // Create FedEx shipment: Seller → DC
  const shipment = await createShipment(
    {
      name: seller.display_name || seller.username,
      street: seller.address_street,
      city: seller.address_city,
      state: seller.address_state,
      zip: seller.address_zip,
      country: seller.address_country,
      phone: seller.address_phone,
    },
    {
      name: dc.name,
      street: dc.address_street,
      city: dc.address_city,
      state: dc.address_state,
      zip: dc.address_zip,
      country: dc.address_country,
      phone: dc.phone,
    },
    {
      weight_kg: product.weight_kg,
      length_cm: product.length_cm,
      width_cm: product.width_cm,
      height_cm: product.height_cm,
    }
  );

  // Save shipment to database
  const shipmentId = uuidv4();
  db.prepare(`
    INSERT INTO shipments (id, order_id, type, fedex_tracking_number, fedex_label_base64,
      origin_address, destination_address, weight_kg, dimensions, service_type, status)
    VALUES (?, ?, 'seller_to_dc', ?, ?, ?, ?, ?, ?, ?, 'created')
  `).run(
    shipmentId, orderId,
    shipment.trackingNumber,
    shipment.labelBase64,
    JSON.stringify({ name: seller.display_name, ...seller }),
    JSON.stringify({ name: dc.name, ...dc }),
    product.weight_kg,
    JSON.stringify({ l: product.length_cm, w: product.width_cm, h: product.height_cm }),
    'FEDEX_GROUND'
  );

  // Update order
  db.prepare(`
    UPDATE orders 
    SET status = 'label_generated',
        distribution_center_id = ?,
        seller_tracking_number = ?,
        seller_shipping_label_url = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(distributionCenterId, shipment.trackingNumber, shipment.labelUrl || '', orderId);

  // Notify seller with shipping label
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, data)
    VALUES (?, ?, 'shipping_label', 'Shipping Label Ready!', ?, ?)
  `).run(
    uuidv4(), order.seller_id,
    `Your shipping label for order #${orderId.slice(0, 8)} is ready. Please ship to: ${dc.name}, ${dc.address_city}, ${dc.address_state}`,
    JSON.stringify({
      orderId,
      trackingNumber: shipment.trackingNumber,
      labelBase64: shipment.labelBase64,
      dcName: dc.name,
      dcAddress: `${dc.address_street}, ${dc.address_city}, ${dc.address_state} ${dc.address_zip}`,
    })
  );

  return {
    shipmentId,
    trackingNumber: shipment.trackingNumber,
    labelBase64: shipment.labelBase64,
    dcName: dc.name,
  };
}

/**
 * Generate DC-to-buyer shipping label
 * Called by admin after product received at DC
 */
export async function generateDCToBuyerLabel(orderId) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order) throw new Error('Order not found');

  const dc = db.prepare('SELECT * FROM distribution_centers WHERE id = ?').get(order.distribution_center_id);
  if (!dc) throw new Error('Distribution center not found');

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(order.product_id);
  if (!product) throw new Error('Product not found');

  // Create FedEx shipment: DC → Buyer
  const shipment = await createShipment(
    {
      name: dc.name,
      street: dc.address_street,
      city: dc.address_city,
      state: dc.address_state,
      zip: dc.address_zip,
      country: dc.address_country,
      phone: dc.phone,
    },
    {
      name: 'Customer',
      street: order.shipping_address_street,
      city: order.shipping_address_city,
      state: order.shipping_address_state,
      zip: order.shipping_address_zip,
      country: order.shipping_address_country,
      phone: order.shipping_address_phone,
    },
    {
      weight_kg: product.weight_kg,
      length_cm: product.length_cm,
      width_cm: product.width_cm,
      height_cm: product.height_cm,
    }
  );

  // Save shipment
  const shipmentId = uuidv4();
  db.prepare(`
    INSERT INTO shipments (id, order_id, type, fedex_tracking_number, fedex_label_base64,
      origin_address, destination_address, weight_kg, dimensions, service_type, status)
    VALUES (?, ?, 'dc_to_buyer', ?, ?, ?, ?, ?, ?, ?, 'created')
  `).run(
    shipmentId, orderId,
    shipment.trackingNumber,
    shipment.labelBase64,
    JSON.stringify(dc),
    JSON.stringify({
      street: order.shipping_address_street,
      city: order.shipping_address_city,
      state: order.shipping_address_state,
      zip: order.shipping_address_zip,
    }),
    product.weight_kg,
    JSON.stringify({ l: product.length_cm, w: product.width_cm, h: product.height_cm }),
    'FEDEX_GROUND'
  );

  // Update order
  db.prepare(`
    UPDATE orders 
    SET status = 'shipped_to_buyer',
        buyer_tracking_number = ?,
        buyer_shipping_label_url = ?,
        shipped_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(shipment.trackingNumber, shipment.labelUrl || '', orderId);

  // Notify buyer
  db.prepare(`
    INSERT INTO notifications (id, user_id, type, title, message, data)
    VALUES (?, ?, 'order_shipped', 'Your Order Has Shipped!', ?, ?)
  `).run(
    uuidv4(), order.buyer_id,
    `Your order #${orderId.slice(0, 8)} is on its way! Track: ${shipment.trackingNumber}`,
    JSON.stringify({ orderId, trackingNumber: shipment.trackingNumber })
  );

  return {
    shipmentId,
    trackingNumber: shipment.trackingNumber,
    labelBase64: shipment.labelBase64,
  };
}
