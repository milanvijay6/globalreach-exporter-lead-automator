# Deployment Guide

This guide explains how to deploy the GlobalReach web server to various hosting platforms.

## Quick Start

1. **Build the React app** (from main project):
   ```bash
   cd ../globalreach---exporter-lead-automator
   npm run build:react
   ```

2. **Copy built files**:
   ```bash
   cp -r electron/build/* web-server/public/
   ```

3. **Deploy** using one of the methods below.

## Deployment Methods

### 1. Heroku

```bash
# Install Heroku CLI first
heroku login
heroku create your-app-name
heroku buildpacks:set heroku/nodejs

# Add environment variables
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### 2. Railway

```bash
# Install Railway CLI
npm i -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### 3. Render

1. Go to https://render.com
2. Connect your GitHub repository
3. Create a new Web Service
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Environment**: `Node`

### 4. DigitalOcean App Platform

1. Go to https://cloud.digitalocean.com/apps
2. Create App → GitHub
3. Select repository
4. Configure:
   - **Type**: Web Service
   - **Build Command**: `npm install`
   - **Run Command**: `npm start`
   - **Environment Variables**: Add `NODE_ENV=production`

### 5. Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### 6. AWS EC2 / Custom VPS

```bash
# SSH into server
ssh user@your-server.com

# Clone repository
git clone your-repo-url
cd web-server

# Install Node.js (if not installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install dependencies
npm install

# Copy built files to public/
# (You need to build and copy from main project)

# Install PM2
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

### 7. Docker Deployment

```bash
# Build Docker image
docker build -t globalreach-web-server .

# Run container
docker run -d -p 3000:3000 --name globalreach globalreach-web-server

# Or use docker-compose
docker-compose up -d
```

## Post-Deployment

1. **Verify deployment**:
   ```bash
   curl https://your-domain.com/api/health
   ```

2. **Set up domain** (if using custom domain):
   - Point DNS to your hosting provider
   - Configure SSL certificate (Let's Encrypt recommended)

3. **Monitor**:
   - Check logs regularly
   - Set up monitoring (UptimeRobot, Pingdom, etc.)

## Environment Variables

Set these in your hosting platform:

- `PORT`: Server port (usually auto-set by platform)
- `NODE_ENV`: `production`
- `ALLOWED_ORIGINS`: Your domain(s) for CORS

## Troubleshooting

### Server won't start
- Check if port is available
- Verify Node.js version (>= 18.0.0)
- Check logs: `pm2 logs` or hosting platform logs

### 404 errors
- Ensure `public/` directory has `index.html`
- Verify file paths are correct
- Check server logs

### CORS errors
- Set `ALLOWED_ORIGINS` environment variable
- Verify CORS configuration in `server.js`

## Updating the Deployment

1. Build new version in main project
2. Copy new files to `public/`
3. Restart server:
   - PM2: `pm2 restart globalreach-web-server`
   - Docker: `docker-compose restart`
   - Platform: Usually auto-deploys on git push

