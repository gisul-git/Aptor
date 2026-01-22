"""MongoDB connection for Proctoring Service."""
from typing import AsyncGenerator
import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from ..core.config import get_settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global _client, _db
    logger.info("[MongoDB] ===== Starting MongoDB connection =====)")
    settings = get_settings()
    logger.info(f"[MongoDB] Connection settings: mongo_uri={settings.mongo_uri}, mongo_db={settings.mongo_db}")
    
    if _client is None:
        try:
            logger.info(f"[MongoDB] Creating MongoDB client with URI: {settings.mongo_uri}")
            _client = AsyncIOMotorClient(settings.mongo_uri)
            logger.info("[MongoDB] MongoDB client created successfully")
            
            logger.info(f"[MongoDB] Selecting database: {settings.mongo_db}")
            _db = _client[settings.mongo_db]
            logger.info(f"[MongoDB] Database object created for: {settings.mongo_db}")
            
            logger.info("[MongoDB] Testing connection with ping command...")
            ping_result = await _client.admin.command("ping")
            logger.info(f"[MongoDB] Ping successful: {ping_result}")
            
            # List all databases to verify connection
            logger.info("[MongoDB] Listing all databases...")
            db_list = await _client.list_database_names()
            logger.info(f"[MongoDB] Available databases: {db_list}")
            logger.info(f"[MongoDB] Target database '{settings.mongo_db}' exists: {settings.mongo_db in db_list}")
            
            # List collections in the target database
            logger.info(f"[MongoDB] Listing collections in database '{settings.mongo_db}'...")
            try:
                collections = await _db.list_collection_names()
                logger.info(f"[MongoDB] Collections in '{settings.mongo_db}': {collections}")
                if not collections:
                    logger.warning(f"[MongoDB] ⚠️ Database '{settings.mongo_db}' exists but has no collections yet")
                    logger.info("[MongoDB] Note: MongoDB creates databases and collections lazily when first document is inserted")
            except Exception as coll_error:
                logger.warning(f"[MongoDB] Could not list collections (database may not exist yet): {coll_error}")
                logger.info("[MongoDB] This is normal - MongoDB creates databases when first document is inserted")
            
            logger.info("[MongoDB] ===== MongoDB connection completed successfully =====)")
        except Exception as e:
            logger.error(f"[MongoDB] ❌ ERROR: Failed to connect to MongoDB: {e}")
            logger.exception("[MongoDB] Full connection error traceback:")
            raise
    else:
        logger.info("[MongoDB] Client already exists, skipping connection")


async def close_mongo_connection() -> None:
    global _client
    logger.info("[MongoDB] Closing MongoDB connection...")
    if _client is not None:
        _client.close()
        _client = None
        logger.info("[MongoDB] MongoDB connection closed")
    else:
        logger.info("[MongoDB] No active connection to close")


def get_database() -> AsyncIOMotorDatabase:
    if _db is None:
        logger.error("[MongoDB] ❌ ERROR: Attempted to get database but MongoDB not initialized")
        raise RuntimeError("MongoDB not initialized")
    logger.debug(f"[MongoDB] Returning database object: {_db.name}")
    return _db


async def get_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    db = get_database()
    logger.debug(f"[MongoDB] get_db() called, returning database: {db.name}")
    yield db

