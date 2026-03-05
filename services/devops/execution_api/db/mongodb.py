"""MongoDB connection for Execution API."""
from typing import AsyncGenerator
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from core.config import get_settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global _client, _db
    settings = get_settings()
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=3000)
        _db = _client[settings.mongo_db]
        await _client.admin.command("ping")
        await _ensure_indexes()


async def close_mongo_connection() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_database() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("MongoDB not initialized")
    return _db


async def get_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    yield get_database()


async def _ensure_indexes() -> None:
    if _db is None:
        return
    await _db.devops_questions.create_index("created_by")
    await _db.devops_questions.create_index("created_at")
    await _db.devops_questions.create_index("is_published")
    await _db.devops_tests.create_index("created_by")
    await _db.devops_tests.create_index("created_at")
    await _db.devops_tests.create_index("is_published")

