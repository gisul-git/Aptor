"""Application settings and configuration."""
import os
import sys
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Employee Service"
    debug: bool = False
    mongo_uri: str = "mongodb://localhost:27017"
    # Database where employee documents are stored (legacy - will migrate to org_admins_db)
    mongo_db: str = "employee_db"
    # Database for organization admins and their employees
    org_admins_db: str = "org_admins_db"
    # Separate database to store organization documents
    organization_mongo_db: str = "organization_db"
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    cors_origins: str = "http://localhost:3000,https://gisul-ai-assessment.vercel.app"
    # Frontend base URL for emails (set-password link). Set NEXT_PUBLIC_APP_URL in production to your deployed domain.
    next_public_app_url: str = "http://localhost:3000"
    
    # Email settings
    email_provider: str = "sendgrid"
    sendgrid_api_key: str | None = None
    sendgrid_from_email: str | None = None
    sendgrid_from_name: str | None = None
    aws_access_key: str | None = None
    aws_secret_key: str | None = None
    aws_region: str | None = None
    aws_email_source: str | None = None
    azure_comm_connection_string: str | None = None
    azure_comm_sender_address: str | None = None

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

