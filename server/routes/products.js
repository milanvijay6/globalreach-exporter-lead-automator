const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Parse = require('parse/node');
const { requireAuth } = require('../middleware/auth');
const { cacheMiddleware, invalidateCache, invalidateByTag } = require('../middleware/cache');
const { applyCursor, getNextCursor, formatPaginatedResponse } = require('../utils/pagination');
const { findWithCache } = require('../utils/parseQueryCache');
const { productCatalogCache } = require('../services/productCatalogCache');

// GET /api/products - List products (cached for 5 minutes, cursor-based pagination)
// Uses L3 (Redis), L4 (Parse cache), and in-memory product catalog cache
router.get('/', cacheMiddleware(300, ['products']), async (req, res) => {
  try {
    const { category, search, tags, status, limit = 50, cursor } = req.query;
    const userId = req.userId || null;
    const sortField = 'createdAt';
    const sortOrder = 'desc';
    
    // Check in-memory product catalog cache first (L3)
    const cachedProducts = productCatalogCache.get(userId);
    if (cachedProducts && !search && !category && !tags && !status) {
      // Return cached products if no filters applied
      return res.json(formatPaginatedResponse(cachedProducts, null, limit));
    }
    
    const query = new Parse.Query(Product);
    
    if (category) {
      query.equalTo('category', category);
    }
    
    if (status) {
      query.equalTo('status', status);
    }
    
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      query.containsAll('tags', tagArray);
    }
    
    if (search) {
      query.matches('name', search, 'i');
    }
    
    // Apply cursor-based pagination
    applyCursor(query, cursor, sortField, sortOrder);
    query.limit(parseInt(limit) + 1); // Fetch one extra to check if there's more
    
    // Use Parse query cache (L4) - cacheElseNetwork policy
    const products = await findWithCache(query, {
      useMasterKey: true,
      cachePolicy: 'cacheElseNetwork',
      maxCacheAge: 300, // 5 minutes
    });
    
    // Check if there's a next page
    const hasMore = products.length > parseInt(limit);
    const results = hasMore ? products.slice(0, parseInt(limit)) : products;
    
    // Get next cursor
    const nextCursor = hasMore ? getNextCursor(results, sortField, sortOrder) : null;
    
    // Apply field projection if requested
    const { projectFields } = require('../utils/fieldProjection');
    const fields = req.query.fields;
    
    const formattedResults = results.map(p => {
      const base = {
        id: p.id,
        name: p.get('name'),
        description: p.get('description'),
        price: p.get('price'),
        category: p.get('category'),
        tags: p.get('tags') || [],
        photos: p.get('photos') || [],
        status: p.get('status'),
        createdAt: p.get('createdAt'),
        updatedAt: p.get('updatedAt')
      };
      
      return projectFields(base, fields);
    });
    
    // Cache in-memory product catalog if no filters (for quick access)
    if (!search && !category && !tags && !status && !cursor) {
      productCatalogCache.set(formattedResults, userId);
    }
    
    res.json(formatPaginatedResponse(formattedResults, nextCursor, limit));
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/products/:id - Get single product (cached for 5 minutes)
router.get('/:id', cacheMiddleware(300), async (req, res) => {
  try {
    const { id } = req.params;
    const query = new Parse.Query(Product);
    const product = await query.get(id, { useMasterKey: true });
    
    res.json({
      success: true,
      data: {
        id: product.id,
        name: product.get('name'),
        description: product.get('description'),
        price: product.get('price'),
        category: product.get('category'),
        tags: product.get('tags') || [],
        photos: product.get('photos') || [],
        status: product.get('status'),
        createdAt: product.get('createdAt'),
        updatedAt: product.get('updatedAt')
      }
    });
  } catch (error) {
    if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
      res.status(404).json({ success: false, error: 'Product not found' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// POST /api/products - Create product
router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, description, price, category, tags, photos, status } = req.body;
    
    const product = new Product();
    product.set('name', name);
    product.set('description', description);
    product.set('price', price);
    product.set('category', category);
    product.set('tags', tags || []);
    product.set('photos', photos || []);
    product.set('status', status || 'active');
    
    await product.save(null, { useMasterKey: true });
    
    // Invalidate product cache
    await invalidateCache(`cache:/api/products:*`);
    
    res.json({
      success: true,
      data: {
        id: product.id,
        name: product.get('name'),
        description: product.get('description'),
        price: product.get('price'),
        category: product.get('category'),
        tags: product.get('tags'),
        photos: product.get('photos'),
        status: product.get('status')
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/products/:id - Update product
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const query = new Parse.Query(Product);
    const product = await query.get(id, { useMasterKey: true });
    
    const { name, description, price, category, tags, photos, status } = req.body;
    
    if (name !== undefined) product.set('name', name);
    if (description !== undefined) product.set('description', description);
    if (price !== undefined) product.set('price', price);
    if (category !== undefined) product.set('category', category);
    if (tags !== undefined) product.set('tags', tags);
    if (photos !== undefined) product.set('photos', photos);
    if (status !== undefined) product.set('status', status);
    
    await product.save(null, { useMasterKey: true });
    
    // Invalidate caches on mutation
    await invalidateByTag(['products']); // Invalidate by cache tag
    productCatalogCache.invalidate(req.userId); // Invalidate in-memory cache
    
    res.json({
      success: true,
      data: {
        id: product.id,
        name: product.get('name'),
        description: product.get('description'),
        price: product.get('price'),
        category: product.get('category'),
        tags: product.get('tags'),
        photos: product.get('photos'),
        status: product.get('status')
      }
    });
  } catch (error) {
    if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
      res.status(404).json({ success: false, error: 'Product not found' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// DELETE /api/products/:id - Delete product
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const query = new Parse.Query(Product);
    const product = await query.get(id, { useMasterKey: true });
    
    await product.destroy({ useMasterKey: true });
    
    // Invalidate caches on mutation
    await invalidateByTag(['products']); // Invalidate by cache tag
    productCatalogCache.invalidate(req.userId); // Invalidate in-memory cache
    
    res.json({ success: true });
  } catch (error) {
    if (error.code === Parse.Error.OBJECT_NOT_FOUND) {
      res.status(404).json({ success: false, error: 'Product not found' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// GET /api/products/search - Search products
router.get('/search', async (req, res) => {
  try {
    const { q, category, tags } = req.query;
    
    const query = new Parse.Query(Product);
    
    if (q) {
      query.matches('name', q, 'i');
    }
    
    if (category) {
      query.equalTo('category', category);
    }
    
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      query.containsAll('tags', tagArray);
    }
    
    const products = await query.find({ useMasterKey: true });
    const results = products.map(p => ({
      id: p.id,
      name: p.get('name'),
      description: p.get('description'),
      price: p.get('price'),
      category: p.get('category'),
      tags: p.get('tags') || [],
      photos: p.get('photos') || []
    }));
    
    res.json({ success: true, data: results });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;















