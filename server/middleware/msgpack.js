const { pack, unpack } = require('msgpackr');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

const MSGPACK_THRESHOLD = parseInt(process.env.MSGPACK_THRESHOLD || '10240', 10); // 10KB default

/**
 * MessagePack compression middleware
 * Automatically uses MessagePack for large responses when client accepts it
 */
function msgpackMiddleware(req, res, next) {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method to check size and use MessagePack if appropriate
  res.json = function(data) {
    // Check if client accepts MessagePack
    const accepts = req.headers.accept || '';
    const acceptsMsgpack = accepts.includes('application/msgpack') || accepts.includes('application/x-msgpack');
    
    // Serialize to JSON to check size
    const jsonString = JSON.stringify(data);
    const jsonSize = Buffer.byteLength(jsonString, 'utf8');
    
    // Use MessagePack if:
    // 1. Client accepts it
    // 2. Response is larger than threshold
    if (acceptsMsgpack && jsonSize > MSGPACK_THRESHOLD) {
      try {
        // Pack data to MessagePack
        const packed = pack(data);
        
        // Set appropriate headers
        res.setHeader('Content-Type', 'application/msgpack');
        res.setHeader('Content-Length', packed.length);
        res.setHeader('X-Content-Encoding', 'msgpack');
        res.setHeader('X-Original-Size', jsonSize);
        res.setHeader('X-Compressed-Size', packed.length);
        
        logger.debug(`[MessagePack] Compressed response: ${jsonSize} → ${packed.length} bytes (${((1 - packed.length / jsonSize) * 100).toFixed(1)}% reduction)`);
        
        return res.send(packed);
      } catch (error) {
        logger.warn('[MessagePack] Failed to pack response, falling back to JSON:', error.message);
        // Fall back to JSON
        res.setHeader('Content-Type', 'application/json');
        return originalJson(data);
      }
    }
    
    // Use JSON for small responses or when MessagePack not accepted
    res.setHeader('Content-Type', 'application/json');
    return originalJson(data);
  };

  next();
}

/**
 * Helper to decode MessagePack response on client side
 * This would be used in the frontend service
 */
function decodeMsgpackResponse(buffer) {
  try {
    return unpack(buffer);
  } catch (error) {
    throw new Error('Failed to decode MessagePack response');
  }
}

module.exports = {
  msgpackMiddleware,
  decodeMsgpackResponse,
  MSGPACK_THRESHOLD,
};

