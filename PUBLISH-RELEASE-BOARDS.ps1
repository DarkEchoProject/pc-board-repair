$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ReportDir = Join-Path $RepoRoot '_IMPORT_REPORT'
$BoardsLarge = Join-Path $RepoRoot 'public\data\boards-large.json'
$AcceptedStatuses = @('UPLOADED','UPLOADED_AFTER_CLIENT_ERROR','ALREADY_UPLOADED')
$ExpectedBatches = 1..7
$ExpectedPlanned = 2216

function Read-JsonArray([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
    $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($text)) { return }
    $parsed = ConvertFrom-Json -InputObject $text
    # Windows PowerShell 5.1 can preserve a top-level JSON array as one pipeline object.
    # Explicit foreach enumeration makes each JSON item a separate PowerShell output object.
    foreach ($item in $parsed) { Write-Output $item }
}

function Get-BoardType([string]$Name) {
    $ext = [IO.Path]::GetExtension($Name).ToLowerInvariant()
    if ($ext -eq '.brd') { return 'BoardView BRD' }
    if ($ext -eq '.fz') { return 'BoardView FZ' }
    return 'BoardView archive'
}

function Get-DisplayName([string]$OriginalFile) {
    $name = [IO.Path]::GetFileNameWithoutExtension($OriginalFile)
    $name = $name -replace '(?i)\s*\((bdv|brd|fz|cad|boardview)\)\s*',' '
    $name = $name -replace '_',' '
    $name = $name -replace '\s+',' '
    return $name.Trim()
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ' PC Board Repair - Publish uploaded BoardView batches' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path -LiteralPath $ReportDir -PathType Container)) {
    throw "Import report folder not found: $ReportDir"
}
if (-not (Test-Path -LiteralPath $BoardsLarge -PathType Leaf)) {
    throw "boards-large.json not found: $BoardsLarge"
}

$manifestRows = New-Object System.Collections.ArrayList
$missing = New-Object System.Collections.ArrayList
foreach ($batch in $ExpectedBatches) {
    $path = Join-Path $ReportDir ('release-upload-batch-{0:D2}.csv' -f $batch)
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        [void]$missing.Add($path)
        continue
    }
    foreach ($row in @(Import-Csv -LiteralPath $path)) {
        [void]$manifestRows.Add($row)
    }
}

if ($missing.Count -gt 0) {
    Write-Host 'STOP: one or more batch manifests are missing:' -ForegroundColor Red
    $missing | ForEach-Object { Write-Host "  $_" -ForegroundColor Yellow }
    exit 1
}

$allRows = @($manifestRows.ToArray())
$accepted = @($allRows | Where-Object { [string]$_.UploadStatus -in $AcceptedStatuses })
$skipped = @($allRows | Where-Object { [string]$_.UploadStatus -like 'SKIPPED*' })

Write-Host ("Manifest rows:       {0}" -f $allRows.Count)
Write-Host ("Uploaded/available:  {0}" -f $accepted.Count) -ForegroundColor Green
Write-Host ("Skipped failures:    {0}" -f $skipped.Count) -ForegroundColor Yellow
if ($allRows.Count -ne $ExpectedPlanned) {
    Write-Host ("WARNING: expected {0} planned rows, found {1}." -f $ExpectedPlanned,$allRows.Count) -ForegroundColor Yellow
}

foreach ($r in $accepted) {
    if ([string]::IsNullOrWhiteSpace([string]$r.AssetName)) { throw "Accepted row has no AssetName: $($r.OriginalFile)" }
    if ([string]::IsNullOrWhiteSpace([string]$r.DownloadURL)) { throw "Accepted row has no DownloadURL: $($r.OriginalFile)" }
    if ([string]::IsNullOrWhiteSpace([string]$r.SHA256)) { throw "Accepted row has no SHA256: $($r.OriginalFile)" }
}

$existing = @(Read-JsonArray $BoardsLarge)
$existingBySha = @{}
$existingByUrl = @{}
$existingByFile = @{}
foreach ($e in $existing) {
    $sha = ([string]$e.sha256).ToLowerInvariant()
    $url = ([string]$e.download_url).ToLowerInvariant()
    $file = ([string]$e.file).ToLowerInvariant()
    if ($sha) { $existingBySha[$sha] = $true }
    if ($url) { $existingByUrl[$url] = $true }
    if ($file) { $existingByFile[$file] = $true }
}

