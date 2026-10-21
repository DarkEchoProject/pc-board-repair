$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$script:failed = $false

function Pass([string]$message) {
    Write-Host "[PASS] $message" -ForegroundColor Green
}

function Fail([string]$message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    $script:failed = $true
}

function Check-File([string]$path, [long]$minBytes = 1) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Fail "Missing file: $path"
        return
    }
    $length = (Get-Item -LiteralPath $path).Length
    if ($length -lt $minBytes) {
        Fail "File is too small or empty: $path ($length bytes)"
        return
    }
    Pass "$path ($length bytes)"
}

function Check-Absent([string]$path) {
    if (Test-Path -LiteralPath $path) {
        Fail "Legacy/dead file should not exist: $path"
        return
    }
    Pass "Legacy/dead file absent: $path"
}

function Ensure-GeneratedSeoArtifacts {
    $builder = Join-Path $root 'BUILD-SITEMAP.ps1'
    $sitemapPath = Join-Path $root 'public\sitemap.xml'
    $directoryPath = Join-Path $root 'public\boardview\directory.html'
    $directoryUrl = 'https://pc-board-repair.alinasser00001.workers.dev/boardview/directory.html'
    $needsBuild = $false

    if (-not (Test-Path -LiteralPath $directoryPath -PathType Leaf)) {
        $needsBuild = $true
    }
    elseif (-not (Test-Path -LiteralPath $sitemapPath -PathType Leaf)) {
        $needsBuild = $true
    }
    else {
        try {
            $sitemapText = Get-Content -LiteralPath $sitemapPath -Raw -Encoding UTF8
            if (-not $sitemapText.Contains("<loc>$directoryUrl</loc>")) {
                $needsBuild = $true
            }
        }
        catch {
            $needsBuild = $true
        }
    }

    if (-not $needsBuild) { return }

    if (-not (Test-Path -LiteralPath $builder -PathType Leaf)) {
        Write-Host '[FAIL] Missing BUILD-SITEMAP.ps1; generated SEO artifacts cannot be refreshed.' -ForegroundColor Red
        exit 1
    }

    Write-Host 'Refreshing generated sitemap and BoardView crawl directory before pre-deploy checks...' -ForegroundColor Cyan
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $builder
    if ($LASTEXITCODE -ne 0) {
        Write-Host '[FAIL] BUILD-SITEMAP.ps1 failed; pre-deploy checks cannot continue.' -ForegroundColor Red
        exit 1
    }
    Write-Host ''
}

Ensure-GeneratedSeoArtifacts

Write-Host "=========================================="
Write-Host "PC Board Repair - Pre-deploy checks"
Write-Host "=========================================="
Write-Host ""

Write-Host "Checking required project files..."
Check-File 'wrangler.toml' 100
Check-File 'DEPLOY-SITE.cmd' 100
Check-File 'BUILD-SITEMAP.ps1' 100
Check-File 'scripts\build-sitemap.mjs' 1000
Check-File 'src\index.js' 100
Check-File 'src\app.js' 100
Check-File 'src\entry.js' 100
Check-File 'src\seo-entry.js' 100
Check-File 'src\header-entry.js' 100

$requiredPages = @(
    'public\index.html',
    'public\boardview\index.html',
    'public\boardview\featured.html',
    'public\boardview\directory.html',
    'public\bios\index.html',
    'public\diagnostics\index.html',
    'public\component-testing\index.html',
    'public\community.html',
    'public\contact.html',
    'public\privacy.html',
    'public\login.html',
    'public\404.html'
)

foreach ($page in $requiredPages) {
    Check-File $page 100
}

Write-Host ""
Write-Host "Checking sitemap and crawl-directory output..."
Check-File 'public\sitemap.xml' 100
Check-File 'public\boardview\directory.html' 10000

if (Test-Path -LiteralPath 'public\sitemap.xml' -PathType Leaf) {
    try {
        $sitemap = Get-Content -LiteralPath 'public\sitemap.xml' -Raw -Encoding UTF8
        $featuredUrl = 'https://pc-board-repair.alinasser00001.workers.dev/boardview/featured.html'
        $directoryUrl = 'https://pc-board-repair.alinasser00001.workers.dev/boardview/directory.html'
        if ($sitemap.Contains("<loc>$featuredUrl</loc>")) {
            Pass 'sitemap.xml includes the featured BoardView page'
        }
        else {
            Fail 'sitemap.xml is stale: featured BoardView page is missing'
        }
        if ($sitemap.Contains("<loc>$directoryUrl</loc>")) {
            Pass 'sitemap.xml includes the BoardView crawl directory'
        }
        else {
            Fail 'sitemap.xml is stale: BoardView crawl directory is missing'
        }
    }
    catch {
        Fail "Could not inspect public\sitemap.xml - $($_.Exception.Message)"
    }
}

if (Test-Path -LiteralPath 'public\boardview\directory.html' -PathType Leaf) {
    try {
        $directoryHtml = Get-Content -LiteralPath 'public\boardview\directory.html' -Raw -Encoding UTF8
        $directoryLinkCount = ([regex]::Matches($directoryHtml, 'href="/boardview/item/')).Count
        if ($directoryLinkCount -gt 100) {
            Pass "BoardView crawl directory contains $directoryLinkCount direct file links"
        }
        else {
            Fail "BoardView crawl directory looks unexpectedly small: $directoryLinkCount direct file links"
        }
    }
    catch {
        Fail "Could not inspect public\boardview\directory.html - $($_.Exception.Message)"
    }
}

Write-Host ""
Write-Host "Checking legacy/dead code cleanup..."
Check-Absent 'public\i18n-v2.js'
Check-Absent 'public\header-ui-stabilizer.js'

try {
    $indexWorker = Get-Content -LiteralPath 'src\index.js' -Raw -Encoding UTF8
    if ($indexWorker -match '\bsitemapResponse\b' -or $indexWorker -match '\bescapeXml\b') {
        Fail 'src\index.js contains legacy dynamic sitemap code'
    }
    else {
        Pass 'src\index.js has no legacy dynamic sitemap implementation'
    }
}
catch {
    Fail "Could not inspect src\index.js for legacy code - $($_.Exception.Message)"
}

try {
    $appWorker = Get-Content -LiteralPath 'src\app.js' -Raw -Encoding UTF8
    if ($appWorker -match 'url\.pathname\s*-eq\s*["'']/sitemap\.xml["'']' -or $appWorker -match 'url\.pathname\s*===\s*["'']/sitemap\.xml["'']' -or $appWorker -match '\bauthRedirect\b') {
        Fail 'src\app.js contains legacy sitemap or duplicate download-auth code'
    }
    else {
        Pass 'src\app.js has no legacy sitemap or duplicate download-auth implementation'
    }
}
catch {
    Fail "Could not inspect src\app.js for legacy code - $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Checking deploy configuration..."

try {
    $wrangler = Get-Content -LiteralPath 'wrangler.toml' -Raw -Encoding UTF8
    if ($wrangler -match '(?m)^\s*main\s*=\s*["'']src/header-entry\.js["'']\s*$') {
        Pass 'wrangler.toml uses src/header-entry.js as the Worker entry point'
    }
    else {
        Fail 'wrangler.toml Worker entry point is not src/header-entry.js'
    }
}
catch {
    Fail "Could not read wrangler.toml - $($_.Exception.Message)"
}

try {
    $deployScript = Get-Content -LiteralPath 'DEPLOY-SITE.cmd' -Raw -Encoding UTF8
    if ($deployScript -match '(?i)--assets\s+public') {
        Fail 'DEPLOY-SITE.cmd still contains --assets public; use wrangler.toml asset configuration instead'
    }
    else {
        Pass 'DEPLOY-SITE.cmd does not override assets with --assets public'
    }
}
catch {
    Fail "Could not read DEPLOY-SITE.cmd - $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Checking data files..."

$jsonFiles = @(
    'public\data\boards.json',
    'public\data\boards-large.json',
    'public\data\videos.json'
)

foreach ($file in $jsonFiles) {
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) {
        Fail "Missing JSON file: $file"
        continue
    }
    try {
        $raw = Get-Content -LiteralPath $file -Raw -Encoding UTF8
        $null = ConvertFrom-Json -InputObject $raw
        Pass "Valid JSON: $file"
    }
    catch {
        Fail "Invalid JSON: $file - $($_.Exception.Message)"
    }
}

try {
    $boardsRaw = Get-Content -LiteralPath 'public\data\boards.json' -Raw -Encoding UTF8
    $boards = ConvertFrom-Json -InputObject $boardsRaw
    $boardCount = if ($null -eq $boards) { 0 } elseif ($boards -is [System.Array]) { $boards.Length } else { 1 }
    if ($boardCount -gt 100) {
        Pass "Primary BoardView database contains $boardCount records"
    }
    else {
        Fail "Primary BoardView database looks unexpectedly small: $boardCount records"
    }
}
catch {
    # JSON error already reported above.
}

try {
    $largeRaw = Get-Content -LiteralPath 'public\data\boards-large.json' -Raw -Encoding UTF8
    $largeBoards = ConvertFrom-Json -InputObject $largeRaw
    $largeCount = if ($null -eq $largeBoards) { 0 } elseif ($largeBoards -is [System.Array]) { $largeBoards.Length } else { 1 }
    if ($largeCount -gt 0) {
        Pass "Large BoardView database contains $largeCount records"
    }
    else {
        Fail 'Large BoardView database is empty'
    }
}
catch {
    # JSON error already reported above.
}

Write-Host ""
Write-Host "Checking downloadable tools..."

Check-File 'public\downloads\flexbv-free-5.3162-win64.zip' 100000
Check-File 'public\downloads\openboardview-10.0.0-win32.zip' 1000000

$openBoardView = 'public\downloads\openboardview-10.0.0-win32.zip'
if (Test-Path -LiteralPath $openBoardView -PathType Leaf) {
    $expected = '8fa420c325d05b6a032a8324438ff74950783f32a37c862224047445ad2f9c1f'
    $actual = (Get-FileHash -LiteralPath $openBoardView -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -eq $expected) {
        Pass 'OpenBoardView SHA256 matches the official release'
    }
    else {
        Fail "OpenBoardView SHA256 mismatch: $actual"
    }
}

Write-Host ""
Write-Host "Checking JavaScript syntax..."

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if (-not $node) {
    Fail 'Node.js was not found'
}
else {
    $jsFiles = @(
        Get-ChildItem -LiteralPath 'src' -Recurse -File -Filter '*.js'
        Get-ChildItem -LiteralPath 'public' -Recurse -File -Filter '*.js'
        Get-Item -LiteralPath 'scripts\build-sitemap.mjs' -ErrorAction SilentlyContinue
    ) | Where-Object { $null -ne $_ } | Sort-Object FullName -Unique

    if (-not $jsFiles.Count) {
        Fail 'No JavaScript files were found to validate'
    }
    else {
        foreach ($js in $jsFiles) {
            & node.exe --check $js.FullName 2>&1 | Out-Host
            $relative = $js.FullName.Substring($root.Length).TrimStart('\')
            if ($LASTEXITCODE -eq 0) {
                Pass "Syntax OK: $relative"
            }
            else {
                Fail "JavaScript syntax error: $relative"
            }
        }
    }
}

Write-Host ""
if ($script:failed) {
    Write-Host "PRE-DEPLOY CHECK FAILED. Deployment has been stopped." -ForegroundColor Red
    exit 1
}

Write-Host "ALL PRE-DEPLOY CHECKS PASSED." -ForegroundColor Green
exit 0