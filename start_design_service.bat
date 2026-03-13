@echo off
cd services\design-service
echo Starting Design Service...
echo Note: Make sure OPENAI_API_KEY is set in services/design-service/.env file
python -m uvicorn main:app --host 0.0.0.0 --port 3007 --reload
