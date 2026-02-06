from __future__ import annotations

import logging
import uuid
import json
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, Optional, Set
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form, WebSocket, WebSocketDisconnect
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel
import base64

from ....db.mongo import get_db
from .schemas import (
    ProctorEventIn, 
    ProctorSummaryOut, 
    EVENT_TYPE_LABELS,
    StartSessionRequest,
    StopSessionRequest,
    LiveProctoringStartSessionRequest,
    LiveProctoringSessionResponse,
    LiveProctoringSessionData,
)
from .websocket_manager import connection_manager
from .agora_service import generate_agora_token
from ....utils.responses import success_response
from ....utils.mongo import to_object_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/proctor", tags=["proctor"])


# ============================================================================
# AI Proctoring Endpoints (camera-based violations)
# ============================================================================

# Session Lifecycle Endpoints
# ============================================================================

@router.post("/start-session")
async def start_proctoring_session(
    payload: StartSessionRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Start a new proctoring session for a candidate.
    Creates a session record with timestamps and mode flags.
    """
    try:
        if not payload.consent:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User consent is required to start proctoring session"
            )
        
        # Check if there's an existing active session
        existing_session = await db.proctoring_sessions.find_one({
            "assessmentId": payload.assessmentId.strip(),
            "userId": payload.userId.strip(),
            "status": "active",
        })
        
        if existing_session:
            # Update existing session instead of creating new one
            await db.proctoring_sessions.update_one(
                {"_id": existing_session["_id"]},
                {
                    "$set": {
                        "ai_proctoring": payload.ai_proctoring,
                        "updatedAt": datetime.now(timezone.utc).isoformat(),
                    }
                }
            )
            session_id = str(existing_session["_id"])
        else:
            # Create new session
            session = {
                "assessmentId": payload.assessmentId.strip(),
                "userId": payload.userId.strip(),
                "ai_proctoring": payload.ai_proctoring,
                "status": "active",
                "startedAt": datetime.now(timezone.utc).isoformat(),
                "endedAt": None,
                "metadata": payload.metadata or {},
                "createdAt": datetime.now(timezone.utc).isoformat(),
                "updatedAt": datetime.now(timezone.utc).isoformat(),
            }
            
            result = await db.proctoring_sessions.insert_one(session)
            session_id = str(result.inserted_id)
        
        logger.info(
            f"[Proctor Session] Session started: {session_id} for user {payload.userId} "
            f"in assessment {payload.assessmentId} (AI: {payload.ai_proctoring})"
        )
        
        return success_response(
            "Proctoring session started",
            {
                "sessionId": session_id,
                "ai_proctoring": payload.ai_proctoring,
            }
        )
    
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"[Proctor Session] Error starting session: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start proctoring session: {str(exc)}"
        ) from exc
@router.post("/record")
async def record_proctor_event(
    payload: ProctorEventIn,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Record a proctoring event from the browser.
    
    This endpoint receives proctoring violation events (tab switches, fullscreen exits, etc.)
    and stores them in MongoDB for later review by admins.
    """
    try:
        # If snapshotId is provided, fetch the snapshot and include base64 for backward compatibility
        snapshot_base64 = payload.snapshotBase64
        if payload.snapshotId and not snapshot_base64:
            try:
                from bson import ObjectId
                snapshot = await db.proctor_snapshots.find_one({"_id": ObjectId(payload.snapshotId)})
                if snapshot:
                    snapshot_base64 = snapshot.get("snapshotBase64")
                    logger.info(f"[Proctor API] Fetched snapshot {payload.snapshotId} for event")
            except Exception as e:
                logger.warning(f"[Proctor API] Failed to fetch snapshot {payload.snapshotId}: {e}")
        
        # Create the document to storea
        proctor_event = {
            "userId": payload.userId.strip(),
            "assessmentId": payload.assessmentId.strip(),
            "eventType": payload.eventType.strip(),
            "timestamp": payload.timestamp,
            "metadata": payload.metadata,
            "snapshotBase64": snapshot_base64,  # Include for backward compatibility
            "snapshotId": payload.snapshotId,  # Store snapshotId for reference
            "receivedAt": datetime.now(timezone.utc).isoformat(),
        }

        # Log database and collection info before insert
        logger.info(f"[Proctor API] ===== record_proctor_event called =====)")
        logger.info(f"[Proctor API] Database name: {db.name}")
        collections = await db.list_collection_names()
        logger.info(f"[Proctor API] Available collections: {collections}")
        logger.info(f"[Proctor API] Collection 'proctor_events' exists: {'proctor_events' in collections}")
        logger.info(f"[Proctor API] Event data: userId={payload.userId}, assessmentId={payload.assessmentId}, eventType={payload.eventType}")
        
        # Insert into proctor_events collection
        logger.info("[Proctor API] Inserting event into proctor_events collection...")
        result = await db.proctor_events.insert_one(proctor_event)
        logger.info(f"[Proctor API] ✅ Event inserted successfully with ID: {result.inserted_id}")
        
        # Verify collection was created/updated
        collections_after = await db.list_collection_names()
        logger.info(f"[Proctor API] Collections after insert: {collections_after}")
        logger.info(f"[Proctor API] Collection 'proctor_events' exists now: {'proctor_events' in collections_after}")
        
        # Log the event
        logger.info(
            f"[Proctor API] Event recorded: {payload.eventType} for user {payload.userId} "
            f"in assessment {payload.assessmentId} (id: {result.inserted_id})"
        )
        
        # Log if snapshot was included
        if payload.snapshotBase64:
            logger.info(f"[Proctor API] Snapshot saved for event (id: {result.inserted_id})")

        return {"status": "ok", "id": str(result.inserted_id)}
    
    except Exception as exc:
        logger.exception(f"[Proctor] Error recording event: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to record proctoring event: {str(exc)}"
        ) from exc


@router.post("/upload")
async def upload_proctor_snapshot(
    file: UploadFile = File(...),
    metadata: str = Form(...),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Upload a proctoring snapshot (image file).
    
    This endpoint receives snapshot images from the frontend and stores them in MongoDB.
    Returns the snapshot ID which can be linked to violation records.
    """
    try:
        import json
        
        # Parse metadata JSON
        try:
            metadata_dict = json.loads(metadata)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid metadata JSON format"
            )
        
        # Validate required metadata fields
        required_fields = ["eventType", "timestamp", "assessmentId", "userId"]
        for field in required_fields:
            if field not in metadata_dict:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Missing required metadata field: {field}"
                )
        
        # Read file content
        file_content = await file.read()
        
        # Convert to base64 for storage
        snapshot_base64 = base64.b64encode(file_content).decode('utf-8')
        
        # Create snapshot document
        snapshot_doc = {
            "assessmentId": metadata_dict["assessmentId"].strip(),
            "userId": metadata_dict["userId"].strip(),
            "eventType": metadata_dict["eventType"].strip(),
            "timestamp": metadata_dict["timestamp"],
            "snapshotBase64": snapshot_base64,
            "contentType": file.content_type or "image/jpeg",
            "size": len(file_content),
            "metadata": {k: v for k, v in metadata_dict.items() if k not in ["assessmentId", "userId", "eventType", "timestamp"]},
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        
        # Insert into proctor_snapshots collection
        result = await db.proctor_snapshots.insert_one(snapshot_doc)
        snapshot_id = str(result.inserted_id)
        
        logger.info(
            f"[Proctor Upload] Snapshot saved: {snapshot_id} for user {metadata_dict['userId']} "
            f"in assessment {metadata_dict['assessmentId']} (event: {metadata_dict['eventType']}, size: {len(file_content)} bytes)"
        )
        
        return {
            "status": "ok",
            "id": snapshot_id,
        }
    
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"[Proctor Upload] Error uploading snapshot: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload snapshot: {str(exc)}"
        ) from exc


@router.get("/snapshot/{snapshotId}")
async def get_proctor_snapshot(
    snapshotId: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Retrieve a proctoring snapshot by ID.
    """
    try:
        from bson import ObjectId
        
        snapshot = await db.proctor_snapshots.find_one({"_id": ObjectId(snapshotId)})
        
        if not snapshot:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Snapshot not found"
            )
        
        return {
            "status": "ok",
            "id": str(snapshot["_id"]),
            "snapshotBase64": snapshot.get("snapshotBase64"),
            "contentType": snapshot.get("contentType", "image/jpeg"),
            "eventType": snapshot.get("eventType"),
            "timestamp": snapshot.get("timestamp"),
        }
    
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"[Proctor] Error fetching snapshot: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch snapshot: {str(exc)}"
        ) from exc


