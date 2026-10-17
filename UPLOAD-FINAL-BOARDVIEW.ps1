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
$TagPrefix = 'boardview-final-20261018'

function Get-SafeAssetName([string]$Original,[string]$Sha256) {
    $ext = [IO.Path]::GetExtension($Original).ToLowerInvariant()
    $base = [IO.Path]::GetFileNameWithoutExtension($Original)
    $base = $base -replace '[^A-Za-z0-9._+-]','-'
    $base = ($base -replace '-+','-').Trim([char[]]'-.')
    if ([string]::IsNullOrWhiteSpace($base)) { $base = 'boardview' }
    if ($base.Length -gt 120) { $base = $base.Substring(0,120).TrimEnd([char[]]'-.') }
    return "$base-$($Sha256.Substring(0,10).ToLowerInvariant())$ext"
}

function Get-Release([string]$Tag) {
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
        if ($LASTEXITCODE -ne 0) { throw "Could not list assets for release id $ReleaseId" }
        $arr = @(($raw -join "`n") | ConvertFrom-Json)
        foreach ($a in $arr) { [void]$all.Add($a) }
        if ($arr.Count -lt 100) { break }
        $page++
    }
    return @($all.ToArray())
}

function Test-AssetComplete($Asset,[int64]$ExpectedSize) {
    return ($null -ne $Asset -and [int64]$Asset.size -eq $ExpectedSize -and [string]$Asset.state -eq 'uploaded')
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ' PC Board Repair - FINAL BoardView uploader' -ForegroundColor Cyan
Write-Host ' NEW_STANDARD + NEW_LARGE, 250 MB batches' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI (gh) is not available in PATH.' }
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not logged in. Run: gh auth login' }
if (-not (Test-Path -LiteralPath $AuditPath -PathType Leaf)) { throw "Audit CSV not found: $AuditPath" }
if (-not (Test-Path -LiteralPath $CleanedPath -PathType Container)) { throw "CLEANED folder not found: $CleanedPath" }
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$rows = @(Import-Csv -LiteralPath $AuditPath | Where-Object { $_.Status -in @('NEW_STANDARD','NEW_LARGE') })
if ($rows.Count -eq 0) { throw 'No NEW_STANDARD or NEW_LARGE rows found.' }

$items = New-Object System.Collections.ArrayList
foreach ($r in $rows) {
    $p = [string]$r.Path
    if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { $p = Join-Path $CleanedPath ([string]$r.File) }
    if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { throw "Source file missing: $($r.File)" }
    $f = Get-Item -LiteralPath $p
    $sha = ([string]$r.SHA256).ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($sha)) { throw "Missing SHA256 in audit: $($r.File)" }
    [void]$items.Add([pscustomobject]@{
        OriginalFile=[string]$r.File; Path=$f.FullName; Brand=[string]$r.Brand; SizeBytes=[int64]$f.Length; SHA256=$sha
    })
}

$sorted = @($items.ToArray() | Sort-Object OriginalFile)
$batches = New-Object System.Collections.ArrayList
$current = New-Object System.Collections.ArrayList
[int64]$currentBytes = 0
foreach ($item in $sorted) {
    if ($current.Count -gt 0 -and ($currentBytes + $item.SizeBytes) -gt $BatchLimitBytes) {
        [void]$batches.Add([pscustomobject]@{Items=@($current.ToArray());Bytes=$currentBytes})
        $current = New-Object System.Collections.ArrayList
        $currentBytes = 0
    }
    [void]$current.Add($item)
    $currentBytes += $item.SizeBytes
    if ($item.SizeBytes -gt $BatchLimitBytes) {
        [void]$batches.Add([pscustomobject]@{Items=@($current.ToArray());Bytes=$currentBytes})
        $current = New-Object System.Collections.ArrayList
        $currentBytes = 0
    }
}
if ($current.Count -gt 0) { [void]$batches.Add([pscustomobject]@{Items=@($current.ToArray());Bytes=$currentBytes}) }

