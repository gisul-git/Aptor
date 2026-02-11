"""
Redis-based Assessment List Cache for AI Assessment Service

This module provides caching for assessment lists to reduce MongoDB queries
and improve dashboard loading performance.

Cache Strategy:
- TTL: 5 minutes (300 seconds) for assessment lists
- Cache key format: ai_assessment:assessments:{user_id}:{page}:{limit}
- Automatic invalidation on assessment create/update/delete
"""
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Global Redis client (initialized in main.py)
_redis_client: Optional[Any] = None

# Cache configuration
CACHE_TTL_ASSESSMENTS = 300  # 5 minutes for assessment lists
CACHE_TTL_DASHBOARD = 180  # 3 minutes for dashboard endpoint
CACHE_KEY_PREFIX_ASSESSMENTS = "ai_assessment:assessments:"
CACHE_KEY_PREFIX_DASHBOARD = "ai_assessment:dashboard:"


def init_redis_cache(redis_client: Any) -> None:
    """
    Initialize Redis client for assessment list caching.
    
    Args:
        redis_client: Redis client instance (from redis.asyncio)
    """
    global _redis_client
    _redis_client = redis_client
    logger.info("✅ Redis assessment list cache initialized")


def _get_cache_key(user_id: str, page: int = 1, limit: int = 20) -> str:
    """Generate cache key for assessment list."""
    return f"{CACHE_KEY_PREFIX_ASSESSMENTS}{user_id}:p{page}:l{limit}"


def _get_dashboard_cache_key(user_id: str, page: int = 1, limit: int = 20) -> str:
    """Generate cache key for dashboard endpoint."""
    return f"{CACHE_KEY_PREFIX_DASHBOARD}{user_id}:p{page}:l{limit}"


async def get_cached_assessments(
    user_id: str,
    page: int = 1,
    limit: int = 20
) -> Optional[List[Dict[str, Any]]]:
    """
    Get assessment list from cache.
    
    Args:
        user_id: User ID
        page: Page number
        limit: Items per page
        
    Returns:
        Cached assessment list or None if not found
    """
    if not _redis_client:
        return None
    
    try:
        cache_key = _get_cache_key(user_id, page, limit)
        cached_data = await _redis_client.get(cache_key)
        
        if cached_data:
            if isinstance(cached_data, bytes):
                cached_data = cached_data.decode('utf-8')
            assessments = json.loads(cached_data)
            logger.info(f"✅ Cache HIT for user {user_id} assessments (page {page})")
            return assessments
    except Exception as e:
        logger.warning(f"Cache read error for user {user_id}: {e}")
    
    return None


async def set_cached_assessments(
    user_id: str,
    assessments: List[Dict[str, Any]],
    page: int = 1,
    limit: int = 20
) -> None:
    """
    Cache assessment list.
    
    Args:
        user_id: User ID
        assessments: Assessment list to cache
        page: Page number
        limit: Items per page
    """
    if not _redis_client:
        return
    
    try:
        cache_key = _get_cache_key(user_id, page, limit)
        cache_data = json.dumps(assessments, default=str)
        await _redis_client.setex(cache_key, CACHE_TTL_ASSESSMENTS, cache_data)
        logger.info(f"✅ Cached {len(assessments)} assessments for user {user_id} (page {page})")
    except Exception as e:
        logger.warning(f"Cache write error for user {user_id}: {e}")


async def get_cached_dashboard(
    user_id: str,
    page: int = 1,
    limit: int = 20
) -> Optional[Dict[str, Any]]:
    """
    Get dashboard data from cache.
    
    Args:
        user_id: User ID
        page: Page number
        limit: Items per page
        
    Returns:
        Cached dashboard data or None if not found
    """
    if not _redis_client:
        return None
    
    try:
        cache_key = _get_dashboard_cache_key(user_id, page, limit)
        cached_data = await _redis_client.get(cache_key)
        
        if cached_data:
            if isinstance(cached_data, bytes):
                cached_data = cached_data.decode('utf-8')
            data = json.loads(cached_data)
            logger.info(f"✅ Cache HIT for user {user_id} dashboard (page {page})")
            return data
    except Exception as e:
        logger.warning(f"Cache read error for dashboard {user_id}: {e}")
    
    return None


async def set_cached_dashboard(
    user_id: str,
    data: Dict[str, Any],
    page: int = 1,
    limit: int = 20
) -> None:
    """
    Cache dashboard data.
    
    Args:
        user_id: User ID
        data: Dashboard data to cache
        page: Page number
        limit: Items per page
    """
    if not _redis_client:
        return
    
    try:
        cache_key = _get_dashboard_cache_key(user_id, page, limit)
        cache_data = json.dumps(data, default=str)
        await _redis_client.setex(cache_key, CACHE_TTL_DASHBOARD, cache_data)
        logger.info(f"✅ Cached dashboard data for user {user_id} (page {page})")
    except Exception as e:
        logger.warning(f"Cache write error for dashboard {user_id}: {e}")


async def invalidate_user_assessments_cache(user_id: str) -> None:
    """
    Invalidate all assessment list caches for a user.
    Called when an assessment is created, updated, or deleted.
    
    Args:
        user_id: User ID
    """
    if not _redis_client:
        return
    
    try:
        # Invalidate all patterns for this user
        pattern = f"{CACHE_KEY_PREFIX_ASSESSMENTS}{user_id}:*"
        pattern_dashboard = f"{CACHE_KEY_PREFIX_DASHBOARD}{user_id}:*"
        
        # Get all matching keys
        keys = []
        async for key in _redis_client.scan_iter(match=pattern):
            keys.append(key)
        async for key in _redis_client.scan_iter(match=pattern_dashboard):
            keys.append(key)
        
        # Delete all keys
        if keys:
            await _redis_client.delete(*keys)
            logger.info(f"✅ Invalidated {len(keys)} cache keys for user {user_id}")
    except Exception as e:
        logger.warning(f"Failed to invalidate cache for user {user_id}: {e}")

