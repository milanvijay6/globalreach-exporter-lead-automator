/**
 * Parse Query Index Configuration
 * 
 * These indexes should be created in Back4App Dashboard:
 * Dashboard → Your App → Database → Indexes
 * 
 * Or via Parse Cloud Code using Parse.Cloud.define('createIndexes', ...)
 */

module.exports = {
  // Lead (Importer) indexes
  Lead: [
    {
      name: 'status',
      fields: { status: 1 },
      description: 'Index for filtering leads by status (PENDING, CONTACTED, ENGAGED, etc.)'
    },
    {
      name: 'country',
      fields: { country: 1 },
      description: 'Index for filtering leads by country'
    },
    {
      name: 'createdAt',
      fields: { createdAt: -1 },
      description: 'Index for sorting by creation date (descending)'
    },
    {
      name: 'lastContacted',
      fields: { lastContacted: -1 },
      description: 'Index for sorting by last contacted date (descending)'
    },
    {
      name: 'leadScore',
      fields: { leadScore: -1 },
      description: 'Index for sorting by lead score (descending)'
    },
    {
      name: 'status_createdAt',
      fields: { status: 1, createdAt: -1 },
      description: 'Compound index for filtering by status and sorting by date'
    },
    {
      name: 'country_status',
      fields: { country: 1, status: 1 },
      description: 'Compound index for filtering by country and status'
    },
    {
      name: 'status_country_createdAt',
      fields: { status: 1, country: 1, createdAt: -1 },
      description: 'Compound index for filtering by status and country, sorted by creation date'
    },
    {
      name: 'status_leadScore',
      fields: { status: 1, leadScore: -1 },
      description: 'Compound index for filtering by status and sorting by lead score'
    },
  ],

  // Product indexes
  Product: [
    {
      name: 'category',
      fields: { category: 1 },
      description: 'Index for filtering products by category'
    },
    {
      name: 'status',
      fields: { status: 1 },
      description: 'Index for filtering products by status (active/inactive)'
    },
    {
      name: 'createdAt',
      fields: { createdAt: -1 },
      description: 'Index for sorting products by creation date'
    },
    {
      name: 'category_status',
      fields: { category: 1, status: 1 },
      description: 'Compound index for filtering by category and status'
    },
    {
      name: 'category_status_createdAt',
      fields: { category: 1, status: 1, createdAt: -1 },
      description: 'Compound index for filtering by category and status, sorted by creation date'
    },
    {
      name: 'tags',
      fields: { tags: 1 },
      description: 'Index for array queries on tags'
    },
  ],

  // Message indexes
  Message: [
    {
      name: 'importerId',
      fields: { importerId: 1 },
      description: 'Index for filtering messages by importer/lead ID'
    },
    {
      name: 'channel',
      fields: { channel: 1 },
      description: 'Index for filtering messages by channel (WhatsApp, Email, etc.)'
    },
    {
      name: 'timestamp',
      fields: { timestamp: -1 },
      description: 'Index for sorting messages by timestamp (descending)'
    },
    {
      name: 'status',
      fields: { status: 1 },
      description: 'Index for filtering messages by status (SENT, DELIVERED, READ, etc.)'
    },
    {
      name: 'importerId_timestamp',
      fields: { importerId: 1, timestamp: -1 },
      description: 'Compound index for getting messages by importer sorted by time'
    },
    {
      name: 'importerId_channel_timestamp',
      fields: { importerId: 1, channel: 1, timestamp: -1 },
      description: 'Compound index for getting messages by importer and channel, sorted by time'
    },
    {
      name: 'status_channel_timestamp',
      fields: { status: 1, channel: 1, timestamp: -1 },
      description: 'Compound index for filtering by status and channel, sorted by timestamp'
    },
  ],

  // Config indexes (if needed)
  Config: [
    {
      name: 'key',
      fields: { key: 1 },
      description: 'Index for looking up config by key'
    },
    {
      name: 'key_userId',
      fields: { key: 1, userId: 1 },
      description: 'Compound index for user-specific config lookups'
    },
  ],

  // Integration indexes
  Integration: [
    {
      name: 'channel',
      fields: { channel: 1 },
      description: 'Index for filtering integrations by channel'
    },
    {
      name: 'status',
      fields: { status: 1 },
      description: 'Index for filtering integrations by status'
    },
  ],

  // AnalyticsDaily indexes (time-series optimized)
  AnalyticsDaily: [
    {
      name: 'date',
      fields: { date: -1 },
      description: 'Index for sorting analytics by date (descending)'
    },
    {
      name: 'date_userId',
      fields: { date: -1, userId: 1 },
      description: 'Compound index for querying analytics by date and userId (time-series optimized)'
    },
  ],
};

/**
 * Get index creation commands for Back4App Dashboard
 * These can be copy-pasted into Back4App Database → Indexes
 */
function getIndexCreationCommands() {
  const indexes = module.exports;
  const commands = [];

  Object.keys(indexes).forEach(className => {
    indexes[className].forEach(index => {
      commands.push({
        className,
        indexName: index.name,
        fields: index.fields,
        command: `db.${className}.createIndex(${JSON.stringify(index.fields)}, { name: "${index.name}" })`,
        description: index.description,
      });
    });
  });

  return commands;
}

module.exports.getIndexCreationCommands = getIndexCreationCommands;




