/**
 * API Service - Handles all REST API calls to the backend
 * Replaces Electron IPC calls for web deployment
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

// Get session token from localStorage or Parse
function getSessionToken(): string | null {
  if (typeof window !== 'undefined') {
    // Try Parse session token first
    const parseUser = (window as any).Parse?.User?.current();
    if (parseUser) {
      return parseUser.getSessionToken();
    }
    // Fallback to localStorage
    return localStorage.getItem('sessionToken');
  }
  return null;
}

// Make authenticated API request
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const sessionToken = getSessionToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (sessionToken) {
    headers['X-Parse-Session-Token'] = sessionToken;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || error.message || 'Request failed');
  }
  
  return response.json();
}

export const ApiService = {
  // Config operations
  getConfig: async (key: string): Promise<any> => {
    try {
      const response = await apiRequest(`/api/config/${key}`);
      return response.value;
    } catch (error) {
      console.error('[ApiService] Error getting config:', error);
      return null;
    }
  },

  setConfig: async (key: string, value: any): Promise<boolean> => {
    try {
      await apiRequest(`/api/config/${key}`, {
        method: 'POST',
        body: JSON.stringify({ value }),
      });
      return true;
    } catch (error) {
      console.error('[ApiService] Error setting config:', error);
      return false;
    }
  },

  // Products
  getProducts: async (filters?: any): Promise<any[]> => {
    const params = new URLSearchParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null) {
          params.append(key, String(filters[key]));
        }
      });
    }
    const response = await apiRequest(`/api/products?${params.toString()}`);
    return response.data || [];
  },

  getProduct: async (id: string): Promise<any> => {
    const response = await apiRequest(`/api/products/${id}`);
    return response.data;
  },

  // Integrations
  getIntegrationAuthUrl: async (service: string): Promise<string> => {
    const response = await apiRequest(`/api/integrations/${service}/authorize`, {
      method: 'POST',
    });
    return response.authUrl;
  },

  exchangeIntegrationCode: async (service: string, code: string, state?: string): Promise<any> => {
    const params = new URLSearchParams({ code });
    if (state) params.append('state', state);
    const response = await apiRequest(`/api/integrations/${service}/callback?${params.toString()}`);
    return response.tokens;
  },

  refreshIntegrationToken: async (service: string, refreshToken: string): Promise<any> => {
    const response = await apiRequest(`/api/integrations/${service}/refresh`, {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
    return response.tokens;
  },

  disconnectIntegration: async (service: string): Promise<void> => {
    await apiRequest(`/api/integrations/${service}/disconnect`, {
      method: 'POST',
    });
  },

  getIntegrationStatus: async (): Promise<any> => {
    const response = await apiRequest('/api/integrations/status');
    return response.status;
  },

  // Leads
  sendLeadMessage: async (leadId: string, message: string): Promise<any> => {
    const response = await apiRequest(`/api/leads/${leadId}/send`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    return response.data;
  },

  // Health check
  healthCheck: async (): Promise<any> => {
    return await apiRequest('/api/health');
  },
};

