@echo off
title Disable Auto-Start
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT=%STARTUP_DIR%\OnlineSCADA-EdgeGateway.vbs"

if exist "%SHORTCUT%" (
    del /f /q "%SHORTCUT%"
    echo [ok] Auto-start removed. Gateway will not run on reboot.
) else (
    echo [i] Auto-start was already disabled.
)
pause