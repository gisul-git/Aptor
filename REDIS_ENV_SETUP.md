# Redis Configuration in .env Files

All services are now configured to read `REDIS_URL` from their respective `.env` files.

## Required .env Configuration

Add the following line to each service's `.env` file:

### DSA Service (`services/dsa-service/.env`)
```bash
REDIS_URL=redis://localhost:6379/0
```

### AIML Service (`services/aiml-service/.env`)
```bash
REDIS_URL=redis://localhost:6379/0
```

### Custom MCQ Service (`services/custom-mcq-service/.env`)
```bash
REDIS_URL=redis://localhost:6379/0
```

### AI Assessment Service (`services/ai-assessment-service/.env`)
```bash
REDIS_URL=redis://localhost:6379/0
```

## For Docker/Production

When running in Docker, the `docker-compose.yml` already sets:
```yaml
REDIS_URL=redis://redis:6379/0
```

This will override the .env file values when running in Docker.

## How It Works

1. **Settings Configuration**: Each service's `settings.py` has:
   ```python
   redis_url: str = "redis://localhost:6379/0"  # Default fallback
   model_config = SettingsConfigDict(env_file=".env", ...)
   ```

2. **Priority Order**:
   - Environment variables (highest priority)
   - `.env` file values
   - Default values in `settings.py` (lowest priority)

3. **The `.env` file value will override the default** in `settings.py` when present.

## Verification

To verify Redis is being read from .env:
1. Add `REDIS_URL=redis://localhost:6379/0` to your service's `.env` file
2. Start the service
3. Check logs for: `✅ {Service} connected to Redis`

If Redis connection fails, the service will continue without cache (graceful degradation).

