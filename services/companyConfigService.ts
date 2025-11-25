import { PlatformService, isDesktop } from './platformService';
import { CompanyDetails } from '../types';
import { Logger } from './loggerService';

/**
 * Company Configuration Service
 * Handles company details CRUD, file uploads, and validation
 */
export const CompanyConfigService = {
  /**
   * Gets company details from storage
   */
  getCompanyDetails: async (): Promise<CompanyDetails | null> => {
    try {
      const data = await PlatformService.getAppConfig('company_details', null);
      if (!data) return null;
      return typeof data === 'string' ? JSON.parse(data) : data;
    } catch (error) {
      Logger.error('[CompanyConfigService] Failed to load company details:', error);
      return null;
    }
  },

  /**
   * Saves company details to storage
   */
  saveCompanyDetails: async (details: CompanyDetails): Promise<void> => {
    try {
      await PlatformService.setAppConfig('company_details', JSON.stringify(details));
      Logger.info('[CompanyConfigService] Company details saved');
    } catch (error) {
      Logger.error('[CompanyConfigService] Failed to save company details:', error);
      throw error;
    }
  },

  /**
   * Checks if company setup is complete
   */
  isCompanySetupComplete: async (): Promise<boolean> => {
    try {
      const details = await CompanyConfigService.getCompanyDetails();
      if (!details) return false;
      
      // Check if required fields are present
      return !!(
        details.companyName &&
        details.phone &&
        details.email &&
        details.contactPersonName
      );
    } catch (error) {
      Logger.error('[CompanyConfigService] Failed to check setup status:', error);
      return false;
    }
  },

  /**
   * Sets company setup complete flag
   */
  setCompanySetupComplete: async (complete: boolean): Promise<void> => {
    try {
      await PlatformService.setAppConfig('company_setup_complete', complete);
    } catch (error) {
      Logger.error('[CompanyConfigService] Failed to set setup flag:', error);
      throw error;
    }
  },

  /**
   * Uploads company logo
   * Returns file path for storage
   */
  uploadCompanyLogo: async (file: File): Promise<string> => {
    try {
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Logo file size must be less than 5MB');
      }

      const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Supported: PNG, JPEG, GIF, WebP');
      }

      if (isDesktop()) {
        // Electron: Save to userData directory
        const { ipcRenderer } = require('electron');
        const result = await ipcRenderer.invoke('save-company-asset', {
          type: 'logo',
          file: {
            name: file.name,
            path: (file as any).path || null,
            buffer: await file.arrayBuffer(),
          },
        });
        return result.path;
      } else {
        // Web: Create blob URL
        const blob = new Blob([await file.arrayBuffer()], { type: file.type });
        const url = URL.createObjectURL(blob);
        // Store in localStorage as base64 for persistence
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
          reader.onload = () => {
            const base64 = reader.result as string;
            const key = `company_logo_${Date.now()}`;
            localStorage.setItem(key, base64);
            resolve(key);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
    } catch (error: any) {
      Logger.error('[CompanyConfigService] Failed to upload logo:', error);
      throw error;
    }
  },

  /**
   * Uploads company document (registration or certificate)
   */
  uploadCompanyDocument: async (
    file: File,
    type: 'registration' | 'certificate'
  ): Promise<string> => {
    try {
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Document file size must be less than 10MB');
      }

      const validTypes = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'image/jpg',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Supported: PDF, PNG, JPEG, DOC, DOCX');
      }

      if (isDesktop()) {
        // Electron: Save to userData directory
        const { ipcRenderer } = require('electron');
        const result = await ipcRenderer.invoke('save-company-asset', {
          type: type === 'registration' ? 'documents' : 'certificates',
          file: {
            name: file.name,
            path: (file as any).path || null,
            buffer: await file.arrayBuffer(),
          },
        });
        return result.path;
      } else {
        // Web: Create blob URL and store reference
        const blob = new Blob([await file.arrayBuffer()], { type: file.type });
        const url = URL.createObjectURL(blob);
        const reader = new FileReader();
        return new Promise((resolve, reject) => {
          reader.onload = () => {
            const base64 = reader.result as string;
            const key = `company_${type}_${Date.now()}`;
            localStorage.setItem(key, base64);
            resolve(key);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }
    } catch (error: any) {
      Logger.error('[CompanyConfigService] Failed to upload document:', error);
      throw error;
    }
  },

  /**
   * Validates company details
   */
  validateCompanyDetails: (details: Partial<CompanyDetails>): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!details.companyName || details.companyName.trim().length === 0) {
      errors.push('Company name is required');
    }

    if (!details.phone || details.phone.trim().length === 0) {
      errors.push('Phone number is required');
    } else {
      // Basic phone validation (allows international formats)
      const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
      if (!phoneRegex.test(details.phone.replace(/\s/g, ''))) {
        errors.push('Invalid phone number format');
      }
    }

    if (!details.email || details.email.trim().length === 0) {
      errors.push('Email is required');
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(details.email)) {
        errors.push('Invalid email format');
      }
    }

    if (!details.contactPersonName || details.contactPersonName.trim().length === 0) {
      errors.push('Contact person name is required');
    }

    if (details.websiteUrl && details.websiteUrl.trim().length > 0) {
      try {
        new URL(details.websiteUrl);
      } catch {
        errors.push('Invalid website URL format');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  /**
   * Creates a new company details object
   */
  createCompanyDetails: (data: Omit<CompanyDetails, 'id' | 'createdAt' | 'updatedAt'>): CompanyDetails => {
    const now = Date.now();
    return {
      ...data,
      id: `company_${now}`,
      createdAt: now,
      updatedAt: now,
    };
  },

  /**
   * Updates existing company details
   */
  updateCompanyDetails: (existing: CompanyDetails, updates: Partial<CompanyDetails>): CompanyDetails => {
    return {
      ...existing,
      ...updates,
      updatedAt: Date.now(),
    };
  },
};

