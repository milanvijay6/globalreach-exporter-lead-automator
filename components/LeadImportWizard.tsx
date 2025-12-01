import React, { useState, useRef } from 'react';
import { X, Upload, AlertTriangle, CheckCircle, FileText, FileSpreadsheet, File, Loader2 } from 'lucide-react';
import { Importer, LeadStatus, Channel } from '../types';
import { FileImportService } from '../services/fileImportService';
import { validateContactFormat, getInitialValidationState } from '../services/validationService';

interface LeadImportWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (newImporters: Importer[]) => void;
}

type Step = 'input' | 'preview';

const LeadImportWizard: React.FC<LeadImportWizardProps> = ({ isOpen, onClose, onComplete }) => {
  const [step, setStep] = useState<Step>('input');
  const [importMode, setImportMode] = useState<'file' | 'text'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState('');
  const [previewData, setPreviewData] = useState<Importer[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  if (isOpen && step === 'input' && previewData.length === 0 && !selectedFile && !csvText) {
    // Component is fresh, no reset needed
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError('');
    setIsProcessing(true);
    setPreviewData([]);

    try {
      const fileName = file.name.toLowerCase();
      const fileExtension = fileName.split('.').pop()?.toLowerCase();

      if (fileExtension === 'pdf') {
        const result = await FileImportService.parsePDFFile(file);
        setError(result.errors.join('\n'));
        setIsProcessing(false);
        return;
      }

      const result = await FileImportService.parseFile(file);

      if (result.success && result.data.length > 0) {
        setPreviewData(result.data);
        setStep('preview');
        if (result.errors.length > 0) {
          setError(`File parsed with ${result.errors.length} warning(s). Check preview before importing.`);
          setTimeout(() => setError(''), 5000);
        }
      } else {
        setError(result.errors.length > 0 
          ? result.errors.join('\n') 
          : 'Failed to parse file. Please check the file format.');
        setPreviewData([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to process file. Please ensure the file format is correct.');
      setPreviewData([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleParseCSV = async () => {
    if (!csvText.trim()) {
      setError('Please enter CSV data');
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const Papa = await import('papaparse');
      
      return new Promise<void>((resolve) => {
        Papa.parse(csvText, {
          header: false,
          skipEmptyLines: true,
          complete: (results: any) => {
            const rows = results.data || [];
            if (rows.length === 0) {
              setError('CSV data is empty or invalid');
              setIsProcessing(false);
              resolve();
              return;
            }

            const parsed: Importer[] = rows.map((row: any[], index: number) => {
              const cols = Array.isArray(row) ? row : [row];
              
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
                console.warn('[LeadImportWizard] validateContactFormat error:', e);
              }
              
              try {
                validation = getInitialValidationState(contactDetail);
              } catch (e) {
                console.warn('[LeadImportWizard] getInitialValidationState error:', e);
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
              setError('No valid data found in CSV. Please check the format.');
              setIsProcessing(false);
              resolve();
              return;
            }
            
            setPreviewData(parsed);
            setStep('preview');
            setIsProcessing(false);
            resolve();
          },
          error: (error: any) => {
            setError(error.message || 'Failed to parse CSV data');
            setIsProcessing(false);
            resolve();
          },
        });
      });
    } catch (err: any) {
      setError(err?.message || 'Failed to parse CSV data');
      setIsProcessing(false);
    }
  };

  const handleImport = () => {
    if (!previewData || previewData.length === 0) {
      setError('No data to import');
      return;
    }

    // Call onComplete with the preview data
    onComplete(previewData);
    
    // Reset and close
    setStep('input');
    setPreviewData([]);
    setSelectedFile(null);
    setCsvText('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleClose = () => {
    // Reset state
    setStep('input');
    setPreviewData([]);
    setSelectedFile(null);
    setCsvText('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  if (!isOpen) return null;

  const validCount = previewData.filter(i => i.validation.isValid).length;
  const invalidCount = previewData.length - validCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-2 sm:p-4 md:p-6">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden" style={{ width: '100%', maxWidth: 'min(90vw, 56rem)' }}>
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Upload className="w-5 h-5 text-indigo-600" />
              Import Leads
            </h2>
            <p className="text-sm text-slate-500">Import leads from Excel, CSV files, or paste CSV data</p>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 min-h-0" style={{ overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          {step === 'input' ? (
            <div className="space-y-4">
              {/* Import Mode Toggle */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    setImportMode('file');
                    setCsvText('');
                    setSelectedFile(null);
                    setError('');
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
                    setError('');
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
                        const syntheticEvent = {
                          target: { files: [file] }
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
                      accept=".xlsx,.xls,.csv"
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
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-slate-400" />
                        <p className="text-sm font-medium text-slate-800">
                          Click to upload or drag and drop
                        </p>
                        <p className="text-xs text-slate-500">
                          Excel (.xlsx, .xls) or CSV (.csv) files
                        </p>
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className={`p-3 rounded-lg text-sm ${
                      error.toLowerCase().includes('error') || error.toLowerCase().includes('failed')
                        ? 'bg-red-50 border border-red-200 text-red-800'
                        : 'bg-yellow-50 border border-yellow-200 text-yellow-800'
                    }`}>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 whitespace-pre-line">{error}</div>
                      </div>
                    </div>
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
                  {error && (
                    <div className="p-3 rounded-lg text-sm bg-red-50 border border-red-200 text-red-800">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">{error}</div>
                      </div>
                    </div>
                  )}
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
              
              <div className="border rounded-lg overflow-x-auto" style={{ width: '100%', maxWidth: '100%' }}>
                <table className="w-full text-sm text-left min-w-[600px]">
                  <thead className="bg-slate-100 text-slate-600 font-medium">
                    <tr>
                      <th className="p-2 sm:p-3 whitespace-nowrap">Status</th>
                      <th className="p-2 sm:p-3 whitespace-nowrap">Company</th>
                      <th className="p-2 sm:p-3 whitespace-nowrap">Contact</th>
                      <th className="p-2 sm:p-3 whitespace-nowrap">Product</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewData.map((item) => (
                      <tr key={item.id} className={item.validation.isValid ? 'bg-white' : 'bg-red-50/50'}>
                        <td className="p-2 sm:p-3">
                          {item.validation.isValid ? (
                            <span className="text-green-500"><CheckCircle className="w-4 h-4" /></span>
                          ) : (
                            <div className="text-red-500 flex items-start gap-1 text-xs" title={item.validation.errors.join('\n')}>
                              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                              <div className="flex flex-col gap-0.5 min-w-0">
                                <span className="font-bold truncate max-w-[120px]">{item.validation.errors[0]}</span>
                                {item.validation.errors.length > 1 && (
                                  <span className="text-[10px] text-red-400">+{item.validation.errors.length - 1} more issue{item.validation.errors.length > 2 ? 's' : ''}</span>
                                )}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="p-2 sm:p-3 font-medium text-slate-800 truncate max-w-[150px] sm:max-w-none">{item.companyName}</td>
                        <td className="p-2 sm:p-3 text-slate-600 truncate max-w-[120px] sm:max-w-none">{item.contactDetail}</td>
                        <td className="p-2 sm:p-3 text-slate-600 truncate max-w-[150px] sm:max-w-[200px]">{item.productsImported}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 bg-slate-50 rounded-b-xl flex flex-col sm:flex-row justify-end gap-3 shrink-0">
          {step === 'input' ? (
            <>
              <button onClick={handleClose} className="w-full sm:w-auto px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Cancel
              </button>
              {importMode === 'text' ? (
                <button 
                  onClick={handleParseCSV}
                  disabled={!csvText.trim() || isProcessing}
                  className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    'Analyze Data'
                  )}
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
              <button onClick={() => setStep('input')} className="w-full sm:w-auto px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                Back
              </button>
              <button 
                onClick={handleImport}
                className="w-full sm:w-auto px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-green-600/20"
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

export default LeadImportWizard;

