# ✅ Design Assessment - FINAL SETUP

## 🎯 What You Get

When candidate opens the URL, they will **IMMEDIATELY** see:

```
┌─────────────────────────────────────────────────────────────┐
│  Header: Question Title | Timer: 59:45 | [Submit Button]   │
├──────────────────┬──────────────────────────────────────────┤
│  LEFT PANEL      │  RIGHT PANEL                             │
│  (320px width)   │  (Full remaining width)                  │
│                  │                                          │
│  Challenge:      │  ┌────────────────────────────────────┐ │
│  [Description]   │  │                                    │ │
│                  │  │   PENPOT WORKSPACE                 │ │
│  Constraints:    │  │                                    │ │
│  • Item 1        │  │   Candidate designs here           │ │
│  • Item 2        │  │                                    │ │
│                  │  │   • Drawing tools                  │ │
│  Deliverables:   │  │   • Shapes                         │ │
│  • Item 1        │  │   • Text                           │ │
│  • Item 2        │  │   • Colors                         │ │
│                  │  │                                    │ │
│  Evaluation:     │  │                                    │ │
│  • Criteria 1    │  │                                    │ │
│  • Criteria 2    │  └────────────────────────────────────┘ │
│                  │                                          │
└──────────────────┴──────────────────────────────────────────┘
```

---

## 🚀 How to Start

### **Step 1: Restart Next.js**

In your terminal where Next.js is running:

1. **Press Ctrl+C** to stop it
2. **Run:**
   ```bash
   cd Aptor/frontend
   npm run dev
   ```
3. **Wait** for "compiled successfully" message

### **Step 2: Open the Assessment**

```
http://localhost:3000/design-assessment
```

---

## ⚡ What Happens Automatically

### **When page loads:**

1. ✅ **Auto-generates** AI design question
2. ✅ **Auto-creates** Penpot workspace
3. ✅ **Auto-displays** split layout
4. ✅ **Auto-starts** timer

### **NO welcome screen - goes straight to assessment!**

---

## 🎬 User Flow (Updated)

```
1. Candidate opens URL
   ↓
2. Loading screen (2-3 seconds)
   "Generating your design challenge..."
   ↓
3. Screen splits into:
   - LEFT: Question details
   - RIGHT: Penpot workspace
   ↓
4. Timer starts counting down
   ↓
5. Candidate designs in Penpot
   ↓
6. Candidate clicks "Submit"
   ↓
7. Design is evaluated
```

**REMOVED: Welcome screen with "Start Assessment" button**

---

## 📁 Files Created

### **Main Assessment Page:**
```
Aptor/frontend/src/pages/design-assessment.tsx
```
- Auto-starts on load
- Split layout (question left, Penpot right)
- Timer with countdown
- Submit button

### **Backend API:**
```
Aptor/services/design-service/
```
- FastAPI service on port 3006
- AI question generation
- Penpot workspace creation
- MongoDB database

---

## 🔧 Configuration

### **Backend (Already Running):**
- Port: 3006
- Status: ✅ Working
- API Docs: http://localhost:3006/docs

### **Frontend (Need to Restart):**
- Port: 3000
- Status: ⚠️ Need restart
- URL: http://localhost:3000/design-assessment

---

## 🎨 Customization

### **Change Question Type:**
Edit `design-assessment.tsx` line ~30:
```typescript
{
  role: 'ui_designer',        // Change role
  difficulty: 'intermediate', // Change difficulty
  task_type: 'dashboard',     // Change task type
  topic: 'food delivery'      // Change topic
}
```

### **Change Timer:**
Edit `design-assessment.tsx` line ~10:
```typescript
const [timeLeft, setTimeLeft] = useState(3600); // 3600 = 60 minutes
```

### **Change Left Panel Width:**
Edit `design-assessment.tsx` line ~240:
```typescript
<div style={{ width: '320px', ... }}>  // Change width
```

---

## ✅ Checklist

Before testing:

- [ ] Backend running (port 3006)
- [ ] MongoDB running
- [ ] Penpot running (port 9001)
- [ ] Next.js restarted
- [ ] Waited for "compiled successfully"
- [ ] Opened http://localhost:3000/design-assessment

---

## 🎉 Success Indicators

You'll know it's working when:

1. ✅ Page loads with loading spinner
2. ✅ Shows "Generating your design challenge..."
3. ✅ After 2-3 seconds, split layout appears
4. ✅ Left side shows question details
5. ✅ Right side shows Penpot workspace
6. ✅ Timer counts down from 60:00
7. ✅ Submit button is visible

---

## 🚨 Troubleshooting

### **Still seeing "Internal Server Error":**
1. Stop Next.js (Ctrl+C)
2. Delete `.next` folder: `rm -rf Aptor/frontend/.next`
3. Restart: `npm run dev`
4. Wait for compilation
5. Refresh browser

### **Penpot not loading:**
1. Check Penpot is running: `docker ps | grep penpot`
2. Access directly: http://localhost:9001
3. Login: admin@penpot.local / admin123

### **Question not generating:**
1. Check backend: http://localhost:3006/docs
2. Test manually in Swagger UI
3. Check logs: `docker logs aptor-design-service-1`

---

## 📞 Quick Commands

```bash
# Check services
docker ps

# Restart backend
docker restart aptor-design-service-1

# Restart frontend
cd Aptor/frontend
npm run dev

# View backend logs
docker logs aptor-design-service-1 --tail 50

# Test backend API
curl http://localhost:3006/health
```

---

## 🎓 Summary

Your design assessment is complete with:

- ✅ **Auto-start**: No welcome screen
- ✅ **Split layout**: Question left, Penpot right
- ✅ **AI questions**: Generated automatically
- ✅ **Penpot workspace**: Embedded and ready
- ✅ **Timer**: Counts down automatically
- ✅ **Submit**: Button to submit design

**Just restart Next.js and open the URL!** 🚀
