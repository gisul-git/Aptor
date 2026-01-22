"""Application settings for DSA Service."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "DSA Service"
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "dsa_db"
    cors_origins: str = "http://localhost:3000"
    judge0_url: str = "http://168.220.236.250:2358"
    judge0_api_key: str | None = None
    judge0_timeout: int = 60
    openai_api_key: str | None = None

    # Email / SendGrid configuration
    email_provider: str = "sendgrid"
    sendgrid_api_key: str | None = None
    sendgrid_from_email: str | None = None
    sendgrid_from_name: str | None = "AI Assessment Platform"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

