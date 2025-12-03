# Use Node.js 20 LTS as base image (required for some dependencies)
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (for better layer caching)
COPY package*.json ./
COPY server/package*.json ./server/

# Install ALL dependencies (needed for build)
RUN npm ci

# Install Wrangler CLI globally for Cloudflare Worker deployment (optional)
# Only installs if CLOUDFLARE_API_TOKEN is set during build
RUN npm install -g wrangler@latest || echo "Wrangler installation skipped (optional)"

# Install server dependencies
WORKDIR /app/server
RUN npm ci

# Return to root directory
WORKDIR /app

# Copy all source files
COPY . .

# Build the React frontend (set NODE_OPTIONS for build)
ENV NODE_OPTIONS=--max-old-space-size=4096
ENV BUILD_OUT_DIR=build
RUN npx vite build

# Verify build output exists
RUN test -f build/index.html || (echo "ERROR: index.html not found after build" && exit 1)
RUN ls -la build/ || echo "Build directory check failed"

# Remove dev dependencies to reduce image size
RUN npm prune --omit=dev
WORKDIR /app/server
RUN npm prune --omit=dev
WORKDIR /app

# Expose port (Back4App will set PORT env var)
EXPOSE 4000

# Set environment to production
ENV NODE_ENV=production

# Start the server
CMD ["node", "server/index.js"]

