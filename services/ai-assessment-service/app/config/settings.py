"""Application settings and configuration for AI Assessment Service."""
import os
import sys
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AI Assessment Service"
    debug: bool = False
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "ai_assessment_db"  # Service-specific database
    jwt_secret: str = "change-me"  # Not used directly, but needed for shared utilities
    jwt_algorithm: str = "HS256"
    cors_origins: str = "http://localhost:3000,https://gisul-ai-assessment.vercel.app"
    # Redis configuration (read from .env file)
    redis_url: str = "redis://localhost:6379/0"  # Default fallback, override with REDIS_URL in .env
    # OpenAI
    openai_api_key: str | None = None
    # Gemini
    gemini_api_key: str | None = None
    gemini_model_summary: str = "gemini-pro"
    # AWS Configuration (for file storage)
    aws_access_key: str | None = None
    aws_secret_key: str | None = None
    aws_region: str | None = None
    # Email (for notifications)
    email_provider: str = "sendgrid"
    sendgrid_api_key: str | None = None
    sendgrid_from_email: str | None = None
    # Service URLs for inter-service communication
    aiml_service_url: str = "http://localhost:3003"
    dsa_service_url: str = "http://localhost:3004"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

