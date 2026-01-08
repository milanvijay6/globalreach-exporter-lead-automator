/**
 * Campaign Archive Model
 * Archive class for old/completed campaigns
 * Keeps main Campaign table lean by moving old data here
 */

const Parse = require('parse/node');

const CampaignArchive = Parse.Object.extend('CampaignArchive');

module.exports = CampaignArchive;

