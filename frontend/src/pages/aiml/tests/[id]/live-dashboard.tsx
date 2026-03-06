'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import { AdminLiveService } from '../../../../universal-proctoring/live/AdminLiveService'
import { CandidateStreamInfo, AdminLiveState } from '../../../../universal-proctoring/live/types'
import { ArrowLeft, Maximize2, Minimize2, RefreshCw, Users, Loader2, Flag, X, Video, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useAIMLCandidates } from '@/hooks/api/useAIML'
import dynamic from 'next/dynamic'
import SuccessModal from '@/components/SuccessModal'

// Dynamically import FixedSizeGrid (react-window requires browser APIs)
const FixedSizeGrid = dynamic(
  () => import('react-window').then((mod) => (mod as any).FixedSizeGrid),
  { 
    ssr: false,
    loading: () => <div style={{ textAlign: "center", padding: "2rem", color: "#6B7280" }}>Loading grid...</div>
  }
) as any

// Server-side auth check
export const getServerSideProps: GetServerSideProps = requireAuth

interface CandidateData {
  sessionId: string
  candidateId: string
  candidateName?: string
  candidateEmail?: string
  webcamStream: MediaStream | null
  screenStream: MediaStream | null
  status: 'connecting' | 'connected' | 'failed' | 'disconnected'
}

interface LiveProctoringDashboardProps {
  isOpen?: boolean
  onClose?: () => void
  assessmentId?: string
  adminId?: string
}

