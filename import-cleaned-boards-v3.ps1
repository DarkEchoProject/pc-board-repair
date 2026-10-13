$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PublicDir = Join-Path $RepoRoot 'public'
$DownloadsDir = Join-Path $PublicDir 'downloads'
$BoardsJson = Join-Path $PublicDir 'data\boards.json'
$ReportDir = Join-Path $RepoRoot '_IMPORT_REPORT'
$MaxBytes = 24MB
$SupportedExtensions = @('.rar','.zip','.7z','.brd','.fz')
$AllowedCleanStatuses = @('CLEANED','ALREADY_CLEAN','RAW_COPIED')

function Stop-WithMessage([string]$Message) {
    Write-Host ''
    Write-Host $Message -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}

function Get-Brand([string]$Name) {
    $n = $Name.ToLowerInvariant()
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
    if ($n -match 'panasonic') { return 'Panasonic' }
    if ($n -match 'compal') { return 'Compal' }
    if ($n -match 'quanta') { return 'Quanta' }
    if ($n -match 'wistron') { return 'Wistron' }
    if ($n -match 'lcfc') { return 'LCFC' }
    if ($n -match '\b(a320m-hdv|b150m[-_ ]?pro4s|h110m-dgs|n68-gs4|z77[-_ ]?pro4-m)\b') { return 'ASRock' }
    if ($n -match '\b(a58m-f|g512li|g614j|g713p|maximus|prime|strix|t100tam|tp501)\b') { return 'ASUS' }
    return 'Other'
}

function Get-DisplayName([string]$BaseName) {
    $s = $BaseName -replace '_',' '
    $s = $s -replace '(?i)\b(boardview|schematic|schematics|diagram|file)\b',''
    $s = $s -replace '(?i)\((bdv|brd|fz|cad|pdf)\)',''
    $s = $s -replace '\s+',' '
    return $s.Trim([char[]]' -_')
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

function Get-BoardType([string]$Extension) {
    switch ($Extension.ToLowerInvariant()) {
        '.brd' { return 'BoardView BRD' }
        '.fz' { return 'BoardView FZ' }
        default { return 'BoardView archive' }
    }
}

$script:HashCache = @{}
function Get-HashCached([string]$Path) {
    $key = [IO.Path]::GetFullPath($Path).ToLowerInvariant()
    if (-not $script:HashCache.ContainsKey($key)) {
        $script:HashCache[$key] = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
    }
    return $script:HashCache[$key]
}

function Read-BoardDatabase([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return @() }
    $text = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($text)) { return @() }
    $parsed = ConvertFrom-Json -InputObject $text
    $flat = New-Object System.Collections.ArrayList
    foreach ($e in @($parsed)) {
        if ($null -eq $e) { continue }
        $hasValue = $null -ne $e.PSObject.Properties['value']
        $hasBrand = $null -ne $e.PSObject.Properties['brand']
        if ($hasValue -and $null -ne $e.value) {
            foreach ($inner in @($e.value)) {
                if ($null -ne $inner -and $null -ne $inner.PSObject.Properties['brand']) { [void]$flat.Add($inner) }
            }
        }
        elseif ($hasBrand) { [void]$flat.Add($e) }
    }
    return @($flat.ToArray())
}

Write-Host ''
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host ' PC Board Repair - Recovery-Safe Bulk Importer V3' -ForegroundColor Cyan
Write-Host '========================================================' -ForegroundColor Cyan
Write-Host 'V3 can safely continue after the previous V2 JSON check stopped.' -ForegroundColor Green
Write-Host ''
Write-Host 'Drag the _CLEANED folder here, then press Enter:' -ForegroundColor Yellow
$Cleaned = (Read-Host 'Folder').Trim().Trim('"').Trim("'")
if (-not (Test-Path -LiteralPath $Cleaned -PathType Container)) { Stop-WithMessage 'Folder not found.' }

