import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// List of third-party domains that are commonly blocked by browser extensions
// These errors are expected and harmless
const BLOCKED_THIRD_PARTY_DOMAINS = [
  'sentry.io',
  'amplitude.com',
  'logrocket.com',
  'zendesk.com',
  'zopim.com',
  'solucx.com.br',
  'back4app.com',
  'containers.back4app.com',
  'widget-mediator.zopim.com',
  'api.containers.back4app.com'
];

// Intercept fetch errors to filter out blocked requests
if (typeof window !== 'undefined' && typeof fetch !== 'undefined') {
  const originalFetch = window.fetch;
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    try {
      return await originalFetch(...args);
    } catch (error: any) {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      // Suppress errors from blocked third-party domains
      if (BLOCKED_THIRD_PARTY_DOMAINS.some(domain => url.includes(domain))) {
        // Return a rejected promise that won't be logged
        return Promise.reject(new Error('Request blocked by browser extension (expected)'));
      }
      throw error;
    }
  };
}

// Check if an error is from a blocked third-party script
function isBlockedThirdPartyError(event: ErrorEvent | PromiseRejectionEvent): boolean {
  const target = (event as any).target;
  const filename = (event as ErrorEvent).filename || '';
  const message = (event as ErrorEvent).message || String((event as PromiseRejectionEvent).reason || '');
  
  // Check if it's a network error from a blocked resource
  if (message.includes('ERR_BLOCKED_BY_CLIENT') || 
      message.includes('Failed to fetch') ||
      message.includes('Failed to load resource')) {
    // Check if it's from a known third-party domain
    const url = target?.src || target?.href || filename || message;
    return BLOCKED_THIRD_PARTY_DOMAINS.some(domain => url.includes(domain));
  }
  
  // Check WebSocket connection failures to third-party services
  if (message.includes('WebSocket connection') && 
      BLOCKED_THIRD_PARTY_DOMAINS.some(domain => message.includes(domain))) {
    return true;
  }
  
  return false;
}

// Enhanced global error handler with detailed logging
window.addEventListener('error', (event) => {
  // Suppress errors from blocked third-party scripts (browser extensions blocking analytics)
  if (isBlockedThirdPartyError(event)) {
    // Silently ignore - these are expected when ad blockers are active
    return;
  }
  
  const errorDetails = {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error,
    stack: event.error?.stack,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href
  };
  
  console.error('=== GLOBAL ERROR ===');
  console.error('Error Details:', errorDetails);
  console.error('Full Error Object:', event.error);
  console.error('Stack Trace:', event.error?.stack);
  console.error('Component Stack:', (event.error as any)?.componentStack);
  console.error('===================');
  
  // Always show detailed errors in development
  if (process.env.NODE_ENV !== 'production') {
    // Show alert in development for critical errors
    if (event.error?.message?.includes('Maximum update depth') || 
        event.error?.message?.includes('310')) {
      console.error('🚨 INFINITE LOOP DETECTED 🚨');
      console.error('This is likely caused by a useEffect or state update loop.');
      console.error('Check the stack trace above to identify the component.');
    }
  }
});

