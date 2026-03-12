@echo off
echo ========================================
echo Starting all Aptor services...
echo ========================================

echo.
echo [1/5] Starting Docker services...
docker-compose up -d

echo.
echo Waiting for Docker to initialize...
timeout /t 10

echo.
echo [2/5] Starting Design Service (Port 3007)...
start "Design Service" cmd /k "cd /d %~dp0 && start_design_service.bat"

echo.
echo Waiting for Design Service to start...
timeout /t 5

echo.
echo [3/5] Starting Auth Service (Port 4000)...
start "Auth Service" cmd /k "cd /d %~dp0services\auth-service && python -m uvicorn main:app --host 0.0.0.0 --port 4000 --reload"

echo.
echo Waiting for Auth Service to start...
timeout /t 5

echo.
echo [4/5] Starting API Gateway (Port 80)...
start "API Gateway" cmd /k "cd /d %~dp0services\api-gateway && npm start"

echo.
echo Waiting for API Gateway to start...
timeout /t 5

echo.
echo [5/5] Starting Frontend (Port 3000)...
start "Frontend" cmd /k "cd /d %~dp0frontend && npm run dev -- -p 3000"

echo.
echo ========================================
echo All services started!
echo ========================================
echo.
echo Services:
echo - Docker:        docker ps
echo - Design:        http://localhost:3007/health
echo - Auth:          http://localhost:4000/health
echo - API Gateway:   http://localhost:80/health
echo - Frontend:      http://localhost:3000
echo.
echo Check each terminal window for service status.
echo.
pause
