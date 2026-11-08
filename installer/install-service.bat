@echo off
setlocal
if "%~1"=="" (
  echo Usage: install-service.bat "C:\Program Files\OnlineSCADA\Factory Connector"
  exit /b 2
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-service.ps1" -InstallDir "%~1"
exit /b %errorlevel%