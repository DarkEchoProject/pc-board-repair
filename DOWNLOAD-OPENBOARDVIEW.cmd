@echo off
setlocal
cd /d "%~dp0"

if not exist "public\downloads" mkdir "public\downloads"

echo Downloading OpenBoardView 10.0.0 for Windows...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$url='https://github.com/OpenBoardView/OpenBoardView/releases/download/10.0.0/openboardview-10.0.0-win32.zip';" ^
  "$out='public\downloads\openboardview-10.0.0-win32.zip';" ^
  "Invoke-WebRequest -Uri $url -OutFile $out;" ^
  "$expected='8fa420c325d05b6a032a8324438ff74950783f32a37c862224047445ad2f9c1f';" ^
  "$actual=(Get-FileHash -Algorithm SHA256 $out).Hash.ToLower();" ^
  "if($actual -ne $expected){Remove-Item $out -Force; throw ('SHA256 mismatch: '+$actual)};" ^
  "Write-Host ('Saved: '+$out);" ^
  "Write-Host ('SHA256: '+$actual);"

if errorlevel 1 (
  echo.
  echo DOWNLOAD FAILED.
  pause
  exit /b 1
)

echo.
echo OpenBoardView is now stored inside public\downloads and will be served from your site after deployment.
pause
