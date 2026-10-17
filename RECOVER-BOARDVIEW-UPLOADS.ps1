param(
    [string]$CleanedPath = 'C:\Users\ALFA\Downloads\Telegram Desktop\_CLEANED',
    [string]$AuditPath = '',
    [string]$RecoveryTag = 'boardview-recovery-large-01'
)

$ErrorActionPreference = 'Stop'
$Repo = 'DarkEchoProject/pc-board-repair'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ReportDir = Join-Path $RepoRoot '_IMPORT_REPORT'
if ([string]::IsNullOrWhiteSpace($AuditPath)) { $AuditPath = Join-Path $ReportDir 'cleaned-audit-latest.csv' }
$ManifestPath = Join-Path $ReportDir 'release-upload-recovery-large-01.csv'
$StageDir = Join-Path $ReportDir '_release-stage-recovery-large-01'

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
        if ($LASTEXITCODE -ne 0) { throw "Could not list release assets for release id $ReleaseId" }
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

function Resolve-Source($AuditRow,[string]$FileName) {
    $p = [string]$AuditRow.Path
    if ($p -and (Test-Path -LiteralPath $p -PathType Leaf)) { return (Get-Item -LiteralPath $p).FullName }
    if (Test-Path -LiteralPath $CleanedPath -PathType Container) {
        $match = Get-ChildItem -LiteralPath $CleanedPath -Recurse -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -eq $FileName } | Select-Object -First 1
        if ($null -ne $match) { return $match.FullName }
    }
    return $null
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ' PC Board Repair - Recovery uploader' -ForegroundColor Cyan
Write-Host ' Skipped HTTP 408 files + NEW_LARGE files' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ''

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI (gh) is not installed or not available in PATH.' }
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) { throw 'GitHub CLI is not logged in. Run: gh auth login' }
if (-not (Test-Path -LiteralPath $AuditPath -PathType Leaf)) { throw "Audit CSV not found: $AuditPath" }
if (-not (Test-Path -LiteralPath $CleanedPath -PathType Container)) { throw "CLEANED folder not found: $CleanedPath" }
New-Item -ItemType Directory -Force -Path $ReportDir,$StageDir | Out-Null

$audit = @(Import-Csv -LiteralPath $AuditPath)
$auditBySha = @{}
foreach ($r in $audit) {
    $h = ([string]$r.SHA256).ToLowerInvariant()
    if ($h) { $auditBySha[$h] = $r }
}

$queue = New-Object System.Collections.ArrayList
$seenSha = @{}

$skipFiles = @(Get-ChildItem -LiteralPath $ReportDir -Filter 'release-upload-skipped-batch-*.csv' -File -ErrorAction SilentlyContinue | Sort-Object Name)
foreach ($sf in $skipFiles) {
    foreach ($s in @(Import-Csv -LiteralPath $sf.FullName)) {
        $sha = ([string]$s.SHA256).ToLowerInvariant()
        if (-not $sha -or $seenSha.ContainsKey($sha)) { continue }
        if (-not $auditBySha.ContainsKey($sha)) { throw "Could not match skipped file to audit by SHA256: $($s.OriginalFile)" }
        $a = $auditBySha[$sha]
        $source = Resolve-Source $a ([string]$s.OriginalFile)
        if (-not $source) { throw "Source file not found: $($s.OriginalFile)" }
        $f = Get-Item -LiteralPath $source
        $asset = [string]$s.AssetName
        if ([string]::IsNullOrWhiteSpace($asset)) { $asset = Get-SafeAssetName ([string]$s.OriginalFile) $sha }
        [void]$queue.Add([pscustomobject]@{
            Reason='RECOVER_SKIPPED'; OriginalFile=[string]$s.OriginalFile; AssetName=$asset; Brand=[string]$a.Brand;
            SizeBytes=[int64]$f.Length; SHA256=$sha; Source=$f.FullName
        })
        $seenSha[$sha] = $true
    }
}

foreach ($a in @($audit | Where-Object Status -eq 'NEW_LARGE')) {
    $sha = ([string]$a.SHA256).ToLowerInvariant()
    if (-not $sha -or $seenSha.ContainsKey($sha)) { continue }
    $source = Resolve-Source $a ([string]$a.File)
    if (-not $source) { throw "Large source file not found: $($a.File)" }
    $f = Get-Item -LiteralPath $source
    $asset = Get-SafeAssetName ([string]$a.File) $sha
    [void]$queue.Add([pscustomobject]@{
        Reason='NEW_LARGE'; OriginalFile=[string]$a.File; AssetName=$asset; Brand=[string]$a.Brand;
        SizeBytes=[int64]$f.Length; SHA256=$sha; Source=$f.FullName
    })
    $seenSha[$sha] = $true
}

$items = @($queue.ToArray())
if ($items.Count -eq 0) {
    Write-Host 'Nothing to recover or upload.' -ForegroundColor Green
    exit 0
}

Write-Host ("Files selected: {0}" -f $items.Count) -ForegroundColor Green
Write-Host ("Skipped failures: {0}" -f @($items | Where-Object Reason -eq 'RECOVER_SKIPPED').Count)
Write-Host ("Large files:      {0}" -f @($items | Where-Object Reason -eq 'NEW_LARGE').Count)
Write-Host ("Total size:       {0:N2} MB" -f ((($items | Measure-Object SizeBytes -Sum).Sum)/1MB))
Write-Host ''
$items | Select-Object Reason,OriginalFile,@{N='SizeMB';E={[math]::Round($_.SizeBytes/1MB,2)}} | Format-Table -AutoSize
Write-Host ''
$answer = Read-Host 'Upload these files to the recovery release now? Type Y'
if ($answer.ToUpperInvariant() -ne 'Y') { Write-Host 'Stopped. Nothing uploaded.' -ForegroundColor Yellow; exit 0 }

