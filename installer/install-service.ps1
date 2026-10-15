[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$InstallDir
)

$ErrorActionPreference = 'Stop'
$serviceName = 'OnlineSCADAFactoryConnector'
$displayName = 'OnlineSCADA Factory Connector'
$nodeExe = Join-Path $InstallDir 'runtime\node.exe'
$entry = Join-Path $InstallDir 'src\service-entry.js'
$installer = Join-Path $InstallDir 'src\service-install.js'

if (-not (Test-Path -LiteralPath $nodeExe)) { throw "Bundled Node.js runtime was not found: $nodeExe" }
if (-not (Test-Path -LiteralPath $entry)) { throw "Connector service entry was not found: $entry" }
if (-not (Test-Path -LiteralPath $installer)) { throw "Connector service installer was not found: $installer" }

$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    if ($existing.Status -ne 'Stopped') { Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue }
    sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 1
}

& $nodeExe $installer $InstallDir
if ($LASTEXITCODE -ne 0) { throw "Connector service installer exited with code $LASTEXITCODE" }
Get-Service -Name $serviceName | Select-Object Name, Status, StartType
