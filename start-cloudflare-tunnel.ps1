# Start Cloudflare Tunnel and display the URL
Write-Host "Starting Cloudflare Tunnel for port 4000..." -ForegroundColor Green
Write-Host ""

$cloudflaredPath = "$env:USERPROFILE\Downloads\cloudflared.exe"

if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "ERROR: cloudflared.exe not found at $cloudflaredPath" -ForegroundColor Red
    Write-Host "Please download it from: https://github.com/cloudflare/cloudflared/releases/latest" -ForegroundColor Yellow
    exit 1
}

Write-Host "Your Cloudflare Tunnel URL will appear below:" -ForegroundColor Cyan
Write-Host "Look for a line that says: https://xxxxx.trycloudflare.com" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the tunnel" -ForegroundColor Gray
Write-Host ""

# Start cloudflared
& $cloudflaredPath tunnel --url http://localhost:4000