window.addEventListener('unhandledrejection', (event) => {
  // Suppress promise rejections from blocked third-party scripts
  if (isBlockedThirdPartyError(event)) {
    // Silently ignore - these are expected when ad blockers are active
    return;
  }
  
  const errorDetails = {
    reason: event.reason,
    message: event.reason?.message,
    stack: event.reason?.stack,
    timestamp: new Date().toISOString()
  };
  
  console.error('=== UNHANDLED PROMISE REJECTION ===');
  console.error('Error Details:', errorDetails);
  console.error('Full Error:', event.reason);
  console.error('Stack Trace:', event.reason?.stack);
  console.error('==================================');
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Override console methods to filter out blocked third-party script errors
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  const originalConsoleWarn = console.warn;
  
  // Filter function to check if message is from blocked third-party
  const isBlockedMessage = (message: string): boolean => {
    if (!message) return false;
    const lowerMessage = message.toLowerCase();
    return (
      lowerMessage.includes('err_blocked_by_client') ||
      lowerMessage.includes('failed to fetch') ||
      lowerMessage.includes('failed to load resource') ||
      (lowerMessage.includes('websocket') && BLOCKED_THIRD_PARTY_DOMAINS.some(d => lowerMessage.includes(d.toLowerCase()))) ||
      BLOCKED_THIRD_PARTY_DOMAINS.some(domain => lowerMessage.includes(domain.toLowerCase()))
    );
  };
  
  console.error = (...args: any[]) => {
    // Filter out blocked third-party script errors
    const message = args.map(arg => String(arg)).join(' ');
    if (isBlockedMessage(message)) {
      // Silently ignore - these are expected when ad blockers are active
      return;
    }
    
    // Check for React error #310
    if (args.some(arg => 
      (typeof arg === 'string' && arg.includes('310')) ||
      (typeof arg === 'string' && arg.includes('Maximum update depth'))
    )) {
      console.error('🚨 ============================================');
      console.error('🚨 REACT ERROR #310 - INFINITE LOOP DETECTED');
      console.error('🚨 ============================================');
      console.error('');
      console.error('Full error details:');
      args.forEach((arg, idx) => {
        console.error(`Argument ${idx}:`, arg);
        if (arg instanceof Error) {
          console.error(`  Stack:`, arg.stack);
          console.error(`  Name:`, arg.name);
          console.error(`  Message:`, arg.message);
        }
      });
      console.error('');
      console.error('This error means a component is updating state in a loop.');
      console.error('Common causes:');
      console.error('  1. useEffect without proper dependencies');
      console.error('  2. State update that triggers another state update');
      console.error('  3. Event handler that causes re-renders');
      console.error('  4. Callback function recreated on every render');
      console.error('');
      console.error('Check the stack trace above to find the problematic component.');
      console.error('============================================');
    }
    originalConsoleError.apply(console, args);
  };
  
  console.warn = (...args: any[]) => {
    // Filter out blocked third-party script warnings
    const message = args.map(arg => String(arg)).join(' ');
    if (isBlockedMessage(message)) {
      // Silently ignore - these are expected when ad blockers are active
      return;
    }
    originalConsoleWarn.apply(console, args);
  };
}

// Ensure root element always has content to prevent white screen
if (!rootElement.innerHTML.trim()) {
  rootElement.innerHTML = '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #f1f5f9;"><div style="text-align: center;"><div style="width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div><p style="color: #64748b; font-family: Inter, sans-serif;">Loading GlobalReach...</p></div></div><style>@keyframes spin { to { transform: rotate(360deg); } }</style>';
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  console.error('Failed to render React app:', error);
  const errorDetails = error instanceof Error ? {
    message: error.message,
    stack: error.stack,
    name: error.name
  } : { message: String(error) };
  
  rootElement.innerHTML = `
    <div style="padding: 20px; font-family: Inter, Arial, sans-serif; max-width: 800px; margin: 0 auto; min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f1f5f9;">
      <div style="background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); width: 100%;">
        <h1 style="color: #dc2626; margin: 0 0 8px 0; font-size: 24px; font-weight: 600;">Application Error</h1>
        <p style="color: #64748b; margin: 0 0 24px 0;">Failed to load the application. Please check the console for details.</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #e2e8f0;">
          <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #334155;">Error Details:</h3>
          <pre style="background: #fff; padding: 12px; border-radius: 6px; overflow: auto; font-size: 12px; margin: 0; color: #1e293b; border: 1px solid #e2e8f0;">${JSON.stringify(errorDetails, null, 2)}</pre>
        </div>
        <button onclick="window.location.reload()" style="padding: 12px 24px; background: #4f46e5; color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 500; font-size: 14px; width: 100%;">
          Reload Application
        </button>
      </div>
    </div>
  `;
}