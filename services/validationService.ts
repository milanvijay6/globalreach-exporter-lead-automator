import { ApiKeyProvider, Channel, ValidationResult as ImporterValidationResult } from '../types';
import { Logger } from './loggerService';

/**
 * Validation Service
 * Handles input validation and sanitization for security
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitized?: string;
  }

/**
 * Sanitizes input to prevent XSS and injection attacks
 */
export const sanitizeInput = (input: string, type: 'key' | 'email' | 'url' | 'text' = 'text'): string => {
  if (!input) return '';
  
  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');
  
  // HTML entity encoding for XSS prevention
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
  
  // Remove control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  return sanitized;
};

/**
 * Validates an API key based on provider
 */
export const validateApiKey = (
  provider: ApiKeyProvider,
  keyValue: string
): ValidationResult => {
  const errors: string[] = [];
  
  if (!keyValue || keyValue.trim().length === 0) {
    errors.push('API key cannot be empty');
    return { isValid: false, errors };
  }
  
  // Provider-specific validation
  switch (provider) {
    case ApiKeyProvider.GEMINI:
      // Gemini API keys are typically base64-like strings, 39+ characters
      if (keyValue.length < 20) {
          errors.push('Gemini API key appears to be too short');
      }
      break;
      
    case ApiKeyProvider.WHATSAPP:
      // WhatsApp access tokens are typically long strings
      if (keyValue.length < 20) {
        errors.push('WhatsApp access token appears to be too short');
      }
      break;
      
    case ApiKeyProvider.WECHAT:
      // WeChat AppSecret is typically 32 characters
      if (keyValue.length < 10) {
        errors.push('WeChat AppSecret appears to be too short');
      }
      break;
      
    case ApiKeyProvider.EMAIL_GMAIL:
    case ApiKeyProvider.EMAIL_OUTLOOK:
      // OAuth tokens are typically long strings
      if (keyValue.length < 20) {
        errors.push('OAuth token appears to be too short');
      }
      break;
      
    case ApiKeyProvider.EMAIL_SMTP:
      // SMTP passwords can vary, but should have minimum length
      if (keyValue.length < 8) {
        errors.push('SMTP password should be at least 8 characters');
      }
      break;
      
    case ApiKeyProvider.CUSTOM:
      // Custom keys - minimal validation
      if (keyValue.length < 5) {
        errors.push('Custom API key should be at least 5 characters');
      }
      break;
  }
  
  // Enhanced injection pattern detection
  const injectionPatterns = [
    /<script/i,           // XSS - script tags
    /javascript:/i,        // XSS - javascript protocol
    /on\w+\s*=/i,          // XSS - event handlers
    /union\s+select/i,     // SQL injection
    /drop\s+table/i,      // SQL injection
    /exec\s*\(/i,          // Command injection
    /eval\s*\(/i,          // Code injection
    /<iframe/i,            // XSS - iframe
    /data:text\/html/i,    // XSS - data URI
    /vbscript:/i,          // XSS - VBScript
  ];
  
  for (const pattern of injectionPatterns) {
    if (pattern.test(keyValue)) {
      errors.push('API key contains potentially dangerous characters');
      Logger.warn('[ValidationService] Injection pattern detected in API key', { provider });
      break;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: sanitizeInput(keyValue, 'key'),
  };
};

/**
 * Sanitizes input based on type
 */
export const sanitizeInput = (
  input: string,
  type: 'label' | 'notes' | 'key'
): string => {
  if (!input) return '';
  
  let sanitized = input.trim();
  
  switch (type) {
    case 'label':
      // Labels: allow alphanumeric, spaces, hyphens, underscores
      sanitized = sanitized.replace(/[^a-zA-Z0-9\s\-_]/g, '');
      // Limit length
      sanitized = sanitized.substring(0, 100);
      break;
      
    case 'notes':
      // Notes: allow most characters but remove script tags
      sanitized = sanitized.replace(/<script[^>]*>.*?<\/script>/gi, '');
      sanitized = sanitized.replace(/javascript:/gi, '');
      sanitized = sanitized.replace(/on\w+\s*=/gi, '');
      // Limit length
      sanitized = sanitized.substring(0, 1000);
      break;
      
    case 'key':
      // Keys: remove whitespace and control characters
      sanitized = sanitized.replace(/\s/g, '');
      sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
      break;
  }
  
  return sanitized;
};

/**
 * Validates email address format
 */
export const validateEmail = (email: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!email || email.trim().length === 0) {
    errors.push('Email address cannot be empty');
    return { isValid: false, errors };
  }
  
  // Basic email regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Invalid email address format');
  }
  
  // Check length
  if (email.length > 254) {
    errors.push('Email address is too long');
  }
  
  // Check for dangerous characters
  if (/[<>'"&]/.test(email)) {
    errors.push('Email address contains invalid characters');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: sanitizeInput(email.toLowerCase().trim(), 'key'),
  };
};

/**
 * Validates phone number format (basic)
 */
export const validatePhoneNumber = (phone: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!phone || phone.trim().length === 0) {
    errors.push('Phone number cannot be empty');
    return { isValid: false, errors };
  }
  
  // Remove common formatting characters
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  
  // Check if it's all digits
  if (!/^\d+$/.test(cleaned)) {
    errors.push('Phone number should contain only digits and formatting characters');
  }
  
  // Check length (typically 7-15 digits)
  if (cleaned.length < 7 || cleaned.length > 15) {
    errors.push('Phone number should be between 7 and 15 digits');
    }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: cleaned,
  };
};

