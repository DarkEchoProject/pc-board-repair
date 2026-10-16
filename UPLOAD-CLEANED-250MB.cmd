@echo off
setlocal
cd /d "%~dp0"

echo ========================================================
echo  PC Board Repair - Upload cleaned BoardView in 250 MB batches
echo ========================================================
echo.

set "BATCH=%~1"
if "%BATCH%"=="" set /p BATCH=Batch number to upload [1]: 
if "%BATCH%"=="" set "BATCH=1"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0UPLOAD-CLEANED-250MB.ps1" -BatchNumber %BATCH%

echo.
pause
