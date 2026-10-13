$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PublicDir = Join-Path $RepoRoot 'public'
$DownloadsDir = Join-Path $PublicDir 'downloads'
$BoardsJson = Join-Path $PublicDir 'data\boards.json'
$ReportDir = Join-Path $RepoRoot '_IMPORT_REPORT'
$MaxBytes = 24MB
$SupportedExtensions = @('.rar', '.zip', '.7z', '.brd', '.fz')
$AllowedCleanStatuses = @('CLEANED', 'ALREADY_CLEAN', 'RAW_COPIED')

Write-Host ''
Write-Host '====================================================' -ForegroundColor Cyan
Write-Host ' PC Board Repair - Safe Bulk BoardView Importer V2' -ForegroundColor Cyan
Write-Host '====================================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'This version:' -ForegroundColor DarkGray
Write-Host ' - imports RAR / ZIP / 7Z / BRD / FZ' -ForegroundColor DarkGray
Write-Host ' - uses clean-report.csv when available' -ForegroundColor DarkGray
Write-Host ' - skips FAILED cleaner items' -ForegroundColor DarkGray
Write-Host ' - detects duplicate CONTENT with SHA256' -ForegroundColor DarkGray
Write-Host ' - never reduces the existing boards.json database' -ForegroundColor DarkGray
Write-Host ''
Write-Host 'Drag the _CLEANED folder here, then press Enter:' -ForegroundColor Yellow
$Cleaned = Read-Host 'Folder'
$Cleaned = $Cleaned.Trim().Trim('"').Trim("'")

if (-not (Test-Path -LiteralPath $Cleaned -PathType Container)) {
    Write-Host 'Folder not found.' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}

Push-Location $RepoRoot
try {
    $trackedChanges = @(git status --porcelain --untracked-files=no)
    if ($LASTEXITCODE -ne 0) { throw 'git status failed' }
    if ($trackedChanges.Count -gt 0) {
        Write-Host ''
        Write-Host 'STOP: There are tracked local changes in the repository.' -ForegroundColor Red
        Write-Host 'Commit/revert them first so this importer cannot mix unrelated changes.' -ForegroundColor Yellow
        $trackedChanges | ForEach-Object { Write-Host $_ }
        Read-Host 'Press Enter to exit'
        exit 1
    }

    Write-Host ''
    Write-Host 'Syncing repository with GitHub...' -ForegroundColor Cyan
    git pull --rebase origin main
    if ($LASTEXITCODE -ne 0) { throw 'git pull --rebase failed' }
}
finally {
    Pop-Location
}

New-Item -ItemType Directory -Force -Path $DownloadsDir | Out-Null
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function Get-Brand([string]$Name) {
    $n = $Name.ToLowerInvariant()

    if ($n -match 'digilite|dl[-_ ]h61m[-_ ]vg4') { return 'Digilite' }
    if ($n -match 'b150m.*pro4s|n68.*gs4.*usb3.*fx|z77.*pro4.*m') { return 'ASRock' }
    if ($n -match 'h81m[-_ ]v3|strix.*z270f') { return 'ASUS' }
    if ($n -match 'speedy') { return 'Lenovo' }

    if ($n -match 'asrock') { return 'ASRock' }
    if ($n -match 'asus|60nb') { return 'ASUS' }
    if ($n -match 'acer') { return 'Acer' }
    if ($n -match 'gigabyte|\bga[-_ ]') { return 'Gigabyte' }
    if ($n -match 'msi|\bms[-_ ]?[0-9a-z]{3,6}') { return 'MSI' }
    if ($n -match 'hewlett|\bhp\b|compaq|probook|elitebook|pavilion|prodesk|elitedesk') { return 'HP' }
    if ($n -match 'dell|optiplex|latitude|inspiron|vostro|precision') { return 'Dell' }
    if ($n -match 'lenovo|thinkpad|ideapad|thinkcentre') { return 'Lenovo' }
    if ($n -match '\bintel\b') { return 'Intel' }
    if ($n -match 'biostar') { return 'Biostar' }
    if ($n -match '\becs\b|elitegroup') { return 'ECS' }
    if ($n -match 'foxconn') { return 'Foxconn' }
    if ($n -match 'pegatron') { return 'Pegatron' }
    if ($n -match 'apple|macbook|imac') { return 'Apple' }
    if ($n -match 'samsung') { return 'Samsung' }
    if ($n -match 'toshiba') { return 'Toshiba' }
    if ($n -match 'sony|vaio') { return 'Sony' }
    if ($n -match 'clevo') { return 'Clevo' }
    if ($n -match 'huawei') { return 'Huawei' }
    if ($n -match 'panasonic') { return 'Panasonic' }

    if ($n -match 'compal') { return 'Compal' }
    if ($n -match 'quanta') { return 'Quanta' }
    if ($n -match 'wistron') { return 'Wistron' }
    if ($n -match 'lcfc') { return 'LCFC' }

    if ($n -match '\b(a320m-hdv|b150m[-_ ]?pro4s|c8hm70-i|h110m-dgs|n68-gs4|z77[-_ ]?pro4-m)\b') { return 'ASRock' }
    if ($n -match '\b(a58m-f|a8s|c872mpi|cg210pi|et2700i|fx506lh|fx517ze|g512li|g614j|g713p|gt730-2gd|gtx960|gx531gx|m5a97|maximus|p4s800|prime|strix|t100tam|t303ua|tp501|virgo-m)\b') { return 'ASUS' }
    if ($n -match '\bdabklgmb8d0\b') { return 'ASUS' }
    if ($n -match '\bgv(?:[-_ ]|$)') { return 'Gigabyte' }
    if ($n -match '\bgdb70\b|\bla-k631p\b') { return 'Dell' }
    if ($n -match '\bcasug\b') { return 'Toshiba' }
    if ($n -match '\bh98p\b|\bdah98pmbab0\b') { return 'Huawei' }
    if ($n -match '\bhsw-t1\b|\bodm\b') { return 'ODM' }

    return 'Other'
}

