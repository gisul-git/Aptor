#!/bin/bash

# Quick Rollback Script for QA Deployment
# Usage: ./scripts/rollback.sh [commits_back]
# Example: ./scripts/rollback.sh 1  (rollback 1 commit)

set -e

COMMITS_BACK=${1:-1}
DEPLOY_PATH="/opt/aptor"

echo "🔙 QA Deployment Rollback Script"
echo "=================================="
echo ""
echo "⚠️  WARNING: This will rollback $COMMITS_BACK commit(s)"
echo "📍 Current commit: $(git rev-parse --short HEAD)"
echo "🎯 Target commit: $(git rev-parse --short HEAD~$COMMITS_BACK)"
echo ""

# Confirm rollback
read -p "Continue with rollback? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
  echo "❌ Rollback cancelled"
  exit 0
fi

echo ""
echo "🚀 Starting rollback..."
echo ""

# Navigate to deployment directory
cd "$DEPLOY_PATH" || exit 1

# Backup current .env
echo "💾 Backing up .env..."
if [ -f .env ]; then
  cp .env .env.rollback.backup.$(date +%Y%m%d_%H%M%S)
  echo "✅ .env backed up"
fi

# Stop current containers
echo ""
echo "🛑 Stopping current containers..."
docker compose down --timeout 30

# Rollback code
echo ""
echo "⏮️  Rolling back code $COMMITS_BACK commit(s)..."
git reset --hard HEAD~$COMMITS_BACK

# Verify .env exists
if [ ! -f .env ]; then
  echo "⚠️  .env missing after rollback"
  
  # Try to restore from backup
  LATEST_BACKUP=$(ls -t .env.rollback.backup.* 2>/dev/null | head -1)
  if [ -n "$LATEST_BACKUP" ]; then
    echo "📦 Restoring .env from backup: $LATEST_BACKUP"
    cp "$LATEST_BACKUP" .env
    echo "✅ .env restored"
  else
    echo "❌ ERROR: No .env backup found"
    echo "Please manually restore .env file before continuing"
    exit 1
  fi
fi

# Clean up Docker resources
echo ""
echo "🧹 Cleaning up Docker resources..."
docker system prune -f

# Rebuild and start services
echo ""
echo "🔨 Building services..."
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

if ! docker compose build; then
  echo "❌ Build failed"
  echo "Please check the logs and fix issues manually"
  exit 1
fi

echo ""
echo "🚀 Starting services..."
if ! docker compose up -d; then
  echo "❌ Failed to start services"
  echo "Please check the logs and fix issues manually"
  exit 1
fi

# Wait for services to start
echo ""
echo "⏳ Waiting for services to start..."
sleep 15

# Health check
echo ""
echo "🏥 Running health checks..."

HEALTH_PASSED=true

# Check containers are running
RUNNING=$(docker compose ps --filter "status=running" --format "{{.Name}}" | wc -l)
TOTAL=$(docker compose ps --format "{{.Name}}" | wc -l)

echo "📊 Containers: $RUNNING/$TOTAL running"

if [ "$RUNNING" -ne "$TOTAL" ]; then
  echo "⚠️  Not all containers are running"
  HEALTH_PASSED=false
fi

# Test critical services
echo ""
echo "🧪 Testing critical services..."

# API Gateway
if docker exec gisul-api-gateway wget -q --spider http://localhost:80/health 2>/dev/null; then
  echo "✅ API Gateway: OK"
else
  echo "❌ API Gateway: FAILED"
  HEALTH_PASSED=false
fi

# Frontend
if docker exec gisul-frontend wget -q --spider http://localhost:3000 2>/dev/null; then
  echo "✅ Frontend: OK"
else
  echo "❌ Frontend: FAILED"
  HEALTH_PASSED=false
fi

# Redis
if docker exec gisul-redis redis-cli ping | grep -q "PONG"; then
  echo "✅ Redis: OK"
else
  echo "❌ Redis: FAILED"
  HEALTH_PASSED=false
fi

# Summary
echo ""
echo "=================================="
if [ "$HEALTH_PASSED" = true ]; then
  echo "✅ ROLLBACK COMPLETED SUCCESSFULLY"
  echo "=================================="
  echo "📍 Current commit: $(git rev-parse --short HEAD)"
  echo "📅 Completed at: $(date)"
  echo ""
  echo "📊 Container status:"
  docker compose ps
else
  echo "⚠️  ROLLBACK COMPLETED WITH WARNINGS"
  echo "=================================="
  echo "Some health checks failed. Please investigate:"
  echo ""
  docker compose ps
  echo ""
  echo "Check logs with: docker compose logs --tail=100"
fi

echo ""
echo "💡 Tip: If issues persist, check logs with:"
echo "   docker compose logs <service-name>"
