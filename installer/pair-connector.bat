@echo off
setlocal
set "INSTALL_DIR=%ProgramFiles%\OnlineSCADA\Factory Connector"
set /p "PAIR_CODE=Enter the pairing code shown in OnlineSCADA: "
if "%PAIR_CODE%"=="" exit /b 2
"%INSTALL_DIR%\runtime\node.exe" "%INSTALL_DIR%\src\pair-connector.js" "%PAIR_CODE%"
if errorlevel 1 exit /b %errorlevel%
echo [+] Pairing completed. Start the OnlineSCADA Factory Connector service from Windows Services.
