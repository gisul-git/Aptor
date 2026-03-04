"""
Pytest configuration and fixtures for the Data Engineer Assessment Platform.
"""

import pytest
import asyncio
from typing import AsyncGenerator, Generator
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient
import redis.asyncio as redis

from app.main import app
from app.core.config import settings
from app.core.database import init_database, close_database, get_database
from app.core.redis_client import init_redis, close_redis, get_redis


@pytest.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_database():
    """Set up test database connection."""
    # Use a separate test database
    original_db_name = settings.MONGODB_DATABASE
    settings.MONGODB_DATABASE = f"{original_db_name}_test"
    
    await init_database()
    yield
    
    # Clean up test database
    db = await get_database()
    client = db.client
    await client.drop_database(settings.MONGODB_DATABASE)
    await close_database()
    
    # Restore original database name
    settings.MONGODB_DATABASE = original_db_name


@pytest.fixture(scope="session")
async def test_redis():
    """Set up test Redis connection."""
    # Use a separate test Redis database
    original_redis_db = settings.REDIS_DB
    settings.REDIS_DB = 15  # Use database 15 for testing
    
    await init_redis()
    yield
    
    # Clean up test Redis database
    redis_client = await get_redis()
    await redis_client.flushdb()
    await close_redis()
    
    # Restore original Redis database
    settings.REDIS_DB = original_redis_db


@pytest.fixture
async def client(test_database, test_redis) -> AsyncGenerator[AsyncClient, None]:
    """Create test client for API testing."""
    # Initialize services for testing
    from app.core.service_factory import initialize_services
    await initialize_services()
    
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def db(test_database):
    """Get database instance for testing."""
    return await get_database()


@pytest.fixture
async def redis_client(test_redis):
    """Get Redis client instance for testing."""
    return await get_redis()


@pytest.fixture
def sample_question_data():
    """Sample question data for testing."""
    return {
        "title": "Basic DataFrame Transformation",
        "description": "Transform a DataFrame by adding a new column",
        "difficulty_level": 1,
        "topic": "transformations",
        "input_schema": {"id": "int", "name": "string", "value": "double"},
        "sample_input": {"data": [{"id": 1, "name": "test", "value": 10.5}]},
        "expected_output": {"data": [{"id": 1, "name": "test", "processed_value": 21.0}]},
        "test_cases": [
            {
                "input_data": {"data": [{"id": 1, "name": "test", "value": 10.5}]},
                "expected_output": {"data": [{"id": 1, "name": "test", "processed_value": 21.0}]},
                "description": "Basic transformation test"
            }
        ]
    }


@pytest.fixture
def sample_execution_request():
    """Sample execution request for testing."""
    return {
        "code": "df.withColumn('processed_value', df.value * 2)",
        "question_id": "test-question-id",
        "mode": "test"
    }


@pytest.fixture
def sample_user_data():
    """Sample user data for testing."""
    return {
        "user_id": "test-user-123",
        "experience_level": 3,
        "preferences": {
            "experience_level": 3,
            "preferred_topics": ["transformations", "aggregations"],
            "notification_settings": {"email": True, "push": False}
        }
    }


# Property-based testing configuration
@pytest.fixture
def hypothesis_settings():
    """Configure Hypothesis for property-based testing."""
    from hypothesis import settings as hypothesis_settings
    return hypothesis_settings(
        max_examples=5,  # Reduced for faster testing
        deadline=None,     # No deadline for complex operations
        suppress_health_check=[],
        verbosity=1
    )