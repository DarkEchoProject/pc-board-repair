$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Builder = Join-Path $RepoRoot 'scripts\build-sitemap.mjs'

if (-not (Test-Path -LiteralPath $Builder -PathType Leaf)) {
    Write-Host '[FAIL] Missing scripts\build-sitemap.mjs' -ForegroundColor Red
    exit 1
}

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host '[FAIL] Node.js was not found' -ForegroundColor Red
    exit 1
}

Write-Host 'Sitemap builder: node-v1' -ForegroundColor DarkGray
& node.exe $Builder
if ($LASTEXITCODE -ne 0) {
    Write-Host '[FAIL] Node sitemap builder failed' -ForegroundColor Red
    exit $LASTEXITCODE
}

exit 0
