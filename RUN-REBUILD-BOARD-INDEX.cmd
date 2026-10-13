@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\REBUILD-BOARD-INDEX.ps1"
pause
