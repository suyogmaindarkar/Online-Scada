@echo off
title OnlineSCADA Edge Gateway
cd /d "%~dp0"
color 0A

echo ========================================================
echo   OnlineSCADA Edge Gateway
echo ========================================================
echo.

:: 1. Check for config.json
if not exist "config.json" goto ERR_NO_CONFIG

:: 2. Check for Node.js
where node >nul 2>nul
if errorlevel 1 goto ERR_NO_NODE

:: 3. Check for required module
if not exist "node_modules\socket.io-client" goto INSTALL_DEPS
goto RUN_GATEWAY

:INSTALL_DEPS
echo [i] First-time setup: Installing required PLC modules...
call npm install socket.io-client nodes7 modbus-serial node-opcua --no-audit --no-fund
if errorlevel 1 goto ERR_NPM
echo [ok] Modules installed successfully!
echo.

:RUN_GATEWAY
echo [ok] Launching OnlineSCADA Gateway Engine...
echo.
node src\index.js
if errorlevel 1 goto ERR_CRASH
goto END

:ERR_NO_CONFIG
color 0C
echo [x] ERROR: config.json is missing in this folder!
echo.
echo Please download config.json from https://app.onlinescada.in
echo and place it inside this folder.
echo.
pause
exit /b 1

:ERR_NO_NODE
color 0C
echo [x] ERROR: Node.js is not installed on this PC!
echo.
echo Please download and install Node.js LTS from:
echo https://nodejs.org
echo.
pause
exit /b 1

:ERR_NPM
color 0C
echo [x] ERROR: Failed to install npm modules. Check internet connection.
echo.
pause
exit /b 1

:ERR_CRASH
color 0C
echo.
echo [x] Gateway engine stopped. Check error log above.
echo.
pause
exit /b 1

:END
echo.
echo [i] Gateway stopped.
pause