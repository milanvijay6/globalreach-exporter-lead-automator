const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Dependency Checker
 * Validates system requirements and dependencies
 */

const MIN_NODE_VERSION = '18.0.0';
const REQUIRED_DEPENDENCIES = {
  nodejs: {
    name: 'Node.js',
    minVersion: MIN_NODE_VERSION,
    check: checkNodeVersion,
    downloadUrl: 'https://nodejs.org/dist/v18.20.0/node-v18.20.0-x64.msi',
    installer: 'nodejs-installer.msi'
  }
};

/**
 * Checks Node.js version
 */
function checkNodeVersion() {
  try {
    const version = execSync('node --version', { encoding: 'utf8', stdio: 'pipe' }).trim();
    const versionNumber = version.replace('v', '');
    return {
      installed: true,
      version: versionNumber,
      meetsRequirement: compareVersions(versionNumber, MIN_NODE_VERSION) >= 0
    };
  } catch (error) {
    return {
      installed: false,
      version: null,
      meetsRequirement: false
    };
  }
}

/**
 * Compares two version strings
 */
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  return 0;
}

/**
 * Checks system requirements
 */
function checkSystemRequirements() {
  const platform = os.platform();
  const arch = os.arch();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  
  const requirements = {
    platform: platform === 'win32',
    architecture: arch === 'x64' || arch === 'ia32',
    memory: {
      total: totalMem,
      free: freeMem,
      minimum: 2 * 1024 * 1024 * 1024, // 2GB
      meetsRequirement: totalMem >= 2 * 1024 * 1024 * 1024
    },
    diskSpace: {
      // Will be checked separately
      minimum: 500 * 1024 * 1024 // 500MB
    }
  };
  
  return requirements;
}

/**
 * Checks all dependencies
 */
function checkAllDependencies() {
  const results = {
    system: checkSystemRequirements(),
    dependencies: {},
    allMet: true,
    missing: [],
    outdated: []
  };
  
  for (const [key, dep] of Object.entries(REQUIRED_DEPENDENCIES)) {
    const checkResult = dep.check();
    results.dependencies[key] = {
      ...dep,
      ...checkResult
    };
    
    if (!checkResult.installed) {
      results.allMet = false;
      results.missing.push(key);
    } else if (!checkResult.meetsRequirement) {
      results.allMet = false;
      results.outdated.push(key);
    }
  }
  
  // Check system requirements
  if (!results.system.platform) {
    results.allMet = false;
    results.missing.push('windows-platform');
  }
  
  if (!results.system.memory.meetsRequirement) {
    results.allMet = false;
    results.missing.push('sufficient-memory');
  }
  
  return results;
}

/**
 * Gets disk space available
 */
function getDiskSpace(pathToCheck) {
  try {
    if (process.platform === 'win32') {
      const drive = pathToCheck.substring(0, 2);
      const result = execSync(`wmic logicaldisk where "DeviceID='${drive}'" get FreeSpace,Size`, { encoding: 'utf8' });
      const lines = result.trim().split('\n').filter(l => l.trim());
      if (lines.length > 1) {
        const values = lines[1].trim().split(/\s+/);
        return {
          free: parseInt(values[0]),
          total: parseInt(values[1])
        };
      }
    }
  } catch (error) {
    // Fallback
  }
  
  return {
    free: 0,
    total: 0
  };
}

if (require.main === module) {
  // Run as script
  const results = checkAllDependencies();
  console.log(JSON.stringify(results, null, 2));
  process.exit(results.allMet ? 0 : 1);
}

module.exports = {
  checkAllDependencies,
  checkSystemRequirements,
  getDiskSpace,
  REQUIRED_DEPENDENCIES
};

