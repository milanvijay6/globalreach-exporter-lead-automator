const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const Parse = require('parse/node');

// GET /api/products - List products
router.get('/', async (req, res) => {
  try {
    const { category, search, tags, status, limit = 50, offset = 0 } = req.query;
    
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
    
    query.limit(parseInt(limit));
    query.skip(parseInt(offset));
    query.descending('createdAt');
    
    const products = await query.find({ useMasterKey: true });
    const results = products.map(p => ({
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
    }));
    
    res.json({ success: true, data: results, total: results.length, limit: parseInt(limit), offset: parseInt(offset) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/products/:id - Get single product
router.get('/:id', async (req, res) => {
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
router.post('/', async (req, res) => {
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
router.put('/:id', async (req, res) => {
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
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = new Parse.Query(Product);
    const product = await query.get(id, { useMasterKey: true });
    
    await product.destroy({ useMasterKey: true });
    
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










