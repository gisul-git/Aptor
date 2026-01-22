# AI Assessment Service

Microservice for AI-powered assessment creation and management.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Create `.env` file:
```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB=ai_assessment_db
OPENAI_API_KEY=your-key-here
GEMINI_API_KEY=your-key-here
REDIS_URL=redis://localhost:6379/0
CORS_ORIGINS=http://localhost:3000
```

3. Start the service:
```bash
uvicorn main:app --reload --port 3001
```

## Files to Copy

This service structure is created, but you need to copy the actual route implementations:

1. **Routes**: Copy `backend/app/api/v1/assessments/routers.py` → `app/api/v1/assessments/routers.py`
2. **Schemas**: Copy `backend/app/api/v1/assessments/schemas.py` → `app/api/v1/assessments/schemas.py`
3. **Services**: Copy `backend/app/api/v1/assessments/services/` → `app/api/v1/assessments/services/`
4. **Models**: Copy `backend/app/api/v1/assessments/models/` → `app/api/v1/assessments/models/`
5. **Topic Suggestions**: Copy `backend/app/api/v1/assessments/topic_suggestions.py` → `app/api/v1/assessments/topic_suggestions.py`
6. **Code Execution**: Copy `backend/app/api/v1/assessments/code_execution.py` → `app/api/v1/assessments/code_execution.py`
7. **Candidate Routes**: Copy `backend/app/api/v1/candidate/` → `app/api/v1/candidate/`
8. **Super Admin Routes**: Copy `backend/app/api/v1/super_admin/` → `app/api/v1/super_admin/`
9. **Aptitude Topics**: Copy `backend/app/models/aptitude_topics.py` → `app/models/aptitude_topics.py`

## Database

Uses `ai_assessment_db` database with collections:
- assessments
- topics
- questions
- candidate_sessions
- submissions

## Dependencies

- OpenAI API (for question generation)
- Gemini API (for summarization)
- Redis (for caching - optional)

## Testing

```bash
# Health check
curl http://localhost:3001/health

# Through gateway
curl http://localhost:80/api/v1/assessments/list
```

