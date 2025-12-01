# Get Cloudflare Tunnel URL
$cloudflaredPath = "$env:USERPROFILE\Downloads\cloudflared.exe"

if (-not (Test-Path $cloudflaredPath)) {
    Write-Host "ERROR: cloudflared.exe not found" -ForegroundColor Red
    exit 1
}

Write-Host "Starting Cloudflare Tunnel and capturing URL..." -ForegroundColor Green
Write-Host ""

# Start cloudflared and capture output
$job = Start-Job -ScriptBlock {
    param($path)
    & $path tunnel --url http://localhost:4000 2>&1
} -ArgumentList $cloudflaredPath

# Wait a bit for the URL to appear
Start-Sleep -Seconds 8

# Get the output
$output = Receive-Job -Job $job

# Extract URL
$urlLine = $output | Where-Object { $_ -match "trycloudflare\.com" } | Select-Object -First 1

if ($urlLine) {
    if ($urlLine -match "https://([^\s]+\.trycloudflare\.com)") {
        $url = $matches[0]
        Write-Host ""
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "YOUR CLOUDFLARE TUNNEL URL:" -ForegroundColor Green
        Write-Host $url -ForegroundColor Yellow
        Write-Host ""
        Write-Host "YOUR CALLBACK URL:" -ForegroundColor Green
        Write-Host "$url/webhooks/whatsapp" -ForegroundColor Yellow
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        
        # Save to file
        $url | Out-File -FilePath "cloudflare-url.txt" -Encoding utf8
        "$url/webhooks/whatsapp" | Out-File -FilePath "callback-url.txt" -Encoding utf8
        
        Write-Host "URLs saved to:" -ForegroundColor Gray
        Write-Host "  - cloudflare-url.txt" -ForegroundColor Gray
        Write-Host "  - callback-url.txt" -ForegroundColor Gray
    } else {
        Write-Host "Could not parse URL from output" -ForegroundColor Red
        Write-Host "Output: $urlLine" -ForegroundColor Yellow
    }
} else {
    Write-Host "URL not found in output. Showing recent output:" -ForegroundColor Yellow
    $output | Select-Object -Last 20
}

# Keep the job running in background
Write-Host ""
Write-Host "Tunnel is running in background. Press Ctrl+C to stop." -ForegroundColor Gray

# Keep receiving output
try {
    while ($true) {
        Start-Sleep -Seconds 5
        $newOutput = Receive-Job -Job $job -ErrorAction SilentlyContinue
        if ($newOutput) {
            # Check for URL in new output
            $newUrlLine = $newOutput | Where-Object { $_ -match "trycloudflare\.com" } | Select-Object -First 1
            if ($newUrlLine -and $newUrlLine -match "https://([^\s]+\.trycloudflare\.com)") {
                $url = $matches[0]
                Write-Host ""
                Write-Host "FOUND URL: $url" -ForegroundColor Green
                Write-Host "CALLBACK URL: $url/webhooks/whatsapp" -ForegroundColor Green
                $url | Out-File -FilePath "cloudflare-url.txt" -Encoding utf8
                "$url/webhooks/whatsapp" | Out-File -FilePath "callback-url.txt" -Encoding utf8
                break
            }
        }
    }
} catch {
    # Job might have ended
}