$release = Get-Release $RecoveryTag
if ($null -eq $release) {
    Write-Host "Creating recovery release $RecoveryTag ..." -ForegroundColor Cyan
    & gh release create $RecoveryTag --repo $Repo --target main --title 'BoardView Recovery + Large Files 01' --notes 'Recovered BoardView uploads that previously timed out, plus files classified as NEW_LARGE.' --latest=false
    if ($LASTEXITCODE -ne 0) { throw "Failed to create recovery release $RecoveryTag" }
    Start-Sleep -Seconds 2
    $release = Get-Release $RecoveryTag
    if ($null -eq $release) { throw "Recovery release was created but could not be read back: $RecoveryTag" }
} else {
    Write-Host "Resuming existing recovery release $RecoveryTag ..." -ForegroundColor Yellow
}

$remoteAssets = @(Get-ReleaseAssets ([int64]$release.id))
$remoteByName = @{}
foreach ($a in $remoteAssets) { $remoteByName[[string]$a.name] = $a }

$results = New-Object System.Collections.ArrayList
$index = 0
foreach ($p in $items) {
    $index++
    Write-Host ("[{0}/{1}] {2}" -f $index,$items.Count,$p.OriginalFile) -ForegroundColor Cyan

    $existingAsset = $null
    if ($remoteByName.ContainsKey($p.AssetName)) { $existingAsset = $remoteByName[$p.AssetName] }
    if (Test-AssetComplete $existingAsset ([int64]$p.SizeBytes)) {
        Write-Host '  already uploaded' -ForegroundColor Green
        [void]$results.Add([pscustomobject]@{Tag=$RecoveryTag;OriginalFile=$p.OriginalFile;AssetName=$p.AssetName;Brand=$p.Brand;SizeBytes=$p.SizeBytes;SHA256=$p.SHA256;DownloadURL="https://github.com/$Repo/releases/download/$RecoveryTag/$($p.AssetName)";UploadStatus='ALREADY_UPLOADED';Error='';UploadedAtUTC=''})
        continue
    }

    $actualHash = (Get-FileHash -LiteralPath $p.Source -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actualHash -ne $p.SHA256) { throw "SHA256 changed since audit: $($p.OriginalFile)" }

    $stagePath = Join-Path $StageDir $p.AssetName
    Copy-Item -LiteralPath $p.Source -Destination $stagePath -Force
    $success = $false
    $lastError = ''
    try {
        for ($attempt=1; $attempt -le 3; $attempt++) {
            Write-Host ("  upload attempt {0}/3" -f $attempt) -ForegroundColor DarkGray
            $old = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            $out = @(& gh release upload $RecoveryTag $stagePath --repo $Repo --clobber 2>&1)
            $code = $LASTEXITCODE
            $ErrorActionPreference = $old

            Start-Sleep -Seconds 2
            $checkAssets = @(Get-ReleaseAssets ([int64]$release.id))
            $match = $checkAssets | Where-Object { [string]$_.name -eq [string]$p.AssetName } | Select-Object -First 1
            if ($code -eq 0 -or (Test-AssetComplete $match ([int64]$p.SizeBytes))) {
                $success = $true
                break
            }

            $lastError = (($out | ForEach-Object { [string]$_ }) -join ' | ')
            if ($lastError.Length -gt 700) { $lastError = $lastError.Substring(0,700) }
            if ($attempt -lt 3) { Start-Sleep -Seconds (5 * $attempt) }
        }
    }
    finally {
        Remove-Item -LiteralPath $stagePath -Force -ErrorAction SilentlyContinue
    }

    if ($success) {
        Write-Host '  uploaded' -ForegroundColor Green
        [void]$results.Add([pscustomobject]@{Tag=$RecoveryTag;OriginalFile=$p.OriginalFile;AssetName=$p.AssetName;Brand=$p.Brand;SizeBytes=$p.SizeBytes;SHA256=$p.SHA256;DownloadURL="https://github.com/$Repo/releases/download/$RecoveryTag/$($p.AssetName)";UploadStatus='UPLOADED';Error='';UploadedAtUTC=[DateTime]::UtcNow.ToString('o')})
    } else {
        if ([string]::IsNullOrWhiteSpace($lastError)) { $lastError = 'Upload failed after 3 attempts' }
        Write-Host '  FAILED after 3 attempts' -ForegroundColor Red
        [void]$results.Add([pscustomobject]@{Tag=$RecoveryTag;OriginalFile=$p.OriginalFile;AssetName=$p.AssetName;Brand=$p.Brand;SizeBytes=$p.SizeBytes;SHA256=$p.SHA256;DownloadURL='';UploadStatus='FAILED_RECOVERY';Error=$lastError;UploadedAtUTC=''})
    }

    @($results.ToArray()) | Export-Csv -LiteralPath $ManifestPath -NoTypeInformation -Encoding UTF8
}

@($results.ToArray()) | Export-Csv -LiteralPath $ManifestPath -NoTypeInformation -Encoding UTF8
$ok = @($results | Where-Object UploadStatus -in @('UPLOADED','ALREADY_UPLOADED')).Count
$failed = @($results | Where-Object UploadStatus -eq 'FAILED_RECOVERY').Count
Write-Host ''
Write-Host '---------------- RECOVERY SUMMARY ----------------' -ForegroundColor Cyan
Write-Host ("Uploaded/available: {0}" -f $ok) -ForegroundColor Green
Write-Host ("Failed:             {0}" -f $failed) -ForegroundColor $(if($failed -eq 0){'Green'}else{'Red'})
Write-Host ("Manifest:           {0}" -f $ManifestPath)
if ($failed -gt 0) { exit 2 }
