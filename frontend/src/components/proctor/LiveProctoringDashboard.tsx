/**
 * LiveProctoringDashboard - COMPLETE REBUILD
 * 
 * Admin dashboard for viewing live candidate streams.
 * 
 * Features:
 * - Shows all active candidates with their webcam and screen streams
 * - Auto-connects when opened
 * - Handles stream updates and reconnections
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Video, Monitor, RefreshCw, User, Maximize2, ArrowLeft } from "lucide-react";
import { useMultiLiveProctorAdmin } from "@/hooks/proctoring/useMultiLiveProctorAdmin";

interface LiveProctoringDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  assessmentId: string;
  adminId: string;
}

// Video stream component - handles attaching MediaStream to video element
function VideoStream({ 
  stream, 
  label, 
  icon: Icon 
}: { 
  stream: MediaStream | null; 
  label: string; 
  icon: React.ComponentType<{ className?: string }>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset state
    setIsPlaying(false);
    setHasError(false);
    isPlayingRef.current = false;

    if (!stream || !stream.active) {
      video.srcObject = null;
      return;
    }

    // ALWAYS attach stream to video element (no deduplication)
    // IMPORTANT: For WebRTC MediaStreams, do NOT call video.load()
    // Just set srcObject and let the browser handle it naturally
    
    // Get stream tracks early for later use
    const streamTracks = stream.getTracks();
    if (streamTracks.length === 0) {
      return;
    }
    
    // Wait for video element to be visible and laid out before attaching stream
    // This is critical when switching between views (grid <-> expanded)
    const checkVisibilityAndAttach = () => {
      const isVisible = video.offsetWidth > 0 && video.offsetHeight > 0;
      const isInDOM = video.isConnected;
      
      if (!isVisible || !isInDOM) {
        // Retry after a short delay if not visible yet
        setTimeout(checkVisibilityAndAttach, 50);
        return;
      }
      
      // Clear existing srcObject first to ensure clean attachment
      if (video.srcObject) {
        video.srcObject = null;
      }
      
      // CRITICAL: Use the stream directly instead of creating a new one
      // Creating a new MediaStream from tracks can cause issues when switching views
      // The original stream from candidateStreams is already properly set up
      
      // Attach the stream directly (don't create a new MediaStream)
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      video.autoplay = true; // Ensure autoplay is set
      
      // Small delay then verify attachment and ensure video is ready
      setTimeout(() => {
        const attached = video.srcObject as MediaStream | null;
        if (!attached || attached.id !== stream.id) {
          video.srcObject = stream;
        }
        // Force a play attempt if video element is ready
        if (video.readyState > 0 || (video.videoWidth > 0 && video.videoHeight > 0)) {
          video.play().catch(() => {
            // Ignore play errors - will be handled by attemptPlay
          });
        }
      }, 100);
    };
    
    // Start the visibility check
    checkVisibilityAndAttach();

    // Verify stream is attached
    const attachedStream = video.srcObject as MediaStream | null;
    const streamMatches = attachedStream?.id === stream.id;
    const enabledTracks = streamTracks.filter((t: MediaStreamTrack) => t.enabled);
    
    // Store stream reference for later use
    const activeStream = stream;
    
    // Track listeners will be set up after attemptPlay is defined
    const trackListeners: Array<{ track: MediaStreamTrack; onEnded: () => void; onMute: () => void; onUnmute: () => void }> = [];

    // Play function with retry logic
    let playAttempts = 0;
    const maxAttempts = 15;
    let playTimeoutId: NodeJS.Timeout | null = null;
    let metadataLoaded = false;
    let pollIntervalId: NodeJS.Timeout | null = null;
    let pollCount = 0;
    let isPlayInProgress = false; // Prevent concurrent play() calls

    const attemptPlay = async () => {
      // Prevent concurrent play attempts
      if (isPlayInProgress) {
        return;
      }

      // CRITICAL: Only attempt play if we have frames (readyState > 0 OR dimensions > 0)
      // For WebRTC, play() will hang if called before frames arrive
      const hasDimensions = video.videoWidth > 0 && video.videoHeight > 0;
      const readyState = video.readyState;
      const currentStream = video.srcObject as MediaStream | null;
      const playTracks = currentStream?.getTracks() || [];
      const activeTracks = playTracks.filter(t => t.readyState === 'live' && t.enabled);
      const hasActiveTracks = activeTracks.length > 0;
      
      // Only play if we have actual frames (readyState > 0) OR dimensions
      // Don't play with readyState 0 even if tracks are live - frames haven't arrived yet
      const hasFrames = readyState > 0 || hasDimensions;
      
      if (!hasFrames) {
        return;
      }

      if (playAttempts >= maxAttempts) {
        setHasError(true);
        return;
      }
      playAttempts++;
      isPlayInProgress = true;

      try {
        // Add timeout to prevent hanging - WebRTC play() can hang if no frames
        const playPromise = video.play();
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('play() timeout - no frames received')), 3000);
        });
        
        await Promise.race([playPromise, timeoutPromise]);
        
        // Small delay to let browser process
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if video is actually playing after play() resolves
        const isActuallyPlaying = !video.paused && !video.ended && video.readyState > 0;
        const hasValidDimensions = video.videoWidth > 0 && video.videoHeight > 0;
        
        if (isActuallyPlaying && hasValidDimensions) {
          isPlayingRef.current = true;
          setIsPlaying(true);
          setHasError(false);
          isPlayInProgress = false;
          
          // Clear polling interval once playing
          if (pollIntervalId) {
            clearInterval(pollIntervalId);
            pollIntervalId = null;
          }
        } else {
          // play() resolved but video isn't actually playing - wait and retry
          isPlayInProgress = false;
          if (playAttempts < maxAttempts) {
            playTimeoutId = setTimeout(attemptPlay, 1000);
          } else {
            setHasError(true);
          }
        }
      } catch (err) {
        isPlayInProgress = false;
        // Retry after delay only if we have frames
        const hasFrames = video.readyState > 0 || (video.videoWidth > 0 && video.videoHeight > 0);
        if (hasFrames && playAttempts < maxAttempts) {
          playTimeoutId = setTimeout(attemptPlay, 1000);
        }
      }
    };

    // Set up track event listeners to detect when frames start flowing
    streamTracks.forEach((track, idx) => {
      const onEnded = () => {
        // Track ended
      };
      const onMute = () => {
        // Track muted
      };
      const onUnmute = () => {
        // When track unmutes, frames should be flowing - check video element
        setTimeout(() => {
          if (video.readyState > 0 || video.videoWidth > 0) {
            if (!isPlayingRef.current) {
              attemptPlay();
            }
          }
        }, 100);
      };
      
      track.addEventListener('ended', onEnded);
      track.addEventListener('mute', onMute);
      track.addEventListener('unmute', onUnmute);
      
      trackListeners.push({ track, onEnded, onMute, onUnmute });
    });

    // Track previous readyState to detect changes
    let lastReadyState = video.readyState;
    let lastWidth = video.videoWidth;
    let lastHeight = video.videoHeight;
    
    // Polling function to check video readiness (fallback if events don't fire)
    const pollVideoReady = () => {
      pollCount++;
      const readyState = video.readyState;
      const hasDimensions = video.videoWidth > 0 && video.videoHeight > 0;
      
      // Check track state as well (WebRTC specific)
      const currentStream = video.srcObject as MediaStream | null;
      const pollTracks = currentStream?.getTracks() || [];
      const activeTracks = pollTracks.filter(t => t.readyState === 'live' && t.enabled);
      const hasActiveTracks = activeTracks.length > 0;
      
      // Detect if readyState or dimensions changed (frames arriving!)
      const readyStateChanged = readyState !== lastReadyState;
      const dimensionsChanged = video.videoWidth !== lastWidth || video.videoHeight !== lastHeight;
      
      if (readyStateChanged || dimensionsChanged) {
        lastReadyState = readyState;
        lastWidth = video.videoWidth;
        lastHeight = video.videoHeight;
      }
      
      // CRITICAL: Only attempt play when we have actual frames (readyState > 0 OR dimensions > 0)
      // Don't play with readyState 0 - play() will hang waiting for frames
      const hasFrames = readyState > 0 || hasDimensions;
      
      // Attempt play only if we have frames AND we're not already playing
      const shouldAttemptPlay = hasFrames && !isPlayingRef.current && !isPlayInProgress;
      
      if (shouldAttemptPlay) {
        if (!metadataLoaded) {
          metadataLoaded = true;
        }
        attemptPlay();
      }
      
      // Stop polling if we've been playing for a while or reached max attempts
      if (isPlayingRef.current || playAttempts >= maxAttempts) {
        if (pollIntervalId) {
          clearInterval(pollIntervalId);
          pollIntervalId = null;
        }
      }
    };

    // Event handlers
    const onLoadedMetadata = () => {
      metadataLoaded = true;
      if (playTimeoutId) {
        clearTimeout(playTimeoutId);
        playTimeoutId = null;
      }
      // Stop polling since event fired
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
      // Now that metadata is loaded, attempt play
      attemptPlay();
    };

    const onCanPlay = () => {
      // If metadata loaded flag isn't set yet, set it now (canplay implies metadata is ready)
      if (!metadataLoaded) {
        metadataLoaded = true;
      }
      // Stop polling since event fired
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
      // Only attempt play if we haven't started playing yet
      if (!isPlayingRef.current) {
        attemptPlay();
      }
    };

    const onCanPlayThrough = () => {
      // Stop polling since event fired
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
      // If we still haven't started playing, try now
      if (!isPlayingRef.current) {
        attemptPlay();
      }
    };

    const onLoadedData = () => {
      // Frames are arriving, try to play
      if (!isPlayingRef.current) {
        attemptPlay();
      }
    };

    const onPlaying = () => {
      isPlayingRef.current = true;
      setIsPlaying(true);
      setHasError(false);
      // Stop polling since we're playing
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
        pollIntervalId = null;
      }
    };

    const onError = (e: Event) => {
      setHasError(true);
    };

    // Add all event listeners
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('loadeddata', onLoadedData);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('canplaythrough', onCanPlayThrough);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);

    // Check if metadata is already loaded (can happen with fast streams)
    // Use activeStream which is the stream attached to video element
    const initTracks = activeStream?.getTracks() || [];
    const activeTracks = initTracks.filter(t => t.readyState === 'live' && t.enabled);
    const hasActiveTracks = activeTracks.length > 0;
    
    // Check if we already have frames
    if (video.readyState > 0 || (video.videoWidth > 0 && video.videoHeight > 0)) {
      metadataLoaded = true;
      setTimeout(attemptPlay, 100);
    } else {
      // No frames yet - wait for events or polling to detect when frames arrive
      metadataLoaded = false;
      // Start polling to detect when frames arrive
      pollIntervalId = setInterval(pollVideoReady, 500);
    }

    return () => {
      if (playTimeoutId) {
        clearTimeout(playTimeoutId);
      }
      if (pollIntervalId) {
        clearInterval(pollIntervalId);
      }
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('loadeddata', onLoadedData);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('canplaythrough', onCanPlayThrough);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
      
      // Clean up track listeners
      trackListeners.forEach(({ track, onEnded, onMute, onUnmute }) => {
        track.removeEventListener('ended', onEnded);
        track.removeEventListener('mute', onMute);
        track.removeEventListener('unmute', onUnmute);
      });
    };
  }, [stream, label]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden w-full h-full min-h-[200px]">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="w-full h-full object-contain"
      />
      
      {/* Label */}
      <div className="absolute top-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-white flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </div>
      
      {/* Loading/Error indicator - removed "No stream" text as requested */}
      {!isPlaying && hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800/80">
          <span className="text-gray-400 text-sm">
            Error loading stream
          </span>
        </div>
      )}
    </div>
  );
}

