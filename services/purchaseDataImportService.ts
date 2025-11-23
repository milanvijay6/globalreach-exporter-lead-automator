import { Logger } from './loggerService';
import { PurchaseOrder } from '../types';

export interface ImportResult {
  success: boolean;
  imported: number;
  errors: Array<{ row: number; error: string; data?: any }>;
  warnings: Array<{ row: number; warning: string }>;
}

export interface ColumnMapping {
  exporterName?: string;
  exporterAddress?: string;
  pinCode?: string;
  city?: string;
  state?: string;
  contactNo?: string;
  emailId?: string;
  consigneeName?: string;
  probConsigneeName?: string;
  consigneeAddress?: string;
  portCode?: string;
  foreignPort?: string;
  foreignCountry?: string;
  hsCode?: string;
  chapter?: string;
  productDescription?: string;
  quantity?: string;
  unitQuantity?: string;
  itemRateInFC?: string;
  currency?: string;
  totalValueInFC?: string;
  unitRateUSD?: string;
  exchangeRate?: string;
  totalValueInUSD?: string;
  unitRateInINR?: string;
  fob?: string;
  drawback?: string;
  month?: string;
  year?: string;
  mode?: string;
  indianPort?: string;
  shipmentStatus?: string;
}

/**
 * Purchase Data Import Service
 * Handles CSV/Excel file parsing and validation for purchase order data
 */
