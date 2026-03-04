"""
Application configuration using Pydantic settings.
"""

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator
import os


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Environment Configuration
    ENVIRONMENT: str = "development"
    
    # API Configuration
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Data Engineer Assessment Platform"
    
    # CORS Configuration
    BACKEND_CORS_ORIGINS: List[str] = [
        "http://localhost:3000",  # Next.js frontend
        "http://localhost:8000",  # FastAPI backend
        "http://127.0.0.1:3000",
        "http://127.0.0.1:8000",
        "https://qa.aaptor.com",  # Aptor production frontend
        "http://frontend:3000",   # Docker frontend
    ]
    
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)
    
    # Database Configuration
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DATABASE: str = "data_engineer_platform"
    
    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379"
    REDIS_DB: int = 0
    
    # AI Service Configuration
    GROQ_API_KEY: Optional[str] = None
    GROQ_API_BASE_URL: str = "https://api.groq.com/openai/v1"
    GROQ_MODEL: str = "llama-3.3-70b-versatile"
    
    # Docker Configuration
    DOCKER_SOCKET: str = "unix:///var/run/docker.sock"
    EXECUTION_IMAGE: str = "data-engineering-service/pyspark-executor:latest"
    CONTAINER_TIMEOUT: int = 60  # 60 seconds - aggressive timeout for fast feedback
    CONTAINER_MEMORY_LIMIT: str = "768m"  # Reduced from 1g for faster startup
    CONTAINER_CPU_LIMIT: str = "1.0"
    
    # Container Pool Configuration
    CONTAINER_POOL_ENABLED: bool = True  # Re-enabled with hostname resolution fix
    CONTAINER_POOL_SIZE: int = 2  # Number of warm containers to maintain
    CONTAINER_POOL_MAX_EXECUTIONS: int = 50  # Recycle after this many executions
    CONTAINER_POOL_WARMUP_TIMEOUT: int = 30  # Timeout for container warmup
    CONTAINER_POOL_GET_TIMEOUT: int = 10  # Timeout for getting container from pool
    
    # Rate Limiting Configuration
    AI_REQUESTS_PER_HOUR: int = 100
    EXECUTION_REQUESTS_PER_HOUR: int = 50
    
    # Caching Configuration
    CACHE_TTL_QUESTIONS: int = 3600  # 1 hour
    CACHE_TTL_USER_PROGRESS: int = 1800  # 30 minutes
    CACHE_TTL_EXECUTION_RESULTS: int = 86400  # 24 hours
    
    # Security Configuration
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Logging Configuration
    LOG_LEVEL: str = "INFO"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()