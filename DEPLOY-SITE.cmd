@echo off
setlocal
cd /d "%~dp0"
cls
echo ==========================================
echo PC Board Repair - Cloudflare Deploy
echo ==========================================
echo.
where npx.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js / npx was not found.
  echo Install Node.js, then try again.
  echo.
  pause
  exit /b 1
)
echo Uploading site to pc-board-repair...
echo.
call npx.cmd wrangler deploy --assets public --name pc-board-repair
if errorlevel 1 (
  echo.
  echo DEPLOY FAILED. Copy or photograph the error above.
  echo.
  pause
  exit /b 1
)
echo.
echo DEPLOY COMPLETED SUCCESSFULLY.
echo Open: https://pc-board-repair.alinasser00001.workers.dev
echo Then press Ctrl+F5 in the browser.
echo.
pause
endlocal
