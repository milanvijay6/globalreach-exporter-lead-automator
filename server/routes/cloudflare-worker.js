const express = require('express');
const router = express.Router();
const Config = require('../models/Config');
const { deployWorker } = require('../../scripts/deploy-cloudflare-worker');
const { getBack4AppUrl } = require('../../scripts/get-back4app-url');

// Get current Cloudflare Worker URL
router.get('/url', async (req, res) => {
  try {
    const workerUrl = await Config.get('cloudflareWorkerUrl', null);
    res.json({ 
      success: true, 
      url: workerUrl,
      exists: !!workerUrl
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deploy/Update Cloudflare Worker
router.post('/deploy', async (req, res) => {
  try {
    // Check if Cloudflare credentials are available
    if (!process.env.CLOUDFLARE_API_TOKEN) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cloudflare API token not configured. Set CLOUDFLARE_API_TOKEN environment variable in Back4App.' 
      });
    }

    // Check if Parse Master Key is available (optional - deployment will still work but won't save to Config)
    if (!process.env.PARSE_MASTER_KEY) {
      console.warn('[Cloudflare Worker API] PARSE_MASTER_KEY not set - deployment will work but worker URL won\'t be saved to Config');
      console.warn('[Cloudflare Worker API] You can manually add the worker URL to environment variables after deployment');
    }

    console.log('[Cloudflare Worker API] Deploying worker...');
    
    // Deploy worker
    const workerUrl = await deployWorker();
    
    if (workerUrl) {
      res.json({ 
        success: true, 
        url: workerUrl,
        message: 'Worker deployed successfully'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Worker deployment failed. Check server logs for details.' 
      });
    }
  } catch (error) {
    console.error('[Cloudflare Worker API] Deployment error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to deploy worker' 
    });
  }
});

// Reset/Generate new Cloudflare Worker URL
router.post('/reset', async (req, res) => {
  try {
    // Check if Cloudflare credentials are available
    if (!process.env.CLOUDFLARE_API_TOKEN) {
      return res.status(400).json({ 
        success: false, 
        error: 'Cloudflare API token not configured. Set CLOUDFLARE_API_TOKEN environment variable.' 
      });
    }

    console.log('[Cloudflare Worker API] Resetting worker...');
    
    // Generate new worker name
    const timestamp = Date.now();
    const newWorkerName = `shreenathji-oauth-${timestamp}`;
    
    // Store new worker name
    await Config.set('cloudflareWorkerName', newWorkerName);
    
    // Deploy new worker
    const workerUrl = await deployWorker();
    
    if (workerUrl) {
      res.json({ 
        success: true, 
        url: workerUrl,
        message: 'New worker URL generated successfully'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Worker reset failed. Check server logs for details.' 
      });
    }
  } catch (error) {
    console.error('[Cloudflare Worker API] Reset error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to reset worker' 
    });
  }
});

// Get Back4App URL (for reference)
router.get('/back4app-url', async (req, res) => {
  try {
    const back4appUrl = getBack4AppUrl(req);
    res.json({ 
      success: true, 
      url: back4appUrl
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;

