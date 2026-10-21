$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$Site = 'https://pc-board-repair.alinasser00001.workers.dev'
$SitemapPath = 'public\sitemap.xml'
$DirectoryPath = 'public\boardview\directory.html'
$RobotsPath = 'public\robots.txt'
$BuilderPath = Join-Path $root 'BUILD-SITEMAP.ps1'
$script:failed = $false

function Pass([string]$message) {
    Write-Host "[PASS] $message" -ForegroundColor Green
}

function Fail([string]$message) {
    Write-Host "[FAIL] $message" -ForegroundColor Red
    $script:failed = $true
}

function Require-File([string]$path) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        Fail "Missing required SEO file: $path"
        return $false
    }
    return $true
}

Write-Host "=========================================="
Write-Host "PC Board Repair - SEO / Sitemap checks"
Write-Host "=========================================="
Write-Host ""

if (-not (Test-Path -LiteralPath $BuilderPath -PathType Leaf)) {
    Write-Host "[FAIL] Missing sitemap builder: BUILD-SITEMAP.ps1" -ForegroundColor Red
    exit 1
}

Write-Host "Refreshing generated sitemap and BoardView crawl directory..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $BuilderPath
if ($LASTEXITCODE -ne 0) {
    Write-Host "[FAIL] BUILD-SITEMAP.ps1 failed; SEO validation cannot continue." -ForegroundColor Red
    exit 1
}
Write-Host ""

if (-not (Require-File $SitemapPath)) { exit 1 }
if (-not (Require-File $DirectoryPath)) { exit 1 }
if (-not (Require-File $RobotsPath)) { exit 1 }

$sitemapRaw = Get-Content -LiteralPath $SitemapPath -Raw -Encoding UTF8
$directoryRaw = Get-Content -LiteralPath $DirectoryPath -Raw -Encoding UTF8
$robotsRaw = Get-Content -LiteralPath $RobotsPath -Raw -Encoding UTF8

# XML must be well formed and use the official sitemap namespace.
try {
    [xml]$sitemapXml = $sitemapRaw
    Pass 'sitemap.xml is well-formed XML'
}
catch {
    Fail "sitemap.xml is not valid XML - $($_.Exception.Message)"
}

if ($sitemapRaw -match '<urlset\s+xmlns="http://www\.sitemaps\.org/schemas/sitemap/0\.9"') {
    Pass 'sitemap.xml uses the official sitemap namespace'
}
else {
    Fail 'sitemap.xml is missing the official sitemap namespace'
}

$sitemapBytes = (Get-Item -LiteralPath $SitemapPath).Length
if ($sitemapBytes -lt 52428800) {
    Pass "sitemap.xml size is within the 50 MB limit ($sitemapBytes bytes)"
}
else {
    Fail "sitemap.xml exceeds the 50 MB uncompressed limit ($sitemapBytes bytes)"
}

$locMatches = [regex]::Matches($sitemapRaw, '<loc>(?<url>[^<]+)</loc>')
$urls = @($locMatches | ForEach-Object { [Net.WebUtility]::HtmlDecode($_.Groups['url'].Value.Trim()) })

if ($urls.Count -gt 0 -and $urls.Count -le 50000) {
    Pass "sitemap.xml contains $($urls.Count) URL(s), within the 50,000 URL limit"
}
else {
    Fail "sitemap.xml URL count is invalid: $($urls.Count)"
}

$duplicates = @($urls | Group-Object | Where-Object { $_.Count -gt 1 })
if ($duplicates.Count -eq 0) {
    Pass 'sitemap.xml contains no duplicate URLs'
}
else {
    Fail "sitemap.xml contains $($duplicates.Count) duplicate URL value(s)"
}

$invalidUrls = New-Object System.Collections.ArrayList
$forbiddenUrls = New-Object System.Collections.ArrayList
foreach ($urlText in $urls) {
    try {
        $u = [Uri]$urlText
        if ($u.Scheme -ne 'https' -or $u.Host -ne 'pc-board-repair.alinasser00001.workers.dev') {
            [void]$invalidUrls.Add($urlText)
            continue
        }
        $path = $u.AbsolutePath
        if ($path -match '^/(?:api|download|downloads)(?:/|$)' -or
            $path -eq '/login.html' -or
            $path -eq '/404.html' -or
            $path -match '^/admin(?:/|\.html$)') {
            [void]$forbiddenUrls.Add($urlText)
        }
    }
    catch {
        [void]$invalidUrls.Add($urlText)
    }
}

if ($invalidUrls.Count -eq 0) {
    Pass 'All sitemap URLs are valid HTTPS URLs on the canonical site host'
}
else {
    Fail "sitemap.xml contains $($invalidUrls.Count) invalid or off-site URL(s)"
}

if ($forbiddenUrls.Count -eq 0) {
    Pass 'sitemap.xml contains no API, download, login, admin, or 404 URLs'
}
else {
    Fail "sitemap.xml contains $($forbiddenUrls.Count) URL(s) that should not be indexed"
}

$featuredUrl = "$Site/boardview/featured.html"
$directoryUrl = "$Site/boardview/directory.html"
foreach ($requiredUrl in @($Site + '/', "$Site/boardview/index.html", $featuredUrl, $directoryUrl)) {
    if ($urls -contains $requiredUrl) {
        Pass "Required sitemap URL present: $requiredUrl"
    }
    else {
        Fail "Required sitemap URL missing: $requiredUrl"
    }
}

# Compare every BoardView item in sitemap.xml with the static HTML crawl directory.
$sitemapBoardPaths = @(
    [regex]::Matches($sitemapRaw, '<loc>https://pc-board-repair\.alinasser00001\.workers\.dev(?<path>/boardview/item/[^<]+)</loc>') |
        ForEach-Object { [Net.WebUtility]::HtmlDecode($_.Groups['path'].Value) }
)
$directoryBoardPaths = @(
    [regex]::Matches($directoryRaw, 'href="(?<path>/boardview/item/[^"]+)"') |
        ForEach-Object { [Net.WebUtility]::HtmlDecode($_.Groups['path'].Value) }
)

$sitemapBoardUnique = @($sitemapBoardPaths | Sort-Object -Unique)
$directoryBoardUnique = @($directoryBoardPaths | Sort-Object -Unique)

if ($sitemapBoardPaths.Count -eq $sitemapBoardUnique.Count) {
    Pass "BoardView sitemap URLs are unique ($($sitemapBoardUnique.Count))"
}
else {
    Fail 'Duplicate BoardView item URLs found in sitemap.xml'
}

if ($directoryBoardPaths.Count -eq $directoryBoardUnique.Count) {
    Pass "BoardView directory links are unique ($($directoryBoardUnique.Count))"
}
else {
    Fail 'Duplicate BoardView item links found in directory.html'
}

$differences = @(Compare-Object -ReferenceObject $sitemapBoardUnique -DifferenceObject $directoryBoardUnique)
if ($differences.Count -eq 0 -and $sitemapBoardUnique.Count -gt 100) {
    Pass "BoardView sitemap and HTML directory match exactly ($($sitemapBoardUnique.Count) item URLs)"
}
else {
    Fail "BoardView sitemap/directory mismatch: $($differences.Count) difference(s)"
}

if ($directoryRaw -match '<meta\s+name="robots"\s+content="index,follow"' -and
    $directoryRaw -match [regex]::Escape("<link rel=\"canonical\" href=\"$directoryUrl\">") ) {
    Pass 'BoardView directory is indexable and has the correct canonical URL'
}
else {
    Fail 'BoardView directory robots/canonical metadata is missing or incorrect'
}

if ($robotsRaw -match '(?im)^\s*User-agent:\s*\*\s*$' -and
    $robotsRaw -match '(?im)^\s*Allow:\s*/\s*$') {
    Pass 'robots.txt allows normal site crawling'
}
else {
    Fail 'robots.txt does not clearly allow normal crawling'
}

if ($robotsRaw -match [regex]::Escape("Sitemap: $Site/sitemap.xml")) {
    Pass 'robots.txt advertises the canonical sitemap URL'
}
else {
    Fail 'robots.txt does not advertise the canonical sitemap URL'
}

Write-Host ""
if ($script:failed) {
    Write-Host "SEO / SITEMAP CHECK FAILED. Deployment has been stopped." -ForegroundColor Red
    exit 1
}

Write-Host "ALL SEO / SITEMAP CHECKS PASSED." -ForegroundColor Green
exit 0
