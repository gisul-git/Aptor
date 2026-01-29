# Environment Variables Template

This file documents the required environment variables for each service. Copy these to `.env` files in each service directory.

## Auth Service (`services/auth-service/.env`)

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB=auth_db

# JWT Configuration (REQUIRED - must be at least 32 characters)
JWT_SECRET=change-me-please-generate-a-strong-secret-using-openssl-rand-base64-32
JWT_ALGORITHM=HS256
JWT_EXP_MINUTES=60
JWT_REFRESH_EXP_DAYS=30

# CORS
CORS_ORIGINS=http://localhost:3000,https://gisul-ai-assessment.vercel.app

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS=10
RATE_LIMIT_WINDOW_MINUTES=15

# Redis
REDIS_URL=redis://localhost:6379/0

# Account Lockout
MAX_FAILED_ATTEMPTS=10
LOCKOUT_DURATION_MINUTES=30

# Email Configuration
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@example.com
SENDGRID_FROM_NAME=AI Assessment Platform

# Google OAuth
GOOGLE_CLIENT_ID=

# OTP and Email Verification
OTP_TTL_MINUTES=5
EMAIL_VERIFICATION_CODE_TTL_MINUTES=1
```

## AI Assessment Service (`services/ai-assessment-service/.env`)

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB=ai_assessment_db

# CORS
CORS_ORIGINS=http://localhost:3000,https://gisul-ai-assessment.vercel.app

# Redis
REDIS_URL=redis://localhost:6379/0

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL_SUMMARY=gemini-pro

# Judge0
JUDGE0_URL=http://168.220.236.250:2358
JUDGE0_TIMEOUT=60
JUDGE0_POLL_INTERVAL=1.5
JUDGE0_MAX_POLLS=20

# AWS
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
AWS_REGION=

# Email
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@example.com

# Service URLs for inter-service communication
AIML_SERVICE_URL=http://localhost:3003
DSA_SERVICE_URL=http://localhost:3004
```

## DSA Service (`services/dsa-service/.env`)

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB=dsa_db

# CORS
CORS_ORIGINS=http://localhost:3000

# Judge0
JUDGE0_URL=http://168.220.236.250:2358
JUDGE0_TIMEOUT=60
JUDGE0_API_KEY=

# OpenAI
OPENAI_API_KEY=your-openai-api-key
```

## AIML Service (`services/aiml-service/.env`)

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB=aiml_db

# CORS
CORS_ORIGINS=http://localhost:3000
```

## Custom MCQ Service (`services/custom-mcq-service/.env`)

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB=custom_mcq_db

# CORS
CORS_ORIGINS=http://localhost:3000
```

## Proctoring Service (`services/proctoring-service/.env`)

```env
# MongoDB
MONGO_URI=mongodb://localhost:27017
MONGO_DB=proctoring_db

# CORS
CORS_ORIGINS=http://localhost:3000

# Redis
REDIS_URL=redis://localhost:6379/1

# AWS S3
AWS_ACCESS_KEY=
AWS_SECRET_KEY=
AWS_REGION=
AWS_S3_BUCKET=
```

## API Gateway (`services/api-gateway/.env`)

```env
# Port
PORT=80

# Service URLs
AUTH_SERVICE_URL=http://localhost:4000
AI_ASSESSMENT_SERVICE_URL=http://localhost:3001
CUSTOM_MCQ_SERVICE_URL=http://localhost:3002
AIML_SERVICE_URL=http://localhost:3003
DSA_SERVICE_URL=http://localhost:3004
PROCTORING_SERVICE_URL=http://localhost:3005

# CORS
CORS_ORIGINS=http://localhost:3000,https://gisul-ai-assessment.vercel.app

# Auth Service URL for token verification
AUTH_VERIFY_URL=http://localhost:4000/api/v1/auth/verify
```

