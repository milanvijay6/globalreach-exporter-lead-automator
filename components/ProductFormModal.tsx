import React, { useState, useEffect } from 'react';
import { X, Save, Tag, Plus, Trash2 } from 'lucide-react';
import { Product } from '../types';
import { ProductCatalogService } from '../services/productCatalogService';
import { validateProduct } from '../services/validationService';
import { Logger } from '../services/loggerService';

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
    tags: [],
    specifications: {},
    active: true,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [specKey, setSpecKey] = useState('');
  const [specValue, setSpecValue] = useState('');

  useEffect(() => {
    if (product) {
      setFormData(product);
    } else {
      setFormData({
        name: '',
        category: '',
        shortDescription: '',
        fullDescription: '',
        tags: [],
        specifications: {},
        active: true,
      });
    }
    setErrors([]);
  }, [product, isOpen]);

  const handleInputChange = (field: keyof Product, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors([]);
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags?.includes(newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...(prev.tags || []), newTag.trim()],
      }));
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags?.filter(t => t !== tag) || [],
    }));
  };

  const handleAddSpec = () => {
    if (specKey.trim() && specValue.trim()) {
      setFormData(prev => ({
        ...prev,
        specifications: {
          ...(prev.specifications || {}),
          [specKey.trim()]: specValue.trim(),
        },
      }));
      setSpecKey('');
      setSpecValue('');
    }
  };

  const handleRemoveSpec = (key: string) => {
    const newSpecs = { ...formData.specifications };
    delete newSpecs[key];
    setFormData(prev => ({ ...prev, specifications: newSpecs }));
  };

  const handleSave = async () => {
    setErrors([]);
    const validation = validateProduct(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    try {
      setSaving(true);
      if (product) {
        await ProductCatalogService.updateProduct(product.id, formData);
      } else {
        await ProductCatalogService.addProduct(formData as Omit<Product, 'id' | 'createdAt' | 'updatedAt'>);
      }
      Logger.info('[ProductFormModal] Product saved');
      onSave();
    } catch (error: any) {
      setErrors([error.message || 'Failed to save product']);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">
            {product ? 'Edit Product' : 'Add Product'}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-3 rounded-lg">
              {errors.map((error, i) => (
                <div key={i} className="text-sm text-red-700">{error}</div>
              ))}
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
              Full Description
            </label>
            <textarea
              value={formData.fullDescription || ''}
              onChange={(e) => handleInputChange('fullDescription', e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Detailed product description"
            />
          </div>

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

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active !== false}
              onChange={(e) => handleInputChange('active', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="active" className="text-sm text-slate-700">
              Product is active
            </label>
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
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

