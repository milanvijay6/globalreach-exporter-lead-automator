import { PlatformService } from './platformService';
import { ProductCatalogService } from './productCatalogService';
import { ProductRecommendationService } from './productRecommendationService';
import { Logger } from './loggerService';
import { Product } from '../types';

/**
 * Product Analytics Service
 * Tracks and analyzes product usage, recommendations, and performance
 */
export const ProductAnalyticsService = {
  /**
   * Gets most recommended products by AI
   */
  getMostRecommendedProducts: async (limit: number = 10): Promise<Array<{
    product: Product;
    recommendationCount: number;
    lastRecommendedAt?: number;
  }>> => {
    try {
      const allProducts = await ProductCatalogService.getProducts();
      
      return allProducts
        .filter(p => (p.aiUsageCount || 0) > 0)
        .map(p => ({
          product: p,
          recommendationCount: p.aiUsageCount || 0,
          lastRecommendedAt: p.lastRecommendedAt,
        }))
        .sort((a, b) => b.recommendationCount - a.recommendationCount)
        .slice(0, limit);
    } catch (error) {
      Logger.error('[ProductAnalyticsService] Failed to get most recommended products:', error);
      return [];
    }
  },

  /**
   * Gets product usage statistics
   */
  getProductUsageStats: async (): Promise<{
    totalProducts: number;
    activeProducts: number;
    inactiveProducts: number;
    productsWithPhotos: number;
    productsWithPrices: number;
    totalRecommendations: number;
    averageRecommendationsPerProduct: number;
  }> => {
    try {
      const products = await ProductCatalogService.getProducts();
      const { ProductPricingService } = await import('./productPricingService');
      const prices = await ProductPricingService.getPrices();

      const activeProducts = products.filter(p => p.status === 'active').length;
      const productsWithPhotos = products.filter(p => p.photos && p.photos.length > 0).length;
      const productsWithPrices = new Set(prices.map(p => p.productId)).size;
      const totalRecommendations = products.reduce((sum, p) => sum + (p.aiUsageCount || 0), 0);

      return {
        totalProducts: products.length,
        activeProducts,
        inactiveProducts: products.length - activeProducts,
        productsWithPhotos,
        productsWithPrices,
        totalRecommendations,
        averageRecommendationsPerProduct: products.length > 0 ? totalRecommendations / products.length : 0,
      };
    } catch (error) {
      Logger.error('[ProductAnalyticsService] Failed to get usage stats:', error);
      return {
        totalProducts: 0,
        activeProducts: 0,
        inactiveProducts: 0,
        productsWithPhotos: 0,
        productsWithPrices: 0,
        totalRecommendations: 0,
        averageRecommendationsPerProduct: 0,
      };
    }
  },

  /**
   * Gets category performance statistics
   */
  getCategoryStats: async (): Promise<Array<{
    category: string;
    productCount: number;
    activeCount: number;
    totalRecommendations: number;
  }>> => {
    try {
      const products = await ProductCatalogService.getProducts();
      const categoryMap = new Map<string, {
        productCount: number;
        activeCount: number;
        totalRecommendations: number;
      }>();

      for (const product of products) {
        const category = product.category || 'Uncategorized';
        const existing = categoryMap.get(category) || {
          productCount: 0,
          activeCount: 0,
          totalRecommendations: 0,
        };

        existing.productCount++;
        if (product.status === 'active') {
          existing.activeCount++;
        }
        existing.totalRecommendations += product.aiUsageCount || 0;

        categoryMap.set(category, existing);
      }

      return Array.from(categoryMap.entries())
        .map(([category, stats]) => ({ category, ...stats }))
        .sort((a, b) => b.totalRecommendations - a.totalRecommendations);
    } catch (error) {
      Logger.error('[ProductAnalyticsService] Failed to get category stats:', error);
      return [];
    }
  },

  /**
   * Gets recommendation success rates (placeholder - can be enhanced with actual conversion tracking)
   */
  getRecommendationSuccessRates: async (): Promise<Array<{
    reason: string;
    count: number;
    successRate?: number; // Placeholder - would need conversion tracking
  }>> => {
    try {
      const history = await ProductRecommendationService.getRecommendationHistory();
      const reasonMap = new Map<string, number>();

      for (const rec of history) {
        const count = reasonMap.get(rec.reason) || 0;
        reasonMap.set(rec.reason, count + 1);
      }

      return Array.from(reasonMap.entries())
        .map(([reason, count]) => ({
          reason,
          count,
          successRate: undefined, // Would need conversion data
        }))
        .sort((a, b) => b.count - a.count);
    } catch (error) {
      Logger.error('[ProductAnalyticsService] Failed to get recommendation success rates:', error);
      return [];
    }
  },

  /**
   * Tracks product view/access (for future analytics)
   */
  trackProductView: async (productId: string): Promise<void> => {
    try {
      // Store view tracking (can be enhanced with timestamp, user, etc.)
      const views = await PlatformService.getAppConfig('product_views', {});
      const viewData = typeof views === 'string' ? JSON.parse(views) : views;
      
      viewData[productId] = (viewData[productId] || 0) + 1;
      await PlatformService.setAppConfig('product_views', JSON.stringify(viewData));
    } catch (error) {
      Logger.error('[ProductAnalyticsService] Failed to track product view:', error);
    }
  },

  /**
   * Gets product view counts
   */
  getProductViews: async (productId?: string): Promise<number | Record<string, number>> => {
    try {
      const views = await PlatformService.getAppConfig('product_views', {});
      const viewData = typeof views === 'string' ? JSON.parse(views) : views;
      
      if (productId) {
        return viewData[productId] || 0;
      }
      return viewData;
    } catch (error) {
      Logger.error('[ProductAnalyticsService] Failed to get product views:', error);
      return productId ? 0 : {};
    }
  },
};

