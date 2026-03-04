"""
Monitoring and health check endpoints.
"""

from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Dict, Any, List, Optional
import structlog
from datetime import datetime, timedelta

from app.core.monitoring import get_monitoring_system, MonitoringSystem, AlertLevel, MetricType
from app.core.error_handler import get_error_handler, get_system_health
from app.core.auth import get_current_user
from app.services.integration_service import get_integration_service, IntegrationService

logger = structlog.get_logger()
router = APIRouter()


@router.get("/health")
async def health_check() -> Dict[str, str]:
    """Basic health check endpoint."""
    return {
        "status": "healthy",
        "service": "Data Engineer Assessment Platform",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/detailed")
async def detailed_health_check(
    integration_service: IntegrationService = Depends(get_integration_service)
) -> Dict[str, Any]:
    """Detailed health check including all system components."""
    try:
        # Get comprehensive system health from integration service
        system_health = await integration_service.get_system_health()
        
        # Add monitoring system health
        monitoring = get_monitoring_system()
        monitoring_health = await monitoring._check_system_health()
        
        system_health["components"]["monitoring"] = {
            "status": "healthy" if monitoring_health["healthy"] else "unhealthy",
            "details": monitoring_health
        }
        
        return system_health
        
    except Exception as e:
        logger.error("Detailed health check failed", error=str(e), exc_info=True)
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


@router.get("/metrics")
async def get_metrics(
    metric_name: Optional[str] = Query(None, description="Specific metric name to retrieve"),
    start_time: Optional[datetime] = Query(None, description="Start time for historical data"),
    end_time: Optional[datetime] = Query(None, description="End time for historical data"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of data points"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    monitoring: MonitoringSystem = Depends(get_monitoring_system)
) -> Dict[str, Any]:
    """Get system metrics."""
    try:
        if metric_name:
            # Get specific metric
            if start_time or end_time:
                # Get historical data
                history = await monitoring.get_metric_history(
                    name=metric_name,
                    start_time=start_time,
                    end_time=end_time,
                    limit=limit
                )
                return {
                    "metric": metric_name,
                    "history": history,
                    "count": len(history)
                }
            else:
                # Get current value
                metric = await monitoring.get_metric(metric_name)
                if not metric:
                    raise HTTPException(status_code=404, detail="Metric not found")
                
                return {
                    "metric": metric_name,
                    "value": metric.value,
                    "type": metric.metric_type.value,
                    "timestamp": metric.timestamp.isoformat(),
                    "labels": metric.labels
                }
        else:
            # Get dashboard data with all metrics
            dashboard_data = await monitoring.get_dashboard_data()
            return dashboard_data
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get metrics", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve metrics")


@router.post("/metrics")
async def record_metric(
    metric_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),  # Require authentication
    monitoring: MonitoringSystem = Depends(get_monitoring_system)
) -> Dict[str, str]:
    """Record a custom metric (admin only)."""
    try:
        # Check admin privileges
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        
        # Validate required fields
        if "name" not in metric_data or "value" not in metric_data:
            raise HTTPException(status_code=400, detail="Name and value are required")
        
        # Parse metric type
        metric_type = MetricType.GAUGE
        if "type" in metric_data:
            try:
                metric_type = MetricType(metric_data["type"])
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid metric type")
        
        # Record the metric
        await monitoring.record_metric(
            name=metric_data["name"],
            value=float(metric_data["value"]),
            metric_type=metric_type,
            labels=metric_data.get("labels", {}),
            description=metric_data.get("description")
        )
        
        logger.info(
            "Custom metric recorded",
            metric_name=metric_data["name"],
            value=metric_data["value"],
            user_id=current_user.get("user_id")
        )
        
        return {"message": "Metric recorded successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to record metric", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to record metric")


@router.get("/alerts")
async def get_alerts(
    level: Optional[str] = Query(None, description="Filter by alert level"),
    resolved: Optional[bool] = Query(None, description="Filter by resolved status"),
    limit: int = Query(50, ge=1, le=200, description="Maximum number of alerts"),
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    monitoring: MonitoringSystem = Depends(get_monitoring_system)
) -> Dict[str, Any]:
    """Get system alerts."""
    try:
        # Parse alert level
        alert_level = None
        if level:
            try:
                alert_level = AlertLevel(level.lower())
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid alert level")
        
        # Get alerts
        alerts = await monitoring.get_alerts(
            level=alert_level,
            limit=limit,
            resolved=resolved
        )
        
        # Format response
        alert_data = []
        for alert in alerts:
            alert_data.append({
                "id": alert.id,
                "level": alert.level.value,
                "title": alert.title,
                "message": alert.message,
                "timestamp": alert.timestamp.isoformat(),
                "source": alert.source,
                "metadata": alert.metadata,
                "resolved": alert.resolved,
                "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None
            })
        
        return {
            "alerts": alert_data,
            "count": len(alert_data),
            "filters": {
                "level": level,
                "resolved": resolved,
                "limit": limit
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get alerts", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve alerts")


@router.post("/alerts")
async def create_alert(
    alert_data: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user),  # Require authentication
    monitoring: MonitoringSystem = Depends(get_monitoring_system)
) -> Dict[str, Any]:
    """Create a custom alert (admin only)."""
    try:
        # Check admin privileges
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        
        # Validate required fields
        if "title" not in alert_data or "message" not in alert_data:
            raise HTTPException(status_code=400, detail="Title and message are required")
        
        # Parse alert level
        alert_level = AlertLevel.INFO
        if "level" in alert_data:
            try:
                alert_level = AlertLevel(alert_data["level"].lower())
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid alert level")
        
        # Create the alert
        alert = await monitoring.create_alert(
            level=alert_level,
            title=alert_data["title"],
            message=alert_data["message"],
            source=alert_data.get("source", "manual"),
            metadata=alert_data.get("metadata", {})
        )
        
        logger.info(
            "Custom alert created",
            alert_id=alert.id,
            level=alert.level.value,
            user_id=current_user.get("user_id")
        )
        
        return {
            "id": alert.id,
            "level": alert.level.value,
            "title": alert.title,
            "message": alert.message,
            "timestamp": alert.timestamp.isoformat(),
            "source": alert.source
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create alert", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create alert")


@router.get("/errors")
async def get_error_metrics(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get error metrics and statistics."""
    try:
        error_handler = get_error_handler()
        error_metrics = await error_handler.get_error_metrics()
        
        return {
            "error_metrics": error_metrics,
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error("Failed to get error metrics", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve error metrics")


@router.get("/status")
async def get_system_status(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user)
) -> Dict[str, Any]:
    """Get comprehensive system status."""
    try:
        # Get monitoring dashboard data
        monitoring = get_monitoring_system()
        dashboard_data = await monitoring.get_dashboard_data()
        
        # Get error metrics
        error_health = await get_system_health()
        
        # Combine all status information
        system_status = {
            "overall_status": dashboard_data.get("health", {}).get("healthy", True),
            "monitoring": dashboard_data,
            "errors": error_health,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        return system_status
        
    except Exception as e:
        logger.error("Failed to get system status", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve system status")


@router.get("/dashboard")
async def get_monitoring_dashboard(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user),
    monitoring: MonitoringSystem = Depends(get_monitoring_system)
) -> Dict[str, Any]:
    """Get monitoring dashboard data."""
    try:
        dashboard_data = await monitoring.get_dashboard_data()
        
        # Add additional context
        dashboard_data["user_context"] = {
            "user_id": current_user.get("user_id") if current_user else None,
            "is_admin": current_user.get("role") == "admin" if current_user else False
        }
        
        return dashboard_data
        
    except Exception as e:
        logger.error("Failed to get monitoring dashboard", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to retrieve dashboard data")


@router.post("/test-alert")
async def test_alert(
    current_user: Dict[str, Any] = Depends(get_current_user),  # Require authentication
    monitoring: MonitoringSystem = Depends(get_monitoring_system)
) -> Dict[str, str]:
    """Create a test alert for testing monitoring system (admin only)."""
    try:
        # Check admin privileges
        if current_user.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin privileges required")
        
        # Create test alert
        alert = await monitoring.create_alert(
            level=AlertLevel.INFO,
            title="Test Alert",
            message="This is a test alert to verify the monitoring system is working correctly.",
            source="test",
            metadata={"test": True, "user_id": current_user.get("user_id")}
        )
        
        logger.info("Test alert created", alert_id=alert.id, user_id=current_user.get("user_id"))
        
        return {"message": "Test alert created successfully", "alert_id": alert.id}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create test alert", error=str(e))
        raise HTTPException(status_code=500, detail="Failed to create test alert")