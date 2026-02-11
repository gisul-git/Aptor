@echo off
echo ========================================
echo Restarting Design Service Backend
echo ========================================
echo.

cd /d "%~dp0"

echo Stopping any existing Python processes on port 3006...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3006" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul

echo.
echo Starting backend...
echo.

python main.py

pause
