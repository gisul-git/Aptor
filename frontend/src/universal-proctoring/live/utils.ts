// ============================================================================
// Universal Proctoring System - Live Proctoring Utilities
// ============================================================================

import { StreamType, TrackInfo } from "./types";

// ============================================================================
// Debug Logger
// ============================================================================

let liveDebugEnabled = false;

export function setLiveDebugMode(enabled: boolean): void {
  liveDebugEnabled = enabled;
}

export function isLiveDebugMode(): boolean {
  if (typeof window === "undefined") return liveDebugEnabled;
  const urlParams = new URLSearchParams(window.location.search);
  return (
    liveDebugEnabled ||
    urlParams.get("liveProctorDebug") === "true" ||
    process.env.NEXT_PUBLIC_LIVE_PROCTOR_DEBUG === "true"
  );
}

export function liveLog(prefix: string, msg: string, data?: unknown): void {
  // Always log important events (with emoji markers)
  if (
    isLiveDebugMode() ||
    msg.includes("✅") ||
    msg.includes("❌") ||
    msg.includes("⚠️")
  ) {
    console.log(`[${prefix}] ${msg}`, data !== undefined ? data : "");
  }
}

// ============================================================================
// WebSocket Helpers
// ============================================================================

/**
 * Create a WebSocket connection with timeout.
 * @param url - WebSocket URL
 * @param timeoutMs - Connection timeout in milliseconds
 * @returns Promise<WebSocket>
 */
export function createWebSocketConnection(
  url: string,
  timeoutMs: number = 10000
): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);

    const timeout = setTimeout(() => {
      socket.close();
      reject(new Error("WebSocket connection timeout"));
    }, timeoutMs);

    socket.onopen = () => {
      clearTimeout(timeout);
      resolve(socket);
    };

    socket.onerror = () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket connection failed"));
    };
  });
}

/**
 * Send a message through WebSocket if connected.
 * @param ws - WebSocket instance
 * @param message - Message object to send
 * @returns boolean - true if sent
 */
export function sendWebSocketMessage(
  ws: WebSocket | null,
  message: Record<string, unknown>
): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  try {
    ws.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error("[LiveProctoring] Error sending WebSocket message:", error);
    return false;
  }
}

// ============================================================================
// WebRTC Helpers
// ============================================================================

/**
 * Create an RTCPeerConnection with standard config.
 * @param config - Optional custom RTCConfiguration
 * @returns RTCPeerConnection
 */
export function createPeerConnection(
  config?: RTCConfiguration
): RTCPeerConnection {
  const defaultConfig: RTCConfiguration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  return new RTCPeerConnection(config || defaultConfig);
}

/**
 * Determine if a track is a screen share based on label and settings.
 * @param track - MediaStreamTrack
 * @param streamId - Stream ID
 * @returns StreamType
 */
export function detectStreamType(
  track: MediaStreamTrack,
  streamId?: string
): StreamType {
  const labelLower = (track.label || "").toLowerCase();
  const streamIdLower = (streamId || "").toLowerCase();

  // Check track label for screen keywords
  const isScreenByLabel =
    labelLower.includes("screen") ||
    labelLower.includes("display") ||
    labelLower.includes("window") ||
    streamIdLower.includes("screen");

  if (isScreenByLabel) {
    return "screen";
  }

  // Check track settings (more reliable for screen shares)
  try {
    const settings = track.getSettings();
    const displaySurface = (settings as any).displaySurface;
    if (
      displaySurface === "monitor" ||
      displaySurface === "window" ||
      displaySurface === "browser" ||
      displaySurface === "screen"
    ) {
      return "screen";
    }
  } catch (err) {
    // getSettings() might not be available in some browsers
  }

  return "webcam";
}

/**
 * Extract track info for logging/debugging.
 * @param track - MediaStreamTrack
 * @param stream - MediaStream
 * @returns TrackInfo
 */
export function extractTrackInfo(
  track: MediaStreamTrack,
  stream?: MediaStream
): TrackInfo {
  const streamId = stream?.id || "unknown";
  return {
    trackId: track.id,
    kind: track.kind as "video" | "audio",
    label: track.label,
    streamId,
    type: detectStreamType(track, streamId),
  };
}

/**
 * Add tracks from a MediaStream to a peer connection.
 * @param pc - RTCPeerConnection
 * @param stream - MediaStream
 * @param type - Stream type label for logging
 */
export function addStreamTracks(
  pc: RTCPeerConnection,
  stream: MediaStream,
  type: string
): void {
  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
    liveLog("WebRTC", `Added ${type} track: ${track.kind}`, {
      trackId: track.id,
      label: track.label,
    });
  });
}

// ============================================================================
// Media Stream Helpers
// ============================================================================

/**
 * Get webcam stream with standard constraints.
 * @returns Promise<MediaStream>
 */
export async function getWebcamStream(): Promise<MediaStream> {
  // ✅ PHASE 1: Always reuse pre-check camera
  const existingStream =
    typeof window !== 'undefined' ? (window as any).__cameraStream : null;

  if (existingStream?.active && existingStream.getVideoTracks().length > 0) {
    console.log('[Live Utils] ✅ Reusing camera from pre-check');
    return existingStream;
  }

  // ❌ NEVER request permissions again
  const error =
    'No camera stream available. Camera must be initialized during pre-check.';
  console.error('[Live Utils] ❌', error);
  throw new Error(error);
}

/**
 * Get screen stream from props or global storage.
 * @param propStream - Stream passed as prop
 * @returns MediaStream | null
 */
export function getAvailableScreenStream(
  propStream?: MediaStream | null
): MediaStream | null {
  // Check prop first
  if (propStream?.active) {
    const tracks = propStream.getVideoTracks();
    if (tracks.length > 0 && tracks[0].readyState === "live") {
      return propStream;
    }
  }

  // Check global storage
  if (typeof window !== "undefined") {
    const globalScreen = (window as unknown as { __screenStream?: MediaStream })
      .__screenStream;
    if (globalScreen?.active) {
      const tracks = globalScreen.getVideoTracks();
      if (tracks.length > 0 && tracks[0].readyState === "live") {
        return globalScreen;
      }
    }
  }

  return null;
}

/**
 * Stop all tracks in a MediaStream.
 * @param stream - MediaStream to stop
 */
export function stopStream(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
  }
}

// ============================================================================
// ICE Candidate Helpers
// ============================================================================

/**
 * Parse ICE candidate from various message formats.
 * @param candidateData - Raw candidate data from message
 * @returns RTCIceCandidate | null
 */
export function parseIceCandidate(
  candidateData: unknown
): RTCIceCandidate | null {
  if (!candidateData) return null;

  try {
    if (typeof candidateData === "object") {
      const data = candidateData as Record<string, unknown>;
      return new RTCIceCandidate({
        candidate: (data.candidate as string) || "",
        sdpMid: (data.sdpMid as string) || "0",
        sdpMLineIndex: (data.sdpMLineIndex as number) || 0,
      });
    }
    return null;
  } catch (error) {
    console.error("[LiveProctoring] Error parsing ICE candidate:", error);
    return null;
  }
}

/**
 * Format ICE candidate for sending via WebSocket.
 * @param candidate - RTCIceCandidate
 * @returns Object for JSON serialization
 */
export function formatIceCandidate(candidate: RTCIceCandidate): Record<string, unknown> {
  return {
    candidate: candidate.candidate,
    sdpMid: candidate.sdpMid,
    sdpMLineIndex: candidate.sdpMLineIndex,
  };
}
