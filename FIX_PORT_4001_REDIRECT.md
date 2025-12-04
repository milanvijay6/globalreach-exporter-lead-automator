# Fix OAuth Redirect - Port 4001 Issue

## Problem
Your server is running on port **4001** instead of 4000, but Azure redirect URI is set to port 4000.

## Solution: Update Azure Portal

### Step 1: Check Your Server Port

1. Open your Electron app
2. Go to **Settings** → **System**
3. Check the **Server Port** - it should show **4001** (or whatever port it's using)

### Step 2: Update Azure Portal Redirect URI

1. Go to: https://portal.azure.com
2. Navigate to: **App registrations** → Your app (649aa87d-4799-466b-ae15-078049518573)
3. Click: **"Authentication"**
4. Under **"Platform configurations"** → **"Web"** section:

#### Option A: Add Port 4001 (Recommended - Supports both ports)
- Add this redirect URI:
  ```
  http://localhost:4001/api/oauth/callback
  ```
- Keep the existing one for port 4000:
  ```
  http://localhost:4000/api/oauth/callback
  ```

#### Option B: Replace Port 4000 with 4001
- Remove: `http://localhost:4000/api/oauth/callback`
- Add: `http://localhost:4001/api/oauth/callback`

5. Click **"Save"**
6. Wait 3-5 minutes for Azure to propagate

### Step 3: Verify Configuration

After saving, verify:
- ✅ **"Web"** platform contains: `http://localhost:4001/api/oauth/callback`
- ✅ **"Single-page application"** is EMPTY
- ✅ Port number matches your server port

### Step 4: Try Again

1. Close your Electron app completely
2. Restart the app
3. Try connecting Outlook again

---

## Alternative: Free Port 4000

If you want to use port 4000 instead:

### Windows:
1. Open PowerShell as Administrator
2. Find what's using port 4000:
   ```powershell
   netstat -ano | findstr :4000
   ```
3. Kill the process (replace PID with the process ID):
   ```powershell
   taskkill /PID <PID> /F
   ```
4. Restart your Electron app

### Or Use Task Manager:
1. Press `Ctrl + Shift + Esc`
2. Go to **Details** tab
3. Look for processes using port 4000
4. End those processes
5. Restart your app

---

## Quick Fix Checklist

- [ ] Checked server port in Settings → System
- [ ] Added redirect URI for the correct port in Azure Portal
- [ ] Removed redirect URI from "Single-page application"
- [ ] Saved changes in Azure
- [ ] Waited 3-5 minutes
- [ ] Restarted Electron app
- [ ] Tried Outlook connection again

---

## Current Configuration

Based on your error, your server is running on:
- **Port:** 4001
- **Redirect URI:** `http://localhost:4001/api/oauth/callback`

Make sure this exact URI is configured in Azure Portal under **"Web"** platform.













