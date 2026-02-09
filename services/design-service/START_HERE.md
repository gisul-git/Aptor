# 🎨 Design Service - START HERE

## 👋 Welcome!

This is your **AI Design Question Generator + Penpot Integrated Candidate Workspace + Automated Evaluation Engine**.

---

## 🚀 Choose Your Path

### 🏃 I Want to Start Quickly (5 minutes)
→ **Read**: `QUICK_START.md`

### 📚 I Want Detailed Instructions
→ **Read**: `STEP_BY_STEP_GUIDE.md`

### ✅ I Want a Checklist
→ **Read**: `SETUP_CHECKLIST.md`

### 🎯 I Need Command Reference
→ **Read**: `COMMANDS_REFERENCE.md`

### 🔗 I Want Integration Guide
→ **Read**: `INTEGRATION_GUIDE.md`

### 📖 I Want Full Documentation
→ **Read**: `README.md`

---

## ⚡ Super Quick Start (Copy & Paste)

```bash
# 1. Configure
cd C:\gisul\Aptor\services\design-service
copy .env.example .env
notepad .env
# Add: OPENAI_API_KEY=sk-your-key-here

# 2. Start Infrastructure
cd C:\gisul\Aptor
docker-compose up -d mongo redis minio
timeout /t 30

# 3. Start Penpot
docker-compose up -d penpot-backend penpot-frontend
timeout /t 60

# 4. Register Penpot (in browser)
start http://localhost:9001
# Register: admin@penpot.local / admin123
# Update credentials in .env

# 5. Start Design Service
docker-compose up -d design-service

# 6. Verify
curl http://localhost:3006/health
start http://localhost:3006/docs
```

---

## 📋 What You Need

- ✅ Docker Desktop (running)
- ✅ Python 3.11+
- ✅ OpenAI API Key (or Gemini/Claude)
- ✅ 8GB RAM
- ✅ 10GB disk space

---

## 🎯 What You Get

### Features
- 🤖 AI-powered design question generation
- 🎨 Embedded Penpot design workspace
- 📊 Automated hybrid evaluation (Rule-based 60% + AI 40%)
- 📈 Analytics and performance tracking
- 🔒 Secure authentication and proctoring

### API Endpoints
- Generate design questions
- Create isolated workspaces
- Submit and evaluate designs
- Track performance analytics

---

## 🌐 Access Points

Once running, access these URLs:

| Service | URL | Purpose |
|---------|-----|---------|
| **API Docs** | http://localhost:3006/docs | Interactive API documentation |
| **Health Check** | http://localhost:3006/health | Service status |
| **Penpot** | http://localhost:9001 | Design workspace |
| **MinIO** | http://localhost:9090 | File storage (admin/minioadmin) |

---

## 🧪 Quick Test

After setup, test with:

```bash
# Generate a design question
curl -X POST http://localhost:3006/api/v1/design/questions/generate ^
  -H "Content-Type: application/json" ^
  -d "{\"role\":\"ui_designer\",\"difficulty\":\"intermediate\",\"task_type\":\"landing_page\",\"created_by\":\"admin\"}"
```

---

## ❓ Common Questions

### Q: Do I need all services running?
**A:** Yes, you need MongoDB, Redis, MinIO, Penpot, and Design Service.

### Q: Can I use a different AI provider?
**A:** Yes! Set `AI_PROVIDER=gemini` or `AI_PROVIDER=claude` in `.env`

### Q: How do I stop everything?
**A:** Run `docker-compose down` from project root

### Q: Where is the data stored?
**A:** MongoDB stores questions/submissions, MinIO stores files

### Q: Can I run without Docker?
**A:** Yes, see "Method 2" in `STEP_BY_STEP_GUIDE.md`

---

## 🆘 Troubleshooting

### Service won't start?
```bash
docker-compose logs design-service
python validate_setup.py
```

### Port already in use?
```bash
netstat -ano | findstr :3006
taskkill /PID <PID> /F
```

### MongoDB connection failed?
```bash
docker-compose restart mongo
docker-compose ps mongo
```

### Penpot auth failed?
- Register at http://localhost:9001
- Update `.env` with your credentials
- Restart: `docker-compose restart design-service`

---

## 📚 Documentation Structure

```
design-service/
├── START_HERE.md              ← You are here!
├── QUICK_START.md             ← 5-minute setup
├── STEP_BY_STEP_GUIDE.md      ← Detailed instructions
├── SETUP_CHECKLIST.md         ← Verification checklist
├── COMMANDS_REFERENCE.md      ← All commands
├── INTEGRATION_GUIDE.md       ← Frontend integration
├── README.md                  ← Full documentation
└── IMPLEMENTATION_SUMMARY.md  ← Technical details
```

---

## 🎯 Next Steps After Setup

1. ✅ **Verify Setup**: All services running and healthy
2. 🧪 **Test API**: Use Swagger UI at http://localhost:3006/docs
3. 🔗 **Integrate Frontend**: Connect your React/Next.js app
4. 📊 **Configure Analytics**: Set up monitoring
5. 🚀 **Deploy**: Follow production deployment guide

---

## 💡 Pro Tips

- **Bookmark** http://localhost:3006/docs for API testing
- **Use** `docker-compose logs -f design-service` to watch logs
- **Check** `docker-compose ps` to verify all services are healthy
- **Save** your `.env` file - it contains important configuration
- **Test** each endpoint in Swagger UI before integrating

---

## 🎉 You're Ready!

Choose your path above and get started. The service is designed to be:
- ✅ Easy to set up
- ✅ Well documented
- ✅ Production ready
- ✅ Fully featured

---

## 📞 Need Help?

1. Check the troubleshooting section above
2. Review logs: `docker-compose logs design-service`
3. Run validation: `python validate_setup.py`
4. Check service status: `docker-compose ps`
5. Read the detailed guides in this directory

---

**Happy Designing! 🎨**

*Last Updated: 2024*