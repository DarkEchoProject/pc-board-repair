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

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: PowerShell was not found.
  echo.
  pause
  exit /b 1
)

echo Building and validating SEO / sitemap outputs...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0SEO-CHECK.ps1"
if errorlevel 1 (
  echo.
  echo DEPLOY CANCELLED because an SEO / sitemap check failed.
  echo Fix the FAIL item above, then run DEPLOY-SITE.cmd again.
  echo.
  pause
  exit /b 1
)

echo.
echo Running pre-deploy checks...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0PREDEPLOY-CHECK.ps1"
if errorlevel 1 (
  echo.
  echo DEPLOY CANCELLED because a pre-deploy check failed.
  echo Fix the FAIL item above, then run DEPLOY-SITE.cmd again.
  echo.
  pause
  exit /b 1
)

echo.
echo Validating Worker build with Wrangler dry-run...
echo.
call npx.cmd wrangler deploy --dry-run --name pc-board-repair
if errorlevel 1 (
  echo.
  echo DEPLOY CANCELLED because Wrangler dry-run failed.
  echo Copy or photograph the error above.
  echo.
  pause
  exit /b 1
)

echo.
echo Uploading site to pc-board-repair...
echo.
call npx.cmd wrangler deploy --name pc-board-repair
if errorlevel 1 (
  echo.
  echo DEPLOY FAILED. Copy or photograph the error above.
  echo.
  pause
  exit /b 1
)

echo.
echo Notifying IndexNow about new or changed pages...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0SUBMIT-INDEXNOW.ps1"
if errorlevel 1 (
  echo.
  echo WARNING: Site deploy succeeded, but IndexNow notification failed.
  echo The site is still live. IndexNow can be retried on the next deploy.
)

echo.
echo DEPLOY COMPLETED SUCCESSFULLY.
echo Open: https://pc-board-repair.alinasser00001.workers.dev
echo Then press Ctrl+F5 in the browser.
echo.
pause
endlocal
