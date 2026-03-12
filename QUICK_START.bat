@echo off
cls
echo.
echo ========================================
echo   APTOR - Quick Start Guide
echo ========================================
echo.
echo Choose an option:
echo.
echo 1. Start ALL services (Recommended)
echo 2. Start Docker only
echo 3. Start Design Service only
echo 4. Start Auth Service only
echo 5. Start API Gateway only
echo 6. Start Frontend only
echo 7. Check service status
echo 8. Stop all services
echo 9. Exit
echo.
set /p choice="Enter your choice (1-9): "

if "%choice%"=="1" goto start_all
if "%choice%"=="2" goto start_docker
if "%choice%"=="3" goto start_design
if "%choice%"=="4" goto start_auth
if "%choice%"=="5" goto start_gateway
if "%choice%"=="6" goto start_frontend
if "%choice%"=="7" goto check_status
if "%choice%"=="8" goto stop_all
if "%choice%"=="9" goto end

:start_all
echo.
echo Starting all services...
call start_all.bat
goto end

:start_docker
echo.
echo Starting Docker services...
docker-compose up -d
echo.
echo Docker services started!
pause
goto end

:start_design
echo.
echo Starting Design Service on port 3007...
start "Design Service" cmd /k "start_design_service.bat"
echo.
echo Design Service started!
pause
goto end

:start_auth
echo.
echo Starting Auth Service on port 4000...
start "Auth Service" cmd /k "cd services\auth-service && python -m uvicorn main:app --host 0.0.0.0 --port 4000 --reload"
echo.
echo Auth Service started!
pause
goto end

:start_gateway
echo.
echo Starting API Gateway on port 80...
start "API Gateway" cmd /k "cd services\api-gateway && npm start"
echo.
echo API Gateway started!
pause
goto end

:start_frontend
echo.
echo Starting Frontend on port 3000...
start "Frontend" cmd /k "cd frontend && npm run dev -- -p 3000"
echo.
echo Frontend started!
pause
goto end

:check_status
echo.
echo ========================================
echo   Service Status Check
echo ========================================
echo.
echo Checking Docker...
docker ps
echo.
echo Checking Design Service (3007)...
curl -s http://localhost:3007/health
echo.
echo.
echo Checking Auth Service (4000)...
curl -s http://localhost:4000/health
echo.
echo.
echo Checking API Gateway (80)...
curl -s http://localhost:80/health
echo.
echo.
echo Checking Frontend (3000)...
curl -s http://localhost:3000 >nul 2>&1 && echo Frontend is running || echo Frontend is not running
echo.
pause
goto end

:stop_all
echo.
echo Stopping all services...
docker-compose down
echo.
echo Docker services stopped!
echo.
echo Please close the terminal windows for other services manually.
pause
goto end

:end
