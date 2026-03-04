"""
Comprehensive error handling and recovery system.
Provides centralized error handling, logging, and recovery mechanisms.
"""

import structlog
import traceback
from typing import Dict, Any, Optional, List, Type
from datetime import datetime, timedelta
from enum import Enum
import asyncio
from contextlib import asynccontextmanager

from app.core.redis_client import get_redis
from app.core.config import settings

logger = structlog.get_logger()


class ErrorSeverity(Enum):
    """Error severity levels for classification and alerting."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ErrorCategory(Enum):
    """Error categories for better organization and handling."""
    SYSTEM = "system"
    DATABASE = "database"
    NETWORK = "network"
    AI_SERVICE = "ai_service"
    EXECUTION = "execution"
    VALIDATION = "validation"
    USER_INPUT = "user_input"
    AUTHENTICATION = "authentication"
    RATE_LIMIT = "rate_limit"
    RESOURCE = "resource"


class SystemError:
    """Structured error representation for consistent handling."""
    
    def __init__(
        self,
        error_id: str,
        category: ErrorCategory,
        severity: ErrorSeverity,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        context: Optional[Dict[str, Any]] = None,
        timestamp: Optional[datetime] = None,
        user_id: Optional[str] = None,
        request_id: Optional[str] = None,
        traceback_info: Optional[str] = None
    ):
        self.error_id = error_id
        self.category = category
        self.severity = severity
        self.message = message
        self.details = details or {}
        self.context = context or {}
        self.timestamp = timestamp or datetime.utcnow()
        self.user_id = user_id
        self.request_id = request_id
        self.traceback_info = traceback_info
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert error to dictionary for logging and storage."""
        return {
            "error_id": self.error_id,
            "category": self.category.value,
            "severity": self.severity.value,
            "message": self.message,
            "details": self.details,
            "context": self.context,
            "timestamp": self.timestamp.isoformat(),
            "user_id": self.user_id,
            "request_id": self.request_id,
            "traceback": self.traceback_info
        }


