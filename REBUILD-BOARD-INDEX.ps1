$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BoardsJson = Join-Path $RepoRoot 'public\data\boards.json'
$DownloadsDir = Join-Path $RepoRoot 'public\downloads'
$ReportDir = Join-Path $RepoRoot '_IMPORT_REPORT'
$OldCommit = '1f59a21c295a32175ed15cd18bacea8a745be5f4'

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Normalize-Boards($Data) {
    $result = @()

    foreach ($item in @($Data)) {
        if ($null -eq $item) { continue }

        if ($null -ne $item.value) {
            foreach ($inner in @($item.value)) {
                if ($null -ne $inner -and
                    $null -ne $inner.brand -and
                    $null -ne $inner.file -and
                    -not [string]::IsNullOrWhiteSpace([string]$inner.file)) {
                    $result += $inner
                }
            }
        }
        elseif ($null -ne $item.brand -and
                $null -ne $item.file -and
                -not [string]::IsNullOrWhiteSpace([string]$item.file)) {
            $result += $item
        }
    }

    return $result
}

Write-Host ''
Write-Host '===================================================' -ForegroundColor Cyan
Write-Host ' PC Board Repair - Restore + Merge BoardView Index' -ForegroundColor Cyan
Write-Host '===================================================' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path -LiteralPath $BoardsJson)) {
    throw "boards.json not found: $BoardsJson"
}

Push-Location $RepoRoot
try {
    $oldLines = @(git show "$OldCommit`:public/data/boards.json")
    if ($LASTEXITCODE -ne 0 -or $oldLines.Count -eq 0) {
        throw "Could not read old boards.json from commit $OldCommit"
    }
}
finally {
    Pop-Location
}

$oldText = $oldLines -join "`n"
$currentText = Get-Content -LiteralPath $BoardsJson -Raw -Encoding UTF8

$oldData = $oldText | ConvertFrom-Json
$currentData = $currentText | ConvertFrom-Json

$oldItems = @(Normalize-Boards $oldData)
$currentItems = @(Normalize-Boards $currentData)

Write-Host ('Old index entries     : {0}' -f $oldItems.Count)
Write-Host ('Current index entries : {0}' -f $currentItems.Count)

if ($oldItems.Count -lt 800) {
    throw "Safety stop: old index count is unexpectedly low ($($oldItems.Count))."
}

if ($currentItems.Count -lt 300) {
    throw "Safety stop: current index count is unexpectedly low ($($currentItems.Count))."
}

# Keep all old entries, then let the current entry replace an old one
# only when both point to the exact same archive filename.
$map = [ordered]@{}

foreach ($item in $oldItems) {
    $key = ([string]$item.file).ToLowerInvariant()
    $map[$key] = $item
}

foreach ($item in $currentItems) {
    $key = ([string]$item.file).ToLowerInvariant()
    $map[$key] = $item
}

$merged = @($map.Values)

Write-Host ('Merged unique entries : {0}' -f $merged.Count) -ForegroundColor Green

if ($merged.Count -lt 1000) {
    throw "Safety stop: merged index is unexpectedly below 1000 entries ($($merged.Count))."
}

# Check that the indexed download files still exist locally.
$missing = @()
foreach ($item in $merged) {
    $fileName = [string]$item.file
    if ([string]::IsNullOrWhiteSpace($fileName)) { continue }

    $p = Join-Path $DownloadsDir $fileName
    if (-not (Test-Path -LiteralPath $p -PathType Leaf)) {
        $missing += $fileName
    }
}

Write-Host ('Missing local archives: {0}' -f $missing.Count) -ForegroundColor $(if ($missing.Count -eq 0) { 'Green' } else { 'Yellow' })

if ($missing.Count -gt 0) {
    $missingPath = Join-Path $ReportDir 'missing-after-index-merge.txt'
    $missing | Set-Content -LiteralPath $missingPath -Encoding UTF8
    Write-Host ('Missing-file report   : {0}' -f $missingPath) -ForegroundColor Yellow
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $ReportDir ("boards-before-merge-$stamp.json")
Copy-Item -LiteralPath $BoardsJson -Destination $backupPath -Force

$merged |
    ConvertTo-Json -Depth 8 |
    Set-Content -LiteralPath $BoardsJson -Encoding UTF8

Write-Host ''
Write-Host 'DONE: boards.json was rebuilt and merged.' -ForegroundColor Green
Write-Host ('Backup saved at       : {0}' -f $backupPath)
Write-Host ''
Write-Host 'Do NOT push yet. Send me the three counts above first.' -ForegroundColor Yellow
Write-Host ''
Read-Host 'Press Enter to close'
