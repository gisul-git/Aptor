'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import { AdminLiveService } from '../../../../universal-proctoring/live/AdminLiveService'
import { CandidateStreamInfo, AdminLiveState } from '../../../../universal-proctoring/live/types'
import { ArrowLeft, Maximize2, Minimize2, RefreshCw, Users, Loader2, Flag, X } from 'lucide-react'
import Link from 'next/link'
import { useAIMLCandidates } from '@/hooks/api/useAIML'
import dynamic from 'next/dynamic'
import SuccessModal from '@/components/SuccessModal'

// Dynamically import FixedSizeGrid (react-window requires browser APIs)
const FixedSizeGrid = dynamic(
  () => import('react-window').then((mod) => (mod as any).FixedSizeGrid),
  { 
    ssr: false,
    loading: () => <div className="text-center py-8">Loading grid...</div>
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

  // Responsive grid size calculation
  const getGridClass = () => {
    const count = candidates.length
    if (count <= 2) return 'grid-cols-1 md:grid-cols-2'
    if (count <= 4) return 'grid-cols-2'
    return 'grid-cols-2 md:grid-cols-3'
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Connecting to Live Proctoring...</p>
        </div>
      </div>
    )
  }

  // Expanded view
  if (expandedSessionId) {
    const expandedCandidate = candidates.find((c) => c.sessionId === expandedSessionId)

    return (
      <div className="min-h-screen bg-black">
        {/* Header */}
        <div className="bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setExpandedSessionId(null)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <Minimize2 className="w-5 h-5 text-white" />
            </button>
            <div className="text-white">
              <p className="font-semibold">
                {expandedCandidate?.candidateName || expandedCandidate?.candidateEmail || 'Unknown'}
              </p>
              <p className="text-sm text-gray-400">Session: {expandedSessionId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                expandedCandidate?.status === 'connected'
                  ? 'bg-green-500/20 text-green-400'
                  : expandedCandidate?.status === 'connecting'
                  ? 'bg-yellow-500/20 text-yellow-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {expandedCandidate?.status || 'Unknown'}
            </div>
            <button
              onClick={() => refreshCandidate(expandedSessionId)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => expandedCandidate && setFlaggingCandidate(expandedCandidate.candidateId)}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              title="Flag candidate for suspicious behavior"
            >
              <Flag className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Expanded Video View */}
        <div className="relative w-full h-[calc(100vh-73px)]">
          {/* Screen Share (Primary) */}
          {expandedCandidate?.screenStream ? (
            <video
              ref={(el) => {
                if (el) videoRefs.current.set(`screen-${expandedSessionId}`, el)
              }}
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-gray-500">No screen share available</p>
            </div>
          )}

          {/* Webcam (Picture-in-Picture) */}
          {expandedCandidate?.webcamStream && (
            <div className="absolute bottom-4 right-4 w-64 h-48 bg-gray-900 rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
              <video
                ref={(el) => {
                  if (el) videoRefs.current.set(`webcam-${expandedSessionId}`, el)
                }}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // Grid view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onClose ? (
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Close"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <Link
                href={`/aiml/tests/${assessmentId}/analytics`}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            )}
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Live Proctoring Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
              <Users className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">
                {candidates.length} {candidates.length === 1 ? 'Candidate' : 'Candidates'}
              </span>
            </div>
            {isMonitoring && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 rounded-lg">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium text-green-900">Live</span>
              </div>
            )}
            {candidates.length > 0 && (
              <button
                onClick={refreshAllCandidates}
                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                title="Refresh all candidate streams"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="text-sm font-medium">Refresh All</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 p-4">
          <div className="max-w-7xl mx-auto">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Candidates Grid */}
      <div className="max-w-7xl mx-auto p-6">
        {candidates.length === 0 ? (
          <div className="text-center py-16">
            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">No Active Candidates</h2>
            <p className="text-gray-500">
              Candidates will appear here when they start their assessment with Live Proctoring enabled.
            </p>
          </div>
        ) : (
          (() => {
            const candidatesArray = Array.from(candidates).map((candidate) => ({
              id: candidate.sessionId,
              ...candidate
            }));

            console.log('[Live Dashboard] Rendering candidates:', {
              candidatesCount: candidates.length,
              candidatesArrayLength: candidatesArray.length,
              candidates: candidatesArray.map(c => ({
                id: c.id,
                sessionId: c.sessionId,
                candidateId: c.candidateId,
                name: c.candidateName,
                email: c.candidateEmail,
                hasWebcam: !!c.webcamStream,
                hasScreen: !!c.screenStream,
                status: c.status
              }))
            });

            const CARD_WIDTH = 320;
            const CARD_HEIGHT = 280;
            const containerWidth = typeof window !== 'undefined' ? window.innerWidth - 100 : 1200;
            const COLUMNS = Math.max(1, Math.floor(containerWidth / CARD_WIDTH));
            const rowCount = Math.max(1, Math.ceil(candidatesArray.length / COLUMNS));

            // Fallback to regular grid if FixedSizeGrid isn't ready or for small lists
            if (candidatesArray.length <= 4) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                height={800}
                rowCount={rowCount}
                rowHeight={CARD_HEIGHT}
                width={containerWidth}
                className="candidate-grid"
              >
                {({ columnIndex, rowIndex, style }: { columnIndex: number; rowIndex: number; style: React.CSSProperties }) => {
                  const index = rowIndex * COLUMNS + columnIndex;
                  if (index >= candidatesArray.length) return null;
                  
                  const candidate = candidatesArray[index];
                  
                  return (
                    <div style={style} key={candidate.id}>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Flag Candidate</h2>
              <button
                onClick={() => {
                  setFlaggingCandidate(null);
                  setFlagReason('');
                  setFlagSeverity('medium');
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for flagging
              </label>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="Enter reason for flagging this candidate..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Severity
              </label>
              <div className="flex gap-2">
                {(['low', 'medium', 'high'] as const).map((severity) => (
                  <button
                    key={severity}
                    onClick={() => setFlagSeverity(severity)}
                    className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      flagSeverity === severity
                        ? severity === 'low'
                          ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-500'
                          : severity === 'medium'
                          ? 'bg-orange-100 text-orange-800 border-2 border-orange-500'
                          : 'bg-red-100 text-red-800 border-2 border-red-500'
                        : 'bg-gray-100 text-gray-700 border-2 border-transparent hover:bg-gray-200'
                    }`}
                  >
                    {severity.charAt(0).toUpperCase() + severity.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setFlaggingCandidate(null);
                  setFlagReason('');
                  setFlagSeverity('medium');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!flagReason.trim()) {
                    alert('Please enter a reason for flagging');
                    return;
                  }
                  
                  if (serviceRef.current) {
                    const success = await serviceRef.current.flagCandidate(
                      flaggingCandidate,
                      flagReason.trim(),
                      flagSeverity
                    );
                    
                    if (success) {
                      setSuccessModal({
                        isOpen: true,
                        message: 'Candidate flagged successfully',
                      });
                      setFlaggingCandidate(null);
                      setFlagReason('');
                      setFlagSeverity('medium');
                    } else {
                      setSuccessModal({
                        isOpen: true,
                        message: 'Failed to flag candidate. Please try again.',
                      });
                    }
                  }
                }}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Flag Candidate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      <SuccessModal
        isOpen={successModal.isOpen}
        title="Success"
        message={successModal.message}
        confirmText="OK"
        onConfirm={() => {
          setSuccessModal({ isOpen: false, message: '' })
        }}
      />
    </div>
  )
}

// ============================================================================
// Candidate Tile Component
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
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {candidate.candidateName || candidate.candidateEmail || 'Unknown Candidate'}
          </p>
          {candidate.candidateEmail && candidate.candidateEmail !== candidate.candidateName && (
            <p className="text-xs text-gray-500 truncate">{candidate.candidateEmail}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`px-2 py-1 rounded text-xs font-medium ${
              candidate.status === 'connected'
                ? 'bg-green-100 text-green-700'
                : candidate.status === 'connecting'
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {candidate.status}
          </div>
        </div>
      </div>

      {/* Video Feeds */}
      <div className="aspect-video bg-gray-900 relative">
        {/* Screen Share (Background) - Always render video element */}
        <video
          ref={(el) => {
            if (el) videoRefs.current.set(`screen-${candidate.sessionId}`, el)
          }}
          autoPlay
          playsInline
          className={`w-full h-full object-contain ${candidate.screenStream && candidate.screenStream.active ? 'block' : 'hidden'}`}
        />
        {!candidate.screenStream || !candidate.screenStream.active ? (
          <div className="w-full h-full flex items-center justify-center absolute inset-0">
            <p className="text-gray-500 text-sm">No screen share</p>
          </div>
        ) : null}

        {/* Webcam (Overlay - Top Right) - Always render video element */}
        <div className={`absolute top-2 right-2 w-24 h-18 bg-gray-800 rounded overflow-hidden shadow-lg border border-gray-700 ${candidate.webcamStream && candidate.webcamStream.active ? 'block' : 'hidden'}`}>
          <video
            ref={(el) => {
              if (el) videoRefs.current.set(`webcam-${candidate.sessionId}`, el)
            }}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="p-3 flex items-center justify-between bg-gray-50">
        <button
          onClick={() => onRefresh(candidate.sessionId)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-200 rounded transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={onFlag}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-600 text-white hover:bg-red-700 rounded transition-colors"
            title="Flag candidate for suspicious behavior"
          >
            <Flag className="w-4 h-4" />
            Flag
          </button>
          <button
            onClick={() => onExpand(candidate.sessionId)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
          >
            <Maximize2 className="w-4 h-4" />
            Expand
          </button>
        </div>
      </div>
    </div>
  )
}
