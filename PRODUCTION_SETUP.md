# Production Setup Guide

This guide provides instructions for deploying the application in a production environment.

## Environment Variables

### Required for Production

Set these environment variables before building/running the application:

#### Email Configuration
```bash
DEFAULT_EMAIL_USERNAME=your-email@outlook.com
DEFAULT_EMAIL_PASSWORD=your-secure-password
DEFAULT_EMAIL_SMTP_HOST=smtp-mail.outlook.com  # Optional, defaults to smtp-mail.outlook.com
DEFAULT_EMAIL_SMTP_PORT=587                     # Optional, defaults to 587
DEFAULT_EMAIL_IMAP_HOST=outlook.office365.com  # Optional, defaults to outlook.office365.com
DEFAULT_EMAIL_IMAP_PORT=993                     # Optional, defaults to 993
```

#### Security Configuration
```bash
ENCRYPTION_KEY_SECRET=your-random-secret-key-here
ENCRYPTION_KEY_SALT=your-random-salt-here
```

**⚠️ IMPORTANT:** Generate strong random values for `ENCRYPTION_KEY_SECRET` and `ENCRYPTION_KEY_SALT`. Never use default values in production.

### Optional Environment Variables

```bash
NODE_ENV=production              # Set to 'production' for production builds
PORT=4000                        # Server port (default: 4000)
MAGIC_LINK_SECRET=your-secret    # For magic link authentication
API_KEY=your-api-key             # For external API integrations
```

## Security Checklist

- [ ] Set `ENCRYPTION_KEY_SECRET` and `ENCRYPTION_KEY_SALT` environment variables
- [ ] Set `DEFAULT_EMAIL_USERNAME` and `DEFAULT_EMAIL_PASSWORD` environment variables
- [ ] Ensure `NODE_ENV=production` is set
- [ ] Review and remove any hardcoded credentials
- [ ] Enable HTTPS in production (if applicable)
- [ ] Configure proper firewall rules
- [ ] Set up error tracking/monitoring service
- [ ] Configure log rotation for application logs

## Building for Production

### 1. Set Environment Variables
```bash
# Windows (PowerShell)
$env:NODE_ENV="production"
$env:ENCRYPTION_KEY_SECRET="your-secret"
$env:ENCRYPTION_KEY_SALT="your-salt"
$env:DEFAULT_EMAIL_USERNAME="your-email@outlook.com"
$env:DEFAULT_EMAIL_PASSWORD="your-password"

# Linux/Mac
export NODE_ENV=production
export ENCRYPTION_KEY_SECRET=your-secret
export ENCRYPTION_KEY_SALT=your-salt
export DEFAULT_EMAIL_USERNAME=your-email@outlook.com
export DEFAULT_EMAIL_PASSWORD=your-password
```

### 2. Build the Application
```bash
npm run build:react  # Build React frontend
npm run build        # Build Electron app with installer
```

### 3. Verify Build
- Check that source maps are disabled in production builds
- Verify no sensitive data is included in build artifacts
- Test the installer on a clean system

## Production Optimizations

### Build Configuration
- Source maps are automatically disabled in production (`NODE_ENV=production`)
- Code is minified using esbuild
- Dead code elimination is enabled
- Unused dependencies are tree-shaken

### Error Handling
- Error boundaries catch React component errors
- Global error handlers log unhandled errors
- User-friendly error messages are displayed
- Error details are hidden in production UI (shown in development)

### Logging
- Production logs are written to `userData/logs/` directory
- Error logs are separated from general logs
- Logs include timestamps and structured data

## Monitoring and Debugging

### Log Files
Logs are stored in:
- **Windows:** `%APPDATA%/shreenathji-app/logs/`
- **Linux:** `~/.config/shreenathji-app/logs/`
- **macOS:** `~/Library/Application Support/shreenathji-app/logs/`

Log files:
- `error.log` - Error-level logs only
- `combined.log` - All logs (info, warn, error)

### Error Tracking
To integrate error tracking (e.g., Sentry):
1. Install the error tracking SDK
2. Update `index.tsx` to send errors to the tracking service
3. Update `components/ErrorBoundary.tsx` to report errors

## Performance Considerations

### Memory Management
- Large chunks are split for lazy loading
- Unused modules are not included in the bundle
- React components use proper cleanup in useEffect hooks

### Network Optimization
- Static assets are served efficiently
- API calls include proper error handling and retries
- Rate limiting is implemented for external APIs

## Troubleshooting

### Application Won't Start
1. Check log files for errors
2. Verify environment variables are set correctly
3. Ensure all dependencies are installed
4. Check file permissions

### Email Connection Fails
1. Verify `DEFAULT_EMAIL_USERNAME` and `DEFAULT_EMAIL_PASSWORD` are correct
2. Check SMTP/IMAP server settings
3. Ensure network connectivity
4. Review email provider requirements (app passwords, etc.)

### Encryption Errors
1. Verify `ENCRYPTION_KEY_SECRET` and `ENCRYPTION_KEY_SALT` are set
2. Ensure keys are consistent across app restarts
3. Check file permissions for config files

## Support

For production issues, check:
1. Application logs in `userData/logs/`
2. Error messages in the application UI
3. System event logs (Windows Event Viewer, etc.)

For additional support, contact the development team with:
- Error messages from logs
- Environment details (OS, Node.js version)
- Steps to reproduce the issue

