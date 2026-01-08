const path = require('path');
const fs = require('fs');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()]
});

const HTTP2_PUSH_ENABLED = process.env.HTTP2_PUSH_ENABLED !== 'false';

/**
 * HTTP/2 Server Push Middleware
 * Pushes critical static assets when HTTP/2 is available
 */
function http2PushMiddleware(req, res, next) {
  // Check if HTTP/2 is available
  const isHttp2 = req.httpVersionMajor >= 2;
  
  if (!isHttp2 || !HTTP2_PUSH_ENABLED) {
    return next();
  }

  // Store original sendFile method
  const originalSendFile = res.sendFile.bind(res);

  // Override sendFile to push critical assets
  res.sendFile = function(filePath, options, callback) {
    // Only push for HTML files (initial page load)
    if (path.extname(filePath) === '.html') {
      pushCriticalAssets(req, res);
    }
    
    return originalSendFile(filePath, options, callback);
  };

  // Also handle HTML responses
  const originalSend = res.send.bind(res);
  res.send = function(body) {
    if (typeof body === 'string' && body.includes('<!DOCTYPE html>')) {
      pushCriticalAssets(req, res);
    }
    return originalSend(body);
  };

  next();
}

/**
 * Push critical assets for the route
 */
function pushCriticalAssets(req, res) {
  if (!res.push) {
    return; // HTTP/2 push not available
  }

  try {
    const buildPath = path.resolve(__dirname, '..', '..', 'build');
    
    // Determine critical assets based on route
    const criticalAssets = getCriticalAssetsForRoute(req.path);
    
    criticalAssets.forEach(assetPath => {
      const fullPath = path.join(buildPath, assetPath);
      
      // Check if file exists
      if (fs.existsSync(fullPath)) {
        const stream = res.push(assetPath, {
          req: {
            accept: req.headers.accept,
          },
          res: {
            'content-type': getContentType(assetPath),
          },
        });
        
        fs.createReadStream(fullPath).pipe(stream);
        
        logger.debug(`[HTTP/2 Push] Pushed asset: ${assetPath}`);
      }
    });
  } catch (error) {
    logger.warn('[HTTP/2 Push] Failed to push assets:', error.message);
  }
}

/**
 * Get critical assets for a specific route
 */
function getCriticalAssetsForRoute(routePath) {
  const assets = [];
  
  // Common critical assets for all routes
  assets.push('/assets/index.css'); // Main CSS bundle
  assets.push('/assets/index.js'); // Main JS bundle
  
  // Route-specific assets
  if (routePath === '/' || routePath.startsWith('/dashboard')) {
    // Dashboard might need chart libraries
    // assets.push('/assets/charts.js');
  }
  
  // Fonts and icons (if not already inlined)
  // assets.push('/assets/fonts/inter.woff2');
  
  return assets.filter(asset => {
    // Filter out assets that don't exist
    const buildPath = path.resolve(__dirname, '..', '..', 'build');
    return fs.existsSync(path.join(buildPath, asset));
  });
}

/**
 * Get content type for asset
 */
function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
  };
  
  return contentTypes[ext] || 'application/octet-stream';
}

module.exports = {
  http2PushMiddleware,
};

