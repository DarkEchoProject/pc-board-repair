@echo off
setlocal
cd /d "%~dp0"
cls
echo ========================================================
echo  PC Board Repair - FINAL BoardView uploader
echo ========================================================
echo.

if /I "%~1"=="PREVIEW" (
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0UPLOAD-FINAL-BOARDVIEW.ps1" -PreviewOnly
  echo.
  pause
  exit /b %errorlevel%
)

set "BATCH=%~1"
if "%BATCH%"=="" set /p BATCH=Batch number to upload [1]: 
if "%BATCH%"=="" set "BATCH=1"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0UPLOAD-FINAL-BOARDVIEW.ps1" -BatchNumber %BATCH%
echo.
pause
endlocal
