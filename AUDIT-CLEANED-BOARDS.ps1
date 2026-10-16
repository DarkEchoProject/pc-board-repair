param(
    [string]$CleanedPath = 'C:\Users\ALFA\Downloads\Telegram Desktop\_CLEANED',
    [string]$ReportPath = ''
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$DownloadsDir = Join-Path $RepoRoot 'public\downloads'
$BoardsJson = Join-Path $RepoRoot 'public\data\boards.json'
$BoardsLargeJson = Join-Path $RepoRoot 'public\data\boards-large.json'
$OutDir = Join-Path $RepoRoot '_IMPORT_REPORT'
$StandardLimit = 24MB
$SupportedExtensions = @('.rar','.zip','.7z','.brd','.fz','.bdv','.bvr','.cae','.asc')
$ApprovedStatuses = @('CLEANED','ALREADY_CLEAN','RAW_COPIED')

function Read-BoardDatabase([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return @() }
    $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($text)) { return @() }
    $parsed = ConvertFrom-Json -InputObject $text
    $flat = New-Object System.Collections.ArrayList
    foreach ($e in @($parsed)) {
        if ($null -eq $e) { continue }
        if ($null -ne $e.PSObject.Properties['value'] -and $null -ne $e.value) {
            foreach ($inner in @($e.value)) {
                if ($null -ne $inner -and $null -ne $inner.PSObject.Properties['file']) { [void]$flat.Add($inner) }
            }
        }
        elseif ($null -ne $e.PSObject.Properties['file']) { [void]$flat.Add($e) }
    }
    return @($flat.ToArray())
}

function Get-SafeFileName([string]$Original,[string]$Brand) {
    $ext = [IO.Path]::GetExtension($Original).ToLowerInvariant()
    $base = [IO.Path]::GetFileNameWithoutExtension($Original)
    $base = $base -replace '[^A-Za-z0-9._+-]','-'
    $base = ($base -replace '-+','-').Trim([char[]]'-.')
    if ([string]::IsNullOrWhiteSpace($base)) { $base = 'board' }
    $brandSafe = $Brand -replace '[^A-Za-z0-9]','-'
    if ($base -notmatch ('(?i)^' + [regex]::Escape($brandSafe) + '[-_]')) { $base = $brandSafe + '-' + $base }
    return $base + $ext
}

function Get-Brand([string]$Name) {
    $n = $Name.ToLowerInvariant()
    if ($n -match 'asrock') { return 'ASRock' }
    if ($n -match 'asus|60nb') { return 'ASUS' }
    if ($n -match 'acer') { return 'Acer' }
    if ($n -match 'gigabyte|\bga[-_ ]') { return 'Gigabyte' }
    if ($n -match 'msi|\bms[-_ ]?[0-9a-z]{3,6}') { return 'MSI' }
    if ($n -match 'hewlett|\bhp\b|compaq|probook|elitebook|pavilion|prodesk|elitedesk|zbook') { return 'HP' }
    if ($n -match 'dell|optiplex|latitude|inspiron|vostro|precision') { return 'Dell' }
    if ($n -match 'lenovo|thinkpad|ideapad|thinkcentre|legion') { return 'Lenovo' }
    if ($n -match '\bintel\b') { return 'Intel' }
    if ($n -match 'biostar') { return 'Biostar' }
    if ($n -match '\becs\b|elitegroup') { return 'ECS' }
    if ($n -match 'foxconn') { return 'Foxconn' }
    if ($n -match 'pegatron') { return 'Pegatron' }
    if ($n -match 'apple|macbook|imac|\ba1[0-9]{3}\b|\b820[-_ ]') { return 'Apple' }
    if ($n -match 'samsung') { return 'Samsung' }
    if ($n -match 'toshiba') { return 'Toshiba' }
    if ($n -match 'sony|vaio') { return 'Sony' }
    if ($n -match 'panasonic') { return 'Panasonic' }
    if ($n -match 'compal') { return 'Compal' }
    if ($n -match 'quanta') { return 'Quanta' }
    if ($n -match 'wistron') { return 'Wistron' }
    if ($n -match 'lcfc') { return 'LCFC' }
    return 'Other'
}

function Normalize-Key([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return '' }
    $s = $Value.ToLowerInvariant()
    $s = [IO.Path]::GetFileNameWithoutExtension($s)
    $s = $s -replace '(?i)\b(boardview|schematic|schematics|diagram|file|bdv|brd|fz|cad|bvr|cae|asc)\b',' '
    $s = $s -replace '[^a-z0-9]+',''
    return $s
}

