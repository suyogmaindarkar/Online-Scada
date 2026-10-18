; OnlineSCADA Factory Connector service installer foundation
; Build with Inno Setup after bundling a tested Node.js runtime and signing.

#define AppName "OnlineSCADA Factory Connector"
#define AppVersion "1.0.1"
#define ServiceName "onlinescadafactoryconnector.exe"

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

[UninstallRun]
Filename: "{app}\runtime\node.exe"; Parameters: """{app}\src\service-uninstall.js"""; Flags: runhidden waituntilterminated

[Code]
var
  ConnectorSetupFailed: Boolean;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  FailureMessage: String;
begin
  if CurStep = ssPostInstall then
  begin
    WizardForm.StatusLabel.Caption := 'Authorize and start the Factory Connector...';
    ConnectorSetupFailed := True;
    FailureMessage := 'Factory Connector setup could not be launched.';
    if Exec(ExpandConstant('{app}\runtime\node.exe'),
      ExpandConstant('"{app}\src\install-flow.js" "{app}"'),
      ExpandConstant('{app}'), SW_HIDE, ewWaitUntilTerminated, ResultCode) then
    begin
      ConnectorSetupFailed := ResultCode <> 0;
      FailureMessage := Format('Factory Connector setup failed with exit code %d.', [ResultCode]);
      Log(Format('Factory Connector authorization/service setup exit code: %d', [ResultCode]));
    end
    else
      Log('Could not launch Factory Connector authorization/service setup.');

    if ConnectorSetupFailed then
      SuppressibleMsgBox(FailureMessage + ' Windows service startup was not confirmed. Run setup again as an administrator, complete browser approval, and check the OnlineSCADAFactoryConnector service in Windows Services.', mbError, MB_OK, IDOK);
  end;
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  if (CurPageID = wpFinished) and ConnectorSetupFailed then
  begin
    WizardForm.FinishedHeadingLabel.Caption := 'Factory Connector setup needs attention';
    WizardForm.FinishedLabel.Caption := 'Files were installed, but authorization or Windows service startup failed. The Factory Connector is not confirmed running. Run setup again as an administrator and complete browser approval. Check Windows Services and the connector logs if startup fails again.';
  end;
end;

function GetCustomSetupExitCode(): Integer;
begin
  if ConnectorSetupFailed then
    Result := 1
  else
    Result := 0;
end;
