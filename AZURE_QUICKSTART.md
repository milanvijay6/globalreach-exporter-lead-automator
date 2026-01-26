# Quick Start Guide - Azure Web App Deployment

This is a streamlined guide to get your GlobalReach CRM running on Azure quickly.

## Prerequisites

- Azure account with active subscription
- Azure CLI installed
- Git repository

## 5-Minute Setup

### 1. Login to Azure
```bash
az login
```

### 2. Run Automated Setup Script

Create and run `azure-quickstart.sh`:

```bash
#!/bin/bash

# Configuration
RESOURCE_GROUP="globalreach-crm-rg"
LOCATION="eastus"
APP_NAME="globalreach-crm-$(date +%s)"  # Unique name with timestamp

echo "Creating Azure resources for: $APP_NAME"
echo "This will take about 5-10 minutes..."

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create Cosmos DB
echo "Creating Cosmos DB..."
az cosmosdb create \
  --name "${APP_NAME}-cosmos" \
  --resource-group $RESOURCE_GROUP \
  --kind MongoDB \
  --server-version 4.2 \
  --default-consistency-level "Session" \
  --locations regionName=$LOCATION

# Create database
az cosmosdb mongodb database create \
  --account-name "${APP_NAME}-cosmos" \
  --resource-group $RESOURCE_GROUP \
  --name "globalreach"

# Get connection string
MONGO_URI=$(az cosmosdb keys list \
  --name "${APP_NAME}-cosmos" \
  --resource-group $RESOURCE_GROUP \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv)

# Create App Service Plan
echo "Creating App Service Plan..."
az appservice plan create \
  --name "${APP_NAME}-plan" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --is-linux \
  --sku P1v3

# Create Web App
echo "Creating Web App..."
az webapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan "${APP_NAME}-plan" \
  --runtime "NODE:20-lts"

# Configure Web App
az webapp config set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --always-on true \
  --http20-enabled true \
  --web-sockets-enabled true

# Set environment variables
echo "Configuring environment variables..."
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV="production" \
    PORT="8080" \
    WEBSITES_PORT="8080" \
    MONGO_URI="$MONGO_URI" \
    MONGO_DB_NAME="globalreach" \
    ENABLE_WEBSOCKET="true" \
    ENABLE_SCHEDULED_JOBS="true" \
    LOG_LEVEL="info"

# Get publish profile
echo "Getting deployment credentials..."
az webapp deployment list-publishing-profiles \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --xml > publish-profile.xml

echo ""
echo "======================================"
echo "✅ Azure Setup Complete!"
echo "======================================"
echo ""
echo "App Name: $APP_NAME"
echo "URL: https://${APP_NAME}.azurewebsites.net"
echo "Resource Group: $RESOURCE_GROUP"
echo ""
echo "Next steps:"
echo "1. Add publish-profile.xml to GitHub Secrets as AZURE_WEBAPP_PUBLISH_PROFILE"
echo "2. Add $APP_NAME to GitHub Secrets as AZURE_WEBAPP_NAME"
echo "3. Push to GitHub to trigger deployment"
echo ""
echo "Or deploy manually:"
echo "  npm ci"
echo "  npm run build:azure"
echo "  az webapp deploy --resource-group $RESOURCE_GROUP --name $APP_NAME --src-path . --type zip"
echo ""
```

Make executable and run:
```bash
chmod +x azure-quickstart.sh
./azure-quickstart.sh
```

### 3. Deploy Your Code

**Option A: GitHub Actions (Recommended)**

1. Add secrets to GitHub:
   - `AZURE_WEBAPP_NAME`: Your app name from script output
   - `AZURE_WEBAPP_PUBLISH_PROFILE`: Content of `publish-profile.xml`

2. Push to main branch - automatic deployment!

**Option B: Manual Deploy**

```bash
# Build
npm ci
cd server && npm ci && cd ..
npm run build:azure

# Deploy
az webapp deploy \
  --resource-group globalreach-crm-rg \
  --name <your-app-name> \
  --src-path . \
  --type zip
```

### 4. Verify Deployment

```bash
# Check health
curl https://<your-app-name>.azurewebsites.net/health

# View logs
az webapp log tail --name <your-app-name> --resource-group globalreach-crm-rg
```

## Environment Variables to Add Later

After initial deployment, add these via Azure Portal or CLI as needed:

```bash
# For Gemini AI
GEMINI_API_KEY="your-key"

# For WhatsApp
WHATSAPP_API_TOKEN="your-token"
WHATSAPP_PHONE_NUMBER_ID="your-id"

# For Google OAuth
GMAIL_CLIENT_ID="your-id"
GMAIL_CLIENT_SECRET="your-secret"
```

## Common Issues

### Build fails with out of memory
**Solution:**
```bash
# Increase Node memory
export NODE_OPTIONS=--max-old-space-size=4096
npm run build:azure
```

### Cannot connect to database
**Solution:**
```bash
# Verify Cosmos DB connection string
az webapp config appsettings list \
  --name <app-name> \
  --resource-group globalreach-crm-rg \
  --query "[?name=='MONGO_URI'].value" -o tsv
```

### App shows "Service Unavailable"
**Solution:**
```bash
# Check logs
az webapp log tail --name <app-name> --resource-group globalreach-crm-rg

# Restart app
az webapp restart --name <app-name> --resource-group globalreach-crm-rg
```

## Cost Estimate

With the quick setup (P1v3 + Cosmos DB 400 RU/s):
- **~$133/month** total

To reduce costs for development:
```bash
# Use B1 tier instead
az appservice plan update \
  --name <plan-name> \
  --resource-group globalreach-crm-rg \
  --sku B1

# Cost: ~$37/month
```

## Next Steps

1. **Add Application Insights** for monitoring
2. **Configure custom domain** and SSL
3. **Set up auto-scaling** rules
4. **Enable backups**
5. **Configure CDN** for better performance

See [AZURE_DEPLOYMENT_COMPLETE.md](./AZURE_DEPLOYMENT_COMPLETE.md) for full production setup.

## Cleanup (Delete Everything)

```bash
az group delete --name globalreach-crm-rg --yes --no-wait
```

## Support

- Health check: `https://<app-name>.azurewebsites.net/health`
- Logs: Azure Portal → Web App → Log stream
- Metrics: Azure Portal → Application Insights

---

**You're live!** 🚀
