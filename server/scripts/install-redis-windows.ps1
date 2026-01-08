# Redis Installation Script for Windows
# Downloads and sets up Redis for Windows

Write-Host "Redis Installation Script for Windows" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

$redisVersion = "5.0.14.1"
$redisUrl = "https://github.com/tporadowski/redis/releases/download/v$redisVersion/Redis-x64-$redisVersion.zip"
$downloadPath = "$env:TEMP\redis-windows.zip"
$installPath = "$env:ProgramFiles\Redis"

Write-Host "Step 1: Downloading Redis for Windows..." -ForegroundColor Yellow
Write-Host "URL: $redisUrl" -ForegroundColor Gray

try {
    # Download Redis
    Invoke-WebRequest -Uri $redisUrl -OutFile $downloadPath -UseBasicParsing
    Write-Host "✓ Download completed" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "Step 2: Extracting Redis..." -ForegroundColor Yellow
    
    # Create installation directory
    if (-not (Test-Path $installPath)) {
        New-Item -ItemType Directory -Path $installPath -Force | Out-Null
    }
    
    # Extract to temp first
    $tempExtractPath = "$env:TEMP\redis-extract"
    if (Test-Path $tempExtractPath) {
        Remove-Item -Path $tempExtractPath -Recurse -Force
    }
    Expand-Archive -Path $downloadPath -DestinationPath $tempExtractPath -Force
    
    # Find redis-server.exe
    $redisServer = Get-ChildItem -Path $tempExtractPath -Recurse -Filter "redis-server.exe" | Select-Object -First 1
    
    if (-not $redisServer) {
        throw "redis-server.exe not found in downloaded archive"
    }
    
    # Copy to installation directory
    Copy-Item -Path $redisServer.DirectoryName -Destination $installPath -Recurse -Force
    Write-Host "✓ Redis extracted to: $installPath" -ForegroundColor Green
    
    # Clean up
    Remove-Item -Path $downloadPath -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $tempExtractPath -Recurse -Force -ErrorAction SilentlyContinue
    
    Write-Host ""
    Write-Host "Step 3: Adding Redis to PATH..." -ForegroundColor Yellow
    
    # Find redis-server.exe in install path
    $redisServerPath = Get-ChildItem -Path $installPath -Recurse -Filter "redis-server.exe" | Select-Object -First 1
    
    if (-not $redisServerPath) {
        throw "Could not find redis-server.exe after extraction"
    }
    
    $redisBinPath = $redisServerPath.DirectoryName
    
    # Add to user PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$redisBinPath*") {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$redisBinPath", "User")
        Write-Host "✓ Added Redis to PATH" -ForegroundColor Green
        Write-Host "  Note: You may need to restart your terminal for PATH changes to take effect" -ForegroundColor Yellow
    } else {
        Write-Host "✓ Redis already in PATH" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host "Redis Installation Complete!" -ForegroundColor Green
    Write-Host "=====================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Redis Server Location: $redisBinPath" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "To start Redis server, run:" -ForegroundColor Yellow
    Write-Host "  redis-server" -ForegroundColor White
    Write-Host ""
    Write-Host "Or start it as a Windows service:" -ForegroundColor Yellow
    Write-Host "  redis-server --service-install" -ForegroundColor White
    Write-Host "  redis-server --service-start" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "✗ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Manual Installation" -ForegroundColor Yellow
    Write-Host "1. Download Redis from: https://github.com/tporadowski/redis/releases" -ForegroundColor White
    Write-Host "2. Extract to C:\Program Files\Redis" -ForegroundColor White
    Write-Host "3. Add Redis bin folder to your PATH" -ForegroundColor White
    Write-Host "4. Run: redis-server" -ForegroundColor White
    Write-Host ""
    exit 1
}
