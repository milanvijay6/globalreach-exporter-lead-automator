const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

const COMPRESSION_LEVEL = process.env.AI_PROMPT_COMPRESSION || 'light'; // none, light, aggressive

// Common phrase abbreviations
const ABBREVIATIONS = {
  'company name': 'co',
  'company': 'co',
  'contact person': 'contact',
  'products imported': 'products',
  'conversation history': 'history',
  'message': 'msg',
  'channel': 'ch',
  'timestamp': 'ts',
  'description': 'desc',
  'specification': 'spec',
  'recommendation': 'rec',
  'confidence': 'conf',
};

/**
 * Compression levels configuration
 */
const COMPRESSION_CONFIG = {
  none: {
    removeWhitespace: false,
    normalizeFormatting: false,
    useAbbreviations: false,
    truncateHistory: false,
    compressContext: false,
  },
  light: {
    removeWhitespace: true,
    normalizeFormatting: true,
    useAbbreviations: false, // Keep readable
    truncateHistory: true,
    maxHistoryMessages: 10,
    compressContext: true,
    contextFields: ['name', 'companyName', 'country', 'productsImported'], // Essential only
  },
  aggressive: {
    removeWhitespace: true,
    normalizeFormatting: true,
    useAbbreviations: true,
    truncateHistory: true,
    maxHistoryMessages: 5,
    compressContext: true,
    contextFields: ['name', 'companyName', 'country'], // Minimal
  },
};

/**
 * Removes redundant whitespace and normalizes formatting
 */
function removeWhitespace(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  return text
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .replace(/\n\s*\n+/g, '\n') // Multiple newlines to single
    .replace(/^\s+|\s+$/gm, '') // Trim lines
    .trim();
}

/**
 * Normalizes formatting (removes extra punctuation, standardizes spacing)
 */
function normalizeFormatting(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  return text
    .replace(/[ \t]+/g, ' ') // Tabs and multiple spaces to single space
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
    .replace(/[ ]{2,}/g, ' ') // Multiple spaces to single
    .trim();
}

/**
 * Applies abbreviations to common phrases
 */
function applyAbbreviations(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  let compressed = text;
  for (const [full, abbrev] of Object.entries(ABBREVIATIONS)) {
    // Case-insensitive replacement with word boundaries
    const regex = new RegExp(`\\b${full}\\b`, 'gi');
    compressed = compressed.replace(regex, abbrev);
  }
  
  return compressed;
}

/**
 * Truncates conversation history to last N messages
 */
function truncateHistory(history, maxMessages) {
  if (!Array.isArray(history) || !maxMessages) {
    return history;
  }
  
  if (history.length <= maxMessages) {
    return history;
  }
  
  return history.slice(-maxMessages);
}

/**
 * Compresses product context to essential fields only
 */
function compressProductContext(products, essentialFields) {
  if (!Array.isArray(products) || !essentialFields) {
    return products;
  }
  
  return products.map(product => {
    const compressed = {};
    for (const field of essentialFields) {
      if (product[field] !== undefined) {
        compressed[field] = product[field];
      }
    }
    return compressed;
  });
}

/**
 * Compresses a prompt based on the configured compression level
 */
function compressPrompt(prompt, options = {}) {
  if (!prompt || typeof prompt !== 'string') {
    return prompt;
  }

  const level = options.level || COMPRESSION_LEVEL;
  const config = COMPRESSION_CONFIG[level] || COMPRESSION_CONFIG.light;

  let compressed = prompt;

  // Remove whitespace
  if (config.removeWhitespace) {
    compressed = removeWhitespace(compressed);
  }

  // Normalize formatting
  if (config.normalizeFormatting) {
    compressed = normalizeFormatting(compressed);
  }

  // Apply abbreviations
  if (config.useAbbreviations) {
    compressed = applyAbbreviations(compressed);
  }

  return compressed;
}

/**
 * Compresses conversation history
 */
function compressHistory(history, options = {}) {
  if (!Array.isArray(history)) {
    return history;
  }

  const level = options.level || COMPRESSION_LEVEL;
  const config = COMPRESSION_CONFIG[level] || COMPRESSION_CONFIG.light;

  if (!config.truncateHistory) {
    return history;
  }

  const maxMessages = config.maxHistoryMessages || 10;
  return truncateHistory(history, maxMessages);
}

/**
 * Compresses product/context data
 */
function compressContext(context, options = {}) {
  if (!context || typeof context !== 'object') {
    return context;
  }

  const level = options.level || COMPRESSION_LEVEL;
  const config = COMPRESSION_CONFIG[level] || COMPRESSION_CONFIG.light;

  if (!config.compressContext) {
    return context;
  }

  // If context has products array, compress it
  if (Array.isArray(context.products) && config.contextFields) {
    return {
      ...context,
      products: compressProductContext(context.products, config.contextFields),
    };
  }

  // Otherwise, filter to essential fields only
  if (config.contextFields) {
    const compressed = {};
    for (const field of config.contextFields) {
      if (context[field] !== undefined) {
        compressed[field] = context[field];
      }
    }
    return compressed;
  }

  return context;
}

/**
 * Estimates token count (rough approximation: 1 token ≈ 4 characters)
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }
  return Math.ceil(text.length / 4);
}

/**
 * Compresses prompt and returns compression stats
 */
function compressPromptWithStats(prompt, options = {}) {
  const original = prompt;
  const originalTokens = estimateTokens(original);
  
  const compressed = compressPrompt(prompt, options);
  const compressedTokens = estimateTokens(compressed);
  
  const reduction = originalTokens > 0 
    ? ((originalTokens - compressedTokens) / originalTokens * 100).toFixed(1)
    : 0;

  if (compressedTokens < originalTokens) {
    logger.debug(`[PromptCompression] Compressed prompt: ${originalTokens} → ${compressedTokens} tokens (${reduction}% reduction)`);
  }

  return {
    original,
    compressed,
    originalTokens,
    compressedTokens,
    reduction: parseFloat(reduction),
    savedTokens: originalTokens - compressedTokens,
  };
}

module.exports = {
  compressPrompt,
  compressHistory,
  compressContext,
  compressPromptWithStats,
  estimateTokens,
  removeWhitespace,
  normalizeFormatting,
  applyAbbreviations,
  truncateHistory,
  compressProductContext,
  COMPRESSION_LEVEL,
  COMPRESSION_CONFIG,
};

