@echo off
rem Double-click to run Php Scanner on this PC. Close this window to stop it.
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3 is needed to run the local server: https://www.python.org/downloads/
  pause
  exit /b 1
)
python serve.py %*
pause
