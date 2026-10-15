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

if (-not (Test-Path -LiteralPath $nodeExe)) { throw "Bundled Node.js runtime was not found: $nodeExe" }
if (-not (Test-Path -LiteralPath $entry)) { throw "Connector service entry was not found: $entry" }

$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    if ($existing.Status -ne 'Stopped') { Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue }
    sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 1
}

$binaryPath = '"{0}" "{1}"' -f $nodeExe, $entry
New-Service -Name $serviceName -BinaryPathName $binaryPath -DisplayName $displayName -Description 'Runs the OnlineSCADA Factory Connector in the background.' -StartupType Automatic | Out-Null
sc.exe failure $serviceName reset= 86400 actions= restart/5000/restart/15000/restart/60000 | Out-Null
Start-Service -Name $serviceName
Get-Service -Name $serviceName | Select-Object Name, Status, StartType
