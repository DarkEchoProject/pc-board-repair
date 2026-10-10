@echo off
setlocal
cd /d "%~dp0"
where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Windows PowerShell was not found.
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0add-board.ps1"
if errorlevel 1 (
  echo.
  echo ADD BOARD FAILED. Copy or photograph the error above.
)
echo.
pause
endlocal
