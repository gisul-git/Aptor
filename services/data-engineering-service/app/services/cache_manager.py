"""
Enhanced caching service with intelligent cache management and performance optimization.
"""

import asyncio
import json
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Union
import structlog
from enum import Enum

from app.core.redis_client import get_redis, CacheManager as BaseCacheManager
from app.core.config import settings

logger = structlog.get_logger()


class CacheLevel(Enum):
    """Cache levels for different types of data."""
    L1_CRITICAL = "l1_critical"  # Most frequently accessed, longest TTL
    L2_FREQUENT = "l2_frequent"  # Frequently accessed
    L3_STANDARD = "l3_standard"  # Standard caching
    L4_TEMPORARY = "l4_temporary"  # Short-lived cache


class CacheStrategy(Enum):
    """Cache strategies for different scenarios."""
    WRITE_THROUGH = "write_through"  # Write to cache and database simultaneously
    WRITE_BEHIND = "write_behind"   # Write to cache first, database later
    CACHE_ASIDE = "cache_aside"     # Application manages cache
    READ_THROUGH = "read_through"   # Cache loads data on miss


class IntelligentCacheManager:
    """Enhanced cache manager with intelligent caching strategies and performance optimization."""
    
    def __init__(self):
        self.logger = logger.bind(component="intelligent_cache")
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'writes': 0,
            'errors': 0
        }
        self.cache_levels = {
            CacheLevel.L1_CRITICAL: {'ttl': 7200, 'max_size': 1000},    # 2 hours, 1000 items
            CacheLevel.L2_FREQUENT: {'ttl': 3600, 'max_size': 5000},    # 1 hour, 5000 items
            CacheLevel.L3_STANDARD: {'ttl': 1800, 'max_size': 10000},   # 30 minutes, 10000 items
            CacheLevel.L4_TEMPORARY: {'ttl': 300, 'max_size': 20000}    # 5 minutes, 20000 items
        }
        self.access_patterns = {}  # Track access patterns for optimization
        
    async def get(self, key: str, cache_level: CacheLevel = CacheLevel.L3_STANDARD) -> Optional[Any]:
        """Get value from cache with intelligent access pattern tracking."""
        try:
            redis_client = await get_redis()
            
            # Track access pattern
            await self._track_access(key, 'read')
            
            # Get from cache
            cache_key = self._build_cache_key(key, cache_level)
            value = await redis_client.get(cache_key)
            
            if value is not None:
                self.cache_stats['hits'] += 1
                
                # Update access frequency for cache optimization
                await self._update_access_frequency(key)
                
                return json.loads(value)
            else:
                self.cache_stats['misses'] += 1
                return None
                
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error("Cache get failed", key=key, error=str(e))
            return None
    
    async def set(self, key: str, value: Any, cache_level: CacheLevel = CacheLevel.L3_STANDARD, 
                  ttl: Optional[int] = None, strategy: CacheStrategy = CacheStrategy.CACHE_ASIDE) -> bool:
        """Set value in cache with intelligent TTL and strategy."""
        try:
            redis_client = await get_redis()
            
            # Track access pattern
            await self._track_access(key, 'write')
            
            # Determine TTL
            if ttl is None:
                ttl = self.cache_levels[cache_level]['ttl']
            
            # Adjust TTL based on access patterns
            ttl = await self._adjust_ttl_by_pattern(key, ttl)
            
            # Build cache key
            cache_key = self._build_cache_key(key, cache_level)
            
            # Serialize value
            serialized_value = json.dumps(value, default=str)
            
            # Set in cache
            await redis_client.setex(cache_key, ttl, serialized_value)
            
            # Store metadata
            await self._store_cache_metadata(key, cache_level, ttl, len(serialized_value))
            
            self.cache_stats['writes'] += 1
            return True
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error("Cache set failed", key=key, error=str(e))
            return False
    
    async def delete(self, key: str, cache_level: CacheLevel = CacheLevel.L3_STANDARD) -> bool:
        """Delete value from cache."""
        try:
            redis_client = await get_redis()
            
            cache_key = self._build_cache_key(key, cache_level)
            await redis_client.delete(cache_key)
            
            # Clean up metadata
            await self._cleanup_cache_metadata(key)
            
            return True
            
        except Exception as e:
            self.logger.error("Cache delete failed", key=key, error=str(e))
            return False
    
    async def exists(self, key: str, cache_level: CacheLevel = CacheLevel.L3_STANDARD) -> bool:
        """Check if key exists in cache."""
        try:
            redis_client = await get_redis()
            cache_key = self._build_cache_key(key, cache_level)
            return bool(await redis_client.exists(cache_key))
        except Exception as e:
            self.logger.error("Cache exists check failed", key=key, error=str(e))
            return False
    
    async def get_or_set(self, key: str, factory_func, cache_level: CacheLevel = CacheLevel.L3_STANDARD,
                        ttl: Optional[int] = None) -> Any:
        """Get value from cache or set it using factory function if not found."""
        # Try to get from cache first
        value = await self.get(key, cache_level)
        
        if value is not None:
            return value
        
        # Generate value using factory function
        try:
            if asyncio.iscoroutinefunction(factory_func):
                value = await factory_func()
            else:
                value = factory_func()
            
            # Set in cache
            await self.set(key, value, cache_level, ttl)
            
            return value
            
        except Exception as e:
            self.logger.error("Factory function failed", key=key, error=str(e))
            return None
    
    async def batch_get(self, keys: List[str], cache_level: CacheLevel = CacheLevel.L3_STANDARD) -> Dict[str, Any]:
        """Get multiple values from cache in a single operation."""
        try:
            redis_client = await get_redis()
            
            # Build cache keys
            cache_keys = [self._build_cache_key(key, cache_level) for key in keys]
            
            # Get all values
            values = await redis_client.mget(cache_keys)
            
            # Process results
            result = {}
            for i, (key, value) in enumerate(zip(keys, values)):
                if value is not None:
                    result[key] = json.loads(value)
                    self.cache_stats['hits'] += 1
                    await self._track_access(key, 'read')
                else:
                    self.cache_stats['misses'] += 1
            
            return result
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error("Batch cache get failed", keys=keys, error=str(e))
            return {}
    
    async def batch_set(self, data: Dict[str, Any], cache_level: CacheLevel = CacheLevel.L3_STANDARD,
                       ttl: Optional[int] = None) -> bool:
        """Set multiple values in cache in a single operation."""
        try:
            redis_client = await get_redis()
            
            if ttl is None:
                ttl = self.cache_levels[cache_level]['ttl']
            
            # Prepare pipeline
            pipe = redis_client.pipeline()
            
            for key, value in data.items():
                cache_key = self._build_cache_key(key, cache_level)
                serialized_value = json.dumps(value, default=str)
                pipe.setex(cache_key, ttl, serialized_value)
                await self._track_access(key, 'write')
            
            # Execute pipeline
            await pipe.execute()
            
            self.cache_stats['writes'] += len(data)
            return True
            
        except Exception as e:
            self.cache_stats['errors'] += 1
            self.logger.error("Batch cache set failed", error=str(e))
            return False
    
    def _build_cache_key(self, key: str, cache_level: CacheLevel) -> str:
        """Build cache key with level prefix."""
        return f"{cache_level.value}:{key}"
    
    async def _track_access(self, key: str, operation: str) -> None:
        """Track access patterns for cache optimization."""
        try:
            redis_client = await get_redis()
            
            # Track access time
            access_key = f"access_pattern:{key}"
            access_data = {
                'timestamp': datetime.utcnow().isoformat(),
                'operation': operation
            }
            
            # Store in a list (keep last 100 accesses)
            await redis_client.lpush(access_key, json.dumps(access_data))
            await redis_client.ltrim(access_key, 0, 99)  # Keep only last 100
            await redis_client.expire(access_key, 86400)  # Expire after 24 hours
            
        except Exception as e:
            self.logger.debug("Failed to track access pattern", key=key, error=str(e))
    
    async def _update_access_frequency(self, key: str) -> None:
        """Update access frequency counter."""
        try:
            redis_client = await get_redis()
            
            freq_key = f"access_freq:{key}"
            await redis_client.incr(freq_key)
            await redis_client.expire(freq_key, 3600)  # Reset hourly
            
        except Exception as e:
            self.logger.debug("Failed to update access frequency", key=key, error=str(e))
    
    async def _adjust_ttl_by_pattern(self, key: str, base_ttl: int) -> int:
        """Adjust TTL based on access patterns."""
        try:
            redis_client = await get_redis()
            
            # Get access frequency
            freq_key = f"access_freq:{key}"
            frequency = await redis_client.get(freq_key)
            
            if frequency:
                freq_count = int(frequency)
                
                # Increase TTL for frequently accessed items
                if freq_count > 10:
                    return int(base_ttl * 1.5)  # 50% longer
                elif freq_count > 5:
                    return int(base_ttl * 1.2)  # 20% longer
            
            return base_ttl
            
        except Exception:
            return base_ttl
    
    async def _store_cache_metadata(self, key: str, cache_level: CacheLevel, ttl: int, size: int) -> None:
        """Store cache metadata for monitoring and optimization."""
        try:
            redis_client = await get_redis()
            
            metadata = {
                'key': key,
                'cache_level': cache_level.value,
                'ttl': ttl,
                'size_bytes': size,
                'created_at': datetime.utcnow().isoformat()
            }
            
            metadata_key = f"cache_metadata:{key}"
            await redis_client.setex(metadata_key, ttl + 300, json.dumps(metadata))  # Metadata lives slightly longer
            
        except Exception as e:
            self.logger.debug("Failed to store cache metadata", key=key, error=str(e))
    
    async def _cleanup_cache_metadata(self, key: str) -> None:
        """Clean up cache metadata."""
        try:
            redis_client = await get_redis()
            
            metadata_key = f"cache_metadata:{key}"
            await redis_client.delete(metadata_key)
            
            # Clean up access patterns
            access_key = f"access_pattern:{key}"
            freq_key = f"access_freq:{key}"
            await redis_client.delete(access_key, freq_key)
            
        except Exception as e:
            self.logger.debug("Failed to cleanup cache metadata", key=key, error=str(e))
    
    async def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics and performance metrics."""
        try:
            redis_client = await get_redis()
            redis_info = await redis_client.info()
            
            # Calculate hit rate
            total_requests = self.cache_stats['hits'] + self.cache_stats['misses']
            hit_rate = (self.cache_stats['hits'] / total_requests) if total_requests > 0 else 0.0
            
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'hit_rate': hit_rate,
                'total_requests': total_requests,
                'cache_stats': self.cache_stats.copy(),
                'redis_info': {
                    'used_memory': redis_info.get('used_memory_human', '0B'),
                    'connected_clients': redis_info.get('connected_clients', 0),
                    'keyspace_hits': redis_info.get('keyspace_hits', 0),
                    'keyspace_misses': redis_info.get('keyspace_misses', 0),
                    'expired_keys': redis_info.get('expired_keys', 0),
                    'evicted_keys': redis_info.get('evicted_keys', 0)
                },
                'cache_levels': {level.value: config for level, config in self.cache_levels.items()}
            }
            
        except Exception as e:
            self.logger.error("Failed to get cache stats", error=str(e))
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e),
                'cache_stats': self.cache_stats.copy()
            }
    
    async def optimize_cache(self) -> Dict[str, Any]:
        """Perform cache optimization based on access patterns."""
        optimization_results = {
            'timestamp': datetime.utcnow().isoformat(),
            'actions_taken': [],
            'keys_analyzed': 0,
            'keys_promoted': 0,
            'keys_demoted': 0,
            'keys_evicted': 0
        }
        
        try:
            redis_client = await get_redis()
            
            # Get all cache metadata keys
            metadata_keys = await redis_client.keys("cache_metadata:*")
            optimization_results['keys_analyzed'] = len(metadata_keys)
            
            for metadata_key in metadata_keys:
                try:
                    metadata_str = await redis_client.get(metadata_key)
                    if not metadata_str:
                        continue
                    
                    metadata = json.loads(metadata_str)
                    key = metadata['key']
                    current_level = CacheLevel(metadata['cache_level'])
                    
                    # Get access frequency
                    freq_key = f"access_freq:{key}"
                    frequency = await redis_client.get(freq_key)
                    freq_count = int(frequency) if frequency else 0
                    
                    # Determine if key should be promoted or demoted
                    if freq_count > 20 and current_level != CacheLevel.L1_CRITICAL:
                        # Promote to higher cache level
                        await self._promote_cache_key(key, current_level)
                        optimization_results['keys_promoted'] += 1
                        optimization_results['actions_taken'].append(f"Promoted {key} to higher cache level")
                    
                    elif freq_count < 2 and current_level != CacheLevel.L4_TEMPORARY:
                        # Demote to lower cache level
                        await self._demote_cache_key(key, current_level)
                        optimization_results['keys_demoted'] += 1
                        optimization_results['actions_taken'].append(f"Demoted {key} to lower cache level")
                    
                    elif freq_count == 0:
                        # Consider for eviction if not accessed recently
                        created_at = datetime.fromisoformat(metadata['created_at'])
                        if datetime.utcnow() - created_at > timedelta(hours=2):
                            await self.delete(key, current_level)
                            optimization_results['keys_evicted'] += 1
                            optimization_results['actions_taken'].append(f"Evicted unused key {key}")
                
                except Exception as e:
                    self.logger.debug("Failed to optimize cache key", metadata_key=metadata_key, error=str(e))
            
            self.logger.info("Cache optimization completed", results=optimization_results)
            return optimization_results
            
        except Exception as e:
            self.logger.error("Cache optimization failed", error=str(e))
            optimization_results['error'] = str(e)
            return optimization_results
    
    async def _promote_cache_key(self, key: str, current_level: CacheLevel) -> None:
        """Promote a cache key to a higher level."""
        level_hierarchy = [CacheLevel.L4_TEMPORARY, CacheLevel.L3_STANDARD, CacheLevel.L2_FREQUENT, CacheLevel.L1_CRITICAL]
        current_index = level_hierarchy.index(current_level)
        
        if current_index > 0:
            new_level = level_hierarchy[current_index - 1]
            
            # Get current value
            value = await self.get(key, current_level)
            if value is not None:
                # Set in new level
                await self.set(key, value, new_level)
                # Delete from old level
                await self.delete(key, current_level)
    
    async def _demote_cache_key(self, key: str, current_level: CacheLevel) -> None:
        """Demote a cache key to a lower level."""
        level_hierarchy = [CacheLevel.L4_TEMPORARY, CacheLevel.L3_STANDARD, CacheLevel.L2_FREQUENT, CacheLevel.L1_CRITICAL]
        current_index = level_hierarchy.index(current_level)
        
        if current_index < len(level_hierarchy) - 1:
            new_level = level_hierarchy[current_index + 1]
            
            # Get current value
            value = await self.get(key, current_level)
            if value is not None:
                # Set in new level
                await self.set(key, value, new_level)
                # Delete from old level
                await self.delete(key, current_level)
    
    async def warm_cache(self, warm_data: Dict[str, Any]) -> bool:
        """Warm the cache with frequently accessed data."""
        try:
            # Set data in appropriate cache levels based on expected access patterns
            critical_data = warm_data.get('critical', {})
            frequent_data = warm_data.get('frequent', {})
            standard_data = warm_data.get('standard', {})
            
            # Warm critical cache
            if critical_data:
                await self.batch_set(critical_data, CacheLevel.L1_CRITICAL)
            
            # Warm frequent cache
            if frequent_data:
                await self.batch_set(frequent_data, CacheLevel.L2_FREQUENT)
            
            # Warm standard cache
            if standard_data:
                await self.batch_set(standard_data, CacheLevel.L3_STANDARD)
            
            self.logger.info("Cache warming completed", 
                           critical_keys=len(critical_data),
                           frequent_keys=len(frequent_data),
                           standard_keys=len(standard_data))
            return True
            
        except Exception as e:
            self.logger.error("Cache warming failed", error=str(e))
            return False
    
    async def clear_cache_level(self, cache_level: CacheLevel) -> bool:
        """Clear all keys from a specific cache level."""
        try:
            redis_client = await get_redis()
            
            # Get all keys for this cache level
            pattern = f"{cache_level.value}:*"
            keys = await redis_client.keys(pattern)
            
            if keys:
                await redis_client.delete(*keys)
                self.logger.info("Cache level cleared", level=cache_level.value, keys_deleted=len(keys))
            
            return True
            
        except Exception as e:
            self.logger.error("Failed to clear cache level", level=cache_level.value, error=str(e))
            return False


# Global instance
_intelligent_cache_manager = None


def get_intelligent_cache_manager() -> IntelligentCacheManager:
    """Get the global intelligent cache manager instance."""
    global _intelligent_cache_manager
    if _intelligent_cache_manager is None:
        _intelligent_cache_manager = IntelligentCacheManager()
    return _intelligent_cache_manager


class CacheOptimizationService:
    """Service for cache optimization and management."""
    
    def __init__(self):
        self.logger = logger.bind(service="cache_optimization")
        self.cache_manager = get_intelligent_cache_manager()
        self.optimization_running = False
        
    async def start_optimization_scheduler(self) -> None:
        """Start the cache optimization scheduler."""
        if self.optimization_running:
            return
        
        self.optimization_running = True
        asyncio.create_task(self._optimization_loop())
        self.logger.info("Cache optimization scheduler started")
    
    async def stop_optimization_scheduler(self) -> None:
        """Stop the cache optimization scheduler."""
        self.optimization_running = False
        self.logger.info("Cache optimization scheduler stopped")
    
    async def _optimization_loop(self) -> None:
        """Main optimization loop."""
        while self.optimization_running:
            try:
                # Run optimization every 30 minutes
                await asyncio.sleep(1800)
                
                if self.optimization_running:
                    await self.cache_manager.optimize_cache()
                
            except Exception as e:
                self.logger.error("Error in cache optimization loop", error=str(e))
                await asyncio.sleep(300)  # Wait 5 minutes on error
    
    async def get_cache_performance(self) -> Dict[str, Any]:
        """Get cache performance metrics."""
        return await self.cache_manager.get_cache_stats()
    
    async def optimize_now(self) -> Dict[str, Any]:
        """Trigger immediate cache optimization."""
        return await self.cache_manager.optimize_cache()
    
    async def warm_cache_with_common_data(self) -> bool:
        """Warm cache with commonly accessed data."""
        try:
            # This would typically load common questions, user data, etc.
            # For now, we'll implement a basic warming strategy
            
            warm_data = {
                'critical': {
                    'system_config': {'version': '1.0', 'features': ['ai', 'execution', 'validation']},
                    'cache_config': self.cache_manager.cache_levels
                },
                'frequent': {
                    'default_questions': [],  # Would load from database
                    'common_templates': {}    # Would load AI templates
                },
                'standard': {
                    'help_content': {'faq': [], 'tutorials': []},
                    'static_content': {}
                }
            }
            
            return await self.cache_manager.warm_cache(warm_data)
            
        except Exception as e:
            self.logger.error("Failed to warm cache with common data", error=str(e))
            return False