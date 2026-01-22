'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../lib/auth'
import { AdminLiveService } from '../../../universal-proctoring/live/AdminLiveService'
import { CandidateStreamInfo, AdminLiveState } from '../../../universal-proctoring/live/types'
import { ArrowLeft, Maximize2, Minimize2, RefreshCw, Users, Loader2 } from 'lucide-react'
import Link from 'next/link'
// React Query hooks
import { useCustomMCQAssessment } from '@/hooks/api/useCustomMCQ'

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
  const router = useRouter()
  const { data: session } = useSession()
  const { assessmentId: routerAssessmentId } = router.query
  
  // Use prop assessmentId if provided, otherwise use router query
  const assessmentId = propAssessmentId || (typeof routerAssessmentId === 'string' ? routerAssessmentId : undefined)
  const adminId = propAdminId || session?.user?.email || session?.user?.id || 'admin'
  
  // Use React Query hook to fetch Custom MCQ assessment
  const { data: assessmentData } = useCustomMCQAssessment(assessmentId)
  const assessmentCandidates = assessmentData?.candidates || []

  // Service instance
  const serviceRef = useRef<AdminLiveService | null>(null)

  // State
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [candidates, setCandidates] = useState<CandidateData[]>([])
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Refs for video elements
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

  // Update candidates list from stream map
  const updateCandidates = useCallback((streamMap: Map<string, CandidateStreamInfo>) => {
    // Group sessions by candidateId and deduplicate
    const sessionsByCandidate: Record<string, CandidateData[]> = {};
    streamMap.forEach((info, sessionId) => {
      // Map candidateId to assessmentCandidates
      let resolvedName = undefined;
      let resolvedEmail = undefined;
      if (assessmentCandidates && assessmentCandidates.length > 0) {
        const found = assessmentCandidates.find((c: any) => c.email === info.candidateId || (c as any).id === info.candidateId);
        if (found) {
          resolvedName = found.name || undefined;
          resolvedEmail = found.email || undefined;
        }
      }
      if (!resolvedName) resolvedName = undefined;
      if (!resolvedEmail) resolvedEmail = undefined;

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

  // Initialize service
  useEffect(() => {
    if (!assessmentId || typeof assessmentId !== 'string' || !adminId) {
      return;
    }

    // Assessment candidates are now fetched via React Query hook (useCustomMCQAssessment)
    console.log('[Live Dashboard] Initializing AdminLiveService...')

    const service = new AdminLiveService({
      assessmentId,
      adminId: adminId,
      debugMode: true,
    })

    serviceRef.current = service

    // Cleanup on unmount
    return () => {
      console.log('[Live Dashboard] Cleanup: stopping monitoring')
      if (serviceRef.current) {
        serviceRef.current.stopMonitoring()
      }
    }
  }, [assessmentId, adminId])

  // Start/stop monitoring based on isOpen prop
  useEffect(() => {
    if (!serviceRef.current || !assessmentId || typeof assessmentId !== 'string') {
      return;
    }

    const service = serviceRef.current;

    if (isOpen) {
      // Start monitoring when modal is opened
      console.log('[Live Dashboard] Modal opened - starting monitoring...')
      service.startMonitoring({
        onStateChange: (state: Partial<AdminLiveState>) => {
          console.log('[Live Dashboard] State changed:', state)

          if (state.isMonitoring !== undefined) {
            setIsMonitoring(state.isMonitoring)
          }

          if (state.isLoading !== undefined) {
            setIsLoading(state.isLoading)
          }

          if (state.candidateStreams) {
            updateCandidates(state.candidateStreams)
          }
        },
        onCandidateConnected: (sessionId: string, candidateId: string) => {
          console.log(`[Live Dashboard] ✅ Candidate connected: ${sessionId}`)
        },
        onCandidateDisconnected: (sessionId: string) => {
          console.log(`[Live Dashboard] ⚠️ Candidate disconnected: ${sessionId}`)
        },
        onError: (error: string) => {
          console.error(`[Live Dashboard] ❌ Error: ${error}`)
          setError(error)
        },
      })
    } else {
      // Stop monitoring when modal is closed
      console.log('[Live Dashboard] Modal closed - stopping monitoring...')
      service.stopMonitoring()
      setIsMonitoring(false)
      setCandidates([])
    }

    // Cleanup: stop monitoring when component unmounts or isOpen becomes false
    return () => {
      if (!isOpen && serviceRef.current) {
        console.log('[Live Dashboard] Cleanup: stopping monitoring')
        serviceRef.current.stopMonitoring()
      }
    }
  }, [isOpen, assessmentId, updateCandidates]) // Re-run when isOpen or assessmentId changes

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
        if (candidate.screenStream) {
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
        if (candidate.webcamStream) {
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
                href={`/custom-mcq/${assessmentId}`}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            )}
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Live Proctoring Dashboard</h1>
              <p className="text-sm text-gray-600">Custom MCQ Assessment: {assessmentId}</p>
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
          <div className={`grid ${getGridClass()} gap-6`}>
            {candidates.map((candidate) => (
              <CandidateTile
                key={candidate.sessionId}
                candidate={candidate}
                onExpand={toggleExpand}
                onRefresh={refreshCandidate}
                videoRefs={videoRefs}
              />
            ))}
          </div>
        )}
      </div>
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
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>
}

function CandidateTile({ candidate, onExpand, onRefresh, videoRefs }: CandidateTileProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">
            {candidate.candidateName || candidate.candidateEmail || 'Unknown Candidate'}
          </p>
          <p className="text-xs text-gray-500 truncate">{candidate.candidateId}</p>
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
        <button
          onClick={() => onExpand(candidate.sessionId)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition-colors"
        >
          <Maximize2 className="w-4 h-4" />
          Expand
        </button>
      </div>
    </div>
  )
}

