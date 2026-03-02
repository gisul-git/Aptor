'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import { AdminLiveService } from '../../../../universal-proctoring/live/AdminLiveService'
import { CandidateStreamInfo, AdminLiveState } from '../../../../universal-proctoring/live/types'
import { ArrowLeft, Maximize2, Minimize2, RefreshCw, Users, Loader2, Video, AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { useDSATest } from '@/hooks/api/useDSA'
import dynamic from 'next/dynamic'

// Dynamically import FixedSizeGrid (react-window requires browser APIs)
const FixedSizeGrid = dynamic(
  () => import('react-window').then((mod) => (mod as any).FixedSizeGrid),
  { ssr: false }
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
  const router = useRouter()
  const { data: session } = useSession()
  const { id: routerAssessmentId } = router.query
  
  // Use prop assessmentId if provided, otherwise use router query
  const assessmentId = propAssessmentId || (typeof routerAssessmentId === 'string' ? routerAssessmentId : undefined)
  const adminId = propAdminId || session?.user?.email || session?.user?.id || 'admin'
  
  // Use React Query hook to fetch DSA test
  const { data: testData } = useDSATest(assessmentId)
  const assessmentCandidates = (testData as any)?.candidates || []

  // Service instance
  const serviceRef = useRef<AdminLiveService | null>(null)
  const sessionIdRef = useRef(0)

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
      let resolvedName = info.candidateName;
      let resolvedEmail = info.candidateEmail;
      
      if (!resolvedName && assessmentCandidates && assessmentCandidates.length > 0) {
        const found = assessmentCandidates.find((c: any) => c.email === info.candidateId || (c as any).id === info.candidateId);
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

    const dedupedCandidates: CandidateData[] = [];
    Object.entries(sessionsByCandidate).forEach(([candidateId, sessions]) => {
      if (sessions.length === 0) return;
      if (sessions.length === 1) {
        dedupedCandidates.push(sessions[0]);
        return;
      }

      let best = sessions[0];
      
      for (const sess of sessions) {
        const hasTracks = (sess.webcamStream && sess.webcamStream.active) || (sess.screenStream && sess.screenStream.active);
        const bestHasTracks = (best.webcamStream && best.webcamStream.active) || (best.screenStream && best.screenStream.active);
        
        if (hasTracks && !bestHasTracks) {
          best = sess;
          continue;
        }
        
        if (hasTracks === bestHasTracks) {
          const sessWsConnected = sess.status === 'connected';
          const bestWsConnected = best.status === 'connected';
          
          if (sessWsConnected && !bestWsConnected) {
            best = sess;
            continue;
          }
          
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
  }, [assessmentCandidates])

  // Initialize service and start/stop monitoring
  useEffect(() => {
    if (!isOpen) return;
    if (!assessmentId || typeof assessmentId !== 'string' || !adminId) return;

    const currentSessionId = ++sessionIdRef.current;
    let service: AdminLiveService | null = null;

    const initMonitoring = async () => {
      try {
        if (currentSessionId !== sessionIdRef.current) {
          console.log('[Live Dashboard] Session outdated, aborting');
          return;
        }

        setIsLoading(true);
        
        service = new AdminLiveService({
          assessmentId,
          adminId,
        });

        if (currentSessionId !== sessionIdRef.current) {
          await service.stopMonitoring();
          return;
        }

        const result = await service.startMonitoring({
          onStateChange: (state: Partial<AdminLiveState>) => {
            if (currentSessionId === sessionIdRef.current) {
              if (state.isMonitoring !== undefined) setIsMonitoring(state.isMonitoring);
              if (state.isLoading !== undefined) setIsLoading(state.isLoading);
              if (state.candidateStreams) updateCandidates(state.candidateStreams);
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

        if (currentSessionId === sessionIdRef.current && result.success) {
          serviceRef.current = service;
          setIsMonitoring(true);
          setIsLoading(false);
          console.log('[Live Dashboard] ✅ Monitoring started');
        } else {
          await service.stopMonitoring();
        }
      } catch (error) {
        if (currentSessionId === sessionIdRef.current) {
          console.error('[Live Dashboard] Failed to start:', error);
          setIsLoading(false);
        }
      }
    };

    initMonitoring();

    return () => {
      console.log('[Live Dashboard] Cleanup: invalidating session', currentSessionId);
      if (service) {
        service.stopMonitoring().catch(console.error);
      }
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

  // Handle collapse: refresh streams when collapsing from expanded view
  useEffect(() => {
    if (prevExpandedSessionIdRef.current && !expandedSessionId) {
      const collapsedSessionId = prevExpandedSessionIdRef.current
      console.log(`[Live Dashboard] Collapsed from expanded view for ${collapsedSessionId} - auto-refreshing...`)
      
      const timeoutId = setTimeout(() => {
        if (serviceRef.current) {
          serviceRef.current.refreshCandidate(collapsedSessionId)
        }
      }, 200) 

      return () => clearTimeout(timeoutId)
    }

    prevExpandedSessionIdRef.current = expandedSessionId
  }, [expandedSessionId]) 

  // Attach streams to grid view video elements when candidates change
  useEffect(() => {
    if (expandedSessionId) return; 

    const timeoutId = setTimeout(() => {
      candidates.forEach((candidate) => {
        // Attach screen stream
        if (candidate.screenStream && candidate.screenStream.active) {
          const screenVideo = videoRefs.current.get(`screen-${candidate.sessionId}`);
          if (screenVideo && screenVideo.srcObject !== candidate.screenStream) {
            screenVideo.srcObject = candidate.screenStream;
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
            if (webcamVideo.paused) {
              webcamVideo.play().catch((err) => {
                console.error(`[Live Dashboard] Failed to play webcam for ${candidate.sessionId}:`, err);
              });
            }
          }
        }
      });
    }, 100); 

    return () => clearTimeout(timeoutId);
  }, [candidates, expandedSessionId]);

  // Attach streams to expanded video elements when expanded view is shown
  useEffect(() => {
    if (!expandedSessionId) return

    const expandedCandidate = candidates.find((c) => c.sessionId === expandedSessionId)
    if (!expandedCandidate) return

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
    }, 100)

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
                href={`/dsa/tests/${assessmentId}/analytics`}
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
            const rowCount = Math.ceil(candidatesArray.length / COLUMNS);

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
  videoRefs: React.MutableRefObject<Map<string, HTMLVideoElement>>
}

function CandidateTile({ candidate, onExpand, onRefresh, videoRefs }: CandidateTileProps) {
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
  )
}