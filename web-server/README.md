# GlobalReach Web Server

This is a standalone web server for hosting the GlobalReach Exporter Lead Automator application.

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the React App

First, build the React app from the main project:

```bash
# From the main project directory
npm run build:react
```

### 3. Copy Built Files

Copy the built files from the main project to this server's `public` directory:

```bash
# From the main project directory
cp -r electron/build/* web-server/public/

# On Windows PowerShell:
# Copy-Item -Path "electron\build\*" -Destination "web-server\public\" -Recurse
```

Or create a `public` directory and copy the contents of `electron/build` into it.

### 4. Configure Environment Variables (Optional)

Create a `.env` file:

```env
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

### 5. Start the Server

```bash
npm start
```

The server will run on `http://localhost:3000` (or the port specified in PORT environment variable).

## Deployment Options

### Option 1: Deploy to Heroku

1. Install Heroku CLI
2. Login: `heroku login`
3. Create app: `heroku create your-app-name`
4. Set buildpack: `heroku buildpacks:set heroku/nodejs`
5. Deploy: `git push heroku main`

### Option 2: Deploy to Railway

1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Deploy: `railway up`

### Option 3: Deploy to Render

1. Connect your GitHub repository
2. Create a new Web Service
3. Set build command: `npm install && npm start`
4. Set start command: `npm start`
5. Set environment: `Node`

### Option 4: Deploy to DigitalOcean App Platform

1. Connect your repository
2. Create a new App
3. Select Node.js
4. Set build command: `npm install`
5. Set run command: `npm start`

### Option 5: Deploy to Vercel

1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel`

### Option 6: Deploy to AWS EC2 / Custom VPS

1. SSH into your server
2. Clone the repository
3. Install Node.js and npm
4. Run `npm install`
5. Copy built files to `public/` directory
6. Use PM2 to run: `pm2 start server.js --name globalreach`
7. Configure nginx as reverse proxy (optional)

## Using PM2 for Production

```bash
# Install PM2 globally
npm install -g pm2

# Start the server
pm2 start server.js --name globalreach

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

## Nginx Configuration (Optional)

If using Nginx as a reverse proxy:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Environment Variables

- `PORT`: Server port (default: 3000)
- `NODE_ENV`: Environment mode (development/production)
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins

## Health Check

The server includes a health check endpoint:

```
GET /api/health
```

Returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "1.0.0"
}
```

## Notes

- The server serves static files from the `public/` directory
- All routes are handled by React Router (serves index.html)
- API routes should be prefixed with `/api/`
- Static assets are cached for 1 year
- Security headers are enabled via Helmet

