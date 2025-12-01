const Product = require('../models/Product');
const Config = require('../models/Config');

/**
 * Product Service - Handles product CRUD operations
 */
class ProductService {
  static async getAll(filters = {}) {
    try {
      const products = await Product.findAll(filters);
      return products.map(p => p.toJSON());
    } catch (error) {
      console.error('[ProductService] Error getting products:', error);
      throw error;
    }
  }

  static async getById(id) {
    try {
      const product = await Product.findById(id);
      return product ? product.toJSON() : null;
    } catch (error) {
      console.error('[ProductService] Error getting product:', error);
      throw error;
    }
  }

  static async create(data) {
    try {
      const product = await Product.create(data);
      return product.toJSON();
    } catch (error) {
      console.error('[ProductService] Error creating product:', error);
      throw error;
    }
  }

  static async update(id, data) {
    try {
      const product = await Product.update(id, data);
      return product.toJSON();
    } catch (error) {
      console.error('[ProductService] Error updating product:', error);
      throw error;
    }
  }

  static async delete(id) {
    try {
      await Product.delete(id);
      return true;
    } catch (error) {
      console.error('[ProductService] Error deleting product:', error);
      throw error;
    }
  }

  static async search(searchTerm) {
    try {
      const products = await Product.search(searchTerm);
      return products.map(p => p.toJSON());
    } catch (error) {
      console.error('[ProductService] Error searching products:', error);
      throw error;
    }
  }

  static async getRecommended(customerId, context, limit = 10) {
    try {
      // Simple recommendation logic - can be enhanced with ML
      const products = await Product.findAll({ limit, status: 'active' });
      return products.map(p => p.toJSON());
    } catch (error) {
      console.error('[ProductService] Error getting recommendations:', error);
      throw error;
    }
  }
}

module.exports = ProductService;

