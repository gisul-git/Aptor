# Start All Services - Complete Guide

## Step 1: Start Docker Services (MongoDB, Penpot, etc.)

```bash
cd Aptor
docker-compose up -d
```

This starts:
- MongoDB (database)
- Penpot (design tool)
- PostgreSQL
- Redis/Valkey

**Verify Docker is running:**
```bash
docker ps
```

You should see containers running.

---

## Step 2: Start Design Service (Port 3007)

```bash
cd Aptor
start_design_service.bat
```

This starts the design service with the correct OpenAI API key.

**Verify it's running:**
- Open browser: http://localhost:3007/health
- Should show: `{"status": "healthy"}`

---

## Step 3: Start Auth Service (Port 4000)

Open a new terminal:

```bash
cd Aptor/services/auth-service
python -m uvicorn main:app --host 0.0.0.0 --port 4000 --reload
```

**Verify it's running:**
- Open browser: http://localhost:4000/health
- Should show: `{"status": "healthy"}`

---

## Step 4: Start API Gateway (Port 80)

Open a new terminal:

```bash
cd Aptor/services/api-gateway
npm install
npm start
```

**Verify it's running:**
- Open browser: http://localhost:80/health
- Should show: `{"status": "healthy"}`

---

## Step 5: Start Frontend (Port 3000)

Open a new terminal:

```bash
cd Aptor/frontend
npm run dev -- -p 3000
```

**Note:** This will start on port 3000 instead of 3002.

**Verify it's running:**
- Open browser: http://localhost:3000
- Should show the Aaptor login page

---

## Quick Start Script

Create `start_all.bat` in Aptor folder:

```batch
@echo off
echo Starting all Aptor services...

echo.
echo [1/5] Starting Docker services...
docker-compose up -d

echo.
echo [2/5] Starting Design Service (Port 3007)...
start cmd /k "cd /d %~dp0 && start_design_service.bat"

timeout /t 5

echo.
echo [3/5] Starting Auth Service (Port 4000)...
start cmd /k "cd /d %~dp0services\auth-service && python -m uvicorn main:app --host 0.0.0.0 --port 4000 --reload"

timeout /t 5

echo.
echo [4/5] Starting API Gateway (Port 80)...
start cmd /k "cd /d %~dp0services\api-gateway && npm start"

timeout /t 5

echo.
echo [5/5] Starting Frontend (Port 3000)...
start cmd /k "cd /d %~dp0frontend && npm run dev -- -p 3000"

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
echo Press any key to exit...
pause
```

---

## Troubleshooting

### Port 3000 Already in Use

If port 3000 is already in use:

```bash
# Find what's using port 3000
netstat -ano | findstr :3000

# Kill the process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

### Port 80 Already in Use (API Gateway)

Port 80 might be used by IIS or another service:

```bash
# Find what's using port 80
netstat -ano | findstr :80

# Stop IIS if it's running
net stop http
```

Or run API Gateway on a different port:

```bash
cd Aptor/services/api-gateway
set PORT=8080
npm start
```

Then update frontend `.env`:
```
NEXT_PUBLIC_API_URL=http://localhost:8080
```

### Design Service Not Starting

Make sure you're using the correct startup script:

```bash
cd Aptor
start_design_service.bat
```

This sets the correct OpenAI API key.

---

## Service Status Check

Run this to check all services:

```bash
# Docker
docker ps

# Design Service
curl http://localhost:3007/health

# Auth Service
curl http://localhost:4000/health

# API Gateway
curl http://localhost:80/health

# Frontend
curl http://localhost:3000
```

---

## Stop All Services

```bash
# Stop Docker
cd Aptor
docker-compose down

# Close all terminal windows running services
# Or press Ctrl+C in each terminal
```

---

## Environment Variables

Make sure these are set in `Aptor/frontend/.env.local`:

```env
NEXTAUTH_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:80
NEXT_PUBLIC_DESIGN_SERVICE_URL=http://localhost:3007/api/v1/design
```

If `.env.local` doesn't exist, create it with these values.
