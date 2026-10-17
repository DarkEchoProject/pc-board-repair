@echo off
setlocal
cd /d "%~dp0"
cls
echo ========================================================
echo  PC Board Repair - Publish uploaded BoardView batches
echo ========================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0PUBLISH-RELEASE-BOARDS.ps1"
if errorlevel 1 (
  echo.
  echo PUBLISH DATABASE STEP FAILED.
  echo Copy the error above and send it here.
  echo.
  pause
  exit /b 1
)

echo.
echo Database step completed. Deploying the site now...
echo.
call "%~dp0DEPLOY-SITE.cmd"
if errorlevel 1 exit /b 1

endlocal
