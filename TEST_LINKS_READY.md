# ✅ Design Assessment Platform - Test Links Ready!

## 🎯 Quick Start

Your design assessment platform is fully operational! Here are working test links:

### 🔗 Test Links (Pick Any):

1. **Food Delivery Dashboard (Intermediate)**
   - http://localhost:3001/design/assessment/6985870673fb356c3c67c03c

2. **Food Delivery Dashboard (Intermediate)**
   - http://localhost:3001/design/assessment/69858ae5dcd6d36f29ce5669

3. **Online Learning Platform Login (Beginner)**
   - http://localhost:3001/design/assessment/69859489a5e7db8f49252cad

4. **Food Delivery Dashboard (Intermediate)**
   - http://localhost:3001/design/assessment/6985b302602dcf07170de191

5. **Food Delivery Dashboard (Intermediate)**
   - http://localhost:3001/design/assessment/6985b31f602dcf07170de195

---

## 📊 System Status

✅ **Frontend**: Running on http://localhost:3001  
✅ **Backend**: Running on http://localhost:3006  
✅ **MongoDB**: Connected (50 questions available)  
✅ **Penpot**: Available on http://localhost:9001  

---

## 🚀 How to Test

1. **Open any test link above** in your browser
2. The assessment page will load with:
   - Question details on the left
   - Penpot design workspace on the right
   - Timer at the top
3. **Design in Penpot** (embedded iframe)
4. **Click "Submit Design"** when done
5. System will:
   - Capture all screenshots (every 30s)
   - Track all events (clicks, undo/redo, idle time)
   - Evaluate the design
   - Show results page

---

## 📸 Screenshot & Event Capture

The system automatically captures:
- **Screenshots**: Every 30 seconds (for AI evaluation)
- **Click Events**: X, Y coordinates of every click
- **Undo/Redo**: Tracks Ctrl+Z and Ctrl+Shift+Z
- **Idle Time**: Detects inactivity > 30 seconds

All data is stored in MongoDB for evaluation.

---

## 🔍 View Candidate Data

To see screenshots and events for a specific candidate:

```bash
cd Aptor
python view_candidate_designs.py
```

This will show:
- All candidates who took the test
- Their screenshots
- Their interaction events
- Statistics (clicks, undo, redo, idle time)

---

## 📝 Get More Test Links

To see all 50 available test links:

```bash
cd Aptor
python get_valid_test_links.py
```

---

## 🎨 Penpot Credentials

If you need to access Penpot directly:
- **URL**: http://localhost:9001
- **Email**: admin@example.com
- **Password**: 12312312

---

## ⚙️ Evaluation System

The evaluation is based on:
1. **Design Quality** (not element count!)
2. **Meeting Requirements** (constraints, role, task)
3. **AI Visual Analysis** (using screenshots)
4. **Interaction Quality** (using event data)

Scoring:
- Rule-based score (40%)
- AI-based score (60%)
- Final score = weighted average

---

## 🎯 Ready for Demo!

Everything is working and ready to show your senior. Just open any test link and start designing!

**Recommended Test Link:**
http://localhost:3001/design/assessment/6985870673fb356c3c67c03c