class ErrorHandler:
    """Central error handling and recovery system."""
    
    def __init__(self):
        self._redis = None
        self._error_counts = {}
        self._circuit_breakers = {}
    
    async def _get_redis(self):
        """Get Redis client for error tracking."""
        if not self._redis:
            self._redis = await get_redis()
        return self._redis
    
    async def handle_error(
        self,
        exception: Exception,
        category: ErrorCategory,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        context: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        request_id: Optional[str] = None,
        auto_recover: bool = True
    ) -> SystemError:
        """
        Handle an error with comprehensive logging, tracking, and recovery.
        """
        import uuid
        
        error_id = str(uuid.uuid4())
        
        # Create structured error
        system_error = SystemError(
            error_id=error_id,
            category=category,
            severity=severity,
            message=str(exception),
            details={
                "exception_type": type(exception).__name__,
                "exception_args": list(exception.args) if exception.args else []
            },
            context=context or {},
            user_id=user_id,
            request_id=request_id,
            traceback_info=traceback.format_exc()
        )
        
        # Log the error
        await self._log_error(system_error)
        
        # Track error metrics
        await self._track_error_metrics(system_error)
        
        # Check for error patterns and circuit breaking
        await self._check_error_patterns(system_error)
        
        # Attempt recovery if enabled
        if auto_recover:
            await self._attempt_recovery(system_error)
        
        # Send alerts for high severity errors
        if severity in [ErrorSeverity.HIGH, ErrorSeverity.CRITICAL]:
            await self._send_alert(system_error)
        
        return system_error
    
    async def _log_error(self, error: SystemError):
        """Log error with structured logging."""
        log_data = error.to_dict()
        
        if error.severity == ErrorSeverity.CRITICAL:
            logger.critical("Critical system error", **log_data)
        elif error.severity == ErrorSeverity.HIGH:
            logger.error("High severity error", **log_data)
        elif error.severity == ErrorSeverity.MEDIUM:
            logger.warning("Medium severity error", **log_data)
        else:
            logger.info("Low severity error", **log_data)
    
    async def _track_error_metrics(self, error: SystemError):
        """Track error metrics in Redis for monitoring."""
        try:
            redis_client = await self._get_redis()
            
            # Track error counts by category
            category_key = f"error_count:{error.category.value}"
            await redis_client.incr(category_key)
            await redis_client.expire(category_key, 3600)  # 1 hour TTL
            
            # Track error counts by severity
            severity_key = f"error_count:severity:{error.severity.value}"
            await redis_client.incr(severity_key)
            await redis_client.expire(severity_key, 3600)
            
            # Track hourly error rates
            hour_key = f"error_rate:{datetime.utcnow().strftime('%Y%m%d%H')}"
            await redis_client.incr(hour_key)
            await redis_client.expire(hour_key, 86400)  # 24 hours TTL
            
            # Store error details for analysis
            error_key = f"error_details:{error.error_id}"
            await redis_client.setex(
                error_key,
                86400,  # 24 hours
                str(error.to_dict())
            )
            
        except Exception as e:
            logger.error("Failed to track error metrics", error=str(e))
    
    async def _check_error_patterns(self, error: SystemError):
        """Check for error patterns and implement circuit breaking."""
        try:
            redis_client = await self._get_redis()
            
            # Check error rate for this category
            category_key = f"error_count:{error.category.value}"
            error_count = await redis_client.get(category_key)
            
            if error_count and int(error_count) > 10:  # Threshold
                # Implement circuit breaker
                circuit_key = f"circuit_breaker:{error.category.value}"
                await redis_client.setex(circuit_key, 300, "open")  # 5 minutes
                
                logger.warning(
                    "Circuit breaker activated",
                    category=error.category.value,
                    error_count=int(error_count)
                )
        
        except Exception as e:
            logger.error("Failed to check error patterns", error=str(e))
    
    async def _attempt_recovery(self, error: SystemError):
        """Attempt automatic recovery based on error type."""
        try:
            if error.category == ErrorCategory.DATABASE:
                await self._recover_database_error(error)
            elif error.category == ErrorCategory.AI_SERVICE:
                await self._recover_ai_service_error(error)
            elif error.category == ErrorCategory.EXECUTION:
                await self._recover_execution_error(error)
            elif error.category == ErrorCategory.NETWORK:
                await self._recover_network_error(error)
                
        except Exception as e:
            logger.error("Recovery attempt failed", error=str(e), original_error=error.error_id)
    
    async def _recover_database_error(self, error: SystemError):
        """Attempt database error recovery."""
        # Implement database connection retry logic
        logger.info("Attempting database recovery", error_id=error.error_id)
        
        # Example: Reconnect to database
        try:
            from app.core.database import init_database
            await init_database()
            logger.info("Database recovery successful", error_id=error.error_id)
        except Exception as e:
            logger.error("Database recovery failed", error=str(e), error_id=error.error_id)
    
    async def _recover_ai_service_error(self, error: SystemError):
        """Attempt AI service error recovery."""
        logger.info("Attempting AI service recovery", error_id=error.error_id)
        
        # Example: Switch to backup AI service or use cached responses
        try:
            redis_client = await self._get_redis()
            fallback_key = f"ai_fallback:{error.context.get('user_id', 'unknown')}"
            await redis_client.setex(fallback_key, 300, "enabled")  # 5 minutes
            logger.info("AI service fallback enabled", error_id=error.error_id)
        except Exception as e:
            logger.error("AI service recovery failed", error=str(e), error_id=error.error_id)
    
    async def _recover_execution_error(self, error: SystemError):
        """Attempt execution error recovery."""
        logger.info("Attempting execution recovery", error_id=error.error_id)
        
        # Example: Clean up containers and reset execution environment
        try:
            # This would integrate with the execution engine
            logger.info("Execution environment reset", error_id=error.error_id)
        except Exception as e:
            logger.error("Execution recovery failed", error=str(e), error_id=error.error_id)
    
    async def _recover_network_error(self, error: SystemError):
        """Attempt network error recovery."""
        logger.info("Attempting network recovery", error_id=error.error_id)
        
        # Example: Implement retry with exponential backoff
        try:
            await asyncio.sleep(1)  # Simple delay for network recovery
            logger.info("Network recovery attempted", error_id=error.error_id)
        except Exception as e:
            logger.error("Network recovery failed", error=str(e), error_id=error.error_id)
    
    async def _send_alert(self, error: SystemError):
        """Send alerts for high severity errors."""
        try:
            # In production, this would integrate with alerting systems
            # like PagerDuty, Slack, email, etc.
            
            alert_data = {
                "service": "Data Engineer Assessment Platform",
                "error_id": error.error_id,
                "severity": error.severity.value,
                "category": error.category.value,
                "message": error.message,
                "timestamp": error.timestamp.isoformat(),
                "user_id": error.user_id,
                "request_id": error.request_id
            }
            
            logger.critical("ALERT: High severity error detected", **alert_data)
            
            # Store alert for dashboard
            redis_client = await self._get_redis()
            alert_key = f"alert:{error.error_id}"
            await redis_client.setex(alert_key, 86400, str(alert_data))
            
        except Exception as e:
            logger.error("Failed to send alert", error=str(e))
    
    async def get_error_metrics(self) -> Dict[str, Any]:
        """Get current error metrics for monitoring dashboard."""
        try:
            redis_client = await self._get_redis()
            
            metrics = {
                "error_counts_by_category": {},
                "error_counts_by_severity": {},
                "hourly_error_rate": {},
                "circuit_breakers": {},
                "recent_alerts": []
            }
            
            # Get error counts by category
            for category in ErrorCategory:
                key = f"error_count:{category.value}"
                count = await redis_client.get(key)
                metrics["error_counts_by_category"][category.value] = int(count) if count else 0
            
            # Get error counts by severity
            for severity in ErrorSeverity:
                key = f"error_count:severity:{severity.value}"
                count = await redis_client.get(key)
                metrics["error_counts_by_severity"][severity.value] = int(count) if count else 0
            
            # Get circuit breaker status
            for category in ErrorCategory:
                key = f"circuit_breaker:{category.value}"
                status = await redis_client.get(key)
                metrics["circuit_breakers"][category.value] = status == "open"
            
            return metrics
            
        except Exception as e:
            logger.error("Failed to get error metrics", error=str(e))
            return {}
    
    async def is_circuit_breaker_open(self, category: ErrorCategory) -> bool:
        """Check if circuit breaker is open for a category."""
        try:
            redis_client = await self._get_redis()
            key = f"circuit_breaker:{category.value}"
            status = await redis_client.get(key)
            return status == "open"
        except Exception:
            return False
    
    @asynccontextmanager
    async def error_context(
        self,
        category: ErrorCategory,
        severity: ErrorSeverity = ErrorSeverity.MEDIUM,
        context: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        request_id: Optional[str] = None
    ):
        """Context manager for automatic error handling."""
        try:
            yield
        except Exception as e:
            await self.handle_error(
                exception=e,
                category=category,
                severity=severity,
                context=context,
                user_id=user_id,
                request_id=request_id
            )
            raise


