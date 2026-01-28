/**
 * Deploy to Cloudflare Pages
 * 
 * This script:
 * 1. Builds the React app for Cloudflare Pages
 * 2. Copies necessary files (redirects, functions)
 * 3. Deploys to Cloudflare Pages using Wrangler
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function deployCloudflarePages() {
  try {
    console.log('[Deploy Pages] Starting Cloudflare Pages deployment...');

    // Check for Cloudflare credentials
    const apiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (!apiToken) {
      console.warn('[Deploy Pages] CLOUDFLARE_API_TOKEN not set. Skipping deployment.');
      console.warn('[Deploy Pages] Pages deployment requires Cloudflare API token.');
      return null;
    }

    // Check if wrangler is available
    try {
      execSync('wrangler --version', { stdio: 'ignore' });
    } catch (error) {
      console.warn('[Deploy Pages] Wrangler CLI not available. Skipping deployment.');
      console.warn('[Deploy Pages] Install Wrangler: npm install -g wrangler');
      return null;
    }

    // Build for Cloudflare Pages
    console.log('[Deploy Pages] Building React app for Cloudflare Pages...');
    // Use cross-platform compatible syntax
    const buildCommand = 'NODE_OPTIONS=--max-old-space-size=4096 BUILD_OUT_DIR=cloudflare-pages/dist vite build';
    
    try {
      execSync(buildCommand, { 
        stdio: 'inherit',
        shell: true,
        cwd: path.join(__dirname, '..')
      });
    } catch (error) {
      console.error('[Deploy Pages] Build failed:', error.message);
      return null;
    }

    // Copy redirects file
    const redirectsSource = path.join(__dirname, '..', 'cloudflare-pages', '_redirects');
    const redirectsDest = path.join(__dirname, '..', 'cloudflare-pages', 'dist', '_redirects');
    if (fs.existsSync(redirectsSource)) {
      fs.copyFileSync(redirectsSource, redirectsDest);
      console.log('[Deploy Pages] Copied _redirects file');
    }

    // Copy functions directory
    const functionsSource = path.join(__dirname, '..', 'cloudflare-pages', 'functions');
    const functionsDest = path.join(__dirname, '..', 'cloudflare-pages', 'dist', 'functions');
    if (fs.existsSync(functionsSource)) {
      // Copy directory recursively
      if (fs.existsSync(functionsDest)) {
        fs.rmSync(functionsDest, { recursive: true, force: true });
      }
      fs.mkdirSync(functionsDest, { recursive: true });
      copyDirectory(functionsSource, functionsDest);
      console.log('[Deploy Pages] Copied functions directory');
    }

    // Deploy to Cloudflare Pages
    const distDir = path.join(__dirname, '..', 'cloudflare-pages', 'dist');
    const deployCommand = `wrangler pages deploy "${distDir}" --project-name=shreenathji-app`;

    console.log('[Deploy Pages] Deploying to Cloudflare Pages...');
    let output;
    try {
      output = execSync(deployCommand, {
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: apiToken,
        },
        encoding: 'utf8',
        stdio: 'pipe',
        shell: true,
        cwd: path.join(__dirname, '..')
      });
    } catch (error) {
      console.error('[Deploy Pages] Deployment failed:', error.message);
      if (error.stdout) console.error('[Deploy Pages] stdout:', error.stdout);
      if (error.stderr) console.error('[Deploy Pages] stderr:', error.stderr);
      return null;
    }

    // Extract Pages URL from output
    // Wrangler output format: "✨ Success! Uploaded... https://shreenathji-app.pages.dev"
    const urlMatch = output.match(/https:\/\/[^\s]+\.pages\.dev/);
    if (urlMatch) {
      const pagesUrl = urlMatch[0];
      console.log('[Deploy Pages] Pages deployed successfully:', pagesUrl);
      return pagesUrl;
    } else {
      console.log('[Deploy Pages] Deployment completed, but could not extract URL from output');
      console.log('[Deploy Pages] Output:', output);
      return 'deployed';
    }
  } catch (error) {
    console.error('[Deploy Pages] Deployment failed:', error.message);
    throw error;
  }
}

function copyDirectory(source, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

// If run directly, deploy pages
if (require.main === module) {
  deployCloudflarePages()
    .then((url) => {
      if (url) {
        console.log('\n✅ Cloudflare Pages deployed successfully!');
        console.log('Pages URL:', url);
        process.exit(0);
      } else {
        console.log('\n⚠️  Pages deployment skipped (no credentials or build failed)');
        process.exit(0);
      }
    })
    .catch((error) => {
      console.error('\n❌ Pages deployment failed:', error.message);
      process.exit(1);
    });
}

module.exports = { deployCloudflarePages };


