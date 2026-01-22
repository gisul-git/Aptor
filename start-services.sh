#!/bin/bash

# Script to start all microservices locally

echo "🚀 Starting Gisul AI Assessment Microservices..."
echo ""

# Check if MongoDB is running
if ! pgrep -x "mongod" > /dev/null; then
    echo "⚠️  MongoDB is not running. Please start MongoDB first."
    echo "   Run: mongod (or use Docker: docker-compose up -d mongo)"
    exit 1
fi

# Check if Redis is running (optional)
if ! pgrep -x "redis-server" > /dev/null; then
    echo "⚠️  Redis is not running. Some features may not work."
    echo "   Run: redis-server (or use Docker: docker-compose up -d redis)"
fi

# Start API Gateway
echo "📡 Starting API Gateway (port 80)..."
cd services/api-gateway
npm install > /dev/null 2>&1
npm start &
GATEWAY_PID=$!
cd ../..
sleep 2

# Start Auth Service
echo "🔐 Starting Auth Service (port 4000)..."
cd services/auth-service
source .venv/bin/activate 2>/dev/null || python -m venv .venv && source .venv/bin/activate
pip install -q -r requirements.txt 2>/dev/null
uvicorn main:app --host 0.0.0.0 --port 4000 &
AUTH_PID=$!
cd ../..
sleep 2

# Start AI Assessment Service
echo "🤖 Starting AI Assessment Service (port 3001)..."
cd services/ai-assessment-service
source .venv/bin/activate 2>/dev/null || python -m venv .venv && source .venv/bin/activate
pip install -q -r requirements.txt 2>/dev/null
uvicorn main:app --host 0.0.0.0 --port 3001 &
AI_ASSESSMENT_PID=$!
cd ../..
sleep 2

# Start Custom MCQ Service
echo "📝 Starting Custom MCQ Service (port 3002)..."
cd services/custom-mcq-service
source .venv/bin/activate 2>/dev/null || python -m venv .venv && source .venv/bin/activate
pip install -q -r requirements.txt 2>/dev/null
uvicorn main:app --host 0.0.0.0 --port 3002 &
CUSTOM_MCQ_PID=$!
cd ../..
sleep 2

# Start AIML Service
echo "🧠 Starting AIML Service (port 3003)..."
cd services/aiml-service
source .venv/bin/activate 2>/dev/null || python -m venv .venv && source .venv/bin/activate
pip install -q -r requirements.txt 2>/dev/null
uvicorn main:app --host 0.0.0.0 --port 3003 &
AIML_PID=$!
cd ../..
sleep 2

# Start DSA Service
echo "💻 Starting DSA Service (port 3004)..."
cd services/dsa-service
source .venv/bin/activate 2>/dev/null || python -m venv .venv && source .venv/bin/activate
pip install -q -r requirements.txt 2>/dev/null
uvicorn main:app --host 0.0.0.0 --port 3004 &
DSA_PID=$!
cd ../..
sleep 2

# Start Proctoring Service
echo "👁️  Starting Proctoring Service (port 3005)..."
cd services/proctoring-service
source .venv/bin/activate 2>/dev/null || python -m venv .venv && source .venv/bin/activate
pip install -q -r requirements.txt 2>/dev/null
uvicorn main:app --host 0.0.0.0 --port 3005 &
PROCTORING_PID=$!
cd ../..

echo ""
echo "✅ All services started!"
echo ""
echo "Service Status:"
echo "  API Gateway:      http://localhost:80"
echo "  Auth Service:     http://localhost:4000"
echo "  AI Assessment:    http://localhost:3001"
echo "  Custom MCQ:       http://localhost:3002"
echo "  AIML:             http://localhost:3003"
echo "  DSA:              http://localhost:3004"
echo "  Proctoring:       http://localhost:3005"
echo ""
echo "Process IDs:"
echo "  Gateway: $GATEWAY_PID"
echo "  Auth: $AUTH_PID"
echo "  AI Assessment: $AI_ASSESSMENT_PID"
echo "  Custom MCQ: $CUSTOM_MCQ_PID"
echo "  AIML: $AIML_PID"
echo "  DSA: $DSA_PID"
echo "  Proctoring: $PROCTORING_PID"
echo ""
echo "To stop all services, run: ./stop-services.sh"
echo "Or kill processes: kill $GATEWAY_PID $AUTH_PID $AI_ASSESSMENT_PID $CUSTOM_MCQ_PID $AIML_PID $DSA_PID $PROCTORING_PID"

