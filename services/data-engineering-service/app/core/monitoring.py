"""
Comprehensive monitoring and alerting system.
Provides metrics collection, health monitoring, and alerting capabilities.
"""

import structlog
import asyncio
import time
from typing import Dict, Any, List, Optional, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import json

from app.core.redis_client import get_redis
from app.core.config import settings

logger = structlog.get_logger()


class MetricType(Enum):
    """Types of metrics for classification."""
    COUNTER = "counter"
    GAUGE = "gauge"
    HISTOGRAM = "histogram"
    TIMER = "timer"


class AlertLevel(Enum):
    """Alert severity levels."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class Metric:
    """Represents a system metric."""
    name: str
    value: float
    metric_type: MetricType
    timestamp: datetime = field(default_factory=datetime.utcnow)
    labels: Dict[str, str] = field(default_factory=dict)
    description: Optional[str] = None


@dataclass
class Alert:
    """Represents a system alert."""
    id: str
    level: AlertLevel
    title: str
    message: str
    timestamp: datetime = field(default_factory=datetime.utcnow)
    source: str = "system"
    metadata: Dict[str, Any] = field(default_factory=dict)
    resolved: bool = False
    resolved_at: Optional[datetime] = None


class MonitoringSystem:
    """Central monitoring and alerting system."""
    
    def __init__(self):
        self._redis = None
        self._metrics_buffer = []
        self._alert_rules = []
        self._health_checks = {}
        self._running = False
    
    async def _get_redis(self):
        """Get Redis client for metrics storage."""
        if not self._redis:
            self._redis = await get_redis()
        return self._redis
    
    async def start(self):
        """Start the monitoring system."""
        if self._running:
            return
        
        self._running = True
        logger.info("Starting monitoring system")
        
        # Start background tasks
        asyncio.create_task(self._metrics_collector())
        asyncio.create_task(self._health_monitor())
        asyncio.create_task(self._alert_processor())
    
    async def stop(self):
        """Stop the monitoring system."""
        self._running = False
        logger.info("Stopping monitoring system")
    
    async def record_metric(
        self,
        name: str,
        value: float,
        metric_type: MetricType = MetricType.GAUGE,
        labels: Optional[Dict[str, str]] = None,
        description: Optional[str] = None
    ):
        """Record a metric value."""
        metric = Metric(
            name=name,
            value=value,
            metric_type=metric_type,
            labels=labels or {},
            description=description
        )
        
        self._metrics_buffer.append(metric)
        
        # Also store immediately for real-time access
        await self._store_metric(metric)
    
    async def _store_metric(self, metric: Metric):
        """Store metric in Redis."""
        try:
            redis_client = await self._get_redis()
            
            # Store current value
            metric_key = f"metric:{metric.name}"
            if metric.labels:
                label_str = ",".join(f"{k}={v}" for k, v in metric.labels.items())
                metric_key = f"{metric_key}:{label_str}"
            
            metric_data = {
                "value": metric.value,
                "type": metric.metric_type.value,
                "timestamp": metric.timestamp.isoformat(),
                "labels": json.dumps(metric.labels),
                "description": metric.description or ""
            }
            
            await redis_client.hset(metric_key, mapping=metric_data)
            await redis_client.expire(metric_key, 86400)  # 24 hours
            
            # Store in time series for historical data
            ts_key = f"timeseries:{metric.name}"
            ts_data = {
                "timestamp": int(metric.timestamp.timestamp()),
                "value": metric.value
            }
            
            await redis_client.zadd(ts_key, {json.dumps(ts_data): int(metric.timestamp.timestamp())})
            await redis_client.expire(ts_key, 604800)  # 7 days
            
            # Keep only recent data (last 1000 points)
            await redis_client.zremrangebyrank(ts_key, 0, -1001)
            
        except Exception as e:
            logger.error("Failed to store metric", error=str(e), metric_name=metric.name)
    
    async def get_metric(self, name: str, labels: Optional[Dict[str, str]] = None) -> Optional[Metric]:
        """Get current value of a metric."""
        try:
            redis_client = await self._get_redis()
            
            metric_key = f"metric:{name}"
            if labels:
                label_str = ",".join(f"{k}={v}" for k, v in labels.items())
                metric_key = f"{metric_key}:{label_str}"
            
            metric_data = await redis_client.hgetall(metric_key)
            if not metric_data:
                return None
            
            return Metric(
                name=name,
                value=float(metric_data["value"]),
                metric_type=MetricType(metric_data["type"]),
                timestamp=datetime.fromisoformat(metric_data["timestamp"]),
                labels=json.loads(metric_data["labels"]),
                description=metric_data["description"] or None
            )
            
        except Exception as e:
            logger.error("Failed to get metric", error=str(e), metric_name=name)
            return None
    
    async def get_metric_history(
        self,
        name: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get historical data for a metric."""
        try:
            redis_client = await self._get_redis()
            
            ts_key = f"timeseries:{name}"
            
            # Set default time range
            if not end_time:
                end_time = datetime.utcnow()
            if not start_time:
                start_time = end_time - timedelta(hours=24)
            
            start_ts = int(start_time.timestamp())
            end_ts = int(end_time.timestamp())
            
            # Get data from time series
            data = await redis_client.zrangebyscore(
                ts_key,
                start_ts,
                end_ts,
                withscores=True
            )
            
            # Parse and return data
            history = []
            for item, score in data[-limit:]:  # Get last N items
                try:
                    point = json.loads(item)
                    history.append(point)
                except json.JSONDecodeError:
                    continue
            
            return history
            
        except Exception as e:
            logger.error("Failed to get metric history", error=str(e), metric_name=name)
            return []
    
    async def create_alert(
        self,
        level: AlertLevel,
        title: str,
        message: str,
        source: str = "system",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Alert:
        """Create and store an alert."""
        import uuid
        
        alert = Alert(
            id=str(uuid.uuid4()),
            level=level,
            title=title,
            message=message,
            source=source,
            metadata=metadata or {}
        )
        
        await self._store_alert(alert)
        
        # Log the alert
        log_data = {
            "alert_id": alert.id,
            "level": alert.level.value,
            "title": alert.title,
            "message": alert.message,
            "source": alert.source
        }
        
        if alert.level == AlertLevel.CRITICAL:
            logger.critical("CRITICAL ALERT", **log_data)
        elif alert.level == AlertLevel.ERROR:
            logger.error("ERROR ALERT", **log_data)
        elif alert.level == AlertLevel.WARNING:
            logger.warning("WARNING ALERT", **log_data)
        else:
            logger.info("INFO ALERT", **log_data)
        
        return alert
    
    async def _store_alert(self, alert: Alert):
        """Store alert in Redis."""
        try:
            redis_client = await self._get_redis()
            
            alert_key = f"alert:{alert.id}"
            alert_data = {
                "id": alert.id,
                "level": alert.level.value,
                "title": alert.title,
                "message": alert.message,
                "timestamp": alert.timestamp.isoformat(),
                "source": alert.source,
                "metadata": json.dumps(alert.metadata),
                "resolved": str(alert.resolved),
                "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else ""
            }
            
            await redis_client.hset(alert_key, mapping=alert_data)
            await redis_client.expire(alert_key, 604800)  # 7 days
            
            # Add to alerts list
            alerts_key = f"alerts:{alert.level.value}"
            await redis_client.zadd(
                alerts_key,
                {alert.id: int(alert.timestamp.timestamp())}
            )
            await redis_client.expire(alerts_key, 604800)
            
        except Exception as e:
            logger.error("Failed to store alert", error=str(e), alert_id=alert.id)
    
    async def get_alerts(
        self,
        level: Optional[AlertLevel] = None,
        limit: int = 50,
        resolved: Optional[bool] = None
    ) -> List[Alert]:
        """Get alerts with optional filtering."""
        try:
            redis_client = await self._get_redis()
            
            alerts = []
            
            if level:
                levels = [level]
            else:
                levels = list(AlertLevel)
            
            for alert_level in levels:
                alerts_key = f"alerts:{alert_level.value}"
                alert_ids = await redis_client.zrevrange(alerts_key, 0, limit - 1)
                
                for alert_id in alert_ids:
                    alert_key = f"alert:{alert_id}"
                    alert_data = await redis_client.hgetall(alert_key)
                    
                    if not alert_data:
                        continue
                    
                    alert = Alert(
                        id=alert_data["id"],
                        level=AlertLevel(alert_data["level"]),
                        title=alert_data["title"],
                        message=alert_data["message"],
                        timestamp=datetime.fromisoformat(alert_data["timestamp"]),
                        source=alert_data["source"],
                        metadata=json.loads(alert_data["metadata"]),
                        resolved=alert_data["resolved"] == "True",
                        resolved_at=datetime.fromisoformat(alert_data["resolved_at"]) if alert_data["resolved_at"] else None
                    )
                    
                    # Filter by resolved status if specified
                    if resolved is not None and alert.resolved != resolved:
                        continue
                    
                    alerts.append(alert)
            
            # Sort by timestamp (newest first)
            alerts.sort(key=lambda x: x.timestamp, reverse=True)
            
            return alerts[:limit]
            
        except Exception as e:
            logger.error("Failed to get alerts", error=str(e))
            return []
    
    def register_health_check(self, name: str, check_func: Callable[[], bool]):
        """Register a health check function."""
        self._health_checks[name] = check_func
    
    async def _metrics_collector(self):
        """Background task to collect and process metrics."""
        while self._running:
            try:
                # Collect system metrics
                await self._collect_system_metrics()
                
                # Process buffered metrics
                if self._metrics_buffer:
                    metrics_to_process = self._metrics_buffer.copy()
                    self._metrics_buffer.clear()
                    
                    for metric in metrics_to_process:
                        await self._store_metric(metric)
                
                await asyncio.sleep(30)  # Collect every 30 seconds
                
            except Exception as e:
                logger.error("Metrics collection failed", error=str(e))
                await asyncio.sleep(60)  # Wait longer on error
    
    async def _collect_system_metrics(self):
        """Collect system-level metrics."""
        try:
            import psutil
            
            # CPU usage
            cpu_percent = psutil.cpu_percent(interval=1)
            await self.record_metric("system.cpu.usage", cpu_percent, MetricType.GAUGE)
            
            # Memory usage
            memory = psutil.virtual_memory()
            await self.record_metric("system.memory.usage", memory.percent, MetricType.GAUGE)
            await self.record_metric("system.memory.available", memory.available, MetricType.GAUGE)
            
            # Disk usage
            disk = psutil.disk_usage('/')
            await self.record_metric("system.disk.usage", disk.percent, MetricType.GAUGE)
            await self.record_metric("system.disk.free", disk.free, MetricType.GAUGE)
            
        except ImportError:
            # psutil not available, skip system metrics
            pass
        except Exception as e:
            logger.error("Failed to collect system metrics", error=str(e))
    
    async def _health_monitor(self):
        """Background task to monitor system health."""
        while self._running:
            try:
                health_status = await self._check_system_health()
                
                # Record health metrics
                await self.record_metric("system.health.overall", 1 if health_status["healthy"] else 0, MetricType.GAUGE)
                
                # Create alerts for unhealthy components
                for component, status in health_status["components"].items():
                    if not status.get("healthy", True):
                        await self.create_alert(
                            level=AlertLevel.ERROR,
                            title=f"Component Health Alert: {component}",
                            message=f"Component {component} is unhealthy: {status.get('error', 'Unknown error')}",
                            source="health_monitor",
                            metadata={"component": component, "status": status}
                        )
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                logger.error("Health monitoring failed", error=str(e))
                await asyncio.sleep(120)  # Wait longer on error
    
    async def _check_system_health(self) -> Dict[str, Any]:
        """Check overall system health."""
        health_status = {
            "healthy": True,
            "components": {},
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Run registered health checks
        for name, check_func in self._health_checks.items():
            try:
                is_healthy = await check_func() if asyncio.iscoroutinefunction(check_func) else check_func()
                health_status["components"][name] = {"healthy": is_healthy}
                
                if not is_healthy:
                    health_status["healthy"] = False
                    
            except Exception as e:
                health_status["components"][name] = {
                    "healthy": False,
                    "error": str(e)
                }
                health_status["healthy"] = False
        
        return health_status
    
    async def _alert_processor(self):
        """Background task to process and manage alerts."""
        while self._running:
            try:
                # Auto-resolve old alerts
                await self._auto_resolve_alerts()
                
                # Check alert rules
                await self._check_alert_rules()
                
                await asyncio.sleep(60)  # Process every minute
                
            except Exception as e:
                logger.error("Alert processing failed", error=str(e))
                await asyncio.sleep(120)
    
    async def _auto_resolve_alerts(self):
        """Automatically resolve old alerts."""
        try:
            # Get unresolved alerts older than 1 hour
            cutoff_time = datetime.utcnow() - timedelta(hours=1)
            
            for level in AlertLevel:
                alerts = await self.get_alerts(level=level, resolved=False)
                
                for alert in alerts:
                    if alert.timestamp < cutoff_time and alert.level in [AlertLevel.INFO, AlertLevel.WARNING]:
                        await self._resolve_alert(alert.id)
                        
        except Exception as e:
            logger.error("Failed to auto-resolve alerts", error=str(e))
    
    async def _resolve_alert(self, alert_id: str):
        """Mark an alert as resolved."""
        try:
            redis_client = await self._get_redis()
            
            alert_key = f"alert:{alert_id}"
            await redis_client.hset(alert_key, "resolved", "True")
            await redis_client.hset(alert_key, "resolved_at", datetime.utcnow().isoformat())
            
        except Exception as e:
            logger.error("Failed to resolve alert", error=str(e), alert_id=alert_id)
    
    async def _check_alert_rules(self):
        """Check configured alert rules against current metrics."""
        # This would implement custom alert rules based on metrics
        # For now, we'll implement basic threshold alerts
        
        try:
            # Check error rate
            error_metric = await self.get_metric("errors.total")
            if error_metric and error_metric.value > 10:
                await self.create_alert(
                    level=AlertLevel.WARNING,
                    title="High Error Rate",
                    message=f"Error rate is {error_metric.value} errors in the last hour",
                    source="alert_rules"
                )
            
            # Check system resources
            cpu_metric = await self.get_metric("system.cpu.usage")
            if cpu_metric and cpu_metric.value > 90:
                await self.create_alert(
                    level=AlertLevel.ERROR,
                    title="High CPU Usage",
                    message=f"CPU usage is {cpu_metric.value}%",
                    source="alert_rules"
                )
            
            memory_metric = await self.get_metric("system.memory.usage")
            if memory_metric and memory_metric.value > 90:
                await self.create_alert(
                    level=AlertLevel.ERROR,
                    title="High Memory Usage",
                    message=f"Memory usage is {memory_metric.value}%",
                    source="alert_rules"
                )
                
        except Exception as e:
            logger.error("Failed to check alert rules", error=str(e))
    
    async def get_dashboard_data(self) -> Dict[str, Any]:
        """Get monitoring dashboard data."""
        try:
            # Get key metrics
            metrics = {}
            key_metric_names = [
                "system.cpu.usage",
                "system.memory.usage",
                "system.disk.usage",
                "errors.total",
                "requests.total",
                "response.time.avg"
            ]
            
            for metric_name in key_metric_names:
                metric = await self.get_metric(metric_name)
                if metric:
                    metrics[metric_name] = {
                        "value": metric.value,
                        "timestamp": metric.timestamp.isoformat()
                    }
            
            # Get recent alerts
            recent_alerts = await self.get_alerts(limit=10)
            
            # Get system health
            health_status = await self._check_system_health()
            
            return {
                "metrics": metrics,
                "alerts": [
                    {
                        "id": alert.id,
                        "level": alert.level.value,
                        "title": alert.title,
                        "message": alert.message,
                        "timestamp": alert.timestamp.isoformat(),
                        "resolved": alert.resolved
                    }
                    for alert in recent_alerts
                ],
                "health": health_status,
                "timestamp": datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            logger.error("Failed to get dashboard data", error=str(e))
            return {}


# Global monitoring system instance
_monitoring_system: Optional[MonitoringSystem] = None


def get_monitoring_system() -> MonitoringSystem:
    """Get the global monitoring system instance."""
    global _monitoring_system
    if not _monitoring_system:
        _monitoring_system = MonitoringSystem()
    return _monitoring_system


# Convenience functions
async def record_metric(name: str, value: float, metric_type: MetricType = MetricType.GAUGE, **kwargs):
    """Convenience function to record a metric."""
    monitoring = get_monitoring_system()
    await monitoring.record_metric(name, value, metric_type, **kwargs)


async def create_alert(level: AlertLevel, title: str, message: str, **kwargs) -> Alert:
    """Convenience function to create an alert."""
    monitoring = get_monitoring_system()
    return await monitoring.create_alert(level, title, message, **kwargs)


async def get_system_status() -> Dict[str, Any]:
    """Get comprehensive system status."""
    monitoring = get_monitoring_system()
    return await monitoring.get_dashboard_data()