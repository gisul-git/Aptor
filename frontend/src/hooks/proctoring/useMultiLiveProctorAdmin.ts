/**
 * useMultiLiveProctorAdmin Hook - COMPLETE REBUILD
 * 
 * Admin-side Live Proctoring monitoring.
 * 
 * Architecture:
 * - Admin connects WebSocket to receive list of active candidate sessions
 * - For each candidate session: admin receives offer, creates answer
 * - Media streams flow P2P from candidate to admin
 * - Admin can disconnect/reconnect without affecting candidate streams
 */

import { useCallback, useRef, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";

interface CandidateStream {
  sessionId: string;
  candidateId: string;
  candidateName?: string;
  candidateEmail?: string;
  status: "connecting" | "connected" | "disconnected" | "failed";
  webcamStream: MediaStream | null;
  screenStream: MediaStream | null;
  error: string | null;
}

interface UseMultiLiveProctorAdminOptions {
  assessmentId: string;
  adminId: string;
  onError?: (error: string) => void;
  debugMode?: boolean;
}

interface UseMultiLiveProctorAdminReturn {
  candidateStreams: Map<string, CandidateStream>;
  activeCandidates: string[];
  isLoading: boolean;
  startMonitoring: () => Promise<void>;
  stopMonitoring: () => void;
  refreshCandidate: (sessionId: string) => Promise<void>;
}

// Module-level singleton to prevent React Strict Mode double connections
let adminSingleton: {
  assessmentId: string;
  ws: WebSocket | null;
  isConnecting: boolean;
} | null = null;

export function useMultiLiveProctorAdmin({
  assessmentId,
  adminId,
  onError,
  debugMode = false,
}: UseMultiLiveProctorAdminOptions): UseMultiLiveProctorAdminReturn {
  const [candidateStreams, setCandidateStreams] = useState<Map<string, CandidateStream>>(new Map());
  const [activeCandidates, setActiveCandidates] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const isMonitoringRef = useRef(false);

  // Logging - removed console logs as requested
  const log = useCallback((msg: string, data?: unknown) => {
    // Logging disabled - no console output
  }, []);

  // Update candidate stream state
  const updateCandidate = useCallback((sessionId: string, updates: Partial<CandidateStream>) => {
    setCandidateStreams(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(sessionId);
      if (existing) {
        newMap.set(sessionId, { ...existing, ...updates });
      }
      return newMap;
    });
  }, []);

  // Connect to a single candidate (receive their streams)
  const connectToCandidate = useCallback(async (
    sessionId: string,
    candidateId: string,
    offer: RTCSessionDescriptionInit
  ) => {
    log(`Connecting to candidate ${candidateId} (session: ${sessionId})...`);
    
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      log("❌ WebSocket not connected");
      return;
    }
    
    // Close existing peer connection if any
    const existingPc = peerConnectionsRef.current.get(sessionId);
    if (existingPc) {
      // Check if already connected/connecting
      if (existingPc.connectionState === "connected" || existingPc.connectionState === "connecting") {
        log(`Already connected/connecting to ${candidateId}, skipping`);
        return;
      }
      try { existingPc.close(); } catch (e) { /* ignore */ }
      peerConnectionsRef.current.delete(sessionId);
    }
    
    // Create peer connection
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    peerConnectionsRef.current.set(sessionId, pc);
    
    // Track received streams
    let trackCount = 0;
    
    // Handle incoming tracks - CRITICAL for receiving streams
    // NOTE: Tracks may be muted until ICE connection is established
    pc.ontrack = (event) => {
      trackCount++;
      const iceState = pc.iceConnectionState;
      const trackMuted = event.track.muted;
      
      log(`✅ Received track #${trackCount} for ${candidateId}:`, {
        kind: event.track.kind,
        id: event.track.id,
        streamId: event.streams[0]?.id,
        muted: trackMuted,
        iceConnectionState: iceState,
      });
      
      const stream = event.streams[0];
      if (!stream) {
        log("⚠️ No stream in track event");
        return;
      }
      
      // First video track = webcam, second = screen
      // IMPORTANT: Don't set status to "connected" here - wait for ICE connection
      // Tracks are muted until ICE connects, so frames won't flow yet
      if (trackCount === 1) {
        log(`✅ Webcam stream received: ${stream.id} (muted: ${trackMuted}, ICE: ${iceState})`);
        updateCandidate(sessionId, { webcamStream: stream });
        if (iceState === "connected" || iceState === "completed") {
          log(`✅ ICE already connected - webcam should be ready`);
          updateCandidate(sessionId, { status: "connected" });
        }
        
        // Monitor track unmute - this is when frames actually start flowing
        event.track.onunmute = () => {
          log(`🎬 Webcam track UNMUTED - frames should start flowing now!`);
        };
        event.track.onmute = () => {
          log(`⚠️ Webcam track MUTED - frames stopped`);
        };
      } else if (trackCount === 2) {
        log(`✅ Screen stream received: ${stream.id} (muted: ${trackMuted}, ICE: ${iceState})`);
        updateCandidate(sessionId, { screenStream: stream });
        if (iceState === "connected" || iceState === "completed") {
          log(`✅ ICE already connected - screen should be ready`);
          updateCandidate(sessionId, { status: "connected" });
        }
        
        // Monitor track unmute - this is when frames actually start flowing
        event.track.onunmute = () => {
          log(`🎬 Screen track UNMUTED - frames should start flowing now!`);
        };
        event.track.onmute = () => {
          log(`⚠️ Screen track MUTED - frames stopped`);
        };
      }
    };
    
    // Handle ICE candidates - send to candidate
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        log(`Generated ICE candidate for ${candidateId}:`, {
          candidate: event.candidate.candidate.substring(0, 50) + '...',
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          iceState: pc.iceConnectionState,
        });
        
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "ice",
            sessionId,
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          }));
          log(`✅ Sent ICE candidate to ${candidateId}`);
        } else {
          log(`⚠️ WebSocket not open, cannot send ICE candidate to ${candidateId}`);
        }
      } else {
        log(`ICE candidate gathering complete for ${candidateId} - final state: ${pc.iceConnectionState}`);
      }
    };
    
    // Handle ICE connection state - CRITICAL: Tracks are muted until ICE connects
    pc.oniceconnectionstatechange = () => {
      const iceState = pc.iceConnectionState;
      const connectionState = pc.connectionState;
      const signalingState = pc.signalingState;
      
      log(`ICE connection state for ${candidateId}: ${iceState} (connection: ${connectionState}, signaling: ${signalingState})`);
      
      // Log all ICE state transitions for debugging
      switch (iceState) {
        case "new":
          log(`🔄 ICE negotiation starting for ${candidateId}`);
          break;
        case "checking":
          log(`🔄 ICE checking in progress for ${candidateId}`);
          break;
        case "connected":
        case "completed":
          log(`✅ ICE ${iceState} for ${candidateId} - tracks should unmute and frames should flow!`);
          // Update status to connected - this is when frames actually start flowing
          updateCandidate(sessionId, { status: "connected" });
          
          // Log track states to verify they're unmuted
          setCandidateStreams(prev => {
            const candidate = prev.get(sessionId);
            if (candidate) {
              const webcamTracks = candidate.webcamStream?.getTracks() || [];
              const screenTracks = candidate.screenStream?.getTracks() || [];
              log(`Track states after ICE ${iceState} - Webcam: ${webcamTracks.map(t => `muted=${t.muted}, enabled=${t.enabled}`).join(', ')}, Screen: ${screenTracks.map(t => `muted=${t.muted}, enabled=${t.enabled}`).join(', ')}`);
            }
            return prev;
          });
          break;
        case "failed":
          log(`❌ ICE failed for ${candidateId} - connection cannot be established`);
          updateCandidate(sessionId, { status: "failed" });
          break;
        case "disconnected":
          log(`⚠️ ICE disconnected for ${candidateId}`);
          updateCandidate(sessionId, { status: "disconnected" });
          break;
        case "closed":
          log(`🔒 ICE closed for ${candidateId}`);
          break;
      }
    };
    
    // Handle connection state (secondary to ICE state)
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      log(`Connection state for ${candidateId}: ${state} (ICE: ${pc.iceConnectionState})`);
      
      // Only update status if ICE is also connected, otherwise ICE state handler takes precedence
      if (state === "connected" && (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed")) {
        updateCandidate(sessionId, { status: "connected" });
        log(`✅ Fully connected to ${candidateId}!`);
      } else if (state === "disconnected" || state === "failed") {
        updateCandidate(sessionId, { 
          status: state === "failed" ? "failed" : "disconnected" 
        });
        log(`⚠️ ${state} from ${candidateId}`);
      }
    };
    
    try {
      // Set remote description (candidate's offer)
      log("Setting remote description (offer)...");
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Create answer
      log("Creating answer...");
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Send answer to candidate via WebSocket
      ws.send(JSON.stringify({
        type: "answer",
        sessionId,
        answer: { type: answer.type, sdp: answer.sdp },
      }));
      log(`✅ Answer sent to ${candidateId}`);
      
      // Only set "connecting" if status is not already "connected" (prevents race condition with ontrack)
      setCandidateStreams(prev => {
        const existing = prev.get(sessionId);
        if (existing && existing.status !== "connected") {
          const newMap = new Map(prev);
          newMap.set(sessionId, { ...existing, status: "connecting" });
          return newMap;
        }
        return prev;
      });
      
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Connection failed";
      log(`❌ Error connecting to ${candidateId}: ${msg}`);
      updateCandidate(sessionId, { status: "failed", error: msg });
    }
  }, [log, updateCandidate]);

  // Start monitoring all candidates
  const startMonitoring = useCallback(async () => {
    // Singleton check - prevent duplicate connections
    if (adminSingleton?.assessmentId === assessmentId) {
      if (adminSingleton.isConnecting) {
        log("Connection already in progress (singleton)");
        return;
      }
      if (adminSingleton.ws?.readyState === WebSocket.OPEN) {
        log("Using existing singleton connection");
        wsRef.current = adminSingleton.ws;
        isMonitoringRef.current = true;
        return;
      }
    }
    
    if (isMonitoringRef.current) {
      log("Already monitoring");
      return;
    }
    
    // Set singleton immediately to prevent race conditions
    adminSingleton = { assessmentId, ws: null, isConnecting: true };
    
    setIsLoading(true);
    isMonitoringRef.current = true;
    
    try {
      log("✅ Starting admin monitoring...");
      
      // Connect WebSocket
      const wsUrl = `${API_URL.replace("http://", "ws://").replace("https://", "wss://")}/api/v1/proctor/ws/live/admin/${assessmentId}`;
      log(`Connecting WebSocket: ${wsUrl}`);
      
      const ws = await new Promise<WebSocket>((resolve, reject) => {
        const socket = new WebSocket(wsUrl);
        const timeout = setTimeout(() => {
          socket.close();
          reject(new Error("WebSocket timeout"));
        }, 10000);
        
        socket.onopen = () => {
          clearTimeout(timeout);
          log("✅ Admin WebSocket connected");
          adminSingleton = { assessmentId, ws: socket, isConnecting: false };
          resolve(socket);
        };
        
        socket.onerror = () => {
          clearTimeout(timeout);
          adminSingleton = null;
          reject(new Error("WebSocket connection failed"));
        };
      });
      
      wsRef.current = ws;
      
      // Handle WebSocket messages
      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          log(`WS message: ${msg.type}`, msg);
          
          if (msg.type === "active_sessions") {
            // List of active candidate sessions
            const sessions = msg.sessions as Array<{
              sessionId: string;
              candidateId: string;
              candidateName?: string;
              candidateEmail?: string;
              status: string;
            }>;
            
            log(`✅ Received ${sessions.length} active sessions`);
            
            // Initialize candidate streams
            const newStreams = new Map<string, CandidateStream>();
            const sessionIds: string[] = [];
            
            for (const sess of sessions) {
              sessionIds.push(sess.sessionId);
              newStreams.set(sess.sessionId, {
                sessionId: sess.sessionId,
                candidateId: sess.candidateId,
                candidateName: sess.candidateName,
                candidateEmail: sess.candidateEmail,
                status: "connecting",
                webcamStream: null,
                screenStream: null,
                error: null,
              });
              
              // Request session data (offer) for each session
              ws.send(JSON.stringify({
                type: "get_session",
                sessionId: sess.sessionId,
              }));
              log(`Requested session data for ${sess.candidateName || sess.candidateEmail || sess.candidateId}`);
            }
            
            setCandidateStreams(newStreams);
            setActiveCandidates(sessionIds);
            
          } else if (msg.type === "session_data") {
            // Received offer from candidate
            const { sessionId, candidateId, offer } = msg;
            
            if (!offer) {
              log(`⚠️ No offer for session ${sessionId}`);
              updateCandidate(sessionId, { 
                status: "failed", 
                error: "No offer available" 
              });
              return;
            }
            
            log(`✅ Received offer for ${candidateId}`);
            await connectToCandidate(sessionId, candidateId, offer);
            
          } else if (msg.type === "ice_candidate") {
            // ICE candidate from candidate
            const { sessionId, candidate } = msg;
            const pc = peerConnectionsRef.current.get(sessionId);
            
            log(`Received ICE candidate from candidate for ${sessionId}`, {
              hasPc: !!pc,
              hasRemoteDesc: !!pc?.remoteDescription,
              candidate: candidate,
            });
            
            if (!pc) {
              log(`⚠️ No peer connection for session ${sessionId} when ICE candidate received`);
              return;
            }
            
            if (!candidate) {
              log(`⚠️ No candidate data in ICE candidate message`);
              return;
            }
            
            // ICE candidates can arrive before remoteDescription is set - queue them
            if (!pc.remoteDescription) {
              log(`⚠️ Remote description not set yet, ICE candidate will be queued by browser`);
            }
            
            try {
              const candidateStr = typeof candidate === 'object' ? candidate.candidate : candidate;
              const sdpMid = typeof candidate === 'object' ? candidate.sdpMid : undefined;
              const sdpMLineIndex = typeof candidate === 'object' ? candidate.sdpMLineIndex : undefined;
              
              const ice = new RTCIceCandidate({
                candidate: candidateStr,
                sdpMid: sdpMid || "0",
                sdpMLineIndex: sdpMLineIndex !== undefined ? sdpMLineIndex : 0,
              });
              
              await pc.addIceCandidate(ice);
              log(`✅ Added ICE candidate for ${sessionId} - ICE state: ${pc.iceConnectionState}`);
            } catch (err) {
              // Log error but don't fail - might be duplicate
              log(`ICE candidate error for ${sessionId}: ${err}`);
            }
            
          } else if (msg.type === "new_session") {
            // New candidate joined
            const { sessionId, candidateId, candidateName, candidateEmail } = msg;
            log(`✅ New candidate: ${candidateName || candidateEmail || candidateId}`);
            
            setCandidateStreams(prev => {
              const newMap = new Map(prev);
              newMap.set(sessionId, {
                sessionId,
                candidateId,
                candidateName,
                candidateEmail,
                status: "connecting",
                webcamStream: null,
                screenStream: null,
                error: null,
              });
              return newMap;
            });
            
            setActiveCandidates(prev => [...prev, sessionId]);
            
            // Request their offer
            ws.send(JSON.stringify({
              type: "get_session",
              sessionId,
            }));
            
          } else if (msg.type === "session_ended") {
            // Candidate left
            const { sessionId } = msg;
            log(`⚠️ Session ended: ${sessionId}`);
            
            // Close peer connection
            const pc = peerConnectionsRef.current.get(sessionId);
            if (pc) {
              try { pc.close(); } catch (e) { /* ignore */ }
              peerConnectionsRef.current.delete(sessionId);
            }
            
            // Remove from state
            setCandidateStreams(prev => {
              const newMap = new Map(prev);
              newMap.delete(sessionId);
              return newMap;
            });
            
            setActiveCandidates(prev => prev.filter(id => id !== sessionId));
          }
        } catch (err) {
          log("Error processing message", err);
        }
      };
      
      ws.onclose = () => {
        log("⚠️ Admin WebSocket closed");
        isMonitoringRef.current = false;
        wsRef.current = null;
        if (adminSingleton?.assessmentId === assessmentId) {
          adminSingleton = null;
        }
      };
      
      ws.onerror = (err) => {
        log("❌ Admin WebSocket error", err);
      };
      
      setIsLoading(false);
      log("✅ Admin monitoring started");
      
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Monitoring failed";
      log(`❌ Error: ${msg}`);
      onError?.(msg);
      setIsLoading(false);
      isMonitoringRef.current = false;
      adminSingleton = null;
    }
  }, [assessmentId, log, onError, connectToCandidate, updateCandidate]);

  // Stop monitoring
  const stopMonitoring = useCallback(() => {
    log("✅ Stopping monitoring...");
    
    // Close all peer connections
    peerConnectionsRef.current.forEach((pc, sessionId) => {
      try { pc.close(); } catch (e) { /* ignore */ }
    });
    peerConnectionsRef.current.clear();
    
    // Close WebSocket
    if (wsRef.current) {
      try { wsRef.current.close(); } catch (e) { /* ignore */ }
      wsRef.current = null;
    }
    
    // Clear singleton
    if (adminSingleton?.assessmentId === assessmentId) {
      adminSingleton = null;
    }
    
    isMonitoringRef.current = false;
    setCandidateStreams(new Map());
    setActiveCandidates([]);
    
    log("✅ Monitoring stopped");
  }, [assessmentId, log]);

  // Refresh a single candidate's connection
  const refreshCandidate = useCallback(async (sessionId: string) => {
    log(`Refreshing candidate ${sessionId}...`);
    
    // Close existing connection
    const pc = peerConnectionsRef.current.get(sessionId);
    if (pc) {
      try { pc.close(); } catch (e) { /* ignore */ }
      peerConnectionsRef.current.delete(sessionId);
    }
    
    // Request new session data
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "get_session",
        sessionId,
      }));
    }
  }, [log]);

  return {
    candidateStreams,
    activeCandidates,
    isLoading,
    startMonitoring,
    stopMonitoring,
    refreshCandidate,
  };
}

