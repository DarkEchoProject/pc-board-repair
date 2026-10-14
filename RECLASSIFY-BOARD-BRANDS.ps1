$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$BoardsJson = Join-Path $RepoRoot 'public\data\boards.json'
$ReportDir = Join-Path $RepoRoot '_IMPORT_REPORT'

function Normalize-Boards($Data) {
    $result = New-Object System.Collections.ArrayList
    foreach ($item in @($Data)) {
        if ($null -eq $item) { continue }
        if ($null -ne $item.PSObject.Properties['value'] -and $null -ne $item.value) {
            foreach ($inner in @($item.value)) {
                if ($null -ne $inner) { [void]$result.Add($inner) }
            }
        }
        else { [void]$result.Add($item) }
    }
    return @($result.ToArray())
}

function Get-Text($Item) {
    return (@(
        [string]$Item.file,
        [string]$Item.model,
        [string]$Item.board,
        [string]$Item.platform,
        [string]$Item.note
    ) -join ' ').ToLowerInvariant()
}

function Detect-Brand($Item) {
    $n = Get-Text $Item

    # OEM / retail brands first. This prevents e.g. "HP ... QUANTA" from becoming Quanta.
    if ($n -match 'asrock|\b70[-_ ]mx[a-z0-9]+') { return 'ASRock' }
    if ($n -match 'asus|\b60nb|rog\b|maximus|prime\b|strix\b|tuf\b') { return 'ASUS' }
    if ($n -match 'acer|aspire|travelmate|predator') { return 'Acer' }
    if ($n -match 'gigabyte|aorus|\bga[-_ ][a-z0-9]') { return 'Gigabyte' }
    if ($n -match '\bmsi\b|\bms[-_ ]?[0-9a-z]{3,6}\b') { return 'MSI' }
    if ($n -match 'hewlett|\bhp\b|compaq|probook|elitebook|pavilion|prodesk|elitedesk|omen\b|zbook') { return 'HP' }
    if ($n -match '\bdell\b|optiplex|latitude|inspiron|vostro|precision|alienware') { return 'Dell' }
    if ($n -match 'lenovo|thinkpad|ideapad|thinkcentre|legion\b|yoga\b') { return 'Lenovo' }
    if ($n -match '\bintel\b|dh55pj|dq[0-9]{2}|dg[0-9]{2}') { return 'Intel' }
    if ($n -match 'biostar') { return 'Biostar' }
    if ($n -match '\becs\b|elitegroup') { return 'ECS' }
    if ($n -match 'apple|macbook|imac|mac mini') { return 'Apple' }
    if ($n -match 'samsung') { return 'Samsung' }
    if ($n -match 'toshiba|satellite|portege|tecra') { return 'Toshiba' }
    if ($n -match 'sony|vaio') { return 'Sony' }
    if ($n -match 'panasonic|toughbook') { return 'Panasonic' }
    if ($n -match 'huawei|matebook') { return 'Huawei' }
    if ($n -match 'clevo') { return 'Clevo' }
    if ($n -match 'medion') { return 'Medion' }
    if ($n -match 'fujitsu') { return 'Fujitsu' }

    # Board manufacturers / ODMs. Used only when no OEM can be detected.
    if ($n -match 'compal|\bla[-_ ]?[a-z0-9]{3,6}\b') { return 'Compal' }
    if ($n -match 'quanta|\bda0[a-z0-9]{5,}\b') { return 'Quanta' }
    if ($n -match 'wistron') { return 'Wistron' }
    if ($n -match 'inventec') { return 'Inventec' }
    if ($n -match 'pegatron') { return 'Pegatron' }
    if ($n -match 'foxconn') { return 'Foxconn' }
    if ($n -match 'huaqin') { return 'Huaqin' }
    if ($n -match '\blcfc\b') { return 'LCFC' }
    if ($n -match 'ecs[-_ ]?tech|unisys') { return 'ECS' }
    if ($n -match 'tongfang') { return 'Tongfang' }
    if ($n -match 'uniwill') { return 'Uniwill' }

    return ''
}

