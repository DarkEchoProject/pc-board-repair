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

Write-Host "=========================================="
Write-Host "PC Board Repair - Pre-deploy checks"
Write-Host "=========================================="
Write-Host ""

$requiredPages = @(
    'public\index.html',
    'public\boardview\index.html',
    'public\bios\index.html',
    'public\diagnostics\index.html',
    'public\component-testing\index.html',
    'public\community.html',
    'public\login.html',
    'public\404.html'
)

foreach ($page in $requiredPages) {
    Check-File $page 100
}

Write-Host ""
Write-Host "Checking data files..."

$jsonFiles = @(
    'public\data\boards.json',
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
        Pass "BoardView database contains $boardCount records"
    }
    else {
        Fail "BoardView database looks unexpectedly small: $boardCount records"
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
    $jsFiles = @('src\index.js', 'src\app.js', 'src\entry.js')
    foreach ($js in $jsFiles) {
        & node.exe --check $js 2>&1 | Out-Host
        if ($LASTEXITCODE -eq 0) {
            Pass "Syntax OK: $js"
        }
        else {
            Fail "JavaScript syntax error: $js"
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
