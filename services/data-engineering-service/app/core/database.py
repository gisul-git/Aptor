"""
MongoDB database connection and management with connection pooling.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo.errors import ServerSelectionTimeoutError, ConnectionFailure
import structlog
from typing import Optional
import asyncio

from app.core.config import settings

logger = structlog.get_logger()

# Global database client and database instances
client: Optional[AsyncIOMotorClient] = None
database: Optional[AsyncIOMotorDatabase] = None


async def init_database() -> None:
    """Initialize MongoDB connection with connection pooling."""
    global client, database
    
    try:
        logger.info("Connecting to MongoDB", url=settings.MONGODB_URL)
        
        # Configure connection pooling and timeouts
        client = AsyncIOMotorClient(
            settings.MONGODB_URL,
            maxPoolSize=50,  # Maximum number of connections in the pool
            minPoolSize=5,   # Minimum number of connections in the pool
            maxIdleTimeMS=30000,  # Close connections after 30 seconds of inactivity
            serverSelectionTimeoutMS=5000,  # 5 second timeout for server selection
            connectTimeoutMS=10000,  # 10 second timeout for initial connection
            socketTimeoutMS=20000,   # 20 second timeout for socket operations
            retryWrites=True,        # Enable retryable writes
            retryReads=True,         # Enable retryable reads
            w="majority",            # Write concern: wait for majority acknowledgment
            readPreference="primaryPreferred"  # Read from primary, fallback to secondary
        )
        
        database = client[settings.MONGODB_DATABASE]
        
        # Test the connection with retry logic
        await _test_connection_with_retry()
        logger.info("MongoDB connection established successfully")
        
        # Create indexes for better performance
        await create_indexes()
        
    except Exception as e:
        logger.error("Failed to connect to MongoDB", error=str(e))
        raise


async def _test_connection_with_retry(max_retries: int = 3) -> None:
    """Test database connection with retry logic."""
    global client
    
    for attempt in range(max_retries):
        try:
            if client:
                await client.admin.command('ping')
                return
        except (ServerSelectionTimeoutError, ConnectionFailure) as e:
            if attempt == max_retries - 1:
                raise e
            
            wait_time = 2 ** attempt  # Exponential backoff
            logger.warning(
                "Database connection attempt failed, retrying",
                attempt=attempt + 1,
                max_retries=max_retries,
                wait_time=wait_time,
                error=str(e)
            )
            await asyncio.sleep(wait_time)


async def close_database() -> None:
    """Close MongoDB connection."""
    global client, database
    
    if client:
        logger.info("Closing MongoDB connection")
        client.close()
        client = None
        database = None


async def get_database() -> AsyncIOMotorDatabase:
    """Get the database instance with connection health check."""
    global client, database
    
    if database is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    
    # Perform periodic health check
    try:
        if client:
            await client.admin.command('ping')
    except (ServerSelectionTimeoutError, ConnectionFailure) as e:
        logger.error("Database connection health check failed", error=str(e))
        # Attempt to reconnect
        await init_database()
    
    return database


async def check_database_health() -> bool:
    """Check database connection health."""
    global client
    
    try:
        if client:
            await client.admin.command('ping')
            return True
    except Exception as e:
        logger.error("Database health check failed", error=str(e))
        return False
    
    return False


async def create_indexes() -> None:
    """Create database indexes for optimal performance."""
    if database is None:
        return
    
    try:
        # Questions collection indexes
        await database.questions.create_index("difficulty_level")
        await database.questions.create_index("topic")
        await database.questions.create_index("created_at")
        await database.questions.create_index([("difficulty_level", 1), ("topic", 1)])  # Compound index
        await database.questions.create_index([("topic", 1), ("created_at", -1)])  # For topic-based recent queries
        
        # Solutions collection indexes
        await database.solutions.create_index("user_id")
        await database.solutions.create_index("question_id")
        await database.solutions.create_index("submitted_at")
        await database.solutions.create_index("status")
        await database.solutions.create_index([("user_id", 1), ("question_id", 1)])  # Compound for user-question lookup
        await database.solutions.create_index([("user_id", 1), ("submitted_at", -1)])  # For user history
        await database.solutions.create_index([("status", 1), ("submitted_at", 1)])  # For status-based queries
        await database.solutions.create_index("execution_result.validation_result.is_correct")  # For success filtering
        
        # Users collection indexes
        await database.users.create_index("user_id", unique=True)
        await database.users.create_index("experience_level")
        await database.users.create_index("last_activity")
        await database.users.create_index("success_rate")
        await database.users.create_index("overall_proficiency")
        await database.users.create_index([("experience_level", 1), ("last_activity", -1)])  # For active users by level
        
        # Execution results collection indexes
        await database.execution_results.create_index("job_id", unique=True)
        await database.execution_results.create_index("status")
        await database.execution_results.create_index("mode")
        await database.execution_results.create_index("created_at")
        await database.execution_results.create_index("completed_at")
        await database.execution_results.create_index([("status", 1), ("created_at", 1)])  # For queue processing
        await database.execution_results.create_index([("mode", 1), ("created_at", -1)])  # For mode-based queries
        
        # TTL index for execution results cleanup (optional - remove old completed results after 30 days)
        await database.execution_results.create_index(
            "created_at", 
            name="created_at_ttl",  # Give it a unique name to avoid conflict
            expireAfterSeconds=30 * 24 * 60 * 60,  # 30 days
            partialFilterExpression={"status": {"$in": ["completed", "failed", "timeout"]}}
        )
        
        logger.info("Database indexes created successfully")
        
    except Exception as e:
        logger.error("Failed to create database indexes", error=str(e))
        # Don't raise here as indexes are not critical for basic functionality