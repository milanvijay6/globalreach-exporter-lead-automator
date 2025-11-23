import { Logger } from './loggerService';

export enum ErrorCode {
  // Credential errors
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  MISSING_CREDENTIALS = 'MISSING_CREDENTIALS',
  EXPIRED_TOKEN = 'EXPIRED_TOKEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  
  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT = 'TIMEOUT',
  CONNECTION_FAILED = 'CONNECTION_FAILED',
  
  // Provider errors
  QUOTA_EXCEEDED = 'QUOTA_EXCEEDED',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  PROVIDER_ERROR = 'PROVIDER_ERROR',
  OAUTH_ERROR = 'OAUTH_ERROR',
  
  // Validation errors
  INVALID_EMAIL = 'INVALID_EMAIL',
  INVALID_URL = 'INVALID_URL',
  INVALID_STATE = 'INVALID_STATE',
  
  // System errors
  STORAGE_ERROR = 'STORAGE_ERROR',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface ErrorInfo {
  code: ErrorCode;
  message: string;
  retryable: boolean;
  userMessage: string;
  fallbackOptions?: string[];
  helpUrl?: string;
}

/**
 * Error Handler Service
 * Maps errors to user-friendly messages and provides fallback options
 */
export const ErrorHandlerService = {
  /**
   * Handles authentication errors and maps to user-friendly messages
   */
  handleAuthError: (error: any, context?: {
    provider?: 'gmail' | 'outlook' | 'custom';
    method?: 'oauth' | 'magic-link' | 'imap' | 'smtp';
  }): ErrorInfo => {
    const errorMessage = error?.message || String(error);
    const errorCode = ErrorHandlerService.detectErrorCode(error, errorMessage);

    const errorInfo: ErrorInfo = {
      code: errorCode,
      message: errorMessage,
      retryable: ErrorHandlerService.isRetryable(errorCode),
      userMessage: ErrorHandlerService.getUserMessage(errorCode, errorMessage, context),
      fallbackOptions: ErrorHandlerService.getFallbackOptions(errorCode, context),
      helpUrl: ErrorHandlerService.getHelpUrl(errorCode),
    };

    Logger.error('[ErrorHandler] Auth error handled', {
      code: errorCode,
      provider: context?.provider,
      method: context?.method,
    });

    return errorInfo;
  },

  /**
   * Detects error code from error object or message
   */
  detectErrorCode: (error: any, message: string): ErrorCode => {
    const lowerMessage = message.toLowerCase();

    // Credential errors
    if (
      lowerMessage.includes('invalid credentials') ||
      lowerMessage.includes('authentication failed') ||
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('401')
    ) {
      return ErrorCode.INVALID_CREDENTIALS;
    }

    if (
      lowerMessage.includes('expired') ||
      lowerMessage.includes('token expired')
    ) {
      return ErrorCode.EXPIRED_TOKEN;
    }

    if (
      lowerMessage.includes('invalid token') ||
      lowerMessage.includes('malformed token')
    ) {
      return ErrorCode.INVALID_TOKEN;
    }

    // Network errors
    if (
      lowerMessage.includes('network') ||
      lowerMessage.includes('fetch failed') ||
      lowerMessage.includes('econnrefused') ||
      lowerMessage.includes('enotfound')
    ) {
      return ErrorCode.NETWORK_ERROR;
    }

    if (
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('timed out')
    ) {
      return ErrorCode.TIMEOUT;
    }

    if (
      lowerMessage.includes('connection') ||
      lowerMessage.includes('connect econnrefused')
    ) {
      return ErrorCode.CONNECTION_FAILED;
    }

    // Provider errors
    if (
      lowerMessage.includes('quota') ||
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('429')
    ) {
      if (lowerMessage.includes('quota')) {
        return ErrorCode.QUOTA_EXCEEDED;
      }
      return ErrorCode.RATE_LIMIT_EXCEEDED;
    }

    if (
      lowerMessage.includes('oauth') ||
      lowerMessage.includes('authorization')
    ) {
      return ErrorCode.OAUTH_ERROR;
    }

    // Validation errors
    if (lowerMessage.includes('invalid email')) {
      return ErrorCode.INVALID_EMAIL;
    }

    if (lowerMessage.includes('invalid url') || lowerMessage.includes('malformed url')) {
      return ErrorCode.INVALID_URL;
    }

    if (lowerMessage.includes('invalid state') || lowerMessage.includes('state mismatch')) {
      return ErrorCode.INVALID_STATE;
    }

    // System errors
    if (lowerMessage.includes('storage') || lowerMessage.includes('save failed')) {
      return ErrorCode.STORAGE_ERROR;
    }

    if (lowerMessage.includes('encryption') || lowerMessage.includes('decrypt')) {
      return ErrorCode.ENCRYPTION_ERROR;
    }

    return ErrorCode.UNKNOWN_ERROR;
  },

  /**
   * Determines if an error is retryable
   */
  isRetryable: (code: ErrorCode): boolean => {
    const retryableCodes = [
      ErrorCode.NETWORK_ERROR,
      ErrorCode.TIMEOUT,
      ErrorCode.CONNECTION_FAILED,
      ErrorCode.RATE_LIMIT_EXCEEDED,
      ErrorCode.EXPIRED_TOKEN,
      ErrorCode.STORAGE_ERROR,
    ];

    return retryableCodes.includes(code);
  },

  /**
   * Gets user-friendly error message
   */
  getUserMessage: (
    code: ErrorCode,
    originalMessage: string,
    context?: {
      provider?: 'gmail' | 'outlook' | 'custom';
      method?: 'oauth' | 'magic-link' | 'imap' | 'smtp';
    }
  ): string => {
    const providerName = context?.provider === 'gmail' ? 'Gmail' :
                         context?.provider === 'outlook' ? 'Outlook' : 'email provider';

    switch (code) {
      case ErrorCode.INVALID_CREDENTIALS:
        return `Invalid ${providerName} credentials. Please check your username and password, or reconnect your account.`;
      
      case ErrorCode.MISSING_CREDENTIALS:
        return `Missing ${providerName} credentials. Please provide your login information.`;
      
      case ErrorCode.EXPIRED_TOKEN:
        return `Your ${providerName} connection has expired. Please reconnect your account.`;
      
      case ErrorCode.INVALID_TOKEN:
        return `Invalid authentication token. Please try connecting again.`;
      
      case ErrorCode.NETWORK_ERROR:
        return `Network connection error. Please check your internet connection and try again.`;
      
      case ErrorCode.TIMEOUT:
        return `Connection timed out. Please try again.`;
      
      case ErrorCode.CONNECTION_FAILED:
        return `Failed to connect to ${providerName}. Please check your internet connection.`;
      
      case ErrorCode.QUOTA_EXCEEDED:
        return `${providerName} quota exceeded. Please try again later or upgrade your account.`;
      
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return `Too many requests. Please wait a few minutes and try again.`;
      
      case ErrorCode.OAUTH_ERROR:
        return `OAuth authentication failed. Please try connecting again.`;
      
      case ErrorCode.INVALID_EMAIL:
        return `Invalid email address. Please check the email format.`;
      
      case ErrorCode.INVALID_URL:
        return `Invalid link. Please use the link provided in the email.`;
      
      case ErrorCode.INVALID_STATE:
        return `Security validation failed. Please try the connection process again.`;
      
      case ErrorCode.STORAGE_ERROR:
        return `Failed to save settings. Please check available disk space.`;
      
      case ErrorCode.ENCRYPTION_ERROR:
        return `Security error. Please try again.`;
      
      default:
        return `An error occurred: ${originalMessage}. Please try again or contact support if the problem persists.`;
    }
  },

  /**
   * Gets fallback options for an error
   */
  getFallbackOptions: (
    code: ErrorCode,
    context?: {
      provider?: 'gmail' | 'outlook' | 'custom';
      method?: 'oauth' | 'magic-link' | 'imap' | 'smtp';
    }
  ): string[] => {
    const options: string[] = [];

    switch (code) {
      case ErrorCode.INVALID_CREDENTIALS:
      case ErrorCode.MISSING_CREDENTIALS:
        if (context?.method === 'oauth') {
          options.push('Try manual credential entry (IMAP/SMTP)');
        } else {
          options.push('Try OAuth authentication');
        }
        options.push('Verify credentials in provider settings');
        break;

      case ErrorCode.EXPIRED_TOKEN:
      case ErrorCode.INVALID_TOKEN:
        options.push('Reconnect your account');
        options.push('Check provider account status');
        break;

      case ErrorCode.NETWORK_ERROR:
      case ErrorCode.TIMEOUT:
      case ErrorCode.CONNECTION_FAILED:
        options.push('Check internet connection');
        options.push('Try again in a few moments');
        options.push('Check firewall settings');
        break;

      case ErrorCode.QUOTA_EXCEEDED:
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        options.push('Wait 15 minutes and try again');
        options.push('Check provider account limits');
        break;

      case ErrorCode.OAUTH_ERROR:
        if (context?.provider === 'gmail' || context?.provider === 'outlook') {
          options.push('Try magic link authentication');
          options.push('Try manual credential entry');
        }
        break;

      default:
        options.push('Try again');
        options.push('Use alternative authentication method');
        options.push('Contact support');
    }

    return options;
  },

  /**
   * Gets help URL for an error
   */
  getHelpUrl: (code: ErrorCode): string | undefined => {
    const baseUrl = 'https://support.globalreach.app';
    
    const helpUrls: Record<ErrorCode, string> = {
      [ErrorCode.INVALID_CREDENTIALS]: `${baseUrl}/auth/invalid-credentials`,
      [ErrorCode.EXPIRED_TOKEN]: `${baseUrl}/auth/expired-token`,
      [ErrorCode.NETWORK_ERROR]: `${baseUrl}/troubleshooting/network`,
      [ErrorCode.QUOTA_EXCEEDED]: `${baseUrl}/troubleshooting/quota`,
      [ErrorCode.OAUTH_ERROR]: `${baseUrl}/auth/oauth-issues`,
      [ErrorCode.INVALID_EMAIL]: `${baseUrl}/auth/email-format`,
      [ErrorCode.STORAGE_ERROR]: `${baseUrl}/troubleshooting/storage`,
      [ErrorCode.ENCRYPTION_ERROR]: `${baseUrl}/troubleshooting/security`,
      [ErrorCode.UNKNOWN_ERROR]: `${baseUrl}/support`,
      // Add defaults for others
      [ErrorCode.MISSING_CREDENTIALS]: `${baseUrl}/auth/setup`,
      [ErrorCode.INVALID_TOKEN]: `${baseUrl}/auth/token-issues`,
      [ErrorCode.TIMEOUT]: `${baseUrl}/troubleshooting/timeout`,
      [ErrorCode.CONNECTION_FAILED]: `${baseUrl}/troubleshooting/connection`,
      [ErrorCode.RATE_LIMIT_EXCEEDED]: `${baseUrl}/troubleshooting/rate-limit`,
      [ErrorCode.PROVIDER_ERROR]: `${baseUrl}/troubleshooting/provider`,
      [ErrorCode.INVALID_URL]: `${baseUrl}/auth/link-issues`,
      [ErrorCode.INVALID_STATE]: `${baseUrl}/auth/security`,
    };

    return helpUrls[code];
  },
};

