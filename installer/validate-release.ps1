$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$runtime = Join-Path $PSScriptRoot 'runtime\node.exe'
$required = @(
    (Join-Path $PSScriptRoot 'OnlineSCADA-Factory-Connector.iss'),
    (Join-Path $root 'edge-gateway\src\service-entry.js'),
    (Join-Path $root 'edge-gateway\src\serviceRuntime.js'),
    (Join-Path $root 'edge-gateway\src\index.js'),
    (Join-Path $root 'edge-gateway\package.json')
)

foreach ($path in $required) {
    if (-not (Test-Path $path)) { throw "Required release file is missing: $path" }
}

if (-not (Test-Path $runtime)) {
    throw "Approved runtime is missing: $runtime"
}

$nodeVersion = & $runtime --version
if ($LASTEXITCODE -ne 0) { throw "Bundled runtime did not execute successfully." }

Write-Host "[+] Release input validation passed. Bundled runtime: $nodeVersion"
Write-Host "[i] Compile with installer\build-installer.bat on a Windows machine with Inno Setup 6."
