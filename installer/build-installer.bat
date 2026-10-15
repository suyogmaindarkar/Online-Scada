@echo off
setlocal EnableExtensions

set "ROOT=%~dp0.."
set "ISS=%~dp0OnlineSCADA-Factory-Connector.iss"
set "RUNTIME=%~dp0runtime\node.exe"
set "ISCC=%ISCC_PATH%"

if "%ISCC%"=="" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC%" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"

if not exist "%RUNTIME%" (
  echo [x] Missing approved runtime: %RUNTIME%
  echo     Place node.exe and its required runtime files in installer\runtime.
  exit /b 10
)

if not exist "%ISCC%" (
  echo [x] Inno Setup 6 compiler was not found.
  echo     Install Inno Setup or set ISCC_PATH to ISCC.exe.
  exit /b 11
)

echo [o] Compiling OnlineSCADA Factory Connector installer...
"%ISCC%" "%ISS%"
if errorlevel 1 (
  echo [x] Installer compilation failed.
  exit /b 12
)

echo [+] Installer compiled successfully.
exit /b 0
