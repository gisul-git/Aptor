"""
AIML Module Configuration
Uses environment variables from .env file via Pydantic Settings
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class AIMLSettings(BaseSettings):
    """
    AIML Module Settings - reads from .env file
    Environment variables should be set in .env file
    MongoDB configuration uses MONGO_URI and MONGO_DB from .env
    """
    # MongoDB Configuration (reads from .env)
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "ai_assessment"
    
    # Judge0 Configuration
    judge0_url: str = "http://168.220.236.250:2358"
    judge0_timeout: int = 60
    judge0_poll_interval: float = 1.5
    judge0_max_polls: int = 20
    judge0_api_key: str = ""
    
    # OpenAI Configuration for AI question generation
    openai_api_key: str = ""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )


@lru_cache(maxsize=1)
def get_aiml_settings() -> AIMLSettings:
    """Get AIML module settings (cached)"""
    return AIMLSettings()


# For backward compatibility, expose as module-level variables
_settings = get_aiml_settings()
JUDGE0_URL = _settings.judge0_url
JUDGE0_TIMEOUT = _settings.judge0_timeout
JUDGE0_POLL_INTERVAL = _settings.judge0_poll_interval
JUDGE0_MAX_POLLS = _settings.judge0_max_polls
JUDGE0_API_KEY = _settings.judge0_api_key
OPENAI_API_KEY = _settings.openai_api_key

