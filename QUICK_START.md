# Microservices Quick Start Guide

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- MongoDB running on localhost:27017
- Redis running on localhost:6379 (optional)

### Step 1: Start Infrastructure

```bash
# Start MongoDB and Redis (if using Docker)
docker-compose up -d mongo redis
```

### Step 2: Start API Gateway

```bash
cd services/api-gateway
npm install
npm start
```

The gateway will run on `http://localhost:80`

### Step 3: Start Auth Service

```bash
cd services/auth-service
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
MONGO_URI=mongodb://localhost:27017
MONGO_DB=auth_db
JWT_SECRET=$(openssl rand -base64 32)
JWT_ALGORITHM=HS256
CORS_ORIGINS=http://localhost:3000
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your_key_here
SENDGRID_FROM_EMAIL=your_email@example.com
EOF

# Start service
uvicorn main:app --host 0.0.0.0 --port 4000 --reload
```

### Step 4: Test the Setup

```bash
# Test gateway health
curl http://localhost:80/health

# Test auth service health
curl http://localhost:4000/health

# Test login through gateway
curl -X POST http://localhost:80/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test123!"}'
```

## 📁 Project Structure

```
services/
├── api-gateway/          # Node.js API Gateway
│   ├── src/
│   │   └── index.js
│   ├── package.json
│   └── Dockerfile
│
├── auth-service/          # Python FastAPI Auth Service
│   ├── app/
│   │   ├── api/v1/auth/
│   │   ├── core/
│   │   ├── db/
│   │   └── utils/
│   ├── main.py
│   ├── requirements.txt
│   └── Dockerfile
│
└── [other services...]    # To be created
```

## 🔧 Configuration

### Environment Variables

**API Gateway** (`services/api-gateway/.env`):
```env
PORT=80
AUTH_SERVICE_URL=http://localhost:4000
CORS_ORIGINS=http://localhost:3000
```

**Auth Service** (`services/auth-service/.env`):
```env
MONGO_URI=mongodb://localhost:27017
MONGO_DB=auth_db
JWT_SECRET=your-secret-here
JWT_ALGORITHM=HS256
````

## 🐳 Docker Compose

Start all services at once:

```bash
docker-compose up -d
```

View logs:
```bash
docker-compose logs -f api-gateway
docker-compose logs -f auth-service
```

Stop all services:
```bash
docker-compose down
```

## 📝 Next Steps

1. **Complete Auth Service**: Copy remaining routes from `backend/app/api/v1/auth/routers.py`
2. **Extract Other Services**: Use `scripts/create_service_structure.sh`
3. **Update Frontend**: Change API base URL to `http://localhost:80`
4. **Database Migration**: Copy collections to service-specific databases

## 🐛 Troubleshooting

### Gateway can't connect to services
- Check service URLs in gateway `.env`
- Ensure services are running on correct ports
- Check network connectivity

### Auth service can't connect to MongoDB
- Verify MongoDB is running: `mongosh --eval "db.adminCommand('ping')"`
- Check `MONGO_URI` in auth service `.env`
- Ensure database name is correct

### JWT verification fails
- Ensure `JWT_SECRET` is the same across gateway and auth service
- Check token expiration
- Verify token format

## 📚 Documentation

- [Migration Guide](./MICROSERVICES_MIGRATION_GUIDE.md)
- [Implementation Status](./IMPLEMENTATION_STATUS.md)
- [API Gateway README](./services/api-gateway/README.md)

