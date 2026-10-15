@echo off
setlocal

if "%~1"=="" (
  echo Usage: install-service.bat "C:\Program Files\OnlineSCADA\Factory Connector"
  exit /b 2
)

set "INSTALL_DIR=%~1"
set "SERVICE_NAME=OnlineSCADAFactoryConnector"
set "DISPLAY_NAME=OnlineSCADA Factory Connector"
set "NODE_EXE=node.exe"
set "ENTRY=%INSTALL_DIR%\src\service-entry.js"

where %NODE_EXE% >nul 2>nul
if errorlevel 1 (
  echo Node.js LTS was not found. Install the approved runtime before registering the service.
  exit /b 3
)

sc.exe query "%SERVICE_NAME%" >nul 2>nul
if not errorlevel 1 sc.exe stop "%SERVICE_NAME%" >nul 2>nul
if not errorlevel 1 sc.exe delete "%SERVICE_NAME%" >nul 2>nul

sc.exe create "%SERVICE_NAME%" binPath= "\"%NODE_EXE%\" \"%ENTRY%\"" start= auto DisplayName= "%DISPLAY_NAME%"
if errorlevel 1 exit /b 4

sc.exe description "%SERVICE_NAME%" "Runs the OnlineSCADA Factory Connector in the background."
sc.exe failure "%SERVICE_NAME%" reset= 86400 actions= restart/5000/restart/15000/restart/60000
sc.exe start "%SERVICE_NAME%"
exit /b %errorlevel%
