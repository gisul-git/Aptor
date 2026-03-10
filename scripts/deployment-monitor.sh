#!/bin/bash

# Deployment Monitoring Script
# Monitors deployment progress and health in real-time
# Usage: ./scripts/deployment-monitor.sh

set -e

DEPLOY_PATH="/opt/aptor"

echo "📊 QA Deployment Monitor"
echo "========================"
echo ""

cd "$DEPLOY_PATH" || exit 1

# Function to check service health
check_service_health() {
  local service=$1
  local port=$2
  local endpoint=${3:-/health}
  
  if docker exec "gisul-${service}" wget -q --spider "http://localhost:${port}${endpoint}" 2>/dev/null; then
    echo "✅ ${service}"
    return 0
  else
    echo "❌ ${service}"
    return 1
  fi
}

# Function to get container stats
get_container_stats() {
  docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}" | grep "gisul-"
}

# Main monitoring loop
while true; do
  clear
  echo "📊 QA Deployment Monitor - $(date)"
  echo "=========================================="
  echo ""
  
  # Container Status
  echo "🐳 Container Status:"
  echo "-------------------"
  RUNNING=$(docker compose ps --filter "status=running" --format "{{.Name}}" | wc -l)
  TOTAL=$(docker compose ps --format "{{.Name}}" | wc -l)
  echo "Running: $RUNNING/$TOTAL"
  echo ""
  docker compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
  echo ""
  
  # Health Checks
  echo "🏥 Service Health:"
  echo "------------------"
  check_service_health "api-gateway" "80" "/health" || true
  check_service_health "frontend" "3000" "" || true
  check_service_health "auth-service" "4000" "/health" || true
  check_service_health "ai-assessment-service" "3001" "/health" || true
  check_service_health "custom-mcq-service" "3002" "/health" || true
  check_service_health "aiml-service" "3003" "/health" || true
  check_service_health "dsa-service" "3004" "/health" || true
  check_service_health "proctoring-service" "3005" "/health" || true
  check_service_health "super-admin-service" "3006" "/health" || true
  check_service_health "employee-service" "4005" "/health" || true
  check_service_health "demo-service" "3008" "/health" || true
  
  # Redis check
  if docker exec gisul-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo "✅ redis"
  else
    echo "❌ redis"
  fi
  
  echo ""
  
  # Resource Usage
  echo "💻 Resource Usage:"
  echo "------------------"
  get_container_stats
  echo ""
  
  # Recent Errors
  echo "⚠️  Recent Errors (last 5 min):"
  echo "-------------------------------"
  ERROR_COUNT=$(docker compose logs --since 5m 2>/dev/null | grep -i "error" | wc -l)
  if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "Found $ERROR_COUNT errors in logs"
    docker compose logs --since 5m 2>/dev/null | grep -i "error" | tail -5
  else
    echo "No errors found ✅"
  fi
  echo ""
  
  # Disk Usage
  echo "💾 Disk Usage:"
  echo "--------------"
  df -h / | tail -1
  echo ""
  
  # Docker Disk Usage
  echo "🐋 Docker Disk Usage:"
  echo "--------------------"
  docker system df
  echo ""
  
  echo "Press Ctrl+C to exit | Refreshing in 10 seconds..."
  sleep 10
done
