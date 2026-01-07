/**
 * Click Feedback Utility
 * Provides instant visual feedback (<16ms) for click interactions
 */

export interface ClickFeedbackOptions {
  /** Debounce time in milliseconds (default: 300ms) */
  debounceMs?: number;
  /** Opacity to apply during feedback (default: 0.6) */
  opacity?: number;
  /** Callback when click is processed */
  onProcess?: () => void;
}

export interface ClickFeedbackReturn {
  /** Cleanup function to restore element */
  cleanup: () => void;
  /** Whether the click was debounced (ignored) */
  debounced: boolean;
}

/**
 * Provides instant visual feedback for a click event
 * Uses requestAnimationFrame for sub-16ms response time
 */
export function clickFeedback(
  element: HTMLElement | null,
  options: ClickFeedbackOptions = {}
): ClickFeedbackReturn {
  if (!element) {
    return { cleanup: () => {}, debounced: false };
  }

  const {
    debounceMs = 300,
    opacity = 0.6,
    onProcess
  } = options;

  // Debounce tracking
  const lastClickTime = (element as any).__lastClickTime || 0;
  const now = Date.now();
  const timeSinceLastClick = now - lastClickTime;

  if (timeSinceLastClick < debounceMs) {
    return { cleanup: () => {}, debounced: true };
  }

  (element as any).__lastClickTime = now;

  // Store original styles
  const originalPointerEvents = element.style.pointerEvents;
  const originalOpacity = element.style.opacity;
  const originalTransition = element.style.transition;

  // Apply instant feedback using requestAnimationFrame for <16ms response
  requestAnimationFrame(() => {
    element.style.pointerEvents = 'none';
    element.style.opacity = String(opacity);
    // Use fast transition for smooth feedback
    element.style.transition = 'opacity 0.1s ease-out';
  });

  // Call onProcess callback
  if (onProcess) {
    requestAnimationFrame(() => {
      onProcess();
    });
  }

  // Cleanup function to restore element
  const cleanup = () => {
    requestAnimationFrame(() => {
      element.style.pointerEvents = originalPointerEvents || '';
      element.style.opacity = originalOpacity || '';
      element.style.transition = originalTransition || '';
    });
  };

  // Auto-cleanup after short delay (for async operations)
  setTimeout(() => {
    cleanup();
  }, 150);

  return { cleanup, debounced: false };
}

/**
 * Hook-style click feedback that can be used directly in event handlers
 */
export function useClickFeedback(
  handler: (e: React.MouseEvent) => void | Promise<void>,
  options: ClickFeedbackOptions = {}
) {
  return async (e: React.MouseEvent<HTMLElement>) => {
    const target = e.currentTarget as HTMLElement;
    const feedback = clickFeedback(target, options);

    if (feedback.debounced) {
      return; // Ignore debounced clicks
    }

    try {
      const result = handler(e);
      if (result instanceof Promise) {
        // For async operations, keep feedback until promise resolves
        await result;
        feedback.cleanup();
      } else {
        // Sync operations, let auto-cleanup handle it
      }
    } catch (error) {
      feedback.cleanup();
      throw error;
    }
  };
}