$plan = New-Object System.Collections.ArrayList
for ($i=0; $i -lt $batches.Count; $i++) {
    foreach ($item in $batches[$i].Items) {
        [void]$plan.Add([pscustomobject]@{
            Batch=($i+1);Tag=('{0}-{1:D2}' -f $TagPrefix,($i+1));OriginalFile=$item.OriginalFile;
            AssetName=(Get-SafeAssetName $item.OriginalFile $item.SHA256);Brand=$item.Brand;SizeBytes=$item.SizeBytes;
            SizeMB=[math]::Round($item.SizeBytes/1MB,2);SHA256=$item.SHA256;Source=$item.Path
        })
    }
}
$planPath = Join-Path $ReportDir 'final-boardview-plan.csv'
$plan | Export-Csv -LiteralPath $planPath -NoTypeInformation -Encoding UTF8

Write-Host ("Eligible files:     {0}" -f $items.Count) -ForegroundColor Green
Write-Host ("Planned batches:   {0}" -f $batches.Count) -ForegroundColor Cyan
for ($i=0; $i -lt $batches.Count; $i++) {
    Write-Host ("  Batch {0,2}: {1,4} files / {2,7:N2} MB" -f ($i+1),$batches[$i].Items.Count,($batches[$i].Bytes/1MB))
}
Write-Host ("Plan: $planPath") -ForegroundColor DarkGray

if ($PreviewOnly) { Write-Host 'Preview only. Nothing uploaded.' -ForegroundColor Green; exit 0 }
if ($BatchNumber -lt 1 -or $BatchNumber -gt $batches.Count) { throw "BatchNumber must be between 1 and $($batches.Count)." }

$selected = @($plan | Where-Object { [int]$_.Batch -eq $BatchNumber })
$tag = '{0}-{1:D2}' -f $TagPrefix,$BatchNumber
$manifest = Join-Path $ReportDir ('final-boardview-upload-batch-{0:D2}.csv' -f $BatchNumber)
$stageDir = Join-Path $ReportDir ('_final-boardview-stage-{0:D2}' -f $BatchNumber)
New-Item -ItemType Directory -Force -Path $stageDir | Out-Null

Write-Host ''
Write-Host ("Selected batch: {0}/{1}" -f $BatchNumber,$batches.Count) -ForegroundColor Cyan
Write-Host ("Files:          {0}" -f $selected.Count)
Write-Host ("Total:          {0:N2} MB" -f (($selected | Measure-Object SizeBytes -Sum).Sum/1MB))
Write-Host ("Release tag:    {0}" -f $tag)
$answer = Read-Host "Upload ONLY batch $BatchNumber now? Type Y"
if ($answer.ToUpperInvariant() -ne 'Y') { Write-Host 'Stopped. Nothing uploaded.' -ForegroundColor Yellow; exit 0 }

$release = Get-Release $tag
if ($null -eq $release) {
    & gh release create $tag --repo $Repo --target main --title ("Final BoardView Batch {0:D2}" -f $BatchNumber) --notes 'Final BoardView collection upload before moving focus to BIOS.' --latest=false
    if ($LASTEXITCODE -ne 0) { throw "Failed to create release $tag" }
    Start-Sleep -Seconds 2
    $release = Get-Release $tag
    if ($null -eq $release) { throw "Release created but could not be read: $tag" }
}

$assets = @(Get-ReleaseAssets ([int64]$release.id))
$byName = @{}
foreach ($a in $assets) { $byName[[string]$a.name] = $a }
$results = New-Object System.Collections.ArrayList

