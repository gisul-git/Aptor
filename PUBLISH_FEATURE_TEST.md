# Design Question Publish/Unpublish Feature - Test Guide

## ✅ Backend Tests (PASSED)

The backend API is working correctly:
- ✅ Publish endpoint: `PATCH /api/v1/design/questions/{id}/publish?is_published=true`
- ✅ Database updates persist correctly
- ✅ Questions include `is_published` field in response
- ✅ Port 3007 is working

Test results:
```
Total questions: 32
Published: 5
Draft: 27
```

## 🔧 Frontend Testing Steps

### 1. Test Publish Button on Questions Page

**URL:** http://localhost:3002/design/questions

**Steps:**
1. Navigate to Design Questions page
2. Find a question with "Draft" badge
3. Click the "Publish" button
4. Verify:
   - Badge changes from "Draft" to "Published" (green)
   - No error alert appears
   - Question remains in the list

5. Click "Unpublish" button
6. Verify:
   - Badge changes from "Published" to "Draft" (gray)
   - No error alert appears

### 2. Test Create Assessment Filter

**URL:** http://localhost:3002/design/create

**Steps:**
1. Navigate to Create Design Competency Test page
2. Verify the info message: "ℹ️ Only published questions are shown here"
3. Count the questions shown
4. Go back to Questions page and note how many are "Published"
5. Verify the counts match

### 3. Test End-to-End Flow

**Complete Flow:**
1. Go to Questions page
2. Unpublish ALL questions (make them all Draft)
3. Go to Create Assessment page
4. Verify: "No published questions available" message shows
5. Go back to Questions page
6. Publish 2-3 questions
7. Go to Create Assessment page
8. Verify: Only the published questions appear
9. Create a test with those questions
10. Verify: Test is created successfully

## 🐛 Troubleshooting

If publish button doesn't work:

1. **Clear browser cache:**
   - Press Ctrl+Shift+Delete
   - Clear cached images and files
   - Reload page (Ctrl+F5)

2. **Check browser console:**
   - Press F12
   - Go to Console tab
   - Look for errors when clicking Publish

3. **Verify services are running:**
   - Design Service: http://localhost:3007/docs
   - Frontend: http://localhost:3002

4. **Check network tab:**
   - Press F12 → Network tab
   - Click Publish button
   - Look for the PATCH request to `/api/v1/design/questions/{id}/publish`
   - Check if it returns 200 OK

## 📝 Implementation Details

### Backend Changes
- ✅ Added `is_published` field to `DesignQuestionModel`
- ✅ Added `updated_at` field to track changes
- ✅ Publish endpoint uses query parameter: `?is_published=true`

### Frontend Changes
- ✅ Fixed import in `useDesign.ts` to use `@/services/design`
- ✅ Added `publishQuestion` method to `design.service.ts`
- ✅ Added `usePublishDesignQuestion` hook
- ✅ Questions page uses React Query mutation
- ✅ Create Assessment page filters for `is_published === true`

## 🎯 Expected Behavior

1. **Questions Page:**
   - Shows all questions (published and draft)
   - Each question has a badge showing status
   - Publish/Unpublish button toggles status
   - Status updates immediately (optimistic update)

2. **Create Assessment Page:**
   - Shows ONLY published questions
   - Info message explains the filter
   - If no published questions, shows helpful message with link

3. **Database:**
   - All questions have `is_published` field (default: false)
   - Updates persist across page refreshes
   - Cloud database: `aptor_design_Competency`
