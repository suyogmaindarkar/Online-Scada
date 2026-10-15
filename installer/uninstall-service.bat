@echo off
setlocal
set "SERVICE_NAME=OnlineSCADAFactoryConnector"
sc.exe stop "%SERVICE_NAME%" >nul 2>nul
sc.exe delete "%SERVICE_NAME%"
exit /b %errorlevel%
