$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$public = Join-Path $root 'public'
$jsonPath = Join-Path $public 'data\boards.json'
$downloads = Join-Path $public 'downloads'
$images = Join-Path $public 'images'

function Clean-Path([string]$p) { return $p.Trim().Trim('"').Trim("'") }
function Safe-Name([string]$name) {
    $n = $name -replace '[^A-Za-z0-9._-]', '-'
    $n = $n -replace '-+', '-'
    return $n.Trim('-')
}
function Copy-WithName([string]$source,[string]$destDir) {
    $source = Clean-Path $source
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "File not found: $source" }
    $ext = [IO.Path]::GetExtension($source)
    $base = Safe-Name ([IO.Path]::GetFileNameWithoutExtension($source))
    if ([string]::IsNullOrWhiteSpace($base)) { $base = 'file' }
    $name = $base + $ext.ToLower()
    $dest = Join-Path $destDir $name
    if (Test-Path -LiteralPath $dest) {
        $ans = Read-Host "File $name already exists. Replace it? y/n"
        if ($ans -notmatch '^(y|yes)$') { throw 'Add cancelled because the file already exists.' }
    }
    Copy-Item -LiteralPath $source -Destination $dest -Force
    return $name
}

Clear-Host
Write-Host '=========================================='
Write-Host ' Add a new board - PC Board Repair'
Write-Host '=========================================='
Write-Host 'Supported board files: BRD, FZ, ZIP, RAR, 7Z.'
Write-Host 'Tip: drag the BoardView file/archive or image into this window, then press Enter.'
Write-Host ''

$brand = (Read-Host 'Brand (example: HP)').Trim()
$model = (Read-Host 'Model (example: Stream Notebook 11)').Trim()
$board = (Read-Host 'Board/PCB number').Trim()
$revision = (Read-Host 'Revision (optional)').Trim()
$platform = (Read-Host 'Platform (optional, example: QUANTA Y0H)').Trim()
$boardFilePath = Read-Host 'Drag the BRD/FZ/ZIP/RAR/7Z BoardView file here and press Enter'
$fileName = Copy-WithName $boardFilePath $downloads
$fileExt = [IO.Path]::GetExtension($fileName).ToLowerInvariant()
$defaultType = switch ($fileExt) {
    '.brd' { 'BoardView BRD' }
    '.fz'  { 'BoardView FZ' }
    default { 'BoardView archive' }
}
$type = (Read-Host "File type [$defaultType]").Trim(); if (-not $type) { $type=$defaultType }

$imageName = ''
$imagePath = Read-Host 'Drag board image here, or press Enter to skip'
if (-not [string]::IsNullOrWhiteSpace($imagePath)) { $imageName = Copy-WithName $imagePath $images }
$note = (Read-Host 'Short note (optional)').Trim()

if (-not (Test-Path $jsonPath)) { '[]' | Set-Content -Encoding UTF8 $jsonPath }
$raw = Get-Content -Raw -Encoding UTF8 $jsonPath
$current = @()
if (-not [string]::IsNullOrWhiteSpace($raw)) { $current = @($raw | ConvertFrom-Json) }
$newItem = [PSCustomObject]@{
    brand=$brand; model=$model; board=$board; revision=$revision; platform=$platform;
    type=$type; file=$fileName; image=$imageName; note=$note;
    added_at=[DateTime]::UtcNow.ToString('o')
}
$current += $newItem
$json = $current | ConvertTo-Json -Depth 6
[IO.File]::WriteAllText($jsonPath, $json, (New-Object Text.UTF8Encoding($false)))

Write-Host ''
Write-Host 'BOARD ADDED SUCCESSFULLY.' -ForegroundColor Green
Write-Host "File: public\downloads\$fileName"
Write-Host "Type: $type"
if ($imageName) { Write-Host "Image: public\images\$imageName" }
Write-Host 'No HTML editing is required.' -ForegroundColor Cyan
Write-Host 'The new board will appear automatically in the Latest Files section.' -ForegroundColor Cyan
Write-Host ''
$deploy = Read-Host 'Deploy the updated site to Cloudflare now? y/n'
if ($deploy -match '^(y|yes)$') {
    Push-Location $root
    try {
        & npx.cmd wrangler deploy --assets public --name pc-board-repair
        if ($LASTEXITCODE -ne 0) { throw "Wrangler deploy failed with exit code $LASTEXITCODE" }
    } finally { Pop-Location }
}
