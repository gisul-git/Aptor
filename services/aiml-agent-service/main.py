"""
AIML Agent Service - Standalone WebSocket service for Python code execution
"""

import asyncio
import sys
import logging
from aiohttp import web
from agent.server import AgentServer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("aiml-agent-service")


async def health_check_handler(request):
    """HTTP health check endpoint for Azure Container Apps."""
    return web.json_response({
        "status": "healthy",
        "service": "aiml-agent-service",
        "websocket_port": 8889
    })


async def start_http_server(host: str, port: int):
    """Start HTTP server for health checks."""
    app = web.Application()
    app.router.add_get('/health', health_check_handler)
    app.router.add_get('/', health_check_handler)  # Also respond on root
    
    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()
    logger.info(f"HTTP health check server started on http://{host}:{port}/health")


def main():
    """Main entrypoint for the AIML Agent Service."""
    import argparse

    parser = argparse.ArgumentParser(description='AIML Agent Service - WebSocket server for code execution')
    parser.add_argument(
        '--host',
        default='127.0.0.1',
        help='Host to bind to (default: 127.0.0.1)',
    )
    parser.add_argument(
        '--port',
        type=int,
        default=8889,
        help='WebSocket port to bind to (default: 8889)',
    )
    parser.add_argument(
        '--health-port',
        type=int,
        default=8080,
        help='HTTP health check port (default: 8080)',
    )

    args = parser.parse_args()

    server = AgentServer(host=args.host, port=args.port)
    
    logger.info(f"Starting AIML Agent Service on ws://{args.host}:{args.port}")
    logger.info(f"HTTP health check will be available on http://{args.host}:{args.health_port}/health")

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


if __name__ == "__main__":
    main()

