@echo off
title AI Competency Agent - Status Check
color 0A

echo ========================================
echo   AI Competency Agent Status Check
echo ========================================
echo.

REM Check if service exists
sc query AptorAIAgent >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Service not found
    echo Please reinstall AI Competency Agent
    goto end
)

REM Check if service is running
sc query AptorAIAgent | find "RUNNING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Service is RUNNING
) else (
    echo [WARNING] Service is NOT running
    echo.
    echo Attempting to start service...
    net start AptorAIAgent
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Service started successfully
    ) else (
        echo [ERROR] Failed to start service
        echo Check logs at: C:\Program Files\Aptor\Agent\logs\
    )
)

echo.
echo Checking port 8889...
netstat -an | find "8889" | find "LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Port 8889 is LISTENING
    echo WebSocket available at: ws://127.0.0.1:8889
) else (
    echo [ERROR] Port 8889 is NOT listening
    echo The agent may have failed to start
)

echo.
echo Service details:
sc qc AptorAIAgent

:end
echo.
echo ========================================
echo Press any key to exit...
pause >nul
