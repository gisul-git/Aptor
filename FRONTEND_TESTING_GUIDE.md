# Frontend Testing Guide - Design Service

## 🎯 Quick Test URLs

### **Option 1: Simple Test Page (Recommended)**
```
http://localhost:3000/design-test
```
- ✅ No external dependencies
- ✅ Uses native fetch API
- ✅ Inline styles
- ✅ Should work immediately

### **Option 2: Full Test Page**
```
http://localhost:3000/design/api-test
```
- Uses designService client
- More features
- May need rebuild

---

## 🔧 If You See "Internal Server Error"

### **Step 1: Wait for Next.js to Rebuild**
Next.js needs to compile new pages. Wait 10-20 seconds after creating a new page, then refresh.

### **Step 2: Check Browser Console**
1. Press **F12** to open DevTools
2. Go to **Console** tab
3. Look for error messages
4. Share the error with me

### **Step 3: Restart Next.js (if needed)**
```powershell
# Stop Next.js
Get-Process -Name node | Where-Object {(Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -eq 3000})} | Stop-Process

# Start Next.js
cd Aptor/frontend
npm run dev
```

---

## 🧪 Manual API Test (Without Frontend)

If the frontend isn't working, test the API directly:

### **PowerShell Test:**
```powershell
# Test health
Invoke-RestMethod -Uri 'http://localhost:3006/api/v1/design/health'

# Generate question
$body = @{
    role='ui_designer'
    difficulty='intermediate'
    task_type='dashboard'
    topic='food delivery'
    created_by='test_user'
} | ConvertTo-Json

Invoke-RestMethod -Uri 'http://localhost:3006/api/v1/design/questions/generate' `
    -Method Post -Body $body -ContentType 'application/json'
```

### **Browser Test:**
Open: `http://localhost:3006/docs`
- This is the FastAPI Swagger UI
- You can test all endpoints directly
- No frontend needed

---

## 📊 Troubleshooting Checklist

### ✅ **Backend (FastAPI)**
```powershell
# Check if running
docker ps --filter "name=design-service"

# Should show: Up X minutes (healthy)

# Test API
Invoke-RestMethod -Uri 'http://localhost:3006/health'

# Should return: {"status": "healthy"}
```

### ✅ **Frontend (Next.js)**
```powershell
# Check if running
Get-Process -Name node | Where-Object {(Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -eq 3000})}

# Should show node process

# Check if accessible
Invoke-WebRequest -Uri 'http://localhost:3000' -UseBasicParsing

# Should return HTML
```

### ✅ **Environment Variables**
```powershell
# Check if set
Get-Content Aptor/frontend/.env.local | Select-String "DESIGN"

# Should show:
# NEXT_PUBLIC_DESIGN_SERVICE_URL=http://localhost:3006/api/v1/design
```

---

## 🎯 Expected Results

### **When you open: http://localhost:3000/design-test**

You should see:
- 🎨 **Title**: "Design Service Test"
- 🔘 **Two buttons**: "Test Health Check" and "Generate Question"
- 📝 **Instructions** at the bottom

### **When you click "Test Health Check":**

Success response:
```json
{
  "status": "healthy",
  "timestamp": "2026-02-06T...",
  "services": {
    "database": "healthy",
    "ai_service": "healthy",
    "penpot_service": "healthy"
  }
}
```

### **When you click "Generate Question":**

Success response:
```json
{
  "_id": "...",
  "role": "ui_designer",
  "difficulty": "intermediate",
  "task_type": "dashboard",
  "title": "Food Delivery Dashboard",
  "description": "...",
  "time_limit_minutes": 60
}
```

---

## 🚨 Common Errors & Solutions

### **Error: "Internal Server Error"**
**Cause**: Next.js compilation error or missing dependency

**Solution**:
1. Wait 10-20 seconds for Next.js to rebuild
2. Refresh the page (Ctrl+R)
3. Check browser console (F12) for details
4. If persists, restart Next.js

### **Error: "Failed to fetch" or "Network Error"**
**Cause**: Backend not running or CORS issue

**Solution**:
1. Check backend is running: `docker ps --filter "name=design-service"`
2. Test API directly: `Invoke-RestMethod -Uri 'http://localhost:3006/health'`
3. Check CORS in browser console

### **Error: "Cannot find module '@/services/designService'"**
**Cause**: Import path issue

**Solution**:
Use the simpler test page: `http://localhost:3000/design-test`
(This page doesn't use external imports)

### **Error: "404 Not Found"**
**Cause**: Page not compiled yet

**Solution**:
1. Wait 10-20 seconds
2. Refresh page
3. Check Next.js terminal for compilation messages

---

## 🎓 Understanding the Stack

### **Frontend (Next.js)**
- **Framework**: Next.js 13+ (React)
- **Language**: TypeScript
- **Port**: 3000
- **Pages**: `src/pages/*.tsx`
- **API Client**: `src/services/designService.ts`

### **Backend (FastAPI)**
- **Framework**: FastAPI (Python)
- **Language**: Python 3.11
- **Port**: 3006
- **Endpoints**: `/api/v1/design/*`
- **Docs**: `http://localhost:3006/docs`

### **Communication**
```
Browser → Next.js (3000) → FastAPI (3006) → MongoDB
```

---

## 📞 Quick Commands

```powershell
# Check backend
docker ps --filter "name=design-service"
Invoke-RestMethod -Uri 'http://localhost:3006/health'

# Check frontend
Get-Process -Name node | Where-Object {(Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue | Where-Object {$_.LocalPort -eq 3000})}

# View API docs
Start-Process "http://localhost:3006/docs"

# Open test page
Start-Process "http://localhost:3000/design-test"
```

---

## ✅ Success Indicators

You'll know everything is working when:

1. ✅ Page loads without "Internal Server Error"
2. ✅ You see two buttons: "Test Health Check" and "Generate Question"
3. ✅ Clicking "Test Health Check" shows green success box
4. ✅ Clicking "Generate Question" shows design challenge details
5. ✅ No errors in browser console (F12)

---

## 🎉 Next Steps

Once the test page works:

1. **Test workspace creation** - Add button to create Penpot workspace
2. **Test full assessment flow** - Use `/design/test` page
3. **Integrate with your app** - Use the components in your actual pages

---

**Try this now:** `http://localhost:3000/design-test`

Wait 10-20 seconds for Next.js to compile, then refresh if needed.
