"""MongoDB connection for Execution API."""
from typing import AsyncGenerator
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from core.config import get_settings

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None
_cloud_db: AsyncIOMotorDatabase | None = None


async def connect_to_mongo() -> None:
    global _client, _db, _cloud_db
    settings = get_settings()
    if _client is None:
        _client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=3000)
        _db = _client[settings.mongo_db]
        _cloud_db = _client[settings.cloud_mongo_db]
        await _client.admin.command("ping")
        await _ensure_devops_indexes()
        await _ensure_cloud_indexes()


async def close_mongo_connection() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_database() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("MongoDB not initialized")
    return _db


def get_cloud_database() -> AsyncIOMotorDatabase:
    if _cloud_db is None:
        raise RuntimeError("MongoDB not initialized")
    return _cloud_db


async def get_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    yield get_database()


async def _ensure_devops_indexes() -> None:
    if _db is None:
        return
    await _db.devops_questions.create_index("created_by")
    await _db.devops_questions.create_index("created_at")
    await _db.devops_questions.create_index("is_published")
    await _db.devops_tests.create_index("created_by")
    await _db.devops_tests.create_index("created_at")
    await _db.devops_tests.create_index("is_published")
    await _db.devops_tests.create_index("test_token")
    await _db.devops_assessments.create_index("created_by")
    await _db.devops_assessments.create_index("created_at")
    await _db.devops_assessments.create_index("is_published")
    await _db.devops_assessments.create_index("test_token")
    await _db.devops_test_candidates.create_index("test_id")
    await _db.devops_test_candidates.create_index([("test_id", 1), ("email", 1)], unique=True)
    await _db.devops_published_questions.create_index("created_by")
    await _db.devops_published_questions.create_index("question_id", unique=True)
    await _db.devops_published_questions.create_index("published_at")


async def _ensure_cloud_indexes() -> None:
    if _cloud_db is None:
        return
    await _cloud_db.cloud_questions.create_index("created_by")
    await _cloud_db.cloud_questions.create_index("created_at")
    await _cloud_db.cloud_questions.create_index("is_published")
    await _cloud_db.cloud_tests.create_index("created_by")
    await _cloud_db.cloud_tests.create_index("created_at")
    await _cloud_db.cloud_tests.create_index("is_published")
    await _cloud_db.cloud_tests.create_index("test_token")
    await _cloud_db.cloud_assessments.create_index("created_by")
    await _cloud_db.cloud_assessments.create_index("created_at")
    await _cloud_db.cloud_assessments.create_index("is_published")
    await _cloud_db.cloud_assessments.create_index("test_token")
    await _cloud_db.cloud_test_candidates.create_index("test_id")
    await _cloud_db.cloud_test_candidates.create_index([("test_id", 1), ("email", 1)], unique=True)
    await _cloud_db.cloud_published_questions.create_index("created_by")
    await _cloud_db.cloud_published_questions.create_index("question_id", unique=True)
    await _cloud_db.cloud_published_questions.create_index("published_at")

