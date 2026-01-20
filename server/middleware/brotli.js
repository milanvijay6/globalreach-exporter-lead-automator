const zlib = require('zlib');
const accepts = require('accepts');

/**
 * Brotli compression middleware for Express
 * Falls back to gzip if Brotli is not supported
 */
function brotliCompression(req, res, next) {
  const accept = accepts(req);
  const encoding = accept.encoding(['br', 'gzip', 'deflate']);

  // Only compress responses > 1KB
  const originalSend = res.send;
  res.send = function(data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const dataBuffer = Buffer.from(dataString, 'utf8');

    if (dataBuffer.length < 1024) {
      return originalSend.call(this, data);
    }

    if (encoding === 'br' && zlib.brotliCompressSync) {
      res.setHeader('Content-Encoding', 'br');
      res.setHeader('Vary', 'Accept-Encoding');
      const compressed = zlib.brotliCompressSync(dataBuffer);
      res.setHeader('Content-Length', compressed.length);
      return originalSend.call(this, compressed);
    }

    // Fallback to original compression middleware
    return originalSend.call(this, data);
  };

  next();
}

module.exports = brotliCompression;