function Is-GenericBrand([string]$Brand) {
    $b = ([string]$Brand).Trim().ToLowerInvariant()
    return [string]::IsNullOrWhiteSpace($b) -or $b -in @('other','unknown','generic','odm','unclassified')
}

if (-not (Test-Path -LiteralPath $BoardsJson -PathType Leaf)) {
    throw "boards.json not found: $BoardsJson"
}

New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$rawText = Get-Content -LiteralPath $BoardsJson -Raw -Encoding UTF8
$data = $rawText | ConvertFrom-Json
$items = @(Normalize-Boards $data)

$changes = New-Object System.Collections.ArrayList
foreach ($item in $items) {
    $oldBrand = [string]$item.brand
    if (-not (Is-GenericBrand $oldBrand)) { continue }

    $newBrand = Detect-Brand $item
    if ([string]::IsNullOrWhiteSpace($newBrand)) { continue }

    [void]$changes.Add([pscustomobject]@{
        File = [string]$item.file
        OldBrand = $oldBrand
        NewBrand = $newBrand
        Model = [string]$item.model
        Board = [string]$item.board
        Platform = [string]$item.platform
    })
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$reportPath = Join-Path $ReportDir ("brand-reclassify-preview-$stamp.csv")
$changes | Export-Csv -LiteralPath $reportPath -NoTypeInformation -Encoding UTF8

Write-Host ''
Write-Host '===================================================' -ForegroundColor Cyan
Write-Host ' PC Board Repair - Brand Reclassification Preview' -ForegroundColor Cyan
Write-Host '===================================================' -ForegroundColor Cyan
Write-Host ('Database entries : {0}' -f $items.Count)
Write-Host ('Proposed changes : {0}' -f $changes.Count) -ForegroundColor $(if ($changes.Count -gt 0) { 'Green' } else { 'Yellow' })
Write-Host ('Preview report   : {0}' -f $reportPath)
Write-Host ''

if ($changes.Count -eq 0) {
    Write-Host 'No Other/Unknown/Generic entries could be safely reclassified.' -ForegroundColor Green
    Read-Host 'Press Enter to close'
    exit 0
}

$changes | Select-Object -First 25 | Format-Table -AutoSize
if ($changes.Count -gt 25) { Write-Host ('... plus {0} more. See CSV report.' -f ($changes.Count - 25)) -ForegroundColor DarkGray }

Write-Host ''
Write-Host 'Only the brand field in boards.json will change.' -ForegroundColor Yellow
Write-Host 'Download files and filenames will NOT be renamed or modified.' -ForegroundColor Yellow
$answer = Read-Host 'Type APPLY to save these changes'
if ($answer -ne 'APPLY') {
    Write-Host 'Stopped. Nothing was changed.' -ForegroundColor Yellow
    exit 0
}

$backupPath = Join-Path $ReportDir ("boards-before-brand-reclassify-$stamp.json")
Copy-Item -LiteralPath $BoardsJson -Destination $backupPath -Force

$lookup = @{}
foreach ($c in $changes) { $lookup[[string]$c.File.ToLowerInvariant()] = [string]$c.NewBrand }

foreach ($item in $items) {
    $file = [string]$item.file
    if ([string]::IsNullOrWhiteSpace($file)) { continue }
    $key = $file.ToLowerInvariant()
    if ($lookup.ContainsKey($key)) { $item.brand = $lookup[$key] }
}

$items | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $BoardsJson -Encoding UTF8

Write-Host ''
Write-Host 'DONE: brands were reclassified safely.' -ForegroundColor Green
Write-Host ('Backup: {0}' -f $backupPath)
Write-Host ('Report: {0}' -f $reportPath)
Write-Host ''
Write-Host 'Next: review git diff -- public/data/boards.json before committing.' -ForegroundColor Cyan
Read-Host 'Press Enter to close'
