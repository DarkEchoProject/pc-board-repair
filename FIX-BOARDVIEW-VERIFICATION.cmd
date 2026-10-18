@echo off
setlocal
cd /d "%~dp0"
cls

echo ========================================================
echo  PC Board Repair - Fix BoardView verification status
echo ========================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0FIX-BOARDVIEW-VERIFICATION.ps1"
set "RC=%ERRORLEVEL%"
echo.
pause
exit /b %RC%