export default function LiveProctoringDashboard({ 
  isOpen = true, 
  onClose,
  assessmentId: propAssessmentId,
  adminId: propAdminId 
}: LiveProctoringDashboardProps = {}) {
  // Assessment candidates list (for mapping candidateId to name/email)
  const router = useRouter()
  const { data: session } = useSession()
  const { id: routerAssessmentId } = router.query
  
  // Use prop assessmentId if provided, otherwise use router query
  const assessmentId = propAssessmentId || (typeof routerAssessmentId === 'string' ? routerAssessmentId : undefined)
  const adminId = propAdminId || session?.user?.email || session?.user?.id || 'admin'
  
  // React Query hook for candidates
  const { data: candidatesData } = useAIMLCandidates(assessmentId)
  const [assessmentCandidates, setAssessmentCandidates] = useState<any[]>([]);
  
  // Update candidates from React Query
  useEffect(() => {
    if (candidatesData) {
      setAssessmentCandidates(candidatesData);
    }
  }, [candidatesData]);

  // Service instance
  const serviceRef = useRef<AdminLiveService | null>(null)
  const sessionIdRef = useRef(0)
  // PRODUCTION FIX: Track which sessions successfully started monitoring
  // Sessions that successfully started should NEVER be cleaned up
  const successfulSessionsRef = useRef<Set<number>>(new Set())
  // PRODUCTION FIX: Track sessions that are currently starting (to prevent cleanup during async init)
  const startingSessionsRef = useRef<Set<number>>(new Set())
  // Track all pending cleanup timeouts by session ID
  const pendingCleanupsRef = useRef<Map<number, NodeJS.Timeout>>(new Map())

  // State
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [candidates, setCandidates] = useState<CandidateData[]>([])
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [flaggingCandidate, setFlaggingCandidate] = useState<string | null>(null)
  const [flagReason, setFlagReason] = useState('')
  const [flagSeverity, setFlagSeverity] = useState<'low' | 'medium' | 'high'>('medium')
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; message: string }>({
    isOpen: false,
    message: '',
  })

  // Refs for video elements
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  // Update candidates list from stream map
  const updateCandidates = useCallback((streamMap: Map<string, CandidateStreamInfo>) => {
    // Group sessions by candidateId and deduplicate
    const sessionsByCandidate: Record<string, CandidateData[]> = {};
    streamMap.forEach((info, sessionId) => {
      // Prioritize candidate name/email from backend (info.candidateName/Email)
      // Fallback to assessmentCandidates lookup if not available
      let resolvedName = info.candidateName;
      let resolvedEmail = info.candidateEmail;
      
      // Fallback to assessmentCandidates lookup if backend didn't provide name
      if (!resolvedName && assessmentCandidates && assessmentCandidates.length > 0) {
        const found = assessmentCandidates.find((c) => c.email === info.candidateId || c.id === info.candidateId);
        if (found) {
          resolvedName = found.name || undefined;
          resolvedEmail = resolvedEmail || found.email || undefined;
        }
      }

      const candidateData: CandidateData = {
        sessionId: info.sessionId,
        candidateId: info.candidateId,
        candidateName: resolvedName || 'Unknown Candidate',
        candidateEmail: resolvedEmail || '—',
        webcamStream: info.webcamStream,
        screenStream: info.screenStream,
        status: info.status,
      };
      if (!sessionsByCandidate[info.candidateId]) sessionsByCandidate[info.candidateId] = [];
      sessionsByCandidate[info.candidateId].push(candidateData);
    });

    // Deduplicate: pick best session per candidateId
    const dedupedCandidates: CandidateData[] = [];
    Object.entries(sessionsByCandidate).forEach(([candidateId, sessions]) => {
      if (sessions.length === 0) return;
      if (sessions.length === 1) {
        dedupedCandidates.push(sessions[0]);
        return;
      }

      // Priority selection:
      // 1) Session that has active WebRTC tracks (webcam/screen)
      // 2) Else session with wsConnected === true (status === 'connected' as proxy)
      // 3) Else latest session by sessionId (lexical fallback)
      
      let best = sessions[0];
      
      for (const sess of sessions) {
        const hasTracks = (sess.webcamStream && sess.webcamStream.active) || (sess.screenStream && sess.screenStream.active);
        const bestHasTracks = (best.webcamStream && best.webcamStream.active) || (best.screenStream && best.screenStream.active);
        
        // Priority 1: Active WebRTC tracks
        if (hasTracks && !bestHasTracks) {
          best = sess;
          continue;
        }
        
        // If both have tracks or neither has tracks, continue to next priority
        if (hasTracks === bestHasTracks) {
          // Priority 2: wsConnected (status === 'connected' as proxy)
          const sessWsConnected = sess.status === 'connected';
          const bestWsConnected = best.status === 'connected';
          
          if (sessWsConnected && !bestWsConnected) {
            best = sess;
            continue;
          }
          
          // Priority 3: Latest session by sessionId (lexical fallback)
          if (sessWsConnected === bestWsConnected && sess.sessionId > best.sessionId) {
            best = sess;
          }
        }
      }
      
      console.log(`[Live Dashboard] Selected session ${best.sessionId} for candidateId ${candidateId}`, {
        hasTracks: (best.webcamStream && best.webcamStream.active) || (best.screenStream && best.screenStream.active),
        status: best.status,
        sessionId: best.sessionId
      });
      
      dedupedCandidates.push(best);
    });

    setCandidates(dedupedCandidates);
    // NOTE: Stream attachment is now handled by useEffect below, not here
  }, [assessmentCandidates])

  // Initialize service and start/stop monitoring (combined to prevent UID_CONFLICT in React Strict Mode)
  useEffect(() => {
    if (!isOpen) return;
    if (!assessmentId || typeof assessmentId !== 'string' || !adminId) return;

    // PRODUCTION FIX: Cancel ALL pending cleanups when component mounts
    // This ensures no cleanup from previous mounts can interfere
    pendingCleanupsRef.current.forEach((timeout, sessionId) => {
      clearTimeout(timeout);
      console.log(`[Live Dashboard] [MOUNT] Cancelled pending cleanup for session ${sessionId} on mount`);
    });
    pendingCleanupsRef.current.clear();

    // Generate unique session ID for this mount
    const currentSessionId = ++sessionIdRef.current;
    console.log(`[Live Dashboard] [MOUNT] Session ${currentSessionId} created`);
    let service: AdminLiveService | null = null;

    const initMonitoring = async () => {
      try {
        // PRODUCTION FIX: Mark session as "starting" IMMEDIATELY to prevent cleanup
        // This prevents race condition where cleanup runs before startMonitoring completes
        startingSessionsRef.current.add(currentSessionId);
        console.log(`[Live Dashboard] [INIT] Session ${currentSessionId} marked as STARTING - cleanup prevented`);
        
        // Check if this session is still valid
        if (currentSessionId !== sessionIdRef.current) {
          console.log(`[Live Dashboard] [INIT] Session ${currentSessionId} outdated (current: ${sessionIdRef.current}), aborting`);
          startingSessionsRef.current.delete(currentSessionId);
          return;
        }

        setIsLoading(true);
        console.log(`[Live Dashboard] [INIT] Starting monitoring for session ${currentSessionId}...`);
        
        service = new AdminLiveService({
          assessmentId,
          adminId,
        });

        // Check again before async operation
        if (currentSessionId !== sessionIdRef.current) {
          console.log(`[Live Dashboard] [INIT] Session ${currentSessionId} outdated before startMonitoring (current: ${sessionIdRef.current}), stopping service`);
          startingSessionsRef.current.delete(currentSessionId);
          await service.stopMonitoring();
          return;
        }

        console.log(`[Live Dashboard] [INIT] Calling startMonitoring for session ${currentSessionId}...`);
        const result = await service.startMonitoring({
          onStateChange: (state: Partial<AdminLiveState>) => {
            if (currentSessionId === sessionIdRef.current) {
              if (state.isMonitoring !== undefined) {
                setIsMonitoring(state.isMonitoring);
              }
              if (state.isLoading !== undefined) {
                setIsLoading(state.isLoading);
              }
              if (state.candidateStreams) {
                updateCandidates(state.candidateStreams);
              }
            }
          },
          onError: (error) => {
            if (currentSessionId === sessionIdRef.current) {
              console.error('[Live Dashboard] Error:', error);
              setError(error);
              setIsLoading(false);
            }
          },
        });

        // PRODUCTION FIX: Check if startMonitoring succeeded
        // If it succeeded, mark as successful even if a newer session started (connection can be reused)
        if (result.success) {
          // Check if this is still the current session
          const isCurrentSession = currentSessionId === sessionIdRef.current;
          
          if (isCurrentSession) {
            // This is the current session - set service and state
            serviceRef.current = service;
            setIsMonitoring(true);
            setIsLoading(false);
            console.log(`[Live Dashboard] [SUCCESS] ✅ Monitoring started for session ${currentSessionId}`);
          } else {
            // Newer session started, but this one succeeded - mark as successful for cleanup prevention
            // Don't set serviceRef or state (newer session will handle that)
            console.log(`[Live Dashboard] [SUCCESS] Session ${currentSessionId} started successfully but newer session ${sessionIdRef.current} is active - marking as successful for cleanup prevention`);
          }
          
          // PRODUCTION FIX: Mark this session as successfully started (regardless of current session)
          // Sessions that successfully started should NEVER be cleaned up, even if a newer session started
          successfulSessionsRef.current.add(currentSessionId);
          // Remove from starting (now it's successful)
          startingSessionsRef.current.delete(currentSessionId);
          console.log(`[Live Dashboard] [SUCCESS] Session ${currentSessionId} marked as SUCCESSFUL - cleanup permanently disabled`);
          
          // PRODUCTION FIX: Cancel ALL pending cleanups (including this session's if any)
          // This is critical - once monitoring starts successfully, no cleanup should ever run
          pendingCleanupsRef.current.forEach((timeout, sessionId) => {
            clearTimeout(timeout);
            console.log(`[Live Dashboard] [SUCCESS] Cancelled cleanup for session ${sessionId} - monitoring started successfully`);
          });
          pendingCleanupsRef.current.clear();
          
          // PRODUCTION FIX: If this is not the current session, don't stop the service
          // The connection might be reused by the newer session, and stopping it would disconnect it
          // The service instance will be garbage collected anyway, and the connection is in the global map
          if (!isCurrentSession) {
            console.log(`[Live Dashboard] [SUCCESS] Session ${currentSessionId} succeeded but newer session ${sessionIdRef.current} is active - keeping service alive (connection may be reused)`);
            // Don't stop the service - let the newer session reuse the connection if needed
            // The service instance will be garbage collected, but the connection stays in GLOBAL_AGORA_CONNECTIONS
          }
        } else {
          // startMonitoring failed
          console.log(`[Live Dashboard] [FAIL] Session ${currentSessionId} failed to start (success: ${result.success}, currentSession: ${sessionIdRef.current})`);
          startingSessionsRef.current.delete(currentSessionId);
          
          // Only stop service if this is still the current session
          // If a newer session started, don't stop (it might be using a shared connection)
          if (currentSessionId === sessionIdRef.current) {
            await service.stopMonitoring();
          } else {
            console.log(`[Live Dashboard] [FAIL] Not stopping service for outdated session ${currentSessionId} (newer session ${sessionIdRef.current} is active)`);
          }
        }
      } catch (error) {
        if (currentSessionId === sessionIdRef.current) {
          console.error(`[Live Dashboard] [ERROR] Failed to start session ${currentSessionId}:`, error);
          startingSessionsRef.current.delete(currentSessionId);
          setIsLoading(false);
        } else {
          console.log(`[Live Dashboard] [ERROR] Session ${currentSessionId} error but session outdated (current: ${sessionIdRef.current})`);
          startingSessionsRef.current.delete(currentSessionId);
        }
      }
    };

    initMonitoring();

    return () => {
      console.log(`[Live Dashboard] [CLEANUP] Unmounting session ${currentSessionId}`);
      console.log(`[Live Dashboard] [CLEANUP] Session ${currentSessionId} state:`, {
        isSuccessful: successfulSessionsRef.current.has(currentSessionId),
        isStarting: startingSessionsRef.current.has(currentSessionId),
        currentSessionId: sessionIdRef.current,
        hasService: serviceRef.current !== null,
      });
      
      // PRODUCTION FIX: Only schedule cleanup if this session never successfully started
      // If monitoring started successfully, this session should NEVER be cleaned up
      if (successfulSessionsRef.current.has(currentSessionId)) {
        console.log(`[Live Dashboard] [CLEANUP] Session ${currentSessionId} successfully started - skipping cleanup (will be reused)`);
        // Remove from pending cleanups if it exists (shouldn't, but be safe)
        const existingTimeout = pendingCleanupsRef.current.get(currentSessionId);
        if (existingTimeout) {
          clearTimeout(existingTimeout);
          pendingCleanupsRef.current.delete(currentSessionId);
          console.log(`[Live Dashboard] [CLEANUP] Removed existing cleanup timeout for successful session ${currentSessionId}`);
        }
        return; // CRITICAL: Never cleanup sessions that successfully started
      }
      
      // PRODUCTION FIX: Schedule cleanup for all non-successful sessions
      // If session is starting, we'll defer cleanup execution in the timeout
      // Delay cleanup to detect quick remounts (React Strict Mode, Hot Reload, etc.)
      const cleanupTimeout = setTimeout(() => {
        console.log(`[Live Dashboard] [CLEANUP-TIMEOUT] Cleanup timeout fired for session ${currentSessionId}`);
        console.log(`[Live Dashboard] [CLEANUP-TIMEOUT] Session ${currentSessionId} state:`, {
          isSuccessful: successfulSessionsRef.current.has(currentSessionId),
          isStarting: startingSessionsRef.current.has(currentSessionId),
          currentSessionId: sessionIdRef.current,
          hasService: serviceRef.current !== null,
        });
        
        // Remove from pending cleanups map
        pendingCleanupsRef.current.delete(currentSessionId);
        
        // PRODUCTION FIX: Final validation before cleanup
        // Check if this session successfully started AFTER cleanup was scheduled
        if (successfulSessionsRef.current.has(currentSessionId)) {
          console.log(`[Live Dashboard] [CLEANUP-TIMEOUT] ❌ CANCELLED: Session ${currentSessionId} successfully started after cleanup was scheduled`);
          return; // Never cleanup successful sessions
        }
        
        // PRODUCTION FIX: Check if session is still starting (async operation in progress)
        if (startingSessionsRef.current.has(currentSessionId)) {
          console.log(`[Live Dashboard] [CLEANUP-TIMEOUT] ⏳ DEFERRED: Session ${currentSessionId} is still starting - will check again in 1 second`);
          // Reschedule cleanup to check again later
          const deferredTimeout = setTimeout(() => {
            pendingCleanupsRef.current.delete(currentSessionId);
            if (successfulSessionsRef.current.has(currentSessionId)) {
              console.log(`[Live Dashboard] [CLEANUP-DEFERRED] ❌ CANCELLED: Session ${currentSessionId} successfully started`);
              return;
            }
            if (startingSessionsRef.current.has(currentSessionId)) {
              console.log(`[Live Dashboard] [CLEANUP-DEFERRED] ⚠️ WARNING: Session ${currentSessionId} still starting after 1.5s - proceeding with cleanup`);
            }
            // Proceed with cleanup checks below
            executeCleanup();
          }, 1000); // Wait 1 more second
          pendingCleanupsRef.current.set(currentSessionId, deferredTimeout);
          return;
        }
        
        // Execute cleanup if all checks pass
        executeCleanup();
        
        function executeCleanup() {
          // Check if a newer session has started (component remounted)
          const latestSessionId = sessionIdRef.current;
          if (latestSessionId > currentSessionId) {
            console.log(`[Live Dashboard] [CLEANUP-TIMEOUT] ❌ CANCELLED: Newer session ${latestSessionId} started (component remounted)`);
            return; // Component remounted, don't cleanup
          }
          
          // Check if service still exists and belongs to this session
          if (!serviceRef.current) {
            console.log(`[Live Dashboard] [CLEANUP-TIMEOUT] ⏭️ SKIPPED: Service already cleaned up for session ${currentSessionId}`);
            return; // Service already cleaned up
          }
          
          // Check if current service belongs to a different (newer) session
          // This is a safety check - if monitoring started for a newer session, don't cleanup
          if (latestSessionId !== currentSessionId && successfulSessionsRef.current.has(latestSessionId)) {
            console.log(`[Live Dashboard] [CLEANUP-TIMEOUT] ❌ CANCELLED: Active session ${latestSessionId} is using the service`);
            return; // Active session is using the service
          }
          
          // All checks passed - safe to cleanup
          console.log(`[Live Dashboard] [CLEANUP-TIMEOUT] ✅ EXECUTING: Stopping monitoring for session ${currentSessionId}`);
          serviceRef.current?.stopMonitoring().catch((err) => {
            console.error(`[Live Dashboard] [CLEANUP-TIMEOUT] Error stopping monitoring:`, err);
          });
          
          // Only clear serviceRef if this is still the current session
          if (latestSessionId === currentSessionId) {
            serviceRef.current = null;
            console.log(`[Live Dashboard] [CLEANUP-TIMEOUT] Service reference cleared for session ${currentSessionId}`);
          }
        }
      }, 500); // 500ms delay to allow for React Strict Mode remounts
      
      // Track this cleanup timeout
      pendingCleanupsRef.current.set(currentSessionId, cleanupTimeout);
      console.log(`[Live Dashboard] [CLEANUP] Cleanup scheduled for session ${currentSessionId} (will execute in 500ms if not cancelled)`);
    };
  }, [isOpen, assessmentId, adminId, updateCandidates]);

  // Refresh specific candidate connection
  const refreshCandidate = useCallback((sessionId: string) => {
    console.log(`[Live Dashboard] Refreshing candidate: ${sessionId}`)
    if (serviceRef.current) {
      serviceRef.current.refreshCandidate(sessionId)
    }
  }, [])

  // Refresh all candidate connections
  const refreshAllCandidates = useCallback(() => {
    console.log(`[Live Dashboard] Refreshing all ${candidates.length} candidates`)
    if (serviceRef.current && candidates.length > 0) {
      candidates.forEach((candidate) => {
        serviceRef.current?.refreshCandidate(candidate.sessionId)
      })
    }
  }, [candidates])

  // Expand/collapse candidate view
  const toggleExpand = useCallback((sessionId: string) => {
    setExpandedSessionId((prev) => (prev === sessionId ? null : sessionId))
  }, [])

  // Track previous expanded session ID to detect collapse
  const prevExpandedSessionIdRef = useRef<string | null>(null)

  // Handle collapse: refresh streams when collapsing from expanded view (like clicking refresh button)
  useEffect(() => {
    // Detect collapse: was expanded, now collapsed
    if (prevExpandedSessionIdRef.current && !expandedSessionId) {
      const collapsedSessionId = prevExpandedSessionIdRef.current
      console.log(`[Live Dashboard] Collapsed from expanded view for ${collapsedSessionId} - auto-refreshing...`)
      
      // Wait for grid view to render, then refresh (same as clicking refresh button)
      // This ensures video elements are in DOM before refresh triggers stream reattachment
      const timeoutId = setTimeout(() => {
        if (serviceRef.current) {
          // Single refresh call - same as clicking the refresh button
          // This will trigger state update through onStateChange callback
          // which will call updateCandidates() to reattach streams automatically
          serviceRef.current.refreshCandidate(collapsedSessionId)
        }
      }, 200) // Small delay to ensure grid view video elements are rendered

      return () => clearTimeout(timeoutId)
    }

    // Update previous expanded session ID
    prevExpandedSessionIdRef.current = expandedSessionId
  }, [expandedSessionId]) // Only depend on expandedSessionId, not candidates

  // Attach streams to grid view video elements when candidates change (similar to expanded view)
  useEffect(() => {
    if (expandedSessionId) return; // Skip if in expanded view (handled separately)

    // Small delay to ensure video elements are rendered (same as expanded view)
    const timeoutId = setTimeout(() => {
      candidates.forEach((candidate) => {
        // Attach screen stream
        if (candidate.screenStream && candidate.screenStream.active) {
          const screenVideo = videoRefs.current.get(`screen-${candidate.sessionId}`);
          if (screenVideo && screenVideo.srcObject !== candidate.screenStream) {
            screenVideo.srcObject = candidate.screenStream;
            // Only play if not already playing (prevents AbortError from rapid updates)
            if (screenVideo.paused) {
              screenVideo.play().catch((err) => {
                console.error(`[Live Dashboard] Failed to play screen for ${candidate.sessionId}:`, err);
              });
            }
          }
        }

        // Attach webcam stream
        if (candidate.webcamStream && candidate.webcamStream.active) {
          const webcamVideo = videoRefs.current.get(`webcam-${candidate.sessionId}`);
          if (webcamVideo && webcamVideo.srcObject !== candidate.webcamStream) {
            webcamVideo.srcObject = candidate.webcamStream;
            // Only play if not already playing (prevents AbortError from rapid updates)
            if (webcamVideo.paused) {
              webcamVideo.play().catch((err) => {
                console.error(`[Live Dashboard] Failed to play webcam for ${candidate.sessionId}:`, err);
              });
            }
          }
        }
      });
    }, 100); // Same delay as expanded view

    return () => clearTimeout(timeoutId);
  }, [candidates, expandedSessionId]);

  // Attach streams to expanded video elements when expanded view is shown
  useEffect(() => {
    if (!expandedSessionId) return

    const expandedCandidate = candidates.find((c) => c.sessionId === expandedSessionId)
    if (!expandedCandidate) return

    // Small delay to ensure video elements are rendered
    const timeoutId = setTimeout(() => {
      // Attach screen stream
      if (expandedCandidate.screenStream) {
        const screenVideo = videoRefs.current.get(`screen-${expandedSessionId}`)
        if (screenVideo && screenVideo.srcObject !== expandedCandidate.screenStream) {
          screenVideo.srcObject = expandedCandidate.screenStream
          screenVideo.play().catch((err) => {
            console.error(`[Live Dashboard] Failed to play screen in expanded view for ${expandedSessionId}:`, err)
          })
        }
      }

      // Attach webcam stream
      if (expandedCandidate.webcamStream) {
        const webcamVideo = videoRefs.current.get(`webcam-${expandedSessionId}`)
        if (webcamVideo && webcamVideo.srcObject !== expandedCandidate.webcamStream) {
          webcamVideo.srcObject = expandedCandidate.webcamStream
          webcamVideo.play().catch((err) => {
            console.error(`[Live Dashboard] Failed to play webcam in expanded view for ${expandedSessionId}:`, err)
          })
        }
      }
    }, 100) // Small delay to ensure DOM is ready

    return () => clearTimeout(timeoutId)
  }, [expandedSessionId, candidates])


  // ============================================================================
  // RENDER: LOADING STATE
  // ============================================================================
  if (isLoading) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "#00684A" }}>
          <Loader2 size={40} className="animate-spin" />
          <span style={{ fontWeight: 500 }}>Connecting to Live Proctoring...</span>
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER: EXPANDED VIEW (Cinematic Dark Mode)
  // ============================================================================
  if (expandedSessionId) {
    const expandedCandidate = candidates.find((c) => c.sessionId === expandedSessionId)

    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#000000", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <div style={{ 
          backgroundColor: "#111827", borderBottom: "1px solid #1F2937", padding: "1rem 1.5rem", 
          display: "flex", alignItems: "center", justifyContent: "space-between" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button
              onClick={() => setExpandedSessionId(null)}
              style={{ 
                padding: "0.5rem", backgroundColor: "transparent", border: "none", color: "#ffffff",
                cursor: "pointer", borderRadius: "0.5rem", transition: "background-color 0.2s" 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#374151"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <Minimize2 size={20} />
            </button>
            <div style={{ color: "#ffffff" }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: "1.125rem" }}>
                {expandedCandidate?.candidateName || expandedCandidate?.candidateEmail || 'Unknown Candidate'}
              </p>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#9CA3AF" }}>Session ID: {expandedSessionId}</p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{
                padding: "0.25rem 0.75rem", borderRadius: "9999px", fontSize: "0.75rem", fontWeight: 600,
                backgroundColor: expandedCandidate?.status === 'connected' ? "rgba(16, 185, 129, 0.2)" : expandedCandidate?.status === 'connecting' ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)",
                color: expandedCandidate?.status === 'connected' ? "#34D399" : expandedCandidate?.status === 'connecting' ? "#FBBF24" : "#F87171",
                textTransform: "uppercase", letterSpacing: "0.05em"
              }}
            >
              {expandedCandidate?.status || 'Unknown'}
            </div>
            <button
              onClick={() => refreshCandidate(expandedSessionId)}
              style={{ 
                padding: "0.5rem", backgroundColor: "transparent", border: "none", color: "#ffffff",
                cursor: "pointer", borderRadius: "0.5rem", transition: "background-color 0.2s" 
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#374151"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              title="Refresh connection"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        {/* Expanded Video View Area */}
        <div style={{ position: "relative", width: "100%", flex: 1, minHeight: "0" }}>
          {/* Screen Share (Primary Background) */}
          {expandedCandidate?.screenStream ? (
            <video
              ref={(el) => { if (el) videoRefs.current.set(`screen-${expandedSessionId}`, el) }}
              autoPlay
              playsInline
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <p style={{ color: "#6B7280", fontSize: "1.125rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Video size={24} /> No screen share available
              </p>
            </div>
          )}

          {/* Webcam (Picture-in-Picture) */}
          {expandedCandidate?.webcamStream && (
            <div style={{ 
              position: "absolute", bottom: "1.5rem", right: "1.5rem", width: "280px", height: "200px", 
              backgroundColor: "#111827", borderRadius: "0.75rem", overflow: "hidden", 
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)", border: "2px solid #374151" 
            }}>
              <video
                ref={(el) => { if (el) videoRefs.current.set(`webcam-${expandedSessionId}`, el) }}
                autoPlay
                playsInline
                muted
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ============================================================================
  // RENDER: GRID VIEW (Emerald Dashboard)
  // ============================================================================
  return (
    <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      
      {/* Header */}
      <div style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #E5E7EB", padding: "1rem 2rem", position: "sticky", top: 0, zIndex: 40 }}>
        <div style={{ maxWidth: "1400px", margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
            {onClose ? (
              <button
                onClick={onClose}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem", backgroundColor: "transparent", border: "none", color: "#6B7280", cursor: "pointer", borderRadius: "0.5rem", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F3F4F6"; e.currentTarget.style.color = "#111827"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#6B7280"; }}
                title="Close"
              >
                <ArrowLeft size={20} />
              </button>
            ) : (
              <Link
                href={`/aiml/tests/${assessmentId}/analytics`}
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem", backgroundColor: "transparent", border: "none", color: "#6B7280", cursor: "pointer", borderRadius: "0.5rem", transition: "all 0.2s" }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#F3F4F6"; e.currentTarget.style.color = "#111827"; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#6B7280"; }}
              >
                <ArrowLeft size={20} />
              </Link>
            )}
            <h1 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#111827" }}>
              Live Proctoring
            </h1>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", backgroundColor: "#F0F9F4", borderRadius: "0.5rem", border: "1px solid #A8E8BC" }}>
              <Users size={18} color="#00684A" />
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#00684A" }}>
                {candidates.length} Candidate{candidates.length !== 1 ? 's' : ''}
              </span>
            </div>
            
            {isMonitoring && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", backgroundColor: "#FEF2F2", borderRadius: "0.5rem", border: "1px solid #FECACA" }}>
                <div style={{ width: "8px", height: "8px", backgroundColor: "#DC2626", borderRadius: "50%" }} className="animate-pulse"></div>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#991B1B", textTransform: "uppercase", letterSpacing: "0.05em" }}>Live</span>
              </div>
            )}
            
            {candidates.length > 0 && (
              <button
                onClick={refreshAllCandidates}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.25rem",
                  backgroundColor: "#00684A", color: "#ffffff", border: "none", borderRadius: "0.5rem",
                  fontWeight: 600, fontSize: "0.875rem", cursor: "pointer", transition: "all 0.2s",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#084A2A"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
                title="Refresh all candidate streams"
              >
                <RefreshCw size={16} /> Refresh All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div style={{ backgroundColor: "#FEF2F2", borderBottom: "1px solid #FECACA", padding: "1rem 2rem" }}>
          <div style={{ maxWidth: "1400px", margin: "0 auto", display: "flex", alignItems: "center", gap: "0.5rem", color: "#991B1B", fontSize: "0.875rem", fontWeight: 500 }}>
            <AlertCircle size={16} /> {error}
          </div>
        </div>
      )}

      {/* Candidates Grid */}
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "2rem" }}>
        {candidates.length === 0 ? (
          <div style={{ textAlign: "center", padding: "6rem 2rem", backgroundColor: "#ffffff", borderRadius: "1rem", border: "1px dashed #D1D5DB" }}>
            <Users size={64} color="#D1D5DB" style={{ margin: "0 auto 1rem auto" }} />
            <h2 style={{ margin: "0 0 0.5rem 0", fontSize: "1.25rem", fontWeight: 600, color: "#374151" }}>No Active Candidates</h2>
            <p style={{ margin: 0, color: "#6B7280", fontSize: "1rem" }}>
              Candidates will appear here instantly when they connect and begin their assessment.
            </p>
          </div>
        ) : (
          (() => {
            const candidatesArray = Array.from(candidates).map((candidate) => ({
              id: candidate.sessionId,
              ...candidate
            }));

            // Grid calculations
            const CARD_WIDTH = 340;
            const CARD_HEIGHT = 300;
            const containerWidth = typeof window !== 'undefined' ? Math.min(window.innerWidth - 64, 1400) : 1200;
            const COLUMNS = Math.max(1, Math.floor(containerWidth / CARD_WIDTH));
            const rowCount = Math.max(1, Math.ceil(candidatesArray.length / COLUMNS));

            // Fallback to regular flex grid if FixedSizeGrid isn't ready or for small lists
            if (candidatesArray.length <= 4) {
              return (
                <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(COLUMNS, candidatesArray.length)}, 1fr)`, gap: "1rem" }}>
                  {candidatesArray.map((candidate) => (
                    <CandidateTile
                      key={candidate.id}
                      candidate={candidate}
                      onExpand={toggleExpand}
                      onRefresh={refreshCandidate}
                      onFlag={() => setFlaggingCandidate(candidate.candidateId)}
                      videoRefs={videoRefs}
                    />
                  ))}
                </div>
              );
            }

            return (
              <FixedSizeGrid
                columnCount={COLUMNS}
                columnWidth={CARD_WIDTH}
                height={Math.max(600, typeof window !== 'undefined' ? window.innerHeight - 200 : 800)}
                rowCount={rowCount}
                rowHeight={CARD_HEIGHT}
                width={containerWidth}
                style={{ overflowX: "hidden" }}
              >
                {({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
                  const index = rowIndex * COLUMNS + columnIndex;
                  if (index >= candidatesArray.length) return null;
                  
                  const candidate = candidatesArray[index];
                  
                  return (
                    <div style={{ ...style, padding: "0.75rem" }} key={candidate.id}>
                      <CandidateTile
                        candidate={candidate}
                        onExpand={toggleExpand}
                        onRefresh={refreshCandidate}
                        onFlag={() => setFlaggingCandidate(candidate.candidateId)}
                        videoRefs={videoRefs}
                      />
                    </div>
                  );
                }}
              </FixedSizeGrid>
            );
          })()
        )}
      </div>

      {/* Flag Candidate Modal */}
      {flaggingCandidate && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}
          onClick={() => {
            setFlaggingCandidate(null);
            setFlagReason('');
            setFlagSeverity('medium');
          }}
        >
          <div style={{ backgroundColor: "#ffffff", borderRadius: "1rem", padding: "2rem", width: "100%", maxWidth: "480px", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <div style={{ backgroundColor: "#FEF2F2", padding: "0.5rem", borderRadius: "0.5rem", color: "#DC2626" }}><Flag size={20} /></div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Flag Candidate</h3>
              </div>
              <button onClick={() => { setFlaggingCandidate(null); setFlagReason(''); setFlagSeverity('medium'); }} style={{ background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer", transition: "color 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.color = "#4B5563"} onMouseLeave={(e) => e.currentTarget.style.color = "#9CA3AF"}>
                <X size={20} />
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>Reason for flagging</label>
                <textarea
                  value={flagReason}
                  onChange={(e) => setFlagReason(e.target.value)}
                  placeholder="Describe the suspicious behavior observed..."
                  rows={4}
                  style={{ width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", outline: "none", boxSizing: "border-box", fontSize: "0.95rem", fontFamily: "inherit", resize: "vertical" }}
                  onFocus={(e) => e.currentTarget.style.borderColor = "#DC2626"}
                  onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>Severity Level</label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {(['low', 'medium', 'high'] as const).map((severity) => (
                    <button
                      key={severity}
                      onClick={() => setFlagSeverity(severity)}
                      style={{
                        flex: 1, padding: "0.625rem", borderRadius: "0.5rem", fontSize: "0.875rem", fontWeight: 600, textTransform: "capitalize", cursor: "pointer", transition: "all 0.2s",
                        backgroundColor: flagSeverity === severity 
                          ? (severity === 'low' ? "#FEF3C7" : severity === 'medium' ? "#FFEDD5" : "#FEE2E2") 
                          : "#F9FAFB",
                        color: flagSeverity === severity 
                          ? (severity === 'low' ? "#92400E" : severity === 'medium' ? "#C2410C" : "#B91C1C") 
                          : "#6B7280",
                        border: flagSeverity === severity 
                          ? `2px solid ${severity === 'low' ? "#F59E0B" : severity === 'medium' ? "#F97316" : "#EF4444"}` 
                          : "1px solid #E5E7EB",
                      }}
                    >
                      {severity}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                <button
                  onClick={() => { setFlaggingCandidate(null); setFlagReason(''); setFlagSeverity('medium'); }}
                  style={{ flex: 1, padding: "0.75rem", backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem", fontWeight: 600, color: "#374151", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F9FAFB"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!flagReason.trim()) { alert('Please enter a reason for flagging'); return; }
                    if (serviceRef.current) {
                      const success = await serviceRef.current.flagCandidate(flaggingCandidate, flagReason.trim(), flagSeverity);
                      if (success) {
                        setSuccessModal({ isOpen: true, message: 'Candidate flagged successfully' });
                        setFlaggingCandidate(null); setFlagReason(''); setFlagSeverity('medium');
                      } else {
                        setSuccessModal({ isOpen: true, message: 'Failed to flag candidate. Please try again.' });
                      }
                    }
                  }}
                  style={{ flex: 2, padding: "0.75rem", backgroundColor: "#DC2626", border: "1px solid #DC2626", borderRadius: "0.5rem", fontWeight: 600, color: "#ffffff", cursor: "pointer", transition: "all 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#B91C1C"}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#DC2626"}
                >
                  Submit Flag
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SuccessModal
        isOpen={successModal.isOpen}
        title="Success"
        message={successModal.message}
        confirmText="OK"
        onConfirm={() => setSuccessModal({ isOpen: false, message: '' })}
      />
    </div>
  )
}

// ============================================================================
// Candidate Tile Component (Inline Styled)
// ============================================================================

interface CandidateTileProps {
  candidate: CandidateData
  onExpand: (sessionId: string) => void
  onRefresh: (sessionId: string) => void
  onFlag: () => void
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>
}

function CandidateTile({ candidate, onExpand, onRefresh, onFlag, videoRefs }: CandidateTileProps) {
  return (
    <div style={{ 
      backgroundColor: "#ffffff", borderRadius: "0.75rem", border: "1px solid #E5E7EB", 
      overflow: "hidden", display: "flex", flexDirection: "column", height: "100%",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
    }}>
      
      {/* Header */}
      <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem", color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {candidate.candidateName || candidate.candidateEmail || 'Unknown Candidate'}
          </p>
          {candidate.candidateEmail && candidate.candidateEmail !== candidate.candidateName && (
            <p style={{ margin: "0.15rem 0 0 0", fontSize: "0.75rem", color: "#6B7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {candidate.candidateEmail}
            </p>
          )}
        </div>
        <div style={{
          padding: "0.2rem 0.5rem", borderRadius: "1rem", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0,
          backgroundColor: candidate.status === 'connected' ? "#D1FAE5" : candidate.status === 'connecting' ? "#FEF3C7" : "#FEE2E2",
          color: candidate.status === 'connected' ? "#059669" : candidate.status === 'connecting' ? "#D97706" : "#DC2626",
          border: `1px solid ${candidate.status === 'connected' ? "#A7F3D0" : candidate.status === 'connecting' ? "#FDE68A" : "#FECACA"}`
        }}>
          {candidate.status}
        </div>
      </div>

      {/* Video Feeds Area */}
      <div style={{ position: "relative", backgroundColor: "#111827", flex: 1, width: "100%", minHeight: 0 }}>
        
        {/* Screen Share (Background) */}
        <video
          ref={(el) => { if (el) videoRefs.current.set(`screen-${candidate.sessionId}`, el) }}
          autoPlay
          playsInline
          style={{ width: "100%", height: "100%", objectFit: "contain", display: (candidate.screenStream && candidate.screenStream.active) ? 'block' : 'none' }}
        />
        {(!candidate.screenStream || !candidate.screenStream.active) && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#4B5563", fontSize: "0.875rem", margin: 0, display: "flex", alignItems: "center", gap: "0.375rem" }}>
              <Video size={16} /> No screen share
            </p>
          </div>
        )}

        {/* Webcam (Picture-in-Picture Overlay) */}
        <div style={{ 
          position: "absolute", top: "0.5rem", right: "0.5rem", width: "80px", height: "60px", 
          backgroundColor: "#1F2937", borderRadius: "0.375rem", overflow: "hidden", 
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)", border: "1px solid #374151",
          display: (candidate.webcamStream && candidate.webcamStream.active) ? 'block' : 'none'
        }}>
          <video
            ref={(el) => { if (el) videoRefs.current.set(`webcam-${candidate.sessionId}`, el) }}
            autoPlay
            playsInline
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </div>
      </div>

      {/* Footer Actions */}
      <div style={{ padding: "0.5rem 0.75rem", backgroundColor: "#F9FAFB", borderTop: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          onClick={() => onRefresh(candidate.sessionId)}
          style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, color: "#4B5563", backgroundColor: "transparent", border: "1px solid #D1D5DB", borderRadius: "0.375rem", cursor: "pointer", transition: "all 0.2s" }}
          onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#ffffff"; e.currentTarget.style.borderColor = "#9CA3AF"; }}
          onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.borderColor = "#D1D5DB"; }}
        >
          <RefreshCw size={14} /> Refresh
        </button>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            onClick={onFlag}
            style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, color: "#ffffff", backgroundColor: "#DC2626", border: "1px solid #DC2626", borderRadius: "0.375rem", cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#B91C1C"; e.currentTarget.style.borderColor = "#B91C1C"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#DC2626"; e.currentTarget.style.borderColor = "#DC2626"; }}
            title="Flag suspicious behavior"
          >
            <Flag size={14} /> Flag
          </button>
          <button
            onClick={() => onExpand(candidate.sessionId)}
            style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.375rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, color: "#ffffff", backgroundColor: "#00684A", border: "1px solid #00684A", borderRadius: "0.375rem", cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#084A2A"; e.currentTarget.style.borderColor = "#084A2A"; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#00684A"; e.currentTarget.style.borderColor = "#00684A"; }}
          >
            <Maximize2 size={14} /> Expand
          </button>
        </div>
      </div>
    </div>
  )
}