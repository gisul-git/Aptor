"""
AIML Agent Service - Standalone WebSocket service for Python code execution
"""

import asyncio
import sys
import logging
import json
from aiohttp import web
from agent.server import AgentServer
from agent.config import Config
from agent.metrics import get_metrics
from agent.kernel_manager import get_kernel_count, get_healthy_kernel_count

# Configure logging
log_format = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
if Config.LOG_FORMAT == 'json':
    # JSON logging for production
    class JSONFormatter(logging.Formatter):
        def format(self, record):
            log_data = {
                'timestamp': self.formatTime(record),
                'level': record.levelname,
                'logger': record.name,
                'message': record.getMessage(),
            }
            if record.exc_info:
                log_data['exception'] = self.formatException(record.exc_info)
            return json.dumps(log_data)
    
    formatter = JSONFormatter()
else:
    formatter = logging.Formatter(log_format)

handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(formatter)

logging.basicConfig(
    level=getattr(logging, Config.LOG_LEVEL.upper(), logging.INFO),
    handlers=[handler]
)

logger = logging.getLogger("aiml-agent-service")


async def health_check_handler(request):
    """HTTP health check endpoint with kernel status."""
    try:
        # Check kernel availability
        kernel_count = get_kernel_count()
        healthy_kernels = get_healthy_kernel_count()
        
        # Basic health check
        is_healthy = healthy_kernels > 0 or kernel_count == 0  # Healthy if no kernels or at least one healthy
        
        status_code = 200 if is_healthy else 503
        
        response_data = {
            "status": "healthy" if is_healthy else "degraded",
            "service": "aiml-agent-service",
            "websocket_port": Config.PORT,
            "kernels": {
                "total": kernel_count,
                "healthy": healthy_kernels
            }
        }
        
        # Add metrics if enabled
        if Config.ENABLE_METRICS:
            metrics = get_metrics()
            stats = metrics.get_stats()
            response_data["metrics"] = {
                "uptime_seconds": stats.get("uptime_seconds", 0),
                "executions_total": stats.get("counters", {}).get("executions.requested", 0),
                "executions_success": stats.get("counters", {}).get("executions.success", 0),
                "executions_error": stats.get("counters", {}).get("executions.error", 0),
            }
        
        return web.json_response(response_data, status=status_code)
    
    except Exception as e:
        logger.error(f"Health check error: {e}", exc_info=True)
        return web.json_response({
            "status": "unhealthy",
            "error": str(e)
        }, status=503)


async def metrics_handler(request):
    """Metrics endpoint for monitoring."""
    if not Config.ENABLE_METRICS:
        return web.json_response({"error": "Metrics disabled"}, status=404)
    
    metrics = get_metrics()
    stats = metrics.get_stats()
    return web.json_response(stats)


async def start_http_server(host: str, port: int):
    """Start HTTP server for health checks and metrics."""
    app = web.Application()
    app.router.add_get('/health', health_check_handler)
    app.router.add_get('/', health_check_handler)  # Also respond on root
    app.router.add_get('/metrics', metrics_handler)  # Metrics endpoint
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    logger.info(f"HTTP server started on http://{host}:{port}/health")


def main():
    """Main entrypoint for the AIML Agent Service."""
    import argparse

    parser = argparse.ArgumentParser(description='AIML Agent Service - WebSocket server for code execution')
    parser.add_argument(
        '--host',
        default=Config.HOST,
        help=f'Host to bind to (default: {Config.HOST})',
    )
    parser.add_argument(
        '--port',
        type=int,
        default=Config.PORT,
        help=f'WebSocket port to bind to (default: {Config.PORT})',
    )
    parser.add_argument(
        '--health-port',
        type=int,
        default=Config.HEALTH_PORT,
        help=f'HTTP health check port (default: {Config.HEALTH_PORT})',
    )

    args = parser.parse_args()
    
    # Validate configuration
    try:
        Config.validate()
    except ValueError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)

    server = AgentServer(host=args.host, port=args.port)
    
    logger.info(f"Starting AIML Agent Service on ws://{args.host}:{args.port}")
    logger.info(f"HTTP health check will be available on http://{args.host}:{args.health_port}/health")
    logger.info(f"Configuration: MAX_KERNELS={Config.MAX_KERNELS}, EXECUTION_TIMEOUT={Config.EXECUTION_TIMEOUT}s")

    async def run_servers():
        # Start HTTP health check server
        await start_http_server(args.host, args.health_port)
        # Start WebSocket server (this runs forever)
        await server.start()

    try:
        asyncio.run(run_servers())
    except KeyboardInterrupt:
        logger.info("Agent service stopped")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
