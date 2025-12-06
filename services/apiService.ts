/**
 * API Service for making REST API calls to the backend server
 */

// Detect if running on Cloudflare Pages
const isCloudflarePages = typeof window !== 'undefined' && 
  (window.location.hostname.includes('pages.dev') || 
   window.location.hostname.includes('cloudflarepages.com'));

// Use relative URLs for Cloudflare Pages (middleware will proxy to Back4App)
// Otherwise use explicit API URL or empty string for relative URLs
const API_BASE_URL = process.env.REACT_APP_API_URL || (isCloudflarePages ? '' : '');

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Add Parse session token if available
    const sessionToken = localStorage.getItem('parse_session_token');
    if (sessionToken) {
      defaultHeaders['X-Parse-Session-Token'] = sessionToken;
    }

    // Add user ID from session if available
    try {
      const sessionData = localStorage.getItem('web_secure_globalreach_user_session');
      if (sessionData) {
        const parsed = JSON.parse(atob(sessionData));
        if (parsed && parsed.user && parsed.user.id) {
          defaultHeaders['X-User-Id'] = parsed.user.id;
        }
      }
    } catch (error) {
      // Ignore errors getting user ID
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

export const apiService = new ApiService();





