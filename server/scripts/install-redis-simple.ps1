# Simple Redis Installation (No Admin Required)
# Installs Redis to user directory

$ErrorActionPreference = "Stop"

Write-Host "Redis Installation (User Directory)" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

$redisVersion = "5.0.14.1"
$redisUrl = "https://github.com/tporadowski/redis/releases/download/v$redisVersion/Redis-x64-$redisVersion.zip"
$downloadPath = "$env:TEMP\redis-windows.zip"
$installPath = "$env:USERPROFILE\Redis"

Write-Host "Downloading Redis..." -ForegroundColor Yellow
Invoke-WebRequest -Uri $redisUrl -OutFile $downloadPath

Write-Host "Extracting..." -ForegroundColor Yellow
if (Test-Path $installPath) {
    Remove-Item -Path $installPath -Recurse -Force
}
New-Item -ItemType Directory -Path $installPath -Force | Out-Null
Expand-Archive -Path $downloadPath -DestinationPath "$env:TEMP\redis-extract" -Force

$redisServer = Get-ChildItem -Path "$env:TEMP\redis-extract" -Recurse -Filter "redis-server.exe" | Select-Object -First 1
if (-not $redisServer) {
    Write-Host "ERROR: redis-server.exe not found" -ForegroundColor Red
    exit 1
}

$redisBinPath = $redisServer.DirectoryName
Copy-Item -Path "$redisBinPath\*" -Destination $installPath -Recurse -Force

# Add to user PATH
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$installPath*") {
    [Environment]::SetEnvironmentVariable("Path", "$userPath;$installPath", "User")
    Write-Host "Added to PATH (restart terminal to use)" -ForegroundColor Green
}

Write-Host ""
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "Location: $installPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start Redis, run:" -ForegroundColor Yellow
Write-Host "  $installPath\redis-server.exe" -ForegroundColor White
Write-Host ""

# Cleanup
Remove-Item -Path $downloadPath -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$env:TEMP\redis-extract" -Recurse -Force -ErrorAction SilentlyContinue

