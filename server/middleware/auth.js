const Parse = require('../config/parse');

/**
 * Authentication middleware for Parse User
 * Allows webhooks to bypass auth
 */
async function authenticate(req, res, next) {
  // Allow webhooks to bypass auth
  if (req.path.startsWith('/webhooks/')) {
    return next();
  }
  
  // Allow OAuth callbacks to bypass auth
  if (req.path.startsWith('/api/oauth/callback') || req.path.startsWith('/auth/')) {
    return next();
  }
  
  // Allow health check
  if (req.path === '/api/health') {
    return next();
  }
  
  try {
    const sessionToken = req.headers['x-parse-session-token'] || 
                        req.headers['authorization']?.replace('Bearer ', '') ||
                        req.query.sessionToken;
    
    if (!sessionToken) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required',
        message: 'Please provide a session token' 
      });
    }
    
    // Verify session token with Parse
    const query = new Parse.Query(Parse.Session);
    query.equalTo('sessionToken', sessionToken);
    const session = await query.first({ useMasterKey: true });
    
    if (!session) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid session token' 
      });
    }
    
    // Get user from session
    const user = session.get('user');
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Session has no associated user' 
      });
    }
    
    // Attach user to request
    req.user = user;
    req.sessionToken = sessionToken;
    
    next();
  } catch (error) {
    console.error('[Auth] Authentication error:', error);
    return res.status(401).json({ 
      success: false, 
      error: 'Authentication failed',
      message: error.message 
    });
  }
}

/**
 * Optional authentication - doesn't fail if no token provided
 */
async function optionalAuth(req, res, next) {
  try {
    const sessionToken = req.headers['x-parse-session-token'] || 
                        req.headers['authorization']?.replace('Bearer ', '') ||
                        req.query.sessionToken;
    
    if (sessionToken) {
      const query = new Parse.Query(Parse.Session);
      query.equalTo('sessionToken', sessionToken);
      const session = await query.first({ useMasterKey: true });
      
      if (session) {
        req.user = session.get('user');
        req.sessionToken = sessionToken;
      }
    }
    
    next();
  } catch (error) {
    // Continue without auth if optional
    next();
  }
}

module.exports = {
  authenticate,
  optionalAuth,
};

