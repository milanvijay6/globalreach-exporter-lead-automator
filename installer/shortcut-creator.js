const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Shortcut Creator
 * Creates desktop and Start Menu shortcuts on Windows
 */

/**
 * Creates a Windows shortcut using VBScript
 */
function createShortcut(targetPath, shortcutPath, options = {}) {
  const {
    iconPath,
    workingDir,
    description,
    arguments: args
  } = options;
  
  const vbsScript = `
Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = "${shortcutPath.replace(/\\/g, '\\\\')}"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "${targetPath.replace(/\\/g, '\\\\')}"
${workingDir ? `oLink.WorkingDirectory = "${workingDir.replace(/\\/g, '\\\\')}"` : ''}
${iconPath ? `oLink.IconLocation = "${iconPath.replace(/\\/g, '\\\\')}"` : ''}
${description ? `oLink.Description = "${description}"` : ''}
${args ? `oLink.Arguments = "${args}"` : ''}
oLink.Save
`;
  
  const scriptPath = path.join(require('os').tmpdir(), 'create-shortcut.vbs');
  fs.writeFileSync(scriptPath, vbsScript);
  
  try {
    execSync(`cscript //nologo "${scriptPath}"`, { stdio: 'pipe' });
    fs.unlinkSync(scriptPath);
    return true;
  } catch (error) {
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath);
    }
    throw error;
  }
}

/**
 * Creates desktop shortcut
 */
function createDesktopShortcut(appPath, appName, options = {}) {
  const desktopPath = path.join(require('os').homedir(), 'Desktop');
  const shortcutPath = path.join(desktopPath, `${appName}.lnk`);
  
  return createShortcut(appPath, shortcutPath, {
    workingDir: path.dirname(appPath),
    description: `Launch ${appName}`,
    ...options
  });
}

/**
 * Creates Start Menu shortcut
 */
function createStartMenuShortcut(appPath, appName, options = {}) {
  const startMenuPath = path.join(
    require('os').homedir(),
    'AppData',
    'Roaming',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs'
  );
  
  if (!fs.existsSync(startMenuPath)) {
    fs.mkdirSync(startMenuPath, { recursive: true });
  }
  
  const shortcutPath = path.join(startMenuPath, `${appName}.lnk`);
  
  return createShortcut(appPath, shortcutPath, {
    workingDir: path.dirname(appPath),
    description: `Launch ${appName}`,
    ...options
  });
}

/**
 * Removes shortcuts
 */
function removeShortcuts(appName) {
  const desktopPath = path.join(require('os').homedir(), 'Desktop');
  const desktopShortcut = path.join(desktopPath, `${appName}.lnk`);
  
  const startMenuPath = path.join(
    require('os').homedir(),
    'AppData',
    'Roaming',
    'Microsoft',
    'Windows',
    'Start Menu',
    'Programs',
    `${appName}.lnk`
  );
  
  const removed = [];
  
  if (fs.existsSync(desktopShortcut)) {
    fs.unlinkSync(desktopShortcut);
    removed.push('desktop');
  }
  
  if (fs.existsSync(startMenuPath)) {
    fs.unlinkSync(startMenuPath);
    removed.push('start-menu');
  }
  
  return removed;
}

if (require.main === module) {
  // Example usage
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log('Usage: node shortcut-creator.js <app-path> <app-name> [desktop|start-menu|both]');
    process.exit(1);
  }
  
  const [appPath, appName, location = 'both'] = args;
  
  try {
    if (location === 'desktop' || location === 'both') {
      createDesktopShortcut(appPath, appName);
      console.log('Desktop shortcut created');
    }
    
    if (location === 'start-menu' || location === 'both') {
      createStartMenuShortcut(appPath, appName);
      console.log('Start Menu shortcut created');
    }
    
    console.log('Shortcuts created successfully');
  } catch (error) {
    console.error('Failed to create shortcuts:', error.message);
    process.exit(1);
  }
}

module.exports = {
  createDesktopShortcut,
  createStartMenuShortcut,
  createShortcut,
  removeShortcuts
};

