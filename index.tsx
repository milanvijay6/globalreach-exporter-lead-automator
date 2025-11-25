import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

// Global error handler - logs to console in development, to error service in production
window.addEventListener('error', (event) => {
  if (process.env.NODE_ENV === 'production') {
    // In production, send to error tracking service
    console.error('[GlobalError]', event.error);
    // TODO: Send to error tracking service (e.g., Sentry)
  } else {
  console.error('Global error:', event.error);
  }
});

window.addEventListener('unhandledrejection', (event) => {
  if (process.env.NODE_ENV === 'production') {
    // In production, send to error tracking service
    console.error('[UnhandledRejection]', event.reason);
    // TODO: Send to error tracking service (e.g., Sentry)
  } else {
  console.error('Unhandled promise rejection:', event.reason);
  }
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
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
  rootElement.innerHTML = `
    <div style="padding: 20px; font-family: Arial, sans-serif;">
      <h1>Application Error</h1>
      <p>Failed to load the application. Please check the console for details.</p>
      <pre style="background: #f5f5f5; padding: 10px; border-radius: 4px; overflow: auto;">${error instanceof Error ? error.stack : String(error)}</pre>
    </div>
  `;
}