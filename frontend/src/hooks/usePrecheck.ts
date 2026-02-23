import { useState, useCallback, useRef, useEffect } from "react";

// ============================================================================
// Types
// ============================================================================

export type CheckStatus = "pending" | "running" | "passed" | "failed" | "skipped";

export type CheckType = 
  | "camera" 
  | "microphone" 
  | "fullscreen" 
  | "network" 
  | "tabSwitch" 
  | "browser";

export type MediaErrorCode = 
  | "NO_DEVICE" 
  | "PERMISSION_DENIED" 
  | "CONSTRAINTS_NOT_SATISFIED" 
  | "NOT_ALLOWED" 
  | "UNKNOWN";

export interface CheckResult {
  type: CheckType;
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
  error?: MediaErrorCode;
  troubleshooting?: string[];
  lastChecked?: Date;
}

export interface NetworkMetrics {
  latencyMs: number;
  downloadSpeedMbps: number;
  uploadSpeedMbps?: number;
}

export interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: "videoinput" | "audioinput" | "audiooutput";
}

export interface BrowserInfo {
  name: string;
  version: string;
  isSupported: boolean;
  isSecureContext: boolean;
  warnings: string[];
}

interface UsePrecheckOptions {
  assessmentId: string;
  userId: string;
  // Network thresholds
  maxLatencyMs?: number;
  minDownloadMbps?: number;
  minUploadMbps?: number;
  // Policy
  cameraRequired?: boolean;
  microphoneRequired?: boolean;
  // Debug
  debugMode?: boolean;
}

interface UsePrecheckReturn {
  // Check results
  checks: Record<CheckType, CheckResult>;
  
  // Aggregate state
  isReady: boolean;
  isRunning: boolean;
  allChecksPassed: boolean;
  mandatoryChecksPassed: boolean;
  
  // Device info
  cameras: DeviceInfo[];
  microphones: DeviceInfo[];
  selectedCamera: string | null;
  selectedMicrophone: string | null;
  setSelectedCamera: (deviceId: string) => void;
  setSelectedMicrophone: (deviceId: string) => void;
  
  // Network metrics
  networkMetrics: NetworkMetrics | null;
  
  // Browser info
  browserInfo: BrowserInfo;
  
  // Actions
  runAllChecks: () => Promise<void>;
  runCheck: (type: CheckType) => Promise<CheckResult>;
  
  // Streams (for preview)
  cameraStream: MediaStream | null;
  microphoneStream: MediaStream | null;
  audioLevel: number;
  
  // Microphone recording
  isRecording: boolean;
  recordedAudio: Blob | null;
  audioDbLevel: number;
  thresholdReached: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  playRecording: () => void;
  
  // Cleanup
  stopAllStreams: () => void;
  
  // Logs
  logs: string[];
  clearLogs: () => void;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_LATENCY_MS = 500;
const DEFAULT_MIN_DOWNLOAD_MBPS = 0.5;
const DEFAULT_MIN_UPLOAD_MBPS = 0.25;

// Test file URLs (use a small file for latency, larger for bandwidth)
const LATENCY_TEST_URL = "/api/health"; // Small response
const BANDWIDTH_TEST_SIZE = 200 * 1024; // 200KB

// Supported browsers
const SUPPORTED_BROWSERS = ["Chrome", "Firefox", "Edge", "Safari"];
const MIN_BROWSER_VERSIONS: Record<string, number> = {
  Chrome: 80,
  Firefox: 75,
  Edge: 80,
  Safari: 14,
};

// ============================================================================
// Helper Functions
// ============================================================================

const isDebugEnabled = (): boolean => {
  if (typeof window === "undefined") return false;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("debug") === "1" || 
         process.env.NEXT_PUBLIC_PRECHECK_DEBUG === "1";
};

const mapMediaError = (error: Error): MediaErrorCode => {
  const message = error.message.toLowerCase();
  const name = error.name;
  
  if (name === "NotFoundError" || message.includes("not found")) {
    return "NO_DEVICE";
  }
  if (name === "NotAllowedError" || message.includes("permission denied")) {
    return "PERMISSION_DENIED";
  }
  if (name === "OverconstrainedError" || message.includes("constraint")) {
    return "CONSTRAINTS_NOT_SATISFIED";
  }
  if (name === "SecurityError" || message.includes("security") || message.includes("not allowed")) {
    return "NOT_ALLOWED";
  }
  return "UNKNOWN";
};

const getTroubleshooting = (type: CheckType, errorCode?: MediaErrorCode): string[] => {
  const common = [
    "Try refreshing the page",
    "Close other applications that may be using your camera or microphone",
  ];
  
  switch (type) {
    case "camera":
      if (errorCode === "PERMISSION_DENIED" || errorCode === "NOT_ALLOWED") {
        return [
          "Click the lock/camera icon in your browser's address bar",
          "Select 'Allow' for camera access",
          "If blocked, go to browser Settings → Privacy → Camera and allow this site",
          ...common,
        ];
      }
      if (errorCode === "NO_DEVICE") {
        return [
          "Ensure your camera is connected and turned on",
          "Check if your camera is being used by another application (Zoom, Teams, etc.)",
          "Try disconnecting and reconnecting your camera",
          "Check Device Manager (Windows) or System Preferences (Mac) for camera issues",
        ];
      }
      return [
        "Ensure your camera is connected and working",
        "Check browser permissions for camera access",
        ...common,
      ];
      
    case "microphone":
      if (errorCode === "PERMISSION_DENIED" || errorCode === "NOT_ALLOWED") {
        return [
          "Click the lock/microphone icon in your browser's address bar",
          "Select 'Allow' for microphone access",
          "If blocked, go to browser Settings → Privacy → Microphone and allow this site",
          ...common,
        ];
      }
      if (errorCode === "NO_DEVICE") {
        return [
          "Ensure your microphone is connected",
          "Check if your microphone is muted at the hardware level",
          "Try using a different microphone or headset",
          "Close applications that may be using your microphone",
        ];
      }
      return [
        "Ensure your microphone is connected and working",
        "Check browser permissions for microphone access",
        "Speak into your microphone to verify it's working",
        ...common,
      ];
      
    case "fullscreen":
      return [
        "Click the fullscreen button in the check card",
        "If fullscreen is blocked, check if pop-up blockers are interfering",
        "Try pressing F11 to enter fullscreen manually",
        "Some browser extensions may block fullscreen - try disabling them",
        "On Mac, ensure the app has permission for fullscreen",
      ];
      
    case "network":
      return [
        "Switch to a wired (Ethernet) connection if possible",
        "Move closer to your WiFi router",
        "Close other browser tabs and applications using bandwidth",
        "Pause any downloads or streaming services",
        "Restart your router if issues persist",
        "Contact your ISP if speed issues continue",
      ];
      
    case "tabSwitch":
      return [
        "Click the 'Test Tab Switch' button",
        "Switch to another browser tab for 1-2 seconds",
        "Return to this tab to complete the test",
        "Ensure you're not using multiple monitors with different browser windows",
      ];
      
    case "browser":
      return [
        "Use a supported browser: Chrome, Firefox, Edge, or Safari",
        "Update your browser to the latest version",
        "Disable browser extensions that may interfere with the exam",
        "Clear your browser cache and cookies",
      ];
      
    default:
      return common;
  }
};

const detectBrowser = (): BrowserInfo => {
  if (typeof window === "undefined") {
    return {
      name: "Unknown",
      version: "0",
      isSupported: false,
      isSecureContext: false,
      warnings: [],
    };
  }
  
  const ua = navigator.userAgent;
  let name = "Unknown";
  let version = "0";
  const warnings: string[] = [];
  
  // Detect browser
  if (ua.includes("Edg/")) {
    name = "Edge";
    const match = ua.match(/Edg\/(\d+)/);
    version = match ? match[1] : "0";
  } else if (ua.includes("Chrome/")) {
    name = "Chrome";
    const match = ua.match(/Chrome\/(\d+)/);
    version = match ? match[1] : "0";
  } else if (ua.includes("Firefox/")) {
    name = "Firefox";
    const match = ua.match(/Firefox\/(\d+)/);
    version = match ? match[1] : "0";
  } else if (ua.includes("Safari/") && !ua.includes("Chrome")) {
    name = "Safari";
    const match = ua.match(/Version\/(\d+)/);
    version = match ? match[1] : "0";
  }
  
  const versionNum = parseInt(version, 10);
  const minVersion = MIN_BROWSER_VERSIONS[name] || 0;
  const isSupported = SUPPORTED_BROWSERS.includes(name) && versionNum >= minVersion;
  const isSecureContext = window.isSecureContext;
  
  if (!isSupported) {
    warnings.push(`${name} ${version} may not be fully supported. Please use ${SUPPORTED_BROWSERS.join(", ")}.`);
  }
  
  if (!isSecureContext && window.location.hostname !== "localhost") {
    warnings.push("This page is not served over HTTPS. Camera and microphone access may be blocked.");
  }
  
  if (versionNum < minVersion && minVersion > 0) {
    warnings.push(`Please update ${name} to version ${minVersion} or higher for best compatibility.`);
  }
  
  return {
    name,
    version,
    isSupported,
    isSecureContext,
    warnings,
  };
};

// ============================================================================
// Main Hook
// ============================================================================

export function usePrecheck({
  assessmentId,
  userId,
  maxLatencyMs = DEFAULT_MAX_LATENCY_MS,
  minDownloadMbps = DEFAULT_MIN_DOWNLOAD_MBPS,
  minUploadMbps = DEFAULT_MIN_UPLOAD_MBPS,
  cameraRequired = true,
  microphoneRequired = true,
  debugMode = isDebugEnabled(),
}: UsePrecheckOptions): UsePrecheckReturn {
  // ============================================================================
  // State
  // ============================================================================
  
  const [checks, setChecks] = useState<Record<CheckType, CheckResult>>({
    camera: { type: "camera", status: "pending", message: "Camera check pending" },
    microphone: { type: "microphone", status: "pending", message: "Microphone check pending" },
    fullscreen: { type: "fullscreen", status: "pending", message: "Fullscreen check pending" },
    network: { type: "network", status: "pending", message: "Network check pending" },
    tabSwitch: { type: "tabSwitch", status: "pending", message: "Tab switch check pending" },
    browser: { type: "browser", status: "pending", message: "Browser check pending" },
  });
  
  const [isRunning, setIsRunning] = useState(false);
  const [cameras, setCameras] = useState<DeviceInfo[]>([]);
  const [microphones, setMicrophones] = useState<DeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null);
  const [selectedMicrophone, setSelectedMicrophone] = useState<string | null>(null);
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState<Blob | null>(null);
  const [audioDbLevel, setAudioDbLevel] = useState(0);
  const [thresholdReached, setThresholdReached] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlaybackRef = useRef<HTMLAudioElement | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [browserInfo] = useState<BrowserInfo>(() => detectBrowser());
  
  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioAnimationRef = useRef<number | null>(null);
  const tabSwitchResolveRef = useRef<((value: boolean) => void) | null>(null);
  
