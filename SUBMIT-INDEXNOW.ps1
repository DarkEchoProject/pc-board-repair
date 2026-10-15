$ErrorActionPreference = 'Stop'

$Site = 'https://pc-board-repair.alinasser00001.workers.dev'
$HostName = 'pc-board-repair.alinasser00001.workers.dev'
$Key = '42670790-e807-440c-ad00-45ab0767a5ad'
$KeyLocation = "$Site/$Key.txt"
$IndexNowEndpoint = 'https://api.indexnow.org/indexnow'

function Get-LiveSitemapUrls {
    $stamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
    $response = Invoke-WebRequest -UseBasicParsing -Uri "$Site/sitemap.xml?indexnow=$stamp" -Headers @{ 'Cache-Control' = 'no-cache' }
    if ($response.StatusCode -ne 200) {
        throw "Could not read live sitemap. HTTP $($response.StatusCode)"
    }

    $matches = [regex]::Matches($response.Content, '<loc>(.*?)</loc>', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    $urls = foreach ($match in $matches) {
        [System.Net.WebUtility]::HtmlDecode($match.Groups[1].Value.Trim())
    }
    return @($urls | Where-Object { $_ -like "$Site*" } | Select-Object -Unique)
}

function Submit-IndexNowBatch([string[]]$Urls) {
    if (-not $Urls -or $Urls.Count -eq 0) { return }

    $payload = @{
        host        = $HostName
        key         = $Key
        keyLocation = $KeyLocation
        urlList     = @($Urls)
    } | ConvertTo-Json -Depth 4 -Compress

    $response = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $IndexNowEndpoint -ContentType 'application/json; charset=utf-8' -Body $payload
    if ($response.StatusCode -notin 200, 202) {
        throw "IndexNow returned HTTP $($response.StatusCode)"
    }
    Write-Host "IndexNow accepted $($Urls.Count) URL(s). HTTP $($response.StatusCode)."
}

$currentCommit = (& git rev-parse HEAD 2>$null).Trim()
if (-not $currentCommit) {
    throw 'Could not read the current Git commit.'
}

$stateRoot = if ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA 'PCBoardRepair' } else { Join-Path $env:TEMP 'PCBoardRepair' }
$stateFile = Join-Path $stateRoot 'indexnow-last-commit.txt'
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null

$lastCommit = ''
if (Test-Path $stateFile) {
    $lastCommit = (Get-Content $stateFile -Raw).Trim()
}

if ($lastCommit -eq $currentCommit) {
    Write-Host 'IndexNow: this commit was already submitted. Nothing to send.'
    exit 0
}

$submitAll = $false
$changedFiles = @()

if (-not $lastCommit) {
    $submitAll = $true
    Write-Host 'IndexNow: first run on this computer; submitting the full sitemap once.'
} else {
    & git cat-file -e "$lastCommit^{commit}" 2>$null
    if ($LASTEXITCODE -ne 0) {
        $submitAll = $true
        Write-Host 'IndexNow: previous deploy commit is unavailable; submitting the full sitemap.'
    } else {
        $changedFiles = @(& git diff --name-only "$lastCommit..$currentCommit")
        $globalBoardFiles = @(
            'src/index.js',
            'src/app.js',
            'public/data/boards.json',
            'public/data/boards-large.json',
            'public/auth-ui.js'
        )
        if ($changedFiles | Where-Object { $_ -in $globalBoardFiles }) {
            $submitAll = $true
            Write-Host 'IndexNow: BoardView/search content changed; submitting the full sitemap.'
        }
    }
}

$urlsToSubmit = @()
if ($submitAll) {
    $urlsToSubmit = Get-LiveSitemapUrls
} else {
    foreach ($file in $changedFiles) {
        if ($file -eq 'public/index.html') {
            $urlsToSubmit += "$Site/"
            continue
        }
        if ($file -match '^public/(.+\.html)$') {
            $relative = $Matches[1] -replace '\\', '/'
            $urlsToSubmit += "$Site/$relative"
        }
    }

    if ($changedFiles -contains 'public/boardview/index.html') {
        $urlsToSubmit += "$Site/boardview/index.html"
    }
    $urlsToSubmit = @($urlsToSubmit | Select-Object -Unique)
}

if ($urlsToSubmit.Count -eq 0) {
    Write-Host 'IndexNow: no indexable page URLs changed; no submission needed.'
    Set-Content -Path $stateFile -Value $currentCommit -Encoding ASCII
    exit 0
}

$batchSize = 5000
for ($start = 0; $start -lt $urlsToSubmit.Count; $start += $batchSize) {
    $end = [Math]::Min($start + $batchSize - 1, $urlsToSubmit.Count - 1)
    $batch = @($urlsToSubmit[$start..$end])
    Submit-IndexNowBatch $batch
}

Set-Content -Path $stateFile -Value $currentCommit -Encoding ASCII
Write-Host "IndexNow submission complete. Total: $($urlsToSubmit.Count) URL(s)."
