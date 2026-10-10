$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PublicDir = Join-Path $RepoRoot 'public'
$DownloadsDir = Join-Path $PublicDir 'downloads'
$BoardsJson = Join-Path $PublicDir 'data\boards.json'
$ReportDir = Join-Path $RepoRoot '_IMPORT_REPORT'
$MaxBytes = 24MB

Write-Host ''
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ' PC Board Repair - Bulk BoardView Importer' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'Drag the _CLEANED folder here, then press Enter:' -ForegroundColor Yellow
$Cleaned = Read-Host 'Folder'
$Cleaned = $Cleaned.Trim().Trim('"')

if (-not (Test-Path -LiteralPath $Cleaned -PathType Container)) {
    Write-Host 'Folder not found.' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
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

$archives = @(Get-ChildItem -LiteralPath $Cleaned -Recurse -File | Where-Object { $_.Extension.ToLowerInvariant() -in @('.rar', '.zip', '.7z') })

if ($archives.Count -eq 0) {
    Write-Host 'No RAR/ZIP/7Z files were found.' -ForegroundColor Red
    Read-Host 'Press Enter to exit'
    exit 1
}

$preview = @()
$used = @{}

foreach ($a in $archives) {
    $brand = Get-Brand $a.BaseName
    $display = Get-DisplayName $a.BaseName
    $safe = Get-SafeFileName $a.Name $brand
    $candidate = $safe
    $i = 2

    while ($used.ContainsKey($candidate.ToLowerInvariant()) -or (Test-Path -LiteralPath (Join-Path $DownloadsDir $candidate))) {
        $ext = [IO.Path]::GetExtension($safe)
        $baseName = [IO.Path]::GetFileNameWithoutExtension($safe)
        $candidate = $baseName + '-' + $i + $ext
        $i++
    }

    $used[$candidate.ToLowerInvariant()] = $true
    $status = 'READY'
    if ($a.Length -gt $MaxBytes) {
        $status = 'SKIP_TOO_LARGE'
    }

    $preview += [pscustomobject]@{
        Brand = $brand
        Model = $display
        Source = $a.FullName
        DestinationFile = $candidate
        SizeMB = [math]::Round($a.Length / 1MB, 2)
        Status = $status
    }
}

$previewPath = Join-Path $ReportDir 'import-preview.csv'
$preview | Sort-Object Brand, Model | Export-Csv -LiteralPath $previewPath -NoTypeInformation -Encoding UTF8

Write-Host ''
Write-Host ('Found {0} archives.' -f $preview.Count) -ForegroundColor Green
$groups = $preview | Group-Object Brand | Sort-Object Name
foreach ($g in $groups) {
    Write-Host ('  {0,-12} {1,4}' -f $g.Name, $g.Count)
}

$large = @($preview | Where-Object { $_.Status -eq 'SKIP_TOO_LARGE' })
Write-Host ''
Write-Host ('Preview: {0}' -f $previewPath) -ForegroundColor Cyan
if ($large.Count -gt 0) {
    Write-Host ('SKIP_TOO_LARGE: {0} file(s) over 24 MB.' -f $large.Count) -ForegroundColor Yellow
}
Write-Host ''
$answer = Read-Host 'Continue and copy files to the site? Type Y'
if ($answer.ToUpperInvariant() -ne 'Y') {
    Write-Host 'Stopped without changing the site.' -ForegroundColor Yellow
    Read-Host 'Press Enter to exit'
    exit 0
}

$existing = @()
if (Test-Path -LiteralPath $BoardsJson) {
    $rawExisting = @(Get-Content -LiteralPath $BoardsJson -Raw -Encoding UTF8 | ConvertFrom-Json)
    foreach ($e in $rawExisting) {
        if ($null -ne $e.value) {
            foreach ($inner in @($e.value)) {
                if ($null -ne $inner.brand) { $existing += $inner }
            }
        }
        elseif ($null -ne $e.brand) {
            $existing += $e
        }
    }
}

$newEntries = @()
$ready = @($preview | Where-Object { $_.Status -eq 'READY' })

foreach ($p in $ready) {
    $dest = Join-Path $DownloadsDir $p.DestinationFile
    Copy-Item -LiteralPath $p.Source -Destination $dest -Force

    $newEntries += [pscustomobject]@{
        brand = $p.Brand
        model = $p.Model
        board = ''
        revision = ''
        platform = ''
        type = 'BoardView archive'
        file = $p.DestinationFile
        image = ''
        note = 'Imported automatically from cleaned archive'
    }
}

$knownFiles = @{}
foreach ($e in $existing) {
    if ($null -ne $e.file -and -not [string]::IsNullOrWhiteSpace([string]$e.file)) {
        $knownFiles[$e.file.ToLowerInvariant()] = $true
    }
}

$merged = @($existing)
foreach ($e in $newEntries) {
    $key = $e.file.ToLowerInvariant()
    if (-not $knownFiles.ContainsKey($key)) {
        $merged += $e
        $knownFiles[$key] = $true
    }
}

$merged | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $BoardsJson -Encoding UTF8

Write-Host ''
Write-Host ('Copied {0} files and updated boards.json.' -f $newEntries.Count) -ForegroundColor Green
Write-Host 'Preparing one Git commit and one push...' -ForegroundColor Cyan

Push-Location $RepoRoot
try {
    git add public/downloads public/data/boards.json
    if ($LASTEXITCODE -ne 0) { throw 'git add failed' }

    $statusLines = @(git status --porcelain)
    if ($statusLines.Count -eq 0) {
        Write-Host 'No new changes to upload.' -ForegroundColor Yellow
    }
    else {
        git commit -m 'Bulk import cleaned BoardView archives'
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
Write-Host 'Unknown brands are listed under Other for later review.'
Read-Host 'Press Enter to close'
