const Parse = require('../config/parse');

/**
 * Product Model - Stores product information
 */
class Product extends Parse.Object {
  constructor() {
    super('Product');
  }

  static async create(data) {
    const product = new Product();
    Object.keys(data).forEach(key => {
      product.set(key, data[key]);
    });
    return await product.save(null, { useMasterKey: true });
  }

  static async findById(id) {
    const query = new Parse.Query(Product);
    return await query.get(id, { useMasterKey: true });
  }

  static async findAll(filters = {}) {
    const query = new Parse.Query(Product);
    
    if (filters.category) {
      query.equalTo('category', filters.category);
    }
    if (filters.status) {
      query.equalTo('status', filters.status);
    }
    if (filters.search) {
      query.contains('name', filters.search);
      query.contains('description', filters.search);
    }
    if (filters.tags && Array.isArray(filters.tags)) {
      query.containsAll('tags', filters.tags);
    }
    
    if (filters.limit) {
      query.limit(filters.limit);
    }
    if (filters.offset) {
      query.skip(filters.offset);
    }
    
    query.descending('createdAt');
    return await query.find({ useMasterKey: true });
  }

  static async update(id, data) {
    const product = await Product.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }
    Object.keys(data).forEach(key => {
      product.set(key, data[key]);
    });
    return await product.save(null, { useMasterKey: true });
  }

  static async delete(id) {
    const product = await Product.findById(id);
    if (!product) {
      throw new Error('Product not found');
    }
    return await product.destroy({ useMasterKey: true });
  }

  static async search(searchTerm) {
    const query = new Parse.Query(Product);
    query.contains('name', searchTerm);
    query.contains('description', searchTerm);
    query.descending('createdAt');
    return await query.find({ useMasterKey: true });
  }
}

Parse.Object.registerSubclass('Product', Product);

module.exports = Product;

