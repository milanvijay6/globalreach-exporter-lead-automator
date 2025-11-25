import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { ProductPrice, Product } from '../types';
import { ProductPricingService } from '../services/productPricingService';
import { validateProductPrice } from '../services/validationService';
import { Logger } from '../services/loggerService';

interface ProductPriceFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  price?: ProductPrice | null;
  products: Product[];
  onSave: () => void;
}

const ProductPriceFormModal: React.FC<ProductPriceFormModalProps> = ({ isOpen, onClose, price, products, onSave }) => {
  const [formData, setFormData] = useState<Partial<ProductPrice>>({
    productId: '',
    unitOfMeasure: 'piece',
    basePrice: 0,
    wholesalePrice: undefined,
    retailPrice: undefined,
    specialCustomerPrice: undefined,
    currency: 'USD',
    active: true,
    notes: '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (price) {
      setFormData(price);
    } else {
      setFormData({
        productId: '',
        unitOfMeasure: 'piece',
        basePrice: 0,
        wholesalePrice: undefined,
        retailPrice: undefined,
        specialCustomerPrice: undefined,
        currency: 'USD',
        active: true,
        notes: '',
      });
    }
    setErrors([]);
  }, [price, isOpen]);

  const handleInputChange = (field: keyof ProductPrice, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors([]);
  };

  const handleSave = async () => {
    setErrors([]);
    const validation = validateProductPrice(formData);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    try {
      setSaving(true);
      if (price) {
        await ProductPricingService.updatePrice(price.id, formData);
      } else {
        await ProductPricingService.addPrice(formData as Omit<ProductPrice, 'id' | 'lastUpdated' | 'effectiveDate' | 'productName'>);
      }
      Logger.info('[ProductPriceFormModal] Price saved');
      onSave();
    } catch (error: any) {
      setErrors([error.message || 'Failed to save price']);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const selectedProduct = products.find(p => p.id === formData.productId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">
            {price ? 'Edit Price' : 'Add Price'}
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
              Product <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.productId || ''}
              onChange={(e) => handleInputChange('productId', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              disabled={!!price}
            >
              <option value="">Select a product</option>
              {products.map(product => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </select>
            {selectedProduct && (
              <p className="text-xs text-slate-500 mt-1">Category: {selectedProduct.category}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Unit of Measure <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.unitOfMeasure || ''}
              onChange={(e) => handleInputChange('unitOfMeasure', e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="e.g., kg, piece, box, MT"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Base Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.basePrice || 0}
                onChange={(e) => handleInputChange('basePrice', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.currency || 'USD'}
                onChange={(e) => handleInputChange('currency', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="INR">INR</option>
                <option value="GBP">GBP</option>
                <option value="CNY">CNY</option>
                <option value="JPY">JPY</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Wholesale Price
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.wholesalePrice || ''}
                onChange={(e) => handleInputChange('wholesalePrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Retail Price
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.retailPrice || ''}
                onChange={(e) => handleInputChange('retailPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Special Price
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.specialCustomerPrice || ''}
                onChange={(e) => handleInputChange('specialCustomerPrice', e.target.value ? parseFloat(e.target.value) : undefined)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Optional"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Notes
            </label>
            <textarea
              value={formData.notes || ''}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Additional notes about this pricing..."
            />
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
              Price is active
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

export default ProductPriceFormModal;

