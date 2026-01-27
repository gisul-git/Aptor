"""
AIML Module Database Adapter
Uses MongoDB connection configured directly from .env file
Reads MONGO_URI and MONGO_DB from environment variables
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import get_aiml_settings
from typing import Optional

_aiml_client: Optional[AsyncIOMotorClient] = None
_aiml_db: Optional[AsyncIOMotorDatabase] = None


async def connect_to_aiml_mongo() -> None:
    """Initialize AIML MongoDB connection from .env"""
    global _aiml_client, _aiml_db
    
    settings = get_aiml_settings()
    
    if _aiml_client is None:
        _aiml_client = AsyncIOMotorClient(
            settings.mongo_uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            socketTimeoutMS=30000,
            maxPoolSize=1000,
            minPoolSize=10,
            maxIdleTimeMS=30000,
            waitQueueTimeoutMS=5000,
        )
        _aiml_db = _aiml_client[settings.mongo_db]
        # Test the connection
        await _aiml_client.admin.command("ping")


async def close_aiml_mongo_connection() -> None:
    """Close AIML MongoDB connection"""
    global _aiml_client, _aiml_db
    if _aiml_client is not None:
        _aiml_client.close()
        _aiml_client = None
        _aiml_db = None


def get_aiml_database() -> AsyncIOMotorDatabase:
    """
    Get AIML database instance
    Reads MONGO_URI and MONGO_DB from .env file
    """
    if _aiml_db is None:
        raise RuntimeError(
            "AIML MongoDB has not been initialized. "
            "Call connect_to_aiml_mongo() on startup. "
            "Make sure MONGO_URI and MONGO_DB are set in .env file."
        )
    return _aiml_db

