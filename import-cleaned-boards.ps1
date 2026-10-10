$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PublicDir = Join-Path $RepoRoot 'public'
$DownloadsDir = Join-Path $PublicDir 'downloads'
$BoardsJson = Join-Path $PublicDir 'data\boards.json'
$ReportDir = Join-Path $RepoRoot '_IMPORT_REPORT'

Write-Host ''
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ' PC Board Repair - Bulk BoardView Importer' -ForegroundColor Cyan
Write-Host '==============================================' -ForegroundColor Cyan
Write-Host ''
Write-Host 'اسحب مجلد _CLEANED إلى هذه النافذة ثم اضغط Enter:' -ForegroundColor Yellow
$Cleaned = Read-Host 'Folder'
$Cleaned = $Cleaned.Trim().Trim('"')

if (-not (Test-Path -LiteralPath $Cleaned -PathType Container)) {
    Write-Host 'المجلد غير موجود.' -ForegroundColor Red
    Read-Host 'اضغط Enter للخروج'
    exit 1
}

New-Item -ItemType Directory -Force -Path $DownloadsDir | Out-Null
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

# Cloudflare Workers static assets have a per-file limit. Leave a safety margin.
$MaxBytes = 24MB

function Get-Brand([string]$Name) {
    $n = $Name.ToLowerInvariant()
    if ($n -match 'asrock') { return 'ASRock' }
    if ($n -match 'asus|60nb') { return 'ASUS' }
    if ($n -match 'acer') { return 'Acer' }
    if ($n -match 'gigabyte|\bga[-_ ]') { return 'Gigabyte' }
    if ($n -match 'msi|\bms[-_ ]?\d{3,5}') { return 'MSI' }
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
    return 'Other'
}

function Get-DisplayName([string]$BaseName) {
    $s = $BaseName -replace '_',' '
    $s = $s -replace '\s+',' '
    $s = $s -replace '(?i)\b(boardview|schematic|schematics|diagram|file)\b',''
    $s = $s -replace '(?i)\((bdv|brd|fz|cad|pdf)\)',''
    $s = $s -replace '\s+',' '
    return $s.Trim(' ','-','_')
}

function Get-SafeFileName([string]$Original, [string]$Brand) {
    $ext = [IO.Path]::GetExtension($Original).ToLowerInvariant()
    $base = [IO.Path]::GetFileNameWithoutExtension($Original)
    $base = $base -replace '[^A-Za-z0-9._+-]','-'
    $base = $base -replace '-+','-'
    $base = $base.Trim('-','.')
    if ([string]::IsNullOrWhiteSpace($base)) { $base = 'board' }
    $brandSafe = $Brand -replace '[^A-Za-z0-9]','-'
    if ($base -notmatch "^(?i)$([regex]::Escape($brandSafe))[-_]" ) {
        $base = "$brandSafe-$base"
    }
    return "$base$ext"
}

$archives = Get-ChildItem -LiteralPath $Cleaned -Recurse -File | Where-Object { $_.Extension.ToLowerInvariant() -in @('.rar','.zip','.7z') }
if (-not $archives) {
    Write-Host 'لم أجد ملفات RAR/ZIP/7Z داخل المجلد.' -ForegroundColor Red
    Read-Host 'اضغط Enter للخروج'
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
        $b = [IO.Path]::GetFileNameWithoutExtension($safe)
        $candidate = "$b-$i$ext"
        $i++
    }
    $used[$candidate.ToLowerInvariant()] = $true
    $preview += [pscustomobject]@{
        Brand = $brand
        Model = $display
        Source = $a.FullName
        DestinationFile = $candidate
        SizeMB = [math]::Round($a.Length / 1MB, 2)
        Status = if ($a.Length -gt $MaxBytes) { 'SKIP_TOO_LARGE' } else { 'READY' }
    }
}

$previewPath = Join-Path $ReportDir 'import-preview.csv'
$preview | Sort-Object Brand,Model | Export-Csv -LiteralPath $previewPath -NoTypeInformation -Encoding UTF8

Write-Host ''
Write-Host "وجدت $($preview.Count) ملفًا." -ForegroundColor Green
$groups = $preview | Group-Object Brand | Sort-Object Name
foreach ($g in $groups) { Write-Host ("  {0,-12} {1,4}" -f $g.Name,$g.Count) }
$large = @($preview | Where-Object Status -eq 'SKIP_TOO_LARGE')
Write-Host ''
Write-Host "ملف المعاينة: $previewPath" -ForegroundColor Cyan
if ($large.Count -gt 0) {
    Write-Host "سيتم تخطي $($large.Count) ملفًا أكبر من 24MB." -ForegroundColor Yellow
}
Write-Host ''
$answer = Read-Host 'هل تريد المتابعة والنسخ إلى الموقع؟ اكتب Y للموافقة'
if ($answer.ToUpperInvariant() -ne 'Y') {
    Write-Host 'تم الإيقاف بدون تعديل الموقع.' -ForegroundColor Yellow
    Read-Host 'اضغط Enter للخروج'
    exit 0
}

if (Test-Path -LiteralPath $BoardsJson) {
    $existing = @(Get-Content -LiteralPath $BoardsJson -Raw -Encoding UTF8 | ConvertFrom-Json)
} else {
    $existing = @()
}

$newEntries = @()
foreach ($p in ($preview | Where-Object Status -eq 'READY')) {
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

# Keep current manually curated entries, then add only new destination filenames.
$knownFiles = @{}
foreach ($e in $existing) { if ($e.file) { $knownFiles[$e.file.ToLowerInvariant()] = $true } }
$merged = @($existing)
foreach ($e in $newEntries) {
    if (-not $knownFiles.ContainsKey($e.file.ToLowerInvariant())) {
        $merged += $e
        $knownFiles[$e.file.ToLowerInvariant()] = $true
    }
}

$merged | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $BoardsJson -Encoding UTF8

Write-Host ''
Write-Host "تم نسخ $($newEntries.Count) ملفًا وتحديث boards.json." -ForegroundColor Green
Write-Host 'الآن سيتم رفع التغييرات إلى GitHub تلقائيًا.' -ForegroundColor Cyan

Push-Location $RepoRoot
try {
    git add public/downloads public/data/boards.json
    if ((git status --porcelain).Length -eq 0) {
        Write-Host 'لا توجد تغييرات جديدة للرفع.' -ForegroundColor Yellow
    } else {
        git commit -m "Bulk import cleaned BoardView archives"
        git push origin main
        if ($LASTEXITCODE -ne 0) { throw 'git push failed' }
        Write-Host ''
        Write-Host 'تم الرفع إلى GitHub. Cloudflare سيبدأ النشر تلقائيًا.' -ForegroundColor Green
    }
} finally {
    Pop-Location
}

Write-Host ''
Write-Host 'ملاحظة: الملفات غير المعروفة توضع تحت قسم Other، ويمكن مراجعتها لاحقًا.'
Read-Host 'اضغط Enter للإغلاق'
