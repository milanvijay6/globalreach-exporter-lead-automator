// Script to copy built files from main project to web-server/public
const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..', 'electron', 'build');
const destDir = path.join(__dirname, 'public');

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  
  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(
        path.join(src, childItemName),
        path.join(dest, childItemName)
      );
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('📦 Copying built files...');
console.log(`Source: ${sourceDir}`);
console.log(`Destination: ${destDir}`);

if (!fs.existsSync(sourceDir)) {
  console.error('❌ Error: Build directory not found!');
  console.error('Please run "npm run build:react" in the main project first.');
  process.exit(1);
}

try {
  // Clear destination directory
  if (fs.existsSync(destDir)) {
    fs.rmSync(destDir, { recursive: true, force: true });
  }
  
  // Create destination directory
  fs.mkdirSync(destDir, { recursive: true });
  
  // Copy files
  copyRecursiveSync(sourceDir, destDir);
  
  console.log('✅ Files copied successfully!');
  console.log('🚀 You can now start the server with: npm start');
} catch (error) {
  console.error('❌ Error copying files:', error.message);
  process.exit(1);
}