function Get-DisplayName([string]$BaseName) {
    $s = $BaseName -replace '_', ' '
    $s = $s -replace '\s+', ' '
    $s = $s -replace '(?i)\b(boardview|schematic|schematics|diagram|file)\b', ''
    $s = $s -replace '(?i)\((bdv|brd|fz|cad|pdf)\)', ''
    $s = $s -replace '\s+', ' '
    return $s.Trim([char[]]' -_')
}

function Get-SafeFileName([string]$Original, [string]$Brand) {
    $ext = [IO.Path]::GetExtension($Original).ToLowerInvariant()
    $base = [IO.Path]::GetFileNameWithoutExtension($Original)
    $base = $base -replace '[^A-Za-z0-9._+-]', '-'
    $base = $base -replace '-+', '-'
    $base = $base.Trim([char[]]'-.')
    if ([string]::IsNullOrWhiteSpace($base)) { $base = 'board' }

    $brandSafe = $Brand -replace '[^A-Za-z0-9]', '-'
    $brandPattern = '(?i)^' + [regex]::Escape($brandSafe) + '[-_]'
    if ($base -notmatch $brandPattern) {
        $base = $brandSafe + '-' + $base
    }
    return $base + $ext
}

function Get-BoardType([string]$Extension) {
    switch ($Extension.ToLowerInvariant()) {
        '.brd' { return 'BoardView BRD' }
        '.fz'  { return 'BoardView FZ' }
        default { return 'BoardView archive' }
    }
}

function Flatten-Boards($RawItems) {
    $flat = @()
    foreach ($e in @($RawItems)) {
        if ($null -ne $e.value) {
            foreach ($inner in @($e.value)) {
                if ($null -ne $inner.brand) { $flat += $inner }
            }
        }
        elseif ($null -ne $e.brand) {
            $flat += $e
        }
    }
    return @($flat)
}

$script:HashCache = @{}
function Get-HashCached([string]$Path) {
    $key = [IO.Path]::GetFullPath($Path).ToLowerInvariant()
    if (-not $script:HashCache.ContainsKey($key)) {
        $script:HashCache[$key] = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
    }
    return $script:HashCache[$key]
}

$existing = @()
if (Test-Path -LiteralPath $BoardsJson) {
    $rawText = Get-Content -LiteralPath $BoardsJson -Raw -Encoding UTF8
    if (-not [string]::IsNullOrWhiteSpace($rawText)) {
        $rawExisting = @($rawText | ConvertFrom-Json)
        $existing = Flatten-Boards $rawExisting
    }
}
$existingCount = $existing.Count

