# Step-by-Step Guide: Running the Design Service

## 📋 Prerequisites

Before starting, ensure you have:
- ✅ Docker Desktop installed and running
- ✅ Python 3.11+ installed (for local development)
- ✅ Git installed
- ✅ At least 8GB RAM available
- ✅ 10GB free disk space

---

## 🚀 Method 1: Quick Start with Docker (Recommended)

### Step 1: Navigate to Project Root
```bash
# Open terminal/command prompt
cd C:\gisul\Aptor
```

### Step 2: Configure Environment Variables
```bash
# Navigate to design service
cd services\design-service

# Copy environment template
copy .env.example .env

# Open .env file in notepad
notepad .env
```

**Edit these important variables in .env:**
```bash
# Add your OpenAI API key (required for AI question generation)
OPENAI_API_KEY=sk-your-actual-openai-key-here

# Or use Gemini instead
GEMINI_API_KEY=your-gemini-key-here

# Keep these as default for local development
MONGODB_URL=mongodb://mongo:27017
REDIS_HOST=redis
MINIO_ENDPOINT=minio:9000
PENPOT_API_URL=http://penpot-backend:6060
```

**Save and close the file.**

### Step 3: Go Back to Project Root
```bash
cd ..\..
# You should now be in C:\gisul\Aptor
```

### Step 4: Start Infrastructure Services First
```bash
# Start MongoDB, Redis, MinIO
docker-compose up -d mongo redis minio

# Wait 30 seconds for services to initialize
timeout /t 30

# Verify services are running
docker-compose ps
```

You should see:
```
NAME                STATUS
aptor-mongo-1       Up (healthy)
aptor-redis-1       Up (healthy)
aptor-minio-1       Up (healthy)
```

### Step 5: Start Penpot Services
```bash
# Start Penpot (design tool)
docker-compose up -d penpot-backend penpot-frontend penpot-exporter

# Wait 60 seconds for Penpot to initialize
timeout /t 60

# Check Penpot status
docker-compose ps | findstr penpot
```

### Step 6: Create Penpot Admin Account
```bash
# Open browser and go to:
start http://localhost:9001

# Register a new account:
# Email: admin@penpot.local
# Password: admin123
# (or use your own credentials)

# IMPORTANT: Remember these credentials!
```

### Step 7: Update Penpot Credentials in .env
```bash
cd services\design-service

# Edit .env again
notepad .env

# Update these lines with your Penpot credentials:
PENPOT_ADMIN_EMAIL=admin@penpot.local
PENPOT_ADMIN_PASSWORD=admin123

# Save and close
cd ..\..
```

### Step 8: Start Design Service
```bash
# Build and start design service
docker-compose up -d design-service

# Watch the logs to see if it starts successfully
docker-compose logs -f design-service
```

**Look for these success messages:**
```
INFO:     Started server process
INFO:     Waiting for application startup.
INFO:     Connected to MongoDB: aptor_design
INFO:     Design Service started successfully
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:3006
```

**Press Ctrl+C to stop watching logs**

### Step 9: Verify Service is Running
```bash
# Test health endpoint
curl http://localhost:3006/health

# Or open in browser:
start http://localhost:3006/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "service": "design-service",
  "version": "1.0.0"
}
```

### Step 10: Access API Documentation
```bash
# Open Swagger UI in browser
start http://localhost:3006/docs
```

You should see the interactive API documentation with all endpoints!

---

## 🛠️ Method 2: Local Development (Without Docker)

### Step 1: Install Python Dependencies
```bash
cd C:\gisul\Aptor\services\design-service

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### Step 2: Start Required Services with Docker
```bash
# Go back to project root
cd ..\..

# Start only infrastructure (not design-service)
docker-compose up -d mongo redis minio penpot-backend penpot-frontend
```

### Step 3: Configure Local Environment
```bash
cd services\design-service

# Copy and edit .env
copy .env.example .env
notepad .env
```

**Update for local development:**
```bash
# Change these for local connection
MONGODB_URL=mongodb://localhost:27017
REDIS_HOST=localhost
MINIO_ENDPOINT=localhost:9000
PENPOT_API_URL=http://localhost:6060
PENPOT_URL=http://localhost:9001

# Add your API key
OPENAI_API_KEY=sk-your-key-here

# Penpot credentials
PENPOT_ADMIN_EMAIL=admin@penpot.local
PENPOT_ADMIN_PASSWORD=admin123
```

### Step 4: Run Development Server
```bash
# Option A: Using the startup script
python start_dev.py

# Option B: Direct uvicorn
python main.py
```

### Step 5: Verify Local Setup
```bash
# In a new terminal
curl http://localhost:3006/health

# Or open browser
start http://localhost:3006/docs
```

---

## 🧪 Testing the Service

### Test 1: Health Check
```bash
curl http://localhost:3006/health
```

### Test 2: Generate a Design Question
```bash
curl -X POST "http://localhost:3006/api/v1/design/questions/generate" ^
  -H "Content-Type: application/json" ^
  -d "{\"role\":\"ui_designer\",\"difficulty\":\"intermediate\",\"task_type\":\"landing_page\",\"created_by\":\"admin\"}"
