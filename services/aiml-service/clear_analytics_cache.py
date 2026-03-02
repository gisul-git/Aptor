"""
Clear analytics cache for a specific test or all tests
"""
import asyncio
import sys
import os

# Fix Unicode encoding for Windows console
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8')

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.utils.cache import invalidate_test_analytics_cache, _redis_client, init_redis_cache
from app.api.v1.aiml.database import connect_to_aiml_mongo
from app.config.settings import get_settings


async def init_redis():
    """Initialize Redis client"""
    try:
        import redis.asyncio as redis
        settings = get_settings()
        redis_client = redis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True
        )
        await redis_client.ping()
        init_redis_cache(redis_client)
        return redis_client
    except Exception as e:
        print(f"[WARNING] Redis connection failed: {e}. Continuing without cache.")
        return None


async def clear_cache_for_test(test_id: str):
    """Clear analytics cache for a specific test"""
    await connect_to_aiml_mongo()
    
    # Initialize Redis if not already initialized
    redis_client = await init_redis()
    
    if not redis_client and not _redis_client:
        print("[ERROR] Redis client not available. Cache clearing skipped.")
        return
    
    try:
        # Use initialized client or fallback to global
        client = redis_client or _redis_client
        
        # Clear cache using the utility function
        await invalidate_test_analytics_cache(test_id)
        print(f"[SUCCESS] Cleared analytics cache for test: {test_id}")
        
        # Also manually clear any remaining keys with pattern
        pattern = f"candidate_analytics:{test_id}:*"
        keys_to_delete = []
        async for key in client.scan_iter(match=pattern):
            keys_to_delete.append(key)
        
        if keys_to_delete:
            await client.delete(*keys_to_delete)
            print(f"[SUCCESS] Deleted {len(keys_to_delete)} cache keys matching pattern: {pattern}")
        else:
            print(f"[INFO] No cache keys found matching pattern: {pattern}")
        
        # Close Redis connection if we created it
        if redis_client:
            await redis_client.close()
            
    except Exception as e:
        print(f"[ERROR] Error clearing cache: {e}")
        if redis_client:
            try:
                await redis_client.close()
            except:
                pass


async def clear_all_analytics_cache():
    """Clear all analytics cache"""
    await connect_to_aiml_mongo()
    
    # Initialize Redis if not already initialized
    redis_client = await init_redis()
    
    if not redis_client and not _redis_client:
        print("[ERROR] Redis client not available. Cache clearing skipped.")
        return
    
    try:
        # Use initialized client or fallback to global
        client = redis_client or _redis_client
        pattern = "candidate_analytics:*"
        keys_to_delete = []
        async for key in client.scan_iter(match=pattern):
            keys_to_delete.append(key)
        
        if keys_to_delete:
            await client.delete(*keys_to_delete)
            print(f"[SUCCESS] Deleted {len(keys_to_delete)} cache keys")
        else:
            print("[INFO] No cache keys found")
        
        # Close Redis connection if we created it
        if redis_client:
            await redis_client.close()
            
    except Exception as e:
        print(f"[ERROR] Error clearing cache: {e}")
        if redis_client:
            try:
                await redis_client.close()
            except:
                pass


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        test_id = sys.argv[1]
        if test_id == "all":
            print("Clearing ALL analytics cache...")
            asyncio.run(clear_all_analytics_cache())
        else:
            print(f"Clearing analytics cache for test: {test_id}")
            asyncio.run(clear_cache_for_test(test_id))
    else:
        print("Usage:")
        print("  python clear_analytics_cache.py <test_id>  # Clear cache for specific test")
        print("  python clear_analytics_cache.py all       # Clear all analytics cache")
        print()
        print("Example:")
        print("  python clear_analytics_cache.py 698c6be92f3c27c6e8ad66d3")
