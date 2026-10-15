# OnlineSCADA Factory Connector Installer

This folder contains the Windows service packaging foundation for the Factory Connector.

## Intended customer experience

The customer runs one installer. The installer registers:

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
