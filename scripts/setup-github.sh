#!/bin/bash

# GitHub Repository Setup Script
# This script helps you set up automatic deployment to GitHub

echo "🚀 GlobalReach - GitHub Setup Script"
echo "===================================="
echo ""

# Check if git is initialized
if [ ! -d ".git" ]; then
    echo "📦 Initializing Git repository..."
    git init
    echo "✅ Git repository initialized"
else
    echo "✅ Git repository already initialized"
fi

# Check if .gitignore exists
if [ ! -f ".gitignore" ]; then
    echo "⚠️  Warning: .gitignore not found"
else
    echo "✅ .gitignore found"
fi

# Check if GitHub remote exists
if git remote | grep -q "origin"; then
    echo "✅ GitHub remote 'origin' already configured"
    git remote -v
else
    echo ""
    echo "📝 Please provide your GitHub repository URL:"
    echo "   Example: https://github.com/username/repo-name.git"
    read -p "GitHub URL: " github_url
    
    if [ -n "$github_url" ]; then
        git remote add origin "$github_url"
        echo "✅ GitHub remote added: $github_url"
    else
        echo "⚠️  No URL provided. You can add it later with:"
        echo "   git remote add origin YOUR_GITHUB_URL"
    fi
fi

echo ""
echo "📋 Next steps:"
echo "1. Review and commit your changes:"
echo "   git add ."
echo "   git commit -m 'Initial commit'"
echo ""
echo "2. Push to GitHub:"
echo "   git branch -M main"
echo "   git push -u origin main"
echo ""
echo "3. Create your first release:"
echo "   git tag v1.0.0"
echo "   git push --tags"
echo ""
echo "✨ GitHub Actions will automatically:"
echo "   - Build your app on every push"
echo "   - Create releases when you push tags"
echo "   - Run tests and security checks"
echo ""
echo "📚 See DEPLOYMENT.md for detailed instructions"

