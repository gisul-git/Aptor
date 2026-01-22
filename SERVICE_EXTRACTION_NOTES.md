# Service Extraction Notes

## AI Assessment Service

### Files to Copy from Monolithic Backend

1. **Routes** (`backend/app/api/v1/assessments/routers.py`)
   - Copy entire file to `services/ai-assessment-service/app/api/v1/assessments/routers.py`
   - Update imports to use relative paths from service structure
   - Change: `from ....core.dependencies` → `from ....core.dependencies`
   - Change: `from ....db.mongo` → `from ....db.mongo`

2. **Schemas** (`backend/app/api/v1/assessments/schemas.py`)
   - Copy to `services/ai-assessment-service/app/api/v1/assessments/schemas.py`

3. **Services Directory** (`backend/app/api/v1/assessments/services/`)
   - Copy entire directory to `services/ai-assessment-service/app/api/v1/assessments/services/`
   - This includes all AI generation logic

4. **Models** (`backend/app/api/v1/assessments/models/`)
   - Copy to `services/ai-assessment-service/app/api/v1/assessments/models/`

5. **Topic Suggestions** (`backend/app/api/v1/assessments/topic_suggestions.py`)
   - Copy to `services/ai-assessment-service/app/api/v1/assessments/topic_suggestions.py`

6. **Code Execution** (`backend/app/api/v1/assessments/code_execution.py`)
   - Copy to `services/ai-assessment-service/app/api/v1/assessments/code_execution.py`

7. **Candidate Routes** (`backend/app/api/v1/candidate/`)
   - Copy entire directory to `services/ai-assessment-service/app/api/v1/candidate/`

8. **Super Admin Routes** (`backend/app/api/v1/super_admin/`)
   - Copy entire directory to `services/ai-assessment-service/app/api/v1/super_admin/`

9. **Aptitude Topics** (`backend/app/models/aptitude_topics.py`)
   - Copy to `services/ai-assessment-service/app/models/aptitude_topics.py`

### Import Updates Needed

In all copied files, update imports:

**Before:**
```python
from ....core.dependencies import require_editor
from ....db.mongo import get_db
from ....utils.mongo import serialize_document
```

**After:**
```python
from ....core.dependencies import require_editor
from ....db.mongo import get_db
from ....utils.mongo import serialize_document
```

(Actually, these should work as-is since we're maintaining the same relative structure)

### Database Changes

- All database operations will automatically use `ai_assessment_db` (set in `app/config/settings.py`)
- Collections: assessments, topics, questions, candidate_sessions, submissions

### Dependencies

- OpenAI API key (for question generation)
- Gemini API key (for summarization)
- Redis (for caching - optional but recommended)

### Testing

After copying files:
1. Test service startup: `uvicorn main:app --reload --port 3001`
2. Test health endpoint: `curl http://localhost:3001/health`
3. Test through gateway: `curl http://localhost:80/api/v1/assessments/list`

