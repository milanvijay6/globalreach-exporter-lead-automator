# Migration Guide: Back4App (Parse Server) to Azure Cosmos DB

This guide helps you migrate your existing data from Back4App to Azure Cosmos DB.

## Prerequisites

- Access to Back4App dashboard and data
- Azure Cosmos DB provisioned and connection string ready
- Node.js 20+ installed locally
- MongoDB tools installed (optional but recommended)

## Migration Strategy

### Option 1: Export/Import via JSON (Recommended for small datasets)

#### Step 1: Export Data from Back4App

1. **Using Back4App Dashboard:**
   - Go to Back4App Dashboard → Your App → Database → Browser
   - For each collection (Lead, Message, Product, etc.):
     - Click on the collection
     - Click "Export" → "Export as JSON"
     - Save the file

2. **Using Parse JavaScript SDK:**

Create a file `export-parse-data.js`:

```javascript
const Parse = require('parse/node');

// Initialize Parse with your Back4App credentials
Parse.initialize(
  'YOUR_BACK4APP_APP_ID',
  'YOUR_BACK4APP_JS_KEY'
);
Parse.serverURL = 'https://parseapi.back4app.com/';
Parse.masterKey = 'YOUR_BACK4APP_MASTER_KEY';

async function exportCollection(className) {
  console.log(`Exporting ${className}...`);
  
  const query = new Parse.Query(className);
  query.limit(10000); // Adjust as needed
  
  const results = await query.find({ useMasterKey: true });
  
  const data = results.map(obj => {
    const json = obj.toJSON();
    // Convert Parse fields to MongoDB format
    return {
      ...json,
      _id: json.objectId,
      createdAt: new Date(json.createdAt),
      updatedAt: new Date(json.updatedAt)
    };
  });
  
  const fs = require('fs');
  fs.writeFileSync(
    `${className}.json`,
    JSON.stringify(data, null, 2)
  );
  
  console.log(`✅ Exported ${data.length} records from ${className}`);
}

async function exportAll() {
  const collections = [
    'Config',
    'Lead',
    'Message',
    'Product',
    'Integration',
    'WebhookLog',
    'AnalyticsDaily',
    'MessageArchive',
    'CampaignArchive'
  ];
  
  for (const collection of collections) {
    try {
      await exportCollection(collection);
    } catch (error) {
      console.error(`Error exporting ${collection}:`, error.message);
    }
  }
  
  console.log('\\n✅ Export complete!');
}

exportAll();
```

Run: `node export-parse-data.js`

#### Step 2: Import Data to Azure Cosmos DB

Create a file `import-to-cosmos.js`:

```javascript
const { MongoClient } = require('mongodb');
const fs = require('fs');

const MONGO_URI = 'YOUR_AZURE_COSMOS_DB_CONNECTION_STRING';
const DB_NAME = 'globalreach';

async function importCollection(collectionName) {
  const client = new MongoClient(MONGO_URI, {
    retryWrites: false,
    ssl: true
  });
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(collectionName);
    
    // Read exported JSON
    const data = JSON.parse(
      fs.readFileSync(`${collectionName}.json`, 'utf8')
    );
    
    if (data.length === 0) {
      console.log(`⚠️  No data to import for ${collectionName}`);
      return;
    }
    
    // Clean up Parse-specific fields
    const cleanData = data.map(doc => {
      const { objectId, __type, className, ...rest } = doc;
      return {
        ...rest,
        _id: objectId || rest._id
      };
    });
    
    // Import in batches
    const batchSize = 100;
    for (let i = 0; i < cleanData.length; i += batchSize) {
      const batch = cleanData.slice(i, i + batchSize);
      await collection.insertMany(batch, { ordered: false })
        .catch(err => {
          // Ignore duplicate key errors
          if (err.code !== 11000) throw err;
        });
    }
    
    console.log(`✅ Imported ${cleanData.length} records to ${collectionName}`);
  } catch (error) {
    console.error(`Error importing ${collectionName}:`, error.message);
  } finally {
    await client.close();
  }
}

async function importAll() {
  const collections = [
    'Config',
    'Lead',
    'Message',
    'Product',
    'Integration',
    'WebhookLog',
    'AnalyticsDaily',
    'MessageArchive',
    'CampaignArchive'
  ];
  
  console.log('Starting import to Azure Cosmos DB...\\n');
  
  for (const collection of collections) {
    try {
      await importCollection(collection);
    } catch (error) {
      console.error(`Failed to import ${collection}:`, error.message);
    }
  }
  
  console.log('\\n✅ Import complete!');
  process.exit(0);
}

importAll();
```

Run: `node import-to-cosmos.js`

### Option 2: Direct Migration (Recommended for large datasets)

Create a file `migrate-parse-to-cosmos.js`:

