@echo off
title Enable Auto-Start on Boot
cd /d "%~dp0"

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP_DIR%\OnlineSCADA-EdgeGateway.vbs"

copy /y "Run-In-Background.vbs" "%SHORTCUT%" >nul

echo ========================================================
echo   Auto-Start Enabled!
echo ========================================================
echo.
echo OnlineSCADA Edge Gateway will now automatically run in the
echo background whenever this factory PC turns on or reboots.
echo.
echo Press any key to close...
pause >nul