$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$PublicDir = Join-Path $RepoRoot 'public'
$BoardsJson = Join-Path $PublicDir 'data\boards.json'
$BoardsLargeJson = Join-Path $PublicDir 'data\boards-large.json'
$Output = Join-Path $PublicDir 'sitemap.xml'
$DirectoryOutput = Join-Path $PublicDir 'boardview\directory.html'
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

function Escape-Html([string]$Value) {
    return [Net.WebUtility]::HtmlEncode($Value)
}

$staticPaths = @(
    '/',
    '/boardview/index.html',
    '/boardview/featured.html',
    '/boardview/directory.html',
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
$directoryItems = New-Object System.Collections.ArrayList

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
    $path = "/boardview/item/$key/$slug"
    [void]$boardUrls.Add($path)

    [void]$directoryItems.Add([PSCustomObject]@{
        Brand = $brand
        Model = ([string]$b.model).Trim()
        Board = ([string]$b.board).Trim()
        Revision = ([string]$b.revision).Trim()
        Type = ([string]$b.type).Trim()
        Path = $path
    })
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

$directoryLines = New-Object System.Collections.ArrayList
[void]$directoryLines.Add('<!doctype html>')
[void]$directoryLines.Add('<html lang="ar" dir="rtl">')
[void]$directoryLines.Add('<head>')
[void]$directoryLines.Add('<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">')
[void]$directoryLines.Add('<title>فهرس جميع ملفات BoardView | PC Board Repair</title>')
[void]$directoryLines.Add('<meta name="description" content="فهرس ثابت لجميع ملفات BoardView في PC Board Repair مرتب حسب الشركة لتسهيل وصول الزوار ومحركات البحث إلى صفحات الملفات.">')
[void]$directoryLines.Add('<meta name="robots" content="index,follow">')
[void]$directoryLines.Add("<link rel=\"canonical\" href=\"$Site/boardview/directory.html\">")
[void]$directoryLines.Add('<link rel="stylesheet" href="../style.css"><link rel="stylesheet" href="../boardview-extra.css">')
[void]$directoryLines.Add('</head>')
[void]$directoryLines.Add('<body>')
[void]$directoryLines.Add('<header><a class="logo" href="../index.html">⚙️ PC Board Repair</a><nav><a href="../index.html">الرئيسية</a><a href="index.html">BoardView</a><a href="featured.html">ملفات مختارة</a><a href="../diagnostics/index.html">التشخيص</a></nav></header>')
[void]$directoryLines.Add('<main class="wrap">')
[void]$directoryLines.Add('<div class="crumb"><a href="../index.html">الرئيسية</a> ← <a href="index.html">BoardView</a> ← الفهرس الكامل</div>')
[void]$directoryLines.Add('<h1>🗂️ فهرس جميع ملفات BoardView</h1>')
[void]$directoryLines.Add("<p class=\"muted\">يتضمن هذا الفهرس $($directoryItems.Count) ملفًا، بروابط HTML ثابتة مباشرة إلى صفحات الملفات. استخدم بحث المتصفح للعثور على الشركة أو الموديل أو رقم البورد.</p>")

$groups = @($directoryItems | Sort-Object Brand, Model, Board, Revision | Group-Object Brand)
foreach ($group in $groups) {
    $brandName = Escape-Html ([string]$group.Name)
    [void]$directoryLines.Add("<section class=\"sectionBlock\"><h2>$brandName <span class=\"countBadge\">$($group.Count)</span></h2><ul>")
    foreach ($item in $group.Group) {
        $labelParts = New-Object System.Collections.ArrayList
        if (-not [string]::IsNullOrWhiteSpace($item.Model)) { [void]$labelParts.Add($item.Model) }
        if (-not [string]::IsNullOrWhiteSpace($item.Board) -and $item.Board -ne $item.Model) { [void]$labelParts.Add($item.Board) }
        if (-not [string]::IsNullOrWhiteSpace($item.Revision)) { [void]$labelParts.Add($item.Revision) }
        if (-not [string]::IsNullOrWhiteSpace($item.Type)) { [void]$labelParts.Add($item.Type) }
        if ($labelParts.Count -eq 0) { [void]$labelParts.Add('BoardView') }
        $label = Escape-Html (($labelParts.ToArray()) -join ' • ')
        $href = Escape-Html ([string]$item.Path)
        [void]$directoryLines.Add("<li><a href=\"$href\">$label</a></li>")
    }
    [void]$directoryLines.Add('</ul></section>')
}

[void]$directoryLines.Add('</main>')
[void]$directoryLines.Add('<footer><div class="footerLinks"><a href="index.html">BoardView</a><a href="featured.html">ملفات مختارة</a><a href="../diagnostics/index.html">التشخيص</a><a href="../contact.html">اتصل بنا</a><a href="../privacy.html">سياسة الخصوصية</a></div><div>© 2026 PC Board Repair</div></footer>')
[void]$directoryLines.Add('</body></html>')

[IO.File]::WriteAllLines($DirectoryOutput, @($directoryLines.ToArray()), (New-Object Text.UTF8Encoding($false)))
Write-Host ("Static sitemap built: {0} URL(s)" -f $urls.Count) -ForegroundColor Green
Write-Host ("Static BoardView directory built: {0} file link(s)" -f $directoryItems.Count) -ForegroundColor Green
Write-Host $Output -ForegroundColor DarkGray
Write-Host $DirectoryOutput -ForegroundColor DarkGray
