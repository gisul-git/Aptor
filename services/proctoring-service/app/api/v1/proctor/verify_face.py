"""
Face Verification Endpoint
Uses DeepFace (ArcFace) to compare reference face with live frame
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from datetime import datetime
import logging

from app.services.face_verification_service import face_verification_service

logger = logging.getLogger(__name__)
router = APIRouter()


class FaceVerificationRequest(BaseModel):
    """Request model for face verification"""
    assessmentId: str = Field(..., description="Assessment ID")
    candidateId: str = Field(..., description="Candidate ID or email")
    referenceImage: str = Field(..., description="Reference image as base64 data URL")
    liveImage: str = Field(..., description="Live frame image as base64 data URL")


class FaceVerificationResponse(BaseModel):
    """Response model for face verification"""
    success: bool
    match: bool
    similarity: float
    confidence: float
    reason: str
    metadata: dict


@router.post("/verify-face", response_model=FaceVerificationResponse)
async def verify_face(request: FaceVerificationRequest):
    """
    Verify if live frame matches reference face using DeepFace (ArcFace).

    This endpoint:
    1. Receives reference image and live frame as base64
    2. Compares faces using DeepFace ArcFace model (512-D embeddings)
    3. Returns match result with similarity score

    Used by frontend aiProctoring.ts during assessment for Tier 2 verification.
    """
    try:
        logger.info(
            "[VerifyFace] Request for assessment: %s, candidate: %s",
            request.assessmentId,
            request.candidateId,
        )

        if not face_verification_service.model_loaded:
            raise HTTPException(
                status_code=503,
                detail="Face verification service not ready. Model not loaded.",
            )

        result = face_verification_service.verify_faces(
            reference_image_data=request.referenceImage,
            live_image_data=request.liveImage,
        )

        if not result.get("success", False):
            error_code = result.get("code", "UNKNOWN_ERROR")
            error_msg = result.get("error", "Verification failed")
            if error_code in ("NO_FACE_REFERENCE", "NO_FACE_LIVE", "NO_FACE_DETECTED"):
                raise HTTPException(status_code=400, detail=error_msg)
            if error_code == "INVALID_IMAGE":
                raise HTTPException(status_code=400, detail=error_msg)
            raise HTTPException(status_code=500, detail=error_msg)

        result["metadata"] = dict(result.get("metadata", {}))
        result["metadata"].update({
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "assessmentId": request.assessmentId,
            "candidateId": request.candidateId,
        })

        logger.info(
            "[VerifyFace] ✅ Result - Match: %s, Similarity: %.2f",
            result["match"],
            result["similarity"],
        )

        return FaceVerificationResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        logger.exception("[VerifyFace] Unexpected error: %s", str(e))
        raise HTTPException(
            status_code=500, detail=f"Internal server error: {str(e)}"
        ) from e
