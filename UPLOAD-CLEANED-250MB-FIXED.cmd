@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo  PC Board Repair - Prepare 250 MB BoardView release batch (not upload)
echo ========================================================
echo.

set "BATCH=%~1"
if "%BATCH%"=="" set /p BATCH=Batch number to upload [1]: 
if "%BATCH%"=="" set "BATCH=1"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0PREPARE-CLEANED-RELEASE.ps1" -BatchNumber %BATCH% -BatchLimitMB 250

echo.
pause
