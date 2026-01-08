/**
 * Field Projection Utility
 * Filters object fields based on comma-separated field list
 */

/**
 * Projects only specified fields from an object
 * @param {Object} obj - Object to project fields from
 * @param {string|undefined} fields - Comma-separated list of fields to include
 * @returns {Object} - Object with only specified fields
 */
function projectFields(obj, fields) {
  if (!fields || typeof fields !== 'string' || fields.trim() === '') {
    return obj; // Return all fields if no projection specified
  }

  const fieldList = fields.split(',').map(f => f.trim()).filter(f => f.length > 0);
  
  if (fieldList.length === 0) {
    return obj; // Return all fields if empty field list
  }

  const projected = {};
  for (const field of fieldList) {
    if (obj.hasOwnProperty(field)) {
      projected[field] = obj[field];
    }
  }

  return projected;
}

/**
 * Projects fields from an array of objects
 * @param {Array} arr - Array of objects to project fields from
 * @param {string|undefined} fields - Comma-separated list of fields to include
 * @returns {Array} - Array of objects with only specified fields
 */
function projectFieldsArray(arr, fields) {
  if (!Array.isArray(arr)) {
    return arr;
  }

  return arr.map(obj => projectFields(obj, fields));
}

module.exports = {
  projectFields,
  projectFieldsArray,
};

