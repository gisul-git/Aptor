#!/bin/bash

echo "Starting DSA Service on port 3004..."
echo ""
echo "Make sure you have:"
echo "  1. OPENAI_API_KEY set in .env file"
echo "  2. MONGODB_URI set in .env file (optional but recommended)"
echo "  3. All Python dependencies installed"
echo ""

cd "$(dirname "$0")"
uvicorn main:app --host 0.0.0.0 --port 3004 --reload