```javascript
const Parse = require('parse/node');
const { MongoClient } = require('mongodb');

// Back4App credentials
Parse.initialize(
  process.env.PARSE_APPLICATION_ID,
  process.env.PARSE_JAVASCRIPT_KEY
);
Parse.serverURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';
Parse.masterKey = process.env.PARSE_MASTER_KEY;

// Azure Cosmos DB
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.MONGO_DB_NAME || 'globalreach';

async function migrateCollection(className, batchSize = 100) {
  console.log(`\\nMigrating ${className}...`);
  
  const mongoClient = new MongoClient(MONGO_URI, {
    retryWrites: false,
    ssl: true
  });
  
  try {
    await mongoClient.connect();
    const db = mongoClient.db(DB_NAME);
    const collection = db.collection(className);
    
    let skip = 0;
    let hasMore = true;
    let totalMigrated = 0;
    
    while (hasMore) {
      // Fetch from Parse
      const query = new Parse.Query(className);
      query.limit(batchSize);
      query.skip(skip);
      
      const results = await query.find({ useMasterKey: true });
      
      if (results.length === 0) {
        hasMore = false;
        break;
      }
      
      // Transform Parse objects to MongoDB documents
      const docs = results.map(obj => {
        const json = obj.toJSON();
        const { objectId, __type, className: cn, ACL, ...rest } = json;
        
        return {
          _id: objectId,
          ...rest,
          createdAt: new Date(json.createdAt),
          updatedAt: new Date(json.updatedAt)
        };
      });
      
      // Insert into Cosmos DB
      try {
        await collection.insertMany(docs, { ordered: false });
        totalMigrated += docs.length;
        console.log(`  ✓ Migrated ${totalMigrated} records...`);
      } catch (error) {
        if (error.code === 11000) {
          console.log(`  ⚠️  Some duplicate records skipped`);
        } else {
          throw error;
        }
      }
      
      skip += batchSize;
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ ${className}: Migrated ${totalMigrated} records`);
    
  } catch (error) {
    console.error(`❌ Error migrating ${className}:`, error.message);
  } finally {
    await mongoClient.close();
  }
}

async function migrateAll() {
  console.log('═══════════════════════════════════════');
  console.log('  Parse to Azure Cosmos DB Migration');
  console.log('═══════════════════════════════════════\\n');
  
  const collections = [
    'Config',
    'Lead',
    'Message',
    'Product',
    'Integration',
    'WebhookLog',
    'AnalyticsDaily',
    'MessageArchive',
    'CampaignArchive'
  ];
  
  for (const collection of collections) {
    await migrateCollection(collection);
  }
  
  console.log('\\n═══════════════════════════════════════');
  console.log('  ✅ Migration Complete!');
  console.log('═══════════════════════════════════════');
  
  process.exit(0);
}

// Run migration
migrateAll().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
```

**Usage:**
```bash
# Set environment variables
export PARSE_APPLICATION_ID="your-back4app-app-id"
export PARSE_JAVASCRIPT_KEY="your-back4app-js-key"
export PARSE_MASTER_KEY="your-back4app-master-key"
export MONGO_URI="your-cosmos-db-connection-string"

# Install dependencies
npm install parse mongodb

# Run migration
node migrate-parse-to-cosmos.js
```

## Post-Migration Steps

### 1. Verify Data Migration

Create `verify-migration.js`:

```javascript
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'globalreach';

async function verifyMigration() {
  const client = new MongoClient(MONGO_URI, {
    retryWrites: false,
    ssl: true
  });
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    
    const collections = [
      'Config', 'Lead', 'Message', 'Product',
      'Integration', 'WebhookLog', 'AnalyticsDaily'
    ];
    
    console.log('\\n═══════════════════════════════════════');
    console.log('  Migration Verification');
    console.log('═══════════════════════════════════════\\n');
    
    for (const collectionName of collections) {
      const count = await db.collection(collectionName).countDocuments();
      console.log(`${collectionName}: ${count} documents`);
    }
    
    console.log('\\n═══════════════════════════════════════\\n');
  } finally {
    await client.close();
  }
}

verifyMigration();
```

Run: `node verify-migration.js`

### 2. Test Application

After deploying to Azure:

```bash
# Test health endpoint
curl https://your-app-name.azurewebsites.net/health

# Test API endpoints
curl https://your-app-name.azurewebsites.net/api/leads
```

### 3. Update Frontend (if needed)

The frontend should work without changes as the API contracts remain the same.

## Troubleshooting

### Issue: Connection timeout to Cosmos DB
**Solution:** 
- Ensure firewall rules allow your IP
- Check connection string format
- Verify Cosmos DB is in the same region

### Issue: Duplicate key errors during import
**Solution:**
- Use `ordered: false` in insertMany
- Handle error code 11000 (duplicate key)
- Consider using `updateOne` with `upsert: true`

### Issue: Data type mismatches
**Solution:**
- Ensure dates are converted: `new Date(parseDate)`
- Remove Parse-specific fields: `__type`, `className`, `ACL`
- Convert `objectId` to `_id`

## Rollback Plan

If migration fails:

1. **Keep Back4App running** during initial Azure deployment
2. **Test thoroughly** before decommissioning Back4App
3. **Export final backup** from Back4App before deletion
4. **Document any data transformations** for reference

## Cost Comparison

### Back4App
- Shared: $25-50/month
- Dedicated: $100+/month

### Azure Cosmos DB
- 400 RU/s: ~$24/month
- 1000 RU/s: ~$60/month
- Auto-scale available

## Timeline Estimate

- Small dataset (<10K records): 1-2 hours
- Medium dataset (10K-100K): 4-8 hours
- Large dataset (100K+): 1-2 days

## Support

For migration issues:
1. Check Cosmos DB metrics in Azure Portal
2. Review application logs
3. Verify data integrity with sample queries
4. Test all CRUD operations

---

**Migration Checklist:**
- [ ] Export data from Back4App
- [ ] Provision Azure Cosmos DB
- [ ] Test connection to Cosmos DB
- [ ] Run migration script
- [ ] Verify record counts
- [ ] Test application with Cosmos DB
- [ ] Update DNS/redirects if needed
- [ ] Monitor for 48 hours
- [ ] Backup data from Cosmos DB
- [ ] Decommission Back4App (optional)

**Success!** Your data is now in Azure Cosmos DB.
