const { MongoClient } = require('mongodb');
const winston = require('winston');

// Logger setup
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

let client = null;
let db = null;
let isConnected = false;

/**
 * Initialize MongoDB connection for Azure Cosmos DB
 * Supports both Azure Cosmos DB and standard MongoDB
 */
async function connectDatabase() {
  if (isConnected && db) {
    return db;
  }

  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    
    if (!mongoUri) {
      logger.warn('[Database] ⚠️  MONGO_URI not set. Database features will be disabled.');
      logger.warn('[Database] Set MONGO_URI in Azure Web App Configuration.');
      return null;
    }

    // MongoDB connection options optimized for Azure Cosmos DB
    const options = {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: false, // Azure Cosmos DB doesn't support retryable writes
      retryReads: true,
      // Additional options for Cosmos DB compatibility
      directConnection: false,
      ssl: true
    };

    logger.info('[Database] Connecting to MongoDB...');
    client = new MongoClient(mongoUri, options);
    await client.connect();
    
    // Get database name from URI or use default
    const dbName = process.env.MONGO_DB_NAME || 'globalreach';
    db = client.db(dbName);
    
    isConnected = true;
    logger.info(`[Database] ✅ Connected to MongoDB database: ${dbName}`);
    
    // Create indexes for optimal performance
    await createIndexes(db);
    
    return db;
  } catch (error) {
    logger.error('[Database] ❌ Failed to connect to MongoDB:', error.message);
    logger.error('[Database] Stack:', error.stack);
    isConnected = false;
    throw error;
  }
}

/**
 * Create indexes for all collections
 */
async function createIndexes(database) {
  try {
    logger.info('[Database] Creating indexes...');
    
    // Config collection indexes
    await database.collection('Config').createIndex({ key: 1 }, { unique: true });
    
    // Lead collection indexes
    await database.collection('Lead').createIndex({ status: 1, country: 1, createdAt: -1 });
    await database.collection('Lead').createIndex({ status: 1, leadScore: -1 });
    await database.collection('Lead').createIndex({ archived: 1 });
    await database.collection('Lead').createIndex({ email: 1 }, { sparse: true });
    
    // Message collection indexes
    await database.collection('Message').createIndex({ leadId: 1, createdAt: -1 });
    await database.collection('Message').createIndex({ status: 1, createdAt: -1 });
    
    // Product collection indexes
    await database.collection('Product').createIndex({ sku: 1 }, { unique: true, sparse: true });
    await database.collection('Product').createIndex({ category: 1 });
    
    // Integration collection indexes
    await database.collection('Integration').createIndex({ type: 1 });
    await database.collection('Integration').createIndex({ userId: 1 });
    
    // WebhookLog collection indexes
    await database.collection('WebhookLog').createIndex({ createdAt: -1 });
    await database.collection('WebhookLog').createIndex({ source: 1, createdAt: -1 });
    
    // AnalyticsDaily collection indexes
    await database.collection('AnalyticsDaily').createIndex({ date: -1 });
    await database.collection('AnalyticsDaily').createIndex({ userId: 1, date: -1 });
    
    logger.info('[Database] ✅ Indexes created successfully');
  } catch (error) {
    // Non-fatal - log warning but continue
    logger.warn('[Database] ⚠️  Some indexes may not have been created:', error.message);
  }
}

/**
 * Get database instance
 */
function getDatabase() {
  if (!isConnected || !db) {
    logger.warn('[Database] Database not connected. Call connectDatabase() first.');
    return null;
  }
  return db;
}

/**
 * Close database connection (for graceful shutdown)
 */
async function closeDatabase() {
  if (client) {
    try {
      await client.close();
      isConnected = false;
      db = null;
      logger.info('[Database] Connection closed');
    } catch (error) {
      logger.error('[Database] Error closing connection:', error);
    }
  }
}

/**
 * Health check for database connection
 */
async function healthCheck() {
  try {
    if (!isConnected || !db) {
      return { status: 'disconnected', error: 'Database not connected' };
    }
    
    // Ping database
    await db.admin().ping();
    return { status: 'ok', connected: true };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

module.exports = {
  connectDatabase,
  getDatabase,
  closeDatabase,
  healthCheck,
  isConnected: () => isConnected
};
