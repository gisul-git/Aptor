from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Any

from pydantic import BaseModel, Field


# Supported proctoring event types
PROCTOR_EVENT_TYPES = {
    "TAB_SWITCH",
    "FULLSCREEN_EXIT",
    "FULLSCREEN_ENABLED",
    "FULLSCREEN_REFUSED",
    "COPY_RESTRICT",
    "FOCUS_LOST",
    "DEVTOOLS_OPEN",
    "SCREENSHOT_ATTEMPT",
    "PASTE_ATTEMPT",
    "RIGHT_CLICK",
    "IDLE",
    "GAZE_AWAY",
    "GAZE_AWAY_DETECTED",
    "MULTI_FACE",
    "MULTIPLE_FACE_DETECTED",
    "SPOOF_DETECTED",
    "FACE_MISMATCH",
    "CAMERA_DENIED",
    "CAMERA_ERROR",
    "PRECHECK_WARNING",
    "REFERENCE_PHOTO_CAPTURED",
    # New unified proctoring engine events
    "NO_FACE_DETECTED",
    "MULTIPLE_FACES_DETECTED",
    "FACE_OBSTRUCTED",
    "COPY_PASTE_ATTEMPT",
    # Live human proctoring events
    "PROCTOR_SESSION_STARTED",
    "PROCTOR_SESSION_VIEWING",
    "PROCTOR_SESSION_ENDED",
    # USB device monitoring events
    "USB_DEVICE_CONNECTED",
    "USB_DEVICE_DISCONNECTED",
    "USB_DEVICE_CHANGED",
    "USB_STORAGE_DETECTED",
    "USB_KEYBOARD_DETECTED",
    "USB_NETWORK_DETECTED",
    # Admin flagging events
    "ADMIN_FLAGGED",
}

# Human-readable labels for event types
EVENT_TYPE_LABELS: Dict[str, str] = {
    "TAB_SWITCH": "Tab switch detected",
    "FULLSCREEN_EXIT": "Fullscreen was exited",
    "FULLSCREEN_ENABLED": "Fullscreen was enabled",
    "FULLSCREEN_REFUSED": "Fullscreen was declined",
    "COPY_RESTRICT": "Copy restriction violated",
    "FOCUS_LOST": "Window focus was lost",
    "DEVTOOLS_OPEN": "Developer tools opened",
    "SCREENSHOT_ATTEMPT": "Screenshot attempt detected",
    "PASTE_ATTEMPT": "Paste attempt blocked",
    "RIGHT_CLICK": "Right click blocked",
    "IDLE": "Idle timeout detected",
    "GAZE_AWAY": "Gaze away detected",
    "GAZE_AWAY_DETECTED": "Gaze away from screen detected",
    "MULTI_FACE": "Multiple faces detected",
    "MULTIPLE_FACE_DETECTED": "Multiple faces detected in camera",
    "SPOOF_DETECTED": "Spoof attempt detected",
    "FACE_MISMATCH": "Face doesn't match verified identity",
    "CAMERA_DENIED": "Camera access was denied",
    "CAMERA_ERROR": "Camera error occurred",
    "PRECHECK_WARNING": "Pre-check warning",
    "REFERENCE_PHOTO_CAPTURED": "Reference photo captured",
    # New unified proctoring engine events
    "NO_FACE_DETECTED": "No face detected in camera",
    "MULTIPLE_FACES_DETECTED": "Multiple faces detected in camera",
    "FACE_OBSTRUCTED": "Face is obstructed or not visible",
    "COPY_PASTE_ATTEMPT": "Copy/paste attempt detected",
    # Live human proctoring events
    "PROCTOR_SESSION_STARTED": "Human proctor session started",
    "PROCTOR_SESSION_VIEWING": "Proctor is viewing candidate",
    "PROCTOR_SESSION_ENDED": "Human proctor session ended",
    # USB device monitoring events
    "USB_DEVICE_CONNECTED": "USB device connected",
    "USB_DEVICE_DISCONNECTED": "USB device disconnected",
    "USB_DEVICE_CHANGED": "USB device changed",
    "USB_STORAGE_DETECTED": "USB storage device detected",
    "USB_KEYBOARD_DETECTED": "USB keyboard detected",
    "USB_NETWORK_DETECTED": "USB network adapter detected",
    # Admin flagging events
    "ADMIN_FLAGGED": "Flagged by admin",
}


