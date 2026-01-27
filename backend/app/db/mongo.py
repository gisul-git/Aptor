from __future__ import annotations

from typing import AsyncGenerator

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from ..core.config import get_settings


_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global _client, _db
    settings = get_settings()
    if _client is None:
        # Add connection timeout and server selection timeout to prevent hanging
        # Configure connection pooling for high-volume requests (100k+)
        _client = AsyncIOMotorClient(
            settings.mongo_uri,
            serverSelectionTimeoutMS=5000,  # 5 seconds to find a server
            connectTimeoutMS=10000,  # 10 seconds to connect
            socketTimeoutMS=30000,  # 30 seconds for socket operations
            maxPoolSize=1000,  # Maximum number of connections in the pool (supports 100k+ requests)
            minPoolSize=10,  # Minimum number of connections to maintain
            maxIdleTimeMS=30000,  # Close connections idle for 30 seconds
            waitQueueTimeoutMS=5000,  # Wait up to 5 seconds for a connection from the pool
        )
        _db = _client[settings.mongo_db]
        # Test the connection
        await _client.admin.command("ping")


async def close_mongo_connection() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_database() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("MongoDB has not been initialized. Call connect_to_mongo() on startup.")
    return _db


async def get_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    yield get_database()
