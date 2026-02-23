"""
Redis-based Assessment Context Cache

This module provides caching for assessment context data to reduce MongoDB queries
during bulk question generation. Cached data includes:
- job_designation
- experience_min/experience_max
- experience_mode
- coding_language
- company_context
- assessment_requirements
- additional_requirements

Cache Strategy:
- TTL: 1 hour (3600 seconds)
- Cache key format: assessment:context:{assessment_id}
- Automatic invalidation on assessment updates
"""
from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from .....utils.mongo import to_object_id

logger = logging.getLogger(__name__)

# Global Redis client (initialized in main.py)
_redis_client: Optional[Any] = None

# Cache configuration
CACHE_TTL_SECONDS = 3600  # 1 hour
CACHE_KEY_PREFIX = "assessment:context:"


def init_redis_cache(redis_client: Any) -> None:
    """
    Initialize Redis client for assessment context caching.
    
    Args:
        redis_client: Redis client instance (from redis.asyncio or redis)
    """
    global _redis_client
    _redis_client = redis_client
    logger.info("✅ Redis assessment context cache initialized")


def _get_cache_key(assessment_id: str) -> str:
    """Generate cache key for assessment context."""
    return f"{CACHE_KEY_PREFIX}{assessment_id}"


def invalidate_assessment_cache(assessment_id: str) -> None:
    """
    Invalidate cache for a specific assessment.
    Called when assessment is updated.
    
    Args:
        assessment_id: Assessment ID to invalidate
    """
    if not _redis_client:
        return
    
    try:
        cache_key = _get_cache_key(assessment_id)
        # Use async delete if available, otherwise sync
        if hasattr(_redis_client, 'delete'):
            if hasattr(_redis_client.delete, '__call__'):
                # Check if it's async
                import inspect
                if inspect.iscoroutinefunction(_redis_client.delete):
                    # Will need to await in async context
                    pass
                else:
                    _redis_client.delete(cache_key)
            else:
                _redis_client.delete(cache_key)
        elif hasattr(_redis_client, 'del'):
            _redis_client.del_(cache_key)
        
        logger.info(f"✅ Invalidated cache for assessment: {assessment_id}")
    except Exception as e:
        logger.warning(f"Failed to invalidate cache for assessment {assessment_id}: {e}")


async def invalidate_assessment_cache_async(assessment_id: str) -> None:
    """
    Async version of cache invalidation.
    
    Args:
        assessment_id: Assessment ID to invalidate
    """
    if not _redis_client:
        return
    
    try:
        cache_key = _get_cache_key(assessment_id)
        # Try async delete
        if hasattr(_redis_client, 'delete'):
            await _redis_client.delete(cache_key)
        elif hasattr(_redis_client, 'del'):
            await _redis_client.delete(cache_key)
        
        logger.info(f"✅ Invalidated cache for assessment: {assessment_id}")
    except Exception as e:
        logger.warning(f"Failed to invalidate cache for assessment {assessment_id}: {e}")


async def get_assessment_context(
    db: Any,
    assessment_id: str,
    force_refresh: bool = False
) -> Optional[Dict[str, Any]]:
    """
    Get assessment context from cache or MongoDB.
    
    Args:
        db: MongoDB database instance
        assessment_id: Assessment ID
        force_refresh: If True, skip cache and load from MongoDB
        
    Returns:
        Dictionary with assessment context fields, or None if not found
    """
    if not _redis_client:
        logger.debug("Redis client not initialized, skipping cache")
        return None
    
    cache_key = _get_cache_key(assessment_id)
    
    # Force refresh - skip cache
    if force_refresh:
        logger.debug(f"Force refresh requested for assessment {assessment_id}")
        try:
            await _redis_client.delete(cache_key)
        except Exception as e:
            logger.warning(f"Failed to delete cache key during force refresh: {e}")
    
    # Try to get from cache
    try:
        cached_data = await _redis_client.get(cache_key)
        if cached_data:
            if isinstance(cached_data, bytes):
                cached_data = cached_data.decode('utf-8')
            context = json.loads(cached_data)
            logger.info(f"✅ Cache HIT for assessment {assessment_id}")
            return context
    except Exception as e:
        logger.warning(f"Cache read error for assessment {assessment_id}: {e}")
    
    # Cache miss - load from MongoDB
    logger.info(f"Cache MISS for assessment {assessment_id}, loading from MongoDB")
    
    try:
        oid = to_object_id(assessment_id)
        assessment = await db.assessments.find_one({"_id": oid})
        
        if not assessment:
            logger.warning(f"Assessment {assessment_id} not found in MongoDB")
            return None
        
        # Extract context fields (only what's needed for question generation)
        company_context = assessment.get("contextSummary")
        website_summary = None
        if not company_context and assessment.get("websiteSummary") and assessment["websiteSummary"].get("useForQuestions"):
            website_summary = assessment["websiteSummary"]
        
        context = {
            "job_designation": assessment.get("jobDesignation"),
            "experience_min": assessment.get("experienceMin"),
            "experience_max": assessment.get("experienceMax"),
            "experience_mode": assessment.get("experienceMode", "corporate"),
            "coding_language": assessment.get("codingLanguage", "python"),
            "company_context": company_context,
            "website_summary": website_summary,
            "assessment_requirements": assessment.get("requirements"),
            "additional_requirements": assessment.get("additionalRequirements"),
            "company_name": company_context.get("company_name") if company_context else None,
        }
        
        # Store in cache
        try:
            await _redis_client.setex(
                cache_key,
                CACHE_TTL_SECONDS,
                json.dumps(context)
            )
            logger.info(f"✅ Cached assessment context for {assessment_id} (TTL: {CACHE_TTL_SECONDS}s)")
        except Exception as e:
            logger.warning(f"Failed to cache assessment context for {assessment_id}: {e}")
        
        return context
        
    except Exception as e:
        logger.error(f"Error loading assessment context from MongoDB for {assessment_id}: {e}")
        return None

