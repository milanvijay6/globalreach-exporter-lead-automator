import { Logger } from './loggerService';

/**
 * Product Price Strategy Service
 * Handles price-related rules and validation for AI messaging
 */
export const ProductPriceStrategy = {
  /**
   * Price strategy instructions for AI
   */
  PRICE_STRATEGY_INSTRUCTIONS: `
CRITICAL PRICING RULES:
1. NEVER quote final prices directly to customers
2. Reference prices (e.g., ₹45/kg) are for YOUR context only - do not share exact numbers
3. Use phrases like:
   - "We have competitive rates on [Product]"
   - "Excellent pricing available"
   - "Better than market rates"
   - "Can offer better rates based on quantity"
4. ALWAYS follow up with: "Please share your quantity requirement for exact quotation"
5. For customers with purchase history: "Based on your previous [Product] orders, we can offer better rates. Kindly confirm quantity for quotation."
6. Never use phrases like "Our price is ₹X" or "It costs ₹Y"
7. Always position pricing as competitive/attractive without giving specific numbers
`,

  /**
   * Gets reference price context string for AI (not for customer)
   */
  getReferencePriceContext: async (productId: string): Promise<string> => {
    try {
      const { ProductPricingService } = await import('./productPricingService');
      const { ProductCatalogService } = await import('./productCatalogService');
      
      const product = await ProductCatalogService.getProductById(productId);
      if (!product) {
        return '';
      }

      const price = await ProductPricingService.getPriceForProduct(productId);
      
      if (price && product.referencePriceCurrency) {
        return `Reference: ${product.referencePriceCurrency} ${product.referencePrice || price}/${product.unit} (FOR YOUR CONTEXT ONLY - DO NOT QUOTE THIS TO CUSTOMER)`;
      } else if (product.referencePrice) {
        return `Reference: ${product.referencePriceCurrency || 'USD'} ${product.referencePrice}/${product.unit} (FOR YOUR CONTEXT ONLY - DO NOT QUOTE THIS TO CUSTOMER)`;
      }
      
      return 'Price on request (no reference price available)';
    } catch (error) {
      Logger.error('[ProductPriceStrategy] Failed to get reference price context:', error);
      return '';
    }
  },

  /**
   * Validates if a message contains direct price quotes (should be avoided)
   */
  validateMessageForPriceQuotes: (message: string): { valid: boolean; violations: string[] } => {
    const violations: string[] = [];
    const lowerMessage = message.toLowerCase();

    // Check for direct price patterns
    const pricePatterns = [
      /\$\d+|\d+\s*(usd|eur|inr|gbp)/i, // Currency symbols or codes with numbers
      /price is \d+|costs \d+|₹\d+|\$\d+/i, // Direct price statements
      /our price|exact price|final price/i, // Price-related phrases
    ];

    pricePatterns.forEach((pattern, index) => {
      if (pattern.test(message)) {
        violations.push(`Direct price quote detected: "${message.match(pattern)?.[0]}"`);
      }
    });

    // Check for acceptable phrases (these are OK)
    const acceptablePhrases = [
      'competitive rates',
      'better than market',
      'excellent pricing',
      'attractive rates',
      'quantity for quotation',
      'share your requirement',
    ];

    const hasAcceptablePhrase = acceptablePhrases.some(phrase => lowerMessage.includes(phrase));

    return {
      valid: violations.length === 0,
      violations,
    };
  },

  /**
   * Generates a price-aware message that follows the strategy
   */
  generatePriceAwareMessage: async (
    productId: string,
    context: {
      customerName?: string;
      previousPurchase?: string;
      quantity?: string;
    }
  ): Promise<string> => {
    try {
      const { ProductCatalogService } = await import('./productCatalogService');
      const product = await ProductCatalogService.getProductById(productId);
      
      if (!product) {
        return 'Product not found';
      }

      let message = '';

      if (context.customerName) {
        message += `Namaste ${context.customerName}! `;
      }

      if (context.previousPurchase) {
        message += `Noticed you regularly order ${context.previousPurchase}. `;
      }

      message += `We have fresh ${product.name} stock ready. `;
      message += `Can offer better than market rates. `;
      message += `Please share your quantity requirement for exact quotation.`;

      if (product.photos.length > 0) {
        const primaryPhoto = product.photos.find(p => p.isPrimary) || product.photos[0];
        message += ` [Photo: ${primaryPhoto.url}]`;
      }

      return message;
    } catch (error) {
      Logger.error('[ProductPriceStrategy] Failed to generate price-aware message:', error);
      return 'Error generating message';
    }
  },
};

