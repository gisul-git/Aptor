# Design Service - Quick Start Guide

## 🚀 Start Everything

```bash
# Start all services (from Aptor directory)
docker-compose up -d

# Check if services are running
docker-compose ps
```

## ✅ Verify Services

### 1. Backend Health Check
```bash
curl http://localhost:3006/health
```
Expected: `{"status":"healthy","service":"design-service","version":"1.0.0"}`

### 2. Penpot Access
Open: http://localhost:9001
Login: `admin@example.com` / `12312312`

### 3. Frontend Test
Open: http://localhost:3001/design/test-direct

## 🧪 Run Tests

```bash
cd Aptor/services/design-service
python test_workspace.py
```

Expected output:
```
✅ Backend is running!
✅ Question generated successfully!
✅ Workspace created successfully!
✅ ALL TESTS PASSED!
```

## 📱 Test the Full Flow

1. **Open Frontend**: http://localhost:3001/design/test-direct

2. **You Should See**:
   - Left side (320px): Question details, constraints, deliverables
   - Right side: Penpot workspace with design tools
   - Top: Timer counting down + Submit button

3. **Try Designing**:
   - Use Penpot tools to create shapes
   - Add text, colors, etc.
   - Everything saves automatically in Penpot

4. **Submit**:
   - Click "Submit" button
   - Design is saved to database

## ⚠️ Important Notes

### Current Limitation
**All candidates share the same Penpot file!**

This means:
- ❌ If 2 people test at same time, they see each other's work
- ✅ Fine for development/testing (one person at a time)
- ❌ NOT suitable for production with concurrent users

### For Production Use
You need to implement workspace isolation. See:
- `WORKSPACE_ISOLATION_STATUS.md` - Detailed analysis
- `create_file_pool.md` - How to create file pool manually

## 🔧 Troubleshooting

### Backend Not Starting
```bash
# Check logs
docker-compose logs design-service --tail=50

# Restart service
docker-compose restart design-service
```

### Penpot Not Loading
```bash
# Check Penpot logs
docker-compose logs penpot-backend --tail=50
docker-compose logs penpot-frontend --tail=50

# Restart Penpot
docker-compose restart penpot-backend penpot-frontend
```

### Frontend Not Working
```bash
# Check if frontend is running
cd Aptor/frontend
npm run dev

# Should be on port 3001
```

### Workspace Not Embedding
1. Check if Penpot is running: http://localhost:9001
2. Check if you can login manually
3. Check browser console for errors
4. Verify iframe sandbox permissions

## 📊 Service Ports

| Service | Port | URL |
|---------|------|-----|
| Frontend | 3001 | http://localhost:3001 |
| Design Service | 3006 | http://localhost:3006 |
| Penpot | 9001 | http://localhost:9001 |
| MongoDB | 27017 | mongodb://localhost:27017 |

## 🎯 Quick Test Checklist

- [ ] Backend health check returns 200
- [ ] Penpot login works
- [ ] Frontend test page loads
- [ ] Question appears on left side
- [ ] Penpot workspace loads on right side
- [ ] Timer counts down
- [ ] Can draw in Penpot workspace
- [ ] Submit button works

## 📝 API Quick Reference

### Generate Question
```bash
curl -X POST http://localhost:3006/api/v1/design/questions/generate \
  -H "Content-Type: application/json" \
  -d '{
    "role": "ui_designer",
    "difficulty": "intermediate",
    "task_type": "dashboard",
    "topic": "food delivery",
    "created_by": "test_user"
  }'
```

### Create Workspace
```bash
curl -X POST http://localhost:3006/api/v1/design/workspace/create \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_123",
    "assessment_id": "test_456",
    "question_id": "YOUR_QUESTION_ID"
  }'
```

## 🔗 Useful Links

- **Test Page**: http://localhost:3001/design/test-direct
- **API Docs**: http://localhost:3006/docs (if enabled)
- **Penpot**: http://localhost:9001
- **Backend Health**: http://localhost:3006/health

## 💡 Development Tips

1. **Single User Testing**: Current setup works perfectly
2. **Multiple Users**: Need to implement file pool first
3. **Question Customization**: Edit AI prompts in `ai_question_generator.py`
4. **UI Changes**: Edit `test-direct.tsx` for frontend changes
5. **API Changes**: Edit `design.py` for backend endpoints

## 🚨 Before Production

1. ✅ Test with single user - works now
2. ⚠️ Implement file pool for multiple users
3. ✅ Update OpenAI API to 1.0.0 format
4. ✅ Enable evaluation engine
5. ✅ Add proper error handling
6. ✅ Set up monitoring and logging

---

**Ready to use**: ✅ Development & Testing
**Production ready**: ⚠️ After implementing file pool
**Next step**: See `create_file_pool.md` for production setup
