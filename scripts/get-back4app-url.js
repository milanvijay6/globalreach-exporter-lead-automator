/**
 * Get Back4App URL from environment variables or request
 * Used for Cloudflare Worker configuration
 */

function getBack4AppUrl(req = null) {
  // Priority 1: Explicit environment variable
  if (process.env.BACK4APP_APP_URL) {
    return process.env.BACK4APP_APP_URL;
  }

  // Priority 2: From request headers (if available)
  if (req) {
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'https';
    const host = req.get('host') || req.get('x-forwarded-host');
    if (host) {
      return `${protocol}://${host}`;
    }
  }

  // Priority 3: Parse from other environment variables
  if (process.env.APP_URL) {
    return process.env.APP_URL;
  }

  // Priority 4: Default (should be updated during deployment)
  return process.env.DEFAULT_BACK4APP_URL || 'https://globalreachexporterleadautomator-sozgszuo.b4a.run';
}

module.exports = { getBack4AppUrl };