$knownDbFiles = @{}
foreach ($e in $existing) {
    $f = [string]$e.file
    if (-not [string]::IsNullOrWhiteSpace($f)) {
        $knownDbFiles[$f.ToLowerInvariant()] = $true
    }
}

$existingDownloadFiles = @(Get-ChildItem -LiteralPath $DownloadsDir -File -ErrorAction SilentlyContinue)
$existingNames = @{}
$existingBySize = @{}
foreach ($f in $existingDownloadFiles) {
    $existingNames[$f.Name.ToLowerInvariant()] = $f.FullName
    $sizeKey = [string]$f.Length
    if (-not $existingBySize.ContainsKey($sizeKey)) {
        $existingBySize[$sizeKey] = New-Object System.Collections.ArrayList
    }
    [void]$existingBySize[$sizeKey].Add($f)
}

$allSupported = @(Get-ChildItem -LiteralPath $Cleaned -Recurse -File | Where-Object {
    $_.Extension.ToLowerInvariant() -in $SupportedExtensions
})

$cleanReport = Join-Path $Cleaned 'clean-report.csv'
$allowedNames = @{}
$reportWasUsed = $false
if (Test-Path -LiteralPath $cleanReport -PathType Leaf) {
    $reportWasUsed = $true
    foreach ($row in @(Import-Csv -LiteralPath $cleanReport)) {
        if ([string]$row.Status -in $AllowedCleanStatuses) {
            $destName = [IO.Path]::GetFileName([string]$row.Destination)
            if (-not [string]::IsNullOrWhiteSpace($destName)) {
                $allowedNames[$destName.ToLowerInvariant()] = [string]$row.Status
            }
        }
    }
}

if ($reportWasUsed) {
    $sources = @($allSupported | Where-Object { $allowedNames.ContainsKey($_.Name.ToLowerInvariant()) })
}
else {
    $sources = @($allSupported)
}

if ($sources.Count -eq 0) {
    Write-Host 'No eligible RAR/ZIP/7Z/BRD/FZ files were found.' -ForegroundColor Red
    if ($reportWasUsed) {
        Write-Host 'clean-report.csv was found, but it contained no eligible CLEANED / ALREADY_CLEAN / RAW_COPIED files.' -ForegroundColor Yellow
    }
    Read-Host 'Press Enter to exit'
    exit 1
}

$preview = @()
$usedNames = @{}
$batchHashes = @{}

Write-Host ''
Write-Host ('Existing database entries: {0}' -f $existingCount) -ForegroundColor Cyan
Write-Host ('Eligible cleaned files:     {0}' -f $sources.Count) -ForegroundColor Cyan
if ($reportWasUsed) {
    $excludedByReport = $allSupported.Count - $sources.Count
    Write-Host ('Excluded by cleaner report: {0}' -f $excludedByReport) -ForegroundColor DarkYellow
}
Write-Host ''
Write-Host 'Checking size and duplicate content...' -ForegroundColor Cyan

$pos = 0
foreach ($a in ($sources | Sort-Object Name)) {
    $pos++
    Write-Progress -Activity 'Preparing BoardView import' -Status ("{0}/{1} {2}" -f $pos,$sources.Count,$a.Name) -PercentComplete (($pos / [math]::Max(1,$sources.Count))*100)

    $brand = Get-Brand $a.BaseName
    $display = Get-DisplayName $a.BaseName
    $safe = Get-SafeFileName $a.Name $brand
    $status = 'READY'
    $duplicateOf = ''
    $sourceHash = ''

    if ($a.Length -gt $MaxBytes) {
        $status = 'SKIP_TOO_LARGE'
    }
    else {
        $sourceHash = Get-HashCached $a.FullName

        if ($batchHashes.ContainsKey($sourceHash)) {
            $status = 'SKIP_DUPLICATE_BATCH'
            $duplicateOf = [string]$batchHashes[$sourceHash]
        }

        if ($status -eq 'READY') {
            $sizeKey = [string]$a.Length
            if ($existingBySize.ContainsKey($sizeKey)) {
                foreach ($existingFile in @($existingBySize[$sizeKey])) {
                    if ((Get-HashCached $existingFile.FullName) -eq $sourceHash) {
                        $status = 'SKIP_DUPLICATE_EXISTING'
                        $duplicateOf = $existingFile.Name
                        break
                    }
                }
            }
        }
    }

    $candidate = ''
    if ($status -eq 'READY') {
        $candidate = $safe
        $i = 2

        while (
            $usedNames.ContainsKey($candidate.ToLowerInvariant()) -or
            $existingNames.ContainsKey($candidate.ToLowerInvariant()) -or
            $knownDbFiles.ContainsKey($candidate.ToLowerInvariant())
        ) {
            $ext = [IO.Path]::GetExtension($safe)
            $baseName = [IO.Path]::GetFileNameWithoutExtension($safe)
            $candidate = $baseName + '-' + $i + $ext
            $i++
        }

        $usedNames[$candidate.ToLowerInvariant()] = $true
        $batchHashes[$sourceHash] = $candidate
    }

    $cleanStatus = ''
    if ($reportWasUsed -and $allowedNames.ContainsKey($a.Name.ToLowerInvariant())) {
        $cleanStatus = [string]$allowedNames[$a.Name.ToLowerInvariant()]
    }

    $preview += [pscustomobject]@{
        Brand = $brand
        Model = $display
        Type = Get-BoardType $a.Extension
        Source = $a.FullName
        DestinationFile = $candidate
        SizeMB = [math]::Round($a.Length / 1MB, 2)
        CleanerStatus = $cleanStatus
        ImportStatus = $status
        DuplicateOf = $duplicateOf
        SHA256 = $sourceHash
    }
}
Write-Progress -Activity 'Preparing BoardView import' -Completed

