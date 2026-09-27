@echo off
setlocal
title OnlineSCADA Edge Gateway
cd /d "%~dp0"

:: ============================================================
:: OnlineSCADA Edge Gateway
:: Startup / dependency checks only
:: ============================================================

if not exist "config.json" goto ERR_NO_CONFIG

where node >nul 2>nul
if errorlevel 1 goto ERR_NO_NODE

if not exist "node_modules\socket.io-client" goto INSTALL_DEPS
goto RUN_GATEWAY


:INSTALL_DEPS
cls
echo.
echo  ============================================================
echo.
echo             O N L I N E S C A D A
echo             EDGE GATEWAY SETUP
echo.
echo             Installing gateway modules...
echo.
echo  ============================================================
echo.
call npm install socket.io-client nodes7 modbus-serial node-opcua --no-audit --no-fund

if errorlevel 1 goto ERR_NPM
goto RUN_GATEWAY


:RUN_GATEWAY
cls
node src\index.js

if errorlevel 1 goto ERR_CRASH
goto END


:ERR_NO_CONFIG
color 0C
cls
echo.
echo  ============================================================
echo.
echo             O N L I N E S C A D A
echo             EDGE GATEWAY
echo.
echo             CONFIGURATION ERROR
echo.
echo  ============================================================
echo.
echo   config.json was not found.
echo.
echo   Download your connector configuration from:
echo   https://app.onlinescada.in
echo.
echo   Place config.json in this folder and start again.
echo.
pause
exit /b 1


:ERR_NO_NODE
color 0C
cls
echo.
echo  ============================================================
echo.
echo             O N L I N E S C A D A
echo             EDGE GATEWAY
echo.
echo             NODE.JS NOT FOUND
echo.
echo  ============================================================
echo.
echo   Node.js is required to run the gateway.
echo.
echo   Install Node.js LTS from:
echo   https://nodejs.org
echo.
pause
exit /b 1


:ERR_NPM
color 0C
cls
echo.
echo  ============================================================
echo.
echo             O N L I N E S C A D A
echo             EDGE GATEWAY
echo.
echo             MODULE INSTALLATION FAILED
echo.
echo  ============================================================
echo.
echo   npm could not install the required gateway modules.
echo.
echo   Check your internet connection and try again.
echo.
pause
exit /b 1


:ERR_CRASH
color 0C
echo.
echo.
echo  OnlineSCADA Gateway stopped unexpectedly.
echo  Review the error shown above.
echo.
pause
exit /b 1


:END
echo.
echo  OnlineSCADA Gateway stopped.
pause
exit /b 0