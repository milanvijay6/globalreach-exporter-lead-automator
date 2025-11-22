# GitHub Repository Setup Script (PowerShell)
# This script helps you set up automatic deployment to GitHub

Write-Host "🚀 GlobalReach - GitHub Setup Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Check if git is initialized
if (-not (Test-Path ".git")) {
    Write-Host "📦 Initializing Git repository..." -ForegroundColor Yellow
    git init
    Write-Host "✅ Git repository initialized" -ForegroundColor Green
} else {
    Write-Host "✅ Git repository already initialized" -ForegroundColor Green
}

# Check if .gitignore exists
if (-not (Test-Path ".gitignore")) {
    Write-Host "⚠️  Warning: .gitignore not found" -ForegroundColor Yellow
} else {
    Write-Host "✅ .gitignore found" -ForegroundColor Green
}

# Check if GitHub remote exists
$remotes = git remote
if ($remotes -match "origin") {
    Write-Host "✅ GitHub remote 'origin' already configured" -ForegroundColor Green
    git remote -v
} else {
    Write-Host ""
    Write-Host "📝 Please provide your GitHub repository URL:" -ForegroundColor Yellow
    Write-Host "   Example: https://github.com/username/repo-name.git" -ForegroundColor Gray
    $github_url = Read-Host "GitHub URL"
    
    if ($github_url) {
        git remote add origin $github_url
        Write-Host "✅ GitHub remote added: $github_url" -ForegroundColor Green
    } else {
        Write-Host "⚠️  No URL provided. You can add it later with:" -ForegroundColor Yellow
        Write-Host "   git remote add origin YOUR_GITHUB_URL" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "📋 Next steps:" -ForegroundColor Cyan
Write-Host "1. Review and commit your changes:" -ForegroundColor White
Write-Host "   git add ." -ForegroundColor Gray
Write-Host "   git commit -m 'Initial commit'" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Push to GitHub:" -ForegroundColor White
Write-Host "   git branch -M main" -ForegroundColor Gray
Write-Host "   git push -u origin main" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Create your first release:" -ForegroundColor White
Write-Host "   git tag v1.0.0" -ForegroundColor Gray
Write-Host "   git push --tags" -ForegroundColor Gray
Write-Host ""
Write-Host "✨ GitHub Actions will automatically:" -ForegroundColor Cyan
Write-Host "   - Build your app on every push" -ForegroundColor White
Write-Host "   - Create releases when you push tags" -ForegroundColor White
Write-Host "   - Run tests and security checks" -ForegroundColor White
Write-Host ""
Write-Host "📚 See DEPLOYMENT.md for detailed instructions" -ForegroundColor Cyan

