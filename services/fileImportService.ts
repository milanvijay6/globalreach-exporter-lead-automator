import { Logger } from './loggerService';
import { Importer, LeadStatus, Product, ProductPrice } from '../types';
import { getInitialValidationState, validateContactFormat } from './validationService';

export interface FileParseResult {
  success: boolean;
  data: Importer[];
  errors: string[];
}

/**
 * File Import Service
 * Handles parsing of Excel, CSV, and PDF files for lead import
 */
export const FileImportService = {
  /**
   * Parses Excel file (.xlsx, .xls)
   */
  parseExcelFile: async (file: File): Promise<FileParseResult> => {
    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      if (workbook.SheetNames.length === 0) {
        return {
          success: false,
          data: [],
          errors: ['Excel file has no sheets'],
        };
      }

      // Use first sheet
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      
      // Convert to JSON with header row
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (jsonData.length === 0) {
        return {
          success: false,
          data: [],
          errors: ['Excel file is empty'],
        };
      }

      // First row as headers, try to detect column positions
      const headers = (jsonData[0] as any[]).map((h: any) => String(h || '').trim().toLowerCase());
      
      // Auto-detect column indices
      const nameIdx = headers.findIndex(h => h.includes('name') && !h.includes('company'));
      const companyIdx = headers.findIndex(h => h.includes('company') || h.includes('organisation') || h.includes('org'));
      const countryIdx = headers.findIndex(h => h.includes('country') || h.includes('nation'));
      const contactIdx = headers.findIndex(h => h.includes('contact') || h.includes('phone') || h.includes('email') || h.includes('mobile'));
      const productIdx = headers.findIndex(h => h.includes('product') || h.includes('item') || h.includes('goods'));
      const quantityIdx = headers.findIndex(h => h.includes('quantity') || h.includes('qty') || h.includes('amount'));
      const priceIdx = headers.findIndex(h => h.includes('price') || h.includes('cost') || h.includes('value') || h.includes('rate'));

      const importers: Importer[] = [];
      const errors: string[] = [];

      // Parse rows (skip header row)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        try {
          const name = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : `Importer ${i}`;
          const companyName = companyIdx >= 0 ? String(row[companyIdx] || '').trim() : 'Unknown Co';
          const country = countryIdx >= 0 ? String(row[countryIdx] || '').trim() : 'Unknown';
          const contactDetail = contactIdx >= 0 ? String(row[contactIdx] || '').trim() : '';
          const productsImported = productIdx >= 0 ? String(row[productIdx] || '').trim() : 'General Goods';
          const quantity = quantityIdx >= 0 ? String(row[quantityIdx] || '').trim() : '-';
          const priceRange = priceIdx >= 0 ? String(row[priceIdx] || '').trim() : '-';

          const { channel } = validateContactFormat(contactDetail);
          const validation = getInitialValidationState(contactDetail);

          importers.push({
            id: `imported-${Date.now()}-${i}`,
            name,
            companyName,
            country,
            contactDetail,
            productsImported,
            quantity,
            priceRange,
            status: LeadStatus.PENDING,
            chatHistory: [],
            activityLog: [{
              id: `log-init-${i}`,
              timestamp: Date.now(),
              type: 'system',
              description: 'Lead imported via Excel file'
            }],
            preferredChannel: channel,
            validation
          });
        } catch (error: any) {
          errors.push(`Row ${i + 1}: ${error.message || 'Failed to parse row'}`);
        }
      }

      return {
        success: importers.length > 0,
        data: importers,
        errors,
      };
    } catch (error: any) {
      Logger.error('[FileImportService] Excel parsing error:', error);
      return {
        success: false,
        data: [],
        errors: [error.message || 'Failed to parse Excel file'],
      };
    }
  },

  /**
   * Parses CSV file
   */
  parseCSVFile: async (file: File): Promise<FileParseResult> => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim().length > 0);
      
      if (lines.length === 0) {
        return {
          success: false,
          data: [],
          errors: ['CSV file is empty'],
        };
      }

      // Use PapaParse for better CSV parsing (handles quotes, commas in values, etc.)
      const Papa = await import('papaparse');
      
      return new Promise((resolve) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.trim().toLowerCase(),
          complete: (results: any) => {
            const importers: Importer[] = [];
            const errors: string[] = [];

            const rows = results.data || [];
            rows.forEach((row: any, index: number) => {
              try {
                // Auto-detect column names (case-insensitive)
                const name = row.name || row['importer name'] || row['customer name'] || `Importer ${index + 1}`;
                const companyName = row.company || row['company name'] || row['organisation'] || row['org'] || 'Unknown Co';
                const country = row.country || row['nation'] || 'Unknown';
                const contactDetail = row.contact || row['phone'] || row['email'] || row['mobile'] || row['contact detail'] || '';
                const productsImported = row.product || row['products'] || row['item'] || row['goods'] || 'General Goods';
                const quantity = row.quantity || row['qty'] || row['amount'] || '-';
                const priceRange = row.price || row['cost'] || row['value'] || row['rate'] || '-';

                const { channel } = validateContactFormat(contactDetail);
                const validation = getInitialValidationState(contactDetail);

                importers.push({
                  id: `imported-${Date.now()}-${index}`,
                  name: String(name).trim(),
                  companyName: String(companyName).trim(),
                  country: String(country).trim(),
                  contactDetail: String(contactDetail).trim(),
                  productsImported: String(productsImported).trim(),
                  quantity: String(quantity).trim(),
                  priceRange: String(priceRange).trim(),
                  status: LeadStatus.PENDING,
                  chatHistory: [],
                  activityLog: [{
                    id: `log-init-${index}`,
                    timestamp: Date.now(),
                    type: 'system',
                    description: 'Lead imported via CSV file'
                  }],
                  preferredChannel: channel,
                  validation
                });
              } catch (error: any) {
                errors.push(`Row ${index + 2}: ${error.message || 'Failed to parse row'}`);
              }
            });

            resolve({
              success: importers.length > 0,
              data: importers,
              errors,
            });
          },
          error: (error: any) => {
            resolve({
              success: false,
              data: [],
              errors: [error.message || 'Failed to parse CSV file'],
            });
          },
        });
      });
    } catch (error: any) {
      Logger.error('[FileImportService] CSV parsing error:', error);
      return {
        success: false,
        data: [],
        errors: [error.message || 'Failed to parse CSV file'],
      };
    }
  },

  /**
   * Parses PDF file (extracts text and attempts to parse tabular data)
   * Note: PDF parsing is limited - works best with structured tables
   */
  parsePDFFile: async (file: File): Promise<FileParseResult> => {
    try {
      // For PDF, we'll use a simple approach: extract text and try to parse
      // Note: Full PDF parsing requires pdfjs-dist or similar library
      // For now, we'll show a helpful error message
      return {
        success: false,
        data: [],
        errors: [
          'PDF parsing is currently not supported. Please convert your PDF to Excel (.xlsx) or CSV format first.',
          'You can export PDF tables to Excel using:',
          '1. Open PDF in Excel (if it has tables)',
          '2. Use online PDF to Excel converters',
          '3. Copy table data from PDF and paste as CSV'
        ],
      };
    } catch (error: any) {
      Logger.error('[FileImportService] PDF parsing error:', error);
      return {
        success: false,
        data: [],
        errors: [error.message || 'Failed to parse PDF file'],
      };
    }
  },

  /**
   * Determines file type and parses accordingly
   */
  parseFile: async (file: File): Promise<FileParseResult> => {
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop()?.toLowerCase();

    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      return FileImportService.parseExcelFile(file);
    } else if (fileExtension === 'csv') {
      return FileImportService.parseCSVFile(file);
    } else if (fileExtension === 'pdf') {
      return FileImportService.parsePDFFile(file);
    } else {
      return {
        success: false,
        data: [],
        errors: [`Unsupported file type: .${fileExtension}. Supported formats: .xlsx, .xls, .csv`],
      };
    }
  },

  /**
   * Product Import Result
   */
  parseProductsFromFile: async (file: File): Promise<{ success: boolean; products: Partial<Product>[]; errors: string[] }> => {
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      return FileImportService.parseProductsFromExcel(file);
    } else if (fileExtension === 'csv') {
      return FileImportService.parseProductsFromCSV(file);
    } else {
      return {
        success: false,
        products: [],
        errors: [`Unsupported file type: .${fileExtension}. Supported formats: .xlsx, .xls, .csv`],
      };
    }
  },

  /**
   * Parses products from Excel file
   */
  parseProductsFromExcel: async (file: File): Promise<{ success: boolean; products: Partial<Product>[]; errors: string[] }> => {
    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      if (workbook.SheetNames.length === 0) {
        return {
          success: false,
          products: [],
          errors: ['Excel file has no sheets'],
        };
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (jsonData.length === 0) {
        return {
          success: false,
          products: [],
          errors: ['Excel file is empty'],
        };
      }

      const headers = (jsonData[0] as any[]).map((h: any) => String(h || '').trim().toLowerCase());
      const nameIdx = headers.findIndex(h => h.includes('name') && !h.includes('product'));
      const categoryIdx = headers.findIndex(h => h.includes('category'));
      const shortDescIdx = headers.findIndex(h => h.includes('short') && h.includes('description'));
      const fullDescIdx = headers.findIndex(h => h.includes('full') && h.includes('description'));
      const tagsIdx = headers.findIndex(h => h.includes('tag'));
      const specsIdx = headers.findIndex(h => h.includes('specification'));
      const activeIdx = headers.findIndex(h => h.includes('active'));

      const products: Partial<Product>[] = [];
      const errors: string[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        try {
          const name = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : '';
          if (!name) {
            errors.push(`Row ${i + 1}: Product name is required`);
            continue;
          }

          const category = categoryIdx >= 0 ? String(row[categoryIdx] || '').trim() : 'Uncategorized';
          const shortDescription = shortDescIdx >= 0 ? String(row[shortDescIdx] || '').trim() : '';
          const fullDescription = fullDescIdx >= 0 ? String(row[fullDescIdx] || '').trim() : undefined;
          
          let tags: string[] = [];
          if (tagsIdx >= 0 && row[tagsIdx]) {
            const tagsStr = String(row[tagsIdx] || '').trim();
            tags = tagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0);
          }

          let specifications: Record<string, string> = {};
          if (specsIdx >= 0 && row[specsIdx]) {
            try {
              const specsStr = String(row[specsIdx] || '').trim();
              specifications = JSON.parse(specsStr);
            } catch {
              // If not JSON, try parsing as key-value pairs
              const specsStr = String(row[specsIdx] || '').trim();
              if (specsStr) {
                specsStr.split(';').forEach(pair => {
                  const [key, value] = pair.split(':').map(s => s.trim());
                  if (key && value) specifications[key] = value;
                });
              }
            }
          }

          const active = activeIdx >= 0 ? String(row[activeIdx] || '').toLowerCase() !== 'no' : true;

          products.push({
            name,
            category,
            shortDescription,
            fullDescription,
            tags,
            specifications,
            active,
          });
        } catch (error: any) {
          errors.push(`Row ${i + 1}: ${error.message || 'Failed to parse row'}`);
        }
      }

      return {
        success: products.length > 0,
        products,
        errors,
      };
    } catch (error: any) {
      Logger.error('[FileImportService] Product Excel parsing error:', error);
      return {
        success: false,
        products: [],
        errors: [error.message || 'Failed to parse Excel file'],
      };
    }
  },

  /**
   * Parses products from CSV file
   */
  parseProductsFromCSV: async (file: File): Promise<{ success: boolean; products: Partial<Product>[]; errors: string[] }> => {
    try {
      const text = await file.text();
      const Papa = await import('papaparse');
      
      return new Promise((resolve) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.trim().toLowerCase(),
          complete: (results: any) => {
            const products: Partial<Product>[] = [];
            const errors: string[] = [];

            const rows = results.data || [];
            rows.forEach((row: any, index: number) => {
              try {
                const name = row.name || row['product name'] || '';
                if (!name || name.trim().length === 0) {
                  errors.push(`Row ${index + 2}: Product name is required`);
                  return;
                }

                const category = row.category || 'Uncategorized';
                const shortDescription = row['short description'] || row.shortdescription || row.description || '';
                const fullDescription = row['full description'] || row.fulldescription || undefined;
                
                let tags: string[] = [];
                if (row.tags) {
                  const tagsStr = String(row.tags).trim();
                  tags = tagsStr.split(',').map((t: string) => t.trim()).filter((t: string) => t.length > 0);
                }

                let specifications: Record<string, string> = {};
                if (row.specifications || row.specs) {
                  try {
                    const specsStr = String(row.specifications || row.specs).trim();
                    specifications = JSON.parse(specsStr);
                  } catch {
                    const specsStr = String(row.specifications || row.specs).trim();
                    if (specsStr) {
                      specsStr.split(';').forEach((pair: string) => {
                        const [key, value] = pair.split(':').map(s => s.trim());
                        if (key && value) specifications[key] = value;
                      });
                    }
                  }
                }

                const active = row.active ? String(row.active).toLowerCase() !== 'no' : true;

                products.push({
                  name: String(name).trim(),
                  category: String(category).trim(),
                  shortDescription: String(shortDescription).trim(),
                  fullDescription: fullDescription ? String(fullDescription).trim() : undefined,
                  tags,
                  specifications,
                  active,
                });
              } catch (error: any) {
                errors.push(`Row ${index + 2}: ${error.message || 'Failed to parse row'}`);
              }
            });

            resolve({
              success: products.length > 0,
              products,
              errors,
            });
          },
          error: (error: any) => {
            resolve({
              success: false,
              products: [],
              errors: [error.message || 'Failed to parse CSV file'],
            });
          },
        });
      });
    } catch (error: any) {
      Logger.error('[FileImportService] Product CSV parsing error:', error);
      return {
        success: false,
        products: [],
        errors: [error.message || 'Failed to parse CSV file'],
      };
    }
  },

  /**
   * Price Import Result
   */
  parsePricesFromFile: async (file: File, products: Product[]): Promise<{ success: boolean; prices: Partial<ProductPrice>[]; errors: string[] }> => {
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      return FileImportService.parsePricesFromExcel(file, products);
    } else if (fileExtension === 'csv') {
      return FileImportService.parsePricesFromCSV(file, products);
    } else {
      return {
        success: false,
        prices: [],
        errors: [`Unsupported file type: .${fileExtension}. Supported formats: .xlsx, .xls, .csv`],
      };
    }
  },

  /**
   * Parses prices from Excel file
   */
  parsePricesFromExcel: async (file: File, products: Product[]): Promise<{ success: boolean; prices: Partial<ProductPrice>[]; errors: string[] }> => {
    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      
      if (workbook.SheetNames.length === 0) {
        return {
          success: false,
          prices: [],
          errors: ['Excel file has no sheets'],
        };
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      
      if (jsonData.length === 0) {
        return {
          success: false,
          prices: [],
          errors: ['Excel file is empty'],
        };
      }

      const headers = (jsonData[0] as any[]).map((h: any) => String(h || '').trim().toLowerCase());
      const productNameIdx = headers.findIndex(h => h.includes('product') && (h.includes('name') || h.includes('name')));
      const productIdIdx = headers.findIndex(h => h.includes('product') && h.includes('id'));
      const unitIdx = headers.findIndex(h => h.includes('unit') || h.includes('uom'));
      const basePriceIdx = headers.findIndex(h => h.includes('base') && h.includes('price'));
      const wholesaleIdx = headers.findIndex(h => h.includes('wholesale'));
      const retailIdx = headers.findIndex(h => h.includes('retail'));
      const specialIdx = headers.findIndex(h => h.includes('special'));
      const currencyIdx = headers.findIndex(h => h.includes('currency'));
      const effectiveDateIdx = headers.findIndex(h => h.includes('effective') || h.includes('date'));
      const activeIdx = headers.findIndex(h => h.includes('active'));
      const notesIdx = headers.findIndex(h => h.includes('note'));

      const prices: Partial<ProductPrice>[] = [];
      const errors: string[] = [];

      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as any[];
        if (!row || row.length === 0) continue;

        try {
          const productName = productNameIdx >= 0 ? String(row[productNameIdx] || '').trim() : '';
          const productId = productIdIdx >= 0 ? String(row[productIdIdx] || '').trim() : '';
          
          if (!productName && !productId) {
            errors.push(`Row ${i + 1}: Product name or ID is required`);
            continue;
          }

          // Find product by name or ID
          const product = products.find(p => 
            p.id === productId || 
            p.name.toLowerCase() === productName.toLowerCase()
          );

          if (!product) {
            errors.push(`Row ${i + 1}: Product "${productName || productId}" not found in catalog`);
            continue;
          }

          const unitOfMeasure = unitIdx >= 0 ? String(row[unitIdx] || '').trim() : 'piece';
          const basePrice = basePriceIdx >= 0 ? parseFloat(String(row[basePriceIdx] || 0)) : 0;
          
          if (isNaN(basePrice) || basePrice < 0) {
            errors.push(`Row ${i + 1}: Invalid base price`);
            continue;
          }

          const wholesalePrice = wholesaleIdx >= 0 ? parseFloat(String(row[wholesaleIdx] || '')) : undefined;
          const retailPrice = retailIdx >= 0 ? parseFloat(String(row[retailIdx] || '')) : undefined;
          const specialPrice = specialIdx >= 0 ? parseFloat(String(row[specialIdx] || '')) : undefined;
          const currency = currencyIdx >= 0 ? String(row[currencyIdx] || '').trim().toUpperCase() : 'USD';
          const active = activeIdx >= 0 ? String(row[activeIdx] || '').toLowerCase() !== 'no' : true;
          const notes = notesIdx >= 0 ? String(row[notesIdx] || '').trim() : undefined;

          let effectiveDate = Date.now();
          if (effectiveDateIdx >= 0 && row[effectiveDateIdx]) {
            const dateStr = String(row[effectiveDateIdx]);
            const parsed = new Date(dateStr);
            if (!isNaN(parsed.getTime())) {
              effectiveDate = parsed.getTime();
            }
          }

          prices.push({
            productId: product.id,
            productName: product.name,
            unitOfMeasure,
            basePrice,
            wholesalePrice: isNaN(wholesalePrice!) ? undefined : wholesalePrice,
            retailPrice: isNaN(retailPrice!) ? undefined : retailPrice,
            specialCustomerPrice: isNaN(specialPrice!) ? undefined : specialPrice,
            currency,
            effectiveDate,
            active,
            notes,
          });
        } catch (error: any) {
          errors.push(`Row ${i + 1}: ${error.message || 'Failed to parse row'}`);
        }
      }

      return {
        success: prices.length > 0,
        prices,
        errors,
      };
    } catch (error: any) {
      Logger.error('[FileImportService] Price Excel parsing error:', error);
      return {
        success: false,
        prices: [],
        errors: [error.message || 'Failed to parse Excel file'],
      };
    }
  },

  /**
   * Parses prices from CSV file
   */
  parsePricesFromCSV: async (file: File, products: Product[]): Promise<{ success: boolean; prices: Partial<ProductPrice>[]; errors: string[] }> => {
    try {
      const text = await file.text();
      const Papa = await import('papaparse');
      
      return new Promise((resolve) => {
        Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (header: string) => header.trim().toLowerCase(),
          complete: (results: any) => {
            const prices: Partial<ProductPrice>[] = [];
            const errors: string[] = [];

            const rows = results.data || [];
            rows.forEach((row: any, index: number) => {
              try {
                const productName = row['product name'] || row.productname || row.product || '';
                const productId = row['product id'] || row.productid || row['product id'] || '';
                
                if (!productName && !productId) {
                  errors.push(`Row ${index + 2}: Product name or ID is required`);
                  return;
                }

                const product = products.find(p => 
                  p.id === productId || 
                  p.name.toLowerCase() === productName.toLowerCase()
                );

                if (!product) {
                  errors.push(`Row ${index + 2}: Product "${productName || productId}" not found in catalog`);
                  return;
                }

                const unitOfMeasure = row['unit of measure'] || row.unitofmeasure || row.unit || row.uom || 'piece';
                const basePrice = parseFloat(row['base price'] || row.baseprice || row.price || 0);
                
                if (isNaN(basePrice) || basePrice < 0) {
                  errors.push(`Row ${index + 2}: Invalid base price`);
                  return;
                }

                const wholesalePrice = row['wholesale price'] || row.wholesaleprice ? parseFloat(row['wholesale price'] || row.wholesaleprice) : undefined;
                const retailPrice = row['retail price'] || row.retailprice ? parseFloat(row['retail price'] || row.retailprice) : undefined;
                const specialPrice = row['special price'] || row.specialprice || row['special customer price'] ? parseFloat(row['special price'] || row.specialprice || row['special customer price']) : undefined;
                const currency = (row.currency || 'USD').toUpperCase();
                const active = row.active ? String(row.active).toLowerCase() !== 'no' : true;
                const notes = row.notes || row.note || undefined;

                let effectiveDate = Date.now();
                if (row['effective date'] || row.effectivedate || row.date) {
                  const dateStr = String(row['effective date'] || row.effectivedate || row.date);
                  const parsed = new Date(dateStr);
                  if (!isNaN(parsed.getTime())) {
                    effectiveDate = parsed.getTime();
                  }
                }

                prices.push({
                  productId: product.id,
                  productName: product.name,
                  unitOfMeasure: String(unitOfMeasure).trim(),
                  basePrice,
                  wholesalePrice: isNaN(wholesalePrice!) ? undefined : wholesalePrice,
                  retailPrice: isNaN(retailPrice!) ? undefined : retailPrice,
                  specialCustomerPrice: isNaN(specialPrice!) ? undefined : specialPrice,
                  currency,
                  effectiveDate,
                  active,
                  notes,
                });
              } catch (error: any) {
                errors.push(`Row ${index + 2}: ${error.message || 'Failed to parse row'}`);
              }
            });

            resolve({
              success: prices.length > 0,
              prices,
              errors,
            });
          },
          error: (error: any) => {
            resolve({
              success: false,
              prices: [],
              errors: [error.message || 'Failed to parse CSV file'],
            });
          },
        });
      });
    } catch (error: any) {
      Logger.error('[FileImportService] Price CSV parsing error:', error);
      return {
        success: false,
        prices: [],
        errors: [error.message || 'Failed to parse CSV file'],
      };
    }
  },
};


