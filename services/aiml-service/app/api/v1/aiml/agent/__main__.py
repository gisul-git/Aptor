"""CLI entrypoint for the agent."""

import asyncio
import sys
from agent.server import AgentServer


def main():
    """Main entrypoint for the agent CLI."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Local Notebook Agent')
    parser.add_argument(
        '--host',
        default='127.0.0.1',
        help='Host to bind to (default: 127.0.0.1)'
    )
    parser.add_argument(
        '--port',
        type=int,
        default=8889,
        help='Port to bind to (default: 8889)'
    )
    
    args = parser.parse_args()
    
    server = AgentServer(host=args.host, port=args.port)
    
    try:
        asyncio.run(server.start())
    except KeyboardInterrupt:
        print("\nAgent stopped")
        sys.exit(0)


if __name__ == '__main__':
    main()
