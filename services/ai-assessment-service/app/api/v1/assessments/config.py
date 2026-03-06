"""
AI Assessment Service Configuration
Uses environment variables from .env file via Pydantic Settings
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class AssessmentConfig(BaseSettings):
    """
    AI Assessment Service Settings - reads from .env file
    Environment variables should be set in .env file
    """
    # Judge0 Configuration
    judge0_url: str = "http://168.220.236.250:2358"
    judge0_timeout: int = 60
    judge0_poll_interval: float = 1.5
    judge0_max_polls: int = 20
    judge0_api_key: str = ""  # For RapidAPI hosted Judge0
    
    # SQL Execution Engine Configuration
    sql_engine_url: str = ""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )


@lru_cache(maxsize=1)
def get_assessment_config() -> AssessmentConfig:
    """Get AI Assessment config (cached)"""
    return AssessmentConfig()


# For backward compatibility, expose as module-level variables
_config = get_assessment_config()
JUDGE0_URL = _config.judge0_url
JUDGE0_TIMEOUT = _config.judge0_timeout
JUDGE0_POLL_INTERVAL = _config.judge0_poll_interval
JUDGE0_MAX_POLLS = _config.judge0_max_polls
JUDGE0_API_KEY = _config.judge0_api_key
SQL_ENGINE_URL = _config.sql_engine_url

