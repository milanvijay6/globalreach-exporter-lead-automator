import { PlatformService } from './platformService';
import { ProductPrice, Product } from '../types';
import { Logger } from './loggerService';
import { ProductCatalogService } from './productCatalogService';

/**
 * Product Pricing Service
 * Handles price CRUD, product linking, and bulk operations
 */
export const ProductPricingService = {
  /**
   * Gets all prices from storage
   */
  getPrices: async (): Promise<ProductPrice[]> => {
    try {
      const data = await PlatformService.getAppConfig('product_prices', null);
      if (!data) return [];
      const prices = typeof data === 'string' ? JSON.parse(data) : data;
      return Array.isArray(prices) ? prices : [];
    } catch (error) {
      Logger.error('[ProductPricingService] Failed to load prices:', error);
      return [];
    }
  },

  /**
   * Gets price by product ID
   */
  getPriceByProductId: async (productId: string): Promise<ProductPrice | null> => {
    try {
      const prices = await ProductPricingService.getPrices();
      // Get the most recent active price for the product
      const productPrices = prices
        .filter(p => p.productId === productId)
        .sort((a, b) => b.effectiveDate - a.effectiveDate);
      return productPrices[0] || null;
    } catch (error) {
      Logger.error('[ProductPricingService] Failed to get price:', error);
      return null;
    }
  },

  /**
   * Gets only active prices
   */
  getActivePrices: async (): Promise<ProductPrice[]> => {
    try {
      const prices = await ProductPricingService.getPrices();
      return prices.filter(p => p.active);
    } catch (error) {
      Logger.error('[ProductPricingService] Failed to get active prices:', error);
      return [];
    }
  },

  /**
   * Adds a new price
   */
  addPrice: async (price: Omit<ProductPrice, 'id' | 'lastUpdated' | 'effectiveDate'>): Promise<ProductPrice> => {
    try {
      // Verify product exists
      const product = await ProductCatalogService.getProductById(price.productId);
      if (!product) {
        throw new Error(`Product with id ${price.productId} not found`);
      }

      const prices = await ProductPricingService.getPrices();
      const now = Date.now();
      const newPrice: ProductPrice = {
        ...price,
        id: `price_${now}_${Math.random().toString(36).substr(2, 9)}`,
        productName: product.name, // Denormalize product name
        effectiveDate: now,
        lastUpdated: now,
      };
      prices.push(newPrice);
      await PlatformService.setAppConfig('product_prices', JSON.stringify(prices));
      Logger.info('[ProductPricingService] Price added:', newPrice.id);
      return newPrice;
    } catch (error) {
      Logger.error('[ProductPricingService] Failed to add price:', error);
      throw error;
    }
  },

  /**
   * Updates an existing price
   */
  updatePrice: async (id: string, updates: Partial<ProductPrice>): Promise<ProductPrice> => {
    try {
      const prices = await ProductPricingService.getPrices();
      const index = prices.findIndex(p => p.id === id);
      if (index === -1) {
        throw new Error(`Price with id ${id} not found`);
      }

      // If productId changed, verify new product exists and update productName
      if (updates.productId && updates.productId !== prices[index].productId) {
        const product = await ProductCatalogService.getProductById(updates.productId);
        if (!product) {
          throw new Error(`Product with id ${updates.productId} not found`);
        }
        updates.productName = product.name;
      }

      const updated: ProductPrice = {
        ...prices[index],
        ...updates,
        id, // Ensure ID doesn't change
        lastUpdated: Date.now(),
      };
      prices[index] = updated;
      await PlatformService.setAppConfig('product_prices', JSON.stringify(prices));
      Logger.info('[ProductPricingService] Price updated:', id);
      return updated;
    } catch (error) {
      Logger.error('[ProductPricingService] Failed to update price:', error);
      throw error;
    }
  },

  /**
   * Deletes a price
   */
  deletePrice: async (id: string): Promise<void> => {
    try {
      const prices = await ProductPricingService.getPrices();
      const filtered = prices.filter(p => p.id !== id);
      if (filtered.length === prices.length) {
        throw new Error(`Price with id ${id} not found`);
      }
      await PlatformService.setAppConfig('product_prices', JSON.stringify(filtered));
      Logger.info('[ProductPricingService] Price deleted:', id);
    } catch (error) {
      Logger.error('[ProductPricingService] Failed to delete price:', error);
      throw error;
    }
  },

  /**
   * Gets price for a product with optional tier
   */
  getPriceForProduct: async (
    productId: string,
    tier?: 'base' | 'wholesale' | 'retail' | 'special'
  ): Promise<number | null> => {
    try {
      const price = await ProductPricingService.getPriceByProductId(productId);
      if (!price || !price.active) return null;

      switch (tier) {
        case 'wholesale':
          return price.wholesalePrice || price.basePrice;
        case 'retail':
          return price.retailPrice || price.basePrice;
        case 'special':
          return price.specialCustomerPrice || price.basePrice;
        default:
          return price.basePrice;
      }
    } catch (error) {
      Logger.error('[ProductPricingService] Failed to get price for product:', error);
      return null;
    }
  },

  /**
   * Imports prices from file (Excel/CSV)
   * Requires products to exist in catalog
   */
  importPricesFromFile: async (file: File): Promise<{ success: boolean; imported: number; errors: string[] }> => {
    try {
      const { FileImportService } = await import('./fileImportService');
      const products = await ProductCatalogService.getProducts();
      const parseResult = await FileImportService.parsePricesFromFile(file, products);
      
      if (!parseResult.success || parseResult.prices.length === 0) {
        return {
          success: false,
          imported: 0,
          errors: parseResult.errors,
        };
      }

      const existingPrices = await ProductPricingService.getPrices();
      const existingIds = new Set(existingPrices.map(p => p.id));
      
      let imported = 0;
      const errors: string[] = [];

      for (const priceData of parseResult.prices) {
        try {
          // Verify product exists
          const product = products.find(p => 
            p.id === priceData.productId || 
            p.name.toLowerCase() === priceData.productName?.toLowerCase()
          );

          if (!product) {
            errors.push(`Product "${priceData.productName || priceData.productId}" not found, skipping`);
            continue;
          }

          // Create price with proper structure
          const now = Date.now();
          const newPrice: ProductPrice = {
            id: `price_${now}_${Math.random().toString(36).substr(2, 9)}`,
            productId: product.id,
            productName: product.name,
            unitOfMeasure: priceData.unitOfMeasure || 'piece',
            basePrice: priceData.basePrice || 0,
            wholesalePrice: priceData.wholesalePrice,
            retailPrice: priceData.retailPrice,
            specialCustomerPrice: priceData.specialCustomerPrice,
            currency: priceData.currency || 'USD',
            effectiveDate: priceData.effectiveDate || now,
            lastUpdated: now,
            notes: priceData.notes,
            active: priceData.active !== undefined ? priceData.active : true,
          };

          existingPrices.push(newPrice);
          imported++;
        } catch (error: any) {
          errors.push(`Failed to import price for "${priceData.productName}": ${error.message}`);
        }
      }

      if (imported > 0) {
        await PlatformService.setAppConfig('product_prices', JSON.stringify(existingPrices));
        Logger.info(`[ProductPricingService] Imported ${imported} prices`);
      }

      return {
        success: imported > 0,
        imported,
        errors,
      };
    } catch (error: any) {
      Logger.error('[ProductPricingService] Failed to import prices:', error);
      return {
        success: false,
        imported: 0,
        errors: [error.message || 'Failed to import prices'],
      };
    }
  },

  /**
   * Exports prices to JSON or CSV string
   */
  exportPrices: async (format: 'json' | 'csv' = 'json'): Promise<string> => {
    try {
      const prices = await ProductPricingService.getPrices();
      
      if (format === 'json') {
        return JSON.stringify(prices, null, 2);
      } else {
        // CSV format
        if (prices.length === 0) {
          return 'Product Name,Product ID,Unit of Measure,Base Price,Wholesale Price,Retail Price,Special Price,Currency,Effective Date,Active,Notes\n';
        }

        const headers = [
          'Product Name',
          'Product ID',
          'Unit of Measure',
          'Base Price',
          'Wholesale Price',
          'Retail Price',
          'Special Price',
          'Currency',
          'Effective Date',
          'Active',
          'Notes',
        ];
        const rows = prices.map(p => [
          p.productName,
          p.productId,
          p.unitOfMeasure,
          p.basePrice,
          p.wholesalePrice || '',
          p.retailPrice || '',
          p.specialCustomerPrice || '',
          p.currency,
          new Date(p.effectiveDate).toISOString(),
          p.active ? 'Yes' : 'No',
          p.notes || '',
        ]);

        const csvRows = [headers.join(','), ...rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))];
        return csvRows.join('\n');
      }
    } catch (error) {
      Logger.error('[ProductPricingService] Failed to export prices:', error);
      throw error;
    }
  },
};

