# MongoDB Connection Guide

## 🔍 The Situation

There are **TWO MongoDB instances** running:

1. **Local MongoDB** (standalone) - Running on localhost:27017 ❌ EMPTY
2. **Docker MongoDB** (in container `aptor-mongo-1`) - Has all the data ✅

The backend service runs in Docker and connects to the Docker MongoDB. But Python scripts running on your local machine connect to the local MongoDB by default.

## ✅ Solution: Use Docker MongoDB

### Option 1: Use Docker Exec (Recommended)

Run MongoDB commands directly in the Docker container:

```bash
# Count sessions
docker exec aptor-mongo-1 mongosh --quiet --eval "db.getSiblingDB('aptor_design').design_sessions.countDocuments({})"

# View sessions
docker exec aptor-mongo-1 mongosh --quiet --eval "db.getSiblingDB('aptor_design').design_sessions.find({}, {session_id: 1, user_id: 1, question_id: 1}).limit(5).toArray()"

# View screenshots
docker exec aptor-mongo-1 mongosh --quiet --eval "db.getSiblingDB('aptor_design').screenshots.find({}, {session_id: 1, timestamp: 1}).limit(5).toArray()"

# View events
docker exec aptor-mongo-1 mongosh --quiet --eval "db.getSiblingDB('aptor_design').events.find({}, {session_id: 1, type: 1}).limit(5).toArray()"

# View submissions
docker exec aptor-mongo-1 mongosh --quiet --eval "db.getSiblingDB('aptor_design').design_submissions.find({}, {session_id: 1, final_score: 1}).limit(5).toArray()"
```

### Option 2: Use Python Script

Use the `check_docker_mongodb.py` script:

```bash
python Aptor/check_docker_mongodb.py
```

This script uses `docker exec` internally to query the Docker MongoDB.

### Option 3: Stop Local MongoDB (Advanced)

If you want Python scripts to connect directly:

1. Stop the local MongoDB service
2. Then Python scripts will connect to Docker MongoDB on port 27017

**Windows:**
```powershell
# Stop MongoDB service (requires admin)
Stop-Service MongoDB

# Or stop the process
Stop-Process -Name mongod -Force
```

## 📊 Quick Data Check

```bash
# Use the Docker check script
python Aptor/check_docker_mongodb.py
```

## 🎯 For Viewing Candidate Data

The helper scripts need to be updated to use Docker MongoDB. For now, use:

```bash
# View all candidates for a question
docker exec aptor-mongo-1 mongosh --quiet --eval "
  db.getSiblingDB('aptor_design').design_sessions.find(
    {question_id: '6985870673fb356c3c67c03c'},
    {session_id: 1, user_id: 1, question_id: 1, started_at: 1}
  ).toArray()
"

# Count screenshots for a session
docker exec aptor-mongo-1 mongosh --quiet --eval "
  db.getSiblingDB('aptor_design').screenshots.countDocuments(
    {session_id: '212ecc42-1b8f-4a87-b85c-ad711b92fd42'}
  )
"

# Count events for a session
docker exec aptor-mongo-1 mongosh --quiet --eval "
  db.getSiblingDB('aptor_design').events.countDocuments(
    {session_id: '212ecc42-1b8f-4a87-b85c-ad711b92fd42'}
  )
"
```

## 🔧 Current Status

✅ **Backend is saving data correctly** to Docker MongoDB
✅ **Sessions, screenshots, events, submissions** are all being saved
✅ **Evaluation is working** (strict scoring)
❌ **Python helper scripts** need to be updated to use Docker MongoDB

## 📝 Next Steps

1. Update helper scripts to use `docker exec` or subprocess calls
2. Or stop local MongoDB to allow direct connection
3. Or use MongoDB Compass to connect to Docker MongoDB

---

**For demo purposes, use `check_docker_mongodb.py` to verify data!**
