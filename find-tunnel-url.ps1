# Find Cloudflare Tunnel URL
Write-Host "Starting Cloudflare Tunnel..." -ForegroundColor Green
Write-Host ""

$cloudflaredPath = "$env:USERPROFILE\Downloads\cloudflared.exe"

# Start cloudflared and capture output
$process = Start-Process -FilePath $cloudflaredPath -ArgumentList "tunnel","--url","http://localhost:4000" -PassThru -NoNewWindow -RedirectStandardOutput "tunnel-stdout.txt" -RedirectStandardError "tunnel-stderr.txt"

Write-Host "Waiting for tunnel to initialize..." -ForegroundColor Yellow
Start-Sleep -Seconds 12

# Check both output files
$found = $false
$url = $null

if (Test-Path "tunnel-stdout.txt") {
    $content = Get-Content "tunnel-stdout.txt" -Raw
    if ($content -match "https://([^\s]+\.trycloudflare\.com)") {
        $url = $matches[0]
        $found = $true
    }
}

if (-not $found -and (Test-Path "tunnel-stderr.txt")) {
    $content = Get-Content "tunnel-stderr.txt" -Raw
    if ($content -match "https://([^\s]+\.trycloudflare\.com)") {
        $url = $matches[0]
        $found = $true
    }
}

if ($found) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "YOUR CLOUDFLARE TUNNEL URL:" -ForegroundColor Green
    Write-Host $url -ForegroundColor Yellow
    Write-Host ""
    Write-Host "YOUR CALLBACK URL:" -ForegroundColor Green
    $callbackUrl = "$url/webhooks/whatsapp"
    Write-Host $callbackUrl -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Save URLs
    $url | Out-File -FilePath "cloudflare-url.txt" -Encoding utf8
    $callbackUrl | Out-File -FilePath "callback-url.txt" -Encoding utf8
    
    Write-Host "URLs saved to cloudflare-url.txt and callback-url.txt" -ForegroundColor Gray
} else {
    Write-Host "Could not find URL in output files. Showing recent output:" -ForegroundColor Yellow
    if (Test-Path "tunnel-stderr.txt") {
        Write-Host "--- stderr ---" -ForegroundColor Gray
        Get-Content "tunnel-stderr.txt" | Select-Object -Last 30
    }
    if (Test-Path "tunnel-stdout.txt") {
        Write-Host "--- stdout ---" -ForegroundColor Gray
        Get-Content "tunnel-stdout.txt" | Select-Object -Last 30
    }
}

Write-Host ""
Write-Host "Tunnel process ID: $($process.Id)" -ForegroundColor Gray
Write-Host "Keep this window open to maintain the tunnel." -ForegroundColor Gray

