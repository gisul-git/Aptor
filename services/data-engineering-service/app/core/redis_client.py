"""
Redis client for caching and job queuing.
"""

import redis.asyncio as redis
import structlog
from typing import Optional, Any
import json
from datetime import timedelta

from app.core.config import settings

logger = structlog.get_logger()

# Global Redis client instance
redis_client: Optional[redis.Redis] = None


async def init_redis() -> None:
    """Initialize Redis connection."""
    global redis_client
    
    try:
        logger.info("Connecting to Redis", url=settings.REDIS_URL)
        redis_client = redis.from_url(
            settings.REDIS_URL,
            db=settings.REDIS_DB,
            decode_responses=True
        )
        
        # Test the connection
        await redis_client.ping()
        logger.info("Redis connection established successfully")
        
    except Exception as e:
        logger.warning("Failed to connect to Redis, continuing without caching", error=str(e))
        redis_client = None


async def close_redis() -> None:
    """Close Redis connection."""
    global redis_client
    
    if redis_client:
        logger.info("Closing Redis connection")
        await redis_client.close()
        redis_client = None


async def get_redis() -> Optional[redis.Redis]:
    """Get the Redis client instance."""
    return redis_client


class CacheManager:
    """Redis cache management utilities."""
    
    @staticmethod
    async def set_cache(key: str, value: Any, ttl: int = 3600) -> bool:
        """Set a value in cache with TTL."""
        try:
            client = await get_redis()
            if client is None:
                return False
            serialized_value = json.dumps(value, default=str)
            await client.setex(key, ttl, serialized_value)
            return True
        except Exception as e:
            logger.error("Failed to set cache", key=key, error=str(e))
            return False
    
    @staticmethod
    async def get_cache(key: str) -> Optional[Any]:
        """Get a value from cache."""
        try:
            client = await get_redis()
            if client is None:
                return None
            value = await client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.error("Failed to get cache", key=key, error=str(e))
            return None
    
    @staticmethod
    async def delete_cache(key: str) -> bool:
        """Delete a value from cache."""
        try:
            client = await get_redis()
            if client is None:
                return False
            await client.delete(key)
            return True
        except Exception as e:
            logger.error("Failed to delete cache", key=key, error=str(e))
            return False
    
    @staticmethod
    async def exists(key: str) -> bool:
        """Check if a key exists in cache."""
        try:
            client = await get_redis()
            if client is None:
                return False
            return bool(await client.exists(key))
        except Exception as e:
            logger.error("Failed to check cache existence", key=key, error=str(e))
            return False


class JobQueue:
    """Redis-based job queue for execution tasks."""
    
    EXECUTION_QUEUE = "execution_queue"
    
    @staticmethod
    async def enqueue_job(job_data: dict) -> bool:
        """Add a job to the execution queue."""
        try:
            client = await get_redis()
            serialized_job = json.dumps(job_data, default=str)
            await client.lpush(JobQueue.EXECUTION_QUEUE, serialized_job)
            logger.info("Job enqueued", job_id=job_data.get("job_id"))
            return True
        except Exception as e:
            logger.error("Failed to enqueue job", error=str(e))
            return False
    
    @staticmethod
    async def dequeue_job() -> Optional[dict]:
        """Get a job from the execution queue."""
        try:
            client = await get_redis()
            job_data = await client.brpop(JobQueue.EXECUTION_QUEUE, timeout=1)
            if job_data:
                return json.loads(job_data[1])
            return None
        except Exception as e:
            logger.error("Failed to dequeue job", error=str(e))
            return None
    
    @staticmethod
    async def get_queue_length() -> int:
        """Get the current queue length."""
        try:
            client = await get_redis()
            return await client.llen(JobQueue.EXECUTION_QUEUE)
        except Exception as e:
            logger.error("Failed to get queue length", error=str(e))
            return 0


class RateLimiter:
    """Redis-based rate limiting."""
    
    @staticmethod
    async def is_rate_limited(key: str, limit: int, window: int = 3600) -> bool:
        """Check if a key is rate limited."""
        try:
            client = await get_redis()
            current = await client.get(key)
            
            if current is None:
                await client.setex(key, window, 1)
                return False
            
            if int(current) >= limit:
                return True
            
            await client.incr(key)
            return False
            
        except Exception as e:
            logger.error("Failed to check rate limit", key=key, error=str(e))
            return False  # Allow request on error
    
    @staticmethod
    async def get_rate_limit_status(key: str) -> dict:
        """Get current rate limit status."""
        try:
            client = await get_redis()
            current = await client.get(key)
            ttl = await client.ttl(key)
            
            return {
                "current": int(current) if current else 0,
                "reset_in": ttl if ttl > 0 else 0
            }
        except Exception as e:
            logger.error("Failed to get rate limit status", key=key, error=str(e))
            return {"current": 0, "reset_in": 0}