"""
Core Configuration Settings for Design Service
"""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "Design Competency Assessment Service"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    PORT: int = 3006
    
    # MongoDB
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "aptor_design"
    
    # JWT
    JWT_SECRET_KEY: str = "your-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://localhost:4173"
    
    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS_ORIGINS string into list"""
        if not self.CORS_ORIGINS:
            return []
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]
    
    # AI Service (OpenAI/Gemini/Claude)
    AI_PROVIDER: str = "openai"
    OPENAI_API_KEY: str = ""
    GEMINI_API_KEY: str = ""
    CLAUDE_API_KEY: str = ""
    AI_MODEL: str = "gpt-4"
    
    # Penpot Configuration
    PENPOT_URL: str = "http://localhost:9001"
    PENPOT_API_URL: str = "http://aptor-penpot-backend-1:6060"
    PENPOT_ACCESS_TOKEN: str = ""
    PENPOT_ADMIN_EMAIL: str = "admin"
    PENPOT_ADMIN_PASSWORD: str = "12312312"
    
    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    
    # Proctoring Service
    PROCTORING_SERVICE_URL: str = "http://localhost:3005"
    
    # Assessment Defaults
    DEFAULT_TEST_DURATION_MINUTES: int = 60
    DEFAULT_EVALUATION_TIMEOUT_SECONDS: int = 120
    
    # Evaluation Weights
    RULE_BASED_WEIGHT: float = 0.6
    AI_BASED_WEIGHT: float = 0.4
    
    # SendGrid Email Configuration
    SENDGRID_API_KEY: str = ""
    SENDGRID_FROM_EMAIL: str = ""
    SENDGRID_FROM_NAME: str = "Aptor Design Assessment"
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
