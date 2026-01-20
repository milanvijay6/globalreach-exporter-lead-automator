const crypto = require('crypto');

/**
 * Create cursor from query result
 * Cursor is base64 encoded JSON with sort field value
 */
function createCursor(sortField, sortValue, sortOrder = 'desc') {
  const cursorData = {
    field: sortField,
    value: sortValue,
    order: sortOrder,
    timestamp: Date.now(),
  };
  const json = JSON.stringify(cursorData);
  return Buffer.from(json).toString('base64url');
}

/**
 * Parse cursor to extract sort field and value
 */
function parseCursor(cursor) {
  try {
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    return JSON.parse(json);
  } catch (error) {
    throw new Error('Invalid cursor format');
  }
}

/**
 * Apply cursor to Parse query
 * Returns query with cursor-based pagination applied
 */
function applyCursor(query, cursor, sortField, sortOrder = 'desc') {
  if (!cursor) {
    // First page - just apply sort
    if (sortOrder === 'desc') {
      query.descending(sortField);
    } else {
      query.ascending(sortField);
    }
    return query;
  }

  // Parse cursor
  const cursorData = parseCursor(cursor);
  
  // Apply sort
  if (cursorData.order === 'desc') {
    query.descending(sortField);
    // Get items after cursor value
    if (sortField === 'createdAt' || sortField === 'updatedAt') {
      query.lessThan(sortField, new Date(cursorData.value));
    } else {
      query.lessThan(sortField, cursorData.value);
    }
  } else {
    query.ascending(sortField);
    // Get items after cursor value
    if (sortField === 'createdAt' || sortField === 'updatedAt') {
      query.greaterThan(sortField, new Date(cursorData.value));
    } else {
      query.greaterThan(sortField, cursorData.value);
    }
  }

  return query;
}

/**
 * Get next cursor from query results
 */
function getNextCursor(results, sortField, sortOrder = 'desc') {
  if (!results || results.length === 0) {
    return null;
  }

  const lastItem = results[results.length - 1];
  let sortValue;

  if (sortField === 'createdAt' || sortField === 'updatedAt') {
    const date = lastItem.get ? lastItem.get(sortField) : lastItem[sortField];
    sortValue = date instanceof Date ? date.getTime() : date;
  } else {
    sortValue = lastItem.get ? lastItem.get(sortField) : lastItem[sortField];
  }

  return createCursor(sortField, sortValue, sortOrder);
}

/**
 * Format paginated response
 */
function formatPaginatedResponse(data, nextCursor, limit) {
  return {
    success: true,
    data,
    pagination: {
      limit: parseInt(limit),
      hasMore: !!nextCursor,
      nextCursor: nextCursor || null,
    },
  };
}

module.exports = {
  createCursor,
  parseCursor,
  applyCursor,
  getNextCursor,
  formatPaginatedResponse,
};









