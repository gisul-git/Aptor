# Super Admin Service

Microservice for Super Admin operations with direct database access to all collections.

## Setup Steps

### 1. Environment Variables

Create a `.env` file in `services/super-admin-service/` directory with the following variables:

```env
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017
MONGO_DB=ai_assessment

# JWT Configuration (MUST match Auth Service)
JWT_SECRET=your-secret-key-here-minimum-32-characters
JWT_ALGORITHM=HS256
JWT_EXP_MINUTES=60
JWT_REFRESH_EXP_DAYS=30

# Optional: RSA Keys (if using RS256 algorithm)
# JWT_RSA_PRIVATE_KEY_PATH=/path/to/private.pem
# JWT_RSA_PUBLIC_KEY_PATH=/path/to/public.pem

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,https://gisul-ai-assessment.vercel.app

# Application Settings
APP_NAME=Super Admin Service
DEBUG=false
```

**Important:** 
- `JWT_SECRET` must match the one used in Auth Service
- Generate a secure JWT_SECRET: `openssl rand -base64 32`
- `MONGO_DB` should be `ai_assessment` to access all collections

### 2. Install Python Packages

#### Option A: Using Docker (Recommended)
No manual installation needed - Docker will install packages automatically.

#### Option B: Local Development
```bash
cd services/super-admin-service
pip install -r requirements.txt
```

### 3. Docker Setup

The service is already configured in `docker-compose.yml`. To start:

```bash
# From project root
docker-compose up -d super-admin-service

# Or start all services
docker-compose up -d
```

### 4. Local Development (Without Docker)

```bash
cd services/super-admin-service

# Install dependencies
pip install -r requirements.txt

# Run the service
uvicorn main:app --host 0.0.0.0 --port 3006 --reload
```

### 5. Verify Installation

#### Health Check
```bash
curl http://localhost:3006/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "super-admin-service",
  "database": "connected"
}
```

#### Test API Gateway Routing
```bash
curl http://localhost/api/v1/super-admin/health
```

### 6. API Endpoints

All endpoints are prefixed with `/api/v1/super-admin`:

- `POST /login` - Super admin login
- `POST /verify-mfa` - MFA verification
- `GET /me` - Get current super admin profile
- `GET /overview` - Dashboard statistics (all services)
- `GET /list` - List all super admins
- `GET /logins` - Super admin login logs
- `GET /org-admin-logs` - Org admin activity logs (all services)

### 7. Database Collections Accessed

The service has direct access to:
- `users` - All user accounts
- `assessments` - AI Assessment Service
- `custom_mcq_assessments` - Custom MCQ Service
- `tests` - DSA/AIML Services
- `superadmin_logs` - Super admin login logs

### 8. Troubleshooting

#### Service won't start
- Check MongoDB is running: `docker ps | grep mongo`
- Verify environment variables are set correctly
- Check logs: `docker logs gisul-super-admin-service`

#### Database connection errors
- Verify `MONGO_URI` is correct
- Ensure MongoDB container is running
- Check network connectivity in docker-compose

#### JWT token errors
- Ensure `JWT_SECRET` matches Auth Service
- Verify `JWT_ALGORITHM` matches Auth Service
- Check token expiration settings

#### API Gateway routing issues
- Verify `SUPER_ADMIN_SERVICE_URL` in API Gateway environment
- Check API Gateway logs: `docker logs gisul-api-gateway`
- Ensure service is running on port 3006

### 9. Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MONGO_URI` | Yes | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGO_DB` | Yes | `ai_assessment` | Database name (must be main DB) |
| `JWT_SECRET` | Yes | - | JWT secret key (must match Auth Service) |
| `JWT_ALGORITHM` | No | `HS256` | JWT algorithm (HS256 or RS256) |
| `JWT_EXP_MINUTES` | No | `60` | Access token expiration (minutes) |
| `JWT_REFRESH_EXP_DAYS` | No | `30` | Refresh token expiration (days) |
| `CORS_ORIGINS` | No | `http://localhost:3000` | Allowed CORS origins |
| `DEBUG` | No | `false` | Enable debug mode |

### 10. Next Steps

1. ✅ Create `.env` file with required variables
2. ✅ Start MongoDB (if not using Docker)
3. ✅ Start Super Admin Service
4. ✅ Verify health check endpoint
5. ✅ Test API Gateway routing
6. ✅ Test Super Admin login flow

## Notes

- The service uses direct database access (bypasses other services)
- All assessment types are included in statistics and logs
- Service works even if other microservices are down
- Read-only operations (no write/update, only read + delete)

