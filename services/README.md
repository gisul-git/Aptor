# Microservices Architecture

This directory contains all microservices extracted from the monolithic backend.

## Architecture Overview

```
API Gateway (Port 80)
    │
    ├── Auth Service (4000) → auth_db
    ├── AI Assessment Service (3001) → ai_assessment_db
    ├── Custom MCQ Service (3002) → custom_mcq_db
    ├── AIML Service (3003) → aiml_db
    ├── DSA Service (3004) → dsa_db
    └── Proctoring Service (3005) → proctoring_db
```

## Services

### API Gateway
- **Location**: `api-gateway/`
- **Port**: 80
- **Technology**: Node.js/Express
- **Purpose**: Request routing, authentication, rate limiting

### Auth Service
- **Location**: `auth-service/`
- **Port**: 4000
- **Technology**: Python/FastAPI
- **Database**: `auth_db`
- **Purpose**: Authentication, authorization, user management

### AI Assessment Service
- **Location**: `ai-assessment-service/` (to be created)
- **Port**: 3001
- **Technology**: Python/FastAPI
- **Database**: `ai_assessment_db`
- **Purpose**: AI-powered assessment creation and management

### Custom MCQ Service
- **Location**: `custom-mcq-service/` (to be created)
- **Port**: 3002
- **Technology**: Python/FastAPI
- **Database**: `custom_mcq_db`
- **Purpose**: Custom MCQ/Subjective test management

### AIML Service
- **Location**: `aiml-service/` (to be created)
- **Port**: 3003
- **Technology**: Python/FastAPI
- **Database**: `aiml_db`
- **Purpose**: AI/ML competency assessments

### DSA Service
- **Location**: `dsa-service/` (to be created)
- **Port**: 3004
- **Technology**: Python/FastAPI
- **Database**: `dsa_db`
- **Purpose**: Data structures and algorithms assessments

### Proctoring Service
- **Location**: `proctoring-service/` (to be created)
- **Port**: 3005
- **Technology**: Python/FastAPI
- **Database**: `proctoring_db`
- **Purpose**: Proctoring and violation management

## Quick Start

See [QUICK_START.md](../QUICK_START.md) for detailed instructions.

### Start All Services (Docker)
```bash
docker-compose up -d
```

### Start Individual Service
```bash
cd services/auth-service
uvicorn main:app --reload --port 4000
```

## Creating New Services

Use the helper script:
```bash
chmod +x scripts/create_service_structure.sh
./scripts/create_service_structure.sh <service-name> <port> <db-name>
```

Example:
```bash
./scripts/create_service_structure.sh ai-assessment-service 3001 ai_assessment_db
```

## Service Structure

Each service follows this structure:
```
service-name/
├── app/
│   ├── api/v1/          # API routes
│   ├── core/            # Core utilities (config, security)
│   ├── db/              # Database connection
│   ├── utils/           # Utility functions
│   └── exceptions/      # Exception handlers
├── main.py              # FastAPI application entry point
├── requirements.txt     # Python dependencies
├── Dockerfile          # Docker configuration
└── .env.example        # Environment variables template
```

## Shared Utilities

Each service needs these shared utilities (copy from `backend/app/`):
- `core/config.py` → Service-specific settings
- `core/security.py` → JWT, password hashing
- `db/mongo.py` → Database connection (update DB name)
- `utils/responses.py` → Response helpers
- `utils/mongo.py` → MongoDB utilities
- `exceptions/handlers.py` → Exception handlers

## Environment Variables

Each service needs:
- `MONGO_URI`: MongoDB connection string
- `MONGO_DB`: Service-specific database name
- `CORS_ORIGINS`: Allowed CORS origins
- Service-specific variables (API keys, etc.)

## Testing

### Test Gateway
```bash
curl http://localhost:80/health
```

### Test Service
```bash
curl http://localhost:4000/health
```

### Test Through Gateway
```bash
curl http://localhost:80/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password"}'
```

## Documentation

- [Migration Guide](../MICROSERVICES_MIGRATION_GUIDE.md)
- [Implementation Summary](../IMPLEMENTATION_SUMMARY.md)
- [Quick Start](../QUICK_START.md)
- [Implementation Status](../IMPLEMENTATION_STATUS.md)

