@echo off
setlocal
cd /d "%~dp0"
cls
echo ========================================================
echo  PC Board Repair - Publish FINAL BoardView batch
echo ========================================================
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0PUBLISH-FINAL-BOARDVIEW.ps1"
if errorlevel 1 (
  echo.
  echo FINAL BOARDVIEW DATABASE STEP FAILED.
  echo Copy the error above and send it here.
  echo.
  pause
  exit /b 1
)

echo.
echo Final BoardView database step completed. Deploying the site now...
echo.
call "%~dp0DEPLOY-SITE.cmd"
if errorlevel 1 exit /b 1

endlocal
