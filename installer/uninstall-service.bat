@echo off
setlocal
set "SERVICE_NAME=OnlineSCADAFactoryConnector"
sc.exe stop "%SERVICE_NAME%" >nul 2>nul
timeout /t 2 /nobreak >nul
sc.exe delete "%SERVICE_NAME%" >nul 2>nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Get-Process | Where-Object { $_.Path -like '*OnlineSCADA*' -or $_.Path -like '*Factory Connector*' } | Stop-Process -Force -ErrorAction SilentlyContinue" >nul 2>nul
exit /b 0