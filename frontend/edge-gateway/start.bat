@echo off
title OnlineSCADA Edge Gateway
echo.
echo ============================================
echo   OnlineSCADA Edge Gateway
echo ============================================
echo.

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/
    echo.
    pause
    exit /b 1
)

:: Check if config.json exists
if not exist "config.json" (
    echo ERROR: config.json not found!
    echo.
    echo Please download your gateway config from:
    echo OnlineSCADA Dashboard -^> Settings -^> Edge Gateways
    echo.
    pause
    exit /b 1
)

:: Install dependencies if needed
if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    echo.
)

:: Start gateway
echo Starting Edge Gateway...
echo Press Ctrl+C to stop
echo.
node src/index.js

pause