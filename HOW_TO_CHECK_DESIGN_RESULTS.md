# How to Check Design Test Results as Admin

**Date:** March 5, 2026  
**For:** Design Competency Admin

---

## Where to Check Results (Matches AIML Flow)

### Step 1: Go to Dashboard
```
URL: http://localhost:3002/dashboard
```

### Step 2: Find Your Design Assessment
Look for the Design Assessment card on your dashboard.

### Step 3: Click "View Details"
This will take you to the **Analytics Page**:
```
URL: http://localhost:3002/design/tests/[testId]/analytics
```

---

## Analytics Page Overview

### What You'll See:

#### 1. Overall Test Performance (Top Section)
- **Total Candidates:** How many candidates were added
- **Submitted:** How many completed the test (X / Total)
- **Average Score:** Average score of all submissions
- **Passed:** Number of candidates who scored ≥ 60

#### 2. Candidates List (Left Sidebar)
Shows all candidates with:
- Candidate name
- Email address
- **Score: XX/100** (for submitted tests)
  - 🟢 Green: 70-100 (passed)
  - 🟠 Orange: 50-69 (average)
  - 🔴 Red: 0-49 (failed)

#### 3. Individual Results (Right Panel)
Click on any candidate to see:
- Candidate information
- Submission timestamp
- **Total Score: XX/100**
- Design screenshots
- Evaluation breakdown:
  - Rule-Based Score (60% weight)
  - AI-Based Score (40% weight)
- Detailed feedback summary

---

## Step-by-Step: Check Your Submitted Test

### For the Test You Just Submitted:

1. **Go to Dashboard**
   ```
   http://localhost:3002/dashboard
   ```

2. **Find "Hospital Management System – UX Designer Challenge"**
   - Look for the Design Assessment card

3. **Click "View Details"**
   - This opens the analytics page

4. **You'll See:**
   - Overall statistics at the top
   - Your candidate in the left sidebar
   - Click on the candidate name to see:
     - Score: XX/100
     - Design screenshots
     - Evaluation feedback
     - Rule-based and AI-based scores

---

## AIML vs Design Flow Comparison

### AIML Competency
1. Dashboard → Click "View Details"
2. Goes to `/aiml/tests/[id]/analytics`
3. Shows candidates list with scores
4. Click candidate → See detailed results

### Design Competency (Same!)
1. Dashboard → Click "View Details"
2. Goes to `/design/tests/[testId]/analytics`
3. Shows candidates list with scores
4. Click candidate → See detailed results

**Result:** ✅ Identical flow!

---

## What Results Include

### For Each Submission:

#### Candidate Information
- Name
- Email
- Submission timestamp

#### Scores
- **Overall Score:** Final score out of 100
- **Rule-Based Score:** Automated evaluation (60% weight)
  - Component count
  - Color usage
  - Typography hierarchy
  - Spacing consistency
  - Layout structure
- **AI-Based Score:** AI evaluation (40% weight)
  - Visual design quality
  - Creativity
  - Problem-solving approach

#### Visual Evidence
- Design screenshots captured during submission
- Shows what the candidate created

#### Feedback
- Detailed feedback summary
- Explains strengths and areas for improvement

---

## Quick Access URLs

### Your Test Analytics
```
http://localhost:3002/design/tests/[testId]/analytics
```

Replace `[testId]` with your actual test ID from the URL.

### Example:
If your test URL is:
```
http://localhost:3002/design/tests/177270810655276/take?token=...
```

Then your analytics URL is:
```
http://localhost:3002/design/tests/177270810655276/analytics
```

---

## Features Available on Analytics Page

### Candidate Management
- ✅ Add individual candidates
- ✅ Bulk upload candidates (CSV)
- ✅ Send invitation emails
- ✅ Resend invitations
- ✅ Remove candidates
- ✅ Export results to Excel

### Viewing Options
- ✅ Overall analytics (all candidates)
- ✅ Individual candidate details
- ✅ Search candidates
- ✅ Filter by status

### Actions
- ✅ View detailed scores
- ✅ See design screenshots
- ✅ Read AI feedback
- ✅ Export results

---

## Troubleshooting

### "No candidates found"
- Make sure you've added candidates to the test
- Check if the test is published

### "No submissions yet"
- Candidates need to complete and submit the test
- Check if candidates have started the test

### "Score not showing"
- Evaluation may still be processing
- Refresh the page after a few seconds
- Check if submission was successful

---

## Current Test Status

Based on your submission:
- **Test:** Hospital Management System – UX Designer Challenge
- **Status:** Submitted ✅
- **Evaluation:** Processing in background

**To check results:**
1. Go to Dashboard
2. Find the Design Assessment
3. Click "View Details"
4. Look for your candidate in the list
5. Click to see detailed results

---

## Summary

**As an admin, you check results by:**
1. Dashboard → View Details → Analytics Page
2. See all candidates with scores
3. Click any candidate for detailed results

**This matches AIML competency flow exactly!** ✅

---

**Last Updated:** March 5, 2026  
**Version:** 1.0.0
