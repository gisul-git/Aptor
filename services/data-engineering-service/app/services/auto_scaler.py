"""
Auto-scaling and resource management service for the Data Engineer Assessment Platform.
"""

import asyncio
import time
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import structlog
import psutil
from enum import Enum

from app.core.config import settings
from app.core.redis_client import get_redis, CacheManager, JobQueue
from app.services.execution_engine import get_execution_engine

logger = structlog.get_logger()


class ScalingAction(Enum):
    """Types of scaling actions."""
    SCALE_UP = "scale_up"
    SCALE_DOWN = "scale_down"
    MAINTAIN = "maintain"


class ResourceThreshold:
    """Resource threshold configuration for auto-scaling decisions."""
    
    def __init__(self):
        self.cpu_scale_up_threshold = 80.0  # Scale up when CPU > 80%
        self.cpu_scale_down_threshold = 30.0  # Scale down when CPU < 30%
        self.memory_scale_up_threshold = 85.0  # Scale up when memory > 85%
        self.memory_scale_down_threshold = 40.0  # Scale down when memory < 40%
        self.queue_scale_up_threshold = 5  # Scale up when queue > 5 jobs
        self.queue_scale_down_threshold = 0  # Scale down when queue empty
        self.min_containers = 1  # Minimum containers to maintain
        self.max_containers = 10  # Maximum containers allowed
        self.scale_cooldown_seconds = 300  # 5 minutes between scaling actions


