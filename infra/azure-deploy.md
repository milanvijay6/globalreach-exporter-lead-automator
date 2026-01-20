# Azure App Service Deployment Guide

This app runs as a Node/React monolith (Express + Vite build). Follow these steps to provision Azure resources, configure secrets, and deploy.

## 1) Provision Azure resources (CLI)
```bash
# Globals
RESOURCE_GROUP=gr-exporter-rg
LOCATION=eastus
PLAN=gr-exporter-plan
WEBAPP=gr-exporter-app
COSMOS=gr-exporter-cosmos
COSMOS_DB=appdb
STORAGE=grexporterstorage

az group create -n $RESOURCE_GROUP -l $LOCATION

# App Service plan (Linux)
az appservice plan create -n $PLAN -g $RESOURCE_GROUP --sku P1v3 --is-linux

# Web App (Node 20)
az webapp create -n $WEBAPP -g $RESOURCE_GROUP -p $PLAN \
  --runtime "NODE|20-lts" \
  --https-only true

# Cosmos DB (Mongo API)
az cosmosdb create -n $COSMOS -g $RESOURCE_GROUP --kind MongoDB
az cosmosdb mongodb database create -a $COSMOS -g $RESOURCE_GROUP -n $COSMOS_DB
# (Optional) collections created by app on first run; add indexes via scripts if needed.

# Retrieve Mongo connection string (primary)
COSMOS_CONN=$(az cosmosdb keys list -n $COSMOS -g $RESOURCE_GROUP --type connection-strings --query "connectionStrings[0].connectionString" -o tsv)

# Storage account (for logs/assets/backups)
az storage account create -n $STORAGE -g $RESOURCE_GROUP -l $LOCATION --sku Standard_LRS --kind StorageV2
```

### Optional (Redis-compatible cache for queues/AI cache)
```bash
REDIS=gr-exporter-redis
az redis create -n $REDIS -g $RESOURCE_GROUP -l $LOCATION --sku Basic --vm-size C1
REDIS_CONN=$(az redis list-keys -n $REDIS -g $RESOURCE_GROUP --query primaryKey -o tsv)
```

## 2) Configure App Service settings
Set environment variables (values quoted where needed):
```bash
az webapp config appsettings set -g $RESOURCE_GROUP -n $WEBAPP --settings \
  NODE_ENV=production \
  PORT=8080 \
  WEBSITES_PORT=8080 \
  MONGO_URI="$COSMOS_CONN&retrywrites=false" \
  REDIS_URL="rediss://:<REDIS_KEY>@<REDIS_HOST>:6380" \
  GEMINI_API_KEY="<your_gemini_key>" \
  PARSE_APPLICATION_ID="<parse_app_id>" \
  PARSE_JAVASCRIPT_KEY="<parse_js_key>" \
  PARSE_SERVER_URL="<parse_server_url>" \
  ENABLE_WEBSOCKET=true \
  ENABLE_SCHEDULED_JOBS=false \
  ENABLE_AI_WORKERS=true \
  ENABLE_AUTO_WORKER_DEPLOY=false
```
Notes:
- `PORT`/`WEBSITES_PORT` must match; Express already binds `0.0.0.0`.
- Disable scheduled jobs if you prefer them outside App Service.
- For MessagePack/gzip nothing extra is required; compression is built-in.

## 3) Build and deploy (zip deploy)
```bash
npm ci
npm run build:react   # produces /build
zip -r app.zip server build package.json package-lock.json \
  .env.example scripts

az webapp deploy --resource-group $RESOURCE_GROUP --name $WEBAPP \
  --src-path app.zip --type zip
```

## 4) GitHub Actions (CI/CD)
Create `.github/workflows/azure-appservice.yml` (sample in repo). Key points:
- Install Node 20, `npm ci`, `npm run build:react`.
- Publish `build/` plus `server/` via `azure/webapps-deploy` with a publish profile.
- Cache `~/.npm` for faster builds.

## 5) Validate after deploy
- Health: `https://<app>.azurewebsites.net/health`
- API smoke: `https://<app>.azurewebsites.net/api/trpc/health.check?batch=1`
- WebSocket: ensure `ENABLE_WEBSOCKET=true`; test client connect to same host over wss.
- Static assets: confirm `build` files served; check console for 200s.

## 6) Performance tuning on App Service
- Plan size: start P1v3; scale out with autoscale on CPU/RPS.
- Always On: enable to keep Node warm.
- HTTP/2: enabled by default; keep MessagePack endpoints.
- Logging: enable App Service logs; ship to Storage or Log Analytics.
- ARR affinity: keep off unless you need session stickiness; WebSockets work without it.

## 7) Rollback
- Keep previous zip in storage; redeploy with `az webapp deploy --src-path prev.zip`.

