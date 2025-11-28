import { PlatformService } from './platformService';
import { ProductCatalogService } from './productCatalogService';
import { ProductPricingService } from './productPricingService';
import { Logger } from './loggerService';
import { Product, ProductPrice } from '../types';

/**
 * Product Backup Service
 * Handles backup and restore of product catalog data
 */
export const ProductBackupService = {
  /**
   * Creates a backup of all product data
   */
  createBackup: async (): Promise<{ success: boolean; data?: string; error?: string }> => {
    try {
      const products = await ProductCatalogService.getProducts();
      const prices = await ProductPricingService.getPrices();
      
      const backupData = {
        version: '1.0',
        timestamp: Date.now(),
        products,
        prices,
      };

      const backupJson = JSON.stringify(backupData, null, 2);
      
      Logger.info('[ProductBackupService] Backup created successfully');
      return { success: true, data: backupJson };
    } catch (error: any) {
      Logger.error('[ProductBackupService] Failed to create backup:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Restores product data from backup
   */
  restoreBackup: async (backupData: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const backup = JSON.parse(backupData);
      
      if (!backup.products || !Array.isArray(backup.products)) {
        return { success: false, error: 'Invalid backup format: products array missing' };
      }

      // Validate backup structure
      if (backup.version !== '1.0') {
        Logger.warn('[ProductBackupService] Backup version mismatch, attempting restore anyway');
      }

      // Restore products
      const existingProducts = await ProductCatalogService.getProducts();
      const existingIds = new Set(existingProducts.map(p => p.id));

      for (const product of backup.products) {
        try {
          if (existingIds.has(product.id)) {
            // Update existing product
            await ProductCatalogService.updateProduct(product.id, product);
          } else {
            // Add new product (preserve ID from backup)
            await ProductCatalogService.addProduct(product as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>);
          }
        } catch (error: any) {
          Logger.error(`[ProductBackupService] Failed to restore product ${product.id}:`, error);
        }
      }

      // Restore prices if available
      if (backup.prices && Array.isArray(backup.prices)) {
        for (const price of backup.prices) {
          try {
            const existingPrice = await ProductPricingService.getPriceByProductId(price.productId);
            if (existingPrice) {
              await ProductPricingService.updatePrice(price.id, price);
            } else {
              await ProductPricingService.addPrice(price as Omit<ProductPrice, 'id' | 'lastUpdated' | 'effectiveDate'>);
            }
          } catch (error: any) {
            Logger.error(`[ProductBackupService] Failed to restore price ${price.id}:`, error);
          }
        }
      }

      Logger.info('[ProductBackupService] Backup restored successfully');
      return { success: true };
    } catch (error: any) {
      Logger.error('[ProductBackupService] Failed to restore backup:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Exports backup to file (for download)
   */
  exportBackup: async (): Promise<{ success: boolean; data?: string; filename?: string; error?: string }> => {
    try {
      const backup = await ProductBackupService.createBackup();
      if (!backup.success || !backup.data) {
        return { success: false, error: backup.error || 'Failed to create backup' };
      }

      const filename = `products_backup_${new Date().toISOString().split('T')[0]}.json`;
      return { success: true, data: backup.data, filename };
    } catch (error: any) {
      Logger.error('[ProductBackupService] Failed to export backup:', error);
      return { success: false, error: error.message };
    }
  },

  /**
   * Schedules automatic backups (stores in app config)
   */
  scheduleBackups: async (interval: 'daily' | 'weekly' | 'monthly' | 'never'): Promise<void> => {
    try {
      await PlatformService.setAppConfig('product_backup_schedule', interval);
      Logger.info(`[ProductBackupService] Backup schedule set to: ${interval}`);
    } catch (error) {
      Logger.error('[ProductBackupService] Failed to set backup schedule:', error);
    }
  },

  /**
   * Gets backup schedule
   */
  getBackupSchedule: async (): Promise<'daily' | 'weekly' | 'monthly' | 'never'> => {
    try {
      const schedule = await PlatformService.getAppConfig('product_backup_schedule', 'never');
      return schedule as 'daily' | 'weekly' | 'monthly' | 'never';
    } catch (error) {
      Logger.error('[ProductBackupService] Failed to get backup schedule:', error);
      return 'never';
    }
  },
};

