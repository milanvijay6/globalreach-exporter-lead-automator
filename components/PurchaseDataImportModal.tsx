import React, { useState, useRef } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Loader2, Download } from 'lucide-react';
import { PurchaseDataImportService, ImportResult, ColumnMapping } from '../services/purchaseDataImportService';
import { PurchaseOrder } from '../types';
import { useToast } from './Toast';

interface PurchaseDataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (result: ImportResult) => void;
}

const PurchaseDataImportModal: React.FC<PurchaseDataImportModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'complete'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<'csv' | 'excel' | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [previewData, setPreviewData] = useState<PurchaseOrder[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  // Expected column names
  const expectedColumns = [
    'SBDT', 'EXPORTERNAME', 'EXPORTERADDRESS', 'Pin_Code', 'City', 'State',
    'CONTACTNO', 'EMAILID', 'CONSINEENAME', 'PROB_CONSINEENAME', 'CONSINEEADDRESS',
    'PORT_CODE', 'FOREIGNPORT', 'FOREIGNCOUNTRY', 'HS_CODE', 'CHAPTER',
    'PRODUCTDESCRIPITION', 'QUANTITY', 'UNITQUANTITY', 'ITEM_RATE_IN_FC', 'CURRENCY',
    'Total_Value_IN_FC', 'Unit_Rate_USD', 'Exchange_Rate', 'Total_Value_IN_USD',
    'Unit_Rate_in_INR', 'FOB', 'DRAWBACK', 'MONTH', 'YEAR', 'MODE', 'INDIAN_PORT', 'SHIPMENT_STATUS'
  ];

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setErrors([]);
    setIsProcessing(true);

    try {
      // Determine file type
      const fileName = selectedFile.name.toLowerCase();
      const isCSV = fileName.endsWith('.csv');
      const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

      if (!isCSV && !isExcel) {
        setErrors(['Please select a CSV or Excel file']);
        setIsProcessing(false);
        return;
      }

      setFileType(isCSV ? 'csv' : 'excel');

      // Read file
      const fileContent = await selectedFile.text();
      let parsedData: { headers: string[]; rows: Record<string, any>[]; errors: string[] };

      if (isCSV) {
        parsedData = await PurchaseDataImportService.parseCSVFile(fileContent, true);
      } else {
        // For Excel, we need to read as buffer
        const arrayBuffer = await selectedFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        parsedData = await PurchaseDataImportService.parseExcelFile(buffer);
      }

      if (parsedData.errors.length > 0) {
        setErrors(parsedData.errors);
        setIsProcessing(false);
        return;
      }

      if (parsedData.rows.length === 0) {
        setErrors(['File appears to be empty']);
        setIsProcessing(false);
        return;
      }

      setHeaders(parsedData.headers);
      setRows(parsedData.rows.slice(0, 100)); // Preview first 100 rows

      // Auto-detect column mapping
      const autoMapping = PurchaseDataImportService.autoDetectColumnMapping(parsedData.headers);
      setColumnMapping(autoMapping);

      setStep('mapping');
      addToast('File parsed successfully', 'success');
    } catch (error: any) {
      setErrors([error.message || 'Failed to parse file']);
      addToast('Failed to parse file', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingChange = (field: keyof ColumnMapping, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value || undefined,
    }));
  };

  const handlePreview = async () => {
    if (rows.length === 0) return;

    setIsProcessing(true);
    setErrors([]);

    try {
      const preview: PurchaseOrder[] = [];
      const previewRows = rows.slice(0, 10); // Preview first 10 rows

      for (let i = 0; i < previewRows.length; i++) {
        const { order, errors: mappingErrors } = PurchaseDataImportService.mapToPurchaseOrder(
          previewRows[i],
          columnMapping,
          i + 2
        );

        if (mappingErrors.length > 0) {
          setErrors(prev => [...prev, `Row ${i + 2}: ${mappingErrors.join('; ')}`]);
        }

        if (order) {
          const validation = PurchaseDataImportService.validatePurchaseData(order);
          if (validation.valid) {
            preview.push(order);
          } else {
            setErrors(prev => [...prev, `Row ${i + 2}: ${validation.errors.join('; ')}`]);
          }
        }
      }

      setPreviewData(preview);
      setStep('preview');
    } catch (error: any) {
      setErrors([error.message || 'Failed to preview data']);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImport = async () => {
    if (rows.length === 0) return;

    setIsProcessing(true);
    setStep('importing');
    setErrors([]);

    try {
      const result = await PurchaseDataImportService.importPurchaseOrders(rows, columnMapping);

      // Save imported orders
      if (result.imported > 0) {
        const { PurchaseDataService } = await import('../services/purchaseDataService');
        const importedOrders: PurchaseOrder[] = [];

        for (let i = 0; i < rows.length; i++) {
          const { order } = PurchaseDataImportService.mapToPurchaseOrder(
            rows[i],
            columnMapping,
            i + 2
          );
          if (order) {
            const validation = PurchaseDataImportService.validatePurchaseData(order);
            if (validation.valid) {
              importedOrders.push(order);
            }
          }
        }

        await PurchaseDataService.savePurchaseOrders(importedOrders);
      }

      setImportResult(result);
      setStep('complete');

      if (result.imported > 0) {
        addToast(`Successfully imported ${result.imported} orders`, 'success');
      }
      if (result.errors.length > 0) {
        addToast(`${result.errors.length} rows had errors`, 'error');
      }

      if (onImportComplete) {
        onImportComplete(result);
      }
    } catch (error: any) {
      setErrors([error.message || 'Failed to import data']);
      addToast('Import failed', 'error');
      setStep('mapping');
    } finally {
      setIsProcessing(false);
    }
  };

  const reset = () => {
    setFile(null);
    setFileType(null);
    setHeaders([]);
    setRows([]);
    setColumnMapping({});
    setPreviewData([]);
    setImportResult(null);
    setErrors([]);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 flex justify-between items-center bg-indigo-600 text-white">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Import Purchase Data
          </h2>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="p-1 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-500 transition-colors">
                <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-2">Upload CSV or Excel file with purchase data</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 cursor-pointer transition-colors"
                >
                  Select File
                </label>
                {file && (
                  <p className="mt-4 text-sm text-slate-600">
                    Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>

              {isProcessing && (
                <div className="flex items-center justify-center gap-2 text-slate-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing file...</span>
                </div>
              )}

              {errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-red-800 mb-2">Errors:</p>
                      <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                        {errors.slice(0, 10).map((error, i) => (
                          <li key={i}>{error}</li>
                        ))}
                        {errors.length > 10 && <li>... and {errors.length - 10} more</li>}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p className="text-sm text-slate-700">
                  Map your file columns to the expected fields. Auto-detection has been applied, but you can adjust as needed.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                {expectedColumns.map((expectedCol) => {
                  const fieldName = expectedCol.toLowerCase().replace(/_/g, '') as keyof ColumnMapping;
                  return (
                    <div key={expectedCol} className="space-y-1">
                      <label className="block text-sm font-medium text-slate-700">
                        {expectedCol}
                      </label>
                      <select
                        value={columnMapping[fieldName] || ''}
                        onChange={(e) => handleMappingChange(fieldName, e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      >
                        <option value="">-- Select Column --</option>
                        {headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handlePreview}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    'Preview Data'
                  )}
                </button>
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 'preview' && (
            <div className="space-y-4">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  Preview of {previewData.length} valid records (showing first 10 rows)
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-slate-100">
                      <th className="border border-slate-300 px-2 py-1 text-left">Exporter</th>
                      <th className="border border-slate-300 px-2 py-1 text-left">Product</th>
                      <th className="border border-slate-300 px-2 py-1 text-left">Quantity</th>
                      <th className="border border-slate-300 px-2 py-1 text-left">Value (USD)</th>
                      <th className="border border-slate-300 px-2 py-1 text-left">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.map((order, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        <td className="border border-slate-300 px-2 py-1">{order.exporterName}</td>
                        <td className="border border-slate-300 px-2 py-1">{order.productDescription}</td>
                        <td className="border border-slate-300 px-2 py-1">{order.quantity}</td>
                        <td className="border border-slate-300 px-2 py-1">${order.totalValueInUSD.toFixed(2)}</td>
                        <td className="border border-slate-300 px-2 py-1">
                          {new Date(order.orderDate).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {errors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 font-medium mb-2">Warnings:</p>
                  <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                    {errors.slice(0, 5).map((error, i) => (
                      <li key={i}>{error}</li>
                    ))}
                    {errors.length > 5 && <li>... and {errors.length - 5} more</li>}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
                >
                  {isProcessing ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </span>
                  ) : (
                    `Import ${rows.length} Rows`
                  )}
                </button>
                <button
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
              <p className="text-lg font-medium text-slate-800">Importing purchase data...</p>
              <p className="text-sm text-slate-600 mt-2">Please wait</p>
            </div>
          )}

          {/* Step 5: Complete */}
          {step === 'complete' && importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-green-50 p-4 rounded-lg border border-green-200">
                <CheckCircle className="w-6 h-6 text-green-600" />
                <div>
                  <p className="font-medium text-green-800">Import Complete</p>
                  <p className="text-sm text-green-700">
                    {importResult.imported} orders imported successfully
                  </p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="font-medium text-red-800 mb-2">
                    {importResult.errors.length} rows had errors:
                  </p>
                  <div className="max-h-48 overflow-y-auto">
                    <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                      {importResult.errors.slice(0, 20).map((error, i) => (
                        <li key={i}>
                          Row {error.row}: {error.error}
                        </li>
                      ))}
                      {importResult.errors.length > 20 && (
                        <li>... and {importResult.errors.length - 20} more</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => {
                    reset();
                    onClose();
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PurchaseDataImportModal;

