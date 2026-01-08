/**
 * Image Service
 * Handles BlurHash generation and lazy loading for images
 */

import { encode } from 'blurhash';

/**
 * Generate BlurHash from image URL or File
 * Note: This is a client-side implementation
 * For server-side, use the server/utils/blurhash.js utility
 */
export async function generateBlurHash(imageUrl: string | File): Promise<string | null> {
  try {
    let image: HTMLImageElement | ImageBitmap;
    
    if (imageUrl instanceof File) {
      // Create image from File
      const bitmap = await createImageBitmap(imageUrl);
      image = bitmap;
    } else {
      // Load image from URL
      image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageUrl;
      });
    }
    
    // Create canvas to get image data
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    canvas.width = image.width;
    canvas.height = image.height;
    
    if (image instanceof ImageBitmap) {
      ctx.drawImage(image, 0, 0);
    } else {
      ctx.drawImage(image, 0, 0);
    }
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // Generate BlurHash (4x4 components for good quality/size balance)
    const componentX = parseInt(process.env.BLURHASH_COMPONENTS || '4', 10);
    const componentY = parseInt(process.env.BLURHASH_COMPONENTS || '4', 10);
    const blurHash = encode(
      imageData.data,
      imageData.width,
      imageData.height,
      componentX,
      componentY
    );
    
    return blurHash;
  } catch (error) {
    console.error('[ImageService] Error generating BlurHash:', error);
    return null;
  }
}

/**
 * Check if image should be lazy loaded
 */
export function shouldLazyLoad(element: HTMLElement): boolean {
  // Use Intersection Observer to check if element is in viewport
  // This is handled by the LazyImage component
  return true; // Default to lazy loading
}

/**
 * Preload image
 */
export function preloadImage(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = src;
  });
}

