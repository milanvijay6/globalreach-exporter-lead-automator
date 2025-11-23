# PowerShell Installer Wrapper
# Provides a user-friendly installer interface with progress indicators

param(
    [string]$InstallPath = "$env:ProgramFiles\GlobalReach",
    [switch]$SkipDependencyCheck = $false,
    [switch]$CreateShortcut = $true,
    [switch]$StartAfterInstall = $false
)

$ErrorActionPreference = "Stop"

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "This installer requires administrator privileges." -ForegroundColor Red
    Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
    exit 1
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "GlobalReach Installer" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check dependencies
if (-not $SkipDependencyCheck) {
    Write-Host "[1/5] Checking system requirements..." -ForegroundColor Yellow
    
    $nodeCheck = node --version 2>$null
    if (-not $nodeCheck) {
        Write-Host "Node.js not found. Installing..." -ForegroundColor Yellow
        # Run dependency manager
        node "$PSScriptRoot\..\installer\dependency-manager.js"
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Failed to install dependencies." -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "Node.js found: $nodeCheck" -ForegroundColor Green
    }
} else {
    Write-Host "[1/5] Skipping dependency check..." -ForegroundColor Yellow
}

# Step 2: Create installation directory
Write-Host "[2/5] Preparing installation directory..." -ForegroundColor Yellow
if (-not (Test-Path $InstallPath)) {
    New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    Write-Host "Created directory: $InstallPath" -ForegroundColor Green
} else {
    Write-Host "Directory exists: $InstallPath" -ForegroundColor Green
}

# Step 3: Copy application files
Write-Host "[3/5] Installing application files..." -ForegroundColor Yellow
$sourcePath = "$PSScriptRoot\.."
$filesToCopy = @(
    "electron",
    "package.json",
    "package-lock.json"
)

foreach ($file in $filesToCopy) {
    $source = Join-Path $sourcePath $file
    $dest = Join-Path $InstallPath $file
    
    if (Test-Path $source) {
        if (Test-Path $dest) {
            Remove-Item $dest -Recurse -Force
        }
        Copy-Item $source $dest -Recurse -Force
        Write-Host "  Copied: $file" -ForegroundColor Gray
    }
}

Write-Host "Application files installed." -ForegroundColor Green

# Step 4: Install npm dependencies
Write-Host "[4/5] Installing npm dependencies..." -ForegroundColor Yellow
Push-Location $InstallPath
try {
    npm install --production
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to install npm dependencies." -ForegroundColor Red
        exit 1
    }
    Write-Host "Dependencies installed." -ForegroundColor Green
} finally {
    Pop-Location
}

# Step 5: Create shortcuts
if ($CreateShortcut) {
    Write-Host "[5/5] Creating shortcuts..." -ForegroundColor Yellow
    
    $exePath = Join-Path $InstallPath "electron\main.js"
    $appName = "GlobalReach"
    
    node "$PSScriptRoot\..\installer\shortcut-creator.js" "node" "$exePath" "both"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Shortcuts created." -ForegroundColor Green
    } else {
        Write-Host "Warning: Failed to create shortcuts." -ForegroundColor Yellow
    }
} else {
    Write-Host "[5/5] Skipping shortcut creation..." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Application installed to: $InstallPath" -ForegroundColor White
Write-Host ""

if ($StartAfterInstall) {
    Write-Host "Starting application..." -ForegroundColor Yellow
    Start-Process "node" -ArgumentList $exePath -WorkingDirectory $InstallPath
}

Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