$previewPath = Join-Path $ReportDir 'import-preview.csv'
$preview | Sort-Object ImportStatus, Brand, Model | Export-Csv -LiteralPath $previewPath -NoTypeInformation -Encoding UTF8

$ready = @($preview | Where-Object { $_.ImportStatus -eq 'READY' })
$duplicateExisting = @($preview | Where-Object { $_.ImportStatus -eq 'SKIP_DUPLICATE_EXISTING' })
$duplicateBatch = @($preview | Where-Object { $_.ImportStatus -eq 'SKIP_DUPLICATE_BATCH' })
$large = @($preview | Where-Object { $_.ImportStatus -eq 'SKIP_TOO_LARGE' })

Write-Host ''
Write-Host '---------------- Import preview ----------------' -ForegroundColor Cyan
Write-Host ('Eligible files:                 {0}' -f $preview.Count)
Write-Host ('NEW files ready to import:      {0}' -f $ready.Count) -ForegroundColor Green
Write-Host ('Already on site (same content): {0}' -f $duplicateExisting.Count) -ForegroundColor Yellow
Write-Host ('Duplicate inside this batch:    {0}' -f $duplicateBatch.Count) -ForegroundColor Yellow
Write-Host ('Over 24 MB - skipped:           {0}' -f $large.Count) -ForegroundColor Yellow
Write-Host ('Existing boards.json entries:   {0}' -f $existingCount)
Write-Host ('Expected final entries:         {0}' -f ($existingCount + $ready.Count)) -ForegroundColor Cyan
Write-Host ('Preview report: {0}' -f $previewPath) -ForegroundColor Cyan

$groups = $ready | Group-Object Brand | Sort-Object Name
if ($groups.Count -gt 0) {
    Write-Host ''
    Write-Host 'New files by detected brand:' -ForegroundColor Cyan
    foreach ($g in $groups) {
        Write-Host ('  {0,-12} {1,4}' -f $g.Name, $g.Count)
    }
}

if ($ready.Count -eq 0) {
    Write-Host ''
    Write-Host 'Nothing new to import. Existing files were left unchanged.' -ForegroundColor Green
    Read-Host 'Press Enter to close'
    exit 0
}