@router.get("/summary/{assessmentId}/{userId}")
async def get_proctor_summary(
    assessmentId: str,
    userId: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get proctoring violation summary for a specific candidate in an assessment.
    
    Returns:
    - summary: Count of each event type
    - totalViolations: Total number of violations
    - violations: List of all violation documents
    """
    try:
        # Query all events for this user and assessment
        query = {
            "assessmentId": assessmentId.strip(),
            "userId": userId.strip(),
        }
        
        cursor = db.proctor_events.find(query).sort("timestamp", 1)
        violations = []
        
        async for doc in cursor:
            # Convert ObjectId to string for JSON serialization
            doc["_id"] = str(doc["_id"])
            violations.append(doc)
        
        # Aggregate counts by event type
        summary: Dict[str, int] = {}
        for violation in violations:
            event_type = violation.get("eventType", "UNKNOWN")
            summary[event_type] = summary.get(event_type, 0) + 1
        
        total_violations = len(violations)
        
        logger.info(
            f"[Proctor] Summary fetched for user {userId} in assessment {assessmentId}: "
            f"{total_violations} total violations"
        )

        return success_response(
            "Proctoring summary fetched successfully",
            {
                "summary": summary,
                "totalViolations": total_violations,
                "violations": violations,
                "eventTypeLabels": EVENT_TYPE_LABELS,
            }
        )
    
    except Exception as exc:
        logger.exception(f"[Proctor] Error fetching summary: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch proctoring summary: {str(exc)}"
        ) from exc


@router.get("/logs/{assessmentId}/{userId}")
async def get_proctor_logs(
    assessmentId: str,
    userId: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get full proctoring logs for a specific candidate in an assessment.
    Returns all violation documents with metadata and snapshotBase64 for evidence gallery.
    
    If userId is "*", returns all logs for the assessment (for admin view).
    
    Returns:
    - logs: List of all violation documents sorted by timestamp (newest first)
    - totalCount: Total number of logs
    """
    try:
        logger.info(f"[Proctor API] ===== get_proctor_logs called =====)")
        logger.info(f"[Proctor API] Parameters: assessmentId={assessmentId}, userId={userId}")
        logger.info(f"[Proctor API] Database name: {db.name}")
        
        # Check if collection exists
        collections = await db.list_collection_names()
        logger.info(f"[Proctor API] Available collections in database '{db.name}': {collections}")
        logger.info(f"[Proctor API] Collection 'proctor_events' exists: {'proctor_events' in collections}")
        
        # Query all events for this user and assessment, sorted newest first
        # If userId is "*", return all logs for the assessment
        if userId.strip() == "*":
            query = {
                "assessmentId": assessmentId.strip(),
            }
            logger.info(f"[Proctor API] Fetching ALL logs for assessment {assessmentId}")
        else:
            query = {
                "assessmentId": assessmentId.strip(),
                "userId": userId.strip(),
            }
            logger.info(f"[Proctor API] Query filter: {query}")
        
        # Count documents matching query before fetching
        count = await db.proctor_events.count_documents(query)
        logger.info(f"[Proctor API] Documents matching query: {count}")
        
        # Use to_list with a reasonable limit to avoid timeout
        # Limit to 1000 most recent logs to prevent timeout issues
        logger.info("[Proctor API] Executing find query...")
        cursor = db.proctor_events.find(query).sort("timestamp", -1).limit(1000)
        logs = await cursor.to_list(length=1000)
        logger.info(f"[Proctor API] Query executed, fetched {len(logs)} documents")
        
            # Convert ObjectId to string for JSON serialization
        for doc in logs:
            doc["_id"] = str(doc["_id"])
            # Ensure snapshotBase64 is properly formatted if present
            if doc.get("snapshotBase64") and not doc["snapshotBase64"].startswith("data:"):
                # If it's raw base64, add data URI prefix (assume PNG format)
                doc["snapshotBase64"] = f"data:image/png;base64,{doc['snapshotBase64']}"
        
        logger.info(
            f"[Proctor API] Logs fetched for user {userId} in assessment {assessmentId}: "
            f"{len(logs)} total logs"
        )

        return success_response(
            "Proctoring logs fetched successfully",
            {
                "logs": logs,
                "totalCount": len(logs),
                "eventTypeLabels": EVENT_TYPE_LABELS,
            }
        )
    
    except Exception as exc:
        logger.exception(f"[Proctor API] Error fetching logs: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch proctoring logs: {str(exc)}"
        ) from exc


@router.get("/assessment/{assessmentId}/all")
async def get_all_proctor_events_for_assessment(
    assessmentId: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get all proctoring events for an assessment, grouped by user.
    
    Returns a dictionary where keys are userIds and values contain
    their violation summary and details.
    """
    try:
        # Query all events for this assessment
        query = {"assessmentId": assessmentId.strip()}
        
        cursor = db.proctor_events.find(query).sort("timestamp", 1)
        
        # Group by user
        users_data: Dict[str, Dict[str, Any]] = {}
        
        async for doc in cursor:
            user_id = doc.get("userId", "unknown")
            doc["_id"] = str(doc["_id"])
            
            if user_id not in users_data:
                users_data[user_id] = {
                    "violations": [],
                    "summary": {},
                    "totalViolations": 0,
                }
            
            users_data[user_id]["violations"].append(doc)
            event_type = doc.get("eventType", "UNKNOWN")
            users_data[user_id]["summary"][event_type] = users_data[user_id]["summary"].get(event_type, 0) + 1
            users_data[user_id]["totalViolations"] += 1
        
        logger.info(
            f"[Proctor API] All events fetched for assessment {assessmentId}: "
            f"{len(users_data)} users with violations"
        )

        return success_response(
            "All proctoring events fetched successfully",
            {
                "users": users_data,
                "eventTypeLabels": EVENT_TYPE_LABELS,
            }
        )
    
    except Exception as exc:
        logger.exception(f"[Proctor API] Error fetching all events: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch proctoring events: {str(exc)}"
        ) from exc


# ============================================================================
# Live Proctoring Endpoints
# ============================================================================

@router.post("/live/start-session")
async def start_live_proctoring_session(
    payload: LiveProctoringStartSessionRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Start a Live Proctoring session.
    Called ONCE by candidate when starting assessment.
    """
    try:
        import uuid
        from bson import ObjectId
        session_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        
        # Fetch candidate info (name, email) from users collection
        candidate_name = None
        candidate_email = None
        try:
            if ObjectId.is_valid(payload.candidateId):
                user_doc = await db.users.find_one({"_id": ObjectId(payload.candidateId)})
                if user_doc:
                    candidate_name = user_doc.get("name", user_doc.get("fullName"))
                    candidate_email = user_doc.get("email")
                    logger.info(f"[Live Proctoring] Found candidate info: {candidate_name} ({candidate_email})")
        except Exception as e:
            logger.warning(f"[Live Proctoring] Could not fetch candidate info: {e}")
        
        # Check for existing active session for this candidate+assessment
        existing_session = await db.live_proctor_sessions.find_one({
            "assessmentId": payload.assessmentId,
            "candidateId": payload.candidateId,
            "status": {"$nin": ["ended", "closed"]}  # Not closed/ended
        })
        
        if existing_session:
            logger.info(f"[Live Proctoring] Reusing existing live proctoring session for candidate {payload.candidateId} in assessment {payload.assessmentId}")
            return success_response(
                "Live Proctoring session started",
                LiveProctoringSessionResponse(
                    sessionId=existing_session["sessionId"],
                    assessmentId=payload.assessmentId,
                    candidateId=payload.candidateId,
                    status=existing_session.get("status", "candidate_initiated"),
                    createdAt=existing_session.get("createdAt", now),
                ).dict()
            )
        
        session_doc = {
            "sessionId": session_id,
            "assessmentId": payload.assessmentId,
            "candidateId": payload.candidateId,
            "candidateName": candidate_name,
            "candidateEmail": candidate_email,
            "status": "candidate_initiated",
            "offer": None,
            "answer": None,
            "candidateICE": [],
            "adminICE": [],
            "wsConnected": False,  # WebSocket connection status (persisted in DB)
            "wsLastSeen": None,  # Last heartbeat timestamp
            "createdAt": now,
            "updatedAt": now,
            "endedAt": None,
        }
        
        await db.live_proctor_sessions.insert_one(session_doc)
        
        logger.info(f"[Live Proctoring] Session started: {session_id} for candidate {candidate_name or payload.candidateId}")
        
        return success_response(
            "Live Proctoring session started",
            LiveProctoringSessionResponse(
                sessionId=session_id,
                assessmentId=payload.assessmentId,
                candidateId=payload.candidateId,
                status="candidate_initiated",
                createdAt=now,
            ).dict()
        )
    
    except Exception as exc:
        logger.exception(f"[Live Proctoring] Error starting session: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start Live Proctoring session: {str(exc)}"
        ) from exc


@router.post("/live/end-session/{session_id}")
async def end_live_proctoring_session(
    session_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    End a Live Proctoring session.
    Called ONCE by candidate when ending assessment.
    """
    try:
        now = datetime.now(timezone.utc).isoformat()
        
        result = await db.live_proctor_sessions.update_one(
            {"sessionId": session_id},
            {
                "$set": {
                    "status": "ended",
                    "endedAt": now,
                    "updatedAt": now,
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Session {session_id} not found"
            )
        
        # Notify all admins that session ended
        session = await db.live_proctor_sessions.find_one({"sessionId": session_id})
        if session:
            await connection_manager.send_to_admins(
                session["assessmentId"],
                {
                    "type": "session_ended",
                    "sessionId": session_id,
                }
            )
        
        # Disconnect candidate WebSocket
        await connection_manager.disconnect_candidate(session_id)
        
        logger.info(f"[Live Proctoring] Session ended: {session_id}")
        
        return success_response("Live Proctoring session ended", {"sessionId": session_id})
    
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"[Live Proctoring] Error ending session: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to end Live Proctoring session: {str(exc)}"
        ) from exc


@router.get("/live/all-sessions/{assessment_id}")
async def get_all_live_proctoring_sessions(
    assessment_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get all active Live Proctoring sessions for an assessment.
    Called by admin when opening dashboard.
    """
    try:
        cursor = db.live_proctor_sessions.find({
            "assessmentId": assessment_id,
            "status": {"$in": ["candidate_initiated", "offer_sent", "active"]}
        })
        
        sessions = []
        async for doc in cursor:
            sessions.append({
                "sessionId": doc["sessionId"],
                "candidateId": doc["candidateId"],
                "status": doc["status"],
                "createdAt": doc["createdAt"],
            })
        
        logger.info(f"[Live Proctoring] Fetched {len(sessions)} active sessions for assessment {assessment_id}")
        
        return success_response(
            "Active sessions fetched",
            {"sessions": sessions}
        )
    
    except Exception as exc:
        logger.exception(f"[Live Proctoring] Error fetching sessions: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch sessions: {str(exc)}"
        ) from exc


@router.post("/agora/get-token")
async def get_agora_token(
    payload: Dict[str, Any],
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Generate Agora token for live proctoring.

    Request body:
        { "assessmentId": str, "candidateId"?: str, "adminId"?: str, "role": "candidate" | "admin" }

    Returns: { "status": "ok", "token", "appId", "channel", "uid", "expiresAt", "candidateName"?, "candidateEmail"? }
    """
    try:
        from bson import ObjectId
        
        assessment_id = payload.get("assessmentId")
        candidate_id = payload.get("candidateId")
        admin_id = payload.get("adminId")
        role = payload.get("role", "candidate")

        if not assessment_id:
            raise HTTPException(status_code=400, detail="assessmentId is required")

        candidate_name = None
        candidate_email = None
        
        if role == "candidate":
            if not candidate_id:
                raise HTTPException(status_code=400, detail="candidateId required for candidate role")
            user_id = candidate_id
            
            logger.info(f"[Agora Token] 🔍 [DEBUG] Fetching candidate info for candidateId: {candidate_id}")
            logger.info(f"[Agora Token] 🔍 [DEBUG] Is ObjectId valid: {ObjectId.is_valid(candidate_id) if candidate_id else False}")
            
            # Fetch candidate info from users collection
            # Try ObjectId first, then email if ObjectId validation fails
            try:
                user_doc = None
                if ObjectId.is_valid(candidate_id):
                    # Try as ObjectId
                    logger.info(f"[Agora Token] 🔍 [DEBUG] Trying ObjectId lookup: {candidate_id}")
                    user_doc = await db.users.find_one({"_id": ObjectId(candidate_id)})
                else:
                    # Try as email (candidateId might be an email address)
                    logger.info(f"[Agora Token] 🔍 [DEBUG] Trying email lookup: {candidate_id}")
                    user_doc = await db.users.find_one({"email": candidate_id})
                
                if user_doc:
                    candidate_name = user_doc.get("name") or user_doc.get("fullName")
                    candidate_email = user_doc.get("email")
                    logger.info(f"[Agora Token] ✅ Found candidate info: {candidate_name} ({candidate_email})")
                    logger.info(f"[Agora Token] 🔍 [DEBUG] User doc keys: {list(user_doc.keys())}")
                else:
                    logger.warning(f"[Agora Token] ⚠️ Candidate not found in users collection: {candidate_id}")
            except Exception as e:
                logger.warning(f"[Agora Token] ❌ Could not fetch candidate info: {e}")
                import traceback
                logger.warning(f"[Agora Token] 🔍 [DEBUG] Traceback: {traceback.format_exc()}")
        else:
            if not admin_id:
                raise HTTPException(status_code=400, detail="adminId required for admin role")
            user_id = f"admin-{admin_id}"

        channel_name = assessment_id
        uid = user_id
        agora_role = "publisher" if role == "candidate" else "subscriber"
        token_data = generate_agora_token(channel_name, uid, agora_role)
        
        # Include candidate info in response (only for candidate role)
        response = {"status": "ok", **token_data}
        if role == "candidate":
            logger.info(f"[Agora Token] 🔍 [DEBUG] Preparing response - candidate_name: {candidate_name}, candidate_email: {candidate_email}")
            if candidate_name:
                response["candidateName"] = candidate_name
            if candidate_email:
                response["candidateEmail"] = candidate_email
            logger.info(f"[Agora Token] 🔍 [DEBUG] Response will include: candidateName={response.get('candidateName', 'MISSING')}, candidateEmail={response.get('candidateEmail', 'MISSING')}")
            
        return response
    except ValueError as ve:
        raise HTTPException(status_code=500, detail=str(ve))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to generate Agora token: {str(exc)}")


@router.websocket("/ws/live/candidate/{session_id}")
async def websocket_candidate(
    websocket: WebSocket,
    session_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    WebSocket endpoint for candidate signaling.
    Handles offer, ICE candidates from candidate.
    Sends answer, ICE candidates to candidate.
    
    Query params: candidate_id (required)
    """
    # Get candidate_id from query params
    candidate_id = websocket.query_params.get("candidate_id")
    if not candidate_id:
        await websocket.close(code=1008, reason="Missing candidate_id")
        return
    
    # Verify session exists
    session = await db.live_proctor_sessions.find_one({"sessionId": session_id})
    if not session:
        await websocket.close(code=1008, reason="Session not found")
        return
    
    if session["candidateId"] != candidate_id:
        await websocket.close(code=1008, reason="Unauthorized")
        return
    
    assessment_id = session["assessmentId"]
    
    logger.info(f"[Live Proctoring] Candidate WebSocket connecting: session_id={session_id}, candidate_id={candidate_id}, assessment_id={assessment_id}")
    logger.info(f"[Live Proctoring] Session document from DB: sessionId={session.get('sessionId')}, status={session.get('status')}, candidateId={session.get('candidateId')}")
    
    # Connect candidate
    await connection_manager.connect_candidate(session_id, assessment_id, websocket)
    
    # CRITICAL: Mark WebSocket as connected in MongoDB (persists across restarts)
    now = datetime.now(timezone.utc).isoformat()
    await db.live_proctor_sessions.update_one(
        {"sessionId": session_id},
        {
            "$set": {
                "wsConnected": True,
                "wsLastSeen": now,
                "updatedAt": now,
            }
        }
    )
    logger.info(f"[Live Proctoring] ✅ Marked session {session_id} as wsConnected=True in MongoDB")
    
    # Verify connection was registered
    is_registered = connection_manager.is_candidate_connected(session_id)
    logger.info(f"[Live Proctoring] After connect_candidate, is_candidate_connected({session_id}) = {is_registered}")
    logger.info(f"[Live Proctoring] All registered candidate connections: {list(connection_manager.candidate_connections.keys())}")
    
    # ✅ FIX: Notify all admins watching this assessment that a new candidate connected
    session_data = {
        "sessionId": session_id,
        "candidateId": session.get("candidateId"),
        "candidateName": session.get("candidateName"),
        "candidateEmail": session.get("candidateEmail"),
        "status": session.get("status"),
        "createdAt": session.get("createdAt"),
    }
    await connection_manager.send_to_admins(assessment_id, {
        "type": "candidate_connected",
        "session": session_data
    })
    logger.info(f"[Live Proctoring] 📢 Notified admins of assessment {assessment_id} about new candidate: {session_id}")
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            # Handle heartbeat ping (frontend sends this periodically)
            if msg_type == "ping":
                # Update last seen timestamp
                now = datetime.now(timezone.utc).isoformat()
                await db.live_proctor_sessions.update_one(
                    {"sessionId": session_id},
                    {
                        "$set": {
                            "wsLastSeen": now,
                            "wsConnected": True,  # Ensure it's still marked as connected
                            "updatedAt": now,
                        }
                    }
                )
                # Send pong response
                await websocket.send_text(json.dumps({"type": "pong"}))
                logger.debug(f"[Live Proctoring] Received ping from {session_id}, sent pong")
                continue
            
            if msg_type == "offer":
                # Candidate sent offer
                offer = message.get("offer")
                if offer:
                    await db.live_proctor_sessions.update_one(
                        {"sessionId": session_id},
                        {
                            "$set": {
                                "offer": offer,
                                "status": "offer_sent",
                                "updatedAt": datetime.now(timezone.utc).isoformat(),
                            }
                        }
                    )
                    logger.info(f"[Live Proctoring] Offer received from candidate {candidate_id}")
                    
                    # Fetch candidate name/email for notification
                    session_doc = await db.live_proctor_sessions.find_one({"sessionId": session_id})
                    candidate_name = session_doc.get("candidateName") if session_doc else None
                    candidate_email = session_doc.get("candidateEmail") if session_doc else None
                    
                    # Notify admins that new offer is available
                    await connection_manager.send_to_admins(
                        assessment_id,
                        {
                            "type": "new_session",
                            "sessionId": session_id,
                            "candidateId": candidate_id,
                            "candidateName": candidate_name,
                            "candidateEmail": candidate_email,
                        }
                    )
            
            elif msg_type == "ice":
                # Candidate sent ICE candidate - forward to admins immediately (don't store in DB)
                candidate_ice = {
                    "candidate": message.get("candidate"),
                    "sdpMid": message.get("sdpMid"),
                    "sdpMLineIndex": message.get("sdpMLineIndex"),
                }
                
                # Forward to admins immediately (real-time only, no DB storage)
                await connection_manager.send_to_admins(
                    assessment_id,
                    {
                        "type": "ice_candidate",
                        "sessionId": session_id,
                        "candidate": candidate_ice,
                    }
                )
    
    except WebSocketDisconnect:
        logger.info(f"[Live Proctoring] Candidate WebSocket disconnected: {session_id}")
    except Exception as exc:
        logger.exception(f"[Live Proctoring] Error in candidate WebSocket: {exc}")
    finally:
        logger.info(f"[Live Proctoring] Cleaning up candidate connection: {session_id}")
        logger.info(f"[Live Proctoring] Before disconnect, is_candidate_connected({session_id}) = {connection_manager.is_candidate_connected(session_id)}")
        
        # CRITICAL: Mark WebSocket as disconnected in MongoDB (persists across restarts)
        now = datetime.now(timezone.utc).isoformat()
        await db.live_proctor_sessions.update_one(
            {"sessionId": session_id},
            {
                "$set": {
                    "wsConnected": False,
                    "updatedAt": now,
                }
            }
        )
        logger.info(f"[Live Proctoring] ✅ Marked session {session_id} as wsConnected=False in MongoDB")
        
        await connection_manager.disconnect_candidate(session_id)
        logger.info(f"[Live Proctoring] After disconnect, is_candidate_connected({session_id}) = {connection_manager.is_candidate_connected(session_id)}")


@router.websocket("/ws/live/admin/{assessment_id}")
async def websocket_admin(
    websocket: WebSocket,
    assessment_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    WebSocket endpoint for admin signaling.
    Handles get_session, answer, ICE candidates from admin.
    Sends active_sessions, session_data, ICE candidates to admin.
    """
    # Connect admin
    await connection_manager.connect_admin(assessment_id, websocket)
    
    try:
        # Send active sessions immediately
        # CRITICAL: Only include sessions where candidate WebSocket is actually connected
        logger.info(f"[Live Proctoring] Admin connecting for assessment {assessment_id}, querying active sessions...")
        
        # IMPROVEMENT: Clean up old disconnected sessions (older than 1 hour)
        one_hour_ago = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        cleanup_result = await db.live_proctor_sessions.delete_many({
            "assessmentId": assessment_id,
            "wsConnected": False,
            "updatedAt": {"$lt": one_hour_ago}
        })
        if cleanup_result.deleted_count > 0:
            logger.info(f"[Live Proctoring] Cleaned up {cleanup_result.deleted_count} old disconnected sessions")
        
        # LAZY WEBRTC: Send ADMIN_CONNECTED signal to all connected candidates waiting for admin
        # FIX: Include all statuses (candidate_initiated, offer_sent, active) - not just candidate_initiated
        # This ensures candidates get the signal even if they already sent an offer
        cursor_ready = db.live_proctor_sessions.find({
            "assessmentId": assessment_id,
            "status": {"$in": ["candidate_initiated", "offer_sent", "active"]},  # All active statuses
            "wsConnected": True
        })
        admin_connected_count = 0
        async for doc in cursor_ready:
            session_id = doc["sessionId"]
            if connection_manager.is_candidate_connected(session_id):
                await connection_manager.send_to_candidate(session_id, {
                    "type": "ADMIN_CONNECTED",
                    "message": "Admin has opened the dashboard. You can now start WebRTC."
                })
                admin_connected_count += 1
                logger.info(f"[Live Proctoring] 🚀 Sent ADMIN_CONNECTED signal to candidate session {session_id} (status: {doc.get('status', 'unknown')})")
        
        if admin_connected_count > 0:
            logger.info(f"[Live Proctoring] ✅ Notified {admin_connected_count} ready candidates that admin connected")
        
        # Query for currently active sessions only (connected WebSocket + active status)
        cursor = db.live_proctor_sessions.find({
            "assessmentId": assessment_id,
            "status": {"$in": ["candidate_initiated", "offer_sent", "active"]},
            "wsConnected": True  # Only include sessions that are actually connected
        })
        
        sessions = []
        all_sessions_in_db = []
        connected_session_ids = list(connection_manager.candidate_connections.keys())
        
        async for doc in cursor:
            session_id = doc["sessionId"]
            candidate_id = doc.get("candidateId", "unknown")
            status = doc.get("status", "unknown")
            ws_connected_db = doc.get("wsConnected", False)  # Already filtered for True above
            
            all_sessions_in_db.append({
                "sessionId": session_id,
                "candidateId": candidate_id,
                "status": status,
                "wsConnected": ws_connected_db,
            })
            
            # Double-check: Verify WebSocket is still connected in memory
            is_connected_memory = connection_manager.is_candidate_connected(session_id)
            
            # If DB says connected but memory doesn't, candidate may have disconnected
            if ws_connected_db and not is_connected_memory:
                logger.warning(f"[Live Proctoring] ⚠️  Session {session_id} marked connected in DB but not in memory - marking as disconnected")
                # Update DB to reflect reality
                await db.live_proctor_sessions.update_one(
                    {"sessionId": session_id},
                    {"$set": {"wsConnected": False, "updatedAt": datetime.now(timezone.utc).isoformat()}}
                )
                continue  # Skip this session
            
            # Include session (already filtered for wsConnected=True from DB query)
            sessions.append({
                "sessionId": session_id,
                "candidateId": candidate_id,
                "candidateName": doc.get("candidateName"),
                "candidateEmail": doc.get("candidateEmail"),
                "status": status,
                "createdAt": doc["createdAt"],
            })
            logger.info(f"[Live Proctoring] ✅ INCLUDED: Session {session_id} (candidate: {doc.get('candidateName') or candidate_id}, status: {status}) - WebSocket connected")
        
        logger.info(f"[Live Proctoring] ===== Admin Connection Summary =====")
        logger.info(f"[Live Proctoring] Assessment ID: {assessment_id}")
        logger.info(f"[Live Proctoring] Total sessions in DB: {len(all_sessions_in_db)}")
        logger.info(f"[Live Proctoring] Sessions with connected WebSocket: {len(sessions)}")
        logger.info(f"[Live Proctoring] Currently connected candidate sessions: {connected_session_ids}")
        logger.info(f"[Live Proctoring] Sessions being sent to admin: {[s['sessionId'] for s in sessions]}")
        logger.info(f"[Live Proctoring] =====================================")
        
        await websocket.send_text(json.dumps({
            "type": "active_sessions",
            "sessions": sessions,
        }))
        
        # Handle messages from admin
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            if msg_type == "get_session":
                # Admin requests session data (offer)
                session_id = message.get("sessionId")
                session = await db.live_proctor_sessions.find_one({"sessionId": session_id})
                
                if session:
                    offer = session.get("offer")
                    candidate_id = session.get("candidateId", "unknown")
                    is_candidate_connected = connection_manager.is_candidate_connected(session_id)
                    updated_at_str = session.get("updatedAt")
                    
                    # FIX: Request fresh offer for reconnection scenarios
                    # - If no offer exists: Request fresh offer
                    # - If offer exists but is old (>30 seconds): Request fresh offer (reconnection scenario)
                    # - If offer is fresh (<30 seconds): Use existing offer (first connection)
                    should_request_fresh = False
                    if not offer and is_candidate_connected:
                        # No offer exists - request fresh
                        should_request_fresh = True
                    elif offer and is_candidate_connected and updated_at_str:
                        # Check if offer is stale (older than 30 seconds) - indicates reconnection
                        try:
                            updated_at = datetime.fromisoformat(updated_at_str.replace('Z', '+00:00'))
                            age_seconds = (datetime.now(timezone.utc) - updated_at).total_seconds()
                            if age_seconds > 30:  # Offer is older than 30 seconds - likely stale for reconnection
                                should_request_fresh = True
                                logger.info(f"[Live Proctoring] Offer for {session_id} is {age_seconds:.1f}s old - requesting fresh offer for reconnection")
                        except Exception as e:
                            logger.warning(f"[Live Proctoring] Error checking offer age: {e}, requesting fresh offer as fallback")
                            should_request_fresh = True
                    
                    if should_request_fresh:
                        try:
                            await connection_manager.send_to_candidate(session_id, {
                                "type": "request_offer"
                            })
                            logger.info(f"[Live Proctoring] Requested fresh offer from candidate {candidate_id} (session {session_id})")
                        except Exception as e:
                            logger.warning(f"[Live Proctoring] Failed to request offer from candidate {session_id}: {e}")
                    
                    # Return existing offer if available (for immediate use)
                    # Fresh offer will arrive later if requested
                    if offer:
                        await websocket.send_text(json.dumps({
                            "type": "session_data",
                            "sessionId": session_id,
                            "candidateId": candidate_id,
                            "offer": offer,
                        }))
                        logger.info(f"[Live Proctoring] Sent session data for {session_id} to admin (existing offer)")
                    elif is_candidate_connected:
                        # Candidate connected but no offer yet - return None, candidate will send offer
                        await websocket.send_text(json.dumps({
                            "type": "session_data",
                            "sessionId": session_id,
                            "candidateId": candidate_id,
                            "offer": None,
                        }))
                        logger.info(f"[Live Proctoring] Candidate {candidate_id} connected but no offer yet - requested fresh offer")
                    else:
                        # Candidate not connected - return None
                        await websocket.send_text(json.dumps({
                            "type": "session_data",
                            "sessionId": session_id,
                            "candidateId": candidate_id,
                            "offer": None,
                        }))
                        logger.info(f"[Live Proctoring] Admin requested session {session_id} but candidate not connected")
                else:
                    await websocket.send_text(json.dumps({
                        "type": "error",
                        "message": f"Session {session_id} not found",
                    }))
            
            elif msg_type == "answer":
                # Admin sent answer
                session_id = message.get("sessionId")
                answer = message.get("answer")
                
                if answer:
                    await db.live_proctor_sessions.update_one(
                        {"sessionId": session_id},
                        {
                            "$set": {
                                "answer": answer,
                                "status": "active",
                                "updatedAt": datetime.now(timezone.utc).isoformat(),
                            }
                        }
                    )
                    
                    # Send answer to candidate
                    await connection_manager.send_to_candidate(
                        session_id,
                        {
                            "type": "answer",
                            "answer": answer,
                        }
                    )
            
            elif msg_type == "ice":
                # Admin sent ICE candidate - forward to candidate immediately (don't store in DB)
                session_id = message.get("sessionId")
                admin_ice = {
                    "candidate": message.get("candidate"),
                    "sdpMid": message.get("sdpMid"),
                    "sdpMLineIndex": message.get("sdpMLineIndex"),
                }
                
                # Forward to candidate immediately (real-time only, no DB storage)
                await connection_manager.send_to_candidate(
                    session_id,
                    {
                        "type": "ice_candidate",
                        "candidate": admin_ice,
                    }
                )
    
    except WebSocketDisconnect:
        logger.info(f"[Live Proctoring] Admin disconnected: {assessment_id}")
    except Exception as exc:
        logger.exception(f"[Live Proctoring] Error in admin WebSocket: {exc}")
    finally:
        # Only disconnect if WebSocket is still in our connections
        # This prevents double-close errors
        try:
            if assessment_id in connection_manager.admin_connections:
                if websocket in connection_manager.admin_connections[assessment_id]:
                    await connection_manager.disconnect_admin(assessment_id, websocket)
        except Exception as e:
            logger.debug(f"[Live Proctoring] Error in finally block (likely already disconnected): {e}")



