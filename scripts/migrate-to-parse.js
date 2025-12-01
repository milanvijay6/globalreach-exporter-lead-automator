/**
 * Migration script to migrate data from config.json to Parse Database
 * 
 * Usage: node scripts/migrate-to-parse.js [path-to-config.json]
 */

const fs = require('fs');
const path = require('path');

// Initialize Parse
process.env.PARSE_APPLICATION_ID = process.env.PARSE_APPLICATION_ID || '';
process.env.PARSE_JAVASCRIPT_KEY = process.env.PARSE_JAVASCRIPT_KEY || '';
process.env.PARSE_SERVER_URL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';
process.env.PARSE_MASTER_KEY = process.env.PARSE_MASTER_KEY || '';

if (!process.env.PARSE_APPLICATION_ID || !process.env.PARSE_MASTER_KEY) {
  console.error('Error: PARSE_APPLICATION_ID and PARSE_MASTER_KEY environment variables are required');
  console.error('Set them in your .env file or export them before running this script');
  process.exit(1);
}

const Parse = require('parse/node');
Parse.initialize(process.env.PARSE_APPLICATION_ID, process.env.PARSE_JAVASCRIPT_KEY);
Parse.serverURL = process.env.PARSE_SERVER_URL;
Parse.masterKey = process.env.PARSE_MASTER_KEY;

const Config = require('../server/models/Config');
const Product = require('../server/models/Product');

async function migrateConfig(configPath) {
  console.log(`\n📦 Migrating config from: ${configPath}\n`);
  
  if (!fs.existsSync(configPath)) {
    console.error(`Error: Config file not found at ${configPath}`);
    return;
  }
  
  try {
    const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    let migrated = 0;
    let skipped = 0;
    
    for (const [key, value] of Object.entries(configData)) {
      try {
        // Check if already exists
        const existing = await Config.get(key);
        if (existing !== null) {
          console.log(`⏭️  Skipping ${key} (already exists)`);
          skipped++;
          continue;
        }
        
        // Migrate to Parse
        await Config.set(key, value);
        console.log(`✅ Migrated config: ${key}`);
        migrated++;
      } catch (error) {
        console.error(`❌ Error migrating ${key}:`, error.message);
      }
    }
    
    console.log(`\n✅ Config migration complete: ${migrated} migrated, ${skipped} skipped\n`);
  } catch (error) {
    console.error('Error reading config file:', error);
  }
}

async function migrateProducts() {
  console.log(`\n📦 Migrating products...\n`);
  
  try {
    // Try to get products from config
    const productsData = await Config.get('products_catalog', null);
    
    if (!productsData) {
      console.log('⏭️  No products found in config');
      return;
    }
    
    const products = typeof productsData === 'string' ? JSON.parse(productsData) : productsData;
    const productArray = Array.isArray(products) ? products : [];
    
    if (productArray.length === 0) {
      console.log('⏭️  No products to migrate');
      return;
    }
    
    let migrated = 0;
    let skipped = 0;
    
    for (const product of productArray) {
      try {
        // Check if product already exists (by ID or name)
        if (product.id) {
          try {
            const existing = await Product.findById(product.id);
            if (existing) {
              console.log(`⏭️  Skipping product: ${product.name || product.id} (already exists)`);
              skipped++;
              continue;
            }
          } catch (error) {
            // Product doesn't exist, continue with migration
          }
        }
        
        // Create product in Parse
        await Product.create({
          ...product,
          id: product.id || `product_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        });
        
        console.log(`✅ Migrated product: ${product.name || product.id}`);
        migrated++;
      } catch (error) {
        console.error(`❌ Error migrating product ${product.name || product.id}:`, error.message);
      }
    }
    
    console.log(`\n✅ Product migration complete: ${migrated} migrated, ${skipped} skipped\n`);
  } catch (error) {
    console.error('Error migrating products:', error);
  }
}

async function main() {
  console.log('🚀 Starting migration to Parse Database...\n');
  
  // Get config path from command line or use default
  const configPath = process.argv[2] || path.join(process.env.APPDATA || process.env.HOME, 'shreenathji-app', 'config.json');
  
  // Migrate config
  await migrateConfig(configPath);
  
  // Migrate products
  await migrateProducts();
  
  console.log('✅ Migration complete!\n');
  console.log('Next steps:');
  console.log('1. Verify data in Back4App dashboard');
  console.log('2. Update your app to use Parse Database');
  console.log('3. Test the application\n');
}

main().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});

