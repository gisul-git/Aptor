"""Application settings for AIML Service."""
from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "AIML Service"
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "aiml_db"
    cors_origins: str = "http://localhost:3000"
    
    # Email configuration
    email_provider: str = "sendgrid"
    sendgrid_api_key: Optional[str] = None
    sendgrid_from_email: Optional[str] = None
    sendgrid_from_name: Optional[str] = "AI Assessment Platform"
    aws_access_key: Optional[str] = None
    aws_secret_key: Optional[str] = None
    aws_region: Optional[str] = None
    aws_email_source: Optional[str] = None
    azure_comm_connection_string: Optional[str] = None
    azure_comm_sender_address: Optional[str] = None

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

