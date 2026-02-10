# 🎨 Design Assessment Admin Panel

Complete admin dashboard for managing the Design Competency Assessment Platform.

---

## 🚀 Access the Admin Panel

**URL:** `http://localhost:3001/admin/design`

---

## 📊 Features

### 1. **Questions Tab** 📝

Manage all design assessment questions:

- **View All Questions**: See all 177+ generated questions in a table
- **Search**: Find questions by title
- **Filter**: By role (UI/UX/Product/Visual Designer), difficulty (Beginner/Intermediate/Advanced)
- **Generate New**: Click "Generate Question" to create new AI-powered questions
- **Copy Test Link**: Quick copy test link for any question

**Columns:**
- Title & Description
- Role
- Difficulty (color-coded badges)
- Task Type
- Actions (Copy Link button)

### 2. **Candidates Tab** 👥

View all candidates who took tests:

- **View All Submissions**: See every candidate's submission
- **Search**: Find candidates by user ID
- **Export CSV**: Download all candidate data as CSV file
- **Score Breakdown**: See final score, rule-based score, AI-based score

**Columns:**
- User ID
- Question ID
- Final Score (color-coded: Green 80+, Blue 60+, Orange 40+, Red <40)
- Rule-Based Score
- AI-Based Score
- Submission Date

**Export CSV includes:**
- User ID, Question ID, Scores, Timestamp
- Perfect for sharing with HR/management

### 3. **Analytics Tab** 📊

High-level statistics dashboard:

**Stats Cards:**
- 📝 **Total Questions**: Number of questions in database
- 👥 **Total Candidates**: Number of submissions
- 📊 **Average Score**: Mean score across all submissions
- ✅ **Completion Rate**: Percentage of started tests that were completed

**Helper Scripts Info:**
- Links to Python scripts for detailed analysis
- `check_docker_mongodb.py` - View all MongoDB data
- `view_complete_candidate_data.py` - View specific candidate details
- `quick_check.py` - Quick summary of submissions

### 4. **Test Links Tab** 🔗

Easy test link management:

- **All Questions Listed**: Every question with its test link
- **Copy Link Button**: One-click copy to clipboard
- **Full URL Display**: See the complete test URL
- **Question Details**: Role, difficulty, task type shown

**Perfect for:**
- Sharing links with 50+ candidates
- Quick access to test URLs
- Organized link distribution

---

## 🎯 Common Tasks

### Generate a New Question

1. Go to **Questions Tab**
2. Click **"+ Generate Question"** button
3. Fill in the form:
   - **Role**: UI Designer, UX Designer, Product Designer, Visual Designer
   - **Difficulty**: Beginner, Intermediate, Advanced
   - **Task Type**: Landing Page, Mobile App, Dashboard, Component
   - **Topic** (optional): E.g., "E-commerce", "Healthcare", "Finance"
4. Click **"Generate"**
5. Wait 10-20 seconds for AI to generate
6. Question appears in the table

### Share Test Link with Candidate

**Method 1: From Questions Tab**
1. Find the question in the table
2. Click **"Copy Link"** in Actions column
3. Paste and send to candidate

**Method 2: From Test Links Tab**
1. Go to **Test Links Tab**
2. Find the question
3. Click **"📋 Copy Link"** button
4. Paste and send to candidate

### View Candidate Results

**Option 1: Admin Panel**
1. Go to **Candidates Tab**
2. See all submissions with scores
3. Export CSV for detailed analysis

**Option 2: Python Scripts** (More Detailed)
```bash
# View all data
python check_docker_mongodb.py

# View specific question's candidates
python view_complete_candidate_data.py [question_id]

# Quick summary
python quick_check.py
```

### Export Candidate Data

1. Go to **Candidates Tab**
2. (Optional) Search/filter candidates
3. Click **"📥 Export CSV"** button
4. CSV file downloads automatically
5. Open in Excel/Google Sheets

