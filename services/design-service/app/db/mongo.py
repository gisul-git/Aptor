"""
MongoDB Database Connection (Motor Async)
"""

import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger(__name__)

mongodb_client: AsyncIOMotorClient = None
database = None


async def connect_to_mongo():
    global mongodb_client, database

    try:
        mongodb_client = AsyncIOMotorClient(settings.MONGODB_URL)
        database = mongodb_client[settings.MONGODB_DB_NAME]

        await database.command("ping")
        logger.info(f"Connected to MongoDB: {settings.MONGODB_DB_NAME}")

    except Exception as e:
        logger.error(f"MongoDB connection failed: {e}")
        raise


async def close_mongo_connection():
    global mongodb_client

    if mongodb_client:
        mongodb_client.close()
        logger.info("MongoDB connection closed")


def get_database():
    return database
