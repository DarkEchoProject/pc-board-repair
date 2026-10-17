@echo off
setlocal
cd /d "%~dp0"
cls
echo ========================================================
echo  PC Board Repair - Recover skipped + large BoardView files
echo ========================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0RECOVER-BOARDVIEW-UPLOADS.ps1"
if errorlevel 1 (
  echo.
  echo RECOVERY UPLOAD FAILED.
  echo Copy the error above and send it here.
  echo.
  pause
  exit /b 1
)
echo.
echo RECOVERY UPLOAD FINISHED.
echo Send the final summary here before publishing the database.
echo.
pause
endlocal
