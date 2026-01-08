/**
 * Analytics Daily Model
 * Time-series analytics rollup for daily metrics
 * Pre-computed by Cloud Job for efficient querying
 */

const Parse = require('parse/node');

const AnalyticsDaily = Parse.Object.extend('AnalyticsDaily');

module.exports = AnalyticsDaily;