$HashCache = @{}
function Get-HashCached([string]$Path) {
    $key = [IO.Path]::GetFullPath($Path).ToLowerInvariant()
    if (-not $HashCache.ContainsKey($key)) {
        $HashCache[$key] = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
    }
    return $HashCache[$key]
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ' PC Board Repair - CLEANED Collection Audit (NO CHANGES)' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host 'This tool only reads files and writes a CSV report.' -ForegroundColor Green
Write-Host ''

if (-not (Test-Path -LiteralPath $CleanedPath -PathType Container)) {
    throw "CLEANED folder not found: $CleanedPath"
}

if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $candidates = @()
    $candidates += @(Get-ChildItem -LiteralPath $CleanedPath -Filter 'clean-report*.csv' -File -ErrorAction SilentlyContinue)
    $parent = Split-Path -Parent $CleanedPath
    $candidates += @(Get-ChildItem -LiteralPath $parent -Filter 'clean-report*.csv' -File -ErrorAction SilentlyContinue)
    $pick = $candidates | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($null -ne $pick) { $ReportPath = $pick.FullName }
}

$approvedByName = @{}
$reportStats = @{}
if ($ReportPath -and (Test-Path -LiteralPath $ReportPath -PathType Leaf)) {
    Write-Host ("Cleaner report: " + $ReportPath) -ForegroundColor DarkGray
    foreach ($row in @(Import-Csv -LiteralPath $ReportPath)) {
        $status = [string]$row.Status
        if (-not $reportStats.ContainsKey($status)) { $reportStats[$status] = 0 }
        $reportStats[$status]++
        if ($status -in $ApprovedStatuses -and -not [string]::IsNullOrWhiteSpace([string]$row.Destination)) {
            $n = [IO.Path]::GetFileName([string]$row.Destination)
            if ($n) { $approvedByName[$n.ToLowerInvariant()] = $status }
        }
    }
} else {
    Write-Host 'Cleaner report not found locally. Audit will use the files physically present in _CLEANED.' -ForegroundColor Yellow
}

$regularDb = @(Read-BoardDatabase $BoardsJson)
$largeDb = @(Read-BoardDatabase $BoardsLargeJson)
$allDb = @($regularDb + $largeDb)
if ($regularDb.Count -lt 1000) { throw "Safety stop: boards.json parsed only $($regularDb.Count) entries." }

$dbByFile = @{}
$dbByHash = @{}
$dbByNorm = @{}
foreach ($e in $allDb) {
    $file = [string]$e.file
    if ($file) {
        $dbByFile[$file.ToLowerInvariant()] = $e
        $nk = Normalize-Key $file
        if ($nk -and -not $dbByNorm.ContainsKey($nk)) { $dbByNorm[$nk] = $file }
    }
    if ($null -ne $e.PSObject.Properties['sha256']) {
        $h = ([string]$e.sha256).ToLowerInvariant()
        if ($h) { $dbByHash[$h] = $file }
    }
}

$localDownloads = @(Get-ChildItem -LiteralPath $DownloadsDir -File -ErrorAction SilentlyContinue)
$localBySize = @{}
foreach ($f in $localDownloads) {
    $k = [string]$f.Length
    if (-not $localBySize.ContainsKey($k)) { $localBySize[$k] = New-Object System.Collections.ArrayList }
    [void]$localBySize[$k].Add($f)
}

$allFiles = @(Get-ChildItem -LiteralPath $CleanedPath -Recurse -File)
$batchHashes = @{}
$results = New-Object System.Collections.ArrayList
$index = 0

