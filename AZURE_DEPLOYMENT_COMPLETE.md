# Azure Web App Deployment Guide for GlobalReach CRM

## Overview
This guide provides complete instructions for deploying the GlobalReach CRM application to Azure Web App with full production setup including Application Insights, CDN, and auto-scaling.

## Architecture

```
┌─────────────────┐
│  Azure CDN      │
│  (Static Assets)│
└────────┬────────┘
         │
┌────────▼────────────────────┐
│  Azure Application Gateway  │
│  (Load Balancer + WAF)      │
└────────┬────────────────────┘
         │
┌────────▼────────────────────┐
│  Azure Web App              │
│  (Node.js + React)          │
│  - Auto-scaling enabled     │
│  - Application Insights     │
└────────┬────────────────────┘
         │
┌────────▼────────────────────┐
│  Azure Cosmos DB            │
│  (MongoDB API)              │
│  - Global distribution      │
│  - Auto-failover            │
└─────────────────────────────┘
```

## Prerequisites

1. **Azure Account** with active subscription
2. **Azure CLI** installed (recommended) - [Download](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
3. **Git** repository for CI/CD deployment
4. **Node.js 20+** for local testing

## Step 1: Provision Azure Resources

### 1.1 Login to Azure
```bash
az login
az account set --subscription "<your-subscription-id>"
```

### 1.2 Create Resource Group
```bash
# Set variables
RESOURCE_GROUP="globalreach-crm-rg"
LOCATION="eastus"
APP_NAME="globalreach-crm"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION
```

### 1.3 Create Azure Cosmos DB (MongoDB API)
```bash
# Create Cosmos DB account
az cosmosdb create \
  --name "${APP_NAME}-cosmos" \
  --resource-group $RESOURCE_GROUP \
  --kind MongoDB \
  --server-version 4.2 \
  --default-consistency-level "Session" \
  --locations regionName=$LOCATION failoverPriority=0 isZoneRedundant=False \
  --enable-automatic-failover true

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

echo "MONGO_URI: $MONGO_URI"
```

### 1.4 Create App Service Plan (with auto-scaling)
```bash
# Create Premium tier plan for auto-scaling
az appservice plan create \
  --name "${APP_NAME}-plan" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --is-linux \
  --sku P1v3

# Configure auto-scaling rules
az monitor autoscale create \
  --resource-group $RESOURCE_GROUP \
  --resource "${APP_NAME}-plan" \
  --resource-type "Microsoft.Web/serverfarms" \
  --name "${APP_NAME}-autoscale" \
  --min-count 1 \
  --max-count 5 \
  --count 1

# Scale out when CPU > 70%
az monitor autoscale rule create \
  --resource-group $RESOURCE_GROUP \
  --autoscale-name "${APP_NAME}-autoscale" \
  --condition "Percentage CPU > 70 avg 5m" \
  --scale out 1

# Scale in when CPU < 30%
az monitor autoscale rule create \
  --resource-group $RESOURCE_GROUP \
  --autoscale-name "${APP_NAME}-autoscale" \
  --condition "Percentage CPU < 30 avg 5m" \
  --scale in 1
```

### 1.5 Create Web App
```bash
az webapp create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --plan "${APP_NAME}-plan" \
  --runtime "NODE:20-lts" \
  --https-only true

# Enable Always On to prevent cold starts
az webapp config set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --always-on true \
  --http20-enabled true \
  --web-sockets-enabled true
```

### 1.6 Create Application Insights
```bash
# Create Application Insights instance
az monitor app-insights component create \
  --app "${APP_NAME}-insights" \
  --location $LOCATION \
  --resource-group $RESOURCE_GROUP \
  --application-type "Node.JS"

# Get connection string
APPINSIGHTS_CONNECTION_STRING=$(az monitor app-insights component show \
  --app "${APP_NAME}-insights" \
  --resource-group $RESOURCE_GROUP \
  --query "connectionString" \
  --output tsv)

echo "Application Insights Connection String: $APPINSIGHTS_CONNECTION_STRING"
```

### 1.7 Create Azure CDN (Optional but recommended)
```bash
# Create CDN profile
az cdn profile create \
  --name "${APP_NAME}-cdn" \
  --resource-group $RESOURCE_GROUP \
  --sku Standard_Microsoft

# Create CDN endpoint
az cdn endpoint create \
  --name "${APP_NAME}-endpoint" \
  --profile-name "${APP_NAME}-cdn" \
  --resource-group $RESOURCE_GROUP \
  --origin "${APP_NAME}.azurewebsites.net" \
  --origin-host-header "${APP_NAME}.azurewebsites.net" \
  --enable-compression true

echo "CDN Endpoint: https://${APP_NAME}-endpoint.azureedge.net"
```

## Step 2: Configure Environment Variables

```bash
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    NODE_ENV="production" \
    PORT="8080" \
    WEBSITES_PORT="8080" \
    MONGO_URI="$MONGO_URI" \
    MONGO_DB_NAME="globalreach" \
    APPLICATIONINSIGHTS_CONNECTION_STRING="$APPINSIGHTS_CONNECTION_STRING" \
    ENABLE_WEBSOCKET="true" \
    ENABLE_SCHEDULED_JOBS="true" \
    ENABLE_AI_WORKERS="true" \
    LOG_LEVEL="info"
```

### Additional Environment Variables (Add as needed)

```bash
# For email services (Gmail OAuth)
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    GMAIL_CLIENT_ID="your-gmail-client-id" \
    GMAIL_CLIENT_SECRET="your-gmail-client-secret"

# For AI features (Gemini)
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    GEMINI_API_KEY="your-gemini-api-key"

# For WhatsApp Business API
az webapp config appsettings set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --settings \
    WHATSAPP_API_TOKEN="your-whatsapp-token" \
    WHATSAPP_PHONE_NUMBER_ID="your-phone-number-id"
```

## Step 3: Deploy Application

### Option A: GitHub Actions (Recommended for CI/CD)

1. **Get Publish Profile**
```bash
az webapp deployment list-publishing-profiles \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --xml > publish-profile.xml
```

2. **Add to GitHub Secrets**
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Create new secret: `AZURE_WEBAPP_PUBLISH_PROFILE`
   - Paste content of `publish-profile.xml`

3. **Create GitHub Action** (`.github/workflows/azure-deploy.yml`):
```yaml
name: Deploy to Azure Web App

on:
  push:
    branches: [ main ]
  workflow_dispatch:

env:
  NODE_VERSION: '20.x'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3

    - name: Set up Node.js
      uses: actions/setup-node@v3
      with:
        node-version: ${{ env.NODE_VERSION }}
        cache: 'npm'

    - name: Install root dependencies
      run: npm ci

    - name: Install server dependencies
      run: cd server && npm ci

    - name: Build React application
      run: npm run build:azure
      env:
        NODE_OPTIONS: --max-old-space-size=4096

    - name: Deploy to Azure Web App
      uses: azure/webapps-deploy@v2
      with:
        app-name: ${{ secrets.AZURE_WEBAPP_NAME }}
        publish-profile: ${{ secrets.AZURE_WEBAPP_PUBLISH_PROFILE }}
        package: .
```

### Option B: ZIP Deploy (Manual)

```bash
# Build the application locally
npm ci
cd server && npm ci && cd ..
npm run build:azure

# Create deployment package
zip -r deploy.zip \
  server/ \
  build/ \
  package.json \
  package-lock.json \
  web.config \
  startup.sh

# Deploy to Azure
az webapp deploy \
  --resource-group $RESOURCE_GROUP \
  --name $APP_NAME \
  --src-path deploy.zip \
  --type zip
```

### Option C: Git Deployment

```bash
# Configure local Git deployment
az webapp deployment source config-local-git \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

# Get Git URL
GIT_URL=$(az webapp deployment source show \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "repoUrl" \
  --output tsv)

# Add Azure remote and push
git remote add azure $GIT_URL
git push azure main
```

## Step 4: Configure Custom Domain (Optional)

```bash
# Add custom domain
az webapp config hostname add \
  --webapp-name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname "www.yourdomain.com"

# Enable SSL
az webapp config ssl bind \
  --certificate-thumbprint <thumbprint> \
  --ssl-type SNI \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

# Or use App Service Managed Certificate (Free)
az webapp config ssl create \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --hostname "www.yourdomain.com"
```

## Step 5: Verify Deployment

### 5.1 Health Check
```bash
curl https://${APP_NAME}.azurewebsites.net/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "uptime": 120.5,
  "database": { "status": "ok", "connected": true },
  "version": "1.0.0"
}
```

### 5.2 Check Application Logs
```bash
# Enable logging
az webapp log config \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --application-logging filesystem \
  --level information

# Stream logs
az webapp log tail \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP
```

### 5.3 Access Application Insights
- Go to Azure Portal → Application Insights → `${APP_NAME}-insights`
- View metrics, logs, and performance data
- Set up alerts for errors and performance issues

## Step 6: Post-Deployment Configuration

### 6.1 Update OAuth Redirect URIs

For Google OAuth, Azure AD, etc., update redirect URIs:
```
https://${APP_NAME}.azurewebsites.net/api/oauth/callback
```

### 6.2 Configure Backup (Recommended)
```bash
# Create storage account for backups
az storage account create \
  --name "${APP_NAME}backup" \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS

# Configure automatic backup
az webapp config backup create \
  --resource-group $RESOURCE_GROUP \
  --webapp-name $APP_NAME \
  --backup-name "daily-backup" \
  --container-url "<storage-container-url>"
```

### 6.3 Enable Diagnostic Logging
```bash
az monitor diagnostic-settings create \
  --name "${APP_NAME}-diagnostics" \
  --resource "/subscriptions/<subscription-id>/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Web/sites/${APP_NAME}" \
  --logs '[{"category": "AppServiceHTTPLogs", "enabled": true}, {"category": "AppServiceConsoleLogs", "enabled": true}]' \
  --workspace "<log-analytics-workspace-id>"
```

## Step 7: Performance Optimization

### 7.1 Enable CDN for Static Assets
If you created CDN in Step 1.7, configure your app to use CDN URLs for static assets.

### 7.2 Configure Caching
The application already includes:
- Brotli compression
- ETag support
- Response caching
- HTTP/2 support

### 7.3 Database Optimization
- Indexes are automatically created on startup
- Cosmos DB auto-scales based on RU/s
- Consider enabling geo-replication for multi-region support

## Troubleshooting

### Issue: Application won't start
**Solution:**
```bash
# Check logs
az webapp log tail --name $APP_NAME --resource-group $RESOURCE_GROUP

# Verify environment variables
az webapp config appsettings list --name $APP_NAME --resource-group $RESOURCE_GROUP

# Restart the app
az webapp restart --name $APP_NAME --resource-group $RESOURCE_GROUP
```

### Issue: Database connection fails
**Solution:**
```bash
# Verify Cosmos DB is running
az cosmosdb show --name "${APP_NAME}-cosmos" --resource-group $RESOURCE_GROUP

# Check connection string
az cosmosdb keys list \
  --name "${APP_NAME}-cosmos" \
  --resource-group $RESOURCE_GROUP \
  --type connection-strings

# Update MONGO_URI in app settings
```

### Issue: High memory usage
**Solution:**
```bash
# Scale up the App Service Plan
az appservice plan update \
  --name "${APP_NAME}-plan" \
  --resource-group $RESOURCE_GROUP \
  --sku P2v3

# Or scale out (add more instances)
az webapp scale \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --instance-count 3
```

## Cost Optimization

### Development/Testing
- App Service Plan: B1 ($~13/month)
- Cosmos DB: 400 RU/s ($~24/month)
- **Total: ~$37/month**

### Production (Current Setup)
- App Service Plan: P1v3 ($~109/month)
- Cosmos DB: 1000 RU/s ($~60/month)
- Application Insights: Pay-as-you-go (~$10/month)
- CDN: Pay-as-you-go (~$5/month)
- **Total: ~$184/month**

### Enterprise
- App Service Plan: P3v3 with auto-scaling
- Cosmos DB: Multi-region with auto-scale
- Application Gateway with WAF
- **Total: $500-1000+/month**

## Monitoring and Alerts

### Set up Critical Alerts
```bash
# High CPU alert
az monitor metrics alert create \
  --name "${APP_NAME}-high-cpu" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/<subscription-id>/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Web/sites/${APP_NAME}" \
  --condition "avg Percentage CPU > 80" \
  --description "CPU usage is above 80%" \
  --evaluation-frequency 5m \
  --window-size 15m

# High memory alert
az monitor metrics alert create \
  --name "${APP_NAME}-high-memory" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/<subscription-id>/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Web/sites/${APP_NAME}" \
  --condition "avg MemoryWorkingSet > 1.5G" \
  --description "Memory usage is above 1.5GB"

# Database throttling alert
az monitor metrics alert create \
  --name "${APP_NAME}-db-throttle" \
  --resource-group $RESOURCE_GROUP \
  --scopes "/subscriptions/<subscription-id>/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.DocumentDB/databaseAccounts/${APP_NAME}-cosmos" \
  --condition "total TotalRequestUnits > 1000"
```

## Security Best Practices

1. **Enable Managed Identity** for secure Azure service connections
2. **Use Azure Key Vault** for secrets management
3. **Enable DDoS Protection** on Application Gateway
4. **Configure WAF** (Web Application Firewall)
5. **Regular security updates** via automated deployments
6. **Enable Azure Security Center** recommendations

## Maintenance

### Regular Tasks
- Monitor Application Insights dashboard weekly
- Review and optimize Cosmos DB RU/s usage monthly
- Update dependencies and Node.js version quarterly
- Test backup restoration annually
- Review and update auto-scaling rules as needed

## Support

For issues:
1. Check Application Insights for errors
2. Review Azure Web App logs
3. Verify all environment variables are set
4. Ensure Cosmos DB has sufficient RU/s provisioned

## Additional Resources

- [Azure Web App Documentation](https://docs.microsoft.com/en-us/azure/app-service/)
- [Cosmos DB Best Practices](https://docs.microsoft.com/en-us/azure/cosmos-db/best-practices)
- [Application Insights Documentation](https://docs.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)
- [Azure CDN Documentation](https://docs.microsoft.com/en-us/azure/cdn/)

---

**Deployment Checklist:**
- [ ] Azure resources provisioned
- [ ] Cosmos DB connection string configured
- [ ] Application Insights connection string set
- [ ] All environment variables configured
- [ ] Application deployed and running
- [ ] Health check endpoint returning 200
- [ ] OAuth redirect URIs updated
- [ ] Custom domain configured (if applicable)
- [ ] SSL certificate installed
- [ ] Auto-scaling configured
- [ ] Monitoring alerts set up
- [ ] Backup configured
- [ ] CDN configured (if applicable)

**Success!** Your GlobalReach CRM is now running on Azure with full production capabilities.