/**
 * Validates URL format
 */
export const validateUrl = (url: string): ValidationResult => {
  const errors: string[] = [];
  
  if (!url || url.trim().length === 0) {
    errors.push('URL cannot be empty');
    return { isValid: false, errors };
  }
  
  try {
    const parsed = new URL(url);
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      errors.push('URL must use http or https protocol');
    }
  } catch (error) {
    errors.push('Invalid URL format');
  }
  
  // Check for dangerous patterns
  if (/javascript:|data:|vbscript:/i.test(url)) {
    errors.push('URL contains potentially dangerous protocol');
    }
    
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: url.trim(),
  };
};

/**
 * Validates numeric input
 */
export const validateNumber = (
  value: string | number,
  min?: number,
  max?: number
): ValidationResult => {
  const errors: string[] = [];
  const num = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(num)) {
    errors.push('Value must be a valid number');
    return { isValid: false, errors };
  }
  
  if (min !== undefined && num < min) {
    errors.push(`Value must be at least ${min}`);
  }
  
  if (max !== undefined && num > max) {
    errors.push(`Value must be at most ${max}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: num.toString(),
  };
};

/**
 * Validates that input doesn't contain SQL injection patterns
 */
export const validateNoSqlInjection = (input: string): ValidationResult => {
  const errors: string[] = [];
  
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
    /(\b(UNION|OR|AND)\b.*\b(SELECT|INSERT|UPDATE|DELETE)\b)/i,
    /('|(\\')|(;)|(\\;)|(--)|(\\--)|(\/\*)|(\\\/\*)|(\*\/)|(\\\*\/))/,
  ];
  
  for (const pattern of sqlPatterns) {
    if (pattern.test(input)) {
      errors.push('Input contains potentially dangerous SQL patterns');
      break;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: input,
  };
};

/**
 * Validates that input doesn't contain XSS patterns
 */
export const validateNoXss = (input: string): ValidationResult => {
  const errors: string[] = [];
  
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi,
  ];
  
  for (const pattern of xssPatterns) {
    if (pattern.test(input)) {
      errors.push('Input contains potentially dangerous XSS patterns');
      break;
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    sanitized: sanitizeInput(input, 'notes'),
  };
};

/**
 * Gets the optimal channel based on validation results
 */
export const getOptimalChannel = (validation: ImporterValidationResult): Channel => {
  // Priority: WhatsApp > WeChat > Email
  if (validation.whatsappAvailable === true) {
    return Channel.WHATSAPP;
  }
  if (validation.wechatAvailable === true) {
    return Channel.WECHAT;
  }
  if (validation.emailMxValid === true) {
    return Channel.EMAIL;
  }
  // Default fallback
  return Channel.EMAIL;
};

/**
 * Simulates network validation (for demo/testing purposes)
 */
export const simulateNetworkValidation = async (
  contactDetail: string
): Promise<ImporterValidationResult> => {
  // Simulate async validation
  await new Promise(resolve => setTimeout(resolve, 500));
  
  const isEmail = contactDetail.includes('@');
  const isPhone = /^\+?[\d\s\-\(\)]+$/.test(contactDetail.replace(/\s/g, ''));
  
  return {
    isValid: isEmail || isPhone,
    errors: [],
    emailMxValid: isEmail ? true : null,
    whatsappAvailable: isPhone ? true : null,
    wechatAvailable: isPhone ? true : null,
    checkedAt: Date.now(),
  };
};

/**
 * Validates contact format (email or phone)
 */
export const validateContactFormat = (contact: string): { isValid: boolean; type: 'email' | 'phone' | 'unknown' } => {
  const trimmed = contact.trim();
  
  if (trimmed.includes('@')) {
    const emailResult = validateEmail(trimmed);
    return { isValid: emailResult.isValid, type: 'email' };
  }
  
  if (/^\+?[\d\s\-\(\)]+$/.test(trimmed.replace(/\s/g, ''))) {
    const phoneResult = validatePhoneNumber(trimmed);
    return { isValid: phoneResult.isValid, type: 'phone' };
  }
  
  return { isValid: false, type: 'unknown' };
};

/**
 * Gets initial validation state for a new importer
 */
export const getInitialValidationState = (contactDetail?: string): ImporterValidationResult => {
  // If contact detail provided, do basic validation
  if (contactDetail) {
    const validation = validateContactFormat(contactDetail);
    return {
      isValid: validation.isValid,
      errors: validation.isValid ? [] : ['Invalid contact format'],
      emailMxValid: validation.type === 'email' ? true : null,
      whatsappAvailable: validation.type === 'phone' ? true : null,
      wechatAvailable: validation.type === 'phone' ? true : null,
      checkedAt: Date.now(),
    };
  }
  
  return {
    isValid: false,
    errors: [],
    emailMxValid: null,
    whatsappAvailable: null,
    wechatAvailable: null,
    checkedAt: Date.now(),
  };
};
