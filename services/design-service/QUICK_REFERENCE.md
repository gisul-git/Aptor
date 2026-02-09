# Design Service - Quick Reference Card

## 🚀 Service Info
- **Port**: 3006
- **Status**: ✅ Running & Healthy
- **Version**: 1.0.0

## 🔗 Quick Links
- **API Docs**: http://localhost:3006/docs
- **Frontend Test**: http://localhost:3000/design/api-test
- **Penpot**: http://localhost:9001

## ⚡ Quick Commands

### Check Status
```powershell
docker ps --filter "name=design-service"
Invoke-RestMethod -Uri 'http://localhost:3006/health'
```

### Restart Service
```powershell
docker restart aptor-design-service-1
```

### View Logs
```powershell
docker logs aptor-design-service-1 --tail 50
docker logs aptor-design-service-1 -f  # Follow logs
```

## 📝 Common API Calls

### Generate Question
```powershell
$body = @{
    role = 'ui_designer'
    difficulty = 'intermediate'
    task_type = 'dashboard'
    topic = 'food delivery'
    created_by = 'test_user'
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:3006/api/v1/design/questions/generate' `
    -Method Post -Body $body -ContentType 'application/json'
```

### Create Workspace
```powershell
$body = @{
    user_id = 'user123'
    assessment_id = 'assess456'
    question_id = 'YOUR_QUESTION_ID'
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:3006/api/v1/design/workspace/create' `
    -Method Post -Body $body -ContentType 'application/json'
```

### Get Questions
```powershell
Invoke-RestMethod -Uri 'http://localhost:3006/api/v1/design/questions?limit=10'
```

## 🎨 Design Roles
- `ui_designer` - UI Designer
- `ux_designer` - UX Designer
- `product_designer` - Product Designer
- `visual_designer` - Visual Designer

## 📊 Difficulty Levels
- `beginner` - Entry level
- `intermediate` - Mid level
- `advanced` - Senior level

## 🎯 Task Types
- `landing_page` - Landing page design
- `mobile_app` - Mobile app interface
- `dashboard` - Dashboard/admin panel
- `component` - UI component design

## 🔧 Troubleshooting

### Service Won't Start
```powershell
docker logs aptor-design-service-1
docker restart aptor-design-service-1
```

### Database Connection Issues
```powershell
docker ps --filter "name=mongo"
docker restart aptor-mongodb-1
```

### Frontend Can't Connect
1. Check `.env.local` has `NEXT_PUBLIC_DESIGN_SERVICE_URL`
2. Restart Next.js: `npm run dev`
3. Clear browser cache

## 📚 Documentation Files
- `TESTING_GUIDE.md` - Complete testing guide
- `DESIGN_SERVICE_COMPLETION.md` - Full completion report
- `PROMPT_ENGINEERING_GUIDE.md` - AI prompt framework
- `IMPLEMENTATION_SUMMARY.md` - Technical details
- `QUICK_REFERENCE.md` - This file

## ✅ Health Check Checklist
- [ ] Service running: `docker ps --filter "name=design-service"`
- [ ] Health endpoint: `http://localhost:3006/health`
- [ ] MongoDB running: `docker ps --filter "name=mongo"`
- [ ] Penpot running: `docker ps --filter "name=penpot"`
- [ ] Frontend accessible: `http://localhost:3000`

## 🎉 Success Indicators
- Health check returns `{"status": "healthy"}`
- Question generation returns structured JSON
- Workspace creation returns Penpot URL
- Frontend test page loads without errors
- API docs accessible at `/docs`

---

**Need Help?** Check `TESTING_GUIDE.md` for detailed instructions.
