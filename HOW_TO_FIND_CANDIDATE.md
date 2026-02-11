# 🔍 How to Find Which Candidate a Screenshot Belongs To

## 📊 Data Structure

```
Screenshot → session_id → Session → user_id (Candidate)
```

Each screenshot has a `session_id` that links to a session, which contains the candidate's `user_id`.

---

## Method 1: MongoDB Compass (Visual)

### Step-by-Step:

#### 1. Open `screenshots` collection
Find the screenshot you want to identify.

#### 2. Look at the `session_id` field
```json
{
  "_id": "698ad8e2903a53da6f59527e",
  "session_id": "698ad415903a53da6f59527b",  ← Copy this!
  "timestamp": "2024-02-10T12:15:30Z",
  "image_data": "data:image/jpeg;base64,...",
  "file_size": 125000
}
```

#### 3. Open `design_sessions` collection

#### 4. Click "Filter" button and search:
```json
{"_id": "698ad415903a53da6f59527b"}
```

#### 5. View candidate information:
```json
{
  "_id": "698ad415903a53da6f59527b",
  "user_id": "candidate-john@example.com",  ← Candidate!
  "assessment_id": "...",
  "question_id": "...",
  "started_at": "2024-02-10T12:00:00Z",
  "ended_at": "2024-02-10T12:45:00Z"
}
```

---

## Method 2: Using Python Script

### List All Candidates with Screenshots:
```bash
python find_candidate_screenshots.py list
```

**Output**:
```
📋 ALL CANDIDATES WITH SCREENSHOTS:

1. Session: 698ad415903a53da6f59527b
   Candidate: candidate-john@example.com
   Screenshots: 15
   First: 2024-02-10T12:00:00Z
   Last: 2024-02-10T12:45:00Z
   Score: 75.5

2. Session: 698ad416903a53da6f59527c
   Candidate: candidate-jane@example.com
   Screenshots: 12
   First: 2024-02-10T13:00:00Z
   Last: 2024-02-10T13:40:00Z
   Score: 82.3
```

### Find Candidate by Session ID:
```bash
python find_candidate_screenshots.py session 698ad415903a53da6f59527b
```

**Output**:
```
👤 CANDIDATE INFORMATION:
  User ID: candidate-john@example.com
  Assessment ID: 698ad0f0772b7671c846d17f
  Question ID: 698ad2cb903a53da6f595277
  Started: 2024-02-10T12:00:00Z
  Ended: 2024-02-10T12:45:00Z

📋 QUESTION DETAILS:
  Title: Online Learning Platform Login Screen
  Role: ui_designer
  Difficulty: beginner

📊 SUBMISSION RESULTS:
  Final Score: 75.5/100
  Rule-Based: 68.0/100
  AI-Based: 87.0/100

📈 SESSION STATISTICS:
  Total Screenshots: 15
  Total Events: 45
```

---

## Method 3: Using API

### Get Session Info:
```powershell
$sessionId = "698ad415903a53da6f59527b"
Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/workspace/$sessionId/status"
```

### Get All Screenshots for a Session:
```powershell
$sessionId = "698ad415903a53da6f59527b"
Invoke-RestMethod -Uri "http://localhost:3006/api/v1/design/sessions/$sessionId/screenshots"
```

---

## 📊 Quick Reference Table

| Collection | Field | Links To |
|------------|-------|----------|
| `screenshots` | `session_id` | `design_sessions._id` |
| `design_sessions` | `user_id` | Candidate identifier |
| `design_sessions` | `question_id` | `design_questions._id` |
| `design_sessions` | `assessment_id` | Assessment identifier |
| `design_submissions` | `session_id` | `design_sessions._id` |
| `events` | `session_id` | `design_sessions._id` |

---

## 💡 Pro Tips

### 1. Filter Screenshots by Candidate
In MongoDB Compass:

**Step 1**: Get candidate's session_id from `design_sessions`:
```json
{"user_id": "candidate-john@example.com"}
```

**Step 2**: Use that session_id in `screenshots`:
```json
{"session_id": "698ad415903a53da6f59527b"}
```

### 2. View All Data for One Candidate
```bash
python find_candidate_screenshots.py session <session_id>
```

This shows:
- Candidate info
- Question details
- Submission results
- Screenshot count
- Event count

### 3. Export Screenshots for a Candidate
In MongoDB Compass:
1. Filter screenshots by `session_id`
2. Click "Export Data"
3. Choose JSON or CSV format

---

## 🎯 Common Use Cases

### Use Case 1: Review a Candidate's Work
1. Find candidate in `design_sessions` by `user_id`
2. Copy their `session_id`
3. View their screenshots in `screenshots` collection
4. View their interactions in `events` collection
5. View their results in `design_submissions` collection

### Use Case 2: Investigate a Specific Screenshot
1. Click the screenshot in `screenshots` collection
2. Copy the `session_id`
3. Search `design_sessions` for that `session_id`
4. See candidate's `user_id`

### Use Case 3: Compare Multiple Candidates
```bash
python find_candidate_screenshots.py list
```
Shows all candidates with their screenshot counts and scores.

---

## ✅ Summary

**To find which candidate a screenshot belongs to**:

1. **Quick Way**: Look at `session_id` in screenshot → Search that ID in `design_sessions` → See `user_id`

2. **Easy Way**: Run `python find_candidate_screenshots.py list` to see all candidates

3. **Detailed Way**: Run `python find_candidate_screenshots.py session <session_id>` for complete info

**The `session_id` is the key that links everything together!** 🔑
