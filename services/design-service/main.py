from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import os
import uuid
import time
import logging

from penpot_client import create_penpot_workspace

logger = logging.getLogger(__name__)

app = FastAPI(title="Design Service")

# ========== CORS (VERY IMPORTANT) ==========
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # Next.js UI
        "http://127.0.0.1:3000",
        "http://localhost:9001",   # Penpot in browser
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========== STORAGE ==========
BASE_STORAGE_PATH = "/app/penpot_submissions"
os.makedirs(BASE_STORAGE_PATH, exist_ok=True)

@app.get("/")
def root():
    return {"message": "Design Service Running"}

@app.get("/health")
def health():
    return {"status": "healthy", "time": time.time()}

# ========== MAIN ENDPOINT ==========
@app.post("/api/v1/design/penpot-session")
def create_penpot_session(
    candidate_id: str = Query(...),
    test_id: str = Query(...)
):
    session_id = f"session_{uuid.uuid4()}"

    candidate_path = f"{BASE_STORAGE_PATH}/{candidate_id}"
    session_path = f"{candidate_path}/{session_id}"
    os.makedirs(session_path, exist_ok=True)

    # Create Penpot project + file and get workspace URL with file context
    try:
        iframe_url, team_id, project_id, file_id = create_penpot_workspace(
            candidate_id=candidate_id,
            test_id=test_id,
            session_id=session_id,
        )
    except Exception as e:
        logger.exception("Penpot API failed, falling back to workspace URL")
        # Fallback: workspace URL without file (user must be logged in)
        penpot_uri = os.getenv("PENPOT_PUBLIC_URI", "http://localhost:9001")
        iframe_url = f"{penpot_uri}/#/workspace?token={session_id}&embed=true"
        team_id = project_id = file_id = None

    return {
        "candidate_id": candidate_id,
        "test_id": test_id,
        "session_id": session_id,
        "iframe_url": iframe_url,
        "storage_path": session_path,
        "team_id": team_id,
        "project_id": project_id,
        "file_id": file_id,
    }
