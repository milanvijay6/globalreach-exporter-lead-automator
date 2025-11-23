const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Build Installer Script
 * Prepares and builds the Windows installer
 */

const BUILD_DIR = path.join(__dirname, '..', 'dist');
const INSTALLER_DIR = path.join(__dirname, '..', 'installer');

/**
 * Prepares build directory
 */
function prepareBuild() {
  console.log('Preparing build directory...');
  
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }
  
  // Clean previous builds
  const files = fs.readdirSync(BUILD_DIR);
  for (const file of files) {
    const filePath = path.join(BUILD_DIR, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
  }
  
  console.log('Build directory prepared.');
}

/**
 * Builds React app
 */
function buildReact() {
  console.log('Building React application...');
  try {
    execSync('npm run build:react', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('React app built successfully.');
  } catch (error) {
    console.error('Failed to build React app:', error.message);
    process.exit(1);
  }
}

/**
 * Copies installer files
 */
function copyInstallerFiles() {
  console.log('Copying installer files...');
  
  const installerFiles = [
    'dependency-checker.js',
    'dependency-manager.js',
    'shortcut-creator.js',
    'installer.ps1'
  ];
  
  for (const file of installerFiles) {
    const source = path.join(INSTALLER_DIR, file);
    const dest = path.join(BUILD_DIR, 'installer', file);
    
    if (fs.existsSync(source)) {
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(source, dest);
      console.log(`  Copied: ${file}`);
    }
  }
  
  console.log('Installer files copied.');
}

/**
 * Creates installer package
 */
function createInstallerPackage() {
  console.log('Creating installer package...');
  
  // Create a zip file with all necessary files
  const packageJson = require(path.join(__dirname, '..', 'package.json'));
  const packageName = `${packageJson.name}-${packageJson.version}-installer`;
  const packagePath = path.join(BUILD_DIR, `${packageName}.zip`);
  
  // For now, just create a directory structure
  // In production, you'd use a library like archiver to create the zip
  console.log(`Installer package would be created at: ${packagePath}`);
  console.log('Note: Full installer packaging requires additional tools.');
}

/**
 * Main build process
 */
function main() {
  console.log('========================================');
  console.log('Building GlobalReach Installer');
  console.log('========================================\n');
  
  try {
    prepareBuild();
    buildReact();
    copyInstallerFiles();
    createInstallerPackage();
    
    console.log('\n========================================');
    console.log('Build Complete!');
    console.log('========================================');
    console.log(`Output directory: ${BUILD_DIR}`);
  } catch (error) {
    console.error('\nBuild failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  prepareBuild,
  buildReact,
  copyInstallerFiles,
  createInstallerPackage
};

