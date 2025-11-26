import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches React component errors and displays a user-friendly error UI
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Enhanced error logging with full details
    const errorDetails = {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      errorInfo: {
        componentStack: errorInfo.componentStack,
      },
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    console.error('=== ERROR BOUNDARY CAUGHT ERROR ===');
    console.error('Error Name:', error.name);
    console.error('Error Message:', error.message);
    console.error('Full Error Object:', error);
    console.error('Error Stack:', error.stack);
    console.error('Component Stack:', errorInfo.componentStack);
    console.error('Full Error Details:', errorDetails);
    
    // Special handling for infinite loop errors
    if (error.message?.includes('Maximum update depth') || 
        error.message?.includes('310')) {
      console.error('🚨 INFINITE LOOP ERROR DETECTED 🚨');
      console.error('This error indicates a component is updating state in a loop.');
      console.error('Common causes:');
      console.error('1. useEffect without proper dependencies');
      console.error('2. State update that triggers another state update');
      console.error('3. Event handler that causes re-renders');
      console.error('Check the component stack above to find the problematic component.');
      console.error('Component Stack:', errorInfo.componentStack);
    }
    
    console.error('===================================');

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // Reload the app to clear state
    window.location.reload();
  };

  handleGoHome = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    
    // Navigate to home
    window.location.href = '/';
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isDevelopment = process.env.NODE_ENV === 'development';

      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Something went wrong</h1>
                <p className="text-sm text-slate-600 mt-1">
                  The application encountered an unexpected error
                </p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-slate-700 font-medium mb-2">Error Details:</p>
              <p className="text-sm text-slate-600 font-mono break-words">
                {this.state.error?.message || 'Unknown error occurred'}
              </p>
            </div>

            {isDevelopment && this.state.errorInfo && (
              <details className="mb-6" open>
                <summary className="text-sm font-medium text-slate-700 cursor-pointer mb-2">
                  Detailed Error Information (Development)
                </summary>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1">Error Message:</p>
                    <pre className="bg-slate-900 text-red-400 p-3 rounded-lg text-xs overflow-auto font-mono">
                      {this.state.error?.message || 'Unknown error'}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1">Stack Trace:</p>
                    <pre className="bg-slate-900 text-green-400 p-3 rounded-lg text-xs overflow-auto max-h-64 font-mono">
                      {this.state.error?.stack || 'No stack trace available'}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-1">Component Stack (Where error occurred):</p>
                    <pre className="bg-slate-900 text-yellow-400 p-3 rounded-lg text-xs overflow-auto max-h-64 font-mono">
                      {this.state.errorInfo.componentStack || 'No component stack available'}
                    </pre>
                  </div>
                  {this.state.error?.message?.includes('Maximum update depth') && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-red-800 mb-2">⚠️ Infinite Loop Detected</p>
                      <p className="text-xs text-red-700 mb-2">
                        This error indicates a component is updating state in an infinite loop.
                      </p>
                      <p className="text-xs text-red-700 mb-2">Common causes:</p>
                      <ul className="text-xs text-red-700 list-disc list-inside space-y-1 ml-2">
                        <li>useEffect without proper dependencies or missing cleanup</li>
                        <li>State update that triggers another state update</li>
                        <li>Event handler that causes re-renders</li>
                        <li>Callback function recreated on every render</li>
                      </ul>
                      <p className="text-xs text-red-700 mt-2">
                        Check the component stack above to identify the problematic component.
                      </p>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 px-4 py-2.5 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-xs text-slate-500 text-center">
                If this problem persists, please contact support or check the application logs.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

