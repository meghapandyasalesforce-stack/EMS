@echo off
echo ====================================
echo Redis Installation for Windows
echo ====================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo ERROR: This script requires administrator privileges.
    echo Please run as administrator.
    pause
    exit /b 1
)

set REDIS_VERSION=5.0.14.1
set REDIS_URL=https://github.com/tporadowski/redis/releases/download/v%REDIS_VERSION%/Redis-x64-%REDIS_VERSION%.zip
set DOWNLOAD_PATH=%TEMP%\redis-windows.zip
set INSTALL_PATH=C:\Program Files\Redis

echo Step 1: Downloading Redis...
echo URL: %REDIS_URL%
echo.

powershell -Command "Invoke-WebRequest -Uri '%REDIS_URL%' -OutFile '%DOWNLOAD_PATH%'"
if %errorLevel% neq 0 (
    echo ERROR: Failed to download Redis
    pause
    exit /b 1
)
echo Download completed!
echo.

echo Step 2: Extracting Redis...
if not exist "%INSTALL_PATH%" mkdir "%INSTALL_PATH%"

powershell -Command "Expand-Archive -Path '%DOWNLOAD_PATH%' -DestinationPath '%TEMP%\redis-extract' -Force"

REM Find redis-server.exe
for /r "%TEMP%\redis-extract" %%f in (redis-server.exe) do (
    set REDIS_BIN=%%~dpf
    goto :found
)

:found
if not defined REDIS_BIN (
    echo ERROR: redis-server.exe not found
    pause
    exit /b 1
)

REM Copy to installation directory
xcopy "%REDIS_BIN%*" "%INSTALL_PATH%\" /E /I /Y
echo Redis extracted to: %INSTALL_PATH%
echo.

echo Step 3: Adding to PATH...
setx PATH "%PATH%;%REDIS_BIN%" /M
echo Added Redis to PATH
echo.

echo ====================================
echo Installation Complete!
echo ====================================
echo.
echo Redis Server Location: %REDIS_BIN%
echo.
echo To start Redis server, run:
echo   redis-server
echo.
echo Or install as Windows service:
echo   redis-server --service-install
echo   redis-server --service-start
echo.

REM Cleanup
del "%DOWNLOAD_PATH%" 2>nul
rmdir /s /q "%TEMP%\redis-extract" 2>nul

pause

