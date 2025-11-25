import { PlatformService } from './platformService';
import { Product } from '../types';
import { Logger } from './loggerService';

/**
 * Product Catalog Service
 * Handles product CRUD, search, and bulk import/export
 */
export const ProductCatalogService = {
  /**
   * Gets all products from storage
   */
  getProducts: async (): Promise<Product[]> => {
    try {
      const data = await PlatformService.getAppConfig('products_catalog', null);
      if (!data) return [];
      const products = typeof data === 'string' ? JSON.parse(data) : data;
      return Array.isArray(products) ? products : [];
    } catch (error) {
      Logger.error('[ProductCatalogService] Failed to load products:', error);
      return [];
    }
  },

  /**
   * Gets a product by ID
   */
  getProductById: async (id: string): Promise<Product | null> => {
    try {
      const products = await ProductCatalogService.getProducts();
      return products.find(p => p.id === id) || null;
    } catch (error) {
      Logger.error('[ProductCatalogService] Failed to get product:', error);
      return null;
    }
  },

  /**
   * Adds a new product
   */
  addProduct: async (product: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> => {
    try {
      const products = await ProductCatalogService.getProducts();
      const now = Date.now();
      const newProduct: Product = {
        ...product,
        id: `product_${now}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: now,
        updatedAt: now,
      };
      products.push(newProduct);
      await PlatformService.setAppConfig('products_catalog', JSON.stringify(products));
      Logger.info('[ProductCatalogService] Product added:', newProduct.id);
      return newProduct;
    } catch (error) {
      Logger.error('[ProductCatalogService] Failed to add product:', error);
      throw error;
    }
  },

  /**
   * Updates an existing product
   */
  updateProduct: async (id: string, updates: Partial<Product>): Promise<Product> => {
    try {
      const products = await ProductCatalogService.getProducts();
      const index = products.findIndex(p => p.id === id);
      if (index === -1) {
        throw new Error(`Product with id ${id} not found`);
      }
      const updated: Product = {
        ...products[index],
        ...updates,
        id, // Ensure ID doesn't change
        updatedAt: Date.now(),
      };
      products[index] = updated;
      await PlatformService.setAppConfig('products_catalog', JSON.stringify(products));
      Logger.info('[ProductCatalogService] Product updated:', id);
      return updated;
    } catch (error) {
      Logger.error('[ProductCatalogService] Failed to update product:', error);
      throw error;
    }
  },

  /**
   * Deletes a product
   */
  deleteProduct: async (id: string): Promise<void> => {
    try {
      const products = await ProductCatalogService.getProducts();
      const filtered = products.filter(p => p.id !== id);
      if (filtered.length === products.length) {
        throw new Error(`Product with id ${id} not found`);
      }
      await PlatformService.setAppConfig('products_catalog', JSON.stringify(filtered));
      Logger.info('[ProductCatalogService] Product deleted:', id);
    } catch (error) {
      Logger.error('[ProductCatalogService] Failed to delete product:', error);
      throw error;
    }
  },

  /**
   * Searches products by name, category, tags, or description
   */
  searchProducts: async (query: string): Promise<Product[]> => {
    try {
      const products = await ProductCatalogService.getProducts();
      if (!query || query.trim().length === 0) return products;
      
      const searchTerm = query.toLowerCase().trim();
      return products.filter(product => {
        const nameMatch = product.name.toLowerCase().includes(searchTerm);
        const categoryMatch = product.category.toLowerCase().includes(searchTerm);
        const descMatch = product.shortDescription.toLowerCase().includes(searchTerm) ||
          (product.fullDescription && product.fullDescription.toLowerCase().includes(searchTerm));
        const tagMatch = product.tags.some(tag => tag.toLowerCase().includes(searchTerm));
        return nameMatch || categoryMatch || descMatch || tagMatch;
      });
    } catch (error) {
      Logger.error('[ProductCatalogService] Failed to search products:', error);
      return [];
    }
  },

  /**
   * Gets products by category
   */
  getProductsByCategory: async (category: string): Promise<Product[]> => {
    try {
      const products = await ProductCatalogService.getProducts();
      return products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    } catch (error) {
      Logger.error('[ProductCatalogService] Failed to get products by category:', error);
      return [];
    }
  },

  /**
   * Imports products from file (Excel/CSV)
   * Returns success status, count of imported items, and any errors
   */
  importProductsFromFile: async (file: File): Promise<{ success: boolean; imported: number; errors: string[] }> => {
    try {
      const { FileImportService } = await import('./fileImportService');
      const parseResult = await FileImportService.parseProductsFromFile(file);
      
      if (!parseResult.success || parseResult.products.length === 0) {
        return {
          success: false,
          imported: 0,
          errors: parseResult.errors,
        };
      }

      const existingProducts = await ProductCatalogService.getProducts();
      const existingIds = new Set(existingProducts.map(p => p.id));
      const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase()));
      
      let imported = 0;
      const errors: string[] = [];

      for (const productData of parseResult.products) {
        try {
          // Check for duplicates by name
          if (existingNames.has(productData.name.toLowerCase())) {
            errors.push(`Product "${productData.name}" already exists, skipping`);
            continue;
          }

          // Create product with proper structure
          const now = Date.now();
          const newProduct: Product = {
            id: `product_${now}_${Math.random().toString(36).substr(2, 9)}`,
            name: productData.name,
            category: productData.category || 'Uncategorized',
            shortDescription: productData.shortDescription || '',
            fullDescription: productData.fullDescription,
            tags: productData.tags || [],
            specifications: productData.specifications || {},
            imageUrl: productData.imageUrl,
            active: productData.active !== undefined ? productData.active : true,
            createdAt: now,
            updatedAt: now,
          };

          existingProducts.push(newProduct);
          existingNames.add(newProduct.name.toLowerCase());
          imported++;
        } catch (error: any) {
          errors.push(`Failed to import product "${productData.name}": ${error.message}`);
        }
      }

      if (imported > 0) {
        await PlatformService.setAppConfig('products_catalog', JSON.stringify(existingProducts));
        Logger.info(`[ProductCatalogService] Imported ${imported} products`);
      }

      return {
        success: imported > 0,
        imported,
        errors,
      };
    } catch (error: any) {
      Logger.error('[ProductCatalogService] Failed to import products:', error);
      return {
        success: false,
        imported: 0,
        errors: [error.message || 'Failed to import products'],
      };
    }
  },

  /**
   * Exports products to JSON or CSV string
   */
  exportProducts: async (format: 'json' | 'csv' = 'json'): Promise<string> => {
    try {
      const products = await ProductCatalogService.getProducts();
      
      if (format === 'json') {
        return JSON.stringify(products, null, 2);
      } else {
        // CSV format
        if (products.length === 0) {
          return 'Name,Category,Short Description,Full Description,Tags,Specifications,Active\n';
        }

        const headers = ['Name', 'Category', 'Short Description', 'Full Description', 'Tags', 'Specifications', 'Active'];
        const rows = products.map(p => [
          p.name,
          p.category,
          p.shortDescription || '',
          p.fullDescription || '',
          p.tags.join('; '),
          JSON.stringify(p.specifications || {}),
          p.active ? 'Yes' : 'No',
        ]);

        const csvRows = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))];
        return csvRows.join('\n');
      }
    } catch (error) {
      Logger.error('[ProductCatalogService] Failed to export products:', error);
      throw error;
    }
  },
};

