#!/bin/bash
# Azure deployment script
# This runs during deployment, not at startup

# Install production dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ] || [ ! -f "node_modules/express/package.json" ]; then
    echo "Installing production dependencies..."
    npm ci --production --ignore-scripts --ignore-engines || npm install --production --ignore-scripts --ignore-engines
fi

# Build frontend if build directory doesn't exist
if [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    echo "Building frontend..."
    npm run build || echo "Build failed, continuing..."
fi
