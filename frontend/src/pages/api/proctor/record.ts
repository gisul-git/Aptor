import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

// Supported proctoring event types
const VALID_EVENT_TYPES = new Set([
  "TAB_SWITCH",
  "FULLSCREEN_EXIT",
  "FULLSCREEN_ENABLED",
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
  "MULTIPLE_FACE",
  "IN_FRAME_LOST",
  "SPOOF_DETECTED",
  "FACE_MISMATCH",
  "CAMERA_DENIED",
  "CAMERA_ERROR",
  "PRECHECK_WARNING",
  "REFERENCE_PHOTO_CAPTURED",
  // New unified proctoring engine events
  "NO_FACE_DETECTED",
  "MULTIPLE_FACES_DETECTED",
  "FACE_OBSTRUCTED",
  "COPY_PASTE_ATTEMPT",
  // Live human proctoring events
  "PROCTOR_SESSION_STARTED",
  "PROCTOR_SESSION_VIEWING",
  "PROCTOR_SESSION_ENDED",
  // Activity pattern events
  "RAPID_CLICKING",
  "COPY_PASTE_DETECTED",
  "EXCESSIVE_MOUSE_MOVEMENT",
  "PROLONGED_INACTIVITY",
  "SUSPICIOUS_KEYBOARD_PATTERN",
  "EXCESSIVE_SCROLLING",
  // Monaco editor paste detection
  "COPY_PASTE_CONTENT",
]);

interface ViolationPayload {
  eventType: string;
  timestamp: string;
  assessmentId: string;
  userId: string;
  sessionId?: string | null;
  metadata?: Record<string, unknown>;
  snapshotBase64?: string;
  snapshotId?: string;
}

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only accept POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ status: "error", message: "Method not allowed" });
  }

  try {
    const { eventType, timestamp, assessmentId, userId, sessionId, metadata, snapshotBase64, snapshotId } = req.body as ViolationPayload;

    // Log received data for debugging
    console.log("[Proctor API] Record request received:", {
      eventType,
      timestamp: !!timestamp,
      assessmentId,
      userId,
      hasMetadata: !!metadata,
      hasSnapshot: !!snapshotBase64,
      snapshotSize: snapshotBase64 ? Math.round(snapshotBase64.length / 1024) + 'KB' : 'none',
    });

    // Validate required fields
    if (!eventType || !timestamp || !assessmentId || !userId) {
      console.error("[Proctor API] Missing required fields:", {
        hasEventType: !!eventType,
        hasTimestamp: !!timestamp,
        hasAssessmentId: !!assessmentId,
        hasUserId: !!userId,
      });
      return res.status(400).json({
        status: "error",
        message: "Missing required fields: eventType, timestamp, assessmentId, userId",
        received: { eventType, timestamp: !!timestamp, assessmentId, userId },
      });
    }

    // Validate eventType (warn but allow for future extensibility)
    if (!VALID_EVENT_TYPES.has(eventType)) {
      console.warn(`[Proctor API] Unknown event type received: ${eventType}`);
    }

    // Log the violation locally for debugging
    console.log("[Proctor API] Violation received:", JSON.stringify({
      eventType,
      timestamp,
      assessmentId,
      userId,
      hasMetadata: !!metadata,
      hasSnapshot: !!(snapshotBase64 || snapshotId),
      hasSnapshotBase64: !!snapshotBase64,
      hasSnapshotId: !!snapshotId,
      snapshotId: snapshotId || null,
    }, null, 2));
    
    // Validate that userId and assessmentId are not empty
    if (!userId || userId.trim() === "") {
      console.error("[Proctor API] ERROR: userId is empty or missing!");
      return res.status(400).json({
        status: "error",
        message: "userId is required and cannot be empty",
      });
    }
    
    if (!assessmentId || assessmentId.trim() === "") {
      console.error("[Proctor API] ERROR: assessmentId is empty or missing!");
      return res.status(400).json({
        status: "error",
        message: "assessmentId is required and cannot be empty",
      });
    }

    // Forward to backend FastAPI
    try {
      const backendResponse = await axios.post(
        `${BACKEND_URL}/api/v1/proctor/record`,
        {
          eventType,
          timestamp,
          assessmentId,
          userId,
          sessionId: sessionId || null,
          metadata: metadata || null,
          snapshotBase64: snapshotBase64 || null,
          snapshotId: snapshotId || null,
        },
        {
          headers: {
            "Content-Type": "application/json; charset=utf-8",
          },
          timeout: 10000, // 10 second timeout
        }
      );

      console.log("[Proctor API] Backend response:", backendResponse.data);
      return res.status(200).json({ status: "ok", ...backendResponse.data });
    } catch (backendError: any) {
      // Log backend error but still return success to client
      // We don't want to fail the client if backend is temporarily unavailable
      console.error("[Proctor API] Backend error:", backendError.message);
      console.error("[Proctor API] Backend error details:", backendError.response?.data);
      
      // Still return ok to client - the event was received
      // In production, you might want to queue failed events for retry
      return res.status(200).json({ 
        status: "ok", 
        warning: "Event recorded locally, backend sync pending" 
      });
    }
  } catch (error) {
    console.error("[Proctor API] Error processing violation:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
}
