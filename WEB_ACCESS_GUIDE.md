# Web Access Guide

## How to Access the App via Web Browser

The app runs an Express server that can be accessed via web browser. Here's how:

### Prerequisites:

1. **Build the React App** (if not already built):
   ```bash
   npm run build:react
   ```
   This creates the production build in `electron/build/`

2. **Start the Electron App**:
   ```bash
   npm start
   ```
   This will:
   - Start the Express server
   - Open the Electron window
   - Make the app accessible via web browser

### Accessing via Web Browser:

Once the app is running, you can access it at:

- **Primary URL**: `http://localhost:4000`
- **Alternative**: `http://127.0.0.1:4000`

The server will automatically try to find an available port starting from 4000. If port 4000 is in use, it will try 4001, 4002, etc.

### Finding the Correct Port:

1. **Check the Console**: When you start the app, look for log messages like:
   ```
   Backend server running on:
     - http://localhost:4000
     - http://192.168.x.x:4000
   ```

2. **Check Settings**: 
   - Open the app
   - Go to Settings → Network tab
   - Check the "System Status" section
   - It will show the accessible URLs

### Network Access:

The server binds to `0.0.0.0` by default, which means it's accessible from:
- **Localhost**: `http://localhost:4000`
- **Local Network**: `http://YOUR_IP_ADDRESS:4000` (accessible from other devices on your network)

### Troubleshooting:

#### Issue: "Cannot access app on web"

**Solution 1: Check if server is running**
- Make sure you've started the app with `npm start`
- Check the console for server startup messages

**Solution 2: Check if build exists**
- Run `npm run build:react` to create the production build
- The build should be in `electron/build/` directory

**Solution 3: Check firewall**
- Windows Firewall might be blocking the port
- The app tries to configure firewall automatically, but you may need admin rights
- Manually allow port 4000 (or the port shown in logs) in Windows Firewall

**Solution 4: Check port availability**
- Another application might be using port 4000
- The app will automatically try the next available port
- Check the console logs to see which port is actually being used

**Solution 5: Check browser console**
- Open browser DevTools (F12)
- Check for any errors in the console
- Check the Network tab to see if requests are being made

#### Issue: "Page not found" or "404 error"

**Solution**: Make sure the build exists:
```bash
npm run build:react
```

The server only serves the app in production mode when `electron/build/index.html` exists.

#### Issue: "Connection refused"

**Solution**: 
- Make sure the Electron app is running
- The Express server starts automatically when the Electron app starts
- Check the Electron app console for server startup messages

### Development Mode vs Production Mode:

- **Production Mode**: Serves static files from `electron/build/` at `http://localhost:4000`
- **Development Mode**: Vite dev server runs on port 3000, Express server on port 4000 (for webhooks/API only)

### Quick Start:

1. Build the app:
   ```bash
   npm run build:react
   ```

2. Start the app:
   ```bash
   npm start
   ```

3. Open browser and go to:
   ```
   http://localhost:4000
   ```

### Network Configuration:

You can configure the network binding in Settings → Network tab:
- **0.0.0.0**: Accessible from all network interfaces (default)
- **127.0.0.1**: Only accessible from localhost

### Security Note:

The web version has limited functionality compared to the Electron app:
- Some Electron-specific features won't work
- File system access is limited
- Some secure storage features may not work

For full functionality, use the Electron desktop app.



