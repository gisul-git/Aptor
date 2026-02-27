"""
Core Configuration Settings for Design Service
"""

from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Design Competency Assessment Service"
    VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    PORT: int = int(os.getenv("PORT", 3006))
    
    # MongoDB
    MONGODB_URL: str = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "aptor_design")
    
    # JWT
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # CORS
    CORS_ORIGINS: str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173,http://localhost:4173")
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS string into list"""
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    # AI Service (OpenAI/Gemini/Claude)
    AI_PROVIDER: str = os.getenv("AI_PROVIDER", "openai")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    CLAUDE_API_KEY: str = os.getenv("CLAUDE_API_KEY", "")
    AI_MODEL: str = os.getenv("AI_MODEL", "gpt-4")
    
    # Penpot Configuration
    PENPOT_URL: str = os.getenv("PENPOT_URL", "http://localhost:9001")
    PENPOT_API_URL: str = os.getenv("PENPOT_API_URL", "http://localhost:6060")
    PENPOT_ACCESS_TOKEN: str = os.getenv("PENPOT_ACCESS_TOKEN", "")
    PENPOT_ADMIN_EMAIL: str = os.getenv("PENPOT_ADMIN_EMAIL", "admin@penpot.app")
    PENPOT_ADMIN_PASSWORD: str = os.getenv("PENPOT_ADMIN_PASSWORD", "12312312")
    
    # Redis
    REDIS_HOST: str = os.getenv("REDIS_HOST", "localhost")
    REDIS_PORT: int = int(os.getenv("REDIS_PORT", 6379))
    REDIS_DB: int = int(os.getenv("REDIS_DB", 0))
    
    # Proctoring Service
    PROCTORING_SERVICE_URL: str = os.getenv(
        "PROCTORING_SERVICE_URL",
        "http://localhost:3005"
    )
    
    # Assessment Defaults
    DEFAULT_TEST_DURATION_MINUTES: int = 60
    DEFAULT_EVALUATION_TIMEOUT_SECONDS: int = 120
    
    # Evaluation Weights
    RULE_BASED_WEIGHT: float = 0.6
    AI_BASED_WEIGHT: float = 0.4
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
