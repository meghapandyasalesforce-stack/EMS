@echo off
REM Redis Setup Script for EMS-Paarsiv (Windows)
REM This script helps set up Redis for the application

echo ==========================================
echo Redis Setup for EMS-Paarsiv
echo ==========================================
echo.

REM Check if Redis is installed
where redis-server >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Redis is already installed
    redis-server --version
) else (
    echo ❌ Redis is not installed
    echo.
    echo Please install Redis:
    echo.
    echo Option 1: Download from:
    echo   https://github.com/microsoftarchive/redis/releases
    echo.
    echo Option 2: Use WSL (Windows Subsystem for Linux):
    echo   1. Open PowerShell as Administrator
    echo   2. Run: wsl --install
    echo   3. Install Redis in WSL: sudo apt-get install redis-server
    echo.
    pause
    exit /b 1
)

echo.
echo Testing Redis connection...
redis-cli ping >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo ✅ Redis is working correctly!
    echo.
    echo Redis Configuration:
    echo   Host: localhost
    echo   Port: 6379
    echo   URL: redis://localhost:6379
    echo.
    echo ✅ Setup complete! Redis is ready to use.
) else (
    echo ❌ Redis connection test failed
    echo Please start Redis server manually:
    echo   redis-server
    echo.
    pause
    exit /b 1
)

pause

