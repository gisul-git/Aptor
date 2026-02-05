"""
Redis-based Test List Cache

This module provides caching for test lists to reduce MongoDB queries
and improve dashboard loading performance.

Cache Strategy:
- TTL: 5 minutes (300 seconds) for test lists
- Cache key format: dsa:tests:{user_id}:{page}:{limit}
- Automatic invalidation on test create/update/delete
"""
import json
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Global Redis client (initialized in main.py)
_redis_client: Optional[Any] = None

# Cache configuration
CACHE_TTL_TESTS = 300  # 5 minutes for test lists
CACHE_TTL_DASHBOARD = 180  # 3 minutes for dashboard endpoint
CACHE_KEY_PREFIX_TESTS = "dsa:tests:"
CACHE_KEY_PREFIX_DASHBOARD = "dsa:dashboard:"


def init_redis_cache(redis_client: Any) -> None:
    """
    Initialize Redis client for test list caching.
    
    Args:
        redis_client: Redis client instance (from redis.asyncio)
    """
    global _redis_client
    _redis_client = redis_client
    logger.info("✅ Redis test list cache initialized")


def _get_cache_key(user_id: str, page: int = 1, limit: int = 20, active_only: bool = False) -> str:
    """Generate cache key for test list."""
    key = f"{CACHE_KEY_PREFIX_TESTS}{user_id}:p{page}:l{limit}"
    if active_only:
        key += ":active"
    return key


def _get_dashboard_cache_key(user_id: str, page: int = 1, limit: int = 20) -> str:
    """Generate cache key for dashboard endpoint."""
    return f"{CACHE_KEY_PREFIX_DASHBOARD}{user_id}:p{page}:l{limit}"


async def get_cached_tests(
    user_id: str,
    page: int = 1,
    limit: int = 20,
    active_only: bool = False
) -> Optional[List[Dict[str, Any]]]:
    """
    Get test list from cache.
    
    Args:
        user_id: User ID
        page: Page number
        limit: Items per page
        active_only: Whether to filter active tests only
        
    Returns:
        Cached test list or None if not found
    """
    if not _redis_client:
        return None
    
    try:
        cache_key = _get_cache_key(user_id, page, limit, active_only)
        cached_data = await _redis_client.get(cache_key)
        
        if cached_data:
            if isinstance(cached_data, bytes):
                cached_data = cached_data.decode('utf-8')
            tests = json.loads(cached_data)
            logger.info(f"✅ Cache HIT for user {user_id} tests (page {page})")
            return tests
    except Exception as e:
        logger.warning(f"Cache read error for user {user_id}: {e}")
    
    return None


async def set_cached_tests(
    user_id: str,
    tests: List[Dict[str, Any]],
    page: int = 1,
    limit: int = 20,
    active_only: bool = False
) -> None:
    """
    Cache test list.
    
    Args:
        user_id: User ID
        tests: Test list to cache
        page: Page number
        limit: Items per page
        active_only: Whether to filter active tests only
    """
    if not _redis_client:
        return
    
    try:
        cache_key = _get_cache_key(user_id, page, limit, active_only)
        cache_data = json.dumps(tests, default=str)
        await _redis_client.setex(cache_key, CACHE_TTL_TESTS, cache_data)
        logger.info(f"✅ Cached {len(tests)} tests for user {user_id} (page {page})")
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


async def invalidate_user_tests_cache(user_id: str) -> None:
    """
    Invalidate all test list caches for a user.
    Called when a test is created, updated, or deleted.
    
    Args:
        user_id: User ID
    """
    if not _redis_client:
        return
    
    try:
        # Invalidate all patterns for this user
        pattern = f"{CACHE_KEY_PREFIX_TESTS}{user_id}:*"
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

