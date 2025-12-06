const express = require('express');
const router = express.Router();
const Config = require('../models/Config');
const { deployCloudflarePages } = require('../../scripts/deploy-cloudflare-pages');

// Get current Cloudflare Pages URL
router.get('/url', async (req, res) => {
  try {
    const pagesUrl = await Config.get('cloudflarePagesUrl', null);
    res.json({ 
      success: true, 
      url: pagesUrl,
      exists: !!pagesUrl
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Deploy/Update Cloudflare Pages
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
      console.warn('[Cloudflare Pages API] PARSE_MASTER_KEY not set - deployment will work but pages URL won\'t be saved to Config');
      console.warn('[Cloudflare Pages API] You can manually add the pages URL to environment variables after deployment');
    }

    console.log('[Cloudflare Pages API] Deploying to Cloudflare Pages...');
    
    // Deploy pages
    const pagesUrl = await deployCloudflarePages();
    
    if (pagesUrl) {
      // Try to save to Config (don't fail if Master Key missing)
      try {
        await Config.set('cloudflarePagesUrl', pagesUrl);
        console.log('[Cloudflare Pages API] Pages URL saved to Config');
      } catch (error) {
        console.warn('[Cloudflare Pages API] Could not save pages URL to Config (Master Key may be missing)');
        console.warn('[Cloudflare Pages API] Pages URL:', pagesUrl);
      }
      
      res.json({ 
        success: true, 
        url: pagesUrl,
        message: 'Pages deployed successfully'
      });
    } else {
      res.status(500).json({ 
        success: false, 
        error: 'Pages deployment failed. Check server logs for details.' 
      });
    }
  } catch (error) {
    console.error('[Cloudflare Pages API] Deployment error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to deploy pages' 
    });
  }
});

module.exports = router;


