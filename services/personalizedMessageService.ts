import { Logger } from './loggerService';
import { CustomerIntent, PurchasePattern } from '../types';

/**
 * Personalized Message Generation Service
 * Creates culturally appropriate, personalized outreach messages
 */
export const PersonalizedMessageService = {
  /**
   * Generates personalized intro message for customer
   */
  generateIntroMessage: (intent: CustomerIntent, pattern: PurchasePattern): string => {
    const greeting = PersonalizedMessageService.customizeGreeting(intent.customerName);
    const purchaseReference = PersonalizedMessageService.referencePurchaseHistory(intent, pattern);
    const needsPrediction = PersonalizedMessageService.predictNeeds(intent, pattern);
    const valueProposition = PersonalizedMessageService.addValueProposition(intent);

    // Combine into natural message
    let message = `${greeting} ${purchaseReference} ${needsPrediction} ${valueProposition}`;

    // Clean up spacing
    message = message.replace(/\s+/g, ' ').trim();

    return message;
  },

  /**
   * Customizes greeting based on customer name and culture
   */
  customizeGreeting: (customerName: string): string => {
    // Extract first name
    const firstName = customerName.split(' ')[0].trim();
    
    // Check if name suggests Indian context (common patterns)
    const indianPatterns = ['bhai', 'ji', 'kumar', 'singh', 'patel', 'shah'];
    const isIndianContext = indianPatterns.some(pattern => 
      customerName.toLowerCase().includes(pattern)
    );

    if (isIndianContext) {
      // Use Namaste and respectful suffix
      const nameParts = firstName.split(/(bhai|ji)/i);
      const baseName = nameParts[0].trim();
      const suffix = nameParts[1] || 'bhai';
      return `Namaste ${baseName}${suffix}`;
    } else {
      // Standard professional greeting
      return `Hello ${firstName}`;
    }
  },

  /**
   * References purchase history naturally
   */
  referencePurchaseHistory: (intent: CustomerIntent, pattern: PurchasePattern): string => {
    const daysSince = intent.daysSinceLastOrder || 0;
    const productName = pattern.productDescription;

    if (daysSince > 0) {
      if (daysSince <= 7) {
        return `Hope you are well.`;
      } else if (daysSince <= 30) {
        return `Hope you are well. Noticed you last purchased ${productName} from us ${daysSince} days ago,`;
      } else if (daysSince <= 60) {
        return `Hope you are well. Noticed you last purchased ${productName} from us about ${Math.round(daysSince / 30)} months ago,`;
      } else {
        return `Hope you are well. Noticed you last purchased ${productName} from us ${Math.round(daysSince / 30)} months ago,`;
      }
    } else {
      return `Hope you are well.`;
    }
  },

  /**
   * Predicts upcoming needs naturally
   */
  predictNeeds: (intent: CustomerIntent, pattern: PurchasePattern): string => {
    const daysSince = intent.daysSinceLastOrder || 0;
    const typicalCycle = intent.typicalCycleDays || 0;

    if (intent.intentType === 'imminent_order' && daysSince > typicalCycle) {
      // Overdue order
      const mainProduct = intent.predictedProducts[0];
      if (mainProduct) {
        return `so wanted to check if you need fresh stock of ${mainProduct.productDescription}.`;
      }
      return `so wanted to check if you need fresh stock.`;
    } else if (intent.intentType === 'regular_cycle') {
      // Regular cycle customer
      const daysUntil = Math.round((intent.predictedProducts[0]?.predictedQuantity ? 
        (pattern.nextPredictedDate - Date.now()) / (1000 * 60 * 60 * 24) : 0));
      
      if (daysUntil <= 7 && daysUntil > 0) {
        return `so wanted to check if you need to restock ${pattern.productDescription} soon.`;
      } else {
        return `so wanted to check if you need fresh stock of ${pattern.productDescription}.`;
      }
    } else if (intent.intentType === 'dormant') {
      // Dormant customer
      return `so wanted to check if you have any requirements for ${pattern.productDescription} or other products.`;
    } else {
      // Default
      return `so wanted to check if you need fresh stock of ${pattern.productDescription}.`;
    }
  },

  /**
   * Adds value proposition (deals, support, delivery)
   */
  addValueProposition: (intent: CustomerIntent): string => {
    const valueProps = [
      'We have excellent rates and can arrange prompt delivery.',
      'We can offer competitive pricing and fast delivery.',
      'We have fresh stock available and can provide quick delivery.',
      'We can offer special rates for bulk orders and ensure timely delivery.',
    ];

    // Rotate based on customer ID for variety
    const index = intent.customerId.length % valueProps.length;
    return valueProps[index];
  },

  /**
   * Generates complete message with all components
   */
  generateCompleteMessage: (intent: CustomerIntent, pattern: PurchasePattern): string => {
    const message = PersonalizedMessageService.generateIntroMessage(intent, pattern);
    
    // Add closing
    const closing = 'Please let me know your requirements.';
    
    return `${message} ${closing}`;
  },

  /**
   * Formats message for specific channel (WhatsApp/Email)
   */
  formatForChannel: (message: string, channel: 'whatsapp' | 'email'): string => {
    if (channel === 'whatsapp') {
      // WhatsApp: Keep it concise, use emojis sparingly
      return message;
    } else {
      // Email: Can be slightly more formal
      return message;
    }
  },
};

