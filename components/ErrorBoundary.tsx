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
    // Log error to error reporting service in production
    if (process.env.NODE_ENV === 'production') {
      console.error('[ErrorBoundary] Caught error:', error, errorInfo);
      // TODO: Send to error tracking service (e.g., Sentry)
    } else {
      console.error('[ErrorBoundary] Development error:', error, errorInfo);
    }

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
              <details className="mb-6">
                <summary className="text-sm font-medium text-slate-700 cursor-pointer mb-2">
                  Stack Trace (Development Only)
                </summary>
                <pre className="bg-slate-900 text-green-400 p-4 rounded-lg text-xs overflow-auto max-h-64 font-mono">
                  {this.state.error?.stack}
                  {'\n\n'}
                  {this.state.errorInfo.componentStack}
                </pre>
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

