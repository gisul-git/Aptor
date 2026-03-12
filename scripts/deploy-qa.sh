#!/bin/bash
set -e

# QA Deployment Script - Optimized for minimal downtime
# Usage: ./scripts/deploy-qa.sh [image_tag]

IMAGE_TAG=${1:-qa-latest}
DEPLOY_PATH=${DEPLOY_PATH:-/opt/aptor}

echo "🚀 Starting QA deployment with image tag: ${IMAGE_TAG}"

# Navigate to deployment directory
cd "${DEPLOY_PATH}"

# Verify .env exists
if [ ! -f .env ]; then
  echo "❌ ERROR: .env file not found at ${DEPLOY_PATH}/.env"
  exit 1
fi

# Export environment variables for docker-compose
export DOCKER_REGISTRY="${DOCKER_REGISTRY:-ghcr.io}"
export GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-your-org/your-repo}"
export IMAGE_TAG="${IMAGE_TAG}"

echo "📋 Configuration:"
echo "  Registry: ${DOCKER_REGISTRY}"
echo "  Repository: ${GITHUB_REPOSITORY}"
echo "  Image Tag: ${IMAGE_TAG}"
echo "  Deploy Path: ${DEPLOY_PATH}"

# Pull all new images
echo ""
echo "📥 Pulling new images..."
if ! docker compose pull --quiet; then
  echo "❌ Failed to pull images"
  exit 1
fi

echo "✅ Images pulled successfully"

# Function to update a service with health check
update_service() {
  local service=$1
  echo ""
  echo "🔄 Updating ${service}..."
  
  # Get current container ID before update
  OLD_CONTAINER=$(docker compose ps -q ${service} 2>/dev/null || echo "")
  
  # Update service with health check wait
  if docker compose up -d --no-deps --wait --timeout 60 ${service}; then
    echo "✅ ${service} updated successfully"
    
    # Remove old container if it exists and is different
    if [ -n "$OLD_CONTAINER" ]; then
      NEW_CONTAINER=$(docker compose ps -q ${service} 2>/dev/null || echo "")
      if [ "$OLD_CONTAINER" != "$NEW_CONTAINER" ] && docker ps -a --format '{{.ID}}' | grep -q "^${OLD_CONTAINER}$"; then
        echo "🧹 Removing old container for ${service}"
        docker rm ${OLD_CONTAINER} 2>/dev/null || true
      fi
    fi
    
    return 0
  else
    echo "❌ ${service} update failed"
    echo "📋 Last 30 lines of logs:"
    docker compose logs --tail=30 ${service}
    return 1
  fi
}

# Rolling update strategy
echo ""
echo "🔄 Starting rolling update..."

# Update services in dependency order
SERVICES=(
  "redis"
  "auth-service"
  "api-gateway"
  "aiml-agent-service"
  "ai-assessment-service"
  "custom-mcq-service"
  "aiml-service"
  "dsa-service"
  "proctoring-service"
  "super-admin-service"
  "employee-service"
  "demo-service"
  "frontend"
)

FAILED_SERVICES=()

for service in "${SERVICES[@]}"; do
  if ! update_service "$service"; then
    FAILED_SERVICES+=("$service")
    echo "⚠️  Continuing with other services..."
  fi
  # Small delay between services to avoid overwhelming the system
  sleep 2
done

# Clean up old images (keep last 24 hours)
echo ""
echo "🧹 Cleaning up old images..."
docker image prune -af --filter "until=24h" 2>/dev/null || true

# Final status check
echo ""
echo "📊 Deployment Status:"
docker compose ps

# Health check summary
echo ""
echo "🏥 Health Check Summary:"
UNHEALTHY=$(docker compose ps --format json 2>/dev/null | jq -r 'select(.Health == "unhealthy") | .Service' 2>/dev/null || echo "")
STARTING=$(docker compose ps --format json 2>/dev/null | jq -r 'select(.Health == "starting") | .Service' 2>/dev/null || echo "")

if [ -n "$UNHEALTHY" ]; then
  echo "❌ Unhealthy services: $UNHEALTHY"
fi

if [ -n "$STARTING" ]; then
  echo "⏳ Starting services: $STARTING"
fi

# Report results
echo ""
if [ ${#FAILED_SERVICES[@]} -eq 0 ]; then
  echo "✅ QA deployment completed successfully!"
  exit 0
else
  echo "⚠️  Deployment completed with failures:"
  printf '  - %s\n' "${FAILED_SERVICES[@]}"
  echo ""
  echo "💡 To rollback, run: ./scripts/deploy-qa.sh <previous-tag>"
  exit 1
fi
