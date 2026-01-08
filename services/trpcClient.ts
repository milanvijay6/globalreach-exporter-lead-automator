import { createTRPCReact } from '@trpc/react-query';
import { httpBatchLink } from '@trpc/client';
// Note: AppRouter type would be inferred from the server
// For now, we'll use a generic type since server uses JavaScript

/**
 * tRPC React client
 * Provides type-safe API calls with React Query integration
 */
export const trpc = createTRPCReact<any>();

/**
 * Create tRPC client configuration
 */
export function getTrpcClient() {
  const API_BASE_URL = process.env.REACT_APP_API_URL || '';
  const isCloudflarePages = typeof window !== 'undefined' && 
    (window.location.hostname.includes('pages.dev') || 
     window.location.hostname.includes('cloudflarepages.com'));

  const baseUrl = API_BASE_URL || (isCloudflarePages ? '' : '');

  return trpc.createClient({
    links: [
      httpBatchLink({
        url: `${baseUrl}/api/trpc`,
        headers: () => {
          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };

          // Add Parse session token if available
          const sessionToken = localStorage.getItem('parse_session_token');
          if (sessionToken) {
            headers['X-Parse-Session-Token'] = sessionToken;
          }

          // Add user ID from session if available
          try {
            const sessionData = localStorage.getItem('web_secure_globalreach_user_session');
            if (sessionData) {
              const parsed = JSON.parse(atob(sessionData));
              if (parsed && parsed.user && parsed.user.id) {
                headers['X-User-Id'] = parsed.user.id;
              }
            }
          } catch (error) {
            // Ignore errors getting user ID
          }

          return headers;
        },
        // Batch requests within 10ms window
        maxBatchSize: 10,
      }),
    ],
  });
}

