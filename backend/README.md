# FastAPI Backend

This directory now contains the Python/FastAPI implementation of the AI
Assessment Platform backend.

## Getting Started

1. **Create a virtual environment**

   ```bash
   cd backend
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   source .venv/bin/activate  # macOS/Linux
   ```

2. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

3. **Set environment variables**

   Create a `.env` file in the `backend` directory (alongside
   `requirements.txt`) and provide the following values as needed:

   ```env
   # MongoDB Configuration (used by both main app and DSA module)
   MONGO_URI=mongodb://localhost:27017/ai_assessment
   MONGO_DB=ai_assessment
   
   # JWT Configuration
   JWT_SECRET=change-me
   JWT_EXP_MINUTES=10080
   
   # OAuth
   GOOGLE_CLIENT_ID=your-google-client-id
   
   # AI Services
   OPENAI_API_KEY=your-openai-api-key
   GEMINI_API_KEY=your-gemini-api-key
   GEMINI_MODEL_SUMMARY=gemini-1.5-flash  # Optional, defaults to gemini-1.5-flash
   
   # Email Service (AWS SES)
   AWS_ACCESS_KEY=your-aws-access-key
   AWS_SECRET_KEY=your-aws-secret-key
   AWS_REGION=us-east-1
   AWS_EMAIL_SOURCE=sender@example.com
   
   # DSA Code Competency Module Configuration
   JUDGE0_URL=http://168.220.236.250:2358
   JUDGE0_TIMEOUT=60
   JUDGE0_POLL_INTERVAL=1.5
   JUDGE0_MAX_POLLS=20
   JUDGE0_API_KEY=  # Optional: For RapidAPI hosted Judge0
   ```

   Only the variables required for the features you use need to be set. For
   example, if email delivery is not required in your environment, you can omit
   the AWS values.
   
   **Note for DSA Module**: The DSA (Data Structures and Algorithms) code competency module uses:
   - The same MongoDB connection as the main app (via `MONGO_URI` and `MONGO_DB`)
   - Judge0 for code execution (configured via `JUDGE0_URL` and related variables)
   - OpenAI for AI feedback (uses `OPENAI_API_KEY` from main config)

4. **Run the application**

   ```bash
   uvicorn app.main:app --reload
   ```

   The API will be available at `http://localhost:8000`.

## Project Structure

```
backend/
  app/
    core/        # App configuration, auth dependencies, security helpers
    db/          # MongoDB connection helpers
    routers/     # FastAPI routers (auth, users, assessments)
    schemas/     # Pydantic models for request validation
    services/    # AI, OTP and other domain services
    utils/       # Shared utilities (responses, email, mongo helpers)
    main.py      # FastAPI application entry point
    __main__.py  # Allows `python -m app` to run the server
  requirements.txt
```

## Running Tests

Automated tests are not yet included. After installing dependencies and setting
environment variables, you can run manual checks by invoking key endpoints with
`curl` or an API client such as Postman.

