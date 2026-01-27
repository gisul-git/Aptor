# AIML Agent Docker Setup

This directory contains the Docker setup for the AIML Agent - a WebSocket server that executes Python code in Jupyter kernels.

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. Navigate to the agent directory:
   ```bash
   cd services/aiml-service/app/api/v1/aiml/agent
   ```

2. Build and run the container:
   ```bash
   docker-compose up --build
   ```

3. The agent will be available at `ws://localhost:8889`

### Option 2: Using Docker directly

1. Navigate to the agent directory:
   ```bash
   cd services/aiml-service/app/api/v1/aiml/agent
   ```

2. Build the Docker image:
   ```bash
   docker build -t aiml-agent .
   ```

3. Run the container:
   ```bash
   docker run -d \
     --name aiml-agent \
     -p 8889:8889 \
     -v $(pwd)/uploads:/app/agent/uploads \
     aiml-agent
   ```

4. The agent will be available at `ws://localhost:8889`

## Testing the Agent

You can test the WebSocket connection using a simple Python script:

```python
import asyncio
import websockets
import json

async def test_agent():
    uri = "ws://localhost:8889"
    async with websockets.connect(uri) as websocket:
        # Test ping
        await websocket.send(json.dumps({"type": "ping"}))
        response = await websocket.recv()
        print("Ping response:", response)
        
        # Test code execution
        test_code = "print('Hello from Docker!')"
        await websocket.send(json.dumps({
            "type": "execute",
            "code": test_code,
            "session_id": "test-session",
            "run_id": "test-run-1"
        }))
        response = await websocket.recv()
        print("Execution response:", response)

asyncio.run(test_agent())
```

## Features

- **Code Execution**: Execute Python code in isolated Jupyter kernels
- **File Uploads**: Upload files that can be accessed by executed code
- **Kernel Management**: Restart kernels, interrupt execution
- **Session Management**: Each session gets its own kernel instance

## Port Configuration

The agent runs on port **8889** by default. You can change this by:
- Modifying the `CMD` in Dockerfile
- Using environment variables (if supported)
- Modifying docker-compose.yml port mapping

## Volume Mounts

The `uploads` directory is mounted as a volume to persist uploaded files. Files uploaded during a session will be stored in `./uploads/<session_id>/`.

## Requirements

- Docker
- Docker Compose (optional, for easier management)

## Troubleshooting

1. **Port already in use**: Change the port mapping in docker-compose.yml or docker run command
2. **Import errors**: Ensure the PYTHONPATH is set correctly (already configured in Dockerfile)
3. **Kernel not found**: The Dockerfile automatically installs and registers ipykernel

