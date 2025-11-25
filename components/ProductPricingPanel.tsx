import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit, Trash2, Upload, Download, DollarSign, Filter, X, AlertCircle } from 'lucide-react';
import { ProductPrice, Product } from '../types';
import { ProductPricingService } from '../services/productPricingService';
import { ProductCatalogService } from '../services/productCatalogService';
import { canManagePricing } from '../services/permissionService';
import { User } from '../types';
import { Logger } from '../services/loggerService';
import ProductPriceFormModal from './ProductPriceFormModal';

interface ProductPricingPanelProps {
  user?: User;
}

const ProductPricingPanel: React.FC<ProductPricingPanelProps> = ({ user }) => {
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currencyFilter, setCurrencyFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingPrice, setEditingPrice] = useState<ProductPrice | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; imported: number; errors: string[] } | null>(null);

  const canEdit = user ? canManagePricing(user) : false;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [pricesData, productsData] = await Promise.all([
        ProductPricingService.getPrices(),
        ProductCatalogService.getProducts(),
      ]);
      setPrices(pricesData);
      setProducts(productsData);
    } catch (error) {
      Logger.error('[ProductPricingPanel] Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this price?')) return;
    try {
      await ProductPricingService.deletePrice(id);
      await loadData();
    } catch (error: any) {
      alert(`Failed to delete price: ${error.message}`);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    try {
      setImporting(true);
      const result = await ProductPricingService.importPricesFromFile(importFile);
      setImportResult(result);
      if (result.success) {
        await loadData();
        setTimeout(() => {
          setShowImportModal(false);
          setImportFile(null);
          setImportResult(null);
        }, 2000);
      }
    } catch (error: any) {
      setImportResult({ success: false, imported: 0, errors: [error.message] });
    } finally {
      setImporting(false);
    }
  };

  const handleExport = async (format: 'json' | 'csv' = 'json') => {
    try {
      const data = await ProductPricingService.exportPrices(format);
      const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `prices_${Date.now()}.${format === 'json' ? 'json' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`Failed to export: ${error.message}`);
    }
  };

  const currencies = Array.from(new Set(prices.map(p => p.currency)));

  const filteredPrices = prices.filter(p => {
    if (searchQuery && !p.productName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (currencyFilter !== 'all' && p.currency !== currencyFilter) return false;
    if (activeFilter === 'active' && !p.active) return false;
    if (activeFilter === 'inactive' && p.active) return false;
    return true;
  });

  // Check for products without prices
  const productsWithoutPrices = products.filter(p => !prices.some(pr => pr.productId === p.id && pr.active));

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-500">Loading prices...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <DollarSign className="w-5 h-5" /> Product Pricing
          </h3>
          <p className="text-sm text-slate-500">Manage pricing for your products</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
              >
                <Upload className="w-4 h-4" /> Import
              </button>
              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
              >
                <Download className="w-4 h-4" /> Export CSV
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4" /> Add Price
              </button>
            </>
          )}
        </div>
      </div>

      {productsWithoutPrices.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-800">
                {productsWithoutPrices.length} product(s) without pricing
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                Consider adding prices for: {productsWithoutPrices.slice(0, 3).map(p => p.name).join(', ')}
                {productsWithoutPrices.length > 3 && ` and ${productsWithoutPrices.length - 3} more`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by product name..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={currencyFilter}
            onChange={(e) => setCurrencyFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Currencies</option>
            {currencies.map(curr => (
              <option key={curr} value={curr}>{curr}</option>
            ))}
          </select>
        </div>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="all">All Status</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
        </select>
      </div>

      {/* Prices Table */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Unit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Base Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Wholesale</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Retail</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Currency</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-700 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredPrices.map(price => (
                <tr key={price.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm text-slate-800">{price.productName}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{price.unitOfMeasure}</td>
                  <td className="px-4 py-3 text-sm font-medium text-slate-800">{price.basePrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{price.wholesalePrice?.toFixed(2) || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{price.retailPrice?.toFixed(2) || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{price.currency}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded ${price.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                      {price.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingPrice(price);
                            setShowModal(true);
                          }}
                          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(price.id)}
                          className="p-1 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredPrices.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No prices found. {canEdit && 'Add your first price to get started.'}</p>
        </div>
      )}

      {/* Price Form Modal */}
      {showModal && (
        <ProductPriceFormModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingPrice(null);
          }}
          price={editingPrice}
          products={products}
          onSave={async () => {
            await loadData();
            setShowModal(false);
            setEditingPrice(null);
          }}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Import Prices</h3>
              <button onClick={() => setShowImportModal(false)} className="p-2 hover:bg-slate-200 rounded-full">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Select File (Excel or CSV)
                </label>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              {importResult && (
                <div className={`p-3 rounded-lg ${importResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                  <p className={`text-sm ${importResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {importResult.success
                      ? `Successfully imported ${importResult.imported} prices`
                      : `Import failed: ${importResult.errors.join(', ')}`}
                  </p>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-slate-400"
                >
                  {importing ? 'Importing...' : 'Import'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPricingPanel;

