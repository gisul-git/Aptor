"""
Unified Proctoring Log API Endpoints
"""
from __future__ import annotations

import logging
import csv
import json
import io
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Optional, Any
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, HTTPException, status, Query
from motor.motor_asyncio import AsyncIOMotorDatabase
from bson import ObjectId

from ....db.mongo import get_db
from .schemas import (
    ProctoringLogIn,
    ProctoringLogOut,
    ProctoringLogsResponse,
    CandidateTimelineResponse,
    ProctoringExportRequest,
    ProctoringExportResponse,
    ProctoringLogSeverity,
    ProctoringLogSource,
)
from ....utils.responses import success_response
from ....utils.mongo import to_object_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/proctoring", tags=["proctoring"])


# ============================================================================
# POST /api/v1/proctoring/log - Ingest Event
# ============================================================================

@router.post("/log", status_code=status.HTTP_201_CREATED)
async def create_proctoring_log(
    log_data: ProctoringLogIn,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Create a new proctoring log entry.
    
    This endpoint ingests proctoring events from:
    - Client-side monitoring (tab switches, copy/paste, etc.)
    - AI service (face detection, gaze tracking, etc.)
    - Live proctor actions
    
    All events are logged with full metadata for audit and analytics.
    """
    try:
        # Create the log document
        log_doc = {
            "assessmentId": log_data.assessmentId.strip(),
            "candidateId": log_data.candidateId.strip(),
            "candidateEmail": log_data.candidateEmail.strip(),
            "eventType": log_data.eventType.strip(),
            "severity": log_data.severity.value,
            "timestamp": log_data.timestamp,
            "meta": log_data.meta or {},
            "snapshotRef": log_data.snapshotRef,
            "recordingRef": log_data.recordingRef,
            "source": log_data.source.value,
            "createdBy": log_data.createdBy,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
        
        # Insert into proctoringLogs collection
        result = await db.proctoringLogs.insert_one(log_doc)
        
        logger.info(
            f"[ProctoringLog] Event logged: {log_data.eventType} "
            f"(severity: {log_data.severity.value}) for candidate {log_data.candidateEmail} "
            f"in assessment {log_data.assessmentId} (id: {result.inserted_id})"
        )
        
        return success_response(
            "Proctoring log created successfully",
            {"id": str(result.inserted_id)}
        )
    
    except Exception as exc:
        logger.exception(f"[ProctoringLog] Error creating log: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create proctoring log: {str(exc)}"
        ) from exc


# ============================================================================
# GET /api/v1/assessments/{id}/proctoring/logs - Paginated Logs
# ============================================================================

@router.get("/assessments/{assessment_id}/logs")
async def get_proctoring_logs(
    assessment_id: str,
    page: int = Query(default=1, ge=1, description="Page number"),
    pageSize: int = Query(default=50, ge=1, le=500, description="Page size"),
    eventType: Optional[str] = Query(default=None, description="Filter by event type"),
    severity: Optional[str] = Query(default=None, description="Filter by severity"),
    candidateId: Optional[str] = Query(default=None, description="Filter by candidate ID"),
    startDate: Optional[str] = Query(default=None, description="Start date (ISO8601)"),
    endDate: Optional[str] = Query(default=None, description="End date (ISO8601)"),
    source: Optional[str] = Query(default=None, description="Filter by source"),
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get paginated proctoring logs for an assessment.
    
    Supports filtering by:
    - eventType
    - severity
    - candidateId
    - date range (startDate, endDate)
    - source (client, ai-service, live-proctor)
    """
    try:
        # Build query
        query: Dict[str, Any] = {"assessmentId": assessment_id.strip()}
        
        if eventType:
            query["eventType"] = eventType.strip()
        
        if severity:
            try:
                ProctoringLogSeverity(severity)
                query["severity"] = severity
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid severity: {severity}"
                )
        
        if candidateId:
            query["candidateId"] = candidateId.strip()
        
        if source:
            try:
                ProctoringLogSource(source)
                query["source"] = source
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid source: {source}"
                )
        
        # Date range filter
        if startDate or endDate:
            timestamp_query: Dict[str, Any] = {}
            if startDate:
                timestamp_query["$gte"] = startDate
            if endDate:
                timestamp_query["$lte"] = endDate
            if timestamp_query:
                query["timestamp"] = timestamp_query
        
        # Count total matching documents
        total_count = await db.proctoringLogs.count_documents(query)
        
        # Calculate pagination
        skip = (page - 1) * pageSize
        total_pages = (total_count + pageSize - 1) // pageSize
        
        # Fetch logs (newest first)
        cursor = (
            db.proctoringLogs.find(query)
            .sort("timestamp", -1)
            .skip(skip)
            .limit(pageSize)
        )
        
        logs = await cursor.to_list(length=pageSize)
        
        # Convert ObjectId to string and prepare for Pydantic model
        for log in logs:
            log["_id"] = str(log["_id"])
        
        # Convert to output models (Pydantic will handle _id -> id alias)
        log_outs = [ProctoringLogOut(**log) for log in logs]
        
        logger.info(
            f"[ProctoringLog] Fetched {len(logs)} logs for assessment {assessment_id} "
            f"(page {page}/{total_pages}, total: {total_count})"
        )
        
        return success_response(
            "Proctoring logs fetched successfully",
            ProctoringLogsResponse(
                logs=log_outs,
                totalCount=total_count,
                page=page,
                pageSize=pageSize,
                totalPages=total_pages,
            ).dict()
        )
    
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception(f"[ProctoringLog] Error fetching logs: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch proctoring logs: {str(exc)}"
        ) from exc


