const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');
const os = require('os');
const { checkAllDependencies, REQUIRED_DEPENDENCIES } = require('./dependency-checker');

/**
 * Dependency Manager
 * Handles downloading and installing missing dependencies
 */

/**
 * Downloads a file
 */
function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;
      
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (onProgress && totalSize) {
          onProgress(downloaded, totalSize);
        }
        file.write(chunk);
      });
      
      response.on('end', () => {
        file.end();
        resolve(dest);
      });
      
      response.on('error', (error) => {
        fs.unlinkSync(dest);
        reject(error);
      });
    }).on('error', (error) => {
      fs.unlinkSync(dest);
      reject(error);
    });
  });
}

/**
 * Installs Node.js on Windows
 */
function installNodeJS(installerPath, onProgress) {
  return new Promise((resolve, reject) => {
    if (onProgress) onProgress('Installing Node.js...');
    
    // Use msiexec to install
    const installProcess = spawn('msiexec', [
      '/i', installerPath,
      '/quiet',
      '/norestart',
      'ADDLOCAL=ALL'
    ], {
      stdio: 'inherit',
      shell: true
    });
    
    installProcess.on('close', (code) => {
      if (code === 0) {
        // Wait a bit for installation to complete
        setTimeout(() => {
          // Verify installation
          try {
            execSync('node --version', { encoding: 'utf8' });
            resolve();
          } catch (error) {
            reject(new Error('Node.js installation verification failed'));
          }
        }, 5000);
      } else {
        reject(new Error(`Node.js installation failed with code ${code}`));
      }
    });
    
    installProcess.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Installs missing dependencies
 */
async function installMissingDependencies(missing, options = {}) {
  const { onProgress, downloadDir } = options;
  const installDir = downloadDir || path.join(os.tmpdir(), 'globalreach-installer');
  
  if (!fs.existsSync(installDir)) {
    fs.mkdirSync(installDir, { recursive: true });
  }
  
  const results = {
    success: [],
    failed: []
  };
  
  for (const depKey of missing) {
    const dep = REQUIRED_DEPENDENCIES[depKey];
    if (!dep) continue;
    
    try {
      if (onProgress) {
        onProgress(`Downloading ${dep.name}...`);
      }
      
      const installerPath = path.join(installDir, dep.installer);
      
      // Download
      await downloadFile(dep.downloadUrl, installerPath, (downloaded, total) => {
        if (onProgress) {
          const percent = Math.round((downloaded / total) * 100);
          onProgress(`Downloading ${dep.name}: ${percent}%`);
        }
      });
      
      // Install
      if (depKey === 'nodejs') {
        await installNodeJS(installerPath, onProgress);
      }
      
      results.success.push(depKey);
      
      if (onProgress) {
        onProgress(`${dep.name} installed successfully`);
      }
    } catch (error) {
      results.failed.push({
        dependency: depKey,
        error: error.message
      });
      
      if (onProgress) {
        onProgress(`Failed to install ${dep.name}: ${error.message}`);
      }
    }
  }
  
  return results;
}

/**
 * Verifies installation
 */
function verifyInstallation() {
  const checkResults = checkAllDependencies();
  return checkResults.allMet;
}

if (require.main === module) {
  // Run as script
  const checkResults = checkAllDependencies();
  
  if (checkResults.allMet) {
    console.log('All dependencies are installed');
    process.exit(0);
  } else {
    console.log('Missing dependencies:', checkResults.missing);
    installMissingDependencies(checkResults.missing, {
      onProgress: (message) => console.log(message)
    }).then((results) => {
      if (results.failed.length === 0) {
        console.log('All dependencies installed successfully');
        process.exit(0);
      } else {
        console.error('Some dependencies failed to install:', results.failed);
        process.exit(1);
      }
    }).catch((error) => {
      console.error('Installation failed:', error);
      process.exit(1);
    });
  }
}

const os = require('os');

module.exports = {
  installMissingDependencies,
  verifyInstallation,
  downloadFile
};

