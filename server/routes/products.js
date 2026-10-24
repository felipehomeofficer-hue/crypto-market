import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import db from '../database.js';
import { authenticate, optionalAuth, requireSeller } from '../middleware/auth.js';
import { uploadProductImages, setUploadDir } from '../middleware/upload.js';
import { calculateFinalPrice, getPricingConfig } from '../services/pricing.js';
import config from '../config.js';

const router = Router();

/**
 * GET /api/products
 * List products with filtering, pagination, and search
 */
router.get('/', optionalAuth, (req, res) => {
  try {
    const {
      page = 1, limit = 20, category, condition, search,
      minPrice, maxPrice, currency, sortBy = 'created_at', sortOrder = 'DESC',
      sellerId
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let where = ['p.is_active = 1'];
    const params = [];

    if (category) { where.push('p.category = ?'); params.push(category); }
    if (condition) { where.push('p.condition = ?'); params.push(condition); }
    if (currency) { where.push('p.crypto_currency = ?'); params.push(currency); }
    if (sellerId) { where.push('p.seller_id = ?'); params.push(sellerId); }
    if (minPrice) { where.push('p.final_price >= ?'); params.push(parseFloat(minPrice)); }
    if (maxPrice) { where.push('p.final_price <= ?'); params.push(parseFloat(maxPrice)); }
    if (search) {
      where.push('(p.title LIKE ? OR p.description LIKE ? OR p.tags LIKE ?)');
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    const validSorts = ['created_at', 'final_price', 'rating', 'views', 'review_count'];
    const sort = validSorts.includes(sortBy) ? sortBy : 'created_at';
    const order = sortOrder === 'ASC' ? 'ASC' : 'DESC';

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const total = db.prepare(`SELECT COUNT(*) as count FROM products p ${whereClause}`).get(...params).count;

    const products = db.prepare(`
      SELECT p.*, u.username as seller_username, u.display_name as seller_display_name,
             u.avatar_url as seller_avatar, u.is_verified as seller_verified
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      ${whereClause}
      ORDER BY p.${sort} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    // Attach images to each product
    const result = products.map(p => {
      const images = db.prepare(
        'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order'
      ).all(p.id);

      return {
        ...formatProduct(p),
        images: images.map(img => ({
          id: img.id,
          url: `/uploads/products/${img.file_name}`,
          sortOrder: img.sort_order,
        })),
        seller: {
          id: p.seller_id,
          username: p.seller_username,
          displayName: p.seller_display_name,
          avatarUrl: p.seller_avatar,
          isVerified: !!p.seller_verified,
        },
      };
    });

    res.json({
      products: result,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Products list error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

/**
 * GET /api/products/:id
 * Get single product with full details
 */
router.get('/:id', optionalAuth, (req, res) => {
  try {
    const product = db.prepare(`
      SELECT p.*, u.username as seller_username, u.display_name as seller_display_name,
             u.avatar_url as seller_avatar, u.is_verified as seller_verified, u.rating as seller_rating,
             u.total_sales as seller_total_sales, u.bio as seller_bio
      FROM products p
      LEFT JOIN users u ON p.seller_id = u.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Increment view count
    db.prepare('UPDATE products SET views = views + 1 WHERE id = ?').run(product.id);

    // Log view event
    if (req.user) {
      db.prepare(`
        INSERT INTO analytics_events (event_type, user_id, product_id)
        VALUES ('product_view', ?, ?)
      `).run(req.user.id, product.id);
    }

    const images = db.prepare(
      'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order'
    ).all(product.id);

    const reviews = db.prepare(`
      SELECT r.*, u.username, u.display_name, u.avatar_url
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.product_id = ?
      ORDER BY r.created_at DESC
      LIMIT 20
    `).all(product.id);

    res.json({
      product: {
        ...formatProduct(product),
        images: images.map(img => ({
          id: img.id,
          url: `/uploads/products/${img.file_name}`,
          sortOrder: img.sort_order,
        })),
        seller: {
          id: product.seller_id,
          username: product.seller_username,
          displayName: product.seller_display_name,
          avatarUrl: product.seller_avatar,
          isVerified: !!product.seller_verified,
          rating: product.seller_rating,
          totalSales: product.seller_total_sales,
          bio: product.seller_bio,
        },
        reviews: reviews.map(r => ({
          id: r.id,
          userId: r.user_id,
          username: r.username,
          displayName: r.display_name,
          avatarUrl: r.avatar_url,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.created_at,
        })),
      },
    });
  } catch (error) {
    console.error('Product detail error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

/**
 * POST /api/products
 * Create a new product with image upload
 */
router.post('/', authenticate, setUploadDir('products'), (req, res) => {
  uploadProductImages(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    try {
      const {
        title, description, basePrice, cryptoCurrency, category, condition,
        stock, tags, shippingInfo, weightKg, lengthCm, widthCm, heightCm, packagingCost
      } = req.body;

      // Validate required fields
      if (!title || !basePrice || !cryptoCurrency) {
        return res.status(400).json({ error: 'Title, base price, and cryptocurrency are required' });
      }
      if (!weightKg || !lengthCm || !widthCm || !heightCm) {
        return res.status(400).json({ error: 'Weight and dimensions are required for shipping calculation' });
      }

      const productId = uuidv4();

      // Calculate final price with markup
      const pricingConfig = getPricingConfig();
      const priceBreakdown = calculateFinalPrice(
        parseFloat(basePrice),
        parseFloat(packagingCost || pricingConfig.packaging_cost),
        0 // Shipping calculated at checkout
      );

      // Insert product
      db.prepare(`
        INSERT INTO products (id, title, description, base_price, final_price, crypto_currency,
          category, condition, seller_id, stock, tags, shipping_info,
          weight_kg, length_cm, width_cm, height_cm, packaging_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        productId, title, description || '',
        parseFloat(basePrice), priceBreakdown.finalPrice,
        cryptoCurrency, category || '', condition || 'New',
        req.user.id, parseInt(stock || 1),
        JSON.stringify(tags ? (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : []),
        shippingInfo || '',
        parseFloat(weightKg), parseFloat(lengthCm), parseFloat(widthCm), parseFloat(heightCm),
        parseFloat(packagingCost || pricingConfig.packaging_cost)
      );

      // Process uploaded images
      if (req.files && req.files.length > 0) {
        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const imageId = uuidv4();

          // Optimize image with Sharp
          const optimizedName = `opt_${file.filename}`;
          const optimizedPath = path.join(config.UPLOAD_DIR, 'products', optimizedName);

          await sharp(file.path)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toFile(optimizedPath);

          // Create thumbnail
          const thumbName = `thumb_${file.filename}`;
          const thumbPath = path.join(config.UPLOAD_DIR, 'products', thumbName);

          await sharp(file.path)
            .resize(300, 300, { fit: 'cover' })
            .jpeg({ quality: 75 })
            .toFile(thumbPath);

          // Save image record
          db.prepare(`
            INSERT INTO product_images (id, product_id, file_path, file_name, mime_type, size_bytes, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(imageId, productId, optimizedPath, optimizedName, 'image/jpeg', file.size, i);

          // Remove original upload (keep optimized)
          fs.unlinkSync(file.path);
        }
      }

      // Log analytics
      db.prepare(`
        INSERT INTO analytics_events (event_type, user_id, product_id, data)
        VALUES ('product_created', ?, ?, ?)
      `).run(req.user.id, productId, JSON.stringify({ title, basePrice, cryptoCurrency }));

      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
      const images = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order').all(productId);

      res.status(201).json({
        product: {
          ...formatProduct(product),
          images: images.map(img => ({
            id: img.id,
            url: `/uploads/products/${img.file_name}`,
            sortOrder: img.sort_order,
          })),
          priceBreakdown,
        },
      });
    } catch (error) {
      console.error('Product creation error:', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  });
});

/**
 * PUT /api/products/:id
 * Update product (owner or admin only)
 */
router.put('/:id', authenticate, setUploadDir('products'), (req, res) => {
  uploadProductImages(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });

    try {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      if (product.seller_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Not authorized' });
      }

      const { title, description, basePrice, category, condition, stock, tags,
        shippingInfo, weightKg, lengthCm, widthCm, heightCm, packagingCost } = req.body;

      // Recalculate final price if base price changed
      let finalPrice = product.final_price;
      if (basePrice) {
        const pricingConfig = getPricingConfig();
        const priceBreakdown = calculateFinalPrice(
          parseFloat(basePrice),
          parseFloat(packagingCost || product.packaging_cost),
          0
        );
        finalPrice = priceBreakdown.finalPrice;
      }

      db.prepare(`
        UPDATE products 
        SET title = COALESCE(?, title),
            description = COALESCE(?, description),
            base_price = COALESCE(?, base_price),
            final_price = ?,
            category = COALESCE(?, category),
            condition = COALESCE(?, condition),
            stock = COALESCE(?, stock),
            tags = COALESCE(?, tags),
            shipping_info = COALESCE(?, shipping_info),
            weight_kg = COALESCE(?, weight_kg),
            length_cm = COALESCE(?, length_cm),
            width_cm = COALESCE(?, width_cm),
            height_cm = COALESCE(?, height_cm),
            packaging_cost = COALESCE(?, packaging_cost),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        title, description, basePrice ? parseFloat(basePrice) : null,
        finalPrice, category, condition,
        stock ? parseInt(stock) : null,
        tags ? JSON.stringify(typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags) : null,
        shippingInfo,
        weightKg ? parseFloat(weightKg) : null,
        lengthCm ? parseFloat(lengthCm) : null,
        widthCm ? parseFloat(widthCm) : null,
        heightCm ? parseFloat(heightCm) : null,
        packagingCost ? parseFloat(packagingCost) : null,
        req.params.id
      );

      // Handle new images
      if (req.files && req.files.length > 0) {
        const maxSort = db.prepare(
          'SELECT MAX(sort_order) as maxSort FROM product_images WHERE product_id = ?'
        ).get(req.params.id)?.maxSort || 0;

        for (let i = 0; i < req.files.length; i++) {
          const file = req.files[i];
          const imageId = uuidv4();
          const optimizedName = `opt_${file.filename}`;
          const optimizedPath = path.join(config.UPLOAD_DIR, 'products', optimizedName);

          await sharp(file.path)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 85 })
            .toFile(optimizedPath);

          db.prepare(`
            INSERT INTO product_images (id, product_id, file_path, file_name, mime_type, size_bytes, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(imageId, req.params.id, optimizedPath, optimizedName, 'image/jpeg', file.size, maxSort + i + 1);

          fs.unlinkSync(file.path);
        }
      }

      const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
      const images = db.prepare('SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order').all(req.params.id);

      res.json({
        product: {
          ...formatProduct(updated),
          images: images.map(img => ({
            id: img.id,
            url: `/uploads/products/${img.file_name}`,
            sortOrder: img.sort_order,
          })),
        },
      });
    } catch (error) {
      console.error('Product update error:', error);
      res.status(500).json({ error: 'Failed to update product' });
    }
  });
});

/**
 * DELETE /api/products/:id
 * Soft-delete product
 */
router.delete('/:id', authenticate, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.seller_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.id);
  res.json({ message: 'Product deleted' });
});

/**
 * DELETE /api/products/:id/images/:imageId
 * Delete a product image
 */
router.delete('/:id/images/:imageId', authenticate, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.seller_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const image = db.prepare('SELECT * FROM product_images WHERE id = ? AND product_id = ?').get(req.params.imageId, req.params.id);
  if (!image) return res.status(404).json({ error: 'Image not found' });

  // Delete file
  if (fs.existsSync(image.file_path)) fs.unlinkSync(image.file_path);

  // Delete thumbnail
  const thumbPath = image.file_path.replace('opt_', 'thumb_');
  if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);

  db.prepare('DELETE FROM product_images WHERE id = ?').run(req.params.imageId);
  res.json({ message: 'Image deleted' });
});

/**
 * POST /api/products/:id/reviews
 * Add a review (must have purchased)
 */
router.post('/:id/reviews', authenticate, (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Check if user bought this product
    const order = db.prepare(`
      SELECT id FROM orders WHERE product_id = ? AND buyer_id = ? AND status IN ('delivered', 'completed')
    `).get(req.params.id, req.user.id);

    if (!order && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You must purchase this product before reviewing' });
    }

    // Check for existing review
    const existing = db.prepare('SELECT id FROM reviews WHERE product_id = ? AND user_id = ?').get(req.params.id, req.user.id);
    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this product' });
    }

    const reviewId = uuidv4();
    db.prepare(`
      INSERT INTO reviews (id, product_id, user_id, order_id, rating, comment)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(reviewId, req.params.id, req.user.id, order?.id, parseInt(rating), comment || '');

    // Update product rating
    const stats = db.prepare(`
      SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE product_id = ?
    `).get(req.params.id);

    db.prepare(`
      UPDATE products SET rating = ?, review_count = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).run(Math.round(stats.avg_rating * 10) / 10, stats.count, req.params.id);

    // Update seller rating
    const product = db.prepare('SELECT seller_id FROM products WHERE id = ?').get(req.params.id);
    const sellerStats = db.prepare(`
      SELECT AVG(r.rating) as avg_rating, COUNT(*) as count
      FROM reviews r
      JOIN products p ON r.product_id = p.id
      WHERE p.seller_id = ?
    `).get(product.seller_id);

    db.prepare(`
      UPDATE users SET rating = ?, total_reviews = ? WHERE id = ?
    `).run(
      Math.round(sellerStats.avg_rating * 10) / 10,
      sellerStats.count,
      product.seller_id
    );

    res.status(201).json({ reviewId });
  } catch (error) {
    console.error('Review creation error:', error);
    res.status(500).json({ error: 'Failed to create review' });
  }
});

function formatProduct(p) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    basePrice: p.base_price,
    finalPrice: p.final_price,
    cryptoCurrency: p.crypto_currency,
    category: p.category,
    condition: p.condition,
    sellerId: p.seller_id,
    stock: p.stock,
    tags: typeof p.tags === 'string' ? JSON.parse(p.tags) : p.tags,
    shippingInfo: p.shipping_info,
    rating: p.rating,
    reviewCount: p.review_count,
    views: p.views,
    weightKg: p.weight_kg,
    lengthCm: p.length_cm,
    widthCm: p.width_cm,
    heightCm: p.height_cm,
    packagingCost: p.packaging_cost,
    isActive: !!p.is_active,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
  };
}

export default router;