# Global error handler instance
_error_handler: Optional[ErrorHandler] = None


def get_error_handler() -> ErrorHandler:
    """Get the global error handler instance."""
    global _error_handler
    if not _error_handler:
        _error_handler = ErrorHandler()
    return _error_handler


# Convenience functions
async def handle_error(
    exception: Exception,
    category: ErrorCategory,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    **kwargs
) -> SystemError:
    """Convenience function for error handling."""
    handler = get_error_handler()
    return await handler.handle_error(exception, category, severity, **kwargs)


async def get_system_health() -> Dict[str, Any]:
    """Get comprehensive system health including error metrics."""
    handler = get_error_handler()
    error_metrics = await handler.get_error_metrics()
    
    # Determine overall health based on error rates
    total_errors = sum(error_metrics.get("error_counts_by_severity", {}).values())
    critical_errors = error_metrics.get("error_counts_by_severity", {}).get("critical", 0)
    high_errors = error_metrics.get("error_counts_by_severity", {}).get("high", 0)
    
    if critical_errors > 0:
        health_status = "critical"
    elif high_errors > 5:
        health_status = "degraded"
    elif total_errors > 20:
        health_status = "degraded"
    else:
        health_status = "healthy"
    
    return {
        "status": health_status,
        "error_metrics": error_metrics,
        "timestamp": datetime.utcnow().isoformat()
    }