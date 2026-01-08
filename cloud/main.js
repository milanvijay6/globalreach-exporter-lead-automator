/**
 * Parse Cloud Code Entry Point
 * 
 * This file is the entry point for Parse Cloud Code functions and jobs
 * Deploy this to Back4App Cloud Code
 * 
 * Usage:
 * 1. Go to Back4App Dashboard → Your App → Cloud Code
 * 2. Upload this file and related files
 * 3. Configure jobs in Dashboard → Jobs
 */

const Parse = require('parse/node');

// Initialize Parse (Back4App handles this automatically, but ensure it's set)
if (!Parse.applicationId) {
  // Parse should be initialized by Back4App, but set it if needed
  Parse.initialize(
    process.env.PARSE_APPLICATION_ID,
    process.env.PARSE_JAVASCRIPT_KEY || ''
  );
  Parse.serverURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';
  if (process.env.PARSE_MASTER_KEY) {
    Parse.masterKey = process.env.PARSE_MASTER_KEY;
  }
}

// Import Cloud Jobs
const { precomputeAnalytics } = require('./jobs/precomputeAnalytics');

/**
 * Parse Cloud Job: precomputeAnalytics
 * Runs nightly at 2 AM UTC to pre-compute daily analytics rollups
 * 
 * Configure in Back4App Dashboard → Jobs:
 * - Schedule: 0 2 * * * (2 AM UTC daily)
 * - Function: precomputeAnalytics
 */
Parse.Cloud.job('precomputeAnalytics', async (request) => {
  const { params, log } = request;
  
  log.info('[CloudJob] Starting precomputeAnalytics job...');
  
  try {
    const result = await precomputeAnalytics({
      useMasterKey: true,
      ...params,
    });
    
    log.info(`[CloudJob] precomputeAnalytics completed: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    log.error('[CloudJob] precomputeAnalytics failed:', error);
    throw error;
  }
});

/**
 * Parse Cloud Function: getAnalytics
 * Retrieves pre-computed analytics for a date range
 */
Parse.Cloud.define('getAnalytics', async (request) => {
  const { params, user } = request;
  const { startDate, endDate, userId } = params;
  
  const AnalyticsDaily = Parse.Object.extend('AnalyticsDaily');
  const query = new Parse.Query(AnalyticsDaily);
  
  if (startDate) {
    query.greaterThanOrEqualTo('date', new Date(startDate));
  }
  
  if (endDate) {
    query.lessThanOrEqualTo('date', new Date(endDate));
  }
  
  if (userId) {
    query.equalTo('userId', userId);
  } else if (user) {
    query.equalTo('userId', user.id);
  }
  
  query.descending('date');
  query.limit(100);
  
  const results = await query.find({ useMasterKey: true });
  
  return results.map(r => ({
    date: r.get('date'),
    metrics: r.get('metrics'),
    userId: r.get('userId'),
  }));
});

module.exports = {
  precomputeAnalytics,
};

