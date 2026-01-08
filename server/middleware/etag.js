const crypto = require('crypto');

/**
 * ETag middleware for conditional requests
 * Generates ETag from response content and checks If-None-Match header
 */
function etagMiddleware(req, res, next) {
  // Only apply to GET and HEAD requests
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const originalSend = res.send;
  const originalJson = res.json;
  const originalEnd = res.end;

  // Generate ETag from response data
  function generateETag(data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    const hash = crypto.createHash('md5').update(dataString).digest('hex');
    return `"${hash}"`;
  }

  // Check If-None-Match header
  const ifNoneMatch = req.headers['if-none-match'];
  
  // Store response data for ETag generation
  res.locals.responseData = null;

  // Override send method
  res.send = function(data) {
    res.locals.responseData = data;
    
    if (ifNoneMatch) {
      const etag = generateETag(data);
      res.setHeader('ETag', etag);
      
      if (ifNoneMatch === etag || ifNoneMatch.includes(etag)) {
        res.status(304).end();
        return res;
      }
    }
    
    return originalSend.call(this, data);
  };

  // Override json method
  res.json = function(data) {
    res.locals.responseData = data;
    
    if (ifNoneMatch) {
      const etag = generateETag(data);
      res.setHeader('ETag', etag);
      
      if (ifNoneMatch === etag || ifNoneMatch.includes(etag)) {
        res.status(304).end();
        return res;
      }
    }
    
    return originalJson.call(this, data);
  };

  next();
}

module.exports = etagMiddleware;






