# ✅ Design Service Setup Checklist

## Pre-Setup Requirements

- [ ] Docker Desktop installed and running
- [ ] Python 3.11+ installed
- [ ] At least 8GB RAM available
- [ ] 10GB free disk space
- [ ] OpenAI API key (or Gemini/Claude)
- [ ] Terminal/Command Prompt access

---

## Setup Steps

### Phase 1: Environment Configuration
- [ ] Navigate to `C:\gisul\Aptor\services\design-service`
- [ ] Copy `.env.example` to `.env`
- [ ] Open `.env` in text editor
- [ ] Add OpenAI API key: `OPENAI_API_KEY=sk-...`
- [ ] Save and close `.env` file

### Phase 2: Infrastructure Services
- [ ] Navigate to project root: `cd C:\gisul\Aptor`
- [ ] Start MongoDB: `docker-compose up -d mongo`
- [ ] Start Redis: `docker-compose up -d redis`
- [ ] Start MinIO: `docker-compose up -d minio`
- [ ] Wait 30 seconds for initialization
- [ ] Verify services: `docker-compose ps`
- [ ] Confirm all show "Up (healthy)"

### Phase 3: Penpot Setup
- [ ] Start Penpot backend: `docker-compose up -d penpot-backend`
- [ ] Start Penpot frontend: `docker-compose up -d penpot-frontend`
- [ ] Start Penpot exporter: `docker-compose up -d penpot-exporter`
- [ ] Wait 60 seconds for initialization
- [ ] Open browser: http://localhost:9001
- [ ] Register new account (email: admin@penpot.local, password: admin123)
- [ ] Confirm registration successful
- [ ] Update `.env` with Penpot credentials
- [ ] Save `.env` file

### Phase 4: Design Service
- [ ] Navigate to project root: `cd C:\gisul\Aptor`
- [ ] Build service: `docker-compose build design-service`
- [ ] Start service: `docker-compose up -d design-service`
- [ ] Wait 30 seconds for startup
- [ ] Check logs: `docker-compose logs design-service`
- [ ] Look for "Design Service started successfully"

### Phase 5: Verification
- [ ] Test health endpoint: `curl http://localhost:3006/health`
- [ ] Verify response: `{"status":"healthy"}`
- [ ] Open API docs: http://localhost:3006/docs
- [ ] Confirm Swagger UI loads
- [ ] Check all services: `docker-compose ps`
- [ ] Verify all show "Up" or "Up (healthy)"

---

## Testing Checklist

### Basic Tests
- [ ] Health check returns 200 OK
- [ ] API documentation accessible
- [ ] Penpot interface loads
- [ ] MongoDB connection successful
- [ ] Redis connection successful

### Functional Tests
- [ ] Generate design question via API
- [ ] Question saved to database
- [ ] Create workspace session
- [ ] Workspace URL generated
- [ ] Penpot workspace accessible

### Integration Tests
- [ ] Frontend can call API endpoints
- [ ] Authentication works (if configured)
- [ ] File upload works
- [ ] Evaluation engine processes submissions

---

## Service Status Verification

### Check Individual Services

**MongoDB:**
```bash
docker-compose ps mongo
# Should show: Up (healthy)
```

**Redis:**
```bash
docker-compose ps redis
# Should show: Up (healthy)
```

**MinIO:**
```bash
docker-compose ps minio
# Should show: Up (healthy)
```

**Penpot Backend:**
```bash
docker-compose ps penpot-backend
# Should show: Up (healthy)
```

**Design Service:**
```bash
docker-compose ps design-service
# Should show: Up (healthy)
```

---

## Troubleshooting Checklist

### If Service Won't Start
- [ ] Check Docker Desktop is running
- [ ] Verify port 3006 is not in use
- [ ] Check `.env` file exists and has API key
- [ ] Review logs: `docker-compose logs design-service`
- [ ] Rebuild container: `docker-compose build design-service`
- [ ] Check disk space available
- [ ] Verify MongoDB is running

### If MongoDB Connection Fails
- [ ] Check MongoDB container status
- [ ] Verify MongoDB port 27017 is accessible
- [ ] Check MongoDB logs: `docker-compose logs mongo`
- [ ] Restart MongoDB: `docker-compose restart mongo`
- [ ] Check `.env` has correct MONGODB_URL

### If Penpot Authentication Fails
- [ ] Verify Penpot is running: http://localhost:9001
- [ ] Check you registered an account
- [ ] Verify credentials in `.env` match registration
- [ ] Check Penpot logs: `docker-compose logs penpot-backend`
- [ ] Try re-registering with same credentials

### If AI Generation Fails
- [ ] Verify OpenAI API key is valid
- [ ] Check API key has credits/quota
- [ ] Test key at https://platform.openai.com/api-keys
- [ ] Check logs for specific error message
- [ ] Try alternative provider (Gemini/Claude)

---

## Post-Setup Tasks

### Configuration
- [ ] Review and adjust evaluation weights in `.env`
- [ ] Configure time limits for assessments
- [ ] Set up authentication if needed
- [ ] Configure CORS origins for frontend

### Integration
- [ ] Connect frontend to API endpoints
- [ ] Set up API gateway routing
- [ ] Configure proctoring integration
- [ ] Set up analytics tracking

### Monitoring
- [ ] Set up log aggregation
- [ ] Configure health check monitoring
- [ ] Set up alerts for service failures
- [ ] Configure backup strategy for MongoDB

### Security
- [ ] Change default JWT secret key
- [ ] Update Penpot admin password
- [ ] Configure rate limiting
- [ ] Set up SSL/TLS for production

---

## Production Readiness Checklist

- [ ] All services running in production mode
- [ ] Environment variables secured
- [ ] Database backups configured
- [ ] Monitoring and alerting set up
- [ ] Load testing completed
- [ ] Security audit performed
- [ ] Documentation updated
- [ ] Team trained on operations

---

## Quick Reference

### Start All Services
```bash
cd C:\gisul\Aptor
docker-compose up -d
```

### Stop All Services
```bash
docker-compose down
```

### View All Logs
```bash
docker-compose logs -f
```

### Check All Status
```bash
docker-compose ps
```

### Restart Design Service
```bash
docker-compose restart design-service
```

---

## Success Criteria

✅ **Setup is complete when:**

1. All Docker containers show "Up (healthy)"
2. Health endpoint returns `{"status":"healthy"}`
3. API documentation loads at http://localhost:3006/docs
4. Penpot interface loads at http://localhost:9001
5. Can generate design questions via API
6. Can create workspaces via API
7. No errors in service logs

---

## Next Steps After Setup

1. **Test the API**: Use Swagger UI to test all endpoints
2. **Integrate Frontend**: Connect your React/Next.js app
3. **Configure Proctoring**: Set up monitoring and anti-cheat
4. **Set Up Analytics**: Configure performance tracking
5. **Production Deploy**: Follow production deployment guide

---

**Date Completed**: _______________

**Completed By**: _______________

**Notes**: _______________________________________________

_____________________________________________________

_____________________________________________________