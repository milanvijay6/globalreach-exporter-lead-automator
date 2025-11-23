const https = require('https');
const fs = require('fs');
const path = require('path');
const { getCertificateFiles, getTLSConfig } = require('../services/tlsService');

/**
 * TLS Configuration for Express
 * Sets up HTTPS server with certificates
 */

/**
 * Creates HTTPS server with TLS configuration
 */
async function createHTTPSServer(app, port) {
  const config = await getTLSConfig();
  
  if (!config.enabled) {
    return null;
  }
  
  try {
    let cert, key;
    
    if (config.mode === 'custom' && config.certPath && config.keyPath) {
      // Use custom certificates
      cert = fs.readFileSync(config.certPath);
      key = fs.readFileSync(config.keyPath);
    } else if (config.mode === 'letsencrypt' && config.domain) {
      // Use Let's Encrypt certificates
      const certFiles = await getCertificateFiles(config.domain);
      if (certFiles) {
        cert = certFiles.cert;
        key = certFiles.key;
      } else {
        throw new Error('Let\'s Encrypt certificate not found');
      }
    } else {
      // Use self-signed certificate
      const { generateSelfSignedCertificate, saveCertificateFiles } = require('../services/tlsService');
      const selfSigned = await generateSelfSignedCertificate(config.domain || 'localhost');
      const { certPath, keyPath } = await saveCertificateFiles(
        selfSigned.cert,
        selfSigned.key,
        config.domain || 'localhost'
      );
      cert = fs.readFileSync(certPath);
      key = fs.readFileSync(keyPath);
    }
    
    const server = https.createServer({ cert, key }, app);
    
    return new Promise((resolve, reject) => {
      server.listen(port, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve(server);
        }
      });
    });
  } catch (error) {
    console.error('[TLS] Failed to create HTTPS server:', error);
    throw error;
  }
}

/**
 * Creates HTTP to HTTPS redirect middleware
 */
function createRedirectMiddleware(httpsPort) {
  return (req, res, next) => {
    if (req.secure) {
      return next();
    }
    
    const httpsUrl = `https://${req.headers.host.replace(/:\d+$/, '')}:${httpsPort}${req.url}`;
    res.redirect(301, httpsUrl);
  };
}

module.exports = {
  createHTTPSServer,
  createRedirectMiddleware
};