class ProctorEventIn(BaseModel):
    """Input model for recording a proctoring event."""
    userId: str = Field(..., min_length=1, max_length=255, description="Candidate user ID (email)")
    assessmentId: str = Field(..., min_length=1, max_length=100, description="Assessment ID")
    eventType: str = Field(..., min_length=1, max_length=50, description="Type of proctoring event")
    timestamp: str = Field(..., description="ISO8601 timestamp when event occurred")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional event metadata")
    snapshotBase64: Optional[str] = Field(default=None, description="Base64 encoded screenshot/snapshot")
    snapshotId: Optional[str] = Field(default=None, description="ID of uploaded snapshot (from /upload endpoint)")


class ProctorEventOut(BaseModel):
    """Output model for a proctoring event document."""
    id: str = Field(..., alias="_id", description="Document ID")
    userId: str
    assessmentId: str
    eventType: str
    timestamp: str
    metadata: Optional[Dict[str, Any]] = None
    snapshotBase64: Optional[str] = None
    receivedAt: str = Field(..., description="ISO8601 timestamp when event was received by server")

    class Config:
        populate_by_name = True


class ProctorSummaryOut(BaseModel):
    """Output model for proctoring summary."""
    summary: Dict[str, int] = Field(..., description="Count of each event type")
    totalViolations: int = Field(..., description="Total number of violations")
    violations: List[Dict[str, Any]] = Field(..., description="List of all violation documents")
    eventTypeLabels: Dict[str, str] = Field(
        default_factory=lambda: EVENT_TYPE_LABELS,
        description="Human-readable labels for event types"
    )


# Session lifecycle models
class StartSessionRequest(BaseModel):
    """Request to start a proctoring session."""
    assessmentId: str = Field(..., description="Assessment ID")
    userId: str = Field(..., description="Candidate user ID (email)")
    ai_proctoring: bool = Field(..., description="AI proctoring enabled")
    consent: bool = Field(..., description="User consent given")
    metadata: Optional[Dict[str, Any]] = Field(default=None, description="Additional session metadata")


class StopSessionRequest(BaseModel):
    """Request to stop a proctoring session."""
    assessmentId: str = Field(..., description="Assessment ID")
    userId: str = Field(..., description="Candidate user ID (email)")
    reason: Optional[str] = Field(default=None, description="Reason for stopping session")


# ============================================================================
# Live Proctoring Schemas
# ============================================================================

class LiveProctoringStartSessionRequest(BaseModel):
    """Request to start a Live Proctoring session."""
    assessmentId: str = Field(..., description="Assessment ID")
    candidateId: str = Field(..., description="Candidate ID (email)")


class LiveProctoringSessionResponse(BaseModel):
    """Response for Live Proctoring session creation."""
    sessionId: str = Field(..., description="Session ID")
    assessmentId: str = Field(..., description="Assessment ID")
    candidateId: str = Field(..., description="Candidate ID")
    status: str = Field(..., description="Session status")
    createdAt: str = Field(..., description="ISO timestamp")


class LiveProctoringSessionData(BaseModel):
    """Live Proctoring session data."""
    sessionId: str
    assessmentId: str
    candidateId: str
    status: str  # "candidate_initiated" | "offer_sent" | "active" | "ended"
    offer: Optional[Dict[str, Any]] = None  # RTCSessionDescription
    answer: Optional[Dict[str, Any]] = None  # RTCSessionDescription
    candidateICE: List[Dict[str, Any]] = Field(default_factory=list)  # ICE candidates
    adminICE: List[Dict[str, Any]] = Field(default_factory=list)  # ICE candidates
    createdAt: str
    updatedAt: str
    endedAt: Optional[str] = None