export const PurchaseDataImportService = {
  /**
   * Parses CSV file content
   */
  parseCSVFile: async (fileContent: string, hasHeaders: boolean = true): Promise<{
    headers: string[];
    rows: Record<string, string>[];
    errors: string[];
  }> => {
    try {
      const Papa = await import('papaparse');
      
      return new Promise((resolve) => {
        Papa.parse(fileContent, {
          header: hasHeaders,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.trim(),
          transform: (value: string) => value.trim(),
          complete: (results: any) => {
            if (results.errors && results.errors.length > 0) {
              const errorMessages = results.errors.map((e: any) => 
                `Row ${e.row}: ${e.message}`
              );
              resolve({
                headers: hasHeaders ? Object.keys(results.data[0] || {}) : [],
                rows: results.data || [],
                errors: errorMessages,
              });
            } else {
              resolve({
                headers: hasHeaders ? Object.keys(results.data[0] || {}) : [],
                rows: results.data || [],
                errors: [],
              });
            }
          },
          error: (error: any) => {
            resolve({
              headers: [],
              rows: [],
              errors: [error.message || 'CSV parsing failed'],
            });
          },
        });
      });
    } catch (error: any) {
      Logger.error('[PurchaseDataImport] CSV parsing error:', error);
      return {
        headers: [],
        rows: [],
        errors: [error.message || 'Failed to parse CSV file'],
      };
    }
  },

  /**
   * Parses Excel file
   */
  parseExcelFile: async (fileBuffer: Buffer): Promise<{
    headers: string[];
    rows: Record<string, any>[];
    errors: string[];
  }> => {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (data.length === 0) {
        return {
          headers: [],
          rows: [],
          errors: ['Excel file is empty'],
        };
      }

      // First row as headers
      const headers = (data[0] as any[]).map((h: any) => String(h || '').trim()).filter(Boolean);
      const rows: Record<string, any>[] = [];

      // Convert rows to objects
      for (let i = 1; i < data.length; i++) {
        const row = data[i] as any[];
        const rowObj: Record<string, any> = {};
        headers.forEach((header, index) => {
          rowObj[header] = row[index] ? String(row[index]).trim() : '';
        });
        rows.push(rowObj);
      }

      return {
        headers,
        rows,
        errors: [],
      };
    } catch (error: any) {
      Logger.error('[PurchaseDataImport] Excel parsing error:', error);
      return {
        headers: [],
        rows: [],
        errors: [error.message || 'Failed to parse Excel file'],
      };
    }
  },

  /**
   * Maps CSV/Excel columns to PurchaseOrder fields
   */
  mapToPurchaseOrder: (
    row: Record<string, any>,
    columnMapping: ColumnMapping,
    rowNumber: number
  ): { order: PurchaseOrder | null; errors: string[] } => {
    const errors: string[] = [];

    // Helper to get value from row
    const getValue = (columnName?: string): string => {
      if (!columnName) return '';
      const value = row[columnName];
      return value ? String(value).trim() : '';
    };

    // Helper to parse number
    const parseNumber = (value: string, fieldName: string): number => {
      if (!value) return 0;
      const num = parseFloat(value.replace(/[^\d.-]/g, ''));
      if (isNaN(num)) {
        errors.push(`${fieldName} is not a valid number: ${value}`);
        return 0;
      }
      return num;
    };

    // Helper to parse date from month/year
    const parseDate = (month: string, year: string): number => {
      const monthNum = parseInt(month) || 1;
      const yearNum = parseInt(year) || new Date().getFullYear();
      if (monthNum < 1 || monthNum > 12) {
        errors.push(`Invalid month: ${month}`);
        return Date.now();
      }
      if (yearNum < 2000 || yearNum > 2100) {
        errors.push(`Invalid year: ${year}`);
        return Date.now();
      }
      return new Date(yearNum, monthNum - 1, 1).getTime();
    };

    // Required fields validation
    const exporterName = getValue(columnMapping.exporterName);
    const contactNo = getValue(columnMapping.contactNo);
    const emailId = getValue(columnMapping.emailId);
    const productDescription = getValue(columnMapping.productDescription);

    if (!exporterName) errors.push('Exporter name is required');
    if (!contactNo && !emailId) errors.push('Contact number or email is required');
    if (!productDescription) errors.push('Product description is required');

    if (errors.length > 0) {
      return { order: null, errors };
    }

    // Parse all fields
    const month = getValue(columnMapping.month);
    const year = getValue(columnMapping.year);
    const orderDate = parseDate(month, year);

    const order: PurchaseOrder = {
      id: `order-${Date.now()}-${rowNumber}`,
      exporterName,
      exporterAddress: getValue(columnMapping.exporterAddress),
      pinCode: getValue(columnMapping.pinCode),
      city: getValue(columnMapping.city),
      state: getValue(columnMapping.state),
      contactNo,
      emailId,
      consigneeName: getValue(columnMapping.consigneeName),
      probConsigneeName: getValue(columnMapping.probConsigneeName),
      consigneeAddress: getValue(columnMapping.consigneeAddress),
      portCode: getValue(columnMapping.portCode),
      foreignPort: getValue(columnMapping.foreignPort),
      foreignCountry: getValue(columnMapping.foreignCountry),
      indianPort: getValue(columnMapping.indianPort),
      mode: getValue(columnMapping.mode),
      shipmentStatus: getValue(columnMapping.shipmentStatus),
      hsCode: getValue(columnMapping.hsCode),
      chapter: getValue(columnMapping.chapter),
      productDescription,
      quantity: parseNumber(getValue(columnMapping.quantity), 'Quantity'),
      unitQuantity: getValue(columnMapping.unitQuantity),
      itemRateInFC: parseNumber(getValue(columnMapping.itemRateInFC), 'Item Rate (FC)'),
      currency: getValue(columnMapping.currency) || 'USD',
      totalValueInFC: parseNumber(getValue(columnMapping.totalValueInFC), 'Total Value (FC)'),
      unitRateUSD: parseNumber(getValue(columnMapping.unitRateUSD), 'Unit Rate (USD)'),
      exchangeRate: parseNumber(getValue(columnMapping.exchangeRate), 'Exchange Rate'),
      totalValueInUSD: parseNumber(getValue(columnMapping.totalValueInUSD), 'Total Value (USD)'),
      unitRateInINR: parseNumber(getValue(columnMapping.unitRateInINR), 'Unit Rate (INR)'),
      fob: parseNumber(getValue(columnMapping.fob), 'FOB'),
      drawback: columnMapping.drawback ? parseNumber(getValue(columnMapping.drawback), 'Drawback') : undefined,
      month: parseInt(month) || new Date().getMonth() + 1,
      year: parseInt(year) || new Date().getFullYear(),
      orderDate,
      importedAt: Date.now(),
    };

    return { order, errors };
  },

  /**
   * Validates purchase data
   */
  validatePurchaseData: (order: PurchaseOrder): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!order.exporterName) errors.push('Exporter name is required');
    if (!order.contactNo && !order.emailId) errors.push('Contact number or email is required');
    if (!order.productDescription) errors.push('Product description is required');
    if (order.quantity <= 0) errors.push('Quantity must be greater than 0');
    if (order.month < 1 || order.month > 12) errors.push('Month must be between 1 and 12');
    if (order.year < 2000 || order.year > 2100) errors.push('Year must be between 2000 and 2100');

    // Email validation if provided
    if (order.emailId && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(order.emailId)) {
      errors.push('Invalid email format');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Imports purchase orders from parsed data
   */
  importPurchaseOrders: async (
    rows: Record<string, any>[],
    columnMapping: ColumnMapping
  ): Promise<ImportResult> => {
    const result: ImportResult = {
      success: true,
      imported: 0,
      errors: [],
      warnings: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNumber = i + 2; // +2 because row 1 is header, and arrays are 0-indexed

      try {
        const { order, errors: mappingErrors } = PurchaseDataImportService.mapToPurchaseOrder(
          row,
          columnMapping,
          rowNumber
        );

        if (mappingErrors.length > 0) {
          result.errors.push({
            row: rowNumber,
            error: mappingErrors.join('; '),
            data: row,
          });
          continue;
        }

        if (!order) {
          result.errors.push({
            row: rowNumber,
            error: 'Failed to map row data',
            data: row,
          });
          continue;
        }

        // Validate the order
        const validation = PurchaseDataImportService.validatePurchaseData(order);
        if (!validation.valid) {
          result.errors.push({
            row: rowNumber,
            error: validation.errors.join('; '),
            data: row,
          });
          continue;
        }

        // Save the order (will be handled by purchaseDataService)
        result.imported++;
      } catch (error: any) {
        result.errors.push({
          row: rowNumber,
          error: error.message || 'Unknown error',
          data: row,
        });
      }
    }

    result.success = result.errors.length === 0 || result.imported > 0;
    Logger.info('[PurchaseDataImport] Import completed', {
      imported: result.imported,
      errors: result.errors.length,
      warnings: result.warnings.length,
    });

    return result;
  },

  /**
   * Auto-detects column mapping from headers
   */
  autoDetectColumnMapping: (headers: string[]): ColumnMapping => {
    const mapping: ColumnMapping = {};
    const headerLower = headers.map(h => h.toLowerCase().trim());

    // Map common column name variations
    const findHeader = (variations: string[]): string | undefined => {
      for (const variation of variations) {
        const index = headerLower.findIndex(h => h.includes(variation));
        if (index >= 0) return headers[index];
      }
      return undefined;
    };

    mapping.exporterName = findHeader(['exporter', 'exportername', 'exporter_name', 'name']);
    mapping.exporterAddress = findHeader(['exporteraddress', 'exporter_address', 'address']);
    mapping.pinCode = findHeader(['pincode', 'pin_code', 'pin', 'postal']);
    mapping.city = findHeader(['city']);
    mapping.state = findHeader(['state']);
    mapping.contactNo = findHeader(['contact', 'contactno', 'contact_no', 'phone', 'mobile']);
    mapping.emailId = findHeader(['email', 'emailid', 'email_id', 'e-mail']);
    mapping.consigneeName = findHeader(['consignee', 'consigneename', 'consignee_name']);
    mapping.probConsigneeName = findHeader(['prob', 'probconsignee', 'prob_consignee']);
    mapping.consigneeAddress = findHeader(['consigneeaddress', 'consignee_address']);
    mapping.portCode = findHeader(['portcode', 'port_code', 'port']);
    mapping.foreignPort = findHeader(['foreignport', 'foreign_port', 'destination']);
    mapping.foreignCountry = findHeader(['foreigncountry', 'foreign_country', 'country']);
    mapping.hsCode = findHeader(['hscode', 'hs_code', 'hs']);
    mapping.chapter = findHeader(['chapter']);
    mapping.productDescription = findHeader(['product', 'productdescription', 'product_description', 'description', 'item']);
    mapping.quantity = findHeader(['quantity', 'qty']);
    mapping.unitQuantity = findHeader(['unit', 'unitquantity', 'unit_quantity']);
    mapping.itemRateInFC = findHeader(['itemrate', 'item_rate', 'rate', 'price']);
    mapping.currency = findHeader(['currency', 'curr']);
    mapping.totalValueInFC = findHeader(['totalvalue', 'total_value', 'total']);
    mapping.unitRateUSD = findHeader(['unitrateusd', 'unit_rate_usd', 'usd']);
    mapping.exchangeRate = findHeader(['exchangerate', 'exchange_rate', 'rate']);
    mapping.totalValueInUSD = findHeader(['totalvalueusd', 'total_value_usd']);
    mapping.unitRateInINR = findHeader(['unitrateinr', 'unit_rate_inr', 'inr']);
    mapping.fob = findHeader(['fob']);
    mapping.drawback = findHeader(['drawback']);
    mapping.month = findHeader(['month']);
    mapping.year = findHeader(['year']);
    mapping.mode = findHeader(['mode', 'transport']);
    mapping.indianPort = findHeader(['indianport', 'indian_port', 'origin']);
    mapping.shipmentStatus = findHeader(['status', 'shipmentstatus', 'shipment_status']);

    return mapping;
  },
};

