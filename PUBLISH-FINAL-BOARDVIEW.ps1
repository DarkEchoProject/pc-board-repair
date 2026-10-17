$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ReportDir = Join-Path $RepoRoot '_IMPORT_REPORT'
$Manifest = Join-Path $ReportDir 'final-boardview-upload-batch-01.csv'
$BoardsLarge = Join-Path $RepoRoot 'public\data\boards-large.json'
$AcceptedStatuses = @('UPLOADED','ALREADY_UPLOADED')
$ExpectedPlanned = 260

function Read-JsonArray([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return }
    $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($text)) { return }
    $parsed = ConvertFrom-Json -InputObject $text
    foreach ($item in $parsed) { Write-Output $item }
}

function Get-BoardType([string]$Name) {
    $ext = [IO.Path]::GetExtension($Name).ToLowerInvariant()
    if ($ext -eq '.brd') { return 'BoardView BRD' }
    if ($ext -eq '.fz') { return 'BoardView FZ' }
    if ($ext -eq '.bdv') { return 'BoardView BDV' }
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
Write-Host ' PC Board Repair - Publish FINAL BoardView batch' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path -LiteralPath $Manifest -PathType Leaf)) { throw "Final upload manifest not found: $Manifest" }
if (-not (Test-Path -LiteralPath $BoardsLarge -PathType Leaf)) { throw "boards-large.json not found: $BoardsLarge" }

$allRows = @(Import-Csv -LiteralPath $Manifest)
$accepted = @($allRows | Where-Object { [string]$_.UploadStatus -in $AcceptedStatuses })
$failed = @($allRows | Where-Object { [string]$_.UploadStatus -eq 'FAILED' })

Write-Host ("Manifest rows:       {0}" -f $allRows.Count)
Write-Host ("Uploaded/available:  {0}" -f $accepted.Count) -ForegroundColor Green
Write-Host ("Failed:              {0}" -f $failed.Count) -ForegroundColor $(if($failed.Count -eq 0){'Green'}else{'Red'})

if ($allRows.Count -ne $ExpectedPlanned) { throw "Safety stop: expected $ExpectedPlanned manifest rows, found $($allRows.Count)." }
if ($failed.Count -gt 0) { throw "Safety stop: $($failed.Count) upload(s) failed. Recover them before publishing." }
if ($accepted.Count -ne $ExpectedPlanned) { throw "Safety stop: expected $ExpectedPlanned successful uploads, found $($accepted.Count)." }

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
        note = 'Final cleaned BoardView file hosted on GitHub Releases'
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

$answer = Read-Host 'Publish the FINAL BoardView batch to the site database now? Type Y'
if ($answer.ToUpperInvariant() -ne 'Y') {
    Write-Host 'Stopped. Nothing changed.' -ForegroundColor Yellow
    exit 0
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $ReportDir "boards-large-before-final-boardview-$stamp.json"
Copy-Item -LiteralPath $BoardsLarge -Destination $backup -Force

$merged = New-Object System.Collections.ArrayList
foreach ($e in $existing) { [void]$merged.Add($e) }
foreach ($e in @($newEntries.ToArray())) { [void]$merged.Add($e) }

$json = @($merged.ToArray()) | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($BoardsLarge, $json, (New-Object Text.UTF8Encoding($false)))

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
    } else {
        git commit -m "Publish final BoardView batch"
        if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }
        git push origin main
        if ($LASTEXITCODE -ne 0) { throw 'git push failed' }
        Write-Host 'Final BoardView database commit pushed to GitHub.' -ForegroundColor Green
    }
}
finally { Pop-Location }

Write-Host ''
Write-Host 'FINAL BOARDVIEW DATABASE STEP FINISHED.' -ForegroundColor Green
Write-Host ("Successful manifest files registered: {0}" -f $accepted.Count) -ForegroundColor Green
Write-Host ("New database entries added:           {0}" -f $newEntries.Count) -ForegroundColor Green
Write-Host ("Backup: $backup") -ForegroundColor DarkGray
