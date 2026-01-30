# AIML Agent Service

Standalone WebSocket service for executing Python code in Jupyter kernels for AIML competency assessments.

## Overview

This service provides a WebSocket server that executes Python code in isolated Jupyter kernels. It is used by the frontend to run AIML competency code in a notebook-like environment.

## Features

- **Code Execution**: Execute Python code in isolated Jupyter kernels
- **File Uploads**: Upload files that can be accessed by executed code
- **Kernel Management**: Restart kernels, interrupt execution
- **Session Management**: Maintain separate kernel sessions per user/test
- **Pip Install Support**: Transform `!pip install` commands to run in kernel

## Architecture

- **WebSocket Server**: Listens on port 8889 (configurable)
- **Jupyter Kernels**: Uses `jupyter-client` to manage Python kernels
- **Session-based**: Each session gets its own kernel instance

## Quick Start

### Using Docker

```bash
# Build and run
docker-compose up --build

# Or using Docker directly
docker build -t aiml-agent-service .
docker run -d -p 8889:8889 -v $(pwd)/uploads:/app/agent/uploads aiml-agent-service
```

### Running Locally

```bash
# Install dependencies
pip install -r requirements.txt

# Install ipykernel
python -m pip install ipykernel
python -m ipykernel install --user --name python3

# Run the service
python main.py --host 127.0.0.1 --port 8889
```

## Configuration

- **Host**: Default `127.0.0.1` (use `0.0.0.0` for Docker)
- **Port**: Default `8889`
- **Environment Variable**: `NEXT_PUBLIC_AIML_AGENT_URL` in frontend (default: `ws://127.0.0.1:8889`)

## WebSocket API

### Message Types

- `ping`: Health check (returns `pong`)
- `execute`: Execute Python code
- `interrupt`: Interrupt running execution
- `restart`: Restart kernel for session
- `file_upload`: Upload file for session

### Execute Request

```json
{
  "type": "execute",
  "code": "print('Hello, World!')",
  "session_id": "user-123-test-456",
  "run_id": "run-789"
}
```

### Execute Response

```json
{
  "type": "result",
  "run_id": "run-789",
  "stdout": "Hello, World!\n",
  "stderr": "",
  "images": [],
  "error": null,
  "success": true
}
```

## Directory Structure

```
aiml-agent-service/
├── agent/              # Agent package
│   ├── __init__.py
│   ├── __main__.py
│   ├── server.py       # WebSocket server
│   ├── kernel_manager.py
│   ├── kernel_executor.py
│   └── features/       # Additional features
│       ├── restart_kernel.py
│       └── file_upload.py
├── main.py            # Service entrypoint
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
└── README.md
```

## Development

The service can be run in development mode:

```bash
python main.py --host 127.0.0.1 --port 8889
```

## Production

For production, use Docker or run as a system service (see `installer/` directory for service configurations).

## Notes

- Kernels are reused per session for performance
- Each session maintains its own kernel instance
- File uploads are stored in `agent/uploads/{session_id}/`
- Execution timeout is 120 seconds by default

