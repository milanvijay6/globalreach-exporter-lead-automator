# Docker Deployment Guide for Back4App

This guide explains how to deploy the application using Docker on Back4App.

## Dockerfile Overview

The Dockerfile is configured to:
1. Use Node.js 18 Alpine (lightweight)
2. Install dependencies
3. Build the React frontend
4. Start the Express server

## Build Process

The Dockerfile performs these steps:

```dockerfile
1. Base image: node:18-alpine
2. Install root dependencies (production only)
3. Install server dependencies (production only)
4. Copy application files
5. Build React frontend (npm run build:web)
6. Expose port 4000
7. Start server (node server/index.js)
```

## Environment Variables

Set these in Back4App dashboard:

```
PARSE_APPLICATION_ID=your_app_id
PARSE_JAVASCRIPT_KEY=your_js_key
PARSE_MASTER_KEY=your_master_key
PARSE_SERVER_URL=https://parseapi.back4app.com/
WEBHOOK_TOKEN=your_webhook_token
NODE_ENV=production
PORT=4000
```

## Deployment Options

### Option 1: Docker Build (Recommended)

Back4App will:
1. Build the Docker image using the Dockerfile
2. Run the container with environment variables
3. Expose the app on the provided port

### Option 2: Standard Node.js Build

If Docker is not available, Back4App can use:
- Build command: `npm install && npm run build:web`
- Start command: `npm start`

## Local Docker Testing

Test the Docker build locally:

```bash
# Build the image
docker build -t globalreach-app .

# Run the container
docker run -p 4000:4000 \
  -e PARSE_APPLICATION_ID=your_app_id \
  -e PARSE_JAVASCRIPT_KEY=your_js_key \
  -e PARSE_MASTER_KEY=your_master_key \
  -e PARSE_SERVER_URL=https://parseapi.back4app.com/ \
  -e WEBHOOK_TOKEN=your_token \
  -e NODE_ENV=production \
  globalreach-app
```

## Dockerfile Optimization

The Dockerfile uses:
- **Multi-stage build**: Not needed for this simple setup
- **Alpine Linux**: Smaller image size
- **Production dependencies only**: Faster installs
- **Layer caching**: Dependencies installed before code copy

## Troubleshooting

### Build Fails

1. Check Node.js version (18.x required)
2. Verify all dependencies in package.json
3. Check build logs in Back4App dashboard

### Container Won't Start

1. Verify PORT environment variable is set
2. Check server logs: `docker logs <container_id>`
3. Ensure all environment variables are set

### Port Issues

- Back4App sets PORT automatically
- Dockerfile exposes port 4000
- Server uses `process.env.PORT || 4000`

## File Structure

```
.
├── Dockerfile              # Docker build instructions
├── .dockerignore          # Files to exclude from Docker build
├── package.json           # Root dependencies
├── server/
│   ├── package.json       # Server dependencies
│   └── index.js           # Server entry point
└── build/                 # Built frontend (created during build)
```

## Back4App Configuration

In Back4App dashboard:
1. Go to **Server Settings** → **Deployment**
2. Select **Docker** as deployment method
3. Ensure Dockerfile is in root directory
4. Set environment variables
5. Deploy!

## Notes

- Dockerfile builds the frontend during image creation
- Production dependencies only (smaller image)
- Alpine Linux base (faster builds)
- Port 4000 exposed (Back4App will map to their port)










