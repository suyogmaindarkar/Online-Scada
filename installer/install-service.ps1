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

# Clean up existing service if present
$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
    if ($existing.Status -ne 'Stopped') {
        Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    sc.exe delete $serviceName | Out-Null
    Start-Sleep -Seconds 2
}

# Run the node service installer
& $nodeExe $installer $InstallDir
if ($LASTEXITCODE -ne 0) { throw "Connector service installer exited with code $LASTEXITCODE" }

# Wait briefly for service registration and status check
Start-Sleep -Seconds 2
$svc = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($svc) {
    Write-Host "[o] Windows Service $serviceName status: $($svc.Status)"
} else {
    Write-Warning "[!] Windows Service $serviceName was not registered successfully."
}