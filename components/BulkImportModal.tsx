import React, { useState, useRef, startTransition } from 'react';
import { X, Upload, AlertTriangle, CheckCircle, FileText, FileSpreadsheet, File, Loader2 } from 'lucide-react';
import { Importer, LeadStatus, Channel } from '../types';
import { getInitialValidationState, validateContactFormat } from '../services/validationService';
import { Logger } from '../services/loggerService';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (newImporters: Importer[]) => void;
}

const BulkImportModal: React.FC<BulkImportModalProps> = ({ isOpen, onClose, onImport }) => {
  const [csvText, setCsvText] = useState('');
  const [previewData, setPreviewData] = useState<Importer[]>([]);
  const [step, setStep] = useState<'input' | 'preview'>('input');
  const [importMode, setImportMode] = useState<'text' | 'file'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileError, setFileError] = useState('');
  const [componentError, setComponentError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isImportingRef = useRef(false); // Prevent multiple simultaneous imports

  // Safety check for required props
  if (!isOpen) return null;
  
  if (typeof onClose !== 'function') {
    console.error('[BulkImportModal] onClose is not a function');
    return null;
  }
  
  if (typeof onImport !== 'function') {
    console.error('[BulkImportModal] onImport is not a function');
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold text-slate-800">Configuration Error</h2>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800">Import handler is not properly configured.</p>
          </div>
          <button
            onClick={onClose || (() => {})}
            className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  // Error boundary wrapper
  if (componentError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <AlertTriangle className="w-6 h-6 text-red-600" />
            <h2 className="text-xl font-bold text-slate-800">Error Loading Import Modal</h2>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-red-800 mb-2">{componentError}</p>
            <p className="text-xs text-red-600">Please check the console for more details.</p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => {
                setComponentError(null);
                onClose();
              }}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                setComponentError(null);
                window.location.reload();
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reset state when modal opens (only when transitioning from closed to open)
  const prevIsOpenRef = React.useRef(isOpen);
  const isResettingRef = React.useRef(false);
  const resetTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  
  React.useEffect(() => {
    // Clear any pending reset
    if (resetTimeoutRef.current) {
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
    
    // Prevent rapid re-execution
    if (isResettingRef.current) {
      console.log('[BulkImportModal] Already resetting, skipping');
      return;
    }
    
    console.log('[BulkImportModal] useEffect triggered', {
      isOpen,
      prevIsOpen: prevIsOpenRef.current,
      timestamp: new Date().toISOString()
    });
    
    // Only reset when modal transitions from closed to open
    if (isOpen && !prevIsOpenRef.current) {
      console.log('[BulkImportModal] Modal opening, resetting state');
      
      // Set flag to prevent re-execution
      isResettingRef.current = true;
      
      // Reset importing flag when modal opens
      isImportingRef.current = false;
      
      // Use a debounced reset to prevent rapid state changes
      resetTimeoutRef.current = setTimeout(() => {
        // Batch all state updates together to prevent multiple re-renders
        startTransition(() => {
          setCsvText('');
          setPreviewData([]);
          setStep('input');
          setSelectedFile(null);
          setFileError('');
          setImportMode('file');
        });
        
        // Reset file input in next tick to avoid conflicts
        requestAnimationFrame(() => {
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        });
        
        // Reset flag after state updates
        setTimeout(() => {
          isResettingRef.current = false;
          resetTimeoutRef.current = null;
        }, 200);
      }, 50); // Small delay to debounce rapid changes
    }
    
    // Update ref AFTER all checks to prevent loops
    if (prevIsOpenRef.current !== isOpen) {
      prevIsOpenRef.current = isOpen;
    }
    
    // Cleanup function
    return () => {
      if (resetTimeoutRef.current) {
        clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };
  }, [isOpen]);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      setSelectedFile(file);
      setFileError('');
      setIsProcessing(true);
      setPreviewData([]);

      const { FileImportService } = await import('../services/fileImportService');
      
      // Check file type
      const fileName = file.name.toLowerCase();
      const fileExtension = fileName.split('.').pop()?.toLowerCase();
      
      if (fileExtension === 'pdf') {
        const result = await FileImportService.parsePDFFile(file);
        setFileError(result.errors.join('\n'));
        setIsProcessing(false);
        return;
      }

      const result = await FileImportService.parseFile(file);
      console.log('[BulkImport] File parse result:', { success: result.success, dataCount: result.data.length, errors: result.errors.length });

      if (result.success && result.data.length > 0) {
        setPreviewData(result.data);
        setStep('preview');
        if (result.errors.length > 0) {
          Logger.warn('[BulkImport] File parsed with warnings:', result.errors);
          // Show warnings but don't block import
          const warningMsg = `File parsed successfully with ${result.errors.length} warning(s). Check preview before importing.`;
          setFileError(warningMsg);
          setTimeout(() => setFileError(''), 5000); // Clear warning after 5 seconds
        }
      } else {
        const errorMsg = result.errors.length > 0 
          ? result.errors.join('\n') 
          : 'Failed to parse file. Please check the file format. Expected columns: Name, Company, Country, Contact, Product, Quantity, Price';
        setFileError(errorMsg);
        setPreviewData([]);
        console.error('[BulkImport] File parse failed:', errorMsg);
      }
    } catch (error: any) {
      console.error('[BulkImport] File processing error:', error);
      const errorMessage = error?.message || 'Failed to process file. Please ensure the file format is correct.';
      setFileError(errorMessage);
      try {
        Logger.error('[BulkImport] File processing error:', error);
      } catch (loggerError) {
        console.error('[BulkImport] Logger error:', loggerError);
      }
      setPreviewData([]);
      setIsProcessing(false);
      
      // If it's a critical error, show it in the error state
      if (error?.message?.includes('Cannot read') || error?.message?.includes('undefined')) {
        setComponentError(`Failed to load import service: ${errorMessage}`);
      }
    }
  };

  const parseCSV = async () => {
    try {
      if (!csvText.trim()) return;

      setIsProcessing(true);
      setFileError('');

      // Use papaparse for better CSV parsing
      const Papa = await import('papaparse');
      
      return new Promise<void>((resolve) => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (results: any) => {
            const rows = results.data || [];
            if (rows.length === 0) {
              setFileError('CSV data is empty or invalid');
              setIsProcessing(false);
              resolve();
              return;
            }

            const parsed: Importer[] = rows.map((row: any[], index: number) => {
              // Handle both array format (from papaparse) and ensure we have columns
              const cols = Array.isArray(row) ? row : [row];
              
              // Safety check for columns
              const name = (cols[0] || '').toString().trim() || `Unknown Importer ${index + 1}`;
              const companyName = (cols[1] || '').toString().trim() || 'Unknown Co';
              const country = (cols[2] || '').toString().trim() || 'Unknown';
              const contactDetail = (cols[3] || '').toString().trim();
              const productsImported = (cols[4] || '').toString().trim() || 'General Goods';
              const quantity = (cols[5] || '').toString().trim() || '-';
              const priceRange = (cols[6] || '').toString().trim() || '-';

              let channel = Channel.EMAIL;
              let validation = { isValid: false, errors: ['Contact format not validated'], checkedAt: Date.now() };
              
              try {
                const validationResult = validateContactFormat(contactDetail);
                channel = validationResult.channel || Channel.EMAIL;
              } catch (e) {
                console.warn('[BulkImport] validateContactFormat error:', e);
              }
              
              try {
                validation = getInitialValidationState(contactDetail);
              } catch (e) {
                console.warn('[BulkImport] getInitialValidationState error:', e);
                validation = { isValid: false, errors: ['Validation failed'], checkedAt: Date.now() };
              }

              return {
                id: `imported-${Date.now()}-${index}`,
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
                  id: `log-init-${index}`,
                  timestamp: Date.now(),
                  type: 'system',
                  description: 'Lead imported via Bulk CSV'
                }],
                preferredChannel: channel,
                validation
              };
            });

            if (parsed.length === 0) {
              setFileError('No valid data found in CSV. Please check the format.');
              setIsProcessing(false);
              resolve();
              return;
            }
            
            console.log('[BulkImport] CSV parsed successfully:', parsed.length, 'leads');
            setPreviewData(parsed);
            setStep('preview');
            setIsProcessing(false);
            resolve();
          },
          error: (error: any) => {
            setFileError(error.message || 'Failed to parse CSV data');
            setIsProcessing(false);
            resolve();
          },
        });
      });
    } catch (error: any) {
      console.error('[BulkImport] CSV parsing error:', error);
      const errorMessage = error?.message || 'Failed to parse CSV data';
      setFileError(errorMessage);
      try {
        Logger.error('[BulkImport] CSV parsing error:', error);
      } catch (loggerError) {
        console.error('[BulkImport] Logger error:', loggerError);
      }
      setIsProcessing(false);
      
      // If it's a critical error, show it in the error state
      if (error?.message?.includes('Cannot read') || error?.message?.includes('undefined')) {
        setComponentError(`Failed to parse CSV: ${errorMessage}`);
      }
    }
  };

  const handleImport = () => {
    try {
      // Prevent multiple simultaneous imports
      if (isImportingRef.current) {
        console.warn('[BulkImport] Import already in progress, ignoring duplicate call');
        return;
      }
      
      if (!previewData || previewData.length === 0) {
        setFileError('No data to import. Please select a file or paste CSV data first.');
        return;
      }
      
      // Set importing flag immediately
      isImportingRef.current = true;
      
      console.log('[BulkImport] Importing leads:', previewData.length);
      
      // Create a copy of the data to import BEFORE any state changes
      const dataToImport = [...previewData];
      
      // Close modal FIRST to prevent any state conflicts
      if (typeof onClose === 'function') {
        onClose();
      }
      
      // Reset state AFTER closing modal
      setCsvText('');
      setPreviewData([]);
      setStep('input');
      setSelectedFile(null);
      setFileError('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      // Use setTimeout with a longer delay to ensure modal is fully closed
      // and all state updates have completed before calling onImport
      setTimeout(() => {
        try {
          if (typeof onImport === 'function') {
            // Call onImport with a try-catch to prevent any errors from propagating
            try {
              onImport(dataToImport);
            } catch (importError: any) {
              console.error('[BulkImport] onImport callback error:', importError);
              // Error is logged but we don't show it since modal is closed
            }
          } else {
            console.error('[BulkImport] onImport is not a function:', typeof onImport);
          }
        } catch (error: any) {
          console.error('[BulkImport] Import error:', error);
        } finally {
          // Reset importing flag after a delay to allow state updates to complete
          setTimeout(() => {
            isImportingRef.current = false;
            console.log('[BulkImport] Import flag reset');
          }, 1000);
        }
      }, 300);
    } catch (error: any) {
      console.error('[BulkImport] handleImport error:', error);
      setComponentError(`Failed to process import: ${error?.message || 'Unknown error'}`);
      isImportingRef.current = false;
    }
  };

  const validCount = previewData.filter(i => i.validation.isValid).length;
  const invalidCount = previewData.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Bulk Lead Import
            </h2>
            <p className="text-sm text-slate-500">Import leads from Excel, CSV, or PDF files</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {step === 'input' ? (
            <div className="space-y-4">
              {/* Import Mode Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    setImportMode('file');
                    setCsvText('');
                    setSelectedFile(null);
                    setFileError('');
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    importMode === 'file'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 inline mr-2" />
                  Upload File
                </button>
                <button
                  onClick={() => {
                    setImportMode('text');
                    setSelectedFile(null);
                    setFileError('');
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors ${
                    importMode === 'text'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  Paste CSV
                </button>
              </div>

              {importMode === 'file' ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                    <strong>Supported formats:</strong> Excel (.xlsx, .xls), CSV (.csv)
                    <br />
                    <strong>Expected columns:</strong> Name, Company, Country, Contact, Product, Quantity, Price
                    <br />
                    <span className="text-xs">The system will auto-detect column names if they match common variations.</span>
                    <br />
                    <span className="text-xs text-orange-700 mt-1 block">Note: PDF files require conversion to Excel/CSV format first.</span>
                  </div>

                  {/* File Upload Area */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.classList.add('border-indigo-400', 'bg-indigo-50');
                    }}
                    onDragLeave={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50');
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.classList.remove('border-indigo-400', 'bg-indigo-50');
                      
                      const file = e.dataTransfer.files[0];
                      if (file) {
                        // Create a synthetic event for handleFileSelect
                        const syntheticEvent = {
                          target: {
                            files: [file]
                          }
                        } as React.ChangeEvent<HTMLInputElement>;
                        await handleFileSelect(syntheticEvent);
                      }
                    }}
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isProcessing
                        ? 'border-indigo-300 bg-indigo-50'
                        : selectedFile
                        ? 'border-green-300 bg-green-50'
                        : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls,.csv,.pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    
                    {isProcessing ? (
                      <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        <p className="text-sm text-slate-600 font-medium">Processing file...</p>
                      </div>
                    ) : selectedFile ? (
                      <div className="flex flex-col items-center gap-2">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                        <p className="text-sm font-medium text-slate-800">{selectedFile.name}</p>
                        <p className="text-xs text-slate-500">{(selectedFile.size / 1024).toFixed(2)} KB</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFile(null);
                            setFileError('');
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-xs text-red-600 hover:text-red-700 mt-2"
                        >
                          Remove file
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-slate-400" />
                        <p className="text-sm font-medium text-slate-800">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-slate-500">
                          Excel (.xlsx, .xls), CSV (.csv), or PDF (.pdf) files
                        </p>
                      </div>
                    )}
                  </div>

                  {fileError && (
                    <div className={`p-3 rounded-lg text-sm ${
                      fileError.toLowerCase().includes('error') || fileError.toLowerCase().includes('failed')
                        ? 'bg-red-50 border border-red-200 text-red-800'
                        : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                    }`}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 whitespace-pre-line">{fileError}</div>
                      </div>
                    </div>
                  )}

                  {selectedFile && !isProcessing && previewData.length === 0 && !fileError && step === 'input' && (
                    <button
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.click();
                        }
                      }}
                      className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      Select Different File
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
                    <strong>Format:</strong> Name, Company, Country, Contact, Product, Quantity, Price
                    <br />
                    <span className="text-xs">Paste CSV data directly into the text area below</span>
                  </div>
                  <textarea
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    placeholder="David Chen, Tok Inc, New Zealand, +64211234567, Corn Poha, 10 NOS, 7.50 USD..."
                    className="w-full h-64 p-4 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-4 mb-4">
                <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-lg text-sm font-medium">
                  <CheckCircle className="w-4 h-4" /> {validCount} Valid
                </div>
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-1 rounded-lg text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" /> {invalidCount} Issues
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 font-medium">
                    <tr>
                      <th className="p-3">Status</th>
                      <th className="p-3">Company</th>
                      <th className="p-3">Contact</th>
                      <th className="p-3">Product</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.map((item) => (
                      <tr key={item.id} className={item.validation.isValid ? 'bg-white' : 'bg-red-50/50'}>
                        <td className="p-3">
                          {item.validation.isValid ? (
                            <span className="text-green-500"><CheckCircle className="w-4 h-4" /></span>
                          ) : (
                            <span className="text-red-500 flex items-center gap-1 text-xs font-bold">
                              <AlertTriangle className="w-4 h-4" /> {item.validation.errors[0]}
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-medium text-slate-800">{item.companyName}</td>
                        <td className="p-3 text-slate-600">{item.contactDetail}</td>
                        <td className="p-3 text-slate-600 truncate max-w-[200px]">{item.productsImported}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex justify-end gap-3">
          {step === 'input' ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              {importMode === 'text' ? (
                <button 
                  onClick={parseCSV}
                  disabled={!csvText.trim()}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Analyze Data
                </button>
              ) : (
                isProcessing && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Processing file...</span>
                  </div>
                )
              )}
            </>
          ) : (
            <>
              <button onClick={() => setStep('input')} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Back to Input
              </button>
              <button 
                onClick={handleImport}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-green-600/20"
              >
                Import {previewData.length} Leads
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkImportModal;