"""Application settings and configuration."""
import os
import sys
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Auth Service"
    debug: bool = False
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "auth_db"  # Service-specific database
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    jwt_exp_minutes: int = 60
    jwt_refresh_exp_days: int = 30
    cors_origins: str = "http://localhost:3000,https://gisul-ai-assessment.vercel.app"
    jwt_rsa_private_key_path: str | None = None
    jwt_rsa_public_key_path: str | None = None
    max_failed_attempts: int = 10
    lockout_duration_minutes: int = 30
    rate_limit_enabled: bool = True
    rate_limit_requests: int = 10
    rate_limit_window_minutes: int = 15
    redis_url: str = "redis://localhost:6379/0"
    google_client_id: str | None = None
    aws_access_key: str | None = None
    aws_secret_key: str | None = None
    aws_region: str | None = None
    aws_email_source: str | None = None
    azure_comm_connection_string: str | None = None
    azure_comm_sender_address: str | None = None
    sendgrid_api_key: str | None = None
    sendgrid_from_email: str | None = None
    sendgrid_from_name: str | None = None
    email_provider: str = "sendgrid"
    otp_ttl_minutes: int = 5
    email_verification_code_ttl_minutes: int = 1
    frontend_url: str = "http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.jwt_secret == "change-me" or not self.jwt_secret or len(self.jwt_secret) < 32:
            print("=" * 80, file=sys.stderr)
            print("ERROR: JWT_SECRET is not set or is using default value!", file=sys.stderr)
            print("=" * 80, file=sys.stderr)
            print("SECURITY RISK: Using default JWT secret allows token forgery!", file=sys.stderr)
            print("", file=sys.stderr)
            print("Please set JWT_SECRET in your .env file with a strong random value.", file=sys.stderr)
            print("Generate one using: openssl rand -base64 32", file=sys.stderr)
            print("=" * 80, file=sys.stderr)
            sys.exit(1)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