```

### Test 3: List Questions
```bash
curl http://localhost:3006/api/v1/design/questions
```

### Test 4: Create Workspace (requires question_id from Test 2)
```bash
curl -X POST "http://localhost:3006/api/v1/design/workspace/create" ^
  -H "Content-Type: application/json" ^
  -d "{\"user_id\":\"test_user\",\"assessment_id\":\"test_assessment\",\"question_id\":\"YOUR_QUESTION_ID_HERE\"}"
```

---

## 🔍 Troubleshooting

### Problem 1: "Port 3006 already in use"
```bash
# Find and kill the process using port 3006
netstat -ano | findstr :3006
taskkill /PID <PID_NUMBER> /F

# Or change port in .env
PORT=3007
```

### Problem 2: "MongoDB connection failed"
```bash
# Check if MongoDB is running
docker-compose ps mongo

# Restart MongoDB
docker-compose restart mongo

# Check logs
docker-compose logs mongo
```

### Problem 3: "Penpot authentication failed"
```bash
# Verify Penpot is running
docker-compose ps | findstr penpot

# Check Penpot logs
docker-compose logs penpot-backend

# Make sure you registered at http://localhost:9001
# Update credentials in .env file
```

### Problem 4: "AI API key invalid"
```bash
# Verify your OpenAI API key
# Go to: https://platform.openai.com/api-keys

# Update in .env:
OPENAI_API_KEY=sk-your-valid-key-here

# Restart service
docker-compose restart design-service
```

### Problem 5: Service won't start
```bash
# Check all logs
docker-compose logs design-service

# Rebuild the container
docker-compose build design-service
docker-compose up -d design-service

# Check for Python errors
cd services\design-service
python validate_setup.py
```

---

## 📊 Monitoring the Service

### View Real-time Logs
```bash
# All services
docker-compose logs -f

# Only design service
docker-compose logs -f design-service

# Last 100 lines
docker-compose logs --tail=100 design-service
```

### Check Service Status
```bash
# List all running containers
docker-compose ps

# Check resource usage
docker stats
```

### Access MongoDB Data
```bash
# Connect to MongoDB
docker exec -it aptor-mongo-1 mongosh

# In MongoDB shell:
use aptor_design
db.design_questions.find().pretty()
db.penpot_sessions.find().pretty()
db.design_submissions.find().pretty()
exit
```

---

## 🛑 Stopping the Service

### Stop Design Service Only
```bash
docker-compose stop design-service
```

### Stop All Services
```bash
docker-compose down
```

### Stop and Remove All Data
```bash
# WARNING: This deletes all data!
docker-compose down -v
```

---

## 🔄 Restarting After Changes

### After Code Changes (Docker)
```bash
# Rebuild and restart
docker-compose build design-service
docker-compose up -d design-service
```

### After .env Changes
```bash
# Just restart
docker-compose restart design-service
```

### After requirements.txt Changes
```bash
# Rebuild from scratch
docker-compose build --no-cache design-service
docker-compose up -d design-service
```

---

## 📱 Accessing the Service

### API Endpoints
- **Health Check**: http://localhost:3006/health
- **API Docs**: http://localhost:3006/docs
- **ReDoc**: http://localhost:3006/redoc
- **OpenAPI JSON**: http://localhost:3006/openapi.json

### Related Services
- **Penpot**: http://localhost:9001
- **MinIO Console**: http://localhost:9090 (admin/minioadmin)
- **MongoDB**: localhost:27017
- **Redis**: localhost:6379

---

## ✅ Success Checklist

After following these steps, you should have:

- [ ] All Docker containers running (mongo, redis, minio, penpot-*, design-service)
- [ ] Design service responding at http://localhost:3006/health
- [ ] API documentation accessible at http://localhost:3006/docs
- [ ] Penpot accessible at http://localhost:9001
- [ ] Able to generate design questions via API
- [ ] Able to create workspaces via API

---

## 🎯 Next Steps

1. **Integrate with Frontend**: Use the API endpoints in your React/Next.js app
2. **Configure Proctoring**: Connect with proctoring service
3. **Set Up Analytics**: Configure monitoring and analytics
4. **Production Deployment**: Follow production deployment guide

---

## 📞 Need Help?

If you encounter issues:

1. Check the troubleshooting section above
2. Review logs: `docker-compose logs design-service`
3. Validate setup: `python validate_setup.py`
4. Check all services are healthy: `docker-compose ps`

---

## 🎉 You're Ready!

Once all steps are complete, your Design Service is fully operational and ready to:
- Generate AI-powered design questions
- Create isolated Penpot workspaces
- Evaluate design submissions
- Provide comprehensive analytics

Happy designing! 🎨