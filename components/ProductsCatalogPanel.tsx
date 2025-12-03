import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Edit, Trash2, Upload, Download, Package, Filter, X, Image as ImageIcon, TrendingUp } from 'lucide-react';
import { Product } from '../types';
import { ProductCatalogService } from '../services/productCatalogService';
import { canManageProducts } from '../services/permissionService';
import { User } from '../types';
import { Logger } from '../services/loggerService';
import ProductFormModal from './ProductFormModal';

interface ProductsCatalogPanelProps {
  user?: User;
}

const ProductsCatalogPanel: React.FC<ProductsCatalogPanelProps> = ({ user }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; imported: number; errors: string[] } | null>(null);

  // Allow all authenticated users to manage products for now
  // You can restrict this later if needed
  const canEdit = user !== undefined;

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true);
      const userId = user?.id;
      const allProducts = await ProductCatalogService.getProducts(userId);
      setProducts(allProducts);
    } catch (error) {
      Logger.error('[ProductsCatalogPanel] Failed to load products:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      await loadProducts();
      return;
    }
    const userId = user?.id;
    const results = await ProductCatalogService.searchProducts(query, {
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      status: statusFilter !== 'all' ? (statusFilter as 'active' | 'inactive') : undefined,
    }, userId);
    setProducts(results);
  };

  const handleCategoryFilter = async (category: string) => {
    setCategoryFilter(category);
    applyFilters(category, statusFilter);
  };

  const handleStatusFilter = async (status: string) => {
    setStatusFilter(status);
    applyFilters(categoryFilter, status);
  };

  const applyFilters = async (category: string, status: string) => {
    let results = await ProductCatalogService.getProducts();
    
    if (category !== 'all') {
      results = results.filter(p => p.category === category);
    }
    
    if (status !== 'all') {
      results = results.filter(p => p.status === status);
    }
    
    if (searchQuery.trim()) {
      results = await ProductCatalogService.searchProducts(searchQuery, {
        category: category !== 'all' ? category : undefined,
        status: status !== 'all' ? (status as 'active' | 'inactive') : undefined,
      });
    }
    
      setProducts(results);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await ProductCatalogService.deleteProduct(id);
      await loadProducts();
    } catch (error: any) {
      alert(`Failed to delete product: ${error.message}`);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    try {
      setImporting(true);
      const userId = user?.id;
      const result = await ProductCatalogService.importProductsFromFile(importFile, userId);
      setImportResult(result);
      if (result.success) {
        await loadProducts();
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
      const userId = user?.id;
      const data = await ProductCatalogService.exportProducts(format, userId);
      const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products_${Date.now()}.${format === 'json' ? 'json' : 'csv'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`Failed to export: ${error.message}`);
    }
  };

  const categories = Array.from(new Set(products.map(p => p.category)));

  const filteredProducts = products.filter(p => {
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-slate-500">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 min-h-0 pb-4" style={{ minHeight: 0 }}>
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Package className="w-5 h-5" /> Products Catalog
          </h3>
          <p className="text-sm text-slate-500">Manage your product catalog for AI-powered messaging</p>
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
                <Plus className="w-4 h-4" /> Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search products by name, category, tags..."
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryFilter(e.target.value)}
            className="pl-10 pr-8 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilter(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map(product => {
          const primaryPhoto = product.photos?.find(p => p.isPrimary) || product.photos?.[0];
          return (
            <div key={product.id} className="border border-slate-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white">
              {/* Product Image */}
              {primaryPhoto ? (
                <div className="w-full h-48 bg-slate-100 relative overflow-hidden">
                  <img
                    src={primaryPhoto.url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23ddd" width="100" height="100"/%3E%3Ctext fill="%23999" font-family="sans-serif" font-size="14" x="50%" y="50%" text-anchor="middle" dy=".3em"%3ENo Image%3C/text%3E%3C/svg%3E';
                    }}
                  />
                  {product.photos && product.photos.length > 1 && (
                    <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <ImageIcon className="w-3 h-3" />
                      {product.photos.length}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-48 bg-slate-100 flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-slate-300" />
                </div>
              )}
              
              <div className="p-4">
            <div className="flex justify-between items-start mb-2">
              <div className="flex-1">
                <h4 className="font-bold text-slate-800">{product.name}</h4>
                <p className="text-xs text-slate-500 mt-1">{product.category}</p>
              </div>
                  <div className="flex flex-col items-end gap-1">
                    {product.status === 'inactive' && (
                <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded">Inactive</span>
              )}
                    {product.status === 'active' && (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs rounded">Active</span>
                    )}
                  </div>
            </div>
                
            <p className="text-sm text-slate-600 mb-3 line-clamp-2">{product.shortDescription}</p>
                
                {/* Price and Unit */}
                {(product.referencePrice || product.unit) && (
                  <div className="flex items-center gap-2 mb-2 text-xs text-slate-600">
                    {product.referencePrice && (
                      <span className="font-semibold">
                        {product.referencePriceCurrency || 'USD'} {product.referencePrice}
                      </span>
                    )}
                    {product.unit && (
                      <span className="text-slate-400">/ {product.unit}</span>
                    )}
                  </div>
                )}
                
                {/* AI Usage Count */}
                {product.aiUsageCount && product.aiUsageCount > 0 && (
                  <div className="flex items-center gap-1 mb-2 text-xs text-indigo-600">
                    <TrendingUp className="w-3 h-3" />
                    <span>Recommended {product.aiUsageCount} time{product.aiUsageCount !== 1 ? 's' : ''}</span>
                  </div>
                )}
                
                {/* Tags */}
                {product.tags && product.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {product.tags.slice(0, 3).map((tag, i) => (
                  <span key={i} className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded">
                    {tag}
                  </span>
                ))}
                {product.tags.length > 3 && (
                  <span className="text-xs text-slate-500">+{product.tags.length - 3}</span>
                )}
              </div>
            )}
                
            {canEdit && (
              <div className="flex gap-2 pt-2 border-t border-slate-200">
                <button
                  onClick={() => {
                    setEditingProduct(product);
                    setShowModal(true);
                  }}
                  className="flex-1 px-3 py-1.5 text-xs border border-slate-300 rounded hover:bg-slate-50 flex items-center justify-center gap-1"
                >
                  <Edit className="w-3 h-3" /> Edit
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="px-3 py-1.5 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50 flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
            </div>
          );
        })}
      </div>

      {filteredProducts.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>No products found. {canEdit && 'Add your first product to get started.'}</p>
        </div>
      )}

      {/* Product Form Modal */}
      {showModal && (
        <ProductFormModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingProduct(null);
          }}
          product={editingProduct}
          onSave={async () => {
            await loadProducts();
            setShowModal(false);
            setEditingProduct(null);
          }}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Import Products</h3>
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
                      ? `Successfully imported ${importResult.imported} products`
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

export default ProductsCatalogPanel;

