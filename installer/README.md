# OnlineSCADA Factory Connector Installer

This folder contains the Windows service packaging foundation for the Factory Connector.

## Intended customer experience

The customer runs one installer. The installer creates a short-lived device authorization session, opens the OnlineSCADA browser verification URL, waits for the signed-in user to approve the factory computer, stores the returned API key protected with Windows DPAPI, and then registers:

```text
OnlineSCADA Factory Connector
```

The service starts automatically with Windows and runs the connector in the background.

The ZIP package and `Start.bat` remain fallback/manual methods.

## Release packaging requirement

Before building a customer installer, place a tested, approved Windows Node.js LTS runtime at:

```text
installer/runtime/node.exe
```

The runtime directory may contain the additional files required by that Node.js distribution. The installer copies it to the protected installation directory and registers the service against that bundled executable. Customers should not need to install Node.js or run npm.

Do not distribute this installer until the runtime is bundled, the package dependencies are included, and the installer is code-signed.

## Build and validate

On a Windows release machine:

```bat
installer\build-installer.bat
```

The build stops if the approved runtime or Inno Setup compiler is missing.

Optional PowerShell release-input validation (release tooling only):

```powershell
powershell -ExecutionPolicy Bypass -File installer\validate-release.ps1
```

The installer must be tested on a clean Windows machine before customer distribution.

## Option C pairing limitations

The pairing helper uses the bundled Node runtime and `rundll32.exe` to open the default browser; normal users do not need PowerShell, a terminal, Node.js, or npm. The browser verification page is `/connector/authorize` on the deployed frontend, and the backend device authorization session expires after 10 minutes. Approval is restricted to signed-in administrators and engineers; polling uses a separate short-lived polling ID and secret, and the encrypted credential result remains recoverable for a short delivery window if the first poll response is interrupted. The helper is Windows-only because it relies on Windows DPAPI and the Windows service installer. If pairing is cancelled or times out, service registration refuses to continue without the protected configuration file.

## Service commands for developer testing

From an elevated Command Prompt, after setting the connector installation path:

```bat
install-service.bat "C:\Program Files\OnlineSCADA\Factory Connector"
uninstall-service.bat
```

The service uses:

```text
src\service-entry.js
```

Runtime configuration is stored under:

```text
C:\ProgramData\OnlineSCADA\Factory Connector
```
