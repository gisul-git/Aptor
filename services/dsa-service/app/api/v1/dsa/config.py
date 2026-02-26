"""
DSA Module Configuration
Uses environment variables from .env file via Pydantic Settings
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class DSASettings(BaseSettings):
    """
    DSA Module Settings - reads from .env file
    MongoDB configuration uses MONGO_URI and MONGO_DB from .env
    """
    # MongoDB Configuration (reads from .env)
    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db: str = "ai_assessment"


    # DSA Execution API – single endpoint for all 10 DSA languages
    dsa_execution_api_url: str = "http://103.173.99.254:8000"

    # OpenAI Configuration (can also use OPENAI_API_KEY from main config)
    openai_api_key: str = ""
    
   
    sql_engine_url: str = ""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False
    )


@lru_cache(maxsize=1)
def get_dsa_settings() -> DSASettings:
    """Get DSA module settings (cached)"""
    return DSASettings()


def clear_settings_cache():
    """Clear the settings cache - useful when .env file is updated"""
    get_dsa_settings.cache_clear()


# For backward compatibility, expose as module-level variables
# Note: These are set at module import time. To refresh after .env changes, 
# restart the service or call clear_settings_cache() and re-import
_settings = get_dsa_settings()

OPENAI_API_KEY = _settings.openai_api_key

DSA_EXECUTION_API_URL = _settings.dsa_execution_api_url
SQL_ENGINE_URL = _settings.sql_engine_url

