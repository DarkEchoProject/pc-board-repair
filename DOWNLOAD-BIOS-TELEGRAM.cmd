@echo off
setlocal
cd /d "%~dp0"
cls

echo ========================================================
echo  PC Board Repair - Telegram BIOS Downloader
echo ========================================================
echo  Default channel: @biosarchive
echo  FREE/PUBLIC files only - VIP/NOT_FREE are skipped
echo  Resume + SHA256 duplicate protection enabled
echo ========================================================
echo.

set "APPDIR=%LOCALAPPDATA%\PCBoardRepair\TelegramBIOS"
set "VENV=%APPDIR%\venv"
if not exist "%APPDIR%" mkdir "%APPDIR%" >nul 2>&1

set "PYBASE="
where py >nul 2>&1
if not errorlevel 1 set "PYBASE=py -3"
if not defined PYBASE (
  where python >nul 2>&1
  if not errorlevel 1 set "PYBASE=python"
)
if not defined PYBASE (
  echo ERROR: Python 3 is not installed or not in PATH.
  echo Install Python 3, then run this file again.
  pause
  exit /b 1
)

if not exist "%VENV%\Scripts\python.exe" (
  echo Creating private Python environment...
  %PYBASE% -m venv "%VENV%"
  if errorlevel 1 (
    echo ERROR: Could not create Python environment.
    pause
    exit /b 1
  )
)

"%VENV%\Scripts\python.exe" -c "import telethon" >nul 2>&1
if errorlevel 1 (
  echo Installing Telethon - first run only...
  "%VENV%\Scripts\python.exe" -m pip install --disable-pip-version-check "telethon>=1.36,<2"
  if errorlevel 1 (
    echo ERROR: Telethon installation failed.
    pause
    exit /b 1
  )
)

echo.
"%VENV%\Scripts\python.exe" "%~dp0DOWNLOAD-BIOS-TELEGRAM.py" %*
set "RC=%ERRORLEVEL%"
echo.
if "%RC%"=="3" echo Download stopped safely because free disk space reached the configured reserve.
if not "%RC%"=="0" if not "%RC%"=="3" echo Downloader exited with code %RC%.
echo.
pause
exit /b %RC%
