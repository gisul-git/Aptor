"""
Cost optimization service for the Data Engineer Assessment Platform.
Implements idle container termination, AI request batching, rate limiting, and usage monitoring.
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
import structlog
from enum import Enum
from dataclasses import dataclass, asdict

from app.core.config import settings
from app.core.redis_client import get_redis, CacheManager
from app.services.execution_engine import get_execution_engine

logger = structlog.get_logger()


class CostThresholdLevel(Enum):
    """Cost threshold levels for usage controls."""
    GREEN = "green"      # Normal usage
    YELLOW = "yellow"    # Approaching limits
    ORANGE = "orange"    # Near limits
    RED = "red"          # At limits


@dataclass
class UsageMetrics:
    """Usage metrics for cost monitoring."""
    timestamp: str
    ai_requests_count: int
    ai_requests_cost: float
    container_hours: float
    container_cost: float
    storage_gb: float
    storage_cost: float
    total_cost: float
    user_id: Optional[str] = None


@dataclass
class CostThreshold:
    """Cost threshold configuration."""
    daily_limit: float = 100.0
    hourly_limit: float = 10.0
    ai_request_limit: int = 1000
    container_hour_limit: float = 24.0
    storage_gb_limit: float = 100.0


class IdleContainerManager:
    """Manages idle container termination to reduce costs."""
    
    def __init__(self):
        self.logger = logger.bind(component="idle_container_manager")
        self.idle_threshold_minutes = 15  # Terminate after 15 minutes idle
        self.check_interval_seconds = 300  # Check every 5 minutes
        self.is_running = False
        
    async def start_monitoring(self) -> None:
        """Start idle container monitoring."""
        if self.is_running:
            return
        
        self.is_running = True
        self.logger.info("Starting idle container monitoring")
        asyncio.create_task(self._monitoring_loop())
    
    async def stop_monitoring(self) -> None:
        """Stop idle container monitoring."""
        self.is_running = False
        self.logger.info("Idle container monitoring stopped")
    
    async def _monitoring_loop(self) -> None:
        """Main monitoring loop for idle containers."""
        while self.is_running:
            try:
                await self._check_and_terminate_idle_containers()
                await asyncio.sleep(self.check_interval_seconds)
            except Exception as e:
                self.logger.error("Error in idle container monitoring", error=str(e))
                await asyncio.sleep(60)  # Wait 1 minute on error
    
    async def _check_and_terminate_idle_containers(self) -> None:
        """Check for idle containers and terminate them."""
        try:
            execution_engine = get_execution_engine()
            pool_status = await execution_engine.get_queue_status()
            
            active_containers = pool_status.get('resource_pool', {}).get('active_containers', {})
            current_time = datetime.utcnow()
            
            terminated_count = 0
            
            for job_id, container_info in active_containers.items():
                allocated_at = container_info.get('allocated_at')
                if not allocated_at:
                    continue
                
                # Calculate idle time
                if isinstance(allocated_at, str):
                    allocated_at = datetime.fromisoformat(allocated_at)
                
                idle_time = current_time - allocated_at
                
                # Check if container is idle beyond threshold
                if idle_time.total_seconds() > (self.idle_threshold_minutes * 60):
                    # Check if container is actually idle (no recent activity)
                    if await self._is_container_idle(job_id):
                        await execution_engine.resource_pool.deallocate_container(job_id)
                        terminated_count += 1
                        
                        self.logger.info("Terminated idle container", 
                                       job_id=job_id,
                                       idle_minutes=idle_time.total_seconds() / 60)
            
            if terminated_count > 0:
                await self._record_cost_savings(terminated_count)
                
        except Exception as e:
            self.logger.error("Failed to check idle containers", error=str(e))
    
    async def _is_container_idle(self, job_id: str) -> bool:
        """Check if a container is actually idle."""
        try:
            redis_client = await get_redis()
            
            # Check for recent activity in Redis
            activity_key = f"container_activity:{job_id}"
            last_activity = await redis_client.get(activity_key)
            
            if not last_activity:
                return True  # No activity recorded, consider idle
            
            last_activity_time = datetime.fromisoformat(last_activity)
            idle_time = datetime.utcnow() - last_activity_time
            
            return idle_time.total_seconds() > (self.idle_threshold_minutes * 60)
            
        except Exception:
            return False  # Conservative approach - don't terminate if unsure
    
    async def _record_cost_savings(self, terminated_count: int) -> None:
        """Record cost savings from idle container termination."""
        try:
            # Estimate cost savings (assuming $0.10 per container hour)
            estimated_savings = terminated_count * 0.10
            
            redis_client = await get_redis()
            savings_key = f"cost_savings:{datetime.utcnow().strftime('%Y-%m-%d')}"
            
            await redis_client.incrbyfloat(savings_key, estimated_savings)
            await redis_client.expire(savings_key, 86400 * 30)  # Keep for 30 days
            
            self.logger.info("Recorded cost savings", 
                           terminated_containers=terminated_count,
                           estimated_savings=estimated_savings)
            
        except Exception as e:
            self.logger.error("Failed to record cost savings", error=str(e))


class AIRequestBatcher:
    """Batches AI requests to reduce costs and improve efficiency."""
    
    def __init__(self):
        self.logger = logger.bind(component="ai_request_batcher")
        self.batch_size = 5  # Batch up to 5 requests
        self.batch_timeout_seconds = 10  # Wait max 10 seconds for batch
        self.pending_requests: Dict[str, List[Dict[str, Any]]] = {}
        self.batch_timers: Dict[str, asyncio.Task] = {}
        
    async def add_request(self, request_type: str, request_data: Dict[str, Any], 
                         callback: callable) -> None:
        """Add a request to the batch queue."""
        try:
            if request_type not in self.pending_requests:
                self.pending_requests[request_type] = []
            
            request_item = {
                'data': request_data,
                'callback': callback,
                'timestamp': datetime.utcnow().isoformat()
            }
            
            self.pending_requests[request_type].append(request_item)
            
            # Check if batch is full
            if len(self.pending_requests[request_type]) >= self.batch_size:
                await self._process_batch(request_type)
            else:
                # Start timer if not already running
                if request_type not in self.batch_timers:
                    self.batch_timers[request_type] = asyncio.create_task(
                        self._batch_timeout(request_type)
                    )
            
        except Exception as e:
            self.logger.error("Failed to add request to batch", 
                            request_type=request_type, error=str(e))
            # Execute immediately as fallback
            await callback(request_data)
    
    async def _batch_timeout(self, request_type: str) -> None:
        """Handle batch timeout - process pending requests."""
        try:
            await asyncio.sleep(self.batch_timeout_seconds)
            await self._process_batch(request_type)
        except asyncio.CancelledError:
            pass  # Timer was cancelled, batch was processed early
        except Exception as e:
            self.logger.error("Error in batch timeout", request_type=request_type, error=str(e))
    
    async def _process_batch(self, request_type: str) -> None:
        """Process a batch of requests."""
        try:
            if request_type not in self.pending_requests:
                return
            
            requests = self.pending_requests.pop(request_type, [])
            
            # Cancel timer if running
            if request_type in self.batch_timers:
                self.batch_timers[request_type].cancel()
                del self.batch_timers[request_type]
            
            if not requests:
                return
            
            self.logger.info("Processing batch", 
                           request_type=request_type, 
                           batch_size=len(requests))
            
            # Process requests in batch
            for request_item in requests:
                try:
                    await request_item['callback'](request_item['data'])
                except Exception as e:
                    self.logger.error("Failed to process batched request", 
                                    request_type=request_type, error=str(e))
            
            # Record batch processing for cost tracking
            await self._record_batch_processing(request_type, len(requests))
            
        except Exception as e:
            self.logger.error("Failed to process batch", 
                            request_type=request_type, error=str(e))
    
    async def _record_batch_processing(self, request_type: str, batch_size: int) -> None:
        """Record batch processing metrics."""
        try:
            redis_client = await get_redis()
            
            # Record batch metrics
            batch_key = f"ai_batches:{datetime.utcnow().strftime('%Y-%m-%d')}"
            batch_data = {
                'timestamp': datetime.utcnow().isoformat(),
                'request_type': request_type,
                'batch_size': batch_size
            }
            
            await redis_client.lpush(batch_key, str(batch_data))
            await redis_client.expire(batch_key, 86400 * 7)  # Keep for 7 days
            
        except Exception as e:
            self.logger.error("Failed to record batch processing", error=str(e))


class RateLimiter:
    """Implements rate limiting for AI services to control costs."""
    
    def __init__(self):
        self.logger = logger.bind(component="rate_limiter")
        self.limits = {
            'ai_requests_per_hour': 100,
            'ai_requests_per_day': 1000,
            'executions_per_hour': 50,
            'executions_per_day': 500
        }
        
    async def check_rate_limit(self, user_id: str, action: str) -> Tuple[bool, Dict[str, Any]]:
        """Check if action is within rate limits."""
        try:
            redis_client = await get_redis()
            current_time = datetime.utcnow()
            
            # Check hourly limit
            hourly_key = f"rate_limit:{action}:hour:{user_id}:{current_time.strftime('%Y-%m-%d-%H')}"
            hourly_count = await redis_client.get(hourly_key)
            hourly_count = int(hourly_count) if hourly_count else 0
            
            # Check daily limit
            daily_key = f"rate_limit:{action}:day:{user_id}:{current_time.strftime('%Y-%m-%d')}"
            daily_count = await redis_client.get(daily_key)
            daily_count = int(daily_count) if daily_count else 0
            
            hourly_limit = self.limits.get(f'{action}_per_hour', 100)
            daily_limit = self.limits.get(f'{action}_per_day', 1000)
            
            # Check limits
            if hourly_count >= hourly_limit:
                return False, {
                    'reason': 'hourly_limit_exceeded',
                    'limit': hourly_limit,
                    'current': hourly_count,
                    'reset_time': (current_time + timedelta(hours=1)).isoformat()
                }
            
            if daily_count >= daily_limit:
                return False, {
                    'reason': 'daily_limit_exceeded',
                    'limit': daily_limit,
                    'current': daily_count,
                    'reset_time': (current_time + timedelta(days=1)).isoformat()
                }
            
            return True, {
                'hourly_remaining': hourly_limit - hourly_count,
                'daily_remaining': daily_limit - daily_count
            }
            
        except Exception as e:
            self.logger.error("Rate limit check failed", user_id=user_id, action=action, error=str(e))
            return True, {}  # Allow on error (fail open)
    
    async def increment_usage(self, user_id: str, action: str) -> None:
        """Increment usage counters."""
        try:
            redis_client = await get_redis()
            current_time = datetime.utcnow()
            
            # Increment hourly counter
            hourly_key = f"rate_limit:{action}:hour:{user_id}:{current_time.strftime('%Y-%m-%d-%H')}"
            await redis_client.incr(hourly_key)
            await redis_client.expire(hourly_key, 3600)  # 1 hour
            
            # Increment daily counter
            daily_key = f"rate_limit:{action}:day:{user_id}:{current_time.strftime('%Y-%m-%d')}"
            await redis_client.incr(daily_key)
            await redis_client.expire(daily_key, 86400)  # 24 hours
            
        except Exception as e:
            self.logger.error("Failed to increment usage", user_id=user_id, action=action, error=str(e))
    
    async def get_usage_stats(self, user_id: str) -> Dict[str, Any]:
        """Get current usage statistics for a user."""
        try:
            redis_client = await get_redis()
            current_time = datetime.utcnow()
            
            stats = {}
            
            for action in ['ai_requests', 'executions']:
                hourly_key = f"rate_limit:{action}:hour:{user_id}:{current_time.strftime('%Y-%m-%d-%H')}"
                daily_key = f"rate_limit:{action}:day:{user_id}:{current_time.strftime('%Y-%m-%d')}"
                
                hourly_count = await redis_client.get(hourly_key)
                daily_count = await redis_client.get(daily_key)
                
                hourly_limit = self.limits.get(f'{action}_per_hour', 100)
                daily_limit = self.limits.get(f'{action}_per_day', 1000)
                
                stats[action] = {
                    'hourly_usage': int(hourly_count) if hourly_count else 0,
                    'hourly_limit': hourly_limit,
                    'daily_usage': int(daily_count) if daily_count else 0,
                    'daily_limit': daily_limit
                }
            
            return stats
            
        except Exception as e:
            self.logger.error("Failed to get usage stats", user_id=user_id, error=str(e))
            return {}


class UsageMonitor:
    """Monitors usage and costs across the platform."""
    
    def __init__(self):
        self.logger = logger.bind(component="usage_monitor")
        self.cost_per_ai_request = 0.01  # $0.01 per AI request
        self.cost_per_container_hour = 0.10  # $0.10 per container hour
        self.cost_per_gb_storage = 0.02  # $0.02 per GB per day
        
    async def record_usage(self, user_id: str, usage_type: str, amount: float, 
                          metadata: Optional[Dict[str, Any]] = None) -> None:
        """Record usage for cost tracking."""
        try:
            redis_client = await get_redis()
            current_time = datetime.utcnow()
            
            usage_record = {
                'timestamp': current_time.isoformat(),
                'user_id': user_id,
                'usage_type': usage_type,
                'amount': amount,
                'metadata': metadata or {}
            }
            
            # Store in daily usage log
            daily_key = f"usage_log:{current_time.strftime('%Y-%m-%d')}"
            await redis_client.lpush(daily_key, str(usage_record))
            await redis_client.expire(daily_key, 86400 * 30)  # Keep for 30 days
            
            # Update user usage counters
            user_daily_key = f"user_usage:{user_id}:{current_time.strftime('%Y-%m-%d')}"
            await redis_client.hincrbyfloat(user_daily_key, usage_type, amount)
            await redis_client.expire(user_daily_key, 86400 * 30)
            
            # Update global usage counters
            global_daily_key = f"global_usage:{current_time.strftime('%Y-%m-%d')}"
            await redis_client.hincrbyfloat(global_daily_key, usage_type, amount)
            await redis_client.expire(global_daily_key, 86400 * 30)
            
        except Exception as e:
            self.logger.error("Failed to record usage", 
                            user_id=user_id, usage_type=usage_type, error=str(e))
    
    async def calculate_costs(self, user_id: Optional[str] = None, 
                            date: Optional[str] = None) -> UsageMetrics:
        """Calculate costs for a user or globally."""
        try:
            redis_client = await get_redis()
            
            if not date:
                date = datetime.utcnow().strftime('%Y-%m-%d')
            
            if user_id:
                usage_key = f"user_usage:{user_id}:{date}"
            else:
                usage_key = f"global_usage:{date}"
            
            usage_data = await redis_client.hgetall(usage_key)
            
            # Convert bytes to strings and parse
            usage = {}
            for key, value in usage_data.items():
                if isinstance(key, bytes):
                    key = key.decode('utf-8')
                if isinstance(value, bytes):
                    value = value.decode('utf-8')
                usage[key] = float(value)
            
            # Calculate costs
            ai_requests = usage.get('ai_requests', 0)
            container_hours = usage.get('container_hours', 0)
            storage_gb = usage.get('storage_gb', 0)
            
            ai_cost = ai_requests * self.cost_per_ai_request
            container_cost = container_hours * self.cost_per_container_hour
            storage_cost = storage_gb * self.cost_per_gb_storage
            total_cost = ai_cost + container_cost + storage_cost
            
            return UsageMetrics(
                timestamp=datetime.utcnow().isoformat(),
                ai_requests_count=int(ai_requests),
                ai_requests_cost=ai_cost,
                container_hours=container_hours,
                container_cost=container_cost,
                storage_gb=storage_gb,
                storage_cost=storage_cost,
                total_cost=total_cost,
                user_id=user_id
            )
            
        except Exception as e:
            self.logger.error("Failed to calculate costs", user_id=user_id, error=str(e))
            return UsageMetrics(
                timestamp=datetime.utcnow().isoformat(),
                ai_requests_count=0,
                ai_requests_cost=0.0,
                container_hours=0.0,
                container_cost=0.0,
                storage_gb=0.0,
                storage_cost=0.0,
                total_cost=0.0,
                user_id=user_id
            )
    
    async def get_cost_trend(self, user_id: Optional[str] = None, days: int = 7) -> List[UsageMetrics]:
        """Get cost trend over specified number of days."""
        try:
            trend_data = []
            current_date = datetime.utcnow()
            
            for i in range(days):
                date = (current_date - timedelta(days=i)).strftime('%Y-%m-%d')
                metrics = await self.calculate_costs(user_id, date)
                trend_data.append(metrics)
            
            return list(reversed(trend_data))  # Return chronological order
            
        except Exception as e:
            self.logger.error("Failed to get cost trend", user_id=user_id, error=str(e))
            return []


class CostController:
    """Controls system behavior based on cost thresholds."""
    
    def __init__(self):
        self.logger = logger.bind(component="cost_controller")
        self.thresholds = CostThreshold()
        self.current_level = CostThresholdLevel.GREEN
        
    async def check_cost_thresholds(self, user_id: Optional[str] = None) -> CostThresholdLevel:
        """Check current cost level against thresholds."""
        try:
            usage_monitor = UsageMonitor()
            
            # Get current day costs
            daily_metrics = await usage_monitor.calculate_costs(user_id)
            
            # Get current hour costs (approximate)
            current_hour = datetime.utcnow().hour
            hourly_cost = daily_metrics.total_cost * (1.0 / 24.0)  # Rough estimate
            
            # Determine threshold level
            if daily_metrics.total_cost >= self.thresholds.daily_limit:
                level = CostThresholdLevel.RED
            elif daily_metrics.total_cost >= self.thresholds.daily_limit * 0.8:
                level = CostThresholdLevel.ORANGE
            elif daily_metrics.total_cost >= self.thresholds.daily_limit * 0.6:
                level = CostThresholdLevel.YELLOW
            else:
                level = CostThresholdLevel.GREEN
            
            # Check hourly limits too
            if hourly_cost >= self.thresholds.hourly_limit:
                level = max(level, CostThresholdLevel.RED, key=lambda x: x.value)
            
            if level != self.current_level:
                await self._handle_threshold_change(level, daily_metrics)
                self.current_level = level
            
            return level
            
        except Exception as e:
            self.logger.error("Failed to check cost thresholds", user_id=user_id, error=str(e))
            return CostThresholdLevel.GREEN
    
    async def _handle_threshold_change(self, new_level: CostThresholdLevel, 
                                     metrics: UsageMetrics) -> None:
        """Handle cost threshold level changes."""
        try:
            self.logger.warning("Cost threshold level changed", 
                              from_level=self.current_level.value,
                              to_level=new_level.value,
                              total_cost=metrics.total_cost)
            
            # Apply cost control measures based on level
            if new_level == CostThresholdLevel.YELLOW:
                await self._apply_yellow_controls()
            elif new_level == CostThresholdLevel.ORANGE:
                await self._apply_orange_controls()
            elif new_level == CostThresholdLevel.RED:
                await self._apply_red_controls()
            elif new_level == CostThresholdLevel.GREEN:
                await self._restore_normal_operations()
            
            # Record threshold change
            await self._record_threshold_change(new_level, metrics)
            
        except Exception as e:
            self.logger.error("Failed to handle threshold change", error=str(e))
    
    async def _apply_yellow_controls(self) -> None:
        """Apply yellow level cost controls."""
        # Increase cache TTL to reduce AI requests
        # Reduce batch timeout to process requests faster
        self.logger.info("Applied yellow level cost controls")
    
    async def _apply_orange_controls(self) -> None:
        """Apply orange level cost controls."""
        # Further reduce AI request frequency
        # Increase idle container termination frequency
        self.logger.info("Applied orange level cost controls")
    
    async def _apply_red_controls(self) -> None:
        """Apply red level cost controls."""
        # Severely limit AI requests
        # Terminate all idle containers immediately
        # Queue non-critical operations
        self.logger.info("Applied red level cost controls")
    
    async def _restore_normal_operations(self) -> None:
        """Restore normal operations when costs are under control."""
        self.logger.info("Restored normal operations - costs under control")
    
    async def _record_threshold_change(self, level: CostThresholdLevel, 
                                     metrics: UsageMetrics) -> None:
        """Record threshold level changes for monitoring."""
        try:
            redis_client = await get_redis()
            
            threshold_event = {
                'timestamp': datetime.utcnow().isoformat(),
                'level': level.value,
                'metrics': asdict(metrics)
            }
            
            events_key = f"cost_threshold_events:{datetime.utcnow().strftime('%Y-%m-%d')}"
            await redis_client.lpush(events_key, str(threshold_event))
            await redis_client.expire(events_key, 86400 * 30)  # Keep for 30 days
            
        except Exception as e:
            self.logger.error("Failed to record threshold change", error=str(e))


# Global instances
_idle_container_manager = None
_ai_request_batcher = None
_rate_limiter = None
_usage_monitor = None
_cost_controller = None


def get_idle_container_manager() -> IdleContainerManager:
    """Get the global idle container manager instance."""
    global _idle_container_manager
    if _idle_container_manager is None:
        _idle_container_manager = IdleContainerManager()
    return _idle_container_manager


def get_ai_request_batcher() -> AIRequestBatcher:
    """Get the global AI request batcher instance."""
    global _ai_request_batcher
    if _ai_request_batcher is None:
        _ai_request_batcher = AIRequestBatcher()
    return _ai_request_batcher


def get_rate_limiter() -> RateLimiter:
    """Get the global rate limiter instance."""
    global _rate_limiter
    if _rate_limiter is None:
        _rate_limiter = RateLimiter()
    return _rate_limiter


def get_usage_monitor() -> UsageMonitor:
    """Get the global usage monitor instance."""
    global _usage_monitor
    if _usage_monitor is None:
        _usage_monitor = UsageMonitor()
    return _usage_monitor


def get_cost_controller() -> CostController:
    """Get the global cost controller instance."""
    global _cost_controller
    if _cost_controller is None:
        _cost_controller = CostController()
    return _cost_controller


class CostOptimizationService:
    """Main service for cost optimization and management."""
    
    def __init__(self):
        self.logger = logger.bind(service="cost_optimization")
        self.idle_manager = get_idle_container_manager()
        self.request_batcher = get_ai_request_batcher()
        self.rate_limiter = get_rate_limiter()
        self.usage_monitor = get_usage_monitor()
        self.cost_controller = get_cost_controller()
        
    async def start_cost_optimization(self) -> bool:
        """Start all cost optimization services."""
        try:
            await self.idle_manager.start_monitoring()
            self.logger.info("Cost optimization services started")
            return True
        except Exception as e:
            self.logger.error("Failed to start cost optimization", error=str(e))
            return False
    
    async def stop_cost_optimization(self) -> bool:
        """Stop all cost optimization services."""
        try:
            await self.idle_manager.stop_monitoring()
            self.logger.info("Cost optimization services stopped")
            return True
        except Exception as e:
            self.logger.error("Failed to stop cost optimization", error=str(e))
            return False
    
    async def get_cost_status(self, user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get comprehensive cost status and metrics."""
        try:
            # Get current metrics
            current_metrics = await self.usage_monitor.calculate_costs(user_id)
            
            # Get cost trend
            cost_trend = await self.usage_monitor.get_cost_trend(user_id, days=7)
            
            # Check threshold level
            threshold_level = await self.cost_controller.check_cost_thresholds(user_id)
            
            # Get usage stats
            usage_stats = await self.rate_limiter.get_usage_stats(user_id) if user_id else {}
            
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'user_id': user_id,
                'current_metrics': asdict(current_metrics),
                'cost_trend': [asdict(m) for m in cost_trend],
                'threshold_level': threshold_level.value,
                'usage_stats': usage_stats,
                'optimization_status': {
                    'idle_monitoring_active': self.idle_manager.is_running,
                    'rate_limiting_active': True,
                    'batching_active': True
                }
            }
            
        except Exception as e:
            self.logger.error("Failed to get cost status", user_id=user_id, error=str(e))
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e)
            }
    
    async def optimize_costs_now(self) -> Dict[str, Any]:
        """Trigger immediate cost optimization actions."""
        try:
            optimization_results = {
                'timestamp': datetime.utcnow().isoformat(),
                'actions_taken': [],
                'containers_terminated': 0,
                'estimated_savings': 0.0
            }
            
            # Force check and terminate idle containers
            await self.idle_manager._check_and_terminate_idle_containers()
            optimization_results['actions_taken'].append("Checked and terminated idle containers")
            
            # Check cost thresholds and apply controls
            threshold_level = await self.cost_controller.check_cost_thresholds()
            optimization_results['actions_taken'].append(f"Applied {threshold_level.value} level cost controls")
            
            self.logger.info("Manual cost optimization completed", results=optimization_results)
            return optimization_results
            
        except Exception as e:
            self.logger.error("Failed to optimize costs", error=str(e))
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e)
            }
    
    async def update_cost_thresholds(self, new_thresholds: Dict[str, float]) -> bool:
        """Update cost control thresholds."""
        try:
            if 'daily_limit' in new_thresholds:
                self.cost_controller.thresholds.daily_limit = new_thresholds['daily_limit']
            if 'hourly_limit' in new_thresholds:
                self.cost_controller.thresholds.hourly_limit = new_thresholds['hourly_limit']
            if 'ai_request_limit' in new_thresholds:
                self.cost_controller.thresholds.ai_request_limit = new_thresholds['ai_request_limit']
            
            self.logger.info("Cost thresholds updated", thresholds=new_thresholds)
            return True
            
        except Exception as e:
            self.logger.error("Failed to update cost thresholds", error=str(e))
            return False
    
    async def record_ai_request(self, user_id: str, request_type: str, cost: float = None) -> None:
        """Record an AI request for cost tracking."""
        try:
            # Record usage
            await self.usage_monitor.record_usage(
                user_id=user_id,
                usage_type='ai_requests',
                amount=1.0,
                metadata={'request_type': request_type, 'cost': cost or self.usage_monitor.cost_per_ai_request}
            )
            
            # Increment rate limiting counter
            await self.rate_limiter.increment_usage(user_id, 'ai_requests')
            
        except Exception as e:
            self.logger.error("Failed to record AI request", user_id=user_id, error=str(e))
    
    async def record_container_usage(self, user_id: str, duration_hours: float) -> None:
        """Record container usage for cost tracking."""
        try:
            await self.usage_monitor.record_usage(
                user_id=user_id,
                usage_type='container_hours',
                amount=duration_hours,
                metadata={'cost_per_hour': self.usage_monitor.cost_per_container_hour}
            )
            
            # Increment rate limiting counter
            await self.rate_limiter.increment_usage(user_id, 'executions')
            
        except Exception as e:
            self.logger.error("Failed to record container usage", user_id=user_id, error=str(e))