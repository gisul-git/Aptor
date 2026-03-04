"""Application settings and configuration for Super Admin Service."""
import os
import sys
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Super Admin Service"
    debug: bool = False
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "auth_db"  # Use auth_db for users collection
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60
    jwt_refresh_exp_days: int = 30
    jwt_rsa_private_key_path: str | None = None
    jwt_rsa_public_key_path: str | None = None
    cors_origins: str = "http://localhost:3000,https://gisul-ai-assessment.vercel.app"
    
    # SendGrid email configuration
    sendgrid_api_key: str | None = None
    sendgrid_from_email: str = "noreply@aaptor.com"
    sendgrid_from_name: str = "Aaptor Platform"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

