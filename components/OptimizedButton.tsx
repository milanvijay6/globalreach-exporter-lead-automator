import React, { useState, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { clickFeedback, ClickFeedbackOptions } from '../utils/clickFeedback';

export interface OptimizedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Click handler - can be async */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<void>;
  /** Loading state - if true, shows spinner and disables button */
  loading?: boolean;
  /** Variant style */
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'default';
  /** Children to render */
  children: React.ReactNode;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Custom className */
  className?: string;
  /** Click feedback options */
  feedbackOptions?: ClickFeedbackOptions;
}

/**
 * Optimized Button Component
 * Provides instant visual feedback, loading states, and prevents double-clicks
 */
export const OptimizedButton: React.FC<OptimizedButtonProps> = ({
  onClick,
  loading = false,
  disabled = false,
  variant = 'default',
  size = 'md',
  children,
  className = '',
  feedbackOptions,
  ...props
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const processingRef = useRef(false);

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLButtonElement>) => {
    // Prevent clicks if already processing or disabled
    if (processingRef.current || disabled || loading) {
      e.preventDefault();
      return;
    }

    // Apply instant visual feedback
    if (buttonRef.current) {
      clickFeedback(buttonRef.current, feedbackOptions);
    }

    // If no onClick, just return
    if (!onClick) {
      return;
    }

    // Mark as processing
    processingRef.current = true;
    setIsProcessing(true);

    try {
      const result = onClick(e);
      
      // If async, wait for it
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      console.error('[OptimizedButton] Click handler error:', error);
      // Re-throw so parent can handle if needed
      throw error;
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  }, [onClick, disabled, loading, feedbackOptions]);

  const isDisabled = disabled || loading || isProcessing;

  // Variant styles
  const variantStyles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-indigo-300',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:bg-slate-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 disabled:text-slate-300',
    default: 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:bg-slate-50 disabled:text-slate-300'
  };

  // Size styles
  const sizeStyles = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };

  return (
    <button
      ref={buttonRef}
      onClick={handleClick}
      disabled={isDisabled}
      className={`
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        rounded-lg
        font-medium
        transition-all
        duration-150
        disabled:cursor-not-allowed
        disabled:opacity-60
        flex items-center justify-center gap-2
        ${className}
      `}
      {...props}
    >
      {(loading || isProcessing) && (
        <Loader2 className="w-4 h-4 animate-spin" />
      )}
      {children}
    </button>
  );
};



