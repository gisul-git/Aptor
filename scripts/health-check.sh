#!/bin/bash

# Health Check Script for QA Environment
# Usage: ./scripts/health-check.sh

DEPLOY_PATH=${DEPLOY_PATH:-/opt/aptor}
cd "${DEPLOY_PATH}"

echo "🏥 QA Environment Health Check"
echo "================================"
echo ""

# Check if docker-compose is running
if ! docker compose ps >/dev/null 2>&1; then
  echo "❌ Docker Compose is not running or not accessible"
  exit 1
fi

# Get all services
SERVICES=$(docker compose ps --services)

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counters
HEALTHY=0
UNHEALTHY=0
STARTING=0
STOPPED=0

echo "Service Status:"
echo "---------------"

for service in $SERVICES; do
  # Get container status
  STATUS=$(docker compose ps --format json $service 2>/dev/null | jq -r '.State' 2>/dev/null || echo "unknown")
  HEALTH=$(docker compose ps --format json $service 2>/dev/null | jq -r '.Health' 2>/dev/null || echo "")
  
  # Determine overall status
  if [ "$STATUS" = "running" ]; then
    if [ "$HEALTH" = "healthy" ] || [ -z "$HEALTH" ]; then
      echo -e "${GREEN}✅${NC} $service - Running (Healthy)"
      ((HEALTHY++))
    elif [ "$HEALTH" = "starting" ]; then
      echo -e "${YELLOW}⏳${NC} $service - Running (Starting)"
      ((STARTING++))
    else
      echo -e "${RED}❌${NC} $service - Running (Unhealthy)"
      ((UNHEALTHY++))
    fi
  else
    echo -e "${RED}🛑${NC} $service - $STATUS"
    ((STOPPED++))
  fi
done

echo ""
echo "Summary:"
echo "--------"
echo -e "${GREEN}Healthy:${NC} $HEALTHY"
echo -e "${YELLOW}Starting:${NC} $STARTING"
echo -e "${RED}Unhealthy:${NC} $UNHEALTHY"
echo -e "${RED}Stopped:${NC} $STOPPED"

# Check specific endpoints
echo ""
echo "Endpoint Checks:"
echo "----------------"

check_endpoint() {
  local name=$1
  local url=$2
  local timeout=${3:-5}
  
  if curl -sf --max-time $timeout "$url" >/dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} $name - $url"
    return 0
  else
    echo -e "${RED}❌${NC} $name - $url"
    return 1
  fi
}

# Check internal endpoints
check_endpoint "API Gateway" "http://localhost:80/health" 5
check_endpoint "Auth Service" "http://localhost:4000/health" 5
check_endpoint "Frontend" "http://localhost:3000/api/health" 10
check_endpoint "AI Assessment" "http://localhost:3001/health" 5
check_endpoint "Custom MCQ" "http://localhost:3002/health" 5
check_endpoint "AIML Service" "http://localhost:3003/health" 5
check_endpoint "DSA Service" "http://localhost:3004/health" 5
check_endpoint "Proctoring" "http://localhost:3005/health" 5
check_endpoint "Super Admin" "http://localhost:3006/health" 5
check_endpoint "Demo Service" "http://localhost:3008/health" 5
check_endpoint "Employee Service" "http://localhost:4005/health" 5
check_endpoint "AIML Agent" "http://localhost:8889/health" 5

# Overall status
echo ""
if [ $UNHEALTHY -eq 0 ] && [ $STOPPED -eq 0 ]; then
  echo -e "${GREEN}✅ All services are healthy!${NC}"
  exit 0
elif [ $STARTING -gt 0 ]; then
  echo -e "${YELLOW}⏳ Some services are still starting...${NC}"
  exit 2
else
  echo -e "${RED}❌ Some services are unhealthy or stopped!${NC}"
  exit 1
fi
