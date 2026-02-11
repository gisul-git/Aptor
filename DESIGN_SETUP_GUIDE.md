# Design Assessment Platform - Setup & Run Guide

Complete guide to set up and run the Design Assessment Platform on your local machine.

---

## 📋 Prerequisites

Before starting, ensure you have these installed:

- **Docker Desktop** (for MongoDB, Redis, Penpot)
- **Python 3.9+** (for backend services)
- **Node.js 18+** (for frontend)
- **Git** (for version control)

---

## 🚀 Quick Start (Step-by-Step)

### Step 1: Clone the Repository

```bash
git clone https://github.com/gisul-git/Aptor.git
cd Aptor
```

### Step 2: Start Docker Services

Start MongoDB, Redis, and Penpot using Docker Compose:

```bash
docker-compose up -d
```

This will start:
- **MongoDB** on port `27017`
- **Redis** on port `6379`
- **Penpot** on port `9001`

**Verify Docker containers are running:**
```bash
docker ps
```

You should see containers for:
- `aptor-mongo-1`
- `aptor-redis-1`
- `aptor-penpot-frontend-1`
- `aptor-penpot-backend-1`
- `aptor-penpot-exporter-1`
- `aptor-postgres-1` (for Penpot)

### Step 3: Set Up Backend (Design Service)

Navigate to the design service directory:

```bash
cd services/design-service
```

**Install Python dependencies:**
```bash
pip install -r requirements.txt
```

**Configure environment variables:**

The `.env` file is already configured. Key settings:
- MongoDB: `mongodb://localhost:27017`
- OpenAI API Key: Already set (for AI question generation)
- Penpot: `http://localhost:9001`
- Port: `3006`

**Start the backend:**
```bash
python main.py
```

Backend will be available at: **http://localhost:3006**

### Step 4: Set Up Frontend

Open a new terminal and navigate to frontend:

```bash
cd Aptor/frontend
```

**Install Node dependencies:**
```bash
npm install
```

**Configure environment variables:**

The `.env.local` file is already configured. Key settings:
- API Gateway: `http://localhost:80`
- Design Service: `http://localhost:3006/api/v1/design`
- NextAuth URL: `http://localhost:3000`

**Start the frontend:**
```bash
npm run dev
```

Frontend will be available at: **http://localhost:3002** (or 3000/3001 if those ports are free)

---

## 🎯 Access the Platform

Once everything is running:

1. **Admin Panel:** http://localhost:3002/admin/design
   - Generate questions
   - View candidates
   - See analytics
   - Copy test links

2. **Penpot (Design Tool):** http://localhost:9001
   - Login: `admin@example.com`
   - Password: `12312312`

3. **Backend API:** http://localhost:3006/docs
   - FastAPI interactive documentation

---

## 📊 Verify Everything is Working

### Check Backend Health
```bash
curl http://localhost:3006/health
```

Should return: `{"status":"healthy"}`

### Check MongoDB Connection
```bash
python check_questions_db.py
```

Should show database collections and question count.

### Check Frontend
Open browser: http://localhost:3002/admin/design

You should see the admin panel with tabs for Questions, Candidates, Analytics, and Test Links.

---

## 🔧 Common Issues & Solutions

### Issue 1: Port Already in Use

**Frontend port conflict:**
```
⚠ Port 3000 is in use, trying 3001 instead.
⚠ Port 3001 is in use, trying 3002 instead.
```

**Solution:** Frontend will automatically find an available port. Note the port shown in the terminal.

**Backend port conflict:**
```
ERROR: Address already in use
```

**Solution:** Kill the process using port 3006:
```bash
# Windows
netstat -ano | findstr :3006
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3006 | xargs kill -9
```

### Issue 2: Docker Containers Not Starting

**Check Docker Desktop is running:**
- Open Docker Desktop application
- Ensure it's running (green icon)

**Restart Docker services:**
```bash
docker-compose down
docker-compose up -d
```

### Issue 3: MongoDB Connection Failed

**Check MongoDB is running:**
```bash
docker ps | grep mongo
```

**Restart MongoDB:**
```bash
docker restart aptor-mongo-1
```

### Issue 4: Penpot Not Loading

**Check Penpot containers:**
```bash
docker ps | grep penpot
```

**Restart Penpot:**
```bash
docker-compose restart penpot-frontend penpot-backend penpot-exporter
```

**Wait 30 seconds** for Penpot to fully start, then access: http://localhost:9001

### Issue 5: OpenAI API Errors

**If you see "OpenAI API key invalid" errors:**

The API key in `.env` might be expired. Update it:

1. Get a new key from: https://platform.openai.com/api-keys
2. Edit `services/design-service/.env`
3. Update `OPENAI_API_KEY=sk-proj-YOUR_NEW_KEY`
4. Restart backend: `python main.py`

---

