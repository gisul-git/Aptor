"""Application settings for Proctoring Service."""
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Proctoring Service"
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "proctoring_db"
    cors_origins: str = "http://localhost:3000"
    redis_url: str = "redis://localhost:6379/1"
    aws_access_key: str | None = None
    aws_secret_key: str | None = None
    aws_region: str | None = None
    aws_s3_bucket: str | None = None
    agora_app_id: str = ""
    agora_app_certificate: str = ""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

