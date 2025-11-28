import { PlatformService } from './platformService';
import { Product, ProductRecommendation, Importer } from '../types';
import { Logger } from './loggerService';
import { ProductCatalogService } from './productCatalogService';

/**
 * Product Recommendation Service
 * Provides dynamic product recommendations based on customer data
 */
export const ProductRecommendationService = {
  /**
   * Gets product recommendations for a customer
   */
  getRecommendationsForCustomer: async (
    customerId: string,
    context: {
      previousPurchases?: string[];
      customerCategory?: string;
      location?: string;
      context?: string;
    }
  ): Promise<ProductRecommendation[]> => {
    try {
      const allProducts = await ProductCatalogService.getProducts();
      const recommendations: ProductRecommendation[] = [];

      // 1. Previous Purchase History
      if (context.previousPurchases && context.previousPurchases.length > 0) {
        for (const purchase of context.previousPurchases) {
          // Find products matching previous purchases
          const matchingProducts = allProducts.filter(p => 
            p.name.toLowerCase().includes(purchase.toLowerCase()) ||
            p.category.toLowerCase().includes(purchase.toLowerCase()) ||
            p.tags.some(tag => tag.toLowerCase().includes(purchase.toLowerCase()))
          );

          for (const product of matchingProducts) {
            if (product.status === 'active') {
              recommendations.push({
                productId: product.id,
                productName: product.name,
                reason: 'previous_purchase',
                confidence: 85,
                context: `Customer previously purchased: ${purchase}`,
              });
            }
          }

          // Find related products
          const relatedProducts = allProducts.filter(p => 
            p.relatedProducts && p.relatedProducts.some(rp => 
              matchingProducts.some(mp => mp.id === rp)
            )
          );

          for (const product of relatedProducts) {
            if (product.status === 'active' && !recommendations.some(r => r.productId === product.id)) {
              recommendations.push({
                productId: product.id,
                productName: product.name,
                reason: 'related_product',
                confidence: 70,
                context: `Related to previous purchase: ${purchase}`,
              });
            }
          }
        }
      }

      // 2. Category/Location Match
      if (context.customerCategory) {
        const categoryProducts = allProducts.filter(p => 
          p.category.toLowerCase() === context.customerCategory!.toLowerCase() &&
          p.status === 'active'
        );

        for (const product of categoryProducts) {
          if (!recommendations.some(r => r.productId === product.id)) {
            recommendations.push({
              productId: product.id,
              productName: product.name,
              reason: 'category_match',
              confidence: 60,
              context: `Matches customer category: ${context.customerCategory}`,
            });
          }
        }
      }

      // 3. Seasonal Products (placeholder - can be enhanced with date logic)
      const seasonalProducts = allProducts.filter(p => 
        p.tags.some(tag => ['seasonal', 'promotion', 'special'].includes(tag.toLowerCase())) &&
        p.status === 'active'
      );

      for (const product of seasonalProducts.slice(0, 3)) {
        if (!recommendations.some(r => r.productId === product.id)) {
          recommendations.push({
            productId: product.id,
            productName: product.name,
            reason: 'seasonal',
            confidence: 50,
            context: 'Seasonal/promotional product',
          });
        }
      }

      // 4. AI Suggested (based on usage count - most recommended products)
      const aiSuggestedProducts = allProducts
        .filter(p => p.status === 'active' && (p.aiUsageCount || 0) > 0)
        .sort((a, b) => (b.aiUsageCount || 0) - (a.aiUsageCount || 0))
        .slice(0, 5);

      for (const product of aiSuggestedProducts) {
        if (!recommendations.some(r => r.productId === product.id)) {
          recommendations.push({
            productId: product.id,
            productName: product.name,
            reason: 'ai_suggested',
            confidence: 55,
            context: `Frequently recommended by AI (${product.aiUsageCount} times)`,
          });
        }
      }

      // Sort by confidence and remove duplicates
      const uniqueRecommendations = recommendations
        .filter((rec, index, self) => 
          index === self.findIndex(r => r.productId === rec.productId)
        )
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10); // Limit to top 10

      return uniqueRecommendations;
    } catch (error) {
      Logger.error('[ProductRecommendationService] Failed to get recommendations:', error);
      return [];
    }
  },

  /**
   * Gets recommendations by category
   */
  getRecommendationsByCategory: async (category: string, limit: number = 10): Promise<Product[]> => {
    try {
      const products = await ProductCatalogService.getProductsByCategory(category);
      return products
        .filter(p => p.status === 'active')
        .slice(0, limit);
    } catch (error) {
      Logger.error('[ProductRecommendationService] Failed to get recommendations by category:', error);
      return [];
    }
  },

  /**
   * Gets related products for a product
   */
  getRelatedProducts: async (productId: string, limit: number = 5): Promise<Product[]> => {
    try {
      const product = await ProductCatalogService.getProductById(productId);
      if (!product || !product.relatedProducts) {
        return [];
      }

      const relatedProducts: Product[] = [];
      for (const relatedId of product.relatedProducts.slice(0, limit)) {
        const relatedProduct = await ProductCatalogService.getProductById(relatedId);
        if (relatedProduct && relatedProduct.status === 'active') {
          relatedProducts.push(relatedProduct);
        }
      }

      return relatedProducts;
    } catch (error) {
      Logger.error('[ProductRecommendationService] Failed to get related products:', error);
      return [];
    }
  },

  /**
   * Gets seasonal products
   */
  getSeasonalProducts: async (limit: number = 5): Promise<Product[]> => {
    try {
      const allProducts = await ProductCatalogService.getProducts();
      return allProducts
        .filter(p => 
          p.status === 'active' &&
          p.tags.some(tag => ['seasonal', 'promotion', 'special', 'limited'].includes(tag.toLowerCase()))
        )
        .slice(0, limit);
    } catch (error) {
      Logger.error('[ProductRecommendationService] Failed to get seasonal products:', error);
      return [];
    }
  },

  /**
   * Tracks when a product is recommended by AI
   */
  trackRecommendationUsage: async (productId: string, customerId: string, reason: string): Promise<void> => {
    try {
      const product = await ProductCatalogService.getProductById(productId);
      if (!product) {
        return;
      }

      // Update AI usage count
      await ProductCatalogService.updateProduct(productId, {
        aiUsageCount: (product.aiUsageCount || 0) + 1,
        lastRecommendedAt: Date.now(),
      });

      // Store recommendation record
      const recommendations = await ProductRecommendationService.getRecommendationHistory();
      recommendations.push({
        productId,
        customerId,
        reason,
        recommendedAt: Date.now(),
      });

      // Keep only last 1000 recommendations
      if (recommendations.length > 1000) {
        recommendations.shift();
      }

      await PlatformService.setAppConfig('product_recommendations', JSON.stringify(recommendations));
      Logger.info(`[ProductRecommendationService] Tracked recommendation: ${productId} for ${customerId}`);
    } catch (error) {
      Logger.error('[ProductRecommendationService] Failed to track recommendation:', error);
    }
  },

  /**
   * Gets recommendation history
   */
  getRecommendationHistory: async (): Promise<Array<{
    productId: string;
    customerId: string;
    reason: string;
    recommendedAt: number;
  }>> => {
    try {
      const data = await PlatformService.getAppConfig('product_recommendations', null);
      if (!data) return [];
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (error) {
      Logger.error('[ProductRecommendationService] Failed to get recommendation history:', error);
      return [];
    }
  },
};

