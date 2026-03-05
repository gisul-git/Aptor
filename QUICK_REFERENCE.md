# Design Competency System - Quick Reference Guide

**Status:** ✅ PRODUCTION READY  
**Last Updated:** March 5, 2026

---

## Quick Start

### Generate a Question
```powershell
$body = @{
    role = "ui_designer"              # ui_designer, ux_designer, product_designer, visual_designer
    difficulty = "beginner"           # beginner, intermediate, advanced
    task_type = "mobile_app"          # mobile_app, dashboard, landing_page, component
    topic = "Food Delivery"           # Any topic you want
    experience_level = "Fresher"      # Optional
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/questions/generate" -Method POST -Body $body -ContentType "application/json"
```

### Check System Status
```powershell
# Check if service is running
docker ps --filter "name=gisul-design-service"

# Check analytics
Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/admin/analytics"

# View recent submissions
Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/admin/submissions?limit=5"
```

### Run Tests
```powershell
# Quick test (3 scenarios)
./test_final_verification.ps1

# Comprehensive test (15 scenarios)
./test_comprehensive.ps1

# Evaluation flow test
./test_design_evaluation_flow.ps1
```

---

## Supported Roles

1. **UI Designer** - Layout, spacing, typography, components
2. **UX Designer** - User flows, navigation, usability
3. **Product Designer** - Strategy, personas, business goals
4. **Visual Designer** - Branding, aesthetics, visual identity
5. **Brand Designer** - Brand systems, logo, guidelines (supported, not tested)
6. **Graphic Designer** - Posters, marketing, print (supported, not tested)
7. **Interaction Designer** - Micro-interactions, transitions (supported, not tested)
8. **Motion Designer** - Animation, motion states (supported, not tested)

---

## Difficulty Levels

| Level | Time | Constraints | Scope |
|-------|------|-------------|-------|
| Beginner | 45 min | 5-6 | Single screen, simple layout |
| Intermediate | 60 min | 7-8 | Multi-section, grid systems |
| Advanced | 90 min | 8-10 | Multiple screens, workflows |

---

## Task Types & Canvas Widths

| Task Type | Canvas Width | Use Case |
|-----------|--------------|----------|
| mobile_app | 375px mobile | Mobile applications |
| dashboard | 1440px desktop | Admin panels, dashboards |
| landing_page | 1440px desktop | Marketing pages |
| component | 1440px desktop | UI components |

---

## Automatic Features

### 1. Canvas Width Auto-Fix
The system automatically corrects canvas width based on task_type:
- mobile_app → 375px mobile layout ✓
- dashboard → 1440px desktop layout ✓
- landing_page → 1440px desktop layout ✓
- component → 1440px desktop layout ✓

### 2. Constraint Count Limiting
The system automatically limits constraints:
- Beginner: 5-6 constraints ✓
- Intermediate: 7-8 constraints ✓
- Advanced: 8-10 constraints ✓

### 3. Neutral Language Processing
The system automatically removes "you/your" phrases:
- "You are tasked with" → "The task involves" ✓
- "Your goal is to" → "The goal is to" ✓
- "You need to design" → "The design must" ✓

---

## API Endpoints

### Question Generation
```
POST /api/v1/design/questions/generate
Body: { role, difficulty, task_type, topic, experience_level }
```

### List Questions
```
GET /api/v1/design/questions
```

### Submit Design
```
POST /api/v1/design/submit
Body: { session_id, user_id, question_id, events }
```

### Admin Analytics
```
GET /api/v1/design/admin/analytics
Returns: { total_questions, total_submissions, average_score, completion_rate }
```

### Admin Submissions
```
GET /api/v1/design/admin/submissions?limit=10
Returns: { submissions: [...], total }
```

---

## Current Statistics

- **Total Questions:** 16
- **Total Submissions:** 18
- **Evaluated:** 18 (100%)
- **Average Score:** 46.5/100
- **Completion Rate:** 100%

---

## Test Results

### Comprehensive Testing
- **Total Tests:** 15
- **Passed:** 15
- **Failed:** 0
- **Success Rate:** 100%

### Validation
- ✅ Canvas Width: 100% correct
- ✅ Constraint Count: 100% correct
- ✅ Time Limits: 100% correct
- ✅ Neutral Language: 100% clean

---

## Troubleshooting

### Service Not Running
```powershell
docker restart gisul-design-service
```

### View Logs
```powershell
docker logs gisul-design-service
```

### Test API Connection
```powershell
Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/questions"
```

### Check MongoDB Connection
```powershell
python check_questions_db.py
```

---

## Example Questions

### Beginner - Mobile App
```
Title: Food Delivery Mobile App – UI Designer Challenge
Time: 45 minutes
Constraints: 6
Canvas: 375px mobile layout
```

### Intermediate - Dashboard
```
Title: Hospital Management System – UX Designer Challenge
Time: 60 minutes
Constraints: 8
Canvas: 1440px desktop layout
```

### Advanced - Landing Page
```
Title: SaaS Platform – Product Designer Challenge
Time: 90 minutes
Constraints: 10
Canvas: 1440px desktop layout
```

---

## Files to Know

### Implementation
- `services/design-service/app/services/ai_question_generator.py` - Main generator
- `services/design-service/app/api/v1/design.py` - API endpoints

### Testing
- `test_final_verification.ps1` - Quick test (3 scenarios)
- `test_comprehensive.ps1` - Full test (15 scenarios)
- `test_design_evaluation_flow.ps1` - Evaluation flow test

### Documentation
- `SYSTEM_STATUS_REPORT.md` - Complete status report
- `COMPREHENSIVE_TEST_RESULTS.md` - Test results
- `AI_QUESTION_GENERATOR_STATUS.md` - Generator status
- `DESIGN_EVALUATION_FLOW_STATUS.md` - Evaluation flow
- `QUICK_REFERENCE.md` - This guide

---

## Configuration

### Environment Variables (.env)
```
OPENAI_API_KEY=sk-proj-...
AI_PROVIDER=openai
AI_MODEL=gpt-4o
MONGODB_URI=mongodb+srv://...
```

### Docker
```
Service: gisul-design-service
Port: 3006
Status: Running
```

---

## Next Steps (Optional)

1. Add more roles (Brand, Graphic, Interaction, Motion)
2. Add Expert difficulty level (120 minutes)
3. Create topic library (50+ topics)
4. Implement question caching
5. Enhance evaluation engine

---

## Support

For issues or questions:
1. Check service logs: `docker logs gisul-design-service`
2. Run tests: `./test_final_verification.ps1`
3. Check analytics: `Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/admin/analytics"`

---

**Status:** ✅ ALL SYSTEMS OPERATIONAL  
**Version:** 1.0.0  
**Ready for Production:** YES