foreach ($f in ($allFiles | Sort-Object FullName)) {
    $index++
    Write-Progress -Activity 'Auditing cleaned BoardView collection' -Status ("$index/$($allFiles.Count) $($f.Name)") -PercentComplete (($index/[math]::Max(1,$allFiles.Count))*100)

    $ext = $f.Extension.ToLowerInvariant()
    $cleanStatus = ''
    if ($approvedByName.ContainsKey($f.Name.ToLowerInvariant())) { $cleanStatus = [string]$approvedByName[$f.Name.ToLowerInvariant()] }

    if ($ext -notin $SupportedExtensions) {
        [void]$results.Add([pscustomobject]@{File=$f.Name;Path=$f.FullName;Brand='';SizeMB=[math]::Round($f.Length/1MB,2);SHA256='';Status='UNSUPPORTED_EXTENSION';Match='';ProposedStorage='';CleanerStatus=$cleanStatus})
        continue
    }
    if ($approvedByName.Count -gt 0 -and -not $approvedByName.ContainsKey($f.Name.ToLowerInvariant())) {
        [void]$results.Add([pscustomobject]@{File=$f.Name;Path=$f.FullName;Brand='';SizeMB=[math]::Round($f.Length/1MB,2);SHA256='';Status='NOT_APPROVED_BY_CLEAN_REPORT';Match='';ProposedStorage='';CleanerStatus=$cleanStatus})
        continue
    }

    $hash = Get-HashCached $f.FullName
    $brand = Get-Brand $f.BaseName
    $storage = if ($f.Length -gt $StandardLimit) { 'github-release' } else { 'public/downloads' }
    $status = if ($f.Length -gt $StandardLimit) { 'NEW_LARGE' } else { 'NEW_STANDARD' }
    $match = ''

    if ($dbByHash.ContainsKey($hash)) {
        $status = 'DUPLICATE_SITE_HASH'
        $match = [string]$dbByHash[$hash]
    }
    elseif ($batchHashes.ContainsKey($hash)) {
        $status = 'DUPLICATE_IN_BATCH'
        $match = [string]$batchHashes[$hash]
    }
    else {
        $sameLocal = $null
        $sizeKey = [string]$f.Length
        if ($localBySize.ContainsKey($sizeKey)) {
            foreach ($old in @($localBySize[$sizeKey])) {
                if ((Get-HashCached $old.FullName) -eq $hash) { $sameLocal = $old; break }
            }
        }
        if ($null -ne $sameLocal) {
            if ($dbByFile.ContainsKey($sameLocal.Name.ToLowerInvariant())) {
                $status = 'DUPLICATE_SITE_LOCAL_HASH'
            } else {
                $status = 'EXISTS_LOCAL_UNREGISTERED'
            }
            $match = $sameLocal.Name
        } else {
            $safe = Get-SafeFileName $f.Name $brand
            if ($dbByFile.ContainsKey($safe.ToLowerInvariant())) {
                $status = 'NAME_CONFLICT_SITE'
                $match = $safe
            } else {
                $nk = Normalize-Key $f.Name
                if ($nk -and $dbByNorm.ContainsKey($nk)) {
                    $status = 'POSSIBLE_NAME_MATCH'
                    $match = [string]$dbByNorm[$nk]
                }
            }
        }
    }

    if (-not $batchHashes.ContainsKey($hash)) { $batchHashes[$hash] = $f.Name }
    [void]$results.Add([pscustomobject]@{
        File=$f.Name;Path=$f.FullName;Brand=$brand;SizeMB=[math]::Round($f.Length/1MB,2);SHA256=$hash;
        Status=$status;Match=$match;ProposedStorage=$storage;CleanerStatus=$cleanStatus
    })
}
Write-Progress -Activity 'Auditing cleaned BoardView collection' -Completed

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$out = Join-Path $OutDir ("cleaned-audit-$stamp.csv")
$latest = Join-Path $OutDir 'cleaned-audit-latest.csv'
$results | Export-Csv -LiteralPath $out -NoTypeInformation -Encoding UTF8
$results | Export-Csv -LiteralPath $latest -NoTypeInformation -Encoding UTF8

function Count-Status([string]$Name) { return @($results | Where-Object Status -eq $Name).Count }

Write-Host ''
Write-Host '---------------- AUDIT SUMMARY ----------------' -ForegroundColor Cyan
Write-Host ("Physical files scanned:       {0}" -f $allFiles.Count)
Write-Host ("Site DB entries:              {0} regular + {1} large = {2}" -f $regularDb.Count,$largeDb.Count,$allDb.Count)
Write-Host ("NEW standard (<=24 MB):       {0}" -f (Count-Status 'NEW_STANDARD')) -ForegroundColor Green
Write-Host ("NEW large (>24 MB):           {0}" -f (Count-Status 'NEW_LARGE')) -ForegroundColor Green
Write-Host ("Duplicate by site SHA256:     {0}" -f (Count-Status 'DUPLICATE_SITE_HASH')) -ForegroundColor Yellow
Write-Host ("Duplicate by local hash:      {0}" -f (Count-Status 'DUPLICATE_SITE_LOCAL_HASH')) -ForegroundColor Yellow
Write-Host ("Duplicate inside this batch:  {0}" -f (Count-Status 'DUPLICATE_IN_BATCH')) -ForegroundColor Yellow
Write-Host ("Local but unregistered:       {0}" -f (Count-Status 'EXISTS_LOCAL_UNREGISTERED')) -ForegroundColor Yellow
Write-Host ("Name conflicts:               {0}" -f (Count-Status 'NAME_CONFLICT_SITE')) -ForegroundColor Yellow
Write-Host ("Possible name matches:        {0}" -f (Count-Status 'POSSIBLE_NAME_MATCH')) -ForegroundColor Yellow
Write-Host ("Not approved by clean report: {0}" -f (Count-Status 'NOT_APPROVED_BY_CLEAN_REPORT')) -ForegroundColor Yellow
Write-Host ("Unsupported extension:        {0}" -f (Count-Status 'UNSUPPORTED_EXTENSION')) -ForegroundColor Yellow
Write-Host ''
Write-Host ("Report: $out") -ForegroundColor Cyan
Write-Host 'NO site files, database entries, or uploads were changed.' -ForegroundColor Green
