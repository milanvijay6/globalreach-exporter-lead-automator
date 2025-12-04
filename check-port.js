// Quick script to check what port the server is configured to use
const os = require('os');
const path = require('path');
const fs = require('fs');

// Get the config file path (same as Electron app uses)
const userDataPath = path.join(os.homedir(), 'AppData', 'Roaming', 'shreenathji-app');
const configPath = path.join(userDataPath, 'config.json');

console.log('Checking server port configuration...\n');
console.log('Config file location:', configPath);
console.log('');

if (fs.existsSync(configPath)) {
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const port = config.serverPort || 4000;
    console.log('✅ Found configuration!');
    console.log('📌 Server Port:', port);
    console.log('');
    console.log('Azure Redirect URI should be:');
    console.log(`   http://localhost:${port}/api/oauth/callback`);
  } catch (error) {
    console.log('❌ Error reading config file:', error.message);
    console.log('');
    console.log('Using default port: 4000');
    console.log('Azure Redirect URI should be:');
    console.log('   http://localhost:4000/api/oauth/callback');
  }
} else {
  console.log('⚠️  Config file not found. App may not have been run yet.');
  console.log('');
  console.log('Default port: 4000');
  console.log('Azure Redirect URI should be:');
  console.log('   http://localhost:4000/api/oauth/callback');
  console.log('');
  console.log('Note: If port 4000 is in use, the app will use 4001, 4002, etc.');
  console.log('Check the actual port in Settings → System after starting the app.');
}

console.log('');
console.log('---');
console.log('To check what port is actually in use:');
console.log('1. Start your Electron app');
console.log('2. Go to Settings → System');
console.log('3. Look for "Server Port"');













