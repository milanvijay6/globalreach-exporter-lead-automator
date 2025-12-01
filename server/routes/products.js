const express = require('express');
const router = express.Router();
const ProductService = require('../services/productService');
const { authenticate } = require('../middleware/auth');

// Apply authentication to all routes
router.use(authenticate);

// GET /api/products - List products with optional filters
router.get('/', async (req, res) => {
  try {
    const { category, search, tags, status, limit = 50, offset = 0 } = req.query;
    
    const filters = {
      category,
      search,
      tags: tags ? tags.split(',') : undefined,
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };
    
    const products = await ProductService.getAll(filters);
    res.json({ 
      success: true, 
      data: products, 
      total: products.length, 
      limit: parseInt(limit), 
      offset: parseInt(offset) 
    });
  } catch (error) {
    console.error('[API] Error in GET /api/products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await ProductService.getById(id);
    
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('[API] Error in GET /api/products/:id:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/products/recommended - Get product recommendations
router.get('/recommended', async (req, res) => {
  try {
    const { customerId, context, limit = 10 } = req.query;
    const products = await ProductService.getRecommended(customerId, context, parseInt(limit));
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('[API] Error in GET /api/products/recommended:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/products/search - Search products
router.get('/search', async (req, res) => {
  try {
    const { q, category, tags } = req.query;
    
    if (!q) {
      return res.status(400).json({ success: false, error: 'Search query is required' });
    }
    
    const products = await ProductService.search(q);
    res.json({ success: true, data: products });
  } catch (error) {
    console.error('[API] Error in GET /api/products/search:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

