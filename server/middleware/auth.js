/**
 * Authentication Middleware
 * Extracts user information from request for user-specific operations
 */

const Parse = require('parse/node');

/**
 * Middleware to extract user ID from request
 * Supports multiple methods:
 * 1. X-User-Id header (preferred)
 * 2. userId in request body
 * 3. userId query parameter
 * 4. X-Parse-Session-Token header (Parse session)
 */
const authenticateUser = async (req, res, next) => {
  try {
    let userId = null;

    // Method 1: Check X-User-Id header (preferred for web)
    if (req.headers['x-user-id']) {
      userId = req.headers['x-user-id'];
    }
    // Method 2: Check request body
    else if (req.body && req.body.userId) {
      userId = req.body.userId;
    }
    // Method 3: Check query parameter
    else if (req.query && req.query.userId) {
      userId = req.query.userId;
    }
    // Method 4: Try Parse session token
    else if (req.headers['x-parse-session-token']) {
      try {
        const sessionToken = req.headers['x-parse-session-token'];
        const session = await Parse.Session.current({ sessionToken });
        if (session && session.get('user')) {
          const user = session.get('user');
          userId = user.id;
        }
      } catch (error) {
        // Parse session not available, continue without user
        console.warn('[Auth] Failed to get user from Parse session:', error.message);
      }
    }

    // Attach user ID to request object
    req.userId = userId;
    req.user = userId ? { id: userId } : null;

    // Continue to next middleware/route
    next();
  } catch (error) {
    console.error('[Auth] Authentication middleware error:', error);
    // Don't block the request, just continue without user
    req.userId = null;
    req.user = null;
    next();
  }
};

/**
 * Optional middleware that requires user authentication
 * Returns 401 if no user ID is found
 */
const requireUser = (req, res, next) => {
  if (!req.userId) {
    return res.status(401).json({
      success: false,
      error: 'User authentication required. Please provide userId in X-User-Id header, request body, or query parameter.'
    });
  }
  next();
};

module.exports = {
  authenticateUser,
  requireUser
};