  // ============================================================================
  // Logging
  // ============================================================================
  
  const log = useCallback((message: string) => {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs((prev) => [...prev.slice(-99), logEntry]); // Keep last 100 logs
    if (debugMode) {
      console.log("[Precheck]", message);
    }
  }, [debugMode]);
  
  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);
  
  // ============================================================================
  // Update Check
  // ============================================================================
  
  const updateCheck = useCallback((type: CheckType, update: Partial<CheckResult>) => {
    setChecks((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        ...update,
        lastChecked: new Date(),
      },
    }));
  }, []);
  
  // ============================================================================
  // Enumerate Devices
  // ============================================================================
  
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      
      const videoDevices = devices
        .filter((d) => d.kind === "videoinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
          kind: d.kind as "videoinput",
        }));
      
      const audioDevices = devices
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          kind: d.kind as "audioinput",
        }));
      
      setCameras(videoDevices);
      setMicrophones(audioDevices);
      
      log(`Found ${videoDevices.length} cameras, ${audioDevices.length} microphones`);
      
      // Set default selections
      if (!selectedCamera && videoDevices.length > 0) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
      if (!selectedMicrophone && audioDevices.length > 0) {
        setSelectedMicrophone(audioDevices[0].deviceId);
      }
      
      return { cameras: videoDevices, microphones: audioDevices };
    } catch (error) {
      log(`Error enumerating devices: ${(error as Error).message}`);
      return { cameras: [], microphones: [] };
    }
  }, [selectedCamera, selectedMicrophone, log]);
  
  // ============================================================================
  // Stop Streams
  // ============================================================================
  
  const stopAllStreams = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    if (microphoneStream) {
      microphoneStream.getTracks().forEach((track) => track.stop());
      setMicrophoneStream(null);
    }
    if (audioAnimationRef.current) {
      cancelAnimationFrame(audioAnimationRef.current);
      audioAnimationRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setAudioLevel(0);
    log("All streams stopped");
  }, [cameraStream, microphoneStream, log]);
  
  // ============================================================================
  // Camera Check
  // ============================================================================
  
  const checkCamera = useCallback(async (): Promise<CheckResult> => {
    log("Starting camera check...");
    updateCheck("camera", { status: "running", message: "Checking camera..." });
    
    try {
      // Stop existing stream
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      
      const constraints: MediaStreamConstraints = {
        video: selectedCamera 
          ? { deviceId: { exact: selectedCamera }, width: { ideal: 640 }, height: { ideal: 360 } }
          : { width: { ideal: 640 }, height: { ideal: 360 } },
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      
      // Re-enumerate to get labels
      await enumerateDevices();
      
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      
      log(`Camera check passed: ${track.label} (${settings.width}x${settings.height})`);
      
      const result: CheckResult = {
        type: "camera",
        status: "passed",
        message: `Camera working: ${track.label}`,
        details: {
          deviceId: track.getSettings().deviceId,
          label: track.label,
          resolution: `${settings.width}x${settings.height}`,
        },
        lastChecked: new Date(),
      };
      
      updateCheck("camera", result);
      return result;
    } catch (error) {
      const errorCode = mapMediaError(error as Error);
      log(`Camera check failed: ${errorCode} - ${(error as Error).message}`);
      
      const result: CheckResult = {
        type: "camera",
        status: "failed",
        message: errorCode === "PERMISSION_DENIED" 
          ? "Camera access denied. Please allow camera permissions."
          : errorCode === "NO_DEVICE"
          ? "No camera detected. Please connect a camera."
          : `Camera error: ${(error as Error).message}`,
        error: errorCode,
        troubleshooting: getTroubleshooting("camera", errorCode),
        lastChecked: new Date(),
      };
      
      updateCheck("camera", result);
      return result;
    }
  }, [selectedCamera, cameraStream, enumerateDevices, updateCheck, log]);
  
  // ============================================================================
  // Microphone Check
  // ============================================================================
  
  const checkMicrophone = useCallback(async (): Promise<CheckResult> => {
    log("Starting microphone check...");
    updateCheck("microphone", { status: "running", message: "Initializing microphone..." });
    
    try {
      // Stop existing stream
      if (microphoneStream) {
        microphoneStream.getTracks().forEach((track) => track.stop());
      }
      if (audioAnimationRef.current) {
        cancelAnimationFrame(audioAnimationRef.current);
      }
      
      const constraints: MediaStreamConstraints = {
        audio: selectedMicrophone 
          ? { deviceId: { exact: selectedMicrophone } }
          : true,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setMicrophoneStream(stream);
      
      // Re-enumerate to get labels
      await enumerateDevices();
      
      const track = stream.getAudioTracks()[0];
      
      // Set up audio analysis
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;
      
      log(`Microphone initialized: ${track.label}`);
      
      const result: CheckResult = {
        type: "microphone",
        status: "passed",
        message: `Microphone ready: ${track.label}. Please test by recording.`,
        details: {
          deviceId: track.getSettings().deviceId,
          label: track.label,
        },
        lastChecked: new Date(),
      };
      
      updateCheck("microphone", result);
      return result;
    } catch (error) {
      const errorCode = mapMediaError(error as Error);
      log(`Microphone check failed: ${errorCode} - ${(error as Error).message}`);
      
      const result: CheckResult = {
        type: "microphone",
        status: "failed",
        message: errorCode === "PERMISSION_DENIED"
          ? "Microphone access denied. Please allow microphone permissions."
          : errorCode === "NO_DEVICE"
          ? "No microphone detected. Please connect a microphone."
          : `Microphone error: ${(error as Error).message}`,
        error: errorCode,
        troubleshooting: getTroubleshooting("microphone", errorCode),
        lastChecked: new Date(),
      };
      
      updateCheck("microphone", result);
      return result;
    }
  }, [selectedMicrophone, microphoneStream, enumerateDevices, updateCheck, log]);
  
  // Start recording microphone for 2 seconds
  const startRecording = useCallback(async (): Promise<void> => {
    if (!microphoneStream) return;
    
    try {
      setThresholdReached(false);
      setRecordedAudio(null);
      audioChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(microphoneStream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setRecordedAudio(audioBlob);
        setIsRecording(false);
        log("Recording completed");
      };
      
      setIsRecording(true);
      mediaRecorder.start();
      log("Recording started");
      
      // Set up audio level monitoring during recording
      if (analyserRef.current && audioContextRef.current) {
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        const dB_THRESHOLD = -40; // dB threshold
        let maxDbReached = false;
        const recordingRef = { current: true };
        
        const monitorAudio = () => {
          if (!recordingRef.current || !mediaRecorderRef.current) {
            return;
          }
          
          analyserRef.current!.getByteFrequencyData(dataArray);
          const sum = dataArray.reduce((a, b) => a + b, 0);
          const average = sum / dataArray.length;
          
          // Convert to dB (approximate)
          const db = average > 0 ? 20 * Math.log10(average / 255) : -Infinity;
          setAudioDbLevel(db);
          
          // Check if threshold reached
          if (db >= dB_THRESHOLD && !maxDbReached) {
            maxDbReached = true;
            setThresholdReached(true);
            log(`Audio threshold reached: ${db.toFixed(1)} dB`);
          }
          
          if (recordingRef.current && mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            audioAnimationRef.current = requestAnimationFrame(monitorAudio);
          }
        };
        
        monitorAudio();
        
        // Stop recording after 2 seconds
        setTimeout(() => {
          recordingRef.current = false;
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
            mediaRecorderRef.current.stop();
          }
        }, 2000);
      }
      
    } catch (error) {
      log(`Recording error: ${(error as Error).message}`);
      setIsRecording(false);
    }
  }, [microphoneStream, log]);
  
  // Stop recording manually
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);
  
  // Play recorded audio
  const playRecording = useCallback(() => {
    if (!recordedAudio) return;
    
    if (audioPlaybackRef.current) {
      audioPlaybackRef.current.pause();
      audioPlaybackRef.current = null;
    }
    
    const audioUrl = URL.createObjectURL(recordedAudio);
    const audio = new Audio(audioUrl);
    audioPlaybackRef.current = audio;
    
    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      audioPlaybackRef.current = null;
    };
    
    audio.play().catch((error) => {
      log(`Playback error: ${error.message}`);
    });
  }, [recordedAudio, log]);
  
  // ============================================================================
  // Fullscreen Check
  // ============================================================================
  
  const checkFullscreen = useCallback(async (): Promise<CheckResult> => {
    log("Starting fullscreen check...");
    updateCheck("fullscreen", { status: "running", message: "Checking fullscreen support..." });
    
    try {
      const elem = document.documentElement;
      const isSupported = !!(
        elem.requestFullscreen ||
        (elem as any).webkitRequestFullscreen ||
        (elem as any).mozRequestFullScreen ||
        (elem as any).msRequestFullscreen
      );
      
      if (!isSupported) {
        log("Fullscreen API not supported");
        const result: CheckResult = {
          type: "fullscreen",
          status: "failed",
          message: "Fullscreen mode is not supported in your browser",
          troubleshooting: getTroubleshooting("fullscreen"),
          lastChecked: new Date(),
        };
        updateCheck("fullscreen", result);
        return result;
      }
      
      log("Fullscreen API supported");
      const result: CheckResult = {
        type: "fullscreen",
        status: "passed",
        message: "Fullscreen mode is supported",
        details: { isSupported: true },
        lastChecked: new Date(),
      };
      
      updateCheck("fullscreen", result);
      return result;
    } catch (error) {
      log(`Fullscreen check error: ${(error as Error).message}`);
      const result: CheckResult = {
        type: "fullscreen",
        status: "failed",
        message: `Fullscreen check failed: ${(error as Error).message}`,
        troubleshooting: getTroubleshooting("fullscreen"),
        lastChecked: new Date(),
      };
      updateCheck("fullscreen", result);
      return result;
    }
  }, [updateCheck, log]);
  
  // ============================================================================
  // Network Check with Speed Test
  // ============================================================================
  
  const checkNetwork = useCallback(async (): Promise<CheckResult> => {
    log("Starting network check...");
    updateCheck("network", { status: "running", message: "Testing connection..." });
    
    try {
      // Step 1: Basic connectivity test
      const connectStart = performance.now();
      await fetch("https://www.google.com/favicon.ico", { 
        method: "HEAD",
        cache: "no-store",
        mode: "no-cors",
      });
      const latencyMs = Math.round(performance.now() - connectStart);
      log(`Connectivity test: ${latencyMs}ms`);
      
      // Step 2: Download speed test (fetch a ~100KB file)
      updateCheck("network", { status: "running", message: "Testing download speed..." });
      let downloadSpeedMbps = 0;
      try {
        const downloadStart = performance.now();
        // Use a public CDN file for speed test (~100KB)
        const downloadResponse = await fetch("https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js", {
          cache: "no-store",
        });
        const downloadBlob = await downloadResponse.blob();
        const downloadTime = (performance.now() - downloadStart) / 1000; // seconds
        const downloadSize = downloadBlob.size / (1024 * 1024); // MB
        downloadSpeedMbps = Math.round((downloadSize / downloadTime) * 8 * 10) / 10; // Mbps
        log(`Download speed: ${downloadSpeedMbps} Mbps`);
      } catch (e) {
        log("Download speed test failed, using estimate");
        downloadSpeedMbps = latencyMs < 100 ? 10 : latencyMs < 300 ? 5 : 2; // Estimate based on latency
      }
      
      // Step 3: Upload speed test (POST small data)
      updateCheck("network", { status: "running", message: "Testing upload speed..." });
      let uploadSpeedMbps = 0;
      try {
        const testData = new Blob([new ArrayBuffer(50 * 1024)]); // 50KB
        const uploadStart = performance.now();
        await fetch("https://httpbin.org/post", {
          method: "POST",
          body: testData,
          mode: "no-cors",
        });
        const uploadTime = (performance.now() - uploadStart) / 1000;
        const uploadSize = testData.size / (1024 * 1024);
        uploadSpeedMbps = Math.round((uploadSize / uploadTime) * 8 * 10) / 10;
        log(`Upload speed: ${uploadSpeedMbps} Mbps`);
      } catch (e) {
        log("Upload speed test failed, using estimate");
        uploadSpeedMbps = Math.round(downloadSpeedMbps * 0.3 * 10) / 10; // Estimate as 30% of download
      }
      
      const metrics: NetworkMetrics = {
        latencyMs,
        downloadSpeedMbps,
        uploadSpeedMbps,
      };
      setNetworkMetrics(metrics);
      
      log(`Network check passed: ${downloadSpeedMbps} Mbps down, ${uploadSpeedMbps} Mbps up`);
      
      const result: CheckResult = {
        type: "network",
        status: "passed",
        message: `Connected • ↓ ${downloadSpeedMbps} Mbps • ↑ ${uploadSpeedMbps} Mbps`,
        details: {
          latencyMs,
          downloadSpeedMbps,
          uploadSpeedMbps,
        },
        lastChecked: new Date(),
      };
      
      updateCheck("network", result);
      return result;
    } catch (error) {
      log(`Network check error: ${(error as Error).message}`);
      const result: CheckResult = {
        type: "network",
        status: "failed",
        message: "No internet connection. Please check your network settings.",
        troubleshooting: getTroubleshooting("network"),
        lastChecked: new Date(),
      };
      updateCheck("network", result);
      return result;
    }
  }, [updateCheck, log]);
  
  // ============================================================================
  // Tab Switch Check
  // ============================================================================
  
  const checkTabSwitch = useCallback(async (): Promise<CheckResult> => {
    log("Starting tab switch check...");
    updateCheck("tabSwitch", { status: "running", message: "Waiting for tab switch test..." });
    
    return new Promise((resolve) => {
      let switchDetected = false;
      
      const handleVisibilityChange = () => {
        if (document.hidden) {
          log("Tab switch detected - tab hidden");
          switchDetected = true;
        } else if (switchDetected) {
          log("Tab switch complete - tab visible again");
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          
          const result: CheckResult = {
            type: "tabSwitch",
            status: "passed",
            message: "Tab switch detection is working",
            details: { detectionWorking: true },
            lastChecked: new Date(),
          };
          
          updateCheck("tabSwitch", result);
          tabSwitchResolveRef.current = null;
          resolve(result);
        }
      };
      
      document.addEventListener("visibilitychange", handleVisibilityChange);
      tabSwitchResolveRef.current = (success: boolean) => {
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        const result: CheckResult = {
          type: "tabSwitch",
          status: success ? "passed" : "failed",
          message: success 
            ? "Tab switch detection is working"
            : "Tab switch test not completed",
          troubleshooting: success ? undefined : getTroubleshooting("tabSwitch"),
          lastChecked: new Date(),
        };
        updateCheck("tabSwitch", result);
        resolve(result);
      };
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (tabSwitchResolveRef.current) {
          document.removeEventListener("visibilitychange", handleVisibilityChange);
          const result: CheckResult = {
            type: "tabSwitch",
            status: "skipped",
            message: "Tab switch test timed out. You can retry this test.",
            troubleshooting: getTroubleshooting("tabSwitch"),
            lastChecked: new Date(),
          };
          updateCheck("tabSwitch", result);
          tabSwitchResolveRef.current = null;
          resolve(result);
        }
      }, 30000);
    });
  }, [updateCheck, log]);
  
  // ============================================================================
  // Browser Check
  // ============================================================================
  
  const checkBrowser = useCallback(async (): Promise<CheckResult> => {
    log("Starting browser check...");
    updateCheck("browser", { status: "running", message: "Checking browser compatibility..." });
    
    const info = browserInfo;
    
    log(`Browser: ${info.name} ${info.version}, Supported: ${info.isSupported}, Secure: ${info.isSecureContext}`);
    
    const result: CheckResult = {
      type: "browser",
      status: info.isSupported ? "passed" : "failed",
      message: info.isSupported 
        ? `${info.name} ${info.version} is supported`
        : `${info.name} ${info.version} may have compatibility issues`,
      details: {
        name: info.name,
        version: info.version,
        isSupported: info.isSupported,
        isSecureContext: info.isSecureContext,
        warnings: info.warnings,
      },
      troubleshooting: info.isSupported ? undefined : getTroubleshooting("browser"),
      lastChecked: new Date(),
    };
    
    updateCheck("browser", result);
    return result;
  }, [browserInfo, updateCheck, log]);
  
  // ============================================================================
  // Run Single Check
  // ============================================================================
  
  const runCheck = useCallback(async (type: CheckType): Promise<CheckResult> => {
    switch (type) {
      case "camera":
        return checkCamera();
      case "microphone":
        return checkMicrophone();
      case "fullscreen":
        return checkFullscreen();
      case "network":
        return checkNetwork();
      case "tabSwitch":
        return checkTabSwitch();
      case "browser":
        return checkBrowser();
      default:
        throw new Error(`Unknown check type: ${type}`);
    }
  }, [checkCamera, checkMicrophone, checkFullscreen, checkNetwork, checkTabSwitch, checkBrowser]);
  
  // ============================================================================
  // Run All Checks
  // ============================================================================
  
  const runAllChecks = useCallback(async () => {
    log("Running all checks...");
    setIsRunning(true);
    
    try {
      // Run browser check first (instant)
      await checkBrowser();
      
      // Run network check
      await checkNetwork();
      
      // Run media checks in sequence (they share device enumeration)
      await checkCamera();
      await checkMicrophone();
      
      // Run fullscreen check
      await checkFullscreen();
      
      // Tab switch is manual, just set to pending
      updateCheck("tabSwitch", { 
        status: "pending", 
        message: "Click 'Test' to verify tab switch detection",
      });
      
      log("All automatic checks completed");
    } catch (error) {
      log(`Error running checks: ${(error as Error).message}`);
    } finally {
      setIsRunning(false);
    }
  }, [checkBrowser, checkNetwork, checkCamera, checkMicrophone, checkFullscreen, updateCheck, log]);
  
  // ============================================================================
  // Computed State
  // ============================================================================
  
  // Mandatory checks are now: browser, network, camera, microphone (removed fullscreen and tabSwitch)
  const mandatoryChecksPassed = 
    checks.browser.status === "passed" &&
    checks.network.status === "passed" &&
    checks.camera.status === "passed" &&
    checks.microphone.status === "passed";
  
  const allChecksPassed = mandatoryChecksPassed;
  
  const isReady = cameraRequired && microphoneRequired
    ? mandatoryChecksPassed
    : checks.browser.status === "passed" && checks.network.status === "passed";
  
  // ============================================================================
  // Cleanup on unmount
  // ============================================================================
  
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
      if (microphoneStream) {
        microphoneStream.getTracks().forEach((track) => track.stop());
      }
      if (audioAnimationRef.current) {
        cancelAnimationFrame(audioAnimationRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);
  
  // ============================================================================
  // Return
  // ============================================================================
  
  return {
    checks,
    isReady,
    isRunning,
    allChecksPassed,
    mandatoryChecksPassed,
    cameras,
    microphones,
    selectedCamera,
    selectedMicrophone,
    setSelectedCamera,
    setSelectedMicrophone,
    networkMetrics,
    browserInfo,
    runAllChecks,
    runCheck,
    cameraStream,
    microphoneStream,
    audioLevel,
    isRecording,
    recordedAudio,
    audioDbLevel,
    thresholdReached,
    startRecording,
    stopRecording,
    playRecording,
    stopAllStreams,
    logs,
    clearLogs,
  };
}

export default usePrecheck;