Push-Location $RepoRoot
try {
    $tracked = @(git status --porcelain --untracked-files=no)
    if ($LASTEXITCODE -ne 0) { throw 'git status failed' }
    if ($tracked.Count -gt 0) { Stop-WithMessage ('Tracked local changes exist. Nothing was changed by V3. First inspect: ' + ($tracked -join '; ')) }
    git pull --rebase origin main
    if ($LASTEXITCODE -ne 0) { throw 'git pull --rebase failed' }
}
finally { Pop-Location }

New-Item -ItemType Directory -Force -Path $DownloadsDir | Out-Null
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$existing = @(Read-BoardDatabase $BoardsJson)
$existingCount = $existing.Count
if ($existingCount -lt 1200) {
    Stop-WithMessage ("Safety stop: boards.json parsed only $existingCount entries. Expected at least 1200. Database was NOT modified.")
}

$knownDbFiles = @{}
foreach ($e in $existing) {
    $f = [string]$e.file
    if (-not [string]::IsNullOrWhiteSpace($f)) { $knownDbFiles[$f.ToLowerInvariant()] = $true }
}

$downloadFiles = @(Get-ChildItem -LiteralPath $DownloadsDir -File -ErrorAction SilentlyContinue)
$existingNames = @{}
$bySize = @{}
foreach ($f in $downloadFiles) {
    $existingNames[$f.Name.ToLowerInvariant()] = $f
    $k = [string]$f.Length
    if (-not $bySize.ContainsKey($k)) { $bySize[$k] = New-Object System.Collections.ArrayList }
    [void]$bySize[$k].Add($f)
}

$allSupported = @(Get-ChildItem -LiteralPath $Cleaned -Recurse -File | Where-Object { $_.Extension.ToLowerInvariant() -in $SupportedExtensions })
$report = Join-Path $Cleaned 'clean-report.csv'
$allowed = @{}
if (Test-Path -LiteralPath $report -PathType Leaf) {
    foreach ($row in @(Import-Csv -LiteralPath $report)) {
        if ([string]$row.Status -in $AllowedCleanStatuses) {
            $n = [IO.Path]::GetFileName([string]$row.Destination)
            if ($n) { $allowed[$n.ToLowerInvariant()] = [string]$row.Status }
        }
    }
    $sources = @($allSupported | Where-Object { $allowed.ContainsKey($_.Name.ToLowerInvariant()) })
}
else { $sources = @($allSupported) }
if ($sources.Count -eq 0) { Stop-WithMessage 'No eligible cleaned files were found.' }

Write-Host ''
Write-Host ("Existing boards.json entries: $existingCount") -ForegroundColor Cyan
Write-Host ("Eligible cleaned files:      $($sources.Count)") -ForegroundColor Cyan
Write-Host 'Checking duplicates and recovering files copied by the interrupted V2 run...' -ForegroundColor Cyan

$preview = New-Object System.Collections.ArrayList
$batchHashes = @{}
$usedNames = @{}
$iPos = 0
foreach ($a in ($sources | Sort-Object Name)) {
    $iPos++
    Write-Progress -Activity 'Preparing V3 import' -Status ("$iPos/$($sources.Count) $($a.Name)") -PercentComplete (($iPos/[math]::Max(1,$sources.Count))*100)
    $brand = Get-Brand $a.BaseName
    $display = Get-DisplayName $a.BaseName
    $hash = ''
    $status = 'READY_COPY'
    $destName = ''
    $duplicateOf = ''

    if ($a.Length -gt $MaxBytes) { $status = 'SKIP_TOO_LARGE' }
    else {
        $hash = Get-HashCached $a.FullName
        if ($batchHashes.ContainsKey($hash)) {
            $status = 'SKIP_DUPLICATE_BATCH'
            $duplicateOf = [string]$batchHashes[$hash]
        }
        else {
            $matches = @()
            $sizeKey = [string]$a.Length
            if ($bySize.ContainsKey($sizeKey)) {
                foreach ($f in @($bySize[$sizeKey])) {
                    if ((Get-HashCached $f.FullName) -eq $hash) { $matches += $f }
                }
            }
            $dbMatch = $matches | Where-Object { $knownDbFiles.ContainsKey($_.Name.ToLowerInvariant()) } | Select-Object -First 1
            if ($null -ne $dbMatch) {
                $status = 'SKIP_DUPLICATE_DB'
                $duplicateOf = $dbMatch.Name
            }
            elseif ($matches.Count -gt 0) {
                $status = 'RECOVER_LOCAL'
                $destName = $matches[0].Name
                $duplicateOf = $matches[0].Name
            }
        }
    }

    if ($status -eq 'READY_COPY') {
        $safe = Get-SafeFileName $a.Name $brand
        $destName = $safe
        $n = 2
        while ($existingNames.ContainsKey($destName.ToLowerInvariant()) -or $knownDbFiles.ContainsKey($destName.ToLowerInvariant()) -or $usedNames.ContainsKey($destName.ToLowerInvariant())) {
            $ext = [IO.Path]::GetExtension($safe)
            $base = [IO.Path]::GetFileNameWithoutExtension($safe)
            $destName = "$base-$n$ext"
            $n++
        }
        $usedNames[$destName.ToLowerInvariant()] = $true
    }

    if ($status -in @('READY_COPY','RECOVER_LOCAL')) { $batchHashes[$hash] = $destName }
    [void]$preview.Add([pscustomobject]@{
        Brand=$brand; Model=$display; Type=(Get-BoardType $a.Extension); Source=$a.FullName;
        DestinationFile=$destName; ImportStatus=$status; DuplicateOf=$duplicateOf; SHA256=$hash;
        SizeMB=[math]::Round($a.Length/1MB,2)
    })
}
Write-Progress -Activity 'Preparing V3 import' -Completed

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$previewPath = Join-Path $ReportDir ("import-v3-preview-$stamp.csv")
$preview | Export-Csv -LiteralPath $previewPath -NoTypeInformation -Encoding UTF8
$toCopy = @($preview | Where-Object ImportStatus -eq 'READY_COPY')
$recover = @($preview | Where-Object ImportStatus -eq 'RECOVER_LOCAL')
$skipDb = @($preview | Where-Object ImportStatus -eq 'SKIP_DUPLICATE_DB')
$skipBatch = @($preview | Where-Object ImportStatus -eq 'SKIP_DUPLICATE_BATCH')
$large = @($preview | Where-Object ImportStatus -eq 'SKIP_TOO_LARGE')
$toRegister = @($toCopy + $recover)
$expectedFinal = $existingCount + $toRegister.Count

Write-Host ''
Write-Host '---------------- V3 preview ----------------' -ForegroundColor Cyan
Write-Host ("New files to copy:                 $($toCopy.Count)") -ForegroundColor Green
Write-Host ("Recovered from interrupted V2 run: $($recover.Count)") -ForegroundColor Green
Write-Host ("Already registered on site:        $($skipDb.Count)") -ForegroundColor Yellow
Write-Host ("Duplicate inside this batch:       $($skipBatch.Count)") -ForegroundColor Yellow
Write-Host ("Over 24 MB - skipped:              $($large.Count)") -ForegroundColor Yellow
Write-Host ("boards.json: $existingCount -> $expectedFinal") -ForegroundColor Cyan
Write-Host ("Preview report: $previewPath") -ForegroundColor DarkGray

if ($toRegister.Count -eq 0) {
    Write-Host 'Nothing new needs registration.' -ForegroundColor Green
    Read-Host 'Press Enter to close'
    exit 0
}

Write-Host ''
$answer = Read-Host "Continue and register ONLY these $($toRegister.Count) new entries? Type Y"
if ($answer.ToUpperInvariant() -ne 'Y') { Write-Host 'Stopped. No database change.' -ForegroundColor Yellow; exit 0 }

