@echo off
title OnlineSCADA Edge Gateway
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
    echo Please download config.json from OnlineSCADA website.
    pause
    exit /b 1
)

:: 2. Check for Node.js (System PATH OR Local Portable bin\node.exe)
where node >nul 2>nul
if %ERRORLEVEL% equ 0 (
    set "NODE_CMD=node"
) else if exist "bin\node.exe" (
    set "NODE_CMD=bin\node.exe"
) else (
    echo [i] Node.js is not installed on this PC.
    echo [i] Auto-downloading standalone Node.js runtime (one-time, ~30MB)...
    echo.
    mkdir bin >nul 2>nul
    powershell -Command "& { [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v18.20.0/win-x64/node.exe' -OutFile 'bin\node.exe' }"
    
    if exist "bin\node.exe" (
        set "NODE_CMD=bin\node.exe"
        echo [ok] Standalone Node.js runtime downloaded successfully!
        echo.
    ) else (
        color 0C
        echo [x] Auto-download failed. Please connect to internet or install Node.js from https://nodejs.org
        pause
        exit /b 1
    )
)

:: 3. Auto-install required PLC modules if missing
if not exist "node_modules\socket.io-client" (
    echo [i] First-time setup: Installing required PLC drivers...
    call npm install socket.io-client nodes7 modbus-serial node-opcua --no-audit --no-fund
    if %ERRORLEVEL% neq 0 (
        color 0C
        echo [x] Driver installation failed. Please check internet connection.
        pause
        exit /b 1
    )
    echo [ok] Drivers installed successfully!
    echo.
)

:: 4. LAUNCH GATEWAY WITH SYSTEM OR PORTABLE NODE
echo [ok] Launching OnlineSCADA Gateway Engine...
echo.
%NODE_CMD% src\index.js

if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [x] Gateway engine stopped with error.
    pause
)