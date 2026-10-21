$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PublicDir = Join-Path $RepoRoot 'public'
$BoardsJson = Join-Path $PublicDir 'data\boards.json'
$BoardsLargeJson = Join-Path $PublicDir 'data\boards-large.json'
$Output = Join-Path $PublicDir 'sitemap.xml'
$Site = 'https://pc-board-repair.alinasser00001.workers.dev'

function Read-JsonArray([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return @() }
    $raw = Get-Content -LiteralPath $Path -Raw -Encoding UTF8
    if ([string]::IsNullOrWhiteSpace($raw)) { return @() }
    $parsed = ConvertFrom-Json -InputObject $raw
    $out = New-Object System.Collections.ArrayList
    foreach ($item in @($parsed)) {
        if ($null -eq $item) { continue }
        if ($null -ne $item.PSObject.Properties['value'] -and $item.value -is [System.Array]) {
            foreach ($nested in @($item.value)) { if ($null -ne $nested) { [void]$out.Add($nested) } }
        } else {
            [void]$out.Add($item)
        }
    }
    return @($out.ToArray())
}

function Get-FileKey([string]$Value) {
    [uint32]$h = 2166136261
    [uint64]$mod32 = 4294967296
    foreach ($ch in $Value.ToCharArray()) {
        $h = [uint32]($h -bxor [uint32][char]$ch)
        $product = [uint64]$h * [uint64]16777619
        $h = [uint32]($product % $mod32)
    }
    if ($h -eq 0) { return '0' }
    $digits = '0123456789abcdefghijklmnopqrstuvwxyz'
    [uint64]$n = $h
    $result = ''
    while ($n -gt 0) {
        $rem = [int]($n % 36)
        $result = $digits[$rem] + $result
        $n = [math]::Floor($n / 36)
    }
    return $result
}

function Get-TextSlug([string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) { return 'boardview' }
    $normalized = $Value.Normalize([Text.NormalizationForm]::FormKD).ToLowerInvariant()
    $sb = New-Object Text.StringBuilder
    foreach ($ch in $normalized.ToCharArray()) {
        $cat = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
        if ($cat -eq [Globalization.UnicodeCategory]::NonSpacingMark) { continue }
        if (($ch -ge 'a' -and $ch -le 'z') -or ($ch -ge '0' -and $ch -le '9')) {
            [void]$sb.Append($ch)
        } else {
            [void]$sb.Append('-')
        }
    }
    $slug = ($sb.ToString() -replace '-+','-').Trim('-')
    if ($slug.Length -gt 120) { $slug = $slug.Substring(0,120).Trim('-') }
    if ([string]::IsNullOrWhiteSpace($slug)) { return 'boardview' }
    return $slug
}

function Escape-Xml([string]$Value) {
    return [Security.SecurityElement]::Escape($Value)
}

$staticPaths = @(
    '/',
    '/boardview/index.html',
    '/boardview/featured.html',
    '/boardview/hp-compaq-dc5800-c453-vrm-repair.html',
    '/bios/index.html',
    '/bios/intel.html',
    '/community.html',
    '/about.html',
    '/contact.html',
    '/privacy.html',
    '/terms.html',
    '/disclaimer.html',
    '/copyright.html',
    '/diagnostics/index.html',
    '/diagnostics/no-power.html',
    '/diagnostics/no-display.html',
    '/diagnostics/restarts-shuts-down.html',
    '/diagnostics/short-circuit.html',
    '/diagnostics/post-beep-codes.html',
    '/diagnostics/vrm-cpu-ram.html',
    '/component-testing/index.html'
)

$all = @((Read-JsonArray $BoardsJson) + (Read-JsonArray $BoardsLargeJson))
$seenFiles = @{}
$boardUrls = New-Object System.Collections.ArrayList

foreach ($b in $all) {
    $brand = ([string]$b.brand).Trim()
    $file = ([string]$b.file).Trim()
    if ([string]::IsNullOrWhiteSpace($brand) -or [string]::IsNullOrWhiteSpace($file)) { continue }
    $fileKey = $file.ToLowerInvariant()
    if ($seenFiles.ContainsKey($fileKey)) { continue }
    $seenFiles[$fileKey] = $true

    $parts = @([string]$b.brand, [string]$b.model, [string]$b.board, [string]$b.revision) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    $slug = Get-TextSlug ($parts -join '-')
    $key = Get-FileKey $file
    [void]$boardUrls.Add("/boardview/item/$key/$slug")
}

$urls = @($staticPaths + @($boardUrls.ToArray())) | Select-Object -Unique
$lines = New-Object System.Collections.ArrayList
[void]$lines.Add('<?xml version="1.0" encoding="UTF-8"?>')
[void]$lines.Add('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
foreach ($path in $urls) {
    [void]$lines.Add("  <url><loc>$(Escape-Xml ($Site + $path))</loc></url>")
}
[void]$lines.Add('</urlset>')

[IO.File]::WriteAllLines($Output, @($lines.ToArray()), (New-Object Text.UTF8Encoding($false)))
Write-Host ("Static sitemap built: {0} URL(s)" -f $urls.Count) -ForegroundColor Green
Write-Host $Output -ForegroundColor DarkGray
