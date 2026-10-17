$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ReportDir = Join-Path $RepoRoot '_IMPORT_REPORT'
$Manifest = Join-Path $ReportDir 'release-upload-recovery-large-01.csv'
$BoardsLarge = Join-Path $RepoRoot 'public\data\boards-large.json'
$AcceptedStatuses = @('UPLOADED','ALREADY_UPLOADED','UPLOADED_AFTER_CLIENT_ERROR')

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
Write-Host ' PC Board Repair - Publish recovery + large files' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''

if (-not (Test-Path -LiteralPath $Manifest -PathType Leaf)) { throw "Recovery manifest not found: $Manifest" }
if (-not (Test-Path -LiteralPath $BoardsLarge -PathType Leaf)) { throw "boards-large.json not found: $BoardsLarge" }

$rows = @(Import-Csv -LiteralPath $Manifest)
$accepted = @($rows | Where-Object { [string]$_.UploadStatus -in $AcceptedStatuses })
$failed = @($rows | Where-Object { [string]$_.UploadStatus -notin $AcceptedStatuses })

Write-Host ("Recovery manifest rows: {0}" -f $rows.Count)
Write-Host ("Uploaded/available:     {0}" -f $accepted.Count) -ForegroundColor Green
Write-Host ("Failed/not accepted:    {0}" -f $failed.Count) -ForegroundColor $(if($failed.Count -eq 0){'Green'}else{'Yellow'})

if ($accepted.Count -eq 0) { throw 'No successful recovery uploads found.' }
foreach ($r in $accepted) {
    if ([string]::IsNullOrWhiteSpace([string]$r.AssetName)) { throw "Accepted row has no AssetName: $($r.OriginalFile)" }
    if ([string]::IsNullOrWhiteSpace([string]$r.DownloadURL)) { throw "Accepted row has no DownloadURL: $($r.OriginalFile)" }
    if ([string]::IsNullOrWhiteSpace([string]$r.SHA256)) { throw "Accepted row has no SHA256: $($r.OriginalFile)" }
}

$existing = @(Read-JsonArray $BoardsLarge)
$bySha = @{}
$byUrl = @{}
$byFile = @{}
foreach ($e in $existing) {
    $sha = ([string]$e.sha256).ToLowerInvariant()
    $url = ([string]$e.download_url).ToLowerInvariant()
    $file = ([string]$e.file).ToLowerInvariant()
    if ($sha) { $bySha[$sha] = $true }
    if ($url) { $byUrl[$url] = $true }
    if ($file) { $byFile[$file] = $true }
}

$newEntries = New-Object System.Collections.ArrayList
$duplicates = 0
foreach ($r in $accepted) {
    $sha = ([string]$r.SHA256).Trim().ToLowerInvariant()
    $url = ([string]$r.DownloadURL).Trim()
    $file = ([string]$r.AssetName).Trim()
    if ($bySha.ContainsKey($sha) -or $byUrl.ContainsKey($url.ToLowerInvariant()) -or $byFile.ContainsKey($file.ToLowerInvariant())) {
        $duplicates++
        continue
    }

    $brand = ([string]$r.Brand).Trim()
    if ([string]::IsNullOrWhiteSpace($brand)) { $brand = 'Other' }
    $original = ([string]$r.OriginalFile).Trim()
    $uploadedAt = ([string]$r.UploadedAtUTC).Trim()
    if ([string]::IsNullOrWhiteSpace($uploadedAt)) { $uploadedAt = [DateTime]::UtcNow.ToString('o') }

    $entry = [ordered]@{
        brand = $brand
        model = (Get-DisplayName $original)
        board = ''
        revision = ''
        platform = ''
        type = (Get-BoardType $original)
        file = $file
        image = ''
        note = 'Recovered or large cleaned BoardView file hosted on GitHub Releases'
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
    $bySha[$sha] = $true
    $byUrl[$url.ToLowerInvariant()] = $true
    $byFile[$file.ToLowerInvariant()] = $true
}

Write-Host ("Already registered:      {0}" -f $duplicates) -ForegroundColor Yellow
Write-Host ("New entries to publish: {0}" -f $newEntries.Count) -ForegroundColor Green
Write-Host ("Final large DB count:    {0}" -f ($existing.Count + $newEntries.Count)) -ForegroundColor Cyan
Write-Host ''

if ($newEntries.Count -eq 0) {
    Write-Host 'All recovery files are already registered. Nothing to change.' -ForegroundColor Green
    exit 0
}

$answer = Read-Host 'Publish these recovery files to the site database now? Type Y'
if ($answer.ToUpperInvariant() -ne 'Y') { Write-Host 'Stopped. Nothing changed.' -ForegroundColor Yellow; exit 0 }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $ReportDir "boards-large-before-recovery-publish-$stamp.json"
Copy-Item -LiteralPath $BoardsLarge -Destination $backup -Force

$merged = New-Object System.Collections.ArrayList
foreach ($e in $existing) { [void]$merged.Add($e) }
foreach ($e in @($newEntries.ToArray())) { [void]$merged.Add($e) }

$json = @($merged.ToArray()) | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($BoardsLarge, $json, (New-Object Text.UTF8Encoding($false)))

$check = @(Read-JsonArray $BoardsLarge)
$expected = $existing.Count + $newEntries.Count
if ($check.Count -ne $expected) {
    Copy-Item -LiteralPath $backup -Destination $BoardsLarge -Force
    throw "JSON verification failed. Backup restored. Expected $expected, parsed $($check.Count)."
}

Push-Location $RepoRoot
try {
    git add -- 'public/data/boards-large.json'
    if ($LASTEXITCODE -ne 0) { throw 'git add failed' }
    $staged = @(git diff --cached --name-only)
    if ($staged.Count -gt 0) {
        git commit -m "Publish recovered and large BoardView files"
        if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }
        git push origin main
        if ($LASTEXITCODE -ne 0) { throw 'git push failed' }
        Write-Host 'Recovery database commit pushed to GitHub.' -ForegroundColor Green
    } else {
        Write-Host 'No database change needed.' -ForegroundColor Green
    }
}
finally { Pop-Location }

Write-Host ''
Write-Host 'RECOVERY DATABASE PUBLISH FINISHED.' -ForegroundColor Green
Write-Host ("New files registered: {0}" -f $newEntries.Count) -ForegroundColor Green
Write-Host ("Backup: $backup") -ForegroundColor DarkGray
