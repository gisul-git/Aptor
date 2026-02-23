# DSA Service Documentation

## Overview

The **DSA Service** is a microservice for managing Data Structures and Algorithms (DSA) assessments, including coding questions, SQL questions, test creation, candidate management, and code execution.

## Technology Stack

- **Framework**: FastAPI (Python)
- **Database**: MongoDB (Motor for async operations)
- **Code Execution**: Judge0 API
- **AI Features**: OpenAI API (for question generation and feedback)
- **Email**: SendGrid
- **Port**: 3004 (default)

## Service Structure

```
dsa-service/
├── app/
│   ├── api/v1/dsa/
│   │   ├── routers/          # API endpoints
│   │   │   ├── tests.py      # Test management
│   │   │   ├── questions.py   # Question management
│   │   │   ├── submissions.py # Submission handling
│   │   │   ├── assessment.py  # Assessment logic
│   │   │   ├── admin.py      # Admin operations
│   │   │   └── run.py        # Code execution
│   │   ├── models/           # Data models
│   │   ├── services/         # Business logic
│   │   └── utils/            # Utilities
│   ├── config/               # Configuration
│   ├── db/                   # Database connections
│   └── core/                 # Core dependencies
├── main.py                   # FastAPI application entry
└── requirements.txt          # Python dependencies
```

## Main Features

### 1. Test Management
- Create, update, delete DSA tests
- Test publishing/unpublishing
- Test cloning
- Test pause/resume
- Organization-based isolation

### 2. Question Management
- Create coding questions (Python, JavaScript, C++, Java)
- Create SQL questions
- AI-powered question generation
- Question validation and testing
- Expected output computation

### 3. Candidate Management
- Add candidates to tests
- Send invitations (email)
- Bulk candidate import (CSV)
- Track candidate status
- Organization and employee isolation

### 4. Code Execution
- Code compilation and execution via Judge0
- Support for multiple languages
- Test case validation
- Public and hidden test cases
- Real-time code execution

### 5. Submissions
- Submit code solutions
- Track submission history
- AI-powered code feedback
- Score calculation
- Final submission handling

### 6. Employee Integration
- Fetch tests assigned to employees by email
- Organization-based filtering
- Aaptor ID verification
- Employee test aggregation endpoint

## API Endpoints

### Base URL
```
http://localhost:3004/api/v1/dsa
```

### Main Endpoints

#### Tests
- `GET /tests` - List all tests
- `POST /tests` - Create new test
- `GET /tests/{test_id}` - Get test details
- `PATCH /tests/{test_id}` - Update test
- `PUT /tests/{test_id}` - Replace test
- `GET /tests/employee-tests` - Get employee assigned tests
- `POST /tests/{test_id}/add-candidate` - Add candidate
- `POST /tests/{test_id}/send-invitation` - Send invitation
- `POST /tests/{test_id}/bulk-add-candidates` - Bulk add candidates

#### Questions
- `GET /questions` - List questions
- `POST /questions` - Create question
- `GET /questions/{question_id}` - Get question details
- `PUT /questions/{question_id}` - Update question
- `DELETE /questions/{question_id}` - Delete question
- `POST /questions/generate` - AI generate question

#### Submissions
- `POST /tests/{test_id}/start` - Start test
- `GET /tests/{test_id}/submission` - Get submission
- `PATCH /tests/{test_id}/submission` - Update submission
- `POST /tests/{test_id}/final-submit` - Final submission

#### Code Execution
- `POST /run` - Execute code
- `POST /run-sql` - Execute SQL query

#### Admin
- `POST /admin/generate-question` - AI question generation
- Various admin operations

## Environment Variables

Required in `.env` file:

```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGO_DB=dsa_db

# Judge0 (Code Execution)
JUDGE0_URL=http://168.220.236.250:2358
JUDGE0_API_KEY=your_judge0_key

# OpenAI (AI Features)
OPENAI_API_KEY=your_openai_key

# SendGrid (Email)
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@example.com
SENDGRID_FROM_NAME=AI Assessment Platform

# CORS
CORS_ORIGINS=http://localhost:3000
```

## Database Collections

- `tests` - DSA test documents
- `questions` - Question bank
- `test_candidates` - Candidate invitations and status
- `submissions` - Code submissions and results

## Key Models

### Test
- Test metadata (title, description, duration)
- Question IDs
- Candidate list
- Proctoring settings
- Organization ID
- Publishing status

### Question
- Question type (coding/SQL)
- Problem description
- Test cases (public/hidden)
- Starter code
- Expected outputs
- Difficulty level

### Submission
- Test ID
- Candidate ID
- Question submissions
- Code solutions
- Test results
- Scores
- Timestamps

## Security Features

- Organization-based data isolation
- Employee-level access control
- JWT token authentication
- Role-based authorization (org_admin, editor)
- Service-to-service authentication support

## Dependencies

- `fastapi==0.111.0`
- `uvicorn[standard]==0.30.0`
- `motor==3.4.0` (MongoDB async driver)
- `pymongo==4.6.3`
- `httpx==0.27.0`
- `openai==1.45.0`

## Running the Service

### Development
```bash
uvicorn main:app --host 0.0.0.0 --port 3004 --reload
```

### Using Scripts
```bash
# Windows
start_service.bat

# Linux/Mac
./start_service.sh
```

### Health Check
```bash
GET http://localhost:3004/health
```

## Integration

- **API Gateway**: Routes requests to this service
- **Employee Service**: Shares employee data for candidate management
- **Auth Service**: Validates JWT tokens
- **Frontend**: React/Next.js consumes REST API endpoints

## Notes

- Supports both coding questions (multiple languages) and SQL questions
- Uses Judge0 for secure code execution
- AI features require OpenAI API key
- Email notifications require SendGrid configuration
- All endpoints support organization-based isolation

