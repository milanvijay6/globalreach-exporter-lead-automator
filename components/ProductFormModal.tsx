import React, { useState, useEffect } from 'react';
import { X, Save, Tag, Plus, Trash2 } from 'lucide-react';
import { Product, ProductPhoto } from '../types';
import { ProductCatalogService } from '../services/productCatalogService';
import { validateProduct } from '../services/validationService';
import { Logger } from '../services/loggerService';
import ProductPhotoGallery from './ProductPhotoGallery';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null;
  onSave: () => void;
}

const ProductFormModal: React.FC<ProductFormModalProps> = ({ isOpen, onClose, product, onSave }) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    category: '',
    shortDescription: '',
    fullDescription: '',
    unit: 'piece',
    referencePrice: undefined,
    referencePriceCurrency: 'USD',
    photos: [],
    tags: [],
    specifications: {},
    relatedProducts: [],
    status: 'active',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [specKey, setSpecKey] = useState('');
  const [specValue, setSpecValue] = useState('');
  const autoSaveRef = useRef<import('../services/autoSaveService').AutoSaveService | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load current user ID
  useEffect(() => {
    const loadUserId = async () => {
      try {
        const { loadUserSession } = await import('../services/securityService');
        const user = await loadUserSession();
        setCurrentUserId(user?.id || null);
      } catch (error) {
        console.error('[ProductFormModal] Failed to load user ID:', error);
      }
    };
    loadUserId();
  }, []);

  // Initialize auto-save
  useEffect(() => {
    if (!isOpen) return;

    const initAutoSave = async () => {
      const { AutoSaveService } = await import('../services/autoSaveService');
      const draftKey = product ? `product_draft_${product.id}` : 'product_draft_new';
      
      autoSaveRef.current = new AutoSaveService(
        async (data) => {
          AutoSaveService.saveDraft(draftKey, data, currentUserId || undefined);
        },
        { debounceMs: 30000, saveOnBlur: true, saveOnUnload: true }
      );

      // Load draft if exists
      const draft = AutoSaveService.loadDraft(draftKey, currentUserId || undefined);
      if (draft && !product) {
        setFormData(draft);
        console.log('[ProductFormModal] Draft restored');
      }
    };

    initAutoSave();

    return () => {
      if (autoSaveRef.current) {
        autoSaveRef.current.destroy();
        autoSaveRef.current = null;
      }
    };
  }, [isOpen, product, currentUserId]);

  useEffect(() => {
    if (product) {
      setFormData({
        ...product,
        photos: product.photos || [],
        relatedProducts: product.relatedProducts || [],
      });
      // Clear draft when editing existing product
      if (autoSaveRef.current && currentUserId) {
        const { AutoSaveService } = require('../services/autoSaveService');
        AutoSaveService.clearDraft(`product_draft_${product.id}`, currentUserId);
      }
    } else {
      // Try to load draft for new product
      const { AutoSaveService } = require('../services/autoSaveService');
      const draft = AutoSaveService.loadDraft('product_draft_new', currentUserId || undefined);
      if (draft) {
        setFormData(draft);
        console.log('[ProductFormModal] Draft restored for new product');
      } else {
        setFormData({
          name: '',
          category: '',
          shortDescription: '',
          fullDescription: '',
          unit: 'piece',
          referencePrice: undefined,
          referencePriceCurrency: 'USD',
          photos: [],
          tags: [],
          specifications: {},
          relatedProducts: [],
          status: 'active',
        });
      }
    }
    setErrors([]);
  }, [product, isOpen, currentUserId]);

  const handleInputChange = (field: keyof Product, value: any) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Trigger auto-save
      if (autoSaveRef.current) {
        autoSaveRef.current.triggerSave(updated);
      }
      return updated;
    });
    setErrors([]);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => {
        const updated = {
          ...prev,
          tags: [...(prev.tags || []), newTag.trim()],
        };
        // Trigger auto-save
        if (autoSaveRef.current) {
          autoSaveRef.current.triggerSave(updated);
        }
        return updated;
      });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => {
      const updated = {
        ...prev,
        tags: prev.tags?.filter(t => t !== tag) || [],
      };
      // Trigger auto-save
      if (autoSaveRef.current) {
        autoSaveRef.current.triggerSave(updated);
      }
      return updated;
    });
  };

  const handleAddSpec = () => {
    if (specKey.trim() && specValue.trim()) {
      setFormData(prev => {
        const updated = {
          ...prev,
          specifications: {
            ...(prev.specifications || {}),
            [specKey.trim()]: specValue.trim(),
          },
        };
        // Trigger auto-save
        if (autoSaveRef.current) {
          autoSaveRef.current.triggerSave(updated);
        }
        return updated;
      });
      setSpecKey('');
      setSpecValue('');
    }
  };

  const handleRemoveSpec = (key: string) => {
    const newSpecs = { ...formData.specifications };
    delete newSpecs[key];
    setFormData(prev => {
      const updated = { ...prev, specifications: newSpecs };
      // Trigger auto-save
      if (autoSaveRef.current) {
        autoSaveRef.current.triggerSave(updated);
      }
      return updated;
    });
  };

  const handleSave = async () => {
    setErrors([]);
    
    // Detailed validation with helpful messages
    const validationErrors: string[] = [];
    
    // Required field checks
    if (!formData.name || formData.name.trim().length === 0) {
      validationErrors.push('Product Name is required');
    } else if (formData.name.length > 200) {
      validationErrors.push('Product Name must be less than 200 characters');
    }
    
    if (!formData.category || formData.category.trim().length === 0) {
      validationErrors.push('Category is required');
    }
    
    if (!formData.shortDescription || formData.shortDescription.trim().length === 0) {
      validationErrors.push('Short Description is required');
    } else if (formData.shortDescription.length > 500) {
      validationErrors.push('Short Description must be less than 500 characters');
    }
    
    // Full description is optional but recommended
    if (formData.fullDescription && formData.fullDescription.length > 5000) {
      validationErrors.push('Full Description must be less than 5000 characters');
    }
    
    // Unit validation
    if (!formData.unit || formData.unit.trim().length === 0) {
      validationErrors.push('Unit is required (e.g., piece, kg, liter)');
    }
    
    // Tags validation
    if (formData.tags && formData.tags.length > 20) {
      validationErrors.push('Maximum 20 tags allowed');
    }
    
    // Run standard validation as well
    const validation = validateProduct(formData);
    if (!validation.isValid) {
      validationErrors.push(...validation.errors);
    }
    
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setSaving(true);
      
      // Ensure fullDescription is set (use shortDescription as fallback)
      if (!formData.fullDescription || formData.fullDescription.trim() === '') {
        formData.fullDescription = formData.shortDescription || '';
      }

      // Prepare product data (remove old 'active' field if present, ensure status is set)
      const productData: Partial<Product> = {
        ...formData,
        name: formData.name?.trim() || '',
        category: formData.category?.trim() || '',
        shortDescription: formData.shortDescription?.trim() || '',
        fullDescription: formData.fullDescription?.trim() || formData.shortDescription?.trim() || '',
        unit: formData.unit || 'piece',
        status: formData.status || 'active',
        photos: formData.photos || [],
        tags: formData.tags || [],
        specifications: formData.specifications || {},
        relatedProducts: formData.relatedProducts || [],
        referencePrice: formData.referencePrice,
        referencePriceCurrency: formData.referencePriceCurrency || 'USD',
        // Remove old 'active' field if migrating
        active: undefined,
      };

      if (product) {
        await ProductCatalogService.updateProduct(product.id, productData);
        Logger.info('[ProductFormModal] Product updated successfully');
        // Clear draft after successful save
        if (currentUserId) {
          const { AutoSaveService } = await import('../services/autoSaveService');
          AutoSaveService.clearDraft(`product_draft_${product.id}`, currentUserId);
        }
      } else {
        const newProduct = await ProductCatalogService.addProduct({
          ...productData,
          photos: [], // Photos will be added after product is created
        } as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>);
        Logger.info('[ProductFormModal] Product added successfully');
        // Clear draft after successful save
        if (currentUserId) {
          const { AutoSaveService } = await import('../services/autoSaveService');
          AutoSaveService.clearDraft('product_draft_new', currentUserId);
        }
      }
      onSave();
    } catch (error: any) {
      const errorMessage = error?.message || 'Failed to save product';
      Logger.error('[ProductFormModal] Save error:', error);
      setErrors([`Error: ${errorMessage}. Please check the console for more details.`]);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] my-4 flex flex-col">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center shrink-0">
          <h3 className="text-lg font-bold text-slate-800">
            {product ? 'Edit Product' : 'Add Product'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4 min-h-0">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <div className="text-red-600 font-semibold">⚠️ Validation Errors:</div>
              </div>
              <ul className="list-disc list-inside space-y-1">
              {errors.map((error, i) => (
                  <li key={i} className="text-sm text-red-700">{error}</li>
              ))}
              </ul>
              <div className="mt-3 text-xs text-red-600">
                <strong>Required fields:</strong> Product Name, Category, Short Description, Unit
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter product name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.category || ''}
              onChange={(e) => handleInputChange('category', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., Electronics, Food, Textiles"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Short Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.shortDescription || ''}
              onChange={(e) => handleInputChange('shortDescription', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Brief description for AI search and messaging"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Description <span className="text-slate-400 text-xs">(Optional but recommended)</span>
            </label>
            <textarea
              value={formData.fullDescription || ''}
              onChange={(e) => handleInputChange('fullDescription', e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Detailed product description for AI to use in messaging (will use Short Description if left empty)"
            />
            <p className="text-xs text-slate-500 mt-1">This description helps AI understand the product better for customer conversations. If empty, Short Description will be used.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Unit <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.unit || 'piece'}
                onChange={(e) => handleInputChange('unit', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="piece">Piece</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="g">Gram (g)</option>
                <option value="liter">Liter</option>
                <option value="ml">Milliliter (ml)</option>
                <option value="box">Box</option>
                <option value="packet">Packet</option>
                <option value="MT">Metric Ton (MT)</option>
                <option value="dozen">Dozen</option>
                <option value="set">Set</option>
                <option value="pair">Pair</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                value={formData.status || 'active'}
                onChange={(e) => handleInputChange('status', e.target.value as 'active' | 'inactive')}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Reference Price (for AI context only)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.referencePrice || ''}
                onChange={(e) => handleInputChange('referencePrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="0.00"
              />
              <p className="text-xs text-slate-500 mt-1">AI will use this for context, but never quote it directly</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Currency
              </label>
              <select
                value={formData.referencePriceCurrency || 'USD'}
                onChange={(e) => handleInputChange('referencePriceCurrency', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="CNY">CNY (¥)</option>
              </select>
            </div>
          </div>

          {/* Photo Gallery - Show after product is created */}
          {product && product.id && (
            <ProductPhotoGallery
              productId={product.id}
              photos={formData.photos || []}
              onPhotosChange={(photos) => handleInputChange('photos', photos)}
            />
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Tags (for AI search)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Add tag and press Enter"
              />
              <button
                onClick={handleAddTag}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags?.map((tag, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded text-sm"
                >
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Specifications (Key-Value pairs)
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <input
                type="text"
                value={specKey}
                onChange={(e) => setSpecKey(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Key (e.g., Weight)"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  value={specValue}
                  onChange={(e) => setSpecValue(e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  placeholder="Value (e.g., 500g)"
                />
                <button
                  onClick={handleAddSpec}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {Object.entries(formData.specifications || {}).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between p-2 bg-slate-50 rounded">
                  <span className="text-sm">
                    <strong>{key}:</strong> {value}
                  </span>
                  <button
                    onClick={() => handleRemoveSpec(key)}
                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Related Products - Simple implementation, can be enhanced with autocomplete */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Related Products (Product IDs)
            </label>
            <input
              type="text"
              value={formData.relatedProducts?.join(', ') || ''}
              onChange={(e) => {
                const ids = e.target.value.split(',').map(id => id.trim()).filter(id => id);
                handleInputChange('relatedProducts', ids);
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter product IDs separated by commas"
            />
            <p className="text-xs text-slate-500 mt-1">Products frequently bought together (comma-separated product IDs)</p>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium disabled:bg-slate-400"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductFormModal;

