# AIML Agent Service - Migration Guide

This guide explains how to migrate from the agent being part of `aiml-service` to a standalone `aiml-agent-service`.

## What Changed

The AIML agent has been separated into its own microservice:
- **Old Location**: `services/aiml-service/app/api/v1/aiml/agent/`
- **New Location**: `services/aiml-agent-service/`

## Migration Steps

### Step 1: Copy Installer Files (Optional)

If you're using the Windows/Mac/Linux installers, copy the installer directory:

**From:**
```
services/aiml-service/app/api/v1/aiml/agent/installer/
```

**To:**
```
services/aiml-agent-service/installer/
```

**Command:**
```bash
# Windows (PowerShell)
Copy-Item -Path "services\aiml-service\app\api\v1\aiml\agent\installer" -Destination "services\aiml-agent-service\installer" -Recurse

# Linux/Mac
cp -r services/aiml-service/app/api/v1/aiml/agent/installer services/aiml-agent-service/
```

### Step 2: Update Docker Compose

Update the root `docker-compose.yml` file:

**Remove from `aiml-service` section:**
```yaml
ports:
  - "3003:3003"
  - "8889:8889"  # WebSocket agent port  <-- REMOVE THIS LINE
```

**Add new service:**
```yaml
  # AIML Agent Service
  aiml-agent-service:
    build:
      context: ./services/aiml-agent-service
      dockerfile: Dockerfile
    container_name: gisul-aiml-agent-service
    ports:
      - "8889:8889"
    volumes:
      - aiml_agent_uploads:/app/agent/uploads
    environment:
      - PYTHONPATH=/app
    networks:
      - microservices-network
    restart: unless-stopped
```

**Add volume:**
```yaml
volumes:
  mongo_data:
  redis_data:
  aiml_agent_uploads:  # <-- ADD THIS
```

### Step 3: Update Frontend (If Needed)

The frontend should already work as-is since it connects directly to `ws://127.0.0.1:8889`.

**Check:** `frontend/src/lib/aiml/agentClient.ts`
- Should have: `const AGENT_URL = process.env.NEXT_PUBLIC_AIML_AGENT_URL || 'ws://127.0.0.1:8889'`
- No changes needed unless you want to change the URL

### Step 4: Update Windows Service (If Using)

If you have the agent running as a Windows service (`AptorAIAgent`):

1. **Stop the old service:**
   ```powershell
   sc stop AptorAIAgent
   sc delete AptorAIAgent
   ```

2. **Install new service from new location:**
   ```powershell
   cd services\aiml-agent-service\installer\windows
   # Follow installer instructions
   ```

### Step 5: Remove Old Agent Code (After Verification)

**⚠️ IMPORTANT: Only do this after verifying the new service works!**

Once you've confirmed the new service is working:

1. **Delete old agent directory:**
   ```bash
   # Windows
   Remove-Item -Path "services\aiml-service\app\api\v1\aiml\agent" -Recurse -Force

   # Linux/Mac
   rm -rf services/aiml-service/app/api/v1/aiml/agent
   ```

2. **Update AIML service Dockerfile** (if it references agent):
   - Check `services/aiml-service/Dockerfile`
   - Remove any agent-related COPY commands or dependencies

### Step 6: Test the Migration

1. **Start the new service:**
   ```bash
   # Using Docker Compose
   docker-compose up aiml-agent-service

   # Or locally
   cd services/aiml-agent-service
   python main.py
   ```

2. **Test WebSocket connection:**
   - Open browser console
   - Navigate to AIML competency test page
   - Try running code
   - Should connect to `ws://127.0.0.1:8889`

3. **Verify code execution:**
   - Run a simple Python command
   - Should execute and return results

## File Structure

### New Service Structure
```
services/aiml-agent-service/
├── agent/                    # Agent package
│   ├── __init__.py
│   ├── __main__.py
│   ├── server.py            # WebSocket server
│   ├── kernel_manager.py    # Kernel management
│   ├── kernel_executor.py   # Code execution
│   └── features/            # Additional features
│       ├── __init__.py
│       ├── restart_kernel.py
│       └── file_upload.py
├── main.py                  # Service entrypoint
├── requirements.txt
├── Dockerfile
├── docker-compose.yml
├── README.md
└── .gitignore
```

## Benefits of Separation

1. **Independent Scaling**: Scale agent service separately from AIML service
2. **Independent Deployment**: Deploy agent without affecting AIML service
3. **Clear Separation**: Agent is a standalone execution engine
4. **Reusability**: Can be used by other services if needed
5. **Easier Maintenance**: Agent code is isolated and easier to debug

## Rollback Plan

If you need to rollback:

1. **Stop new service:**
   ```bash
   docker-compose stop aiml-agent-service
   ```

2. **Restore old agent code** (if deleted):
   ```bash
   git checkout services/aiml-service/app/api/v1/aiml/agent
   ```

3. **Update docker-compose.yml** to restore port mapping in aiml-service

4. **Restart services**

## Support

If you encounter issues during migration:
1. Check service logs: `docker-compose logs aiml-agent-service`
2. Verify WebSocket connection: Test in browser console
3. Check port availability: `netstat -an | findstr 8889` (Windows) or `lsof -i :8889` (Linux/Mac)