$newEntries = New-Object System.Collections.ArrayList
$seenSha = @{}
$seenUrl = @{}
$duplicates = 0
foreach ($r in $accepted) {
    $sha = ([string]$r.SHA256).ToLowerInvariant()
    $url = ([string]$r.DownloadURL).Trim()
    $urlKey = $url.ToLowerInvariant()
    $file = ([string]$r.AssetName).Trim()
    $fileKey = $file.ToLowerInvariant()

    if ($existingBySha.ContainsKey($sha) -or $existingByUrl.ContainsKey($urlKey) -or $existingByFile.ContainsKey($fileKey) -or $seenSha.ContainsKey($sha) -or $seenUrl.ContainsKey($urlKey)) {
        $duplicates++
        continue
    }

    $uploadedAt = ([string]$r.UploadedAtUTC).Trim()
    if ([string]::IsNullOrWhiteSpace($uploadedAt)) { $uploadedAt = [DateTime]::UtcNow.ToString('o') }
    $brand = ([string]$r.Brand).Trim()
    if ([string]::IsNullOrWhiteSpace($brand)) { $brand = 'Other' }
    $original = ([string]$r.OriginalFile).Trim()

    $entry = [ordered]@{
        brand = $brand
        model = (Get-DisplayName $original)
        board = ''
        revision = ''
        platform = ''
        type = (Get-BoardType $original)
        file = $file
        image = ''
        note = 'Cleaned BoardView file hosted on GitHub Releases'
        aliases = $original
        storage = 'github-release'
        download_url = $url
        size_bytes = [int64]$r.SizeBytes
        sha256 = $sha
        cleaned = $true
        verified = $true
        added_at = $uploadedAt
    }
    [void]$newEntries.Add([pscustomobject]$entry)
    $seenSha[$sha] = $true
    $seenUrl[$urlKey] = $true
}

Write-Host ("Existing release entries: {0}" -f $existing.Count) -ForegroundColor Cyan
Write-Host ("Already registered:       {0}" -f $duplicates) -ForegroundColor Yellow
Write-Host ("New entries to publish:   {0}" -f $newEntries.Count) -ForegroundColor Green
Write-Host ("Final boards-large count: {0}" -f ($existing.Count + $newEntries.Count)) -ForegroundColor Cyan
Write-Host ''

$answer = Read-Host 'Publish these successful uploads to the site database now? Type Y'
if ($answer.ToUpperInvariant() -ne 'Y') {
    Write-Host 'Stopped. Nothing changed.' -ForegroundColor Yellow
    exit 0
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $ReportDir "boards-large-before-release-publish-$stamp.json"
Copy-Item -LiteralPath $BoardsLarge -Destination $backup -Force

$merged = New-Object System.Collections.ArrayList
foreach ($e in $existing) { [void]$merged.Add($e) }
foreach ($e in @($newEntries.ToArray())) { [void]$merged.Add($e) }

$json = @($merged.ToArray()) | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($BoardsLarge, $json, (New-Object Text.UTF8Encoding($false)))

# Parse the written JSON again before committing it.
$check = @(Read-JsonArray $BoardsLarge)
if ($check.Count -ne ($existing.Count + $newEntries.Count)) {
    Copy-Item -LiteralPath $backup -Destination $BoardsLarge -Force
    throw "JSON verification failed. Backup restored. Expected $($existing.Count + $newEntries.Count), parsed $($check.Count)."
}

Push-Location $RepoRoot
try {
    git add -- 'public/data/boards-large.json'
    if ($LASTEXITCODE -ne 0) { throw 'git add failed' }

    $staged = @(git diff --cached --name-only)
    if ($staged.Count -eq 0) {
        Write-Host 'No new database changes needed.' -ForegroundColor Green
    }
    else {
        git commit -m "Publish cleaned BoardView release batches"
        if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }
        git push origin main
        if ($LASTEXITCODE -ne 0) { throw 'git push failed' }
        Write-Host 'Site database commit pushed to GitHub.' -ForegroundColor Green
    }
}
finally { Pop-Location }

Write-Host ''
Write-Host 'PUBLISH DATABASE STEP FINISHED.' -ForegroundColor Green
Write-Host ("Successful manifest files registered: {0}" -f $accepted.Count) -ForegroundColor Green
Write-Host ("Skipped manifest failures excluded:    {0}" -f $skipped.Count) -ForegroundColor Yellow
Write-Host ("Backup: $backup") -ForegroundColor DarkGray
