const Parse = require('parse/node');

// Ensure Parse is initialized
if (!Parse.applicationId && process.env.PARSE_APPLICATION_ID) {
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

module.exports = { authenticateUser };

