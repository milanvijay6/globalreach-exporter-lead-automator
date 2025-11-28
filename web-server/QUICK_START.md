# Quick Start Guide

## Step 1: Build the React App

From the main project directory:

```bash
cd ../globalreach---exporter-lead-automator
npm run build:react
```

## Step 2: Copy Built Files

From the web-server directory:

```bash
cd web-server
npm install
npm run copy-build
```

Or manually copy:
```bash
# Windows PowerShell
Copy-Item -Path "..\electron\build\*" -Destination "public\" -Recurse

# Linux/Mac
cp -r ../electron/build/* public/
```

## Step 3: Start the Server

```bash
npm start
```

The server will run on `http://localhost:3000`

## Step 4: Deploy to Hosting

See `DEPLOYMENT.md` for detailed deployment instructions to:
- Heroku
- Railway
- Render
- DigitalOcean
- Vercel
- AWS EC2
- Docker

## Environment Variables

Create a `.env` file (optional):

```env
PORT=3000
NODE_ENV=production
ALLOWED_ORIGINS=https://yourdomain.com
```

