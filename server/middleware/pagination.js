/**
 * Pagination Validation Middleware
 * Enforces pagination limits on all list endpoints
 */

const DEFAULT_LIMIT = parseInt(process.env.DEFAULT_PAGE_LIMIT || '50', 10);
const MAX_LIMIT = parseInt(process.env.MAX_PAGE_LIMIT || '200', 10);

/**
 * Middleware to validate and enforce pagination parameters
 */
function paginationMiddleware(req, res, next) {
  // Only apply to GET requests
  if (req.method !== 'GET') {
    return next();
  }

  // Get limit from query
  let limit = req.query.limit;

  if (limit === undefined || limit === null) {
    // Set default limit if not provided
    limit = DEFAULT_LIMIT;
  } else {
    // Parse and validate limit
    limit = parseInt(limit, 10);
    
    if (isNaN(limit) || limit < 1) {
      return res.status(400).json({
        success: false,
        error: `Invalid limit parameter. Must be a positive integer.`,
      });
    }
    
    // Enforce maximum limit
    if (limit > MAX_LIMIT) {
      limit = MAX_LIMIT;
    }
  }

  // Update query with validated limit
  req.query.limit = limit;

  // Validate cursor if provided
  if (req.query.cursor && typeof req.query.cursor !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Invalid cursor parameter. Must be a string.',
    });
  }

  // Validate offset if provided (for offset-based pagination)
  if (req.query.offset !== undefined) {
    const offset = parseInt(req.query.offset, 10);
    if (isNaN(offset) || offset < 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid offset parameter. Must be a non-negative integer.',
      });
    }
    req.query.offset = offset;
  }

  next();
}

module.exports = {
  paginationMiddleware,
  DEFAULT_LIMIT,
  MAX_LIMIT,
};

