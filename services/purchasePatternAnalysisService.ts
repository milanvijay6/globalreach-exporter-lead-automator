import { Logger } from './loggerService';
import { PurchaseOrder, PurchasePattern, PurchaseCycle } from '../types';

/**
 * Purchase Pattern Analysis Service
 * Analyzes purchase history to identify patterns, cycles, and trends
 */
export const PurchasePatternAnalysisService = {
  /**
   * Analyzes purchase patterns for all customers
   */
  analyzeAllCustomerPatterns: (orders: PurchaseOrder[]): PurchasePattern[] => {
    // Group orders by customer (using contactNo or emailId as identifier)
    const customerOrders = new Map<string, PurchaseOrder[]>();

    for (const order of orders) {
      const customerId = PurchasePatternAnalysisService.getCustomerId(order);
      if (!customerId) continue;

      if (!customerOrders.has(customerId)) {
        customerOrders.set(customerId, []);
      }
      customerOrders.get(customerId)!.push(order);
    }

    const patterns: PurchasePattern[] = [];

    for (const [customerId, customerOrderList] of customerOrders.entries()) {
      // Sort by date
      customerOrderList.sort((a, b) => a.orderDate - b.orderDate);

      // Analyze patterns per product
      const productGroups = new Map<string, PurchaseOrder[]>();
      for (const order of customerOrderList) {
        const productKey = order.productDescription.toLowerCase().trim();
        if (!productGroups.has(productKey)) {
          productGroups.set(productKey, []);
        }
        productGroups.get(productKey)!.push(order);
      }

      // Create pattern for each product
      for (const [productKey, productOrders] of productGroups.entries()) {
        if (productOrders.length < 1) continue;

        const pattern = PurchasePatternAnalysisService.analyzeProductPattern(
          customerId,
          customerOrderList[0].exporterName,
          productOrders
        );
        if (pattern) {
          patterns.push(pattern);
        }
      }
    }

    return patterns;
  },

  /**
   * Analyzes purchase pattern for a specific product and customer
   */
  analyzeProductPattern: (
    customerId: string,
    customerName: string,
    orders: PurchaseOrder[]
  ): PurchasePattern | null => {
    if (orders.length === 0) return null;

    // Sort by date
    const sortedOrders = [...orders].sort((a, b) => a.orderDate - b.orderDate);

    // Calculate average quantity and value
    const totalQuantity = sortedOrders.reduce((sum, o) => sum + o.quantity, 0);
    const totalValue = sortedOrders.reduce((sum, o) => sum + o.totalValueInUSD, 0);
    const averageQuantity = totalQuantity / sortedOrders.length;
    const averageValue = totalValue / sortedOrders.length;

    // Calculate purchase frequency (average days between orders)
    let purchaseFrequency = 0;
    if (sortedOrders.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < sortedOrders.length; i++) {
        const daysDiff = (sortedOrders[i].orderDate - sortedOrders[i - 1].orderDate) / (1000 * 60 * 60 * 24);
        intervals.push(daysDiff);
      }
      purchaseFrequency = intervals.reduce((sum, d) => sum + d, 0) / intervals.length;
    }

    // Detect purchase cycle
    const purchaseCycle = PurchasePatternAnalysisService.detectPurchaseCycle(purchaseFrequency);

    // Predict next purchase date
    const lastPurchaseDate = sortedOrders[sortedOrders.length - 1].orderDate;
    const nextPredictedDate = lastPurchaseDate + (purchaseFrequency * 24 * 60 * 60 * 1000);

    // Find related products (products bought in same orders or close dates)
    const relatedProducts = PurchasePatternAnalysisService.findRelatedProducts(
      sortedOrders,
      orders
    );

    const firstOrder = sortedOrders[0];
    const pattern: PurchasePattern = {
      customerId,
      customerName,
      productCategory: firstOrder.chapter || 'Unknown',
      productDescription: firstOrder.productDescription,
      averageQuantity,
      averageValue,
      purchaseFrequency: Math.round(purchaseFrequency),
      lastPurchaseDate,
      nextPredictedDate,
      purchaseCycle,
      totalOrders: sortedOrders.length,
      totalSpend: totalValue,
      firstPurchaseDate: firstOrder.orderDate,
      relatedProducts: relatedProducts.length > 0 ? relatedProducts : undefined,
    };

    return pattern;
  },

  /**
   * Detects purchase cycle type from frequency
   */
  detectPurchaseCycle: (frequencyDays: number): PurchaseCycle => {
    if (frequencyDays <= 0) return PurchaseCycle.IRREGULAR;

    if (frequencyDays <= 10) {
      return PurchaseCycle.WEEKLY;
    } else if (frequencyDays <= 35) {
      return PurchaseCycle.MONTHLY;
    } else if (frequencyDays <= 100) {
      return PurchaseCycle.QUARTERLY;
    } else if (frequencyDays <= 180) {
      return PurchaseCycle.SEASONAL;
    } else {
      return PurchaseCycle.IRREGULAR;
    }
  },

  /**
   * Calculates average metrics for a product category
   */
  calculateAverageMetrics: (
    orders: PurchaseOrder[],
    productCategory?: string
  ): {
    averageQuantity: number;
    averageValue: number;
    averageOrderValue: number;
  } => {
    const filteredOrders = productCategory
      ? orders.filter(o => o.chapter === productCategory)
      : orders;

    if (filteredOrders.length === 0) {
      return {
        averageQuantity: 0,
        averageValue: 0,
        averageOrderValue: 0,
      };
    }

    const totalQuantity = filteredOrders.reduce((sum, o) => sum + o.quantity, 0);
    const totalValue = filteredOrders.reduce((sum, o) => sum + o.totalValueInUSD, 0);

    return {
      averageQuantity: totalQuantity / filteredOrders.length,
      averageValue: totalValue / filteredOrders.length,
      averageOrderValue: totalValue / filteredOrders.length,
    };
  },

  /**
   * Identifies top products per customer
   */
  identifyTopProducts: (
    orders: PurchaseOrder[],
    topN: number = 5
  ): Array<{ product: string; orderCount: number; totalQuantity: number; totalValue: number }> => {
    const productStats = new Map<string, {
      orderCount: number;
      totalQuantity: number;
      totalValue: number;
    }>();

    for (const order of orders) {
      const product = order.productDescription.toLowerCase().trim();
      if (!productStats.has(product)) {
        productStats.set(product, {
          orderCount: 0,
          totalQuantity: 0,
          totalValue: 0,
        });
      }

      const stats = productStats.get(product)!;
      stats.orderCount++;
      stats.totalQuantity += order.quantity;
      stats.totalValue += order.totalValueInUSD;
    }

    return Array.from(productStats.entries())
      .map(([product, stats]) => ({
        product,
        ...stats,
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, topN);
  },

  /**
   * Finds products frequently bought together
   */
  findRelatedProducts: (
    productOrders: PurchaseOrder[],
    allOrders: PurchaseOrder[]
  ): string[] => {
    const relatedProducts = new Map<string, number>();
    const productDates = new Set(productOrders.map(o => o.orderDate));

    // Find orders from same customer within 30 days
    for (const order of allOrders) {
      if (productOrders.some(po => po.id === order.id)) continue; // Skip same order

      const customerId = PurchasePatternAnalysisService.getCustomerId(order);
      const productCustomerId = PurchasePatternAnalysisService.getCustomerId(productOrders[0]);

      if (customerId !== productCustomerId) continue;

      // Check if order is within 30 days of any product order
      const isClose = Array.from(productDates).some(date => {
        const daysDiff = Math.abs((order.orderDate - date) / (1000 * 60 * 60 * 24));
        return daysDiff <= 30;
      });

      if (isClose) {
        const product = order.productDescription.toLowerCase().trim();
        relatedProducts.set(product, (relatedProducts.get(product) || 0) + 1);
      }
    }

    // Return top 3 related products
    return Array.from(relatedProducts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([product]) => product);
  },

  /**
   * Detects dormant customers (no orders beyond typical cycle)
   */
  detectDormantCustomers: (
    patterns: PurchasePattern[],
    thresholdMultiplier: number = 1.5
  ): PurchasePattern[] => {
    const now = Date.now();
    const dormant: PurchasePattern[] = [];

    for (const pattern of patterns) {
      const daysSinceLastOrder = (now - pattern.lastPurchaseDate) / (1000 * 60 * 60 * 24);
      const threshold = pattern.purchaseFrequency * thresholdMultiplier;

      if (daysSinceLastOrder > threshold) {
        dormant.push(pattern);
      }
    }

    return dormant;
  },

  /**
   * Gets customer ID from order (contactNo or emailId)
   */
  getCustomerId: (order: PurchaseOrder): string | null => {
    if (order.contactNo) {
      return `contact-${order.contactNo.replace(/\s+/g, '')}`;
    }
    if (order.emailId) {
      return `email-${order.emailId.toLowerCase()}`;
    }
    return null;
  },

  /**
   * Gets all orders for a customer
   */
  getCustomerOrders: (orders: PurchaseOrder[], customerId: string): PurchaseOrder[] => {
    return orders.filter(order => {
      const orderCustomerId = PurchasePatternAnalysisService.getCustomerId(order);
      return orderCustomerId === customerId;
    });
  },
};

