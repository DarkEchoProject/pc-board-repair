param(
    [int]$BatchNumber = 1,
    [int]$BatchLimitMB = 250
)

$ErrorActionPreference = 'Stop'
$Repo = 'DarkEchoProject/pc-board-repair'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Tag = 'boardview-cleaned-250mb-{0:D2}' -f $BatchNumber
$Title = 'BoardView Cleaned Batch {0:D2}' -f $BatchNumber

function Get-PublishedRelease([string]$TagName) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $raw = & gh api "repos/$Repo/releases/tags/$TagName" 2>$null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $old
    if ($code -ne 0) { return $null }
    return (($raw -join "`n") | ConvertFrom-Json)
}

function Get-AnyRelease([string]$TagName) {
    $published = Get-PublishedRelease $TagName
    if ($null -ne $published) { return $published }

    $page = 1
    while ($true) {
        $old = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        $raw = & gh api "repos/$Repo/releases?per_page=100&page=$page" 2>$null
        $code = $LASTEXITCODE
        $ErrorActionPreference = $old
        if ($code -ne 0) { return $null }
        $arr = @(($raw -join "`n") | ConvertFrom-Json)
        $match = $arr | Where-Object { [string]$_.tag_name -eq $TagName } | Select-Object -First 1
        if ($null -ne $match) { return $match }
        if ($arr.Count -lt 100) { break }
        $page++
    }
    return $null
}

function Wait-PublishedRelease([string]$TagName) {
    for ($i = 1; $i -le 15; $i++) {
        $r = Get-PublishedRelease $TagName
        if ($null -ne $r) { return $r }
        Start-Sleep -Seconds 1
    }
    return $null
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    throw 'GitHub CLI (gh) is not available in PATH.'
}
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not logged in.' }

$release = Get-AnyRelease $Tag
if ($null -ne $release -and [bool]$release.draft) {
    Write-Host "Found existing draft release $Tag (id $($release.id)). Publishing it so asset upload by tag works reliably..." -ForegroundColor Yellow
    & gh api --method PATCH "repos/$Repo/releases/$($release.id)" -F draft=false -f tag_name="$Tag" -f target_commitish=main *> $null
    if ($LASTEXITCODE -ne 0) { throw "Could not publish existing draft release: $Tag" }
    $release = Wait-PublishedRelease $Tag
    if ($null -eq $release) { throw "Release was published but is not readable by tag yet: $Tag" }
}
elseif ($null -eq $release) {
    Write-Host "Creating published release $Tag ..." -ForegroundColor Cyan
    & gh release create $Tag --repo $Repo --target main --title $Title --notes "PC Board Repair cleaned BoardView files. This release is one upload batch capped at $BatchLimitMB MB." --latest=false
    if ($LASTEXITCODE -ne 0) { throw "Could not create release: $Tag" }
    $release = Wait-PublishedRelease $Tag
    if ($null -eq $release) { throw "Release was created but is not readable by tag yet: $Tag" }
}
else {
    Write-Host "Release $Tag is ready." -ForegroundColor Green
}

Write-Host "Release preflight OK: $Tag" -ForegroundColor Green
Write-Host ''

& (Join-Path $RepoRoot 'UPLOAD-CLEANED-250MB.ps1') -BatchNumber $BatchNumber -BatchLimitMB $BatchLimitMB
