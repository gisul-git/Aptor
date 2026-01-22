"""
DSA Module Database Adapter
Uses MongoDB connection configured directly from .env file
Reads MONGO_URI and MONGO_DB from environment variables
"""
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from .config import get_dsa_settings
from typing import Optional

_dsa_client: Optional[AsyncIOMotorClient] = None
_dsa_db: Optional[AsyncIOMotorDatabase] = None


async def connect_to_dsa_mongo() -> None:
    """Initialize DSA MongoDB connection from .env"""
    global _dsa_client, _dsa_db
    
    settings = get_dsa_settings()
    
    if _dsa_client is None:
        _dsa_client = AsyncIOMotorClient(
            settings.mongo_uri,
            serverSelectionTimeoutMS=5000,
            connectTimeoutMS=10000,
            socketTimeoutMS=30000,
            maxPoolSize=1000,
            minPoolSize=10,
            maxIdleTimeMS=30000,
            waitQueueTimeoutMS=5000,
        )
        _dsa_db = _dsa_client[settings.mongo_db]
        # Test the connection
        await _dsa_client.admin.command("ping")


async def close_dsa_mongo_connection() -> None:
    """Close DSA MongoDB connection"""
    global _dsa_client, _dsa_db
    if _dsa_client is not None:
        _dsa_client.close()
        _dsa_client = None
        _dsa_db = None


def get_dsa_database() -> AsyncIOMotorDatabase:
    """
    Get DSA database instance
    Reads MONGO_URI and MONGO_DB from .env file
    """
    if _dsa_db is None:
        raise RuntimeError(
            "DSA MongoDB has not been initialized. "
            "Call connect_to_dsa_mongo() on startup. "
            "Make sure MONGO_URI and MONGO_DB are set in .env file."
        )
    return _dsa_db
