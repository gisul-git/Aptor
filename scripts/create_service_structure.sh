#!/bin/bash

# Script to create microservice structure from monolithic backend

SERVICE_NAME=$1
SERVICE_PORT=$2
DB_NAME=$3

if [ -z "$SERVICE_NAME" ] || [ -z "$SERVICE_PORT" ] || [ -z "$DB_NAME" ]; then
    echo "Usage: ./create_service_structure.sh <service-name> <port> <db-name>"
    echo "Example: ./create_service_structure.sh ai-assessment-service 3001 ai_assessment_db"
    exit 1
fi

SERVICE_DIR="services/$SERVICE_NAME"

echo "Creating service structure for $SERVICE_NAME..."

# Create directory structure
mkdir -p "$SERVICE_DIR/app/api/v1"
mkdir -p "$SERVICE_DIR/app/core"
mkdir -p "$SERVICE_DIR/app/db"
mkdir -p "$SERVICE_DIR/app/utils"
mkdir -p "$SERVICE_DIR/app/exceptions"

# Create main.py
cat > "$SERVICE_DIR/main.py" << EOF
"""
$SERVICE_NAME - Microservice
"""
from contextlib import asynccontextmanager
import logging
import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.settings import get_settings
from app.db.mongo import connect_to_mongo, close_mongo_connection
from app.exceptions.handlers import (
    validation_exception_handler,
    not_found_handler,
)
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("$SERVICE_NAME")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager."""
    await connect_to_mongo()
    logger.info("✅ $SERVICE_NAME connected to MongoDB")
    yield
    await close_mongo_connection()
    logger.info("✅ $SERVICE_NAME disconnected from MongoDB")


app = FastAPI(
    title="$SERVICE_NAME",
    description="Microservice",
    version="1.0.0",
    lifespan=lifespan,
)

settings = get_settings()
if settings.cors_origins:
    allowed_origins = [origin.strip() for origin in settings.cors_origins.split(",")]
else:
    allowed_origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-User-Id", "X-Org-Id", "X-Role", "X-Correlation-ID"],
    max_age=600,
)

app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(StarletteHTTPException, not_found_handler)


@app.get("/")
async def root():
    return {"message": "$SERVICE_NAME API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "$SERVICE_NAME"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=$SERVICE_PORT)
EOF

# Create requirements.txt (copy from backend)
cp backend/requirements.txt "$SERVICE_DIR/requirements.txt"

# Create Dockerfile
cat > "$SERVICE_DIR/Dockerfile" << EOF
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE $SERVICE_PORT

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "$SERVICE_PORT"]
EOF

# Create .env.example
cat > "$SERVICE_DIR/.env.example" << EOF
MONGO_URI=mongodb://localhost:27017
MONGO_DB=$DB_NAME
CORS_ORIGINS=http://localhost:3000
EOF

echo "✅ Service structure created at $SERVICE_DIR"
echo "Next steps:"
echo "1. Copy routes from backend/app/api/v1/<service>/* to $SERVICE_DIR/app/api/v1/"
echo "2. Copy shared utilities (core, db, utils) from backend/app/"
echo "3. Update database connection to use $DB_NAME"
echo "4. Add service-specific dependencies to requirements.txt"

