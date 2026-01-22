# API Gateway

API Gateway for microservices architecture. Handles routing, authentication, and request/response transformation.

## Features

- Request routing to microservices
- JWT token verification via auth service
- User context injection (X-User-Id, X-Org-Id, X-Role headers)
- Rate limiting
- Correlation ID tracking
- CORS handling
- Health checks

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Start the gateway:
```bash
npm start
# or for development
npm run dev
```

## Environment Variables

- `PORT`: Gateway port (default: 80)
- `AUTH_SERVICE_URL`: Auth service URL
- `AI_ASSESSMENT_SERVICE_URL`: AI Assessment service URL
- `CUSTOM_MCQ_SERVICE_URL`: Custom MCQ service URL
- `AIML_SERVICE_URL`: AIML service URL
- `DSA_SERVICE_URL`: DSA service URL
- `PROCTORING_SERVICE_URL`: Proctoring service URL
- `CORS_ORIGINS`: Comma-separated list of allowed origins

## Routes

- `/api/v1/auth/*` → Auth Service
- `/api/v1/assessments/*` → AI Assessment Service
- `/api/v1/custom-mcq/*` → Custom MCQ Service
- `/api/v1/aiml/*` → AIML Service
- `/api/v1/dsa/*` → DSA Service
- `/api/v1/proctor/*` → Proctoring Service
- `/api/v1/users/*` → User Service
- `/health` → Gateway health check

