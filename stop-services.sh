#!/bin/bash

# Script to stop all microservices

echo "🛑 Stopping all microservices..."

# Kill processes by port
pkill -f "node.*api-gateway" || echo "Gateway not running"
pkill -f "uvicorn.*auth-service" || echo "Auth service not running"
pkill -f "uvicorn.*ai-assessment-service" || echo "AI Assessment service not running"
pkill -f "uvicorn.*custom-mcq-service" || echo "Custom MCQ service not running"
pkill -f "uvicorn.*aiml-service" || echo "AIML service not running"
pkill -f "uvicorn.*dsa-service" || echo "DSA service not running"
pkill -f "uvicorn.*proctoring-service" || echo "Proctoring service not running"

# Also kill by port (fallback)
lsof -ti:80 | xargs kill -9 2>/dev/null || true
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true
lsof -ti:3003 | xargs kill -9 2>/dev/null || true
lsof -ti:3004 | xargs kill -9 2>/dev/null || true
lsof -ti:3005 | xargs kill -9 2>/dev/null || true

echo "✅ All services stopped"