# ============================================================================
# GET /api/v1/assessments/{id}/candidates/{cid}/timeline - Candidate Timeline
# ============================================================================

@router.get("/assessments/{assessment_id}/candidates/{candidate_id}/timeline")
async def get_candidate_timeline(
    assessment_id: str,
    candidate_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Get chronological timeline of all proctoring events for a specific candidate.
    
    Returns all events sorted by timestamp (oldest first) for a complete
    audit trail of the candidate's test session.
    """
    try:
        query = {
            "assessmentId": assessment_id.strip(),
            "candidateId": candidate_id.strip(),
        }
        
        # Fetch all logs for this candidate (oldest first for timeline)
        cursor = db.proctoringLogs.find(query).sort("timestamp", 1)
        logs = await cursor.to_list(length=10000)  # Reasonable limit
        
        # Convert ObjectId to string and prepare for Pydantic model
        for log in logs:
            log["_id"] = str(log["_id"])
        
        # Get candidate email from first log (if available)
        candidate_email = logs[0].get("candidateEmail", candidate_id) if logs else candidate_id
        
        # Convert to output models (Pydantic will handle _id -> id alias)
        log_outs = [ProctoringLogOut(**log) for log in logs]
        
        logger.info(
            f"[ProctoringLog] Timeline fetched for candidate {candidate_id} "
            f"in assessment {assessment_id}: {len(logs)} events"
        )
        
        return success_response(
            "Candidate timeline fetched successfully",
            CandidateTimelineResponse(
                candidateId=candidate_id,
                candidateEmail=candidate_email,
                assessmentId=assessment_id,
                events=log_outs,
                totalEvents=len(log_outs),
            ).dict()
        )
    
    except Exception as exc:
        logger.exception(f"[ProctoringLog] Error fetching timeline: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch candidate timeline: {str(exc)}"
        ) from exc


# ============================================================================
# POST /api/v1/assessments/{id}/proctoring/export - Export Logs
# ============================================================================

@router.post("/assessments/{assessment_id}/export")
async def export_proctoring_logs(
    assessment_id: str,
    export_request: ProctoringExportRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
):
    """
    Export proctoring logs to CSV or JSON format.
    
    Generates a file with filtered logs and returns a signed URL for download.
    In production, this would upload to S3/GCS and generate a signed URL.
    For now, returns a data URL or direct download.
    """
    try:
        # Build query (same as get_proctoring_logs)
        query: Dict[str, Any] = {"assessmentId": assessment_id.strip()}
        
        if export_request.eventTypes:
            query["eventType"] = {"$in": export_request.eventTypes}
        
        if export_request.severities:
            query["severity"] = {"$in": [s.value for s in export_request.severities]}
        
        if export_request.candidateIds:
            query["candidateId"] = {"$in": export_request.candidateIds}
        
        if export_request.startDate or export_request.endDate:
            timestamp_query: Dict[str, Any] = {}
            if export_request.startDate:
                timestamp_query["$gte"] = export_request.startDate
            if export_request.endDate:
                timestamp_query["$lte"] = export_request.endDate
            if timestamp_query:
                query["timestamp"] = timestamp_query
        
        if export_request.filters:
            query.update(export_request.filters)
        
        # Fetch all matching logs
        cursor = db.proctoringLogs.find(query).sort("timestamp", 1)
        logs = await cursor.to_list(length=100000)  # Large limit for export
        
        # Convert ObjectId to string
        for log in logs:
            log["_id"] = str(log["_id"])
        
        # Generate export file
        if export_request.format == "csv":
            # Generate CSV
            output = io.StringIO()
            if logs:
                fieldnames = [
                    "_id", "assessmentId", "candidateId", "candidateEmail",
                    "eventType", "severity", "timestamp", "source", "createdBy",
                    "createdAt", "snapshotRef", "recordingRef"
                ]
                writer = csv.DictWriter(output, fieldnames=fieldnames, extrasaction="ignore")
                writer.writeheader()
                
                for log in logs:
                    # Flatten meta dict to JSON string
                    row = {k: v for k, v in log.items() if k in fieldnames}
                    if "meta" in log and log["meta"]:
                        row["meta"] = json.dumps(log["meta"])
                    writer.writerow(row)
            
            file_content = output.getvalue()
            content_type = "text/csv"
            file_extension = "csv"
        
        else:  # JSON
            # Generate JSON
            file_content = json.dumps(logs, indent=2, default=str)
            content_type = "application/json"
            file_extension = "json"
        
        # In production, upload to S3/GCS and generate signed URL
        # For now, return a data URL (or implement file storage)
        import base64
        file_b64 = base64.b64encode(file_content.encode("utf-8")).decode("utf-8")
        data_url = f"data:{content_type};base64,{file_b64}"
        
        # Generate export ID
        export_id = str(ObjectId())
        
        # Calculate expiration (24 hours from now)
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
        
        logger.info(
            f"[ProctoringLog] Export generated for assessment {assessment_id}: "
            f"{len(logs)} records in {export_request.format} format"
        )
        
        return success_response(
            "Export generated successfully",
            ProctoringExportResponse(
                exportId=export_id,
                downloadUrl=data_url,  # In production, use signed S3/GCS URL
                expiresAt=expires_at,
                format=export_request.format,
                recordCount=len(logs),
            ).dict()
        )
    
    except Exception as exc:
        logger.exception(f"[ProctoringLog] Error exporting logs: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to export proctoring logs: {str(exc)}"
        ) from exc

