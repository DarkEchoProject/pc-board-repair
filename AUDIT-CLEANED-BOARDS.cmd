@echo off
setlocal
cd /d "%~dp0"
cls
echo ==========================================
echo PC Board Repair - CLEANED Files Audit
echo ==========================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0AUDIT-CLEANED-BOARDS.ps1"
echo.
pause
endlocal