// Candidate card component
function CandidateCard({
  sessionId,
  candidateId,
  candidateName,
  candidateEmail,
  status,
  webcamStream,
  screenStream,
  error,
  onRefresh,
  onView,
}: {
  sessionId: string;
  candidateId: string;
  candidateName?: string;
  candidateEmail?: string;
  status: string;
  webcamStream: MediaStream | null;
  screenStream: MediaStream | null;
  error: string | null;
  onRefresh: () => void;
  onView: () => void;
}) {
  // Display name priority: name > email > id
  const displayName = candidateName || candidateEmail || candidateId;
  
  // Status indicator color
  const statusColor = {
    connecting: "bg-yellow-500",
    connected: "bg-green-500",
    disconnected: "bg-gray-500",
    failed: "bg-red-500",
  }[status] || "bg-gray-500";

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
            <User className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm truncate max-w-[200px]">
              {displayName}
            </p>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${statusColor}`} />
              <span className="text-xs text-gray-500 capitalize">{status}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={onView}
            className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
            title="View in full screen"
          >
            <Maximize2 className="w-4 h-4 text-gray-600" />
          </button>
          <button
            onClick={onRefresh}
            className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
            title="Refresh connection"
          >
            <RefreshCw className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>
      
      {/* Streams */}
      <div className="p-3 grid grid-cols-2 gap-2">
        <VideoStream 
          key={`grid-webcam-${sessionId}`}
          stream={webcamStream} 
          label="Webcam" 
          icon={Video} 
        />
        <VideoStream 
          key={`grid-screen-${sessionId}`}
          stream={screenStream} 
          label="Screen" 
          icon={Monitor} 
        />
      </div>
      
      {/* Error message */}
      {error && (
        <div className="px-3 pb-3">
          <p className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded">{error}</p>
        </div>
      )}
    </div>
  );
}

// Main dashboard component
export function LiveProctoringDashboard({
  isOpen,
  onClose,
  assessmentId,
  adminId,
}: LiveProctoringDashboardProps) {
  const hasStartedRef = useRef(false);
  
  const {
    candidateStreams,
    activeCandidates,
    isLoading,
    startMonitoring,
    stopMonitoring,
    refreshCandidate,
  } = useMultiLiveProctorAdmin({
    assessmentId,
    adminId,
    debugMode: false,
    onError: (err) => {
      // Error handling without console logs
    },
  });

  // Track if dashboard was previously closed (for reconnection handling)
  const wasClosedRef = useRef(false);
  const hasRefreshedRef = useRef(false);
  
  // Start monitoring when dashboard opens
  useEffect(() => {
    if (!isOpen) {
      wasClosedRef.current = true; // Mark as closed when dashboard closes
      hasRefreshedRef.current = false; // Reset refresh flag
      return;
    }
    
    if (hasStartedRef.current) {
      return;
    }
    
    hasStartedRef.current = true;
    startMonitoring();
  }, [isOpen, startMonitoring]);
  
  // Refresh candidates when dashboard reopens (after active sessions are loaded)
  useEffect(() => {
    if (!isOpen || !wasClosedRef.current || hasRefreshedRef.current) return;
    
    // Only refresh if we have active candidates (sessions have been loaded)
    if (activeCandidates.length > 0) {
      hasRefreshedRef.current = true;
      wasClosedRef.current = false;
      
      // Refresh each candidate to request fresh offers
      activeCandidates.forEach(sessionId => {
        refreshCandidate(sessionId);
      });
    }
  }, [isOpen, activeCandidates, refreshCandidate]);

  // Stop when closed
  useEffect(() => {
    if (!isOpen && hasStartedRef.current) {
      hasStartedRef.current = false;
      stopMonitoring();
    }
  }, [isOpen, stopMonitoring]);

  // Handle close button
  const handleClose = useCallback(() => {
    hasStartedRef.current = false;
    stopMonitoring();
    onClose();
  }, [onClose, stopMonitoring]);
  
  // Individual view state - store only sessionId, then look up from candidateStreams
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  if (!isOpen) return null;

  const candidates = Array.from(candidateStreams.values());
  // Get current candidate data from Map (always up-to-date streams)
  const selectedCandidate = selectedSessionId ? candidateStreams.get(selectedSessionId) || null : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-gray-100 rounded-xl shadow-2xl w-[95vw] max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b flex items-center justify-between">
          {selectedCandidate ? (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedSessionId(null)}
                  className="p-1.5 hover:bg-gray-100 rounded-full transition-colors mr-2"
                  title="Back to all candidates"
                >
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">
                      {selectedCandidate.candidateName || selectedCandidate.candidateEmail || selectedCandidate.candidateId}
                    </h2>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`w-2 h-2 rounded-full ${
                        selectedCandidate.status === 'connected' ? 'bg-green-500' :
                        selectedCandidate.status === 'connecting' ? 'bg-yellow-500' :
                        selectedCandidate.status === 'failed' ? 'bg-red-500' :
                        'bg-gray-500'
                      }`} />
                      <span className="text-sm text-gray-500 capitalize">{selectedCandidate.status}</span>
                    </div>
                  </div>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-xl font-semibold">Live Proctoring Dashboard</h2>
                <p className="text-sm text-green-600">
                  Monitoring {candidates.length} active candidate{candidates.length !== 1 ? "s" : ""}
                </p>
              </div>
              
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {selectedCandidate ? (
            /* Expanded view for selected candidate - using same streams as grid view */
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
              <div className="flex flex-col min-h-0">
                <div className="flex items-center gap-2 text-gray-700 mb-3">
                  <Video className="w-5 h-5" />
                  <span className="font-medium">Webcam</span>
                </div>
                <div className="flex-1 min-h-[400px]">
                  <VideoStream 
                    key={`expanded-webcam-${selectedCandidate.sessionId}`}
                    stream={selectedCandidate.webcamStream} 
                    label="Webcam" 
                    icon={Video} 
                  />
                </div>
              </div>
              <div className="flex flex-col min-h-0">
                <div className="flex items-center gap-2 text-gray-700 mb-3">
                  <Monitor className="w-5 h-5" />
                  <span className="font-medium">Screen Share</span>
                </div>
                <div className="flex-1 min-h-[400px]">
                  <VideoStream 
                    key={`expanded-screen-${selectedCandidate.sessionId}`}
                    stream={selectedCandidate.screenStream} 
                    label="Screen" 
                    icon={Monitor} 
                  />
                </div>
              </div>
              {selectedCandidate.error && (
                <div className="col-span-2 mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-600">{selectedCandidate.error}</p>
                </div>
              )}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
              <span className="ml-3 text-gray-600">Connecting...</span>
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
              <Video className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-lg">No active candidates</p>
              <p className="text-sm">Candidates will appear here when they start their test</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {candidates.map((candidate) => (
                <CandidateCard
                  key={candidate.sessionId}
                  sessionId={candidate.sessionId}
                  candidateId={candidate.candidateId}
                  candidateName={candidate.candidateName}
                  candidateEmail={candidate.candidateEmail}
                  status={candidate.status}
                  webcamStream={candidate.webcamStream}
                  screenStream={candidate.screenStream}
                  error={candidate.error}
                  onRefresh={() => refreshCandidate(candidate.sessionId)}
                  onView={() => setSelectedSessionId(candidate.sessionId)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default LiveProctoringDashboard;

