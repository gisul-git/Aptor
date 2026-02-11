# 📋 How to View 50 Candidates Taking the Same Question

## Scenario: 50 Candidates, Same Question

When 50 candidates take the **same question**, each candidate gets a **unique session_id**. This is how you identify which screenshot belongs to which candidate.

---

## 🔍 Step 1: See All Candidates for a Question

```bash
cd Aptor
python view_candidates_for_question.py <question_id>
```

**Example:**
```bash
python view_candidates_for_question.py 6985870673fb356c3c67c03c
```

**Output:**
```
================================================================================
📝 QUESTION: 6985870673fb356c3c67c03c
================================================================================

✅ Found 50 candidates who took this question

================================================================================

👤 CANDIDATE 1
   User ID: candidate-1707567890123
   Session ID: abc123-session-id-1
   Started: 2026-02-10 10:30:00
   Ended: 2026-02-10 11:30:00
   📸 Screenshots: 120
   🎯 Events: 450 total
      - Clicks: 320
      - Undo: 45
      - Redo: 12
      - Idle time: 180s
   ⭐ Final Score: 85/100

   🔗 View this candidate's data:
      python view_single_candidate.py abc123-session-id-1

--------------------------------------------------------------------------------

👤 CANDIDATE 2
   User ID: candidate-1707567890456
   Session ID: def456-session-id-2
   Started: 2026-02-10 10:35:00
   Ended: 2026-02-10 11:35:00
   📸 Screenshots: 115
   🎯 Events: 380 total
      - Clicks: 280
      - Undo: 38
      - Redo: 8
      - Idle time: 240s
   ⭐ Final Score: 72/100

   🔗 View this candidate's data:
      python view_single_candidate.py def456-session-id-2

... (and 48 more candidates)
```

---

## 👤 Step 2: View a Specific Candidate's Data

Once you have the **session_id**, view that candidate's complete data:

```bash
python view_single_candidate.py <session_id>
```

**Example:**
```bash
python view_single_candidate.py abc123-session-id-1
```

**Output:**
```
================================================================================
👤 CANDIDATE DATA
================================================================================

Session ID: abc123-session-id-1
User ID: candidate-1707567890123
Question ID: 6985870673fb356c3c67c03c
Started: 2026-02-10 10:30:00
Ended: 2026-02-10 11:30:00

--------------------------------------------------------------------------------

📸 SCREENSHOTS (120 total)

   1. Captured at: 2026-02-10T10:30:30
      Created: 2026-02-10 10:30:30
      Size: 45678 bytes
      MongoDB ID: 507f1f77bcf86cd799439011

   2. Captured at: 2026-02-10T10:31:00
      Created: 2026-02-10 10:31:00
      Size: 46234 bytes
      MongoDB ID: 507f1f77bcf86cd799439012

   ... (118 more screenshots)

--------------------------------------------------------------------------------

🎯 EVENTS (450 total)

   📊 STATISTICS:
      Total Events: 450
      Clicks: 320
      Undo: 45
      Redo: 12
      Idle periods: 3
      Total idle time: 180s

   📝 EVENT DETAILS:

   1. CLICK at (450, 320) on BUTTON - 2026-02-10T10:30:15
   2. CLICK at (520, 380) on DIV - 2026-02-10T10:30:18
   3. UNDO - 2026-02-10T10:30:25
   4. CLICK at (600, 400) on SPAN - 2026-02-10T10:30:30
   ... (446 more events)

--------------------------------------------------------------------------------

📊 EVALUATION RESULTS

   Rule-based Score: 82/100
   AI-based Score: 88/100
   ⭐ Final Score: 85/100

   💬 FEEDBACK:
      layout_quality: Excellent use of whitespace
      color_scheme: Professional and consistent
      typography: Clear hierarchy
      ...

================================================================================
```

---

## 🗂️ Step 3: List All Questions with Candidate Counts

To see which questions have candidates:

```bash
python view_candidates_for_question.py
```

**Output:**
```
================================================================================
📋 ALL QUESTIONS WITH CANDIDATE COUNTS
================================================================================

1. Question: Food Delivery Dashboard
   ID: 6985870673fb356c3c67c03c
   👥 Candidates: 50
   🔗 View: python view_candidates_for_question.py 6985870673fb356c3c67c03c
--------------------------------------------------------------------------------
2. Question: Online Learning Platform Login
   ID: 69859489a5e7db8f49252cad
   👥 Candidates: 25
   🔗 View: python view_candidates_for_question.py 69859489a5e7db8f49252cad
--------------------------------------------------------------------------------
```

---

## 🔑 Key Points

### Each Candidate Has:
1. **Unique User ID**: `candidate-1707567890123`
2. **Unique Session ID**: `abc123-session-id-1`
3. **Their Own Screenshots**: Linked by `session_id`
4. **Their Own Events**: Linked by `session_id`
5. **Their Own Score**: Stored in submission

### How to Identify Candidates:
- **By Session ID**: Most reliable (unique per test attempt)
- **By User ID**: Identifies the person (can take multiple tests)
- **By Timestamp**: When they started/ended the test

### MongoDB Collections:
- `design_sessions`: Maps user_id → session_id → question_id
- `screenshots`: Each has `session_id` field
- `events`: Each has `session_id` field
- `design_submissions`: Final scores, linked by `session_id`

---

## 📊 Example Workflow

**Scenario**: 50 candidates took "Food Delivery Dashboard" question

1. **List all candidates:**
   ```bash
   python view_candidates_for_question.py 6985870673fb356c3c67c03c
   ```

2. **Pick candidate #15** (session_id: `xyz789-session-15`)

3. **View their data:**
   ```bash
   python view_single_candidate.py xyz789-session-15
   ```

4. **See their 120 screenshots** and **450 events**

5. **Check their score:** 85/100

---

## 🎯 Quick Commands

```bash
# List all questions with candidate counts
python view_candidates_for_question.py

# View all candidates for a specific question
python view_candidates_for_question.py <question_id>

# View a specific candidate's complete data
python view_single_candidate.py <session_id>
```

---

## ✅ Summary

When 50 candidates take the same question:
- Each gets a **unique session_id**
- All their screenshots have that **session_id**
- All their events have that **session_id**
- You can easily identify and view each candidate's data separately

**No confusion, everything is tracked per candidate!** 🚀
