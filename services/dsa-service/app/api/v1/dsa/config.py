"""
DSA Module Configuration
Uses environment variables from .env file via Pydantic Settings
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class DSASettings(BaseSettings):
    """
    DSA Module Settings - reads from .env file
    Environment variables should be set in .env file (e.g., JUDGE0_URL=http://168.220.236.250:2358)
    MongoDB configuration uses MONGO_URI and MONGO_DB from .env
    """
    # MongoDB Configuration (reads from .env)
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "ai_assessment"
    
    # Judge0 Configuration
    # These fields will automatically read from environment variables:
    # judge0_url -> JUDGE0_URL
    # judge0_timeout -> JUDGE0_TIMEOUT
    # etc.
    judge0_url: str = "http://168.220.236.250:2358"
    judge0_timeout: int = 60
    judge0_poll_interval: float = 1.5
    judge0_max_polls: int = 20
    judge0_api_key: str = ""  # For RapidAPI hosted Judge0
    
    # OpenAI Configuration (can also use OPENAI_API_KEY from main config)
    openai_api_key: str = ""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        # Pydantic Settings automatically converts field names to uppercase for env vars
        # mongo_uri -> MONGO_URI, mongo_db -> MONGO_DB
        # judge0_url -> JUDGE0_URL, judge0_timeout -> JUDGE0_TIMEOUT, etc.
        case_sensitive=False
    )


@lru_cache(maxsize=1)
def get_dsa_settings() -> DSASettings:
    """Get DSA module settings (cached)"""
    return DSASettings()


# For backward compatibility, expose as module-level variables
_settings = get_dsa_settings()
JUDGE0_URL = _settings.judge0_url
JUDGE0_TIMEOUT = _settings.judge0_timeout
JUDGE0_POLL_INTERVAL = _settings.judge0_poll_interval
JUDGE0_MAX_POLLS = _settings.judge0_max_polls
JUDGE0_API_KEY = _settings.judge0_api_key
OPENAI_API_KEY = _settings.openai_api_key