$backupPath = Join-Path $ReportDir ("boards-before-v3-$stamp.json")
Copy-Item -LiteralPath $BoardsJson -Destination $backupPath -Force

$newEntries = New-Object System.Collections.ArrayList
foreach ($p in $toRegister) {
    $dest = Join-Path $DownloadsDir $p.DestinationFile
    if ($p.ImportStatus -eq 'READY_COPY') {
        if (Test-Path -LiteralPath $dest) { throw "Destination unexpectedly exists: $dest" }
        Copy-Item -LiteralPath $p.Source -Destination $dest
        if ((Get-HashCached $p.Source) -ne (Get-HashCached $dest)) { throw "Hash verification failed: $($p.DestinationFile)" }
    }
    elseif (-not (Test-Path -LiteralPath $dest -PathType Leaf)) { throw "Recovered local file disappeared: $dest" }

    [void]$newEntries.Add([pscustomobject]@{
        brand=$p.Brand; model=$p.Model; board=''; revision=''; platform=''; type=$p.Type;
        file=$p.DestinationFile; image=''; note='Imported automatically from cleaned BoardView collection';
        added_at=[DateTime]::UtcNow.ToString('o')
    })
}

$merged = New-Object System.Collections.ArrayList
foreach ($e in $existing) { [void]$merged.Add($e) }
$mergeNames = @{}
foreach ($e in $existing) { if ($e.file) { $mergeNames[[string]$e.file.ToLowerInvariant()] = $true } }
foreach ($e in $newEntries) {
    $k = ([string]$e.file).ToLowerInvariant()
    if ($mergeNames.ContainsKey($k)) { throw "Duplicate database filename: $($e.file)" }
    [void]$merged.Add($e); $mergeNames[$k] = $true
}
if ($merged.Count -ne $expectedFinal -or $merged.Count -lt $existingCount) { throw 'Final database count safety check failed.' }

$temp = Join-Path $ReportDir ("boards-after-v3-$stamp.tmp.json")
$json = @($merged.ToArray()) | ConvertTo-Json -Depth 8
[IO.File]::WriteAllText($temp,$json,(New-Object Text.UTF8Encoding($false)))
$verify = ConvertFrom-Json -InputObject (Get-Content -LiteralPath $temp -Raw -Encoding UTF8)
if ($verify -is [System.Array]) { $verifyCount = $verify.Length } elseif ($null -eq $verify) { $verifyCount = 0 } else { $verifyCount = 1 }
if ($verifyCount -ne $expectedFinal) { throw "JSON verification failed. Expected=$expectedFinal Parsed=$verifyCount" }
Copy-Item -LiteralPath $temp -Destination $BoardsJson -Force
Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host ("Database verified: $existingCount -> $expectedFinal entries.") -ForegroundColor Green
Write-Host ("Reused $($recover.Count) files already copied by V2; copied $($toCopy.Count) additional files.") -ForegroundColor Green
Write-Host ("Backup: $backupPath") -ForegroundColor DarkGray
Write-Host 'Creating one Git commit and push...' -ForegroundColor Cyan

Push-Location $RepoRoot
try {
    git add public/downloads public/data/boards.json
    if ($LASTEXITCODE -ne 0) { throw 'git add failed' }
    $changes = @(git status --porcelain -- public/downloads public/data/boards.json)
    if ($changes.Count -eq 0) { Write-Host 'No site changes to commit.' -ForegroundColor Yellow }
    else {
        git commit -m 'Bulk import cleaned BoardView collection'
        if ($LASTEXITCODE -ne 0) { throw 'git commit failed' }
        git push origin main
        if ($LASTEXITCODE -ne 0) { throw 'git push failed' }
        Write-Host 'Upload complete. GitHub updated; Cloudflare deployment can now proceed.' -ForegroundColor Green
    }
}
finally { Pop-Location }

Write-Host ''
Write-Host 'V3 finished successfully.' -ForegroundColor Green
Read-Host 'Press Enter to close'
