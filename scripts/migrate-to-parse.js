/**
 * Migration script to migrate data from local config.json to Parse Database
 * Run this script after setting up Back4App environment variables
 */

const Parse = require('parse/node');
const fs = require('fs');
const path = require('path');

// Initialize Parse
Parse.initialize(
  process.env.PARSE_APPLICATION_ID || '',
  process.env.PARSE_JAVASCRIPT_KEY || ''
);
Parse.serverURL = process.env.PARSE_SERVER_URL || 'https://parseapi.back4app.com/';
if (process.env.PARSE_MASTER_KEY) {
  Parse.masterKey = process.env.PARSE_MASTER_KEY;
}

const Config = Parse.Object.extend('Config');

async function migrateConfig() {
  try {
    // Try to find config.json in common locations
    const configPaths = [
      path.join(process.env.APPDATA || '', 'shreenathji-app', 'config.json'), // Windows
      path.join(process.env.HOME || '', 'Library', 'Application Support', 'shreenathji-app', 'config.json'), // macOS
      path.join(process.env.HOME || '', '.config', 'shreenathji-app', 'config.json'), // Linux
      path.join(process.cwd(), 'config.json'), // Current directory
    ];

    let configData = null;
    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        console.log(`Found config at: ${configPath}`);
        configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        break;
      }
    }

    if (!configData) {
      console.log('No config.json found. Skipping config migration.');
      return;
    }

    console.log('Migrating config to Parse...');
    
    // Migrate each config key
    for (const [key, value] of Object.entries(configData)) {
      try {
        const query = new Parse.Query(Config);
        query.equalTo('key', key);
        let config = await query.first({ useMasterKey: true });
        
        if (config) {
          config.set('value', value);
          await config.save(null, { useMasterKey: true });
          console.log(`Updated config: ${key}`);
        } else {
          config = new Config();
          config.set('key', key);
          config.set('value', value);
          await config.save(null, { useMasterKey: true });
          console.log(`Created config: ${key}`);
        }
      } catch (error) {
        console.error(`Error migrating config key ${key}:`, error.message);
      }
    }

    console.log('Config migration completed!');
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

// Run migration
migrateConfig().then(() => {
  console.log('Migration script completed.');
  process.exit(0);
}).catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});















