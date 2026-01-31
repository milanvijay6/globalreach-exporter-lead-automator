#!/bin/bash

# Azure Web App Startup Script
# This script is executed when the container starts

echo "Starting GlobalReach CRM Application..."

# Set Node environment
export NODE_ENV=production

# Set memory limit for Node.js (optimized for free tier)
export NODE_OPTIONS="--max-old-space-size=128"

# Display environment info
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Environment: $NODE_ENV"
echo "Port: $PORT"

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ] || [ ! -f "node_modules/express/package.json" ]; then
    echo "node_modules not found or incomplete. Installing dependencies..."
    npm ci --production --ignore-scripts || npm install --production --ignore-scripts
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
node server/index.js