---

## 🔧 Technical Details

### Backend Endpoints Used

- `GET /api/v1/design/questions` - Fetch all questions
- `POST /api/v1/design/questions/generate` - Generate new question
- `GET /api/v1/design/admin/submissions` - Fetch all submissions
- `GET /api/v1/design/admin/stats` - Get analytics stats

### Frontend Stack

- **Framework**: Next.js (React)
- **Styling**: Tailwind CSS
- **State**: React Hooks (useState, useEffect)
- **API Calls**: Fetch API

### Data Flow

```
Admin Panel (Frontend)
    ↓
Next.js API Routes (Optional)
    ↓
FastAPI Backend (Port 3006)
    ↓
MongoDB (Docker)
```

---

## 📝 Tips & Best Practices

### For Generating Questions

- **Be Specific with Topics**: "E-commerce checkout" is better than "E-commerce"
- **Mix Difficulties**: Generate questions across all difficulty levels
- **Vary Task Types**: Don't just create landing pages, mix it up
- **Review Generated Questions**: Check the description makes sense

### For Managing Candidates

- **Export Regularly**: Download CSV backups of candidate data
- **Use Python Scripts**: For detailed analysis (screenshots, events)
- **Monitor Scores**: Check if questions are too easy/hard
- **Track Completion**: Low completion rate = question might be unclear

### For Sharing Links

- **Test First**: Always test a link yourself before sharing
- **Use Incognito**: Avoid cached data when testing
- **Clear Instructions**: Tell candidates what to expect
- **Set Expectations**: Mention time limit (usually 60 minutes)

---

## 🐛 Troubleshooting

### "No questions found"

**Solution:**
1. Generate questions using the "Generate Question" button
2. Or check backend is running: `http://localhost:3006/api/v1/design/health`

### "No candidates yet"

**Solution:**
- This is normal if no one has taken tests yet
- Share test links with candidates
- Check MongoDB: `python check_docker_mongodb.py`

### "Failed to load data"

**Solution:**
1. Check backend is running: `http://localhost:3006`
2. Check MongoDB is running: `docker ps | grep mongo`
3. Check browser console for errors (F12)

### "Generate question failed"

**Solution:**
1. Check OpenAI API key in backend `.env` file
2. Check backend logs for errors
3. Verify internet connection (API calls to OpenAI)

---

## 🚀 For Production

### Security Considerations

1. **Add Authentication**: Protect `/admin/design` route
2. **Role-Based Access**: Only admins should access
3. **Rate Limiting**: Prevent abuse of generate endpoint
4. **API Keys**: Secure OpenAI API key

### Performance Optimization

1. **Pagination**: Add pagination for large datasets
2. **Caching**: Cache questions list
3. **Lazy Loading**: Load data on-demand
4. **Debouncing**: Debounce search inputs

### Additional Features (Future)

- [ ] Edit/Delete questions
- [ ] Bulk question generation
- [ ] Advanced filtering (date range, score range)
- [ ] Charts and graphs for analytics
- [ ] Real-time updates (WebSocket)
- [ ] Email notifications
- [ ] Candidate feedback viewing
- [ ] Screenshot gallery view

---

## 📞 Support

For issues or questions:

1. Check backend logs: `docker logs aptor-design-service-1`
2. Check MongoDB: `python check_docker_mongodb.py`
3. Review `DESIGN_ASSESSMENT_README.md` for platform details

---

## ✅ Quick Start Checklist

- [ ] Backend running on port 3006
- [ ] Frontend running on port 3001
- [ ] MongoDB running in Docker
- [ ] OpenAI API key configured
- [ ] Access admin panel: `http://localhost:3001/admin/design`
- [ ] Generate a test question
- [ ] Copy test link
- [ ] Take test yourself
- [ ] View results in Candidates tab

---

**Admin Panel is ready! 🎉**

Access it at: `http://localhost:3001/admin/design`
