import React, { useState } from 'react';
import { X, Upload, Image as ImageIcon, Trash2, Star, StarOff, GripVertical } from 'lucide-react';
import { ProductPhoto } from '../types';
import { ProductPhotoService } from '../services/productPhotoService';
import { Logger } from '../services/loggerService';

interface ProductPhotoGalleryProps {
  productId: string;
  photos: ProductPhoto[];
  onPhotosChange: (photos: ProductPhoto[]) => void;
  maxPhotos?: number;
}

const ProductPhotoGallery: React.FC<ProductPhotoGalleryProps> = ({
  productId,
  photos,
  onPhotosChange,
  maxPhotos = 10,
}) => {
  const [uploading, setUploading] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<ProductPhoto | null>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > maxPhotos) {
      alert(`Maximum ${maxPhotos} photos allowed. Please remove some photos first.`);
      return;
    }

    setUploading(true);
    const newPhotos: ProductPhoto[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert(`${file.name} is not an image file. Skipping.`);
          continue;
        }

        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name} is too large (max 10MB). Skipping.`);
          continue;
        }

        try {
          const uploadedPhoto = await ProductPhotoService.uploadPhoto(productId, file);
          newPhotos.push(uploadedPhoto);
        } catch (error: any) {
          Logger.error('[ProductPhotoGallery] Failed to upload photo:', error);
          alert(`Failed to upload ${file.name}: ${error.message}`);
        }
      }

      // Set first uploaded photo as primary if no primary exists
      const hasPrimary = photos.some(p => p.isPrimary);
      if (newPhotos.length > 0 && !hasPrimary) {
        newPhotos[0].isPrimary = true;
      }

      onPhotosChange([...photos, ...newPhotos]);
    } catch (error: any) {
      Logger.error('[ProductPhotoGallery] Upload error:', error);
      alert(`Failed to upload photos: ${error.message}`);
    } finally {
      setUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm('Are you sure you want to delete this photo?')) return;

    try {
      await ProductPhotoService.deletePhoto(productId, photoId);
      const updatedPhotos = photos.filter(p => p.id !== photoId);
      
      // If deleted photo was primary, set first remaining photo as primary
      const deletedPhoto = photos.find(p => p.id === photoId);
      if (deletedPhoto?.isPrimary && updatedPhotos.length > 0) {
        updatedPhotos[0].isPrimary = true;
      }

      onPhotosChange(updatedPhotos);
    } catch (error: any) {
      Logger.error('[ProductPhotoGallery] Failed to delete photo:', error);
      alert(`Failed to delete photo: ${error.message}`);
    }
  };

  const handleSetPrimary = async (photoId: string) => {
    try {
      await ProductPhotoService.setPrimaryPhoto(productId, photoId);
      const updatedPhotos = photos.map(p => ({
        ...p,
        isPrimary: p.id === photoId,
      }));
      onPhotosChange(updatedPhotos);
    } catch (error: any) {
      Logger.error('[ProductPhotoGallery] Failed to set primary photo:', error);
      alert(`Failed to set primary photo: ${error.message}`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    if (photos.length + files.length > maxPhotos) {
      alert(`Maximum ${maxPhotos} photos allowed. Please remove some photos first.`);
      return;
    }

    setUploading(true);
    const newPhotos: ProductPhoto[] = [];

    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        if (file.size > 10 * 1024 * 1024) continue;

        try {
          const uploadedPhoto = await ProductPhotoService.uploadPhoto(productId, file);
          newPhotos.push(uploadedPhoto);
        } catch (error: any) {
          Logger.error('[ProductPhotoGallery] Failed to upload photo:', error);
        }
      }

      const hasPrimary = photos.some(p => p.isPrimary);
      if (newPhotos.length > 0 && !hasPrimary) {
        newPhotos[0].isPrimary = true;
      }

      onPhotosChange([...photos, ...newPhotos]);
    } catch (error: any) {
      Logger.error('[ProductPhotoGallery] Drop error:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-semibold text-slate-700">Product Photos</label>
      
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          uploading
            ? 'border-indigo-400 bg-indigo-50'
            : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
        }`}
      >
        <input
          type="file"
          id="photo-upload"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading || photos.length >= maxPhotos}
        />
        <label
          htmlFor="photo-upload"
          className={`cursor-pointer flex flex-col items-center gap-2 ${
            uploading || photos.length >= maxPhotos ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <span className="text-sm text-slate-600">Uploading...</span>
            </>
          ) : (
            <>
              <Upload className="w-8 h-8 text-slate-400" />
              <span className="text-sm text-slate-600">
                {photos.length >= maxPhotos
                  ? `Maximum ${maxPhotos} photos reached`
                  : 'Click to upload or drag and drop images here'}
              </span>
              <span className="text-xs text-slate-400">PNG, JPG, WebP up to 10MB each</span>
            </>
          )}
        </label>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="relative group border border-slate-200 rounded-lg overflow-hidden bg-slate-50"
            >
              <LazyImage
                src={photo.url}
                alt={photo.fileName}
                blurhash={photo.blurhash}
                className="w-full h-32 object-cover cursor-pointer"
                width={undefined}
                height={128}
                onLoad={() => {}}
                onError={() => {}}
              />
              
              {/* Primary Badge */}
              {photo.isPrimary && (
                <div className="absolute top-1 left-1 bg-indigo-600 text-white text-xs px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  Primary
                </div>
              )}

              {/* Actions Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button
                  onClick={() => setPreviewPhoto(photo)}
                  className="p-2 bg-white/90 rounded hover:bg-white transition-colors"
                  title="View"
                >
                  <ImageIcon className="w-4 h-4 text-slate-700" />
                </button>
                {!photo.isPrimary && (
                  <button
                    onClick={() => handleSetPrimary(photo.id)}
                    className="p-2 bg-white/90 rounded hover:bg-white transition-colors"
                    title="Set as Primary"
                  >
                    <StarOff className="w-4 h-4 text-slate-700" />
                  </button>
                )}
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="p-2 bg-red-500/90 rounded hover:bg-red-600 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 bg-black/75 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] bg-white rounded-lg overflow-hidden">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white z-10"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewPhoto.url}
              alt={previewPhoto.fileName}
              className="w-full h-auto max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white p-3 text-sm">
              <p className="font-semibold">{previewPhoto.fileName}</p>
              <p className="text-xs text-slate-300">
                {previewPhoto.fileSize ? `${(previewPhoto.fileSize / 1024).toFixed(1)} KB` : ''}
                {previewPhoto.width && previewPhoto.height
                  ? ` • ${previewPhoto.width} × ${previewPhoto.height}`
                  : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductPhotoGallery;

