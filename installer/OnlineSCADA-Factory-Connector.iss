; OnlineSCADA Factory Connector service installer foundation
; Build with Inno Setup after bundling a tested Node.js runtime and signing.

#define AppName "OnlineSCADA Factory Connector"
#define AppVersion "1.0.0"
#define ServiceName "OnlineSCADAFactoryConnector"

[Setup]
AppId={{B2E2D63E-9D8F-4A9D-8E9A-4C7D9B2F6A10}}
AppName={#AppName}
AppVersion={#AppVersion}
DefaultDirName={autopf}\OnlineSCADA\Factory Connector
DefaultGroupName=OnlineSCADA
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
DisableProgramGroupPage=yes
OutputBaseFilename=OnlineSCADA-Factory-Connector-Setup
Compression=lzma2
SolidCompression=yes

[Files]
Source: "..\edge-gateway\src\*.js"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs
Source: "..\edge-gateway\package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\edge-gateway\package-lock.json"; DestDir: "{app}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "..\edge-gateway\node_modules\*"; DestDir: "{app}\node_modules"; Flags: ignoreversion recursesubdirs
; Release builds must place the approved portable Node.js runtime here.
Source: "runtime\node.exe"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "runtime\README.txt"; DestDir: "{app}\runtime"; Flags: ignoreversion
Source: "pair-connector.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "install-service.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "install-service.ps1"; DestDir: "{app}"; Flags: ignoreversion

[Dirs]
Name: "{commonappdata}\OnlineSCADA\Factory Connector"
Name: "{commonappdata}\OnlineSCADA\Factory Connector\logs"

[Run]
Filename: "{sys}\sc.exe"; Parameters: "create {#ServiceName} binPath= ""{code:GetNodePath}"" ""{app}\src\service-entry.js"" start= auto DisplayName= ""{#AppName}"""; Flags: runhidden waituntilterminated; StatusMsg: "Registering background service..."
Filename: "{sys}\sc.exe"; Parameters: "failure {#ServiceName} reset= 86400 actions= restart/5000/restart/15000/restart/60000"; Flags: runhidden waituntilterminated

[UninstallRun]
Filename: "{app}\runtime\node.exe"; Parameters: """{app}\src\service-uninstall.js"""; Flags: runhidden waituntilterminated

[Code]
function GetNodePath(Param: String): String;
begin
  Result := ExpandConstant('{app}\runtime\node.exe');
end;