$ix=0
foreach ($p in $selected) {
    $ix++
    Write-Host ("[{0}/{1}] {2}" -f $ix,$selected.Count,$p.OriginalFile) -ForegroundColor Cyan
    $existing = $null
    if ($byName.ContainsKey([string]$p.AssetName)) { $existing = $byName[[string]$p.AssetName] }
    if (Test-AssetComplete $existing ([int64]$p.SizeBytes)) {
        Write-Host '  already uploaded' -ForegroundColor Green
        [void]$results.Add([pscustomobject]@{Batch=$BatchNumber;Tag=$tag;OriginalFile=$p.OriginalFile;AssetName=$p.AssetName;Brand=$p.Brand;SizeBytes=$p.SizeBytes;SHA256=$p.SHA256;DownloadURL="https://github.com/$Repo/releases/download/$tag/$($p.AssetName)";UploadStatus='ALREADY_UPLOADED';Error='';UploadedAtUTC=''})
        continue
    }

    $actual = (Get-FileHash -LiteralPath $p.Source -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $p.SHA256) { throw "SHA256 changed since audit: $($p.OriginalFile)" }
    $stagePath = Join-Path $stageDir $p.AssetName
    Copy-Item -LiteralPath $p.Source -Destination $stagePath -Force
    $success=$false; $lastError=''
    try {
        for ($attempt=1; $attempt -le 3; $attempt++) {
            Write-Host ("  upload attempt {0}/3" -f $attempt) -ForegroundColor DarkGray
            $old=$ErrorActionPreference; $ErrorActionPreference='Continue'
            $out=@(& gh release upload $tag $stagePath --repo $Repo --clobber 2>&1); $code=$LASTEXITCODE
            $ErrorActionPreference=$old
            Start-Sleep -Seconds 2
            $check=@(Get-ReleaseAssets ([int64]$release.id))
            $match=$check | Where-Object { [string]$_.name -eq [string]$p.AssetName } | Select-Object -First 1
            if ($code -eq 0 -or (Test-AssetComplete $match ([int64]$p.SizeBytes))) { $success=$true; break }
            $lastError=(($out | ForEach-Object {[string]$_}) -join ' | ')
            if ($lastError.Length -gt 700) { $lastError=$lastError.Substring(0,700) }
            if ($attempt -lt 3) { Start-Sleep -Seconds (5*$attempt) }
        }
    } finally { Remove-Item -LiteralPath $stagePath -Force -ErrorAction SilentlyContinue }

    if ($success) {
        Write-Host '  uploaded' -ForegroundColor Green
        [void]$results.Add([pscustomobject]@{Batch=$BatchNumber;Tag=$tag;OriginalFile=$p.OriginalFile;AssetName=$p.AssetName;Brand=$p.Brand;SizeBytes=$p.SizeBytes;SHA256=$p.SHA256;DownloadURL="https://github.com/$Repo/releases/download/$tag/$($p.AssetName)";UploadStatus='UPLOADED';Error='';UploadedAtUTC=[DateTime]::UtcNow.ToString('o')})
    } else {
        Write-Host '  FAILED after 3 attempts' -ForegroundColor Red
        [void]$results.Add([pscustomobject]@{Batch=$BatchNumber;Tag=$tag;OriginalFile=$p.OriginalFile;AssetName=$p.AssetName;Brand=$p.Brand;SizeBytes=$p.SizeBytes;SHA256=$p.SHA256;DownloadURL='';UploadStatus='FAILED';Error=$lastError;UploadedAtUTC=''})
    }
    @($results.ToArray()) | Export-Csv -LiteralPath $manifest -NoTypeInformation -Encoding UTF8
}

@($results.ToArray()) | Export-Csv -LiteralPath $manifest -NoTypeInformation -Encoding UTF8
$ok=@($results | Where-Object UploadStatus -in @('UPLOADED','ALREADY_UPLOADED')).Count
$failed=@($results | Where-Object UploadStatus -eq 'FAILED').Count
Write-Host ''
Write-Host '---------------- FINAL BATCH SUMMARY ----------------' -ForegroundColor Cyan
Write-Host ("Uploaded/available: {0}" -f $ok) -ForegroundColor Green
Write-Host ("Failed:             {0}" -f $failed) -ForegroundColor $(if($failed -eq 0){'Green'}else{'Red'})
Write-Host ("Manifest:           {0}" -f $manifest)
if ($failed -gt 0) { exit 2 }
