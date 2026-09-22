@echo off
title OnlineSCADA Edge Gateway
cd /d "%~dp0"
color 0A

echo ========================================================
echo   OnlineSCADA Edge Gateway — Factory PLC Bridge
echo ========================================================
echo.

:: 1. Check for config.json
if not exist "config.json" (
    echo [x] ERROR: config.json missing!
    echo.
    echo Please follow these steps:
    echo 1. Login to https://app.onlinescada.in
    echo 2. Go to Edge Gateways -^> Click "Download config.json"
    echo 3. Place config.json into THIS folder:
    echo    %cd%
    echo.
    pause
    exit /b 1
)

:: 2. Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [x] ERROR: Node.js runtime not found.
    echo.
    echo Please download and install Node.js (LTS version) from:
    echo https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 3. Install dependencies automatically if missing
if not exist "node_modules" (
    echo [i] First-time setup: Installing required modules...
    call npm install --omit=dev
    if %ERRORLEVEL% neq 0 (
        echo [x] NPM install failed.
        pause
        exit /b 1
    )
    echo [ok] First-time setup complete!
    echo.
)

:: 4. Launch Gateway
echo [ok] Configuration verified. Connecting to OnlineSCADA Cloud...
echo.
node src\index.js

if %ERRORLEVEL% neq 0 (
    echo.
    echo [x] Gateway stopped with error.
    pause
)