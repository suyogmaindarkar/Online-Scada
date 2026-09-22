@echo off
title Disable Auto-Start on Boot
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP_DIR%\OnlineSCADA-EdgeGateway.vbs"

if exist "%SHORTCUT%" (
    del /f /q "%SHORTCUT%"
    echo Auto-Start removed successfully.
) else (
    echo Auto-Start was not enabled.
)
pause