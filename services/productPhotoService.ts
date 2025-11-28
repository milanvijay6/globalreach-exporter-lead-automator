import { PlatformService } from './platformService';
import { ProductPhoto } from '../types';
import { Logger } from './loggerService';

/**
 * Product Photo Service
 * Handles photo upload, storage, optimization, and URL generation
 */
export const ProductPhotoService = {
  /**
   * Uploads a photo for a product
   * In Electron: Uses IPC to save file and generate URLs
   * In Web: Uses blob URLs (limited functionality)
   */
  uploadPhoto: async (
    productId: string,
    file: File | { data: Buffer | string; fileName: string; mimeType: string }
  ): Promise<ProductPhoto> => {
    try {
      const photoId = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const uploadedAt = Date.now();

      // Check if we're in Electron environment
      if (typeof window !== 'undefined' && (window as any).electronAPI?.productPhotoUpload) {
        // Electron: Use IPC to handle file upload
        // Convert File to ArrayBuffer/Uint8Array (Buffer is not available in renderer)
        let fileDataArray: number[] | Uint8Array;
        let fileSize: number;
        
        if (file instanceof File) {
          const arrayBuffer = await file.arrayBuffer();
          fileDataArray = new Uint8Array(arrayBuffer);
          fileSize = file.size;
        } else {
          // Handle non-File input (shouldn't happen in normal flow, but handle it)
          if (typeof file.data === 'string') {
            // Base64 string - convert to Uint8Array
            const binaryString = atob(file.data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            fileDataArray = bytes;
            fileSize = bytes.length;
          } else {
            // Already a Buffer-like object (shouldn't happen in renderer)
            throw new Error('Invalid file data format');
          }
        }
        
        const fileName = file instanceof File ? file.name : file.fileName;
        const mimeType = file instanceof File ? file.type : file.mimeType;

        // Send as Array (IPC can't send Uint8Array directly, needs to be converted)
        const result = await (window as any).electronAPI.productPhotoUpload({
          productId,
          photoId,
          fileData: Array.from(fileDataArray),
          fileName,
          mimeType,
        });

        if (result.success) {
          const photo: ProductPhoto = {
            id: photoId,
            url: result.url,
            thumbnailUrl: result.thumbnailUrl,
            fileName,
            fileSize: fileSize,
            mimeType,
            width: result.width,
            height: result.height,
            isPrimary: false, // Will be set by caller if needed
            uploadedAt,
          };
          return photo;
        } else {
          throw new Error(result.error || 'Failed to upload photo');
        }
      } else {
        // Web environment: Use blob URL (temporary, not persistent)
        const fileData = file instanceof File ? file : null;
        if (!fileData) {
          throw new Error('File upload not supported in web environment without Electron');
        }

        const blobUrl = URL.createObjectURL(fileData);
        const photo: ProductPhoto = {
          id: photoId,
          url: blobUrl,
          fileName: fileData.name,
          fileSize: fileData.size,
          mimeType: fileData.type,
          isPrimary: false,
          uploadedAt,
        };
        
        Logger.warn('[ProductPhotoService] Using blob URL (not persistent). Electron required for full functionality.');
        return photo;
      }
    } catch (error: any) {
      Logger.error('[ProductPhotoService] Failed to upload photo:', error);
      throw error;
    }
  },

  /**
   * Deletes a photo
   */
  deletePhoto: async (productId: string, photoId: string): Promise<void> => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.productPhotoDelete) {
        const result = await (window as any).electronAPI.productPhotoDelete({ productId, photoId });
        if (!result.success) {
          throw new Error(result.error || 'Failed to delete photo');
        }
      } else {
        // Web environment: Just log (blob URLs are automatically cleaned up)
        Logger.warn('[ProductPhotoService] Photo deletion not fully supported in web environment');
      }
    } catch (error: any) {
      Logger.error('[ProductPhotoService] Failed to delete photo:', error);
      throw error;
    }
  },

  /**
   * Gets photo URL (public URL for sharing)
   */
  getPhotoUrl: async (productId: string, photoId: string): Promise<string> => {
    try {
      if (typeof window !== 'undefined' && (window as any).electronAPI?.productPhotoGetUrl) {
        const result = await (window as any).electronAPI.productPhotoGetUrl({ productId, photoId });
        if (result.success) {
          return result.url;
        } else {
          throw new Error(result.error || 'Failed to get photo URL');
        }
      } else {
        // Web environment: Return blob URL if available
        throw new Error('Photo URL retrieval requires Electron environment');
      }
    } catch (error: any) {
      Logger.error('[ProductPhotoService] Failed to get photo URL:', error);
      throw error;
    }
  },

  /**
   * Converts file:// URLs to HTTP URLs for display
   * Migrates old file:// URLs to new HTTP-based URLs
   */
  convertFileUrlToHttp: (url: string, port: number = 4000): string => {
    if (!url) return url;
    
    // If already HTTP URL, return as-is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // If file:// URL, extract the file path and convert to HTTP URL
    if (url.startsWith('file://')) {
      // Extract file path from file:// URL
      const filePath = url.replace('file://', '').replace(/\\/g, '/');
      
      // Extract productId and fileName from path
      // Path format: .../product-photos/{productId}/{photoId}_{fileName}
      const match = filePath.match(/product-photos\/([^\/]+)\/([^\/]+)$/);
      if (match) {
        const productId = match[1];
        const fileName = match[2];
        
        return `http://localhost:${port}/api/product-photos/${productId}/${fileName}`;
      }
    }
    
    // Return as-is if can't convert
    return url;
  },

  /**
   * Sets a photo as primary (main product image)
   */
  setPrimaryPhoto: async (productId: string, photoId: string): Promise<void> => {
    try {
      const { ProductCatalogService } = await import('./productCatalogService');
      const product = await ProductCatalogService.getProductById(productId);
      
      if (!product) {
        throw new Error(`Product with id ${productId} not found`);
      }

      // Update all photos: set isPrimary to false, then set the selected one to true
      const updatedPhotos = product.photos.map(photo => ({
        ...photo,
        isPrimary: photo.id === photoId,
      }));

      await ProductCatalogService.updateProduct(productId, { photos: updatedPhotos });
      Logger.info(`[ProductPhotoService] Set photo ${photoId} as primary for product ${productId}`);
    } catch (error: any) {
      Logger.error('[ProductPhotoService] Failed to set primary photo:', error);
      throw error;
    }
  },

  /**
   * Reorders photos (changes order in array)
   */
  reorderPhotos: async (productId: string, photoIds: string[]): Promise<void> => {
    try {
      const { ProductCatalogService } = await import('./productCatalogService');
      const product = await ProductCatalogService.getProductById(productId);
      
      if (!product) {
        throw new Error(`Product with id ${productId} not found`);
      }

      // Create a map for quick lookup
      const photoMap = new Map(product.photos.map(p => [p.id, p]));
      
      // Reorder photos based on provided order
      const reorderedPhotos = photoIds
        .map(id => photoMap.get(id))
        .filter((p): p is ProductPhoto => p !== undefined);

      // Add any photos not in the reorder list at the end
      const remainingPhotos = product.photos.filter(p => !photoIds.includes(p.id));
      reorderedPhotos.push(...remainingPhotos);

      await ProductCatalogService.updateProduct(productId, { photos: reorderedPhotos });
      Logger.info(`[ProductPhotoService] Reordered photos for product ${productId}`);
    } catch (error: any) {
      Logger.error('[ProductPhotoService] Failed to reorder photos:', error);
      throw error;
    }
  },
};

