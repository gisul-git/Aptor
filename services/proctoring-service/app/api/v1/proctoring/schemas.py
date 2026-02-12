"""
Unified Proctoring Log Schemas
"""
from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Any, Literal
from enum import Enum

from pydantic import BaseModel, Field


class ProctoringLogSeverity(str, Enum):
    """Severity levels for proctoring events"""
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class ProctoringLogSource(str, Enum):
    """Source of the proctoring event"""
    CLIENT = "client"
    AI_SERVICE = "ai-service"
    LIVE_PROCTOR = "live-proctor"


class ProctoringLogIn(BaseModel):
    """Input model for creating a proctoring log entry"""
    assessmentId: str = Field(..., description="Assessment ID")
    candidateId: str = Field(..., description="Candidate ID (user ID or email)")
    candidateEmail: str = Field(..., description="Candidate email")
    eventType: str = Field(..., description="Type of proctoring event")
    severity: ProctoringLogSeverity = Field(default=ProctoringLogSeverity.INFO, description="Severity level")
    timestamp: str = Field(..., description="ISO8601 timestamp when event occurred")
    meta: Optional[Dict[str, Any]] = Field(default=None, description="Structured metadata")
    snapshotRef: Optional[str] = Field(default=None, description="S3/GCS reference to snapshot image")
    recordingRef: Optional[str] = Field(default=None, description="S3/GCS reference to recording")
    source: ProctoringLogSource = Field(default=ProctoringLogSource.CLIENT, description="Event source")
    createdBy: Optional[str] = Field(default=None, description="User ID who created this log (for live proctor events)")


class ProctoringLogOut(BaseModel):
    """Output model for a proctoring log entry"""
    id: str = Field(..., alias="_id", description="Log entry ID")
    assessmentId: str
    candidateId: str
    candidateEmail: str
    eventType: str
    severity: ProctoringLogSeverity
    timestamp: str
    meta: Optional[Dict[str, Any]] = None
    snapshotRef: Optional[str] = None
    recordingRef: Optional[str] = None
    source: ProctoringLogSource
    createdBy: Optional[str] = None
    createdAt: str = Field(..., description="ISO8601 timestamp when log was created")
    
    class Config:
        populate_by_name = True  # Allow both 'id' and '_id' to work


class ProctoringLogsResponse(BaseModel):
    """Paginated response for proctoring logs"""
    logs: List[ProctoringLogOut]
    totalCount: int
    page: int
    pageSize: int
    totalPages: int


class CandidateTimelineResponse(BaseModel):
    """Timeline response for a candidate"""
    candidateId: str
    candidateEmail: str
    assessmentId: str
    events: List[ProctoringLogOut]
    totalEvents: int


class ProctoringExportRequest(BaseModel):
    """Request model for exporting proctoring logs"""
    format: Literal["csv", "json"] = Field(default="csv", description="Export format")
    filters: Optional[Dict[str, Any]] = Field(default=None, description="Filter criteria")
    startDate: Optional[str] = Field(default=None, description="Start date (ISO8601)")
    endDate: Optional[str] = Field(default=None, description="End date (ISO8601)")
    eventTypes: Optional[List[str]] = Field(default=None, description="Filter by event types")
    severities: Optional[List[ProctoringLogSeverity]] = Field(default=None, description="Filter by severities")
    candidateIds: Optional[List[str]] = Field(default=None, description="Filter by candidate IDs")


class ProctoringExportResponse(BaseModel):
    """Response model for export request"""
    exportId: str
    downloadUrl: str = Field(..., description="Signed URL for downloading the export")
    expiresAt: str = Field(..., description="ISO8601 timestamp when URL expires")
    format: str
    recordCount: int

