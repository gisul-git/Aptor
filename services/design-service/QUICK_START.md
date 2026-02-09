# 🚀 Quick Start - Design Service

## ⚡ 5-Minute Setup

### 1️⃣ Configure Environment (1 min)
```bash
cd C:\gisul\Aptor\services\design-service
copy .env.example .env
notepad .env
```
**Add your OpenAI API key:**
```
OPENAI_API_KEY=sk-your-key-here
```

### 2️⃣ Start Services (2 min)
```bash
cd C:\gisul\Aptor
docker-compose up -d mongo redis minio
timeout /t 30
docker-compose up -d penpot-backend penpot-frontend
timeout /t 60
```

### 3️⃣ Register Penpot Account (1 min)
```bash
start http://localhost:9001
```
- Register with: `admin@penpot.local` / `admin123`
- Update credentials in `.env`

### 4️⃣ Start Design Service (1 min)
```bash
docker-compose up -d design-service
```

### 5️⃣ Verify (30 sec)
```bash
curl http://localhost:3006/health
start http://localhost:3006/docs
```

---

## 🎯 Essential Commands

### Start Everything
```bash
cd C:\gisul\Aptor
docker-compose up -d
```

### Stop Everything
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f design-service
```

### Restart Service
```bash
docker-compose restart design-service
```

### Check Status
```bash
docker-compose ps
```

---

## 🧪 Quick Test

### Generate Question
```bash
curl -X POST http://localhost:3006/api/v1/design/questions/generate ^
  -H "Content-Type: application/json" ^
  -d "{\"role\":\"ui_designer\",\"difficulty\":\"intermediate\",\"task_type\":\"landing_page\",\"created_by\":\"admin\"}"
```

### List Questions
```bash
curl http://localhost:3006/api/v1/design/questions
```

---

## 🔗 Important URLs

| Service | URL |
|---------|-----|
| Design Service API | http://localhost:3006/docs |
| Health Check | http://localhost:3006/health |
| Penpot | http://localhost:9001 |
| MinIO Console | http://localhost:9090 |

---

## ⚠️ Common Issues

**Port already in use?**
```bash
netstat -ano | findstr :3006
taskkill /PID <PID> /F
```

**MongoDB not connecting?**
```bash
docker-compose restart mongo
```

**Penpot auth failed?**
- Register at http://localhost:9001
- Update `.env` with your credentials
- Restart: `docker-compose restart design-service`

**AI API not working?**
- Check your API key in `.env`
- Verify key at https://platform.openai.com/api-keys

---

## 📚 Full Documentation

- **Step-by-Step Guide**: `STEP_BY_STEP_GUIDE.md`
- **Integration Guide**: `INTEGRATION_GUIDE.md`
- **API Documentation**: http://localhost:3006/docs
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`

---

## ✅ Success Indicators

You're ready when:
- ✅ `curl http://localhost:3006/health` returns `{"status":"healthy"}`
- ✅ http://localhost:3006/docs shows API documentation
- ✅ http://localhost:9001 shows Penpot interface
- ✅ `docker-compose ps` shows all services as "Up (healthy)"

---

**Need detailed instructions?** → See `STEP_BY_STEP_GUIDE.md`