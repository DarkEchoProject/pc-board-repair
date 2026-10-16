param(
    [string]$CleanedPath = 'C:\Users\ALFA\Downloads\Telegram Desktop\_CLEANED',
    [string]$AuditPath = '',
    [int]$BatchNumber = 1,
    [int]$BatchLimitMB = 250,
    [switch]$PreviewOnly
)

$ErrorActionPreference = 'Stop'
$Repo = 'DarkEchoProject/pc-board-repair'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ReportDir = Join-Path $RepoRoot '_IMPORT_REPORT'
if ([string]::IsNullOrWhiteSpace($AuditPath)) { $AuditPath = Join-Path $ReportDir 'cleaned-audit-latest.csv' }
$BatchLimitBytes = [int64]$BatchLimitMB * 1MB

function Get-SafeAssetName([string]$Original,[string]$Sha256) {
    $ext = [IO.Path]::GetExtension($Original).ToLowerInvariant()
    $base = [IO.Path]::GetFileNameWithoutExtension($Original)
    $base = $base -replace '[^A-Za-z0-9._+-]','-'
    $base = ($base -replace '-+','-').Trim([char[]]'-.')
    if ([string]::IsNullOrWhiteSpace($base)) { $base = 'boardview' }
    if ($base.Length -gt 120) { $base = $base.Substring(0,120).TrimEnd([char[]]'-.') }
    $short = $Sha256.Substring(0,10).ToLowerInvariant()
    return "$base-$short$ext"
}

function Get-ReleaseMeta([string]$Tag) {
    $old = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    $raw = & gh api "repos/$Repo/releases/tags/$Tag" 2>$null
    $code = $LASTEXITCODE
    $ErrorActionPreference = $old
    if ($code -ne 0) { return $null }
    return (($raw -join "`n") | ConvertFrom-Json)
}

function Get-ReleaseAssets([int64]$ReleaseId) {
    $all = New-Object System.Collections.ArrayList
    $page = 1
    while ($true) {
        $raw = & gh api "repos/$Repo/releases/$ReleaseId/assets?per_page=100&page=$page"
        if ($LASTEXITCODE -ne 0) { throw "Could not list release assets for release id $ReleaseId" }
        $arr = @(($raw -join "`n") | ConvertFrom-Json)
        foreach ($a in $arr) { [void]$all.Add($a) }
        if ($arr.Count -lt 100) { break }
        $page++
    }
    return @($all.ToArray())
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ' PC Board Repair - GitHub Release uploader (250 MB)' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host 'Only rows marked NEW_STANDARD are included.' -ForegroundColor Green
Write-Host 'Possible-name matches, conflicts, duplicates and NEW_LARGE are excluded.' -ForegroundColor Yellow
Write-Host ''

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI (gh) is not installed or not available in PATH.' }
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not logged in. Run: gh auth login' }
if (-not (Test-Path -LiteralPath $AuditPath -PathType Leaf)) { throw "Audit CSV not found: $AuditPath" }
if (-not (Test-Path -LiteralPath $CleanedPath -PathType Container)) { throw "CLEANED folder not found: $CleanedPath" }
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$rows = @(Import-Csv -LiteralPath $AuditPath | Where-Object Status -eq 'NEW_STANDARD')
if ($rows.Count -eq 0) { throw 'No NEW_STANDARD rows found in the audit report.' }

$items = New-Object System.Collections.ArrayList
foreach ($r in $rows) {
    $p = [string]$r.Path
    if (-not (Test-Path -LiteralPath $p -PathType Leaf)) {
        $p = Join-Path $CleanedPath ([string]$r.File)
    }
    if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { throw "Source file missing: $($r.File)" }
    $f = Get-Item -LiteralPath $p
    if ($f.Length -gt $BatchLimitBytes) { throw "A NEW_STANDARD file is larger than the configured batch cap: $($f.Name)" }
    [void]$items.Add([pscustomobject]@{
        OriginalFile = [string]$r.File
        Path = $f.FullName
        Brand = [string]$r.Brand
        SizeBytes = [int64]$f.Length
        SHA256 = ([string]$r.SHA256).ToLowerInvariant()
    })
}

$sorted = @($items.ToArray() | Sort-Object OriginalFile)
$batches = New-Object System.Collections.ArrayList
$current = New-Object System.Collections.ArrayList
[int64]$currentBytes = 0
foreach ($item in $sorted) {
    if ($current.Count -gt 0 -and ($currentBytes + $item.SizeBytes) -gt $BatchLimitBytes) {
        [void]$batches.Add([pscustomobject]@{ Items=@($current.ToArray()); Bytes=$currentBytes })
        $current = New-Object System.Collections.ArrayList
        $currentBytes = 0
    }
    [void]$current.Add($item)
    $currentBytes += $item.SizeBytes
}
if ($current.Count -gt 0) { [void]$batches.Add([pscustomobject]@{ Items=@($current.ToArray()); Bytes=$currentBytes }) }

$plan = New-Object System.Collections.ArrayList
for ($i=0; $i -lt $batches.Count; $i++) {
    $b = $batches[$i]
    foreach ($item in $b.Items) {
        $asset = Get-SafeAssetName $item.OriginalFile $item.SHA256
        [void]$plan.Add([pscustomobject]@{
            Batch=($i+1); Tag=('boardview-cleaned-250mb-{0:D2}' -f ($i+1)); OriginalFile=$item.OriginalFile;
            AssetName=$asset; Brand=$item.Brand; SizeBytes=$item.SizeBytes; SizeMB=[math]::Round($item.SizeBytes/1MB,2);
            SHA256=$item.SHA256; Source=$item.Path
        })
    }
}
$planPath = Join-Path $ReportDir 'release-batches-250mb-plan.csv'
$plan | Export-Csv -LiteralPath $planPath -NoTypeInformation -Encoding UTF8

Write-Host ("Eligible NEW_STANDARD files: {0}" -f $items.Count) -ForegroundColor Green
Write-Host ("Batch cap:                  {0} MB" -f $BatchLimitMB)
Write-Host ("Planned batches:            {0}" -f $batches.Count) -ForegroundColor Cyan
for ($i=0; $i -lt $batches.Count; $i++) {
    Write-Host ("  Batch {0,2}: {1,4} files / {2,7:N2} MB" -f ($i+1),$batches[$i].Items.Count,($batches[$i].Bytes/1MB))
}
Write-Host ("Plan: $planPath") -ForegroundColor DarkGray

if ($PreviewOnly) {
    Write-Host 'Preview only. Nothing uploaded.' -ForegroundColor Green
    exit 0
}
if ($BatchNumber -lt 1 -or $BatchNumber -gt $batches.Count) { throw "BatchNumber must be between 1 and $($batches.Count)." }

$selected = @($plan | Where-Object { [int]$_.Batch -eq $BatchNumber })
$batchBytes = ($selected | Measure-Object -Property SizeBytes -Sum).Sum
$tag = 'boardview-cleaned-250mb-{0:D2}' -f $BatchNumber
$title = 'BoardView Cleaned Batch {0:D2}' -f $BatchNumber
Write-Host ''
Write-Host ("Selected batch: {0}/{1}" -f $BatchNumber,$batches.Count) -ForegroundColor Cyan
Write-Host ("Files:          {0}" -f $selected.Count)
Write-Host ("Total:          {0:N2} MB" -f ($batchBytes/1MB))
Write-Host ("Release tag:    {0}" -f $tag)
Write-Host ''
$answer = Read-Host "Upload ONLY batch $BatchNumber now? Type Y"
if ($answer.ToUpperInvariant() -ne 'Y') { Write-Host 'Stopped. Nothing uploaded.' -ForegroundColor Yellow; exit 0 }

$release = Get-ReleaseMeta $tag
if ($null -eq $release) {
    Write-Host "Creating draft release $tag ..." -ForegroundColor Cyan
    & gh release create $tag --repo $Repo --target main --title $title --notes "PC Board Repair cleaned BoardView files. This release is one upload batch capped at $BatchLimitMB MB." --draft --latest=false
    if ($LASTEXITCODE -ne 0) { throw "Failed to create release $tag" }
    $release = Get-ReleaseMeta $tag
    if ($null -eq $release) { throw "Release was created but could not be read back: $tag" }
} else {
    Write-Host "Resuming existing release $tag ..." -ForegroundColor Yellow
}

$remoteAssets = @(Get-ReleaseAssets ([int64]$release.id))
$remoteByName = @{}
foreach ($a in $remoteAssets) { $remoteByName[[string]$a.name] = $a }

$stageDir = Join-Path $ReportDir ("_release-stage-{0:D2}" -f $BatchNumber)
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null
$batchResults = New-Object System.Collections.ArrayList
$done = 0
foreach ($p in $selected) {
    $done++
    Write-Host ("[{0}/{1}] {2}" -f $done,$selected.Count,$p.OriginalFile) -ForegroundColor Cyan
    $actualHash = (Get-FileHash -LiteralPath $p.Source -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $p.SHA256) { throw "SHA256 changed since audit: $($p.OriginalFile)" }

    $uploadStatus = 'UPLOADED'
    if ($remoteByName.ContainsKey($p.AssetName) -and [int64]$remoteByName[$p.AssetName].size -eq [int64]$p.SizeBytes) {
        $uploadStatus = 'ALREADY_UPLOADED'
        Write-Host '  already present with matching size - skipped' -ForegroundColor Yellow
    } else {
        $stagePath = Join-Path $stageDir $p.AssetName
        Copy-Item -LiteralPath $p.Source -Destination $stagePath -Force
        try {
            & gh release upload $tag $stagePath --repo $Repo --clobber
            if ($LASTEXITCODE -ne 0) { throw "Upload failed: $($p.OriginalFile)" }
            $remoteByName[$p.AssetName] = [pscustomobject]@{name=$p.AssetName;size=[int64]$p.SizeBytes}
        }
        finally {
            Remove-Item -LiteralPath $stagePath -Force -ErrorAction SilentlyContinue
        }
    }

    $url = "https://github.com/$Repo/releases/download/$tag/$($p.AssetName)"
    [void]$batchResults.Add([pscustomobject]@{
        Batch=$BatchNumber; Tag=$tag; OriginalFile=$p.OriginalFile; AssetName=$p.AssetName; Brand=$p.Brand;
        SizeBytes=$p.SizeBytes; SHA256=$p.SHA256; DownloadURL=$url; UploadStatus=$uploadStatus;
        UploadedAtUTC=[DateTime]::UtcNow.ToString('o')
    })
}

# Full verification using all release-asset pages.
$release = Get-ReleaseMeta $tag
$finalAssets = @(Get-ReleaseAssets ([int64]$release.id))
$finalMap = @{}
foreach ($a in $finalAssets) { $finalMap[[string]$a.name] = $a }
foreach ($p in $selected) {
    if (-not $finalMap.ContainsKey($p.AssetName)) { throw "Final verification: missing remote asset $($p.AssetName)" }
    if ([int64]$finalMap[$p.AssetName].size -ne [int64]$p.SizeBytes) { throw "Final verification: wrong remote size for $($p.AssetName)" }
}

$batchManifest = Join-Path $ReportDir ("release-upload-batch-{0:D2}.csv" -f $BatchNumber)
$batchResults | Export-Csv -LiteralPath $batchManifest -NoTypeInformation -Encoding UTF8

if ([bool]$release.draft) {
    Write-Host 'Publishing completed draft release ...' -ForegroundColor Cyan
    & gh release edit $tag --repo $Repo --draft=false
    if ($LASTEXITCODE -ne 0) { throw "Uploads are complete but publishing the draft failed: $tag" }
}

Remove-Item -LiteralPath $stageDir -Force -Recurse -ErrorAction SilentlyContinue
Write-Host ''
Write-Host '========================================================' -ForegroundColor Green
Write-Host ("Batch {0} COMPLETE: {1} files / {2:N2} MB" -f $BatchNumber,$selected.Count,($batchBytes/1MB)) -ForegroundColor Green
Write-Host ("Manifest: $batchManifest") -ForegroundColor Cyan
Write-Host 'The site database was NOT modified yet.' -ForegroundColor Yellow
Write-Host '========================================================' -ForegroundColor Green
