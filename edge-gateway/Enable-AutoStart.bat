@echo off
title Enable Auto-Start on Windows Boot
cd /d "%~dp0"
color 0A

set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP_DIR%\OnlineSCADA-EdgeGateway.vbs"

copy /y "Run-In-Background.vbs" "%SHORTCUT%" >nul

echo ========================================================
echo   Auto-Start Enabled!
echo ========================================================
echo.
echo OnlineSCADA Edge Gateway will now automatically launch in
echo the background whenever this PC turns on or reboots.
echo.
echo Press any key to exit...
pause >nul