class AutoScaler:
    """Auto-scaling service for container resources based on demand and system metrics."""
    
    def __init__(self):
        self.logger = logger.bind(component="auto_scaler")
        self.thresholds = ResourceThreshold()
        self.last_scaling_action = None
        self.last_scaling_time = None
        self.scaling_history: List[Dict[str, Any]] = []
        self.is_running = False
        self.monitoring_interval = 30  # Check every 30 seconds
        
    async def start_monitoring(self) -> None:
        """Start the auto-scaling monitoring loop."""
        if self.is_running:
            self.logger.info("Auto-scaler already running")
            return
        
        self.is_running = True
        self.logger.info("Starting auto-scaler monitoring")
        
        # Start monitoring task
        asyncio.create_task(self._monitoring_loop())
    
    async def stop_monitoring(self) -> None:
        """Stop the auto-scaling monitoring."""
        self.is_running = False
        self.logger.info("Auto-scaler monitoring stopped")
    
    async def _monitoring_loop(self) -> None:
        """Main monitoring loop for auto-scaling decisions."""
        while self.is_running:
            try:
                # Collect system metrics
                metrics = await self._collect_metrics()
                
                # Make scaling decision
                scaling_decision = await self._make_scaling_decision(metrics)
                
                # Execute scaling action if needed
                if scaling_decision['action'] != ScalingAction.MAINTAIN:
                    await self._execute_scaling_action(scaling_decision, metrics)
                
                # Cache metrics for monitoring dashboard
                await self._cache_metrics(metrics, scaling_decision)
                
                # Wait before next check
                await asyncio.sleep(self.monitoring_interval)
                
            except Exception as e:
                self.logger.error("Error in auto-scaler monitoring loop", error=str(e))
                await asyncio.sleep(self.monitoring_interval)
    
    async def _collect_metrics(self) -> Dict[str, Any]:
        """Collect comprehensive system and application metrics."""
        try:
            # System resource metrics
            cpu_percent = psutil.cpu_percent(interval=1.0)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            # Application metrics
            execution_engine = get_execution_engine()
            queue_status = await execution_engine.get_queue_status()
            pool_status = queue_status.get('resource_pool', {})
            
            # Redis metrics
            redis_client = await get_redis()
            redis_info = await redis_client.info()
            
            metrics = {
                'timestamp': datetime.utcnow().isoformat(),
                'system': {
                    'cpu_percent': cpu_percent,
                    'memory_percent': memory.percent,
                    'memory_available_gb': memory.available / (1024**3),
                    'disk_percent': disk.percent,
                    'load_average': psutil.getloadavg()[0] if hasattr(psutil, 'getloadavg') else 0.0
                },
                'application': {
                    'active_containers': pool_status.get('active_containers', 0),
                    'max_containers': pool_status.get('max_concurrent', 0),
                    'available_slots': pool_status.get('available_slots', 0),
                    'queue_length': queue_status.get('queue_length', 0),
                    'active_jobs': queue_status.get('active_jobs', 0),
                    'processor_running': queue_status.get('processor_running', False)
                },
                'redis': {
                    'connected_clients': redis_info.get('connected_clients', 0),
                    'used_memory_mb': redis_info.get('used_memory', 0) / (1024**2),
                    'keyspace_hits': redis_info.get('keyspace_hits', 0),
                    'keyspace_misses': redis_info.get('keyspace_misses', 0)
                }
            }
            
            return metrics
            
        except Exception as e:
            self.logger.error("Failed to collect metrics", error=str(e))
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'system': {'cpu_percent': 0, 'memory_percent': 0, 'disk_percent': 0},
                'application': {'active_containers': 0, 'queue_length': 0},
                'redis': {'connected_clients': 0, 'used_memory_mb': 0}
            }
    
    async def _make_scaling_decision(self, metrics: Dict[str, Any]) -> Dict[str, Any]:
        """Make auto-scaling decision based on collected metrics."""
        system = metrics.get('system', {})
        app = metrics.get('application', {})
        
        cpu_percent = system.get('cpu_percent', 0)
        memory_percent = system.get('memory_percent', 0)
        queue_length = app.get('queue_length', 0)
        active_containers = app.get('active_containers', 0)
        max_containers = app.get('max_containers', 0)
        
        # Check cooldown period
        if self._is_in_cooldown():
            return {
                'action': ScalingAction.MAINTAIN,
                'reason': 'In cooldown period',
                'current_containers': active_containers,
                'target_containers': active_containers
            }
        
        # Determine scaling action based on multiple factors
        scale_up_reasons = []
        scale_down_reasons = []
        
        # CPU-based scaling
        if cpu_percent > self.thresholds.cpu_scale_up_threshold:
            scale_up_reasons.append(f"High CPU usage: {cpu_percent:.1f}%")
        elif cpu_percent < self.thresholds.cpu_scale_down_threshold:
            scale_down_reasons.append(f"Low CPU usage: {cpu_percent:.1f}%")
        
        # Memory-based scaling
        if memory_percent > self.thresholds.memory_scale_up_threshold:
            scale_up_reasons.append(f"High memory usage: {memory_percent:.1f}%")
        elif memory_percent < self.thresholds.memory_scale_down_threshold:
            scale_down_reasons.append(f"Low memory usage: {memory_percent:.1f}%")
        
        # Queue-based scaling
        if queue_length > self.thresholds.queue_scale_up_threshold:
            scale_up_reasons.append(f"High queue length: {queue_length}")
        elif queue_length <= self.thresholds.queue_scale_down_threshold:
            scale_down_reasons.append(f"Empty queue: {queue_length}")
        
        # Make decision
        if scale_up_reasons and active_containers < self.thresholds.max_containers:
            target_containers = min(active_containers + 1, self.thresholds.max_containers)
            return {
                'action': ScalingAction.SCALE_UP,
                'reason': '; '.join(scale_up_reasons),
                'current_containers': active_containers,
                'target_containers': target_containers
            }
        elif scale_down_reasons and active_containers > self.thresholds.min_containers:
            target_containers = max(active_containers - 1, self.thresholds.min_containers)
            return {
                'action': ScalingAction.SCALE_DOWN,
                'reason': '; '.join(scale_down_reasons),
                'current_containers': active_containers,
                'target_containers': target_containers
            }
        else:
            return {
                'action': ScalingAction.MAINTAIN,
                'reason': 'Metrics within acceptable ranges',
                'current_containers': active_containers,
                'target_containers': active_containers
            }
    
    def _is_in_cooldown(self) -> bool:
        """Check if we're in the cooldown period after the last scaling action."""
        if not self.last_scaling_time:
            return False
        
        elapsed = time.time() - self.last_scaling_time
        return elapsed < self.thresholds.scale_cooldown_seconds
    
    async def _execute_scaling_action(self, decision: Dict[str, Any], metrics: Dict[str, Any]) -> None:
        """Execute the scaling action."""
        action = decision['action']
        current_containers = decision['current_containers']
        target_containers = decision['target_containers']
        
        try:
            execution_engine = get_execution_engine()
            
            if action == ScalingAction.SCALE_UP:
                # Increase max concurrent containers
                execution_engine.resource_pool.max_concurrent = target_containers
                self.logger.info("Scaled up container capacity", 
                               from_containers=current_containers,
                               to_containers=target_containers,
                               reason=decision['reason'])
            
            elif action == ScalingAction.SCALE_DOWN:
                # Decrease max concurrent containers (gracefully)
                execution_engine.resource_pool.max_concurrent = target_containers
                self.logger.info("Scaled down container capacity", 
                               from_containers=current_containers,
                               to_containers=target_containers,
                               reason=decision['reason'])
            
            # Record scaling action
            self.last_scaling_action = action
            self.last_scaling_time = time.time()
            
            # Add to scaling history
            scaling_event = {
                'timestamp': datetime.utcnow().isoformat(),
                'action': action.value,
                'reason': decision['reason'],
                'from_containers': current_containers,
                'to_containers': target_containers,
                'metrics': metrics
            }
            
            self.scaling_history.append(scaling_event)
            
            # Keep only last 100 scaling events
            if len(self.scaling_history) > 100:
                self.scaling_history = self.scaling_history[-100:]
            
            # Store scaling event in Redis for monitoring
            redis_client = await get_redis()
            scaling_key = f"scaling_events:{datetime.utcnow().strftime('%Y-%m-%d')}"
            await redis_client.lpush(scaling_key, str(scaling_event))
            await redis_client.expire(scaling_key, 86400 * 7)  # Keep for 7 days
            
        except Exception as e:
            self.logger.error("Failed to execute scaling action", 
                            action=action.value, 
                            error=str(e))
    
    async def _cache_metrics(self, metrics: Dict[str, Any], decision: Dict[str, Any]) -> None:
        """Cache metrics and scaling decisions for monitoring dashboard."""
        try:
            # Cache current metrics
            await CacheManager.set_cache("system_metrics:current", metrics, ttl=300)
            
            # Cache scaling decision
            await CacheManager.set_cache("scaling_decision:current", decision, ttl=300)
            
            # Store historical metrics (last 24 hours)
            redis_client = await get_redis()
            metrics_key = f"metrics_history:{datetime.utcnow().strftime('%Y-%m-%d-%H')}"
            await redis_client.lpush(metrics_key, str(metrics))
            await redis_client.expire(metrics_key, 86400)  # Keep for 24 hours
            
        except Exception as e:
            self.logger.error("Failed to cache metrics", error=str(e))
    
    async def get_scaling_status(self) -> Dict[str, Any]:
        """Get current auto-scaling status and configuration."""
        return {
            'is_running': self.is_running,
            'monitoring_interval': self.monitoring_interval,
            'last_scaling_action': self.last_scaling_action.value if self.last_scaling_action else None,
            'last_scaling_time': self.last_scaling_time,
            'cooldown_remaining': max(0, self.thresholds.scale_cooldown_seconds - (time.time() - (self.last_scaling_time or 0))),
            'thresholds': {
                'cpu_scale_up': self.thresholds.cpu_scale_up_threshold,
                'cpu_scale_down': self.thresholds.cpu_scale_down_threshold,
                'memory_scale_up': self.thresholds.memory_scale_up_threshold,
                'memory_scale_down': self.thresholds.memory_scale_down_threshold,
                'queue_scale_up': self.thresholds.queue_scale_up_threshold,
                'min_containers': self.thresholds.min_containers,
                'max_containers': self.thresholds.max_containers,
                'cooldown_seconds': self.thresholds.scale_cooldown_seconds
            },
            'scaling_history_count': len(self.scaling_history)
        }
    
    async def get_scaling_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent scaling history."""
        return self.scaling_history[-limit:] if self.scaling_history else []
    
    async def update_thresholds(self, new_thresholds: Dict[str, Any]) -> bool:
        """Update auto-scaling thresholds."""
        try:
            if 'cpu_scale_up' in new_thresholds:
                self.thresholds.cpu_scale_up_threshold = new_thresholds['cpu_scale_up']
            if 'cpu_scale_down' in new_thresholds:
                self.thresholds.cpu_scale_down_threshold = new_thresholds['cpu_scale_down']
            if 'memory_scale_up' in new_thresholds:
                self.thresholds.memory_scale_up_threshold = new_thresholds['memory_scale_up']
            if 'memory_scale_down' in new_thresholds:
                self.thresholds.memory_scale_down_threshold = new_thresholds['memory_scale_down']
            if 'queue_scale_up' in new_thresholds:
                self.thresholds.queue_scale_up_threshold = new_thresholds['queue_scale_up']
            if 'min_containers' in new_thresholds:
                self.thresholds.min_containers = new_thresholds['min_containers']
            if 'max_containers' in new_thresholds:
                self.thresholds.max_containers = new_thresholds['max_containers']
            if 'cooldown_seconds' in new_thresholds:
                self.thresholds.scale_cooldown_seconds = new_thresholds['cooldown_seconds']
            
            self.logger.info("Auto-scaling thresholds updated", thresholds=new_thresholds)
            return True
            
        except Exception as e:
            self.logger.error("Failed to update thresholds", error=str(e))
            return False


class GracefulDegradationManager:
    """Manages graceful degradation when system resources are under pressure."""
    
    def __init__(self):
        self.logger = logger.bind(component="graceful_degradation")
        self.degradation_active = False
        self.degradation_level = 0  # 0 = normal, 1 = light, 2 = moderate, 3 = severe
        self.degradation_start_time = None
        
    async def check_degradation_needed(self, metrics: Dict[str, Any]) -> bool:
        """Check if graceful degradation is needed based on system metrics."""
        system = metrics.get('system', {})
        app = metrics.get('application', {})
        
        cpu_percent = system.get('cpu_percent', 0)
        memory_percent = system.get('memory_percent', 0)
        queue_length = app.get('queue_length', 0)
        
        # Determine degradation level
        new_level = 0
        
        if cpu_percent > 95 or memory_percent > 95:
            new_level = 3  # Severe
        elif cpu_percent > 90 or memory_percent > 90 or queue_length > 20:
            new_level = 2  # Moderate
        elif cpu_percent > 85 or memory_percent > 85 or queue_length > 10:
            new_level = 1  # Light
        
        # Update degradation state
        if new_level > self.degradation_level:
            await self._activate_degradation(new_level, metrics)
        elif new_level < self.degradation_level:
            await self._reduce_degradation(new_level, metrics)
        
        return self.degradation_active
    
    async def _activate_degradation(self, level: int, metrics: Dict[str, Any]) -> None:
        """Activate graceful degradation at the specified level."""
        self.degradation_level = level
        self.degradation_active = level > 0
        
        if not self.degradation_start_time:
            self.degradation_start_time = datetime.utcnow()
        
        degradation_actions = {
            1: "Light degradation: Increased cache TTL, reduced AI request frequency",
            2: "Moderate degradation: Queue prioritization, limited concurrent executions",
            3: "Severe degradation: Emergency mode, minimal service availability"
        }
        
        self.logger.warning("Graceful degradation activated", 
                          level=level,
                          actions=degradation_actions.get(level, "Unknown"),
                          metrics=metrics)
        
        # Apply degradation measures
        await self._apply_degradation_measures(level)
    
    async def _reduce_degradation(self, level: int, metrics: Dict[str, Any]) -> None:
        """Reduce graceful degradation level."""
        old_level = self.degradation_level
        self.degradation_level = level
        self.degradation_active = level > 0
        
        if level == 0:
            self.degradation_start_time = None
        
        self.logger.info("Graceful degradation reduced", 
                        from_level=old_level,
                        to_level=level,
                        metrics=metrics)
        
        # Apply new degradation measures
        await self._apply_degradation_measures(level)
    
    async def _apply_degradation_measures(self, level: int) -> None:
        """Apply specific degradation measures based on level."""
        try:
            if level >= 1:
                # Light degradation: Increase cache TTL
                await self._adjust_cache_settings(ttl_multiplier=2.0)
            
            if level >= 2:
                # Moderate degradation: Reduce concurrent executions
                execution_engine = get_execution_engine()
                current_max = execution_engine.resource_pool.max_concurrent
                execution_engine.resource_pool.max_concurrent = max(1, current_max // 2)
            
            if level >= 3:
                # Severe degradation: Emergency mode
                execution_engine = get_execution_engine()
                execution_engine.resource_pool.max_concurrent = 1
                
                # Pause non-critical background tasks
                await execution_engine.stop_job_queue_processor()
            
            if level == 0:
                # Recovery: Restore normal operations
                await self._restore_normal_operations()
                
        except Exception as e:
            self.logger.error("Failed to apply degradation measures", level=level, error=str(e))
    
    async def _adjust_cache_settings(self, ttl_multiplier: float) -> None:
        """Adjust cache TTL settings for degradation."""
        # This would adjust cache settings in the application
        # For now, we'll just log the action
        self.logger.info("Cache TTL adjusted for degradation", multiplier=ttl_multiplier)
    
    async def _restore_normal_operations(self) -> None:
        """Restore normal operations after degradation recovery."""
        try:
            # Restore normal container limits
            execution_engine = get_execution_engine()
            execution_engine.resource_pool.max_concurrent = 5  # Default value
            
            # Restart background tasks
            await execution_engine.start_job_queue_processor()
            
            self.logger.info("Normal operations restored after degradation")
            
        except Exception as e:
            self.logger.error("Failed to restore normal operations", error=str(e))
    
    def get_degradation_status(self) -> Dict[str, Any]:
        """Get current degradation status."""
        return {
            'active': self.degradation_active,
            'level': self.degradation_level,
            'start_time': self.degradation_start_time.isoformat() if self.degradation_start_time else None,
            'duration_seconds': (datetime.utcnow() - self.degradation_start_time).total_seconds() if self.degradation_start_time else 0,
            'level_descriptions': {
                0: "Normal operations",
                1: "Light degradation - Optimized caching",
                2: "Moderate degradation - Reduced concurrency",
                3: "Severe degradation - Emergency mode"
            }
        }


# Global instances
_auto_scaler = None
_degradation_manager = None


def get_auto_scaler() -> AutoScaler:
    """Get the global auto-scaler instance."""
    global _auto_scaler
    if _auto_scaler is None:
        _auto_scaler = AutoScaler()
    return _auto_scaler


def get_degradation_manager() -> GracefulDegradationManager:
    """Get the global degradation manager instance."""
    global _degradation_manager
    if _degradation_manager is None:
        _degradation_manager = GracefulDegradationManager()
    return _degradation_manager


class ScalabilityService:
    """Service wrapper for auto-scaling and resource management."""
    
    def __init__(self):
        self.logger = logger.bind(service="scalability_service")
        self.auto_scaler = get_auto_scaler()
        self.degradation_manager = get_degradation_manager()
    
    async def start_auto_scaling(self) -> bool:
        """Start auto-scaling monitoring."""
        try:
            await self.auto_scaler.start_monitoring()
            self.logger.info("Auto-scaling service started")
            return True
        except Exception as e:
            self.logger.error("Failed to start auto-scaling", error=str(e))
            return False
    
    async def stop_auto_scaling(self) -> bool:
        """Stop auto-scaling monitoring."""
        try:
            await self.auto_scaler.stop_monitoring()
            self.logger.info("Auto-scaling service stopped")
            return True
        except Exception as e:
            self.logger.error("Failed to stop auto-scaling", error=str(e))
            return False
    
    async def get_system_status(self) -> Dict[str, Any]:
        """Get comprehensive system status including scaling and degradation."""
        try:
            # Get current metrics
            metrics = await self.auto_scaler._collect_metrics()
            
            # Check degradation status
            await self.degradation_manager.check_degradation_needed(metrics)
            
            # Get scaling status
            scaling_status = await self.auto_scaler.get_scaling_status()
            degradation_status = self.degradation_manager.get_degradation_status()
            
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'metrics': metrics,
                'auto_scaling': scaling_status,
                'graceful_degradation': degradation_status,
                'overall_health': self._calculate_health_score(metrics, degradation_status)
            }
            
        except Exception as e:
            self.logger.error("Failed to get system status", error=str(e))
            return {
                'timestamp': datetime.utcnow().isoformat(),
                'error': str(e),
                'overall_health': 0.0
            }
    
    def _calculate_health_score(self, metrics: Dict[str, Any], degradation_status: Dict[str, Any]) -> float:
        """Calculate overall system health score (0.0 to 1.0)."""
        try:
            system = metrics.get('system', {})
            app = metrics.get('application', {})
            
            # Base score from resource utilization
            cpu_score = max(0, 1.0 - (system.get('cpu_percent', 0) / 100.0))
            memory_score = max(0, 1.0 - (system.get('memory_percent', 0) / 100.0))
            
            # Queue health score
            queue_length = app.get('queue_length', 0)
            queue_score = max(0, 1.0 - (queue_length / 20.0))  # Assume 20+ is unhealthy
            
            # Degradation penalty
            degradation_penalty = degradation_status.get('level', 0) * 0.2
            
            # Calculate weighted average
            health_score = (cpu_score * 0.3 + memory_score * 0.3 + queue_score * 0.4) - degradation_penalty
            
            return max(0.0, min(1.0, health_score))
            
        except Exception:
            return 0.5  # Default to neutral health on error
    
    async def update_scaling_thresholds(self, thresholds: Dict[str, Any]) -> bool:
        """Update auto-scaling thresholds."""
        return await self.auto_scaler.update_thresholds(thresholds)
    
    async def get_scaling_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent scaling history."""
        return await self.auto_scaler.get_scaling_history(limit)
    
    async def force_scaling_action(self, action: str, reason: str = "Manual override") -> bool:
        """Force a scaling action (for testing or emergency situations)."""
        try:
            if action not in ['scale_up', 'scale_down']:
                return False
            
            execution_engine = get_execution_engine()
            current_max = execution_engine.resource_pool.max_concurrent
            
            if action == 'scale_up' and current_max < self.auto_scaler.thresholds.max_containers:
                execution_engine.resource_pool.max_concurrent = current_max + 1
                self.logger.info("Forced scale up", from_containers=current_max, to_containers=current_max + 1, reason=reason)
                return True
            elif action == 'scale_down' and current_max > self.auto_scaler.thresholds.min_containers:
                execution_engine.resource_pool.max_concurrent = current_max - 1
                self.logger.info("Forced scale down", from_containers=current_max, to_containers=current_max - 1, reason=reason)
                return True
            
            return False
            
        except Exception as e:
            self.logger.error("Failed to force scaling action", action=action, error=str(e))
            return False