# Back4App Docker Setup

## Dockerfile Created ✅

A Dockerfile has been created in the root directory for Back4App deployment.

## Dockerfile Features

- **Base Image**: Node.js 18 Alpine (lightweight)
- **Multi-stage optimization**: Installs all deps for build, then prunes dev deps
- **Build Process**: 
  1. Install dependencies
  2. Build React frontend
  3. Remove dev dependencies
  4. Start server

## Deployment Options

Back4App supports two deployment methods:

### Option 1: Docker Deployment (Recommended)

If Dockerfile is present, Back4App will:
1. Build Docker image using Dockerfile
2. Run container with environment variables
3. Expose app on configured port

**Configuration in back4app.json:**
```json
{
  "dockerfile": "Dockerfile"
}
```

### Option 2: Standard Node.js Build

If Docker is not preferred, Back4App will:
1. Run build command: `npm install && npm run build:web`
2. Run start command: `npm start`

**Configuration in back4app.json:**
```json
{
  "buildCommand": "npm install && npm run build:web",
  "startCommand": "npm start"
}
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
  -e PORT=4000 \
  globalreach-app
```

## Dockerfile Structure

```dockerfile
FROM node:18-alpine          # Base image
WORKDIR /app                 # Working directory
COPY package*.json ./        # Copy package files
RUN npm ci                   # Install dependencies
COPY . .                     # Copy source files
RUN npm run build:web        # Build frontend
RUN npm prune --production   # Remove dev deps
EXPOSE 4000                  # Expose port
CMD ["node", "server/index.js"]  # Start command
```

## .dockerignore

The `.dockerignore` file excludes:
- node_modules (will be installed in container)
- build/dist (will be built in container)
- Development files
- Git files
- Documentation (except README.md)

## Verification

To verify Dockerfile is correct:

```bash
# Build test
docker build -t test-build .

# Check image size
docker images test-build

# Test run
docker run --rm -p 4000:4000 test-build
```

## Troubleshooting

### Build Fails
- Check Node.js version (18.x)
- Verify all dependencies in package.json
- Check build logs

### Container Won't Start
- Verify PORT environment variable
- Check server logs
- Ensure all Parse env vars are set

### Large Image Size
- Dockerfile already prunes dev dependencies
- Using Alpine Linux (smaller base)
- Consider multi-stage build if needed

## Next Steps

1. Push code to Git repository
2. Connect repository to Back4App
3. Set environment variables
4. Deploy (Back4App will detect Dockerfile automatically)