Write-Host ''
$answer = Read-Host 'Continue and import ONLY the NEW files? Type Y'
if ($answer.ToUpperInvariant() -ne 'Y') {
    Write-Host 'Stopped without changing the site.' -ForegroundColor Yellow
    Read-Host 'Press Enter to exit'
    exit 0
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $ReportDir ("boards-before-import-{0}.json" -f $stamp)
if (Test-Path -LiteralPath $BoardsJson) {
    Copy-Item -LiteralPath $BoardsJson -Destination $backupPath -Force
}

$newEntries = @()
$copyPos = 0
foreach ($p in $ready) {
    $copyPos++
    Write-Progress -Activity 'Copying NEW BoardView files' -Status ("{0}/{1} {2}" -f $copyPos,$ready.Count,$p.DestinationFile) -PercentComplete (($copyPos/[math]::Max(1,$ready.Count))*100)

    $dest = Join-Path $DownloadsDir $p.DestinationFile
    if (Test-Path -LiteralPath $dest) {
        throw "Safety stop: destination unexpectedly exists: $dest"
    }

    Copy-Item -LiteralPath $p.Source -Destination $dest

    $sourceHash = Get-HashCached $p.Source
    $destHash = Get-HashCached $dest
    if ($sourceHash -ne $destHash) {
        Remove-Item -LiteralPath $dest -Force -ErrorAction SilentlyContinue
        throw "Hash verification failed after copying: $($p.DestinationFile)"
    }

    $newEntries += [pscustomobject]@{
        brand = $p.Brand
        model = $p.Model
        board = ''
        revision = ''
        platform = ''
        type = $p.Type
        file = $p.DestinationFile
        image = ''
        note = 'Imported automatically from cleaned BoardView collection'
        added_at = [DateTime]::UtcNow.ToString('o')
    }
}
Write-Progress -Activity 'Copying NEW BoardView files' -Completed

$merged = @($existing)
$mergeKeys = @{}
foreach ($e in $existing) {
    $f = [string]$e.file
    if (-not [string]::IsNullOrWhiteSpace($f)) {
        $mergeKeys[$f.ToLowerInvariant()] = $true
    }
}

foreach ($e in $newEntries) {
    $key = ([string]$e.file).ToLowerInvariant()
    if ($mergeKeys.ContainsKey($key)) {
        throw "Safety stop: duplicate database filename detected: $($e.file)"
    }
    $merged += $e
    $mergeKeys[$key] = $true
}

$expectedFinal = $existingCount + $newEntries.Count
if ($merged.Count -ne $expectedFinal -or $merged.Count -lt $existingCount) {
    throw "Safety stop: database count check failed. Existing=$existingCount New=$($newEntries.Count) Final=$($merged.Count)"
}

$tempJson = Join-Path $ReportDir ("boards-after-import-{0}.tmp.json" -f $stamp)
$json = $merged | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($tempJson, $json, (New-Object Text.UTF8Encoding($false)))

$verifyParsed = @((Get-Content -LiteralPath $tempJson -Raw -Encoding UTF8) | ConvertFrom-Json)
if ($verifyParsed.Count -ne $expectedFinal) {
    throw "Safety stop: generated JSON verification failed. Expected=$expectedFinal Parsed=$($verifyParsed.Count)"
}

Copy-Item -LiteralPath $tempJson -Destination $BoardsJson -Force
Remove-Item -LiteralPath $tempJson -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host ('Copied and verified {0} NEW file(s).' -f $newEntries.Count) -ForegroundColor Green
Write-Host ('boards.json: {0} -> {1} entries.' -f $existingCount,$expectedFinal) -ForegroundColor Green
Write-Host ('Database backup: {0}' -f $backupPath) -ForegroundColor DarkGray
Write-Host ''
Write-Host 'Preparing one Git commit and one push...' -ForegroundColor Cyan

Push-Location $RepoRoot
try {
    git add public/downloads public/data/boards.json
    if ($LASTEXITCODE -ne 0) { throw 'git add failed' }

    $statusLines = @(git status --porcelain -- public/downloads public/data/boards.json)
    if ($statusLines.Count -eq 0) {
        Write-Host 'No new site changes to upload.' -ForegroundColor Yellow
    }
    else {
        git commit -m ("Bulk import {0} cleaned BoardView files" -f $newEntries.Count)
        if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }

        git push origin main
        if ($LASTEXITCODE -ne 0) { throw 'git push failed' }

        Write-Host ''
        Write-Host 'Upload complete. Cloudflare will deploy automatically.' -ForegroundColor Green
    }
}
finally {
    Pop-Location
}

Write-Host ''
Write-Host 'Import completed safely.' -ForegroundColor Green
Write-Host ('New: {0} | Existing duplicates skipped: {1} | Batch duplicates skipped: {2} | Too large: {3}' -f $newEntries.Count,$duplicateExisting.Count,$duplicateBatch.Count,$large.Count)
Write-Host 'Files detected as Other are kept for later metadata review; no file is discarded for an unknown brand.'
Read-Host 'Press Enter to close'
