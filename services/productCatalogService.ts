import { PlatformService } from './platformService';
import { Product, ProductPhoto } from '../types';
import { Logger } from './loggerService';

/**
 * Product Catalog Service
 * Handles product CRUD, search, and bulk import/export
 */
export const ProductCatalogService = {
  /**
   * Migrates old product format to new format
   */
  migrateProduct: (oldProduct: any): Product => {
    // If already in new format, return as-is
    if (oldProduct.photos !== undefined && oldProduct.status !== undefined) {
      return oldProduct as Product;
    }

    // Migrate from old format
    const photos: ProductPhoto[] = [];
    if (oldProduct.imageUrl) {
      photos.push({
        id: `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        url: oldProduct.imageUrl,
        fileName: oldProduct.imageUrl.split('/').pop() || 'image.jpg',
        fileSize: 0,
        mimeType: 'image/jpeg',
        isPrimary: true,
        uploadedAt: oldProduct.createdAt || Date.now(),
      });
    }

    return {
      ...oldProduct,
      photos,
      status: oldProduct.active === false ? 'inactive' : 'active',
      fullDescription: oldProduct.fullDescription || oldProduct.shortDescription || '',
      unit: oldProduct.unit || 'piece',
      relatedProducts: oldProduct.relatedProducts || [],
      aiUsageCount: oldProduct.aiUsageCount || 0,
      // Remove old fields
      active: undefined,
      imageUrl: undefined,
    } as Product;
  },

  /**
   * Gets all products from storage
   */
  getProducts: async (): Promise<Product[]> => {
    try {
      const data = await PlatformService.getAppConfig('products_catalog', null);
      if (!data) return [];
      const products = typeof data === 'string' ? JSON.parse(data) : data;
      const productArray = Array.isArray(products) ? products : [];
      
      // Migrate old products to new format
      const migrated = productArray.map(p => ProductCatalogService.migrateProduct(p));
      
      // Migrate photo URLs from file:// to HTTP
      const { ProductPhotoService } = await import('./productPhotoService');
      const port = await PlatformService.getAppConfig('serverPort', 4000);
      return migrated.map(product => {
        if (product.photos && product.photos.length > 0) {
          return {
            ...product,
            photos: product.photos.map(photo => ({
              ...photo,
              url: ProductPhotoService.convertFileUrlToHttp(photo.url, port),
              thumbnailUrl: photo.thumbnailUrl ? ProductPhotoService.convertFileUrlToHttp(photo.thumbnailUrl, port) : undefined,
            })),
          };
        }
        return product;
      });
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
  searchProducts: async (query: string, filters?: { category?: string; tags?: string[]; status?: 'active' | 'inactive' }): Promise<Product[]> => {
    try {
      let products = await ProductCatalogService.getProducts();
      
      // Apply filters
      if (filters?.category) {
        products = products.filter(p => p.category.toLowerCase() === filters.category!.toLowerCase());
      }
      if (filters?.tags && filters.tags.length > 0) {
        products = products.filter(p => filters.tags!.some(tag => p.tags.includes(tag)));
      }
      if (filters?.status) {
        products = products.filter(p => p.status === filters.status);
      }
      
      // Apply search query
      if (!query || query.trim().length === 0) return products;
      
      const searchTerm = query.toLowerCase().trim();
      return products.filter(product => {
        const nameMatch = product.name.toLowerCase().includes(searchTerm);
        const categoryMatch = product.category.toLowerCase().includes(searchTerm);
        const descMatch = product.shortDescription.toLowerCase().includes(searchTerm) ||
          product.fullDescription.toLowerCase().includes(searchTerm);
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
          const photos: ProductPhoto[] = [];
          
          // Handle photo URLs from import
          if (productData.imageUrl) {
            photos.push({
              id: `photo_${now}_${Math.random().toString(36).substr(2, 9)}`,
              url: productData.imageUrl,
              fileName: productData.imageUrl.split('/').pop() || 'image.jpg',
              fileSize: 0,
              mimeType: 'image/jpeg',
              isPrimary: true,
              uploadedAt: now,
            });
          }
          
          // Handle multiple photo URLs
          if (Array.isArray(productData.photoUrls)) {
            productData.photoUrls.forEach((url: string, index: number) => {
              photos.push({
                id: `photo_${now}_${index}_${Math.random().toString(36).substr(2, 9)}`,
                url: url,
                fileName: url.split('/').pop() || `image_${index}.jpg`,
                fileSize: 0,
                mimeType: 'image/jpeg',
                isPrimary: index === 0,
                uploadedAt: now,
              });
            });
          }
          
          const newProduct: Product = {
            id: `product_${now}_${Math.random().toString(36).substr(2, 9)}`,
            name: productData.name,
            category: productData.category || 'Uncategorized',
            shortDescription: productData.shortDescription || '',
            fullDescription: productData.fullDescription || productData.shortDescription || '',
            unit: productData.unit || 'piece',
            referencePrice: productData.referencePrice,
            referencePriceCurrency: productData.referencePriceCurrency || 'USD',
            photos,
            tags: productData.tags || [],
            specifications: productData.specifications || {},
            relatedProducts: productData.relatedProducts || [],
            status: productData.status === 'inactive' ? 'inactive' : 'active',
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

        const headers = ['Name', 'Category', 'Unit', 'Reference Price', 'Currency', 'Short Description', 'Full Description', 'Tags', 'Status', 'Photo URLs'];
        const rows = products.map(p => [
          p.name,
          p.category,
          p.unit || 'piece',
          p.referencePrice?.toString() || '',
          p.referencePriceCurrency || '',
          p.shortDescription || '',
          p.fullDescription || '',
          p.tags.join('; '),
          p.status,
          p.photos.map(ph => ph.url).join('; '),
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

