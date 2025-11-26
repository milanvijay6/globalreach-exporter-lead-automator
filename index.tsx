import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Enhanced global error handler with detailed logging
window.addEventListener('error', (event) => {
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

// Override React error messages to show full details
if (typeof window !== 'undefined') {
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
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
    <div style="padding: 20px; font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
      <h1 style="color: #dc2626;">Application Error</h1>
      <p>Failed to load the application. Please check the console for details.</p>
      <div style="background: #f5f5f5; padding: 15px; border-radius: 4px; margin-top: 15px;">
        <h3 style="margin-top: 0;">Error Details:</h3>
        <pre style="background: #fff; padding: 10px; border-radius: 4px; overflow: auto; font-size: 12px;">${JSON.stringify(errorDetails, null, 2)}</pre>
      </div>
      <button onclick="window.location.reload()" style="margin-top: 15px; padding: 10px 20px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer;">
        Reload Application
      </button>
    </div>
  `;
}