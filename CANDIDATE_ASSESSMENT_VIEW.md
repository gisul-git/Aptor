# 🎨 Candidate Assessment View - EXACTLY What You Asked For!

## 📺 Screen Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Food Delivery Dashboard                    ⏱️ Time: 59:45  [Submit] │  │
│  │  UI DESIGNER • INTERMEDIATE                                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────┬──────────────────────────────────────────────┐  │
│  │  LEFT PANEL          │  RIGHT PANEL                                 │  │
│  │  (Question Details)  │  (Penpot Workspace)                          │  │
│  │                      │                                              │  │
│  │  Challenge:          │  ┌────────────────────────────────────────┐ │  │
│  │  Design a mobile     │  │                                        │ │  │
│  │  dashboard for...    │  │     PENPOT DESIGN WORKSPACE            │ │  │
│  │                      │  │                                        │ │  │
│  │  Constraints:        │  │     [Candidate designs here]           │ │  │
│  │  • Mobile platform   │  │                                        │ │  │
│  │  • 3 sections        │  │     • Drawing tools                    │ │  │
│  │  • Clear hierarchy   │  │     • Shapes                           │ │  │
│  │                      │  │     • Text                             │ │  │
│  │  Deliverables:       │  │     • Colors                           │ │  │
│  │  • Dashboard screen  │  │     • Layers                           │ │  │
│  │  • Component list    │  │                                        │ │  │
│  │                      │  │                                        │ │  │
│  │  Evaluation:         │  │                                        │ │  │
│  │  • Visual hierarchy  │  │                                        │ │  │
│  │  • Consistency       │  │                                        │ │  │
│  │  • Spacing           │  └────────────────────────────────────────┘ │  │
│  │  • Color usage       │                                              │  │
│  │  • Usability         │                                              │  │
│  │                      │                                              │  │
│  └──────────────────────┴──────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 What the Candidate Sees

### **1. Start Screen**
When candidate first opens the page:
- Welcome message
- "Start Assessment" button
- Instructions about what to expect

### **2. Assessment Screen (Split Layout)**

#### **LEFT SIDE (320px width)**
- **Challenge**: Full question description
- **Constraints**: List of design constraints
- **Deliverables**: What they need to create
- **Evaluation Criteria**: How they'll be scored
- **Scrollable** if content is long

#### **RIGHT SIDE (Remaining width)**
- **Penpot Workspace**: Full embedded design tool
- Candidate can:
  - Draw shapes
  - Add text
  - Use colors
  - Create components
  - Design the solution

#### **TOP HEADER**
- **Question Title**: e.g., "Food Delivery Dashboard"
- **Role & Difficulty**: e.g., "UI DESIGNER • INTERMEDIATE"
- **Timer**: Counts down from 60:00
- **Submit Button**: To submit the design

---

## 🚀 How to Access

### **URL:**
```
http://localhost:3000/design-assessment
```

### **Steps:**
1. Open the URL in your browser
2. Wait 10-20 seconds for Next.js to compile
3. Refresh the page if you see an error
4. Click "Start Assessment"
5. You'll see the split layout!

---

## 🎬 User Flow

```
1. Candidate opens URL
   ↓
2. Sees welcome screen
   ↓
3. Clicks "Start Assessment"
   ↓
4. Backend generates AI question
   ↓
5. Backend creates Penpot workspace
   ↓
6. Screen splits into:
   - LEFT: Question details
   - RIGHT: Penpot workspace
   ↓
7. Timer starts counting down
   ↓
8. Candidate designs in Penpot
   ↓
9. Candidate clicks "Submit"
   ↓
10. Design is evaluated
```

---

## 📝 Technical Details

### **Frontend (Next.js)**
- **File**: `Aptor/frontend/src/pages/design-assessment.tsx`
- **Framework**: React with TypeScript
- **Styling**: Inline styles (no dependencies)
- **API Calls**: Native fetch API

### **Backend (FastAPI)**
- **Endpoint 1**: `POST /api/v1/design/questions/generate`
  - Generates AI design question
  
- **Endpoint 2**: `POST /api/v1/design/workspace/create`
  - Creates Penpot workspace
  - Returns workspace URL

### **Penpot Integration**
- **Embedded**: Using iframe
- **URL**: `http://localhost:9001/#/workspace?token=...`
- **Permissions**: clipboard-read, clipboard-write

---

## 🎨 Features

### **✅ Implemented**
- Split screen layout (question left, workspace right)
- AI-generated design questions
- Penpot workspace embedding
- Timer with countdown
- Submit button
- Responsive design
- Error handling
- Loading states

### **⏳ To Be Added (Future)**
- Screenshot capture on submit
- Design file export
- Automated evaluation
- Score display
- Proctoring integration

---

## 🔧 Customization

### **Change Question Parameters**
Edit in `design-assessment.tsx`:
```typescript
{
  role: 'ui_designer',        // or 'ux_designer', 'product_designer'
  difficulty: 'intermediate', // or 'beginner', 'advanced'
  task_type: 'dashboard',     // or 'landing_page', 'mobile_app'
  topic: 'food delivery'      // any topic
}
```

### **Change Timer Duration**
Edit in `design-assessment.tsx`:
```typescript
setTimeLeft(questionData.time_limit_minutes * 60);
```

### **Change Layout Width**
Edit in `design-assessment.tsx`:
```typescript
<div style={{ width: '320px', ... }}>  // Change 320px to your preferred width
```

---

## 🎉 This is EXACTLY What You Wanted!

Your design competency assessment is complete with:
- ✅ **Left side**: Generated question with all details
- ✅ **Right side**: Penpot playground for designing
- ✅ **Timer**: Counts down
- ✅ **Submit**: Button to submit design
- ✅ **Full screen**: Immersive assessment experience

---

## 🚀 Try It Now!

```
http://localhost:3000/design-assessment
```

**Wait 10-20 seconds for Next.js to compile, then refresh if needed!**
