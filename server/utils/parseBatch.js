const Parse = require('parse/node');

/**
 * Batch Parse Query Utility
 * Executes multiple Parse queries in parallel for better performance
 */

/**
 * Execute multiple Parse queries in parallel
 * @param {Array<Parse.Query>} queries - Array of Parse queries to execute
 * @param {Object} options - Execution options
 * @returns {Promise<Array>} Array of query results
 */
async function batchQueries(queries, options = {}) {
  const { useMasterKey = true, batchSize = 10 } = options;

  if (!Array.isArray(queries) || queries.length === 0) {
    return [];
  }

  // Execute queries in batches to avoid overwhelming Parse
  const results = [];
  for (let i = 0; i < queries.length; i += batchSize) {
    const batch = queries.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(query => query.find({ useMasterKey }))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Batch get multiple Parse objects by ID
 * @param {Parse.Object} ParseClass - Parse class to query
 * @param {Array<string>} objectIds - Array of object IDs
 * @param {Object} options - Execution options
 * @returns {Promise<Array>} Array of Parse objects
 */
async function batchGets(ParseClass, objectIds, options = {}) {
  const { useMasterKey = true } = options;

  if (!Array.isArray(objectIds) || objectIds.length === 0) {
    return [];
  }

  // Create queries for each object ID
  const queries = objectIds.map(id => {
    const query = new Parse.Query(ParseClass);
    return query.get(id, { useMasterKey });
  });

  // Execute in parallel
  return Promise.all(queries);
}

/**
 * Batch find operations with same query parameters but different filters
 * @param {Parse.Object} ParseClass - Parse class to query
 * @param {Array<Function>} filterFunctions - Array of functions that modify query
 * @param {Object} baseOptions - Base query options (limit, include, etc.)
 * @returns {Promise<Array>} Array of query results
 */
async function batchFinds(ParseClass, filterFunctions, baseOptions = {}) {
  const { useMasterKey = true, limit, include, select } = baseOptions;

  if (!Array.isArray(filterFunctions) || filterFunctions.length === 0) {
    return [];
  }

  // Create queries with different filters
  const queries = filterFunctions.map(filterFn => {
    const query = new Parse.Query(ParseClass);
    
    // Apply base options
    if (limit) query.limit(limit);
    if (include) {
      if (Array.isArray(include)) {
        include.forEach(rel => query.include(rel));
      } else {
        query.include(include);
      }
    }
    if (select) {
      if (Array.isArray(select)) {
        query.select(...select);
      } else {
        query.select(select);
      }
    }
    
    // Apply filter function
    filterFn(query);
    
    return query;
  });

  // Execute in parallel
  return Promise.all(queries.map(q => q.find({ useMasterKey })));
}

/**
 * Batch save multiple Parse objects
 * @param {Array<Parse.Object>} objects - Array of Parse objects to save
 * @param {Object} options - Save options
 * @returns {Promise<Array>} Array of saved objects
 */
async function batchSave(objects, options = {}) {
  const { useMasterKey = true } = options;

  if (!Array.isArray(objects) || objects.length === 0) {
    return [];
  }

  // Use Parse.Object.saveAll for batch saves (more efficient)
  try {
    return await Parse.Object.saveAll(objects, { useMasterKey });
  } catch (error) {
    // Fallback to individual saves if saveAll fails
    console.warn('[Batch] saveAll failed, falling back to individual saves:', error.message);
    return Promise.all(objects.map(obj => obj.save(null, { useMasterKey })));
  }
}

/**
 * Batch delete multiple Parse objects
 * @param {Array<Parse.Object>} objects - Array of Parse objects to delete
 * @param {Object} options - Delete options
 * @returns {Promise<void>}
 */
async function batchDelete(objects, options = {}) {
  const { useMasterKey = true } = options;

  if (!Array.isArray(objects) || objects.length === 0) {
    return;
  }

  // Use Parse.Object.destroyAll for batch deletes
  try {
    await Parse.Object.destroyAll(objects, { useMasterKey });
  } catch (error) {
    // Fallback to individual deletes
    console.warn('[Batch] destroyAll failed, falling back to individual deletes:', error.message);
    await Promise.all(objects.map(obj => obj.destroy({ useMasterKey })));
  }
}

module.exports = {
  batchQueries,
  batchGets,
  batchFinds,
  batchSave,
  batchDelete,
};










