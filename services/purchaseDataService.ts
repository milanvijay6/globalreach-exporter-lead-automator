import { Logger } from './loggerService';
import { PurchaseOrder, PurchasePattern, CustomerIntent } from '../types';
import { PlatformService } from './platformService';

const STORAGE_KEY_PURCHASE_ORDERS = 'globalreach_purchase_orders';
const STORAGE_KEY_PURCHASE_PATTERNS = 'globalreach_purchase_patterns';
const STORAGE_KEY_CUSTOMER_INTENTS = 'globalreach_customer_intents';

/**
 * Purchase Data Service
 * Handles storage and retrieval of purchase orders, patterns, and intents
 */
export const PurchaseDataService = {
  /**
   * Saves purchase orders
   */
  savePurchaseOrders: async (orders: PurchaseOrder[]): Promise<void> => {
    try {
      const existing = await PurchaseDataService.getPurchaseOrders();
      const combined = [...existing, ...orders];
      
      // Remove duplicates based on ID
      const unique = Array.from(
        new Map(combined.map(o => [o.id, o])).values()
      );

      await PlatformService.secureSave(
        STORAGE_KEY_PURCHASE_ORDERS,
        JSON.stringify(unique)
      );
      Logger.info('[PurchaseDataService] Saved purchase orders', { count: unique.length });
    } catch (error: any) {
      Logger.error('[PurchaseDataService] Failed to save purchase orders:', error);
      throw new Error(`Failed to save purchase orders: ${error.message}`);
    }
  },

  /**
   * Gets all purchase orders with optional filtering
   */
  getPurchaseOrders: async (filters?: {
    customerId?: string;
    productDescription?: string;
    startDate?: number;
    endDate?: number;
  }): Promise<PurchaseOrder[]> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_PURCHASE_ORDERS);
      if (!stored) return [];

      let orders: PurchaseOrder[] = JSON.parse(stored);

      // Apply filters
      if (filters) {
        if (filters.customerId) {
          const { PurchasePatternAnalysisService } = await import('./purchasePatternAnalysisService');
          orders = orders.filter(o => 
            PurchasePatternAnalysisService.getCustomerId(o) === filters.customerId
          );
        }

        if (filters.productDescription) {
          const searchTerm = filters.productDescription.toLowerCase();
          orders = orders.filter(o =>
            o.productDescription.toLowerCase().includes(searchTerm)
          );
        }

        if (filters.startDate) {
          orders = orders.filter(o => o.orderDate >= filters.startDate!);
        }

        if (filters.endDate) {
          orders = orders.filter(o => o.orderDate <= filters.endDate!);
        }
      }

      return orders;
    } catch (error: any) {
      Logger.error('[PurchaseDataService] Failed to get purchase orders:', error);
      return [];
    }
  },

  /**
   * Gets purchase history for a specific customer
   */
  getCustomerPurchaseHistory: async (customerId: string): Promise<PurchaseOrder[]> => {
    return await PurchaseDataService.getPurchaseOrders({ customerId });
  },

  /**
   * Saves purchase patterns
   */
  savePurchasePatterns: async (patterns: PurchasePattern[]): Promise<void> => {
    try {
      const existing = await PurchaseDataService.getPurchasePatterns();
      const combined = [...existing, ...patterns];

      // Update existing patterns or add new ones
      const patternMap = new Map<string, PurchasePattern>();
      existing.forEach(p => patternMap.set(`${p.customerId}-${p.productDescription}`, p));
      patterns.forEach(p => patternMap.set(`${p.customerId}-${p.productDescription}`, p));

      const unique = Array.from(patternMap.values());

      await PlatformService.secureSave(
        STORAGE_KEY_PURCHASE_PATTERNS,
        JSON.stringify(unique)
      );
      Logger.info('[PurchaseDataService] Saved purchase patterns', { count: unique.length });
    } catch (error: any) {
      Logger.error('[PurchaseDataService] Failed to save purchase patterns:', error);
      throw new Error(`Failed to save purchase patterns: ${error.message}`);
    }
  },

  /**
   * Gets purchase patterns
   */
  getPurchasePatterns: async (customerId?: string): Promise<PurchasePattern[]> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_PURCHASE_PATTERNS);
      if (!stored) return [];

      let patterns: PurchasePattern[] = JSON.parse(stored);

      if (customerId) {
        patterns = patterns.filter(p => p.customerId === customerId);
      }

      return patterns;
    } catch (error: any) {
      Logger.error('[PurchaseDataService] Failed to get purchase patterns:', error);
      return [];
    }
  },

  /**
   * Updates purchase pattern
   */
  updatePurchasePattern: async (pattern: PurchasePattern): Promise<void> => {
    try {
      const patterns = await PurchaseDataService.getPurchasePatterns();
      const index = patterns.findIndex(
        p => p.customerId === pattern.customerId && 
             p.productDescription === pattern.productDescription
      );

      if (index >= 0) {
        patterns[index] = pattern;
      } else {
        patterns.push(pattern);
      }

      await PlatformService.secureSave(
        STORAGE_KEY_PURCHASE_PATTERNS,
        JSON.stringify(patterns)
      );
    } catch (error: any) {
      Logger.error('[PurchaseDataService] Failed to update purchase pattern:', error);
      throw error;
    }
  },

  /**
   * Saves customer intents
   */
  saveCustomerIntent: async (intent: CustomerIntent): Promise<void> => {
    try {
      const intents = await PurchaseDataService.getCustomerIntents();
      const index = intents.findIndex(i => i.customerId === intent.customerId);

      if (index >= 0) {
        intents[index] = intent;
      } else {
        intents.push(intent);
      }

      await PlatformService.secureSave(
        STORAGE_KEY_CUSTOMER_INTENTS,
        JSON.stringify(intents)
      );
      Logger.info('[PurchaseDataService] Saved customer intent', { customerId: intent.customerId });
    } catch (error: any) {
      Logger.error('[PurchaseDataService] Failed to save customer intent:', error);
      throw new Error(`Failed to save customer intent: ${error.message}`);
    }
  },

  /**
   * Gets customer intents
   */
  getCustomerIntents: async (customerId?: string): Promise<CustomerIntent[]> => {
    try {
      const stored = await PlatformService.secureLoad(STORAGE_KEY_CUSTOMER_INTENTS);
      if (!stored) return [];

      let intents: CustomerIntent[] = JSON.parse(stored);

      if (customerId) {
        intents = intents.filter(i => i.customerId === customerId);
      }

      return intents;
    } catch (error: any) {
      Logger.error('[PurchaseDataService] Failed to get customer intents:', error);
      return [];
    }
  },

  /**
   * Gets customer intent for a specific customer
   */
  getCustomerIntent: async (customerId: string): Promise<CustomerIntent | null> => {
    const intents = await PurchaseDataService.getCustomerIntents(customerId);
    return intents.length > 0 ? intents[0] : null;
  },

  /**
   * Clears all purchase data (for testing or reset)
   */
  clearAllData: async (): Promise<void> => {
    try {
      await PlatformService.secureSave(STORAGE_KEY_PURCHASE_ORDERS, '');
      await PlatformService.secureSave(STORAGE_KEY_PURCHASE_PATTERNS, '');
      await PlatformService.secureSave(STORAGE_KEY_CUSTOMER_INTENTS, '');
      Logger.info('[PurchaseDataService] Cleared all purchase data');
    } catch (error: any) {
      Logger.error('[PurchaseDataService] Failed to clear data:', error);
      throw error;
    }
  },
};

