#!/bin/bash
# Azure deployment script
# This runs during deployment (Oryx build), not at startup

echo "Running Azure deployment script..."

# Navigate to deployment directory
cd "$DEPLOYMENT_TARGET" 2>/dev/null || cd /home/site/wwwroot

# Detect Free Tier
IS_FREE_TIER="false"
if [ "$AZURE_FREE_TIER" = "true" ] || [ "$WEBSITE_SKU" = "Free" ]; then
    IS_FREE_TIER="true"
    echo "Azure F1 Free Tier detected - production-only dependencies"
fi

# Install production dependencies if node_modules doesn't exist or is incomplete
if [ ! -d "node_modules" ] || [ ! -f "node_modules/express/package.json" ]; then
    echo "Installing production dependencies..."
    if [ -f "package-lock.json" ]; then
        npm ci --omit=dev 2>&1 || npm install --omit=dev 2>&1
    else
        npm install --omit=dev 2>&1
    fi

    if [ $? -ne 0 ]; then
        echo "ERROR: Failed to install dependencies"
        exit 1
    fi
    echo "Dependencies installed successfully"
else
    echo "node_modules found, skipping dependency installation"
fi

# Build frontend if build directory doesn't exist (skip on Free Tier)
if [ "$IS_FREE_TIER" = "true" ]; then
    echo "Free Tier: Skipping frontend build (should be pre-built in CI)"
elif [ ! -d "build" ] || [ ! -f "build/index.html" ]; then
    echo "Build directory not found. Attempting frontend build..."
    # Only build if vite is available (it may have been pruned)
    if [ -f "node_modules/.bin/vite" ]; then
        npm run build 2>&1 || echo "Frontend build failed, continuing with server-only mode..."
    else
        echo "Vite not available (dev dependencies pruned). Skipping frontend build."
        echo "Frontend should be pre-built in the CI/CD pipeline."
    fi
fi

echo "Deployment script completed."
