const Parse = require('parse/node');

// Ensure Parse is initialized (check for valid non-empty applicationId)
const hasValidAppId = Parse.applicationId && Parse.applicationId.trim() !== '';
if (!hasValidAppId && process.env.PARSE_APPLICATION_ID && process.env.PARSE_APPLICATION_ID.trim() !== '') {
  Parse.initialize(
    process.env.PARSE_APPLICATION_ID,
    process.env.PARSE_JAVASCRIPT_KEY || ''
  );
  Parse.serverURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';
  if (process.env.PARSE_MASTER_KEY) {
    Parse.masterKey = process.env.PARSE_MASTER_KEY;
  }
}

const authenticateUser = async (req, res, next) => {
  // Check if Parse is initialized
  const hasValidAppId = Parse.applicationId && Parse.applicationId.trim() !== '';
  if (!hasValidAppId) {
    // If Parse is not initialized, allow requests through without authentication
    req.user = null;
    req.userId = null;
    return next();
  }

  // Extract session token from various sources
  let sessionToken = req.get('X-Parse-Session-Token') || 
                     req.query.sessionToken || 
                     req.body.sessionToken;
  
  let userId = req.get('X-User-Id');

  if (!sessionToken && !userId) {
    req.user = null;
    req.userId = null;
    return next();
  }

  try {
    if (sessionToken) {
      const user = await Parse.User.become(sessionToken);
      req.user = user;
      req.userId = user.id;
    } else if (userId) {
      req.user = null;
      req.userId = userId;
    }
    next();
  } catch (error) {
    console.warn('[Auth Middleware] Invalid session:', error.message);
    req.user = null;
    req.userId = userId || null;
    next();
  }
};

const requireAuth = (req, res, next) => {
  if (!req.user && !req.userId) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }
  next();
};

module.exports = { authenticateUser, requireAuth };


