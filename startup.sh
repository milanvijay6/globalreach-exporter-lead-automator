#!/bin/bash

# Azure Web App Startup Script
# This script is executed when the container starts

echo "Starting GlobalReach CRM Application..."

# Set Node environment
export NODE_ENV=production

# Set memory limit for Node.js
export NODE_OPTIONS="--max-old-space-size=2048"

# Display environment info
echo "Node version: $(node --version)"
echo "NPM version: $(npm --version)"
echo "Environment: $NODE_ENV"
echo "Port: $PORT"

# Check if MONGO_URI is set
if [ -z "$MONGO_URI" ]; then
    echo "WARNING: MONGO_URI is not set. Database features will not work."
    echo "Please set MONGO_URI in Azure Web App Configuration."
fi

# Start the application
echo "Starting Node.js server..."
node server/index.js
