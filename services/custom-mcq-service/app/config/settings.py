"""Application settings for Custom MCQ Service."""
from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Custom MCQ Service"
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "custom_mcq_db"
    cors_origins: str = "http://localhost:3000"
    openai_api_key: Optional[str] = None
    # Email configuration
    sendgrid_api_key: Optional[str] = None
    sendgrid_from_email: Optional[str] = None
    sendgrid_from_name: Optional[str] = None
    email_provider: str = "sendgrid"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

