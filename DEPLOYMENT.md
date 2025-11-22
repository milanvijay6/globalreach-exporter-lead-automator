# Deployment Guide

## Automatic Deployment to GitHub

This project uses GitHub Actions for automatic deployment. Updates are automatically built and deployed when you push to the main branch or create a release tag.

## Setup Instructions

### 1. Initial GitHub Repository Setup

If you haven't created a GitHub repository yet:

1. Go to [GitHub](https://github.com) and create a new repository
2. Name it (e.g., `globalreach-exporter-lead-automator`)
3. **Do NOT** initialize with README, .gitignore, or license (we already have these)

### 2. Initialize Git and Push to GitHub

Run these commands in your project directory:

```bash
# Initialize git repository (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: GlobalReach Exporter Lead Automator"

# Add your GitHub repository as remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

### 3. Automatic Deployment Workflows

The following GitHub Actions workflows are configured:

#### **CI Workflow** (`.github/workflows/ci.yml`)
- Runs on every push and pull request
- Tests the application
- Checks for security vulnerabilities
- Validates the build

#### **Deploy Workflow** (`.github/workflows/deploy.yml`)
- Builds the app for Windows, macOS, and Linux
- Creates releases when you push a tag (e.g., `v1.0.0`)
- Uploads build artifacts

#### **Auto-commit Workflow** (`.github/workflows/auto-commit.yml`)
- Automatically commits build files (optional)
- Runs daily or can be triggered manually

### 4. Creating a Release

To create a new release with automatic builds:

```bash
# Update version in package.json
npm version patch  # or minor, or major

# Push the version tag
git push --tags
```

Or manually create a tag:

```bash
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

### 5. Manual Deployment

You can also trigger workflows manually:

1. Go to your GitHub repository
2. Click on "Actions" tab
3. Select the workflow you want to run
4. Click "Run workflow"

## Environment Variables

If you need to set up environment variables for the build:

1. Go to your GitHub repository
2. Click "Settings" → "Secrets and variables" → "Actions"
3. Add your secrets (e.g., `API_KEY` for Gemini)

## Build Artifacts

After each build, artifacts are available for 7 days:
- Go to "Actions" → Select a workflow run → "Artifacts"

## Release Notes

Release notes are automatically generated from:
- Commit messages
- Pull request titles
- Tag descriptions

## Troubleshooting

### Build Fails
- Check the Actions tab for error logs
- Ensure all dependencies are in `package.json`
- Verify Node.js version matches (>=18.0.0)

### Release Not Created
- Make sure you pushed a tag starting with `v` (e.g., `v1.0.0`)
- Check that the workflow has permission to create releases

### Auto-commit Not Working
- Verify `GITHUB_TOKEN` has write permissions
- Check if build files are already up to date

## Next Steps

1. **Set up your GitHub repository**
2. **Push your code** using the commands above
3. **Create your first release** by tagging: `git tag v1.0.0 && git push --tags`
4. **Monitor deployments** in the GitHub Actions tab

## Continuous Integration

The CI workflow will:
- ✅ Run on every push
- ✅ Test your code
- ✅ Check for security issues
- ✅ Validate builds

## Continuous Deployment

The deploy workflow will:
- ✅ Build for all platforms (Windows, macOS, Linux)
- ✅ Create releases automatically
- ✅ Upload build artifacts
- ✅ Generate release notes

