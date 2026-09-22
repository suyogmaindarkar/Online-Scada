@echo off
title OnlineSCADA Edge Gateway
:: Set working directory to the folder containing this bat file
cd /d "%~dp0"
color 0A

echo ========================================================
echo   OnlineSCADA Edge Gateway
echo ========================================================
echo.

:: 1. Check for config.json
if not exist "config.json" (
    color 0C
    echo [x] ERROR: config.json missing!
    echo.
    echo Please download config.json from OnlineSCADA website
    echo and place it inside this folder:
    echo %cd%
    echo.
    pause
    exit /b 1
)

:: 2. Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [x] ERROR: Node.js is not installed on this PC!
    echo.
    echo Please download and install Node.js LTS from:
    echo https://nodejs.org
    echo.
    pause
    exit /b 1
)

:: 3. Auto-install dependencies if missing (first-time only)
if not exist "node_modules" (
    echo [i] First-time setup: Installing required modules...
    call npm install --omit=dev --no-audit --no-fund
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo [x] Failed to install modules.
        pause
        exit /b 1
    )
    echo [ok] Modules installed successfully!
    echo.
)

:: 4. AUTOMATICALLY LAUNCH GATEWAY (node src/index.js)
echo [ok] Launching OnlineSCADA Gateway Engine...
echo.
node src\index.js

:: 5. If it stops or crashes, keep window open to see error log
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [x] Gateway engine stopped. Check error log above.
    pause
)