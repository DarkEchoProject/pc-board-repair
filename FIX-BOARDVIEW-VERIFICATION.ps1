$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BoardsLarge = Join-Path $RepoRoot 'public\data\boards-large.json'
$ReportDir = Join-Path $RepoRoot '_IMPORT_REPORT'

function Read-JsonArray([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return @() }
    $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($text)) { return @() }
    $parsed = ConvertFrom-Json -InputObject $text
    $out = New-Object System.Collections.ArrayList
    foreach ($item in @($parsed)) { if ($null -ne $item) { [void]$out.Add($item) } }
    return @($out.ToArray())
}

function Is-AutomatedReleaseBoard($e) {
    $storage = ([string]$e.storage).Trim().ToLowerInvariant()
    $note = ([string]$e.note).Trim()
    if ($storage -ne 'github-release') { return $false }
    if ($note -match '(?i)cleaned\s+BoardView.*GitHub\s+Releases') { return $true }
    if ($note -match '(?i)Recovered\s+or\s+large\s+cleaned\s+BoardView') { return $true }
    if ($note -match '(?i)Final\s+cleaned\s+BoardView') { return $true }
    return $false
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ' PC Board Repair - Verification status correction' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host 'Automated cleaned/release BoardView files will be marked' -ForegroundColor Yellow
Write-Host 'UNVERIFIED. Cleaning/hash checks do not mean the board file' -ForegroundColor Yellow
Write-Host 'was electrically or visually verified against real hardware.' -ForegroundColor Yellow
Write-Host ''

if (-not (Test-Path -LiteralPath $BoardsLarge -PathType Leaf)) { throw "boards-large.json not found: $BoardsLarge" }
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$entries = @(Read-JsonArray $BoardsLarge)
if ($entries.Count -lt 1) { throw 'No entries parsed from boards-large.json.' }

$candidates = @($entries | Where-Object { Is-AutomatedReleaseBoard $_ })
$toChange = @($candidates | Where-Object {
    $p = $_.PSObject.Properties['verified']
    $null -ne $p -and ($_.verified -eq $true -or [string]$_.verified -eq 'True' -or [string]$_.verified -eq '1')
})
$alreadyUnverified = @($candidates | Where-Object {
    $p = $_.PSObject.Properties['verified']
    $null -eq $p -or -not ($_.verified -eq $true -or [string]$_.verified -eq 'True' -or [string]$_.verified -eq '1')
})

Write-Host ("Total boards-large entries:        {0}" -f $entries.Count)
Write-Host ("Automated release BoardViews:      {0}" -f $candidates.Count) -ForegroundColor Cyan
Write-Host ("Currently marked verified:         {0}" -f $toChange.Count) -ForegroundColor Yellow
Write-Host ("Already unverified/not specified:  {0}" -f $alreadyUnverified.Count) -ForegroundColor Green
Write-Host ''

if ($toChange.Count -eq 0) {
    Write-Host 'Nothing needs changing.' -ForegroundColor Green
    exit 0
}

$answer = Read-Host "Mark ONLY these $($toChange.Count) automated release BoardView entries as unverified? Type Y"
if ($answer.ToUpperInvariant() -ne 'Y') { Write-Host 'Stopped. Nothing changed.' -ForegroundColor Yellow; exit 0 }

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $ReportDir "boards-large-before-unverified-fix-$stamp.json"
Copy-Item -LiteralPath $BoardsLarge -Destination $backup -Force

foreach ($e in $entries) {
    if (-not (Is-AutomatedReleaseBoard $e)) { continue }
    if ($null -eq $e.PSObject.Properties['verified']) {
        $e | Add-Member -NotePropertyName verified -NotePropertyValue $false
    } else {
        $e.verified = $false
    }
}

$json = @($entries) | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($BoardsLarge, $json, (New-Object Text.UTF8Encoding($false)))

$check = @(Read-JsonArray $BoardsLarge)
if ($check.Count -ne $entries.Count) {
    Copy-Item -LiteralPath $backup -Destination $BoardsLarge -Force
    throw "JSON verification failed. Backup restored. Expected $($entries.Count), parsed $($check.Count)."
}
$remainingVerified = @($check | Where-Object { Is-AutomatedReleaseBoard $_ } | Where-Object {
    $_.verified -eq $true -or [string]$_.verified -eq 'True' -or [string]$_.verified -eq '1'
}).Count
if ($remainingVerified -ne 0) {
    Copy-Item -LiteralPath $backup -Destination $BoardsLarge -Force
    throw "Verification correction failed. Backup restored. $remainingVerified automated entries still show verified=true."
}

Push-Location $RepoRoot
try {
    git add -- 'public/data/boards-large.json'
    if ($LASTEXITCODE -ne 0) { throw 'git add failed' }
    $staged = @(git diff --cached --name-only)
    if ($staged.Count -gt 0) {
        git commit -m 'Mark automated BoardView release files unverified'
        if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }
        git push origin main
        if ($LASTEXITCODE -ne 0) { throw 'git push failed' }
    }
}
finally { Pop-Location }

Write-Host ''
Write-Host 'DONE.' -ForegroundColor Green
Write-Host ("Changed to unverified: {0}" -f $toChange.Count) -ForegroundColor Green
Write-Host ("Backup: {0}" -f $backup) -ForegroundColor DarkGray
Write-Host 'Run DEPLOY-SITE.cmd to publish the corrected status.' -ForegroundColor Cyan
