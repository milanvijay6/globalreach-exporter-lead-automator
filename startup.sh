#!/bin/bash

# Azure Web App Startup Script
# This script is executed when the container starts

echo "Starting GlobalReach CRM Application..."

# Set Node environment
export NODE_ENV=production

# Set memory limit for Node.js (adjust based on your Azure tier)
# Free/Basic tier: 128-256, Standard: 512-1024
export NODE_OPTIONS="${NODE_OPTIONS:---max-old-space-size=256}"

# Display environment info
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Environment: $NODE_ENV"
echo "Port: ${PORT:-8080}"

# Navigate to app directory
cd /home/site/wwwroot || exit 1

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ] || [ ! -f "node_modules/express/package.json" ]; then
    echo "node_modules not found or incomplete. Installing dependencies..."
    if [ -f "package-lock.json" ]; then
        npm ci --production --legacy-peer-deps 2>&1 || npm install --production --legacy-peer-deps 2>&1
    else
        npm install --production --legacy-peer-deps 2>&1
    fi
    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies"
        exit 1
    fi
    echo "Dependencies installed successfully"
else
    echo "node_modules found, skipping dependency installation"
fi

# Check if MONGO_URI is set
if [ -z "$MONGO_URI" ]; then
    echo "WARNING: MONGO_URI is not set. Database features will not work."
    echo "Please set MONGO_URI in Azure Web App Configuration."
fi

# Start the application
echo "Starting Node.js server..."
exec node server/index.js
