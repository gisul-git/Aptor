@echo off
cd services\design-service
set OPENAI_API_KEY=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
echo Starting Design Service with correct API key...
python -m uvicorn main:app --host 0.0.0.0 --port 3007 --reload
