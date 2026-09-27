@echo off
title OnlineSCADA Factory Connector
cd /d "%~dp0"
color 0B

echo ========================================================
echo        OnlineSCADA Factory Connector Engine v2.1
echo ========================================================
echo.

if not exist "config.json" goto ERR_NO_CONFIG

where node >nul 2>nul
if errorlevel 1 goto ERR_NO_NODE

if not exist "node_modules\socket.io-client" goto INSTALL_DEPS
goto RUN_GATEWAY

:INSTALL_DEPS
echo [SYSTEM] First-time setup: Installing required industrial modules...
call npm install socket.io-client nodes7 modbus-serial node-opcua --no-audit --no-fund --silent
if errorlevel 1 goto ERR_NPM
cls
echo ========================================================
echo        OnlineSCADA Factory Connector Engine v2.1
echo ========================================================
echo [OK] Modules installed successfully!
echo.

:INSTALL_ETH
echo [SYSTEM] Installing Ethernet/IP module...
call npm install ethernet-ip --no-audit --no-fund --silent
if errorlevel 1 goto ERR_NPM

:RUN_GATEWAY
node src\index.js
if errorlevel 1 goto ERR_CRASH
goto END

:ERR_NO_CONFIG
color 0C
echo [ERROR] config.json is missing in this folder!
echo Please download your configuration package from https://app.onlinescada.in
echo.
pause
exit /b 1

:ERR_NO_NODE
color 0C
echo [ERROR] Node.js is not installed on this system!
echo Please download Node.js LTS from https://nodejs.org
echo.
pause
exit /b 1

:ERR_NPM
color 0C
echo [ERROR] Failed to install npm dependencies. Check network connectivity.
echo.
pause
exit /b 1

:ERR_CRASH
color 0C
echo.
echo [ERROR] Gateway process terminated unexpectedly.
echo.
pause
exit /b 1

:END
echo.
echo [INFO] Gateway stopped.
pause