#!/bin/bash

# Azure Web App Compatibility Test Script
# Run this before deploying to Azure to catch issues early

echo "╔══════════════════════════════════════════╗"
echo "║  Azure Web App Compatibility Test       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Check Node.js version
echo "Checking Node.js version..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 20 ]; then
    echo -e "${GREEN}✓${NC} Node.js $(node --version) (>= 20 required)"
else
    echo -e "${RED}✗${NC} Node.js version must be >= 20 (current: $(node --version))"
    ERRORS=$((ERRORS+1))
fi
echo ""

# Check dependencies
echo "Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠${NC} Root node_modules not found. Running npm ci..."
    npm ci
fi

if [ ! -d "server/node_modules" ]; then
    echo -e "${YELLOW}⚠${NC} Server node_modules not found. Running npm ci..."
    cd server && npm ci && cd ..
fi
echo -e "${GREEN}✓${NC} Dependencies installed"
echo ""

# Check for required files
echo "Checking Azure configuration files..."
REQUIRED_FILES=(
    "web.config"
    ".deployment"
    "startup.sh"
    "server/config/database.js"
    "server/config/applicationInsights.js"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file exists"
    else
        echo -e "${RED}✗${NC} $file missing"
        ERRORS=$((ERRORS+1))
    fi
done
echo ""

# Check MongoDB driver
echo "Checking MongoDB driver..."
if grep -q '"mongodb"' server/package.json; then
    echo -e "${GREEN}✓${NC} MongoDB driver found in server/package.json"
else
    echo -e "${RED}✗${NC} MongoDB driver not found in server/package.json"
    ERRORS=$((ERRORS+1))
fi
echo ""

# Check Application Insights
echo "Checking Application Insights..."
if grep -q '"applicationinsights"' server/package.json; then
    echo -e "${GREEN}✓${NC} Application Insights found in server/package.json"
else
    echo -e "${YELLOW}⚠${NC} Application Insights not found (optional but recommended)"
    WARNINGS=$((WARNINGS+1))
fi
echo ""

# Check if Parse SDK is removed from models
echo "Checking if models use MongoDB..."
if grep -q "Parse.Object.extend" server/models/Lead.js; then
    echo -e "${RED}✗${NC} Lead.js still uses Parse SDK"
    ERRORS=$((ERRORS+1))
else
    echo -e "${GREEN}✓${NC} Lead.js uses MongoDB"
fi

if grep -q "getDatabase" server/models/Lead.js; then
    echo -e "${GREEN}✓${NC} Models correctly import database module"
else
    echo -e "${RED}✗${NC} Models don't use database module"
    ERRORS=$((ERRORS+1))
fi
echo ""

# Check server/index.js
echo "Checking server configuration..."
if grep -q "connectDatabase" server/index.js; then
    echo -e "${GREEN}✓${NC} Server connects to MongoDB"
else
    echo -e "${RED}✗${NC} Server doesn't connect to MongoDB"
    ERRORS=$((ERRORS+1))
fi

if grep -q "initializeApplicationInsights" server/index.js; then
    echo -e "${GREEN}✓${NC} Server initializes Application Insights"
else
    echo -e "${YELLOW}⚠${NC} Application Insights not initialized"
    WARNINGS=$((WARNINGS+1))
fi
echo ""

# Test build
echo "Testing build process..."
echo "This may take a few minutes..."
if npm run build:azure > /tmp/build.log 2>&1; then
    echo -e "${GREEN}✓${NC} Build successful"
    
    # Check if build directory exists
    if [ -d "build" ]; then
        echo -e "${GREEN}✓${NC} Build directory created"
        
        # Check if index.html exists
        if [ -f "build/index.html" ]; then
            echo -e "${GREEN}✓${NC} index.html found in build"
        else
            echo -e "${RED}✗${NC} index.html not found in build"
            ERRORS=$((ERRORS+1))
        fi
    else
        echo -e "${RED}✗${NC} Build directory not created"
        ERRORS=$((ERRORS+1))
    fi
else
    echo -e "${RED}✗${NC} Build failed. Check /tmp/build.log for details"
    echo "Last 10 lines of build log:"
    tail -10 /tmp/build.log
    ERRORS=$((ERRORS+1))
fi
echo ""

# Check environment variables
echo "Checking environment variable template..."
if [ -f "azure-env-template.txt" ]; then
    echo -e "${GREEN}✓${NC} Environment variable template exists"
else
    echo -e "${YELLOW}⚠${NC} azure-env-template.txt not found"
    WARNINGS=$((WARNINGS+1))
fi
echo ""

# Check documentation
echo "Checking documentation..."
DOCS=(
    "AZURE_DEPLOYMENT_COMPLETE.md"
    "AZURE_QUICKSTART.md"
    "MIGRATION_GUIDE.md"
)

for doc in "${DOCS[@]}"; do
    if [ -f "$doc" ]; then
        echo -e "${GREEN}✓${NC} $doc exists"
    else
        echo -e "${YELLOW}⚠${NC} $doc not found"
        WARNINGS=$((WARNINGS+1))
    fi
done
echo ""

# Check GitHub Actions workflow
echo "Checking CI/CD configuration..."
if [ -f ".github/workflows/azure-webapps-deploy.yml" ]; then
    echo -e "${GREEN}✓${NC} GitHub Actions workflow exists"
else
    echo -e "${YELLOW}⚠${NC} GitHub Actions workflow not found (manual deployment only)"
    WARNINGS=$((WARNINGS+1))
fi
echo ""

# Check startup script permissions
echo "Checking startup script..."
if [ -f "startup.sh" ]; then
    if [ -x "startup.sh" ]; then
        echo -e "${GREEN}✓${NC} startup.sh is executable"
    else
        echo -e "${YELLOW}⚠${NC} startup.sh is not executable. Running chmod +x..."
        chmod +x startup.sh
    fi
else
    echo -e "${RED}✗${NC} startup.sh not found"
    ERRORS=$((ERRORS+1))
fi
echo ""

# Summary
echo "╔══════════════════════════════════════════╗"
echo "║              Test Summary                ║"
echo "╚══════════════════════════════════════════╝"
echo ""

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Your application is ready for Azure deployment!"
    echo ""
    echo "Next steps:"
    echo "1. Review AZURE_QUICKSTART.md for deployment"
    echo "2. Set up Azure resources"
    echo "3. Configure environment variables"
    echo "4. Deploy via GitHub Actions or Azure CLI"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ ${WARNINGS} warning(s) found${NC}"
    echo ""
    echo "Application can be deployed but some optional features may be missing."
    echo "Review warnings above and deploy when ready."
    exit 0
else
    echo -e "${RED}✗ ${ERRORS} error(s) found${NC}"
    if [ $WARNINGS -gt 0 ]; then
        echo -e "${YELLOW}⚠ ${WARNINGS} warning(s) found${NC}"
    fi
    echo ""
    echo "Please fix the errors above before deploying to Azure."
    exit 1
fi
