const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry (should return a Promise)
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 30000)
 * @param {number} options.multiplier - Backoff multiplier (default: 2)
 * @param {Function} options.shouldRetry - Function to determine if error should be retried (default: retry all)
 * @param {Function} options.onRetry - Callback called on each retry
 * @returns {Promise} Result of the function
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    multiplier = 2,
    shouldRetry = () => true,
    onRetry = null,
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        logger.info(`[Retry] Function succeeded after ${attempt} retries`);
      }
      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (!shouldRetry(error)) {
        logger.warn(`[Retry] Error should not be retried: ${error.message}`);
        throw error;
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        logger.error(`[Retry] Max retries (${maxRetries}) reached, giving up`);
        throw error;
      }

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(error, attempt + 1, delay);
      }

      logger.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed: ${error.message}. Retrying in ${delay}ms...`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * multiplier, maxDelay);
    }
  }

  // Should never reach here, but just in case
  throw lastError;
}

/**
 * Retry with jitter (randomized delay to avoid thundering herd)
 */
async function retryWithJitter(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    multiplier = 2,
    jitter = 0.1, // 10% jitter
  } = options;

  return retryWithBackoff(fn, {
    ...options,
    onRetry: (error, attempt, delay) => {
      // Add jitter to delay
      const jitterAmount = delay * jitter * (Math.random() * 2 - 1); // -jitter to +jitter
      const jitteredDelay = Math.max(0, delay + jitterAmount);
      
      if (options.onRetry) {
        options.onRetry(error, attempt, jitteredDelay);
      }
    },
  });
}

/**
 * Check if error is retryable
 */
function isRetryableError(error) {
  // Network errors
  if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
    return true;
  }

  // HTTP 5xx errors (server errors)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }

  // HTTP 429 (rate limit) - retryable
  if (error.status === 429) {
    return true;
  }

  // HTTP 408 (request timeout) - retryable
  if (error.status === 408) {
    return true;
  }

  // Parse errors - some are retryable (check if Parse is available)
  try {
    const Parse = require('parse/node');
    if (error.code === Parse.Error.TIMEOUT || error.code === Parse.Error.CONNECTION_FAILED) {
      return true;
    }
  } catch (e) {
    // Parse not available, skip this check
  }

  // HTTP 401, 403 (auth errors) - not retryable
  if (error.status === 401 || error.status === 403) {
    return false;
  }

  // HTTP 400, 404 (client errors) - not retryable
  if (error.status >= 400 && error.status < 500) {
    return false;
  }

  // Default: retry if it's an error
  return error instanceof Error;
}

module.exports = {
  retryWithBackoff,
  retryWithJitter,
  isRetryableError,
};

