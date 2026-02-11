# 👥 How to View Designs When 50 Candidates Take Same Test

## 🎯 Scenario
50 candidates take the same test (same question). You want to check what Candidate #1 designed.

---

## ✅ Solution: Use the Python Script

### Step 1: List All Questions
```bash
python view_candidate_designs.py list
```

**Output**:
```
================================================================================
📋 ALL QUESTIONS
================================================================================

1. Online Learning Platform Login Screen
   ID: 698ad0f0772b7671c846d17f
   Role: ui_designer | Difficulty: beginner
   👥 Candidates: 50

   📸 View all candidates:
      python view_candidate_designs.py question 698ad0f0772b7671c846d17f
```

---

### Step 2: View All 50 Candidates for That Question
```bash
python view_candidate_designs.py question 698ad0f0772b7671c846d17f
```

**Output**:
```
================================================================================
📋 QUESTION: Online Learning Platform Login Screen
   Role: ui_designer | Difficulty: beginner
================================================================================

👥 TOTAL CANDIDATES: 50

────────────────────────────────────────────────────────────────────────────────
CANDIDATE #1: candidate-john@example.com
────────────────────────────────────────────────────────────────────────────────
  Session ID: 698ad415903a53da6f59527b
  Status: ✅ Submitted
  Score: 75.5/100
  Started: 2024-02-10T12:00:00Z
  Ended: 2024-02-10T12:45:00Z
  Screenshots: 15
  Events: 45

  📸 View screenshots:
     python view_candidate_designs.py screenshots 698ad415903a53da6f59527b

────────────────────────────────────────────────────────────────────────────────
CANDIDATE #2: candidate-jane@example.com
────────────────────────────────────────────────────────────────────────────────
  Session ID: 698ad416903a53da6f59527c
  Status: ✅ Submitted
  Score: 82.3/100
  Started: 2024-02-10T13:00:00Z
  Ended: 2024-02-10T13:40:00Z
  Screenshots: 12
  Events: 38

  📸 View screenshots:
     python view_candidate_designs.py screenshots 698ad416903a53da6f59527c

... (continues for all 50 candidates)
```

---

### Step 3: View Candidate #1's Screenshots
```bash
python view_candidate_designs.py screenshots 698ad415903a53da6f59527b
```

**Output**:
```
================================================================================
👤 CANDIDATE: candidate-john@example.com
📋 QUESTION: Online Learning Platform Login Screen
🔗 SESSION: 698ad415903a53da6f59527b
================================================================================

📸 TOTAL SCREENSHOTS: 15

Screenshot #1
  ID: 698ad500903a53da6f595280
  Time: 2024-02-10T12:00:30Z
  Size: 125,000 bytes (122.07 KB)

Screenshot #2
  ID: 698ad501903a53da6f595281
  Time: 2024-02-10T12:01:00Z
  Size: 128,500 bytes (125.49 KB)

... (all 15 screenshots)

================================================================================
💡 TO VIEW SCREENSHOTS IN MONGODB COMPASS:
================================================================================
1. Open 'screenshots' collection
2. Filter: {'session_id': '698ad415903a53da6f59527b'}
3. Click any screenshot document
4. Copy the 'image_data' field value
5. Paste in browser address bar
6. Press Enter to view the image

================================================================================
📊 EVALUATION RESULTS:
================================================================================
  Final Score: 75.5/100
  Rule-Based: 68.0/100
  AI-Based: 87.0/100

  Feedback:
    Overall: Good design with clear structure
    Strengths: Clean layout, Good typography
    Improvements: Add more visual hierarchy, Improve color contrast
```

---

## 🖥️ Alternative: MongoDB Compass (Manual)

### Method 1: Filter by Question
1. Open `design_sessions` collection
2. Filter: `{"question_id": "698ad0f0772b7671c846d17f"}`
3. You'll see all 50 candidates
4. Each has a unique `session_id` and `user_id`

### Method 2: View Specific Candidate's Screenshots
1. Copy the candidate's `session_id` from above
2. Open `screenshots` collection
3. Filter: `{"session_id": "698ad415903a53da6f59527b"}`
4. You'll see all screenshots for that candidate
5. Click any screenshot → Copy `image_data` → Paste in browser

---

## 📊 Quick Reference Commands

### List all questions:
```bash
python view_candidate_designs.py list
```

### View all candidates for a question:
```bash
python view_candidate_designs.py question <question_id>
```

### View specific candidate's screenshots:
```bash
python view_candidate_designs.py screenshots <session_id>
```

---

## 🎯 Real-World Example

**Scenario**: 50 candidates took "Login Screen Design" test. You want to review Candidate #1.

**Steps**:

1. **Find the question ID**:
   ```bash
   python view_candidate_designs.py list
   ```
   → Copy question ID: `698ad0f0772b7671c846d17f`

2. **See all 50 candidates**:
   ```bash
   python view_candidate_designs.py question 698ad0f0772b7671c846d17f
   ```
   → Find Candidate #1: `candidate-john@example.com`
   → Copy session ID: `698ad415903a53da6f59527b`

3. **View Candidate #1's screenshots**:
   ```bash
   python view_candidate_designs.py screenshots 698ad415903a53da6f59527b
   ```
   → See all 15 screenshots with timestamps

4. **View in MongoDB Compass**:
   - Open `screenshots` collection
   - Filter: `{"session_id": "698ad415903a53da6f59527b"}`
   - Click screenshot → Copy `image_data` → Paste in browser

---

## 💡 Pro Tips

### Tip 1: Compare Multiple Candidates
Run the question command to see all candidates side-by-side with their scores:
```bash
python view_candidate_designs.py question <question_id>
```

### Tip 2: Sort by Score
In MongoDB Compass:
1. Open `design_submissions` collection
2. Filter: `{"question_id": "698ad0f0772b7671c846d17f"}`
3. Sort by `final_score` (descending)
4. See top performers first

### Tip 3: Export All Screenshots for a Candidate
In MongoDB Compass:
1. Filter screenshots by `session_id`
2. Click "Export Data"
3. Choose JSON format
4. All screenshots exported with image data

---

## 🔑 Key Points

1. **Each candidate has a unique `session_id`**
2. **All screenshots have the candidate's `session_id`**
3. **Filter by `session_id` to see one candidate's work**
4. **Filter by `question_id` to see all candidates for one test**

---

## ✅ Summary

**To check Candidate #1's design when 50 candidates took the same test**:

1. Run: `python view_candidate_designs.py question <question_id>`
2. Find Candidate #1 in the list
3. Copy their `session_id`
4. Run: `python view_candidate_designs.py screenshots <session_id>`
5. Or filter in MongoDB Compass: `{"session_id": "<session_id>"}`

**The script makes it easy to navigate through all 50 candidates!** 🎯