## 🛑 Stopping Services

### Stop Frontend
Press `Ctrl+C` in the frontend terminal

### Stop Backend
Press `Ctrl+C` in the backend terminal

### Stop Docker Services
```bash
docker-compose down
```

**To stop and remove all data:**
```bash
docker-compose down -v
```

---

## 🔄 Daily Development Workflow

### Starting Work

```bash
# 1. Start Docker services
docker-compose up -d

# 2. Start backend (in one terminal)
cd services/design-service
python main.py

# 3. Start frontend (in another terminal)
cd frontend
npm run dev
```

### Stopping Work

```bash
# 1. Stop frontend (Ctrl+C in frontend terminal)
# 2. Stop backend (Ctrl+C in backend terminal)
# 3. Stop Docker
docker-compose down
```

---

## 📁 Project Structure

```
Aptor/
├── docker-compose.yml          # Docker services configuration
├── services/
│   └── design-service/         # Backend (FastAPI)
│       ├── main.py            # Entry point
│       ├── .env               # Backend config
│       └── requirements.txt   # Python dependencies
├── frontend/                   # Frontend (Next.js)
│   ├── package.json           # Node dependencies
│   ├── .env.local             # Frontend config
│   └── src/
│       └── pages/
│           └── admin/
│               └── design/
│                   └── index.tsx  # Admin panel
└── check_questions_db.py      # Database utility script
```

---

## 🌐 Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3002 | http://localhost:3002 |
| Backend | 3006 | http://localhost:3006 |
| Penpot | 9001 | http://localhost:9001 |
| MongoDB | 27017 | mongodb://localhost:27017 |
| Redis | 6379 | localhost:6379 |

---

## 🧪 Testing the Platform

### 1. Generate a Question

1. Go to: http://localhost:3002/admin/design
2. Click "Generate Question"
3. Select:
   - Role: UI Designer
   - Difficulty: Beginner
   - Task Type: Dashboard
   - Topic: E-commerce
4. Click "Generate"
5. Question appears in the list

### 2. Copy Test Link

1. In the Questions tab, click "Copy Link" for any question
2. Open the link in a new browser tab
3. You should see the assessment page with Penpot workspace

### 3. Take a Test

1. Open the test link
2. Penpot workspace loads
3. Design something
4. Click "Submit Design"
5. View evaluation results

---

## 📝 Environment Variables Reference

### Backend (.env)

```env
# Database
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=aptor_design

# AI Service
AI_PROVIDER=openai
OPENAI_API_KEY=sk-proj-xxxxx
AI_MODEL=gpt-4

# Penpot
PENPOT_URL=http://localhost:9001
PENPOT_ADMIN_EMAIL=admin@example.com
PENPOT_ADMIN_PASSWORD=12312312

# Server
PORT=3006
DEBUG=true
```

### Frontend (.env.local)

```env
# API URLs
NEXT_PUBLIC_API_URL=http://localhost:80
NEXT_PUBLIC_DESIGN_SERVICE_URL=http://localhost:3006/api/v1/design

# Auth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key

# OAuth (Google, Azure)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-secret
AZURE_AD_CLIENT_ID=your-azure-client-id
AZURE_AD_CLIENT_SECRET=your-azure-secret
AZURE_AD_TENANT_ID=your-azure-tenant-id
```

---

## 🆘 Getting Help

### Check Logs

**Backend logs:**
```bash
# In the terminal where backend is running
# Logs appear automatically
```

**Docker logs:**
```bash
# MongoDB
docker logs aptor-mongo-1

# Penpot
docker logs aptor-penpot-frontend-1
docker logs aptor-penpot-backend-1
```

**Frontend logs:**
```bash
# In the terminal where frontend is running
# Logs appear automatically
```

### Database Utilities

**View all questions:**
```bash
python check_questions_db.py
```

**Remove duplicate questions:**
```bash
python check_questions_db.py
# Type 'yes' when prompted to delete duplicates
```

---

## ✅ Success Checklist

Before considering the setup complete, verify:

- [ ] Docker Desktop is running
- [ ] `docker ps` shows 7+ containers running
- [ ] Backend accessible at http://localhost:3006/health
- [ ] Frontend accessible at http://localhost:3002
- [ ] Penpot accessible at http://localhost:9001
- [ ] Admin panel loads at http://localhost:3002/admin/design
- [ ] Can generate a question successfully
- [ ] Can copy and open a test link
- [ ] Penpot workspace loads in test page

---

## 🎉 You're Ready!

The Design Assessment Platform is now running. You can:

1. Generate design questions with AI
2. Create test links for candidates
3. Candidates take tests in Penpot
4. View automated evaluation results
5. Track analytics and performance

For any issues, check the "Common Issues & Solutions" section above.

---

**Last Updated:** February 11, 2026
**Platform Version:** 1.0.0
