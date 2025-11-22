# Quick Start: Deploy to GitHub

## Step-by-Step Guide

### 1. Create GitHub Repository

1. Go to [github.com/new](https://github.com/new)
2. Enter repository name (e.g., `globalreach-exporter-lead-automator`)
3. Choose **Public** or **Private**
4. **DO NOT** check "Initialize with README" (we already have one)
5. Click "Create repository"

### 2. Initialize and Push Your Code

Open PowerShell or Terminal in your project folder and run:

```powershell
# Initialize Git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: GlobalReach Exporter Lead Automator"

# Add your GitHub repository (replace with your URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Verify GitHub Actions

1. Go to your GitHub repository
2. Click the **"Actions"** tab
3. You should see workflows listed:
   - ✅ **CI - Test and Lint** (runs on every push)
   - ✅ **Auto Deploy on Push** (builds on every push to main)
   - ✅ **Build and Deploy** (creates releases on tags)

### 4. Automatic Deployment is Now Active!

Every time you push code to the `main` branch:
- ✅ Code is automatically tested
- ✅ App is automatically built
- ✅ Build files are automatically committed (if changed)

### 5. Create Your First Release

To create a release with downloadable executables:

```powershell
# Update version and create tag
npm run version:patch

# Or manually:
git tag v1.0.0
git push --tags
```

This will:
- Build the app for Windows, macOS, and Linux
- Create a GitHub Release
- Upload build artifacts

## Workflow Details

### Auto Deploy on Push (`.github/workflows/auto-deploy.yml`)
- **Triggers:** Every push to `main` or `master`
- **Actions:**
  - Builds React app
  - Commits build files automatically
  - Pushes updates back to repository

### CI - Test and Lint (`.github/workflows/ci.yml`)
- **Triggers:** Every push and pull request
- **Actions:**
  - Runs tests
  - Security audit
  - Build validation

### Build and Deploy (`.github/workflows/deploy.yml`)
- **Triggers:** 
  - Push to `main`/`master` (builds only)
  - Tag push starting with `v` (creates release)
- **Actions:**
  - Builds for all platforms
  - Creates GitHub Release
  - Uploads executables

## Useful Commands

```powershell
# Quick version bump and release
npm run version:patch   # 1.0.0 → 1.0.1
npm run version:minor   # 1.0.0 → 1.1.0
npm run version:major   # 1.0.0 → 2.0.0

# Manual deployment
npm run deploy

# Check workflow status
# Visit: https://github.com/YOUR_USERNAME/YOUR_REPO/actions
```

## Troubleshooting

### "Permission denied" errors
- Make sure you've pushed to GitHub at least once
- Check that GitHub Actions has write permissions (Settings → Actions → General)

### Build fails
- Check the Actions tab for error details
- Ensure all dependencies are in `package.json`
- Verify Node.js version (needs >= 18.0.0)

### Auto-commit not working
- The workflow needs write access to the repository
- Check repository Settings → Actions → General → Workflow permissions
- Ensure "Read and write permissions" is selected

## Next Steps

1. ✅ Push your code (see Step 2 above)
2. ✅ Monitor deployments in the Actions tab
3. ✅ Create your first release with `npm run version:patch`
4. ✅ Download executables from the Releases page

## Security Notes

- Never commit `.env` files or API keys
- Use GitHub Secrets for sensitive data
- Review `.gitignore` to ensure secrets are excluded

