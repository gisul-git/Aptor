#!/bin/bash
# Diagnostic script for Design Service

echo "=== Design Service Diagnostics ==="
echo ""

echo "1. Checking Python version..."
python --version

echo ""
echo "2. Checking installed packages..."
pip list | grep -E "fastapi|uvicorn|motor|pydantic"

echo ""
echo "3. Checking if main.py exists..."
ls -la main.py

echo ""
echo "4. Testing Python imports..."
python -c "from app.core.config import settings; print('Config OK')"
python -c "from app.models.design import DesignQuestionModel; print('Models OK')"
python -c "from app.db.mongo import connect_to_mongo; print('DB OK')"

echo ""
echo "5. Checking environment variables..."
env | grep -E "MONGODB|OPENAI|PENPOT"

echo ""
echo "=== End Diagnostics ==="