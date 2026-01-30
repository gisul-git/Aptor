"""
AIML Agent Service - Standalone WebSocket service for Python code execution
"""

import asyncio
import sys
import logging
from agent.server import AgentServer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger("aiml-agent-service")


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
        help='Port to bind to (default: 8889)',
    )

    args = parser.parse_args()

    server = AgentServer(host=args.host, port=args.port)
    
    logger.info(f"Starting AIML Agent Service on ws://{args.host}:{args.port}")

    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        logger.info("Agent service stopped")
        sys.exit(0)


if __name__ == "__main__":
    main()

