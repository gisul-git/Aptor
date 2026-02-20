import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { usePrecheckExtensions } from "@/hooks/usePrecheckExtensions";
import { KNOWN_EXTENSIONS } from "@/lib/extensionDatabase";
import {
  EXTENSION_DETECTION_CONFIG,
  formatMessage,
} from "@/config/precheckConfig";
import USBDeviceCheck from "@/components/precheck/USBDeviceCheck";
import { getGateContext } from "@/lib/gateContext";
import { modelService } from "@/universal-proctoring/services/ModelService";

interface PrecheckStep {
  id: string;
  title: string;
  status: "pending" | "running" | "passed" | "failed";
  message: string;
}

interface NetworkMetrics {
  ping: number;
  packetLoss: number;
  uploadSpeed: number;
  downloadSpeed: number;
}

interface BrowserInfo {
  name: string;
  version: number;
  isSupported: boolean;
  hasMediaDevices: boolean;
  hasScreenCapture: boolean;
  hasWebRTC: boolean;
}

// Microphone Check Configuration - Industry Standard
const MIC_CHECK_CONFIG = {
  THRESHOLD_DB: -40, // Industry standard (Zoom, Teams, Meet)
  REQUIRED_SAMPLES: 1, // Only 1 sample needed to pass (just verify mic works)
  DURATION_MS: 3000, // 3 seconds
  SAMPLE_INTERVAL_MS: 100, // Sample every 100ms
  PHRASE: "I confirm my microphone is working properly",
};

export default function PrecheckPage() {
  const router = useRouter();
  const { assessmentId, token } = router.query;

  const [currentStep, setCurrentStep] = useState(0);
  const [steps, setSteps] = useState<PrecheckStep[]>([
    {
      id: "browser",
      title: "Browser Compatibility",
      status: "pending",
      message: "",
    },
    {
      id: "network",
      title: "Network Stability",
      status: "pending",
      message: "",
    },
    { id: "camera", title: "Camera Check", status: "pending", message: "" },
    {
      id: "microphone",
      title: "Microphone Check",
      status: "pending",
      message: "",
    },
  ]);

  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [networkMetrics, setNetworkMetrics] = useState<NetworkMetrics | null>(
    null,
  );
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [microphoneStream, setMicrophoneStream] = useState<MediaStream | null>(
    null,
  );
  const [faceCount, setFaceCount] = useState<number>(0);
  const [audioLevel, setAudioLevel] = useState<number>(-Infinity);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] =
    useState<string>("");
  const [audioDataArray, setAudioDataArray] = useState<Uint8Array | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [samplesAboveThreshold, setSamplesAboveThreshold] = useState(0);
  const [totalSamples, setTotalSamples] = useState(0);
  const [micTestStarted, setMicTestStarted] = useState(false);
  const hasNavigatedRef = useRef(false); // Prevent multiple navigations

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const faceDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Extension detection
  const {
    isScanning: isExtensionScanning,
    scanResult: extensionScanResult,
    scan: scanExtensions,
    requestPermission,
  } = usePrecheckExtensions();

  // Load candidate info
  useEffect(() => {
    const storedEmail = sessionStorage.getItem("candidateEmail");
    const storedName = sessionStorage.getItem("candidateName");

    setEmail(storedEmail);
    setName(storedName);

    if (!storedEmail || !storedName) {
      if (assessmentId && token) {
        const ctx = getGateContext(assessmentId as string);
        router.replace(ctx?.entryUrl || `/assessment/${assessmentId}/${token}`);
      }
      return;
    }

    setIsLoading(false);
  }, [assessmentId, token, router]);

  // CRITICAL: Pre-load AI models in background during precheck
  // This ensures models are ready by identity verification phase (no delay)
  // Models will be cached in ModelService singleton and reused throughout the flow
  useEffect(() => {
    // Only load if candidate info is available
    if (!email || !name) {
      return; // Wait for candidate info to be set from first useEffect
    }

    // Check if models are already loaded
    if (modelService.areAllModelsLoaded()) {
      console.log(
        "[Precheck] ✅ AI models already loaded - ready for identity verification",
      );
      return;
    }

    // Load models in background (non-blocking)
    console.log("[Precheck] 🚀 Pre-loading AI models in background (BlazeFace + FaceMesh + face-api)...");
    modelService.loadAllModels()
      .then(({ blazeface, faceMesh, faceApi }) => {
        const loadedModels = [];
        if (blazeface) loadedModels.push("BlazeFace");
        if (faceMesh) loadedModels.push("FaceMesh");
        if (faceApi) loadedModels.push("face-api");
        
        if (loadedModels.length > 0) {
          console.log(`[Precheck] ✅ AI models pre-loaded successfully (${loadedModels.join(", ")}) - ready for identity verification and assessment`);
        } else {
          console.warn(
            "[Precheck] ⚠️ Some models failed to pre-load, will load on-demand",
          );
        }
      })
      .catch((error) => {
        console.error("[Precheck] Error pre-loading models:", error);
        // Non-critical - models will load on-demand if needed
      });
  }, [email, name]); // Re-run when email/name become available

  // Step 1: Browser Compatibility Check
  const checkBrowser = useCallback((): boolean => {
    const userAgent = navigator.userAgent;
    let browserName = "";
    let version = 0;

    // Detect Chrome
    if (userAgent.includes("Chrome") && !userAgent.includes("Edg")) {
      browserName = "Chrome";
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? parseInt(match[1]) : 0;
    }
    // Detect Edge
    else if (userAgent.includes("Edg")) {
      browserName = "Edge";
      const match = userAgent.match(/Edg\/(\d+)/);
      version = match ? parseInt(match[1]) : 0;
    }

    const isSupported =
      (browserName === "Chrome" || browserName === "Edge") && version >= 110;
    const hasMediaDevices = !!navigator.mediaDevices;
    const hasScreenCapture = !!navigator.mediaDevices?.getDisplayMedia;
    const hasWebRTC = !!window.RTCPeerConnection;

    const info: BrowserInfo = {
      name: browserName,
      version,
      isSupported,
      hasMediaDevices,
      hasScreenCapture,
      hasWebRTC,
    };

    setBrowserInfo(info);

    const passed =
      isSupported && hasMediaDevices && hasScreenCapture && hasWebRTC;

    setSteps((prev) =>
      prev.map((step, idx) =>
        idx === 0
          ? {
              ...step,
              status: passed ? "passed" : "failed",
              message: passed
                ? "Your browser is compatible"
                : "Please use Chrome/Edge latest version (110+)",
            }
          : step,
      ),
    );

    return passed;
  }, []);

  // Step 2: Network Check
  const checkNetwork = useCallback(async (): Promise<boolean> => {
    setSteps((prev) =>
      prev.map((step, idx) =>
        idx === 1
          ? { ...step, status: "running", message: "Warming up connection..." }
          : step,
      ),
    );

    const runNetworkTest = async (
      attempt: number,
    ): Promise<{
      ping: number;
      downloadSpeed: number;
      uploadSpeed: number;
    } | null> => {
      try {
        // Warm-up request to establish connection (reduces cold start overhead)
        if (attempt === 1) {
          try {
            await fetch("https://www.google.com/favicon.ico", { 
              cache: "no-store",
              method: "HEAD",
              mode: "no-cors",
            });
            // Small delay to let connection stabilize
            await new Promise((resolve) => setTimeout(resolve, 300));
          } catch (e) {
            // Warm-up failure is okay, continue with test
          }
        }
        
        // Run multiple ping tests using external endpoint and take the best (lowest) result
        setSteps(prev => prev.map((step, idx) => 
          idx === 1 ? { ...step, status: "running", message: attempt > 1 ? "Retrying network test..." : "Testing ping..." } : step
        ));
        
        const pingTests: number[] = [];
        for (let i = 0; i < 3; i++) {
          try {
            const pingStart = Date.now();
            await fetch("https://www.google.com/favicon.ico", { 
              cache: "no-store",
              method: "HEAD",
              mode: "no-cors",
            });
            const ping = Date.now() - pingStart;
            pingTests.push(ping);
            // Small delay between tests
            if (i < 2) await new Promise((resolve) => setTimeout(resolve, 100));
          } catch (e) {
            // If one test fails, continue with others
          }
        }

        if (pingTests.length === 0) {
          return null; // All ping tests failed
        }

        // Use the best (lowest) ping from multiple tests
        const ping = Math.min(...pingTests);
        
        // Speed test using external CDN (measures actual internet download speed)
        setSteps(prev => prev.map((step, idx) => 
          idx === 1 ? { ...step, status: "running", message: "Testing download speed..." } : step
        ));
        
        const speedTests: number[] = [];
        for (let i = 0; i < 2; i++) {
          try {
            const speedTestStart = Date.now();
            // Use a public CDN file for speed test (~100KB)
            const response = await fetch("https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js", {
              cache: "no-store",
            });
            const blob = await response.blob();
            const speedTestTime = (Date.now() - speedTestStart) / 1000; // seconds
            const downloadSize = blob.size / (1024 * 1024); // MB
            const downloadSpeed = Math.round((downloadSize / speedTestTime) * 8 * 10) / 10; // Mbps
            speedTests.push(downloadSpeed);
            // Small delay between tests
            if (i < 1) await new Promise((resolve) => setTimeout(resolve, 200));
          } catch (e) {
            // If download test fails, estimate based on latency
            const estimatedSpeed = ping < 100 ? 10 : ping < 300 ? 5 : 2;
            speedTests.push(estimatedSpeed);
          }
        }

        if (speedTests.length === 0) {
          return null; // All speed tests failed
        }

        // Average the speed tests for more accurate result
        const downloadSpeed =
          speedTests.reduce((a, b) => a + b, 0) / speedTests.length;

        // Estimate upload (simplified)
        const uploadSpeed = downloadSpeed * 0.5; // Conservative estimate

        return { ping, downloadSpeed, uploadSpeed };
      } catch (error) {
        return null;
      }
    };

    // Try the test up to 2 times
    let result = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      result = await runNetworkTest(attempt);
      if (result) break; // Success, exit retry loop

      // If first attempt failed, wait a bit before retry
      if (attempt === 1) {
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 1
              ? {
                  ...step,
                  status: "running",
                  message: "First test had issues, retrying...",
                }
              : step,
          ),
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    // If all attempts failed, return false
    if (!result) {
      setSteps((prev) =>
        prev.map((step, idx) =>
          idx === 1
            ? {
                ...step,
                status: "failed",
                message:
                  "Network test failed. Please check your connection and try again.",
              }
            : step,
        ),
      );
      return false;
    }

    const { ping, downloadSpeed, uploadSpeed } = result;

    const metrics: NetworkMetrics = {
      ping,
      packetLoss: 0, // Would need WebRTC for accurate packet loss
      uploadSpeed,
      downloadSpeed,
    };

    setNetworkMetrics(metrics);

    // More lenient thresholds - allow fair connections to proceed
    const passed = ping < 300 && downloadSpeed >= 2 && uploadSpeed >= 1;
    const fair = ping < 1000 && downloadSpeed >= 0.5 && uploadSpeed >= 0.25; // More lenient fair threshold

    setSteps((prev) =>
      prev.map((step, idx) =>
        idx === 1
          ? {
              ...step,
              status: passed ? "passed" : fair ? "passed" : "failed",
              message: passed
                ? "Network connection is good"
                : fair
                  ? "Network connection is fair. You can proceed."
                  : "Network connection is poor. Please improve your connection.",
            }
          : step,
      ),
    );

    return passed || fair; // Allow fair connections to proceed
  }, []);

  // Improved face detection using MediaPipe Face Detection API
  const detectFaces = useCallback(async (): Promise<number> => {
    if (!videoRef.current || !canvasRef.current) return 0;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== 4) return 0;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    try {
      // Try to use MediaPipe Face Detection API if available
      if (typeof (window as any).FaceDetector !== "undefined") {
        const faceDetector = new (window as any).FaceDetector({
          fastMode: true,
          maxDetections: 2,
        });

        const faces = await faceDetector.detect(canvas);
        return faces.length;
      }

      // Fallback: Improved skin tone detection with better heuristics
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // More lenient skin tone detection with multiple color ranges
      let skinPixels = 0;
      let centerRegionPixels = 0;

      // Focus on center region (where face is likely to be)
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const centerRadius = Math.min(canvas.width, canvas.height) * 0.3;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const pixelIndex = i / 4;
        const x = pixelIndex % canvas.width;
        const y = Math.floor(pixelIndex / canvas.width);

        // Multiple skin tone ranges (more inclusive)
        const isSkinTone =
          // Light skin tones
          ((r > 95 &&
            g > 40 &&
            b > 20 &&
            r > g &&
            r > b &&
            Math.abs(r - g) > 15) ||
            // Medium skin tones
            (r > 120 && g > 80 && b > 50 && r > g && r > b) ||
            // Darker skin tones
            (r > 60 &&
              g > 40 &&
              b > 30 &&
              r > g &&
              r > b &&
              Math.max(r, g, b) - Math.min(r, g, b) > 10)) &&
          Math.max(r, g, b) - Math.min(r, g, b) > 10;

        if (isSkinTone) {
          skinPixels++;

          // Check if in center region
          const distFromCenter = Math.sqrt(
            Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2),
          );
          if (distFromCenter < centerRadius) {
            centerRegionPixels++;
          }
        }
      }

      // More lenient detection: if we have skin pixels in center region, assume face is present
      const skinRatio = skinPixels / (canvas.width * canvas.height);
      const centerSkinRatio =
        centerRegionPixels / (Math.PI * centerRadius * centerRadius);

      // If center region has significant skin pixels, assume 1 face
      if (centerSkinRatio > 0.15 || skinRatio > 0.08) {
        return 1;
      }

      return 0;
    } catch (error) {
      console.error("Face detection error:", error);
      // If detection fails, assume camera is working and allow manual verification
      // Return 1 to allow progression (user can verify visually)
      return 1;
    }
  }, []);

  // Step 3: Camera Check
  const checkCamera = useCallback(async (): Promise<boolean> => {
    setSteps((prev) =>
      prev.map((step, idx) =>
        idx === 2
          ? { ...step, status: "running", message: "Accessing camera..." }
          : step,
      ),
    );

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, min: 15 },
        },
      });

      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Wait for video to be ready
      await new Promise((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = resolve;
        } else {
          setTimeout(resolve, 1000);
        }
      });

      // Start face detection loop
      let detectionCount = 0;
      let successfulDetections = 0;
      const maxDetections = 15; // Check for 3 seconds (15 * 200ms)

      const detectLoop = async () => {
        if (detectionCount >= maxDetections) {
          // Final check
          const finalCount = await detectFaces();
          setFaceCount(finalCount);

          const passed =
            (finalCount === 1 || successfulDetections >= 3) && stream.active;

          setSteps((prev) =>
            prev.map((step, idx) =>
              idx === 2
                ? {
                    ...step,
                    status: passed ? "passed" : "failed",
                    message: passed
                      ? "Camera check passed"
                      : finalCount === 0
                        ? "No face detected. Please ensure your face is visible and well-lit. Click 'Retry' to try again."
                        : finalCount > 1
                          ? "Multiple faces detected. Please ensure only you are in frame."
                          : "Camera check failed. Click 'Retry' to try again.",
                  }
                : step,
            ),
          );

          if (passed && canvasRef.current && !capturedPhoto) {
            const photo = canvasRef.current.toDataURL("image/jpeg", 0.8);
            setCapturedPhoto(photo);

            // ✅ PHASE 1: Store camera stream globally (NEVER stop tracks)
            if (typeof window !== "undefined" && stream.active) {
              (window as any).__cameraStream = stream;
              console.log(
                "[Precheck] ✅ Camera stream stored in window.__cameraStream",
              );
            }
          }

          return;
        }

        const count = await detectFaces();
        setFaceCount(count);

        if (count === 1) {
          successfulDetections++;
          // Capture photo when exactly one face detected
          if (canvasRef.current && !capturedPhoto) {
            const photo = canvasRef.current.toDataURL("image/jpeg", 0.8);
            setCapturedPhoto(photo);
          }
        }

        detectionCount++;
        faceDetectionIntervalRef.current = setTimeout(detectLoop, 200);
      };

      detectLoop();

      // Wait for detection to complete (max 3 seconds)
      await new Promise((resolve) => setTimeout(resolve, 3500));

      // Final status check
      const finalFaceCount = faceCount;
      const passed =
        (finalFaceCount === 1 || successfulDetections >= 3) && stream.active;

      if (steps[2].status === "running") {
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 2
              ? {
                  ...step,
                  status: passed ? "passed" : "failed",
                  message: passed
                    ? "Camera check passed"
                    : finalFaceCount === 0
                      ? "No face detected. Please ensure your face is visible and well-lit. Click 'Retry' to try again."
                      : finalFaceCount > 1
                        ? "Multiple faces detected. Please ensure only you are in frame."
                        : "Camera check failed. Click 'Retry' to try again.",
                }
              : step,
          ),
        );
      }

      return passed;
    } catch (error: any) {
      setSteps((prev) =>
        prev.map((step, idx) =>
          idx === 2
            ? {
                ...step,
                status: "failed",
                message:
                  error.name === "NotAllowedError"
                    ? "Camera permission denied. Please allow camera access."
                    : "Camera check failed. Please check your camera.",
              }
            : step,
        ),
      );
      return false;
    }
  }, [detectFaces, faceCount, capturedPhoto]);

  // Fetch available audio input devices
  const fetchAudioDevices = useCallback(async () => {
    try {
      // Request permission first to get device list
      await navigator.mediaDevices.getUserMedia({ audio: true });

      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(
        (device) => device.kind === "audioinput",
      );

      setAudioDevices(audioInputs);

      // Set default to first device or default device
      if (audioInputs.length > 0 && !selectedAudioDeviceId) {
        const defaultDevice =
          audioInputs.find((d) => d.deviceId === "default") || audioInputs[0];
        setSelectedAudioDeviceId(defaultDevice.deviceId);
      }
    } catch (error) {
      console.error("Error fetching audio devices:", error);
    }
  }, [selectedAudioDeviceId]);

  // Step 4: Microphone Check - Industry Standard Threshold-Based
  const checkMicrophone = useCallback(async (): Promise<boolean> => {
    // Reset state
    setSamplesAboveThreshold(0);
    setTotalSamples(0);
    setMicTestStarted(true);
    setIsListening(true);

    setSteps((prev) =>
      prev.map((step, idx) =>
        idx === 3
          ? { ...step, status: "running", message: "Accessing microphone..." }
          : step,
      ),
    );

    try {
      // Detect if selected device is Bluetooth BEFORE creating constraints
      // This is critical: Bluetooth devices need REQUIRED constraints, system mics can use OPTIONAL
      const selectedDevice = audioDevices.find(
        (d) => d.deviceId === selectedAudioDeviceId,
      );
      const isBluetoothDevice =
        selectedDevice?.label.toLowerCase().includes("bluetooth") ||
        selectedDevice?.label.toLowerCase().includes("headset") ||
        false;

      // IMPORTANT: Use different constraints for Bluetooth vs system microphones
      // Bluetooth NEEDS required constraints, system mics can be flexible
      const audioConstraints: MediaTrackConstraints = {
        // For Bluetooth: REQUIRED (true), for system mics: OPTIONAL ({ ideal: true })
        echoCancellation: isBluetoothDevice ? true : { ideal: true },
        noiseSuppression: false, // Keep disabled for accurate detection
        // For Bluetooth: REQUIRED (true), for system mics: OPTIONAL ({ ideal: true })
        autoGainControl: isBluetoothDevice ? true : { ideal: true },
        // For Bluetooth: REQUIRED 16kHz, for system mics: OPTIONAL ({ ideal: 16000 })
        sampleRate: isBluetoothDevice ? 16000 : { ideal: 16000 },
      };

      // For Bluetooth: EXACT device match (required), for system mics: IDEAL (allows fallback)
      if (selectedAudioDeviceId && selectedAudioDeviceId !== "default") {
        audioConstraints.deviceId = isBluetoothDevice
          ? { exact: selectedAudioDeviceId } // Bluetooth: exact match required
          : { ideal: selectedAudioDeviceId }; // System mic: allows fallback
      }
      // When "default" is selected or empty, don't set deviceId at all - let browser choose default

      console.log("[Microphone] Requesting stream with constraints:", {
        selectedDeviceId: selectedAudioDeviceId,
        selectedDeviceLabel: selectedDevice?.label || "unknown",
        isBluetoothDevice: isBluetoothDevice,
        isDefault:
          selectedAudioDeviceId === "default" || !selectedAudioDeviceId,
        constraints: audioConstraints,
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      });

      setMicrophoneStream(stream);

      // Verify stream is active
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0 || !audioTracks[0].enabled) {
        throw new Error("No audio track available or track is disabled");
      }

      const trackSettings = audioTracks[0].getSettings();
      const trackCapabilities = audioTracks[0].getCapabilities();
      const actualDeviceId = trackSettings.deviceId || "unknown";

      console.log("[Microphone] Stream obtained successfully:", {
        requestedDeviceId: selectedAudioDeviceId,
        actualDeviceId: actualDeviceId,
        active: stream.active,
        label: audioTracks[0].label,
        enabled: audioTracks[0].enabled,
        readyState: audioTracks[0].readyState,
        settings: trackSettings,
        capabilities: trackCapabilities,
        sampleRate: trackSettings.sampleRate || "unknown",
      });

      // Check if this is a Bluetooth device
      const isBluetooth =
        audioTracks[0].label.toLowerCase().includes("bluetooth") ||
        audioTracks[0].label.toLowerCase().includes("headset");

      if (isBluetooth) {
        console.warn(
          "[Microphone] ⚠️ Bluetooth device detected. Web Audio API has known limitations with Bluetooth headsets.",
        );
        console.warn("[Microphone] If audio data is not detected, try:");
        console.warn("  1. Ensure headset is in HFP/HSP mode (not A2DP)");
        console.warn(
          "  2. Set Bluetooth as 'Default Communication Device' in Windows",
        );
        console.warn("  3. Try using built-in microphone instead");
      }

      // Setup audio analysis with appropriate sample rate
      // Use cross-browser AudioContext and resume it
      const AudioContextClass =
        (window as any).AudioContext || (window as any).webkitAudioContext;

      // Use stream's actual sample rate for system mics, 16kHz for Bluetooth
      // This prevents resampling issues that cause "no audio detected"
      const streamSampleRate = trackSettings.sampleRate; // Store for use in workaround section
      const audioContextSampleRate = isBluetooth
        ? 16000 // Bluetooth: force 16kHz (compatible rate)
        : streamSampleRate || undefined; // System mic: use stream's native rate (or browser default)

      const audioContext = new AudioContextClass(
        audioContextSampleRate ? { sampleRate: audioContextSampleRate } : {},
      );
      audioContextRef.current = audioContext;

      console.log("[Microphone] AudioContext created:", {
        requestedSampleRate: audioContextSampleRate,
        actualSampleRate: audioContext.sampleRate,
        streamSampleRate: streamSampleRate,
        isBluetooth: isBluetooth,
        state: audioContext.state,
      });

      console.log(
        "[Microphone] AudioContext created with sample rate:",
        audioContext.sampleRate,
        "State:",
        audioContext.state,
      );

      // VERY IMPORTANT: resume if suspended (required for Chrome/Edge)
      if (audioContext.state === "suspended") {
        await audioContext.resume();
        console.log("[Microphone] AudioContext resumed from suspended state");
      }

      const source = audioContext.createMediaStreamSource(stream);

      // Add gain node to boost quiet signals (helps with Bluetooth)
      const gainNode = audioContext.createGain();
      gainNode.gain.value = 3.0; // Boost by 3x (adjust if needed)

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // Larger FFT for better sensitivity
      analyser.smoothingTimeConstant = 0.3; // Less smoothing for more sensitivity

      // Connect: source → gain → analyser
      // NOTE: For Bluetooth, connecting to destination can sometimes cause issues
      // The analyser works fine without destination connection for analysis purposes
      source.connect(gainNode);
      gainNode.connect(analyser);
      // Try without destination first - if still no data, we'll try with destination
      // analyser.connect(audioContext.destination); // Commented out for Bluetooth compatibility

      console.log(
        "[Microphone] Audio chain: source → gain (3.0x) → analyser (no destination for Bluetooth compatibility)",
      );
      console.log("[Microphone] Track settings:", trackSettings);
      console.log(
        "[Microphone] Track capabilities:",
        audioTracks[0].getCapabilities(),
      );

      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const timeDataArray = new Uint8Array(analyser.frequencyBinCount);

      // Wait for stream to stabilize - Bluetooth needs longer
      // Also try to "prime" the analyser by reading data a few times
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Increased for Bluetooth initialization

      // Prime the analyser by reading data a few times (helps with Bluetooth)
      for (let i = 0; i < 5; i++) {
        analyser.getByteTimeDomainData(timeDataArray);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      console.log("[Microphone] Analyser primed with 5 initial reads");

      // Verify we're getting data with multiple checks
      // BLUETOOTH FIX: Check both time and frequency domain with better variance detection
      let dataCheckAttempts = 0;
      let hasAudioData = false;
      const MAX_ATTEMPTS = 10; // Increased from 5 to 10
      const RETRY_DELAY_MS = 300; // 300ms between attempts

      while (dataCheckAttempts < MAX_ATTEMPTS && !hasAudioData) {
        // Try BOTH time domain AND frequency domain
        analyser.getByteTimeDomainData(timeDataArray);
        analyser.getByteFrequencyData(dataArray);

        // Better variance detection: Check for actual min/max variance
        let min = 255,
          max = 0;
        for (let i = 0; i < timeDataArray.length; i++) {
          const value = timeDataArray[i];
          if (value < min) min = value;
          if (value > max) max = value;
        }
        let variance = max - min;

        const timeSum = timeDataArray.reduce(
          (a, b) => a + Math.abs(b - 128),
          0,
        );
        const freqSum = dataArray.reduce((a, b) => a + b, 0);

        // If still no variance after 3 attempts, try connecting to destination
        if (dataCheckAttempts === 3 && variance === 0) {
          console.log(
            "[Microphone] Attempting to connect analyser to destination (Bluetooth workaround)",
          );
          try {
            analyser.connect(audioContext.destination);
            console.log(
              "[Microphone] Connected to destination, waiting 500ms...",
            );
            await new Promise((resolve) => setTimeout(resolve, 500));
            // Re-read data after connecting
            analyser.getByteTimeDomainData(timeDataArray);
            analyser.getByteFrequencyData(dataArray);
            // Recalculate variance
            min = 255;
            max = 0;
            for (let i = 0; i < timeDataArray.length; i++) {
              const value = timeDataArray[i];
              if (value < min) min = value;
              if (value > max) max = value;
            }
            const newVariance = max - min;
            console.log(
              "[Microphone] After destination connection - variance:",
              newVariance,
            );
            if (newVariance > 0) {
              variance = newVariance; // Update variance for the check below
            }
          } catch (e) {
            console.warn("[Microphone] Could not connect to destination:", e);
          }
        }

        // If still no variance after 5 attempts, try recreating the audio context
        // Apply to ALL devices (not just Bluetooth) - system mics also need this workaround
        if (dataCheckAttempts === 5 && variance === 0) {
          console.log(
            "[Microphone] Attempting to recreate AudioContext (workaround for all devices)",
          );
          try {
            // Close old context
            if (
              audioContextRef.current &&
              audioContextRef.current.state !== "closed"
            ) {
              audioContextRef.current.close();
            }

            // Create new context with appropriate sample rate (match stream for system mics, 16kHz for Bluetooth)
            const newAudioContextSampleRate = isBluetooth
              ? 16000 // Bluetooth: force 16kHz
              : streamSampleRate || undefined; // System mic: use stream's native rate

            const newAudioContext = new AudioContextClass(
              newAudioContextSampleRate
                ? { sampleRate: newAudioContextSampleRate }
                : {},
            );
            audioContextRef.current = newAudioContext;

            if (newAudioContext.state === "suspended") {
              await newAudioContext.resume();
            }

            // Recreate the chain
            const newSource = newAudioContext.createMediaStreamSource(stream);
            const newGainNode = newAudioContext.createGain();
            newGainNode.gain.value = 3.0;
            const newAnalyser = newAudioContext.createAnalyser();
            newAnalyser.fftSize = 2048;
            newAnalyser.smoothingTimeConstant = 0.3;

            newSource.connect(newGainNode);
            newGainNode.connect(newAnalyser);
            analyserRef.current = newAnalyser;

            console.log(
              "[Microphone] Recreated AudioContext, waiting 500ms...",
            );
            await new Promise((resolve) => setTimeout(resolve, 500));

            // Re-read data
            newAnalyser.getByteTimeDomainData(timeDataArray);
            newAnalyser.getByteFrequencyData(dataArray);

            // Recalculate variance
            min = 255;
            max = 0;
            for (let i = 0; i < timeDataArray.length; i++) {
              const value = timeDataArray[i];
              if (value < min) min = value;
              if (value > max) max = value;
            }
            const newVariance = max - min;
            console.log(
              "[Microphone] After AudioContext recreation - variance:",
              newVariance,
            );
            if (newVariance > 0) {
              variance = newVariance; // Update variance for the check below
            }
          } catch (e) {
            console.warn("[Microphone] Could not recreate AudioContext:", e);
          }
        }

        // Enhanced logging with first values and context state
        console.log(
          `[Mic DataCheck] Attempt ${dataCheckAttempts + 1}/${MAX_ATTEMPTS}:`,
          {
            variance: variance, // Key metric: should be > 0 (even silence shows 1-5)
            min: min,
            max: max,
            timeDomainSum: timeSum,
            frequencySum: freqSum,
            timeDomainAvg: (timeSum / timeDataArray.length).toFixed(2),
            frequencyAvg: (freqSum / dataArray.length).toFixed(2),
            firstValues: Array.from(timeDataArray.slice(0, 10)),
            audioContextState: audioContextRef.current?.state,
            streamActive: stream.active,
            trackInfo: {
              label: audioTracks[0].label,
              enabled: audioTracks[0].enabled,
              readyState: audioTracks[0].readyState,
            },
          },
        );

        // Accept if variance > 0 (even silence should show 1-5 variance from noise floor)
        // OR if frequency domain shows activity
        if (variance > 0 || freqSum > 10) {
          hasAudioData = true;
          console.log(
            "[Microphone] ✅ Audio data detected (variance:",
            variance,
            variance > 0 ? "time domain" : "frequency domain",
            "), proceeding with test",
          );
        } else {
          console.warn(
            `[Microphone] ⚠️ No variance detected (variance: ${variance}) on attempt ${dataCheckAttempts + 1}, retrying...`,
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }

        dataCheckAttempts++;
      }

      if (!hasAudioData) {
        console.error(
          `[Microphone] ❌ Failed to get audio data after ${MAX_ATTEMPTS} attempts`,
        );
        console.error("[Microphone] Troubleshooting tips:");
        console.error(
          "  1. Check system microphone settings - ensure mic is not muted",
        );
        console.error(
          "  2. Try selecting a different microphone from the dropdown",
        );
        console.error(
          "  3. Close other apps using microphone (Zoom, Teams, Discord, Skype)",
        );
        console.error(
          "  4. For Bluetooth: Ensure headset is in HFP/HSP mode (not A2DP)",
        );
        console.error(
          "  5. In Windows: Set Bluetooth as 'Default Communication Device'",
        );
        console.error(
          "  6. Try disconnecting and reconnecting Bluetooth headset",
        );
        console.error(
          "  7. Try using built-in microphone to verify code works",
        );
        throw new Error(
          `No audio data after ${MAX_ATTEMPTS} attempts. Please check: 1) Microphone is not muted, 2) Correct mic selected, 3) Mic not in use by another app, 4) Bluetooth settings (HFP/HSP mode), 5) Try a different device`,
        );
      }

      // Threshold-based detection
      // IMPORTANT: Start timing AFTER audio data is confirmed (after any AudioContext recreation)
      let samplesAboveThresholdCount = 0;
      let totalSamplesCount = 0;
      let maxDbReached = -Infinity;
      const startTime = Date.now(); // Start time is set after audio data is confirmed
      let sampleIntervalId: number | null = null;
      let visualizationFrameId: number | null = null;

      console.log(
        "[Microphone] Starting audio sampling. Duration:",
        MIC_CHECK_CONFIG.DURATION_MS,
        "ms, Interval:",
        MIC_CHECK_CONFIG.SAMPLE_INTERVAL_MS,
        "ms",
      );

      // Continuous visualization update (runs at 60fps for smooth UI)
      const updateVisualization = () => {
        if (!analyserRef.current) return;

        // Get time domain data for visualization
        analyserRef.current.getByteTimeDomainData(timeDataArray);
        setAudioDataArray(new Uint8Array(timeDataArray));

        // Get frequency data for visualization
        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate current audio level for display (same clean RMS logic as sampling)
        let sum = 0;
        for (let i = 0; i < timeDataArray.length; i++) {
          const normalized = (timeDataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }

        const rms = Math.sqrt(sum / timeDataArray.length);
        let dbLevel = -100;

        if (rms > 0.00001) {
          dbLevel = 20 * Math.log10(rms);
        }

        setAudioLevel(dbLevel);

        // Continue visualization
        const elapsed = Date.now() - startTime;
        if (elapsed < MIC_CHECK_CONFIG.DURATION_MS) {
          visualizationFrameId = requestAnimationFrame(updateVisualization);
        }
      };

      // Start visualization
      updateVisualization();

      // Sample audio every 100ms for threshold checking
      const sampleAudio = () => {
        if (!analyserRef.current) return;

        // Get time domain data (raw audio samples)
        analyserRef.current.getByteTimeDomainData(timeDataArray);

        // Calculate RMS (Root Mean Square) - Industry standard for audio level
        let sum = 0;
        for (let i = 0; i < timeDataArray.length; i++) {
          const normalized = (timeDataArray[i] - 128) / 128;
          sum += normalized * normalized;
        }

        const rms = Math.sqrt(sum / timeDataArray.length);

        // Convert RMS to dB: dB = 20 * log10(rms)
        // For voice: typical RMS ranges from 0.01 (quiet) to 0.3 (loud)
        // RMS 0.01 = -40 dB, RMS 0.1 = -20 dB, RMS 0.3 = -10 dB
        let dbLevel = -100; // Default to silent

        if (rms > 0.00001) {
          dbLevel = 20 * Math.log10(rms);
        }

        // Track max dB reached
        if (dbLevel > maxDbReached) {
          maxDbReached = dbLevel;
        }

        // Check if above threshold (STRICT: -40 dB minimum)
        const isAboveThreshold = dbLevel >= MIC_CHECK_CONFIG.THRESHOLD_DB;

        if (isAboveThreshold) {
          samplesAboveThresholdCount++;
        }

        totalSamplesCount++;

        // Update state for UI
        setSamplesAboveThreshold(samplesAboveThresholdCount);
        setTotalSamples(totalSamplesCount);

        // Calculate progress percentage
        const progressPercent = Math.min(
          100,
          (samplesAboveThresholdCount / MIC_CHECK_CONFIG.REQUIRED_SAMPLES) *
            100,
        );

        // Dynamic progress messages
        let progressMessage = "";
        if (totalSamplesCount <= 2 && samplesAboveThresholdCount === 0) {
          progressMessage = "🔊 Speak louder! We can't hear you clearly.";
        } else if (progressPercent < 30) {
          progressMessage = `📢 Keep reading: "${MIC_CHECK_CONFIG.PHRASE}"`;
        } else if (progressPercent < 70) {
          progressMessage = "👍 Good! Keep speaking clearly...";
        } else if (progressPercent < 100) {
          progressMessage = "✅ Almost there! Continue speaking...";
        } else {
          progressMessage = "✅ Perfect! Voice detected successfully.";
        }

        // Update step message
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === 3
              ? {
                  ...step,
                  status: "running",
                  message: `${progressMessage} (${samplesAboveThresholdCount}/${MIC_CHECK_CONFIG.REQUIRED_SAMPLES} samples)`,
                }
              : step,
          ),
        );

        // Debug logging (every 5 samples)
        if (totalSamplesCount % 5 === 0) {
          console.log(`[Mic Sample ${totalSamplesCount}]`, {
            rms: rms.toFixed(4),
            dbLevel: dbLevel.toFixed(2),
            threshold: MIC_CHECK_CONFIG.THRESHOLD_DB,
            aboveThreshold: isAboveThreshold,
            progress: `${samplesAboveThresholdCount}/${MIC_CHECK_CONFIG.REQUIRED_SAMPLES}`,
          });
        }

        // Continue sampling until duration is reached
        const elapsed = Date.now() - startTime;
        if (elapsed < MIC_CHECK_CONFIG.DURATION_MS) {
          sampleIntervalId = window.setTimeout(
            sampleAudio,
            MIC_CHECK_CONFIG.SAMPLE_INTERVAL_MS,
          ) as unknown as number;
        }
      };

      // Start sampling every 100ms
      sampleAudio();

      // Wait for full duration + a small buffer to ensure all samples are collected
      // Add 200ms buffer to account for timing variations
      const totalWaitTime = MIC_CHECK_CONFIG.DURATION_MS + 200;
      await new Promise((resolve) => setTimeout(resolve, totalWaitTime));

      console.log(
        "[Microphone] Sampling complete. Total samples collected:",
        totalSamplesCount,
        "Expected:",
        Math.floor(
          MIC_CHECK_CONFIG.DURATION_MS / MIC_CHECK_CONFIG.SAMPLE_INTERVAL_MS,
        ),
      );

      // Cleanup intervals
      if (sampleIntervalId) {
        clearTimeout(sampleIntervalId);
      }
      if (visualizationFrameId) {
        cancelAnimationFrame(visualizationFrameId);
      }

      // Final check
      const passed =
        samplesAboveThresholdCount >= MIC_CHECK_CONFIG.REQUIRED_SAMPLES;

      // Cleanup
      setIsListening(false);
      setMicTestStarted(false);
      if (sampleIntervalId) {
        clearTimeout(sampleIntervalId);
      }
      if (visualizationFrameId) {
        cancelAnimationFrame(visualizationFrameId);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Detailed logging
      const expectedSamples = Math.floor(
        MIC_CHECK_CONFIG.DURATION_MS / MIC_CHECK_CONFIG.SAMPLE_INTERVAL_MS,
      );
      console.log("[Microphone Check] Final Results:", {
        passed,
        samplesAboveThreshold: samplesAboveThresholdCount,
        requiredSamples: MIC_CHECK_CONFIG.REQUIRED_SAMPLES,
        totalSamples: totalSamplesCount,
        expectedSamples: expectedSamples,
        samplesCollected: `${totalSamplesCount}/${expectedSamples}`,
        maxDbReached: maxDbReached.toFixed(2),
        thresholdDb: MIC_CHECK_CONFIG.THRESHOLD_DB,
        successRate:
          totalSamplesCount > 0
            ? `${((samplesAboveThresholdCount / totalSamplesCount) * 100).toFixed(1)}%`
            : "0%",
        note:
          totalSamplesCount < expectedSamples
            ? "⚠️ Fewer samples than expected - test may have started late"
            : "✅ Sample count OK",
      });

      // Set final status
      let finalMessage = "";
      if (passed) {
        finalMessage = `✅ Microphone check passed! Voice detected clearly (${samplesAboveThresholdCount}/${MIC_CHECK_CONFIG.REQUIRED_SAMPLES} samples above ${MIC_CHECK_CONFIG.THRESHOLD_DB} dB)`;
      } else if (samplesAboveThresholdCount === 0) {
        finalMessage =
          "❌ No audio detected. Please check your microphone is connected and unmuted.";
      } else {
        finalMessage = `❌ Voice too quiet. Detected only ${samplesAboveThresholdCount}/${MIC_CHECK_CONFIG.REQUIRED_SAMPLES} samples above ${MIC_CHECK_CONFIG.THRESHOLD_DB} dB. Please speak louder.`;
      }

      setSteps((prev) =>
        prev.map((step, idx) =>
          idx === 3
            ? {
                ...step,
                status: passed ? "passed" : "failed",
                message: finalMessage,
              }
            : step,
        ),
      );

      return passed;
    } catch (error: any) {
      // Cleanup on error
      setIsListening(false);
      setMicTestStarted(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        try {
          audioContextRef.current.close();
        } catch (e) {
          // Ignore close errors
        }
      }

      // Better error messages based on error type
      let errorMessage =
        "Microphone check failed. Please check your microphone.";
      if (error.name === "NotAllowedError") {
        errorMessage =
          "Microphone permission denied. Please allow microphone access in your browser settings.";
      } else if (error.name === "NotFoundError") {
        errorMessage =
          "No microphone found. Please connect a microphone and try again.";
      } else if (error.name === "NotReadableError") {
        errorMessage =
          "Microphone is already in use by another application. Please close other apps (Zoom, Teams, Discord, etc.) and try again.";
      } else if (error.name === "OverconstrainedError") {
        errorMessage =
          "Microphone settings are not supported. Please try selecting a different microphone.";
      } else if (error.message && error.message.includes("No audio data")) {
        errorMessage = error.message; // Use the detailed message from our validation
      }

      console.error("[Microphone] Error:", error.name, error.message);

      setSteps((prev) =>
        prev.map((step, idx) =>
          idx === 3
            ? {
                ...step,
                status: "failed",
                message: errorMessage,
              }
            : step,
        ),
      );
      return false;
    }
  }, [selectedAudioDeviceId, audioDevices]);

  // Run current step check
  const runCurrentStep = useCallback(
    async (forceRetry = false) => {
      // Reset step status if retrying
      if (forceRetry) {
        setSteps((prev) =>
          prev.map((step, idx) =>
            idx === currentStep
              ? { ...step, status: "pending", message: "" }
              : step,
          ),
        );

        // Stop existing streams
        if (currentStep === 2 && cameraStream) {
          cameraStream.getTracks().forEach((track) => track.stop());
          setCameraStream(null);
          if (faceDetectionIntervalRef.current) {
            clearTimeout(faceDetectionIntervalRef.current);
          }
        }
        if (currentStep === 3 && microphoneStream) {
          microphoneStream.getTracks().forEach((track) => track.stop());
          setMicrophoneStream(null);
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          if (audioContextRef.current) {
            audioContextRef.current.close();
          }
        }

        // Reset state
        setFaceCount(0);
        setCapturedPhoto(null);
        setAudioLevel(-Infinity);
        setAudioDataArray(null);
        setIsListening(false);

        // Refresh audio devices on microphone retry
        if (currentStep === 3) {
          fetchAudioDevices();
        }
      }

      let passed = false;

      switch (currentStep) {
        case 0:
          passed = checkBrowser();
          break;
        case 1:
          passed = await checkNetwork();
          break;
        case 2:
          passed = await checkCamera();
          break;
        case 3:
          passed = await checkMicrophone();
          break;
      }

      if (passed) {
        // On browser step, wait for extension scan to complete before allowing progression
        if (currentStep === 0) {
          // Auto-trigger extension scan if not already scanning and no result
          if (!extensionScanResult && !isExtensionScanning) {
            setTimeout(() => {
              scanExtensions().catch((err) => {
                console.error("Auto-scan failed:", err);
              });
            }, 100);
            return; // Wait for scan to complete
          }

          // If extension scan hasn't completed yet, don't auto-advance
          if (!extensionScanResult && isExtensionScanning) {
            return; // Wait for extension scan to complete
          }

          // If extensions are detected, don't advance
          const hasExtensions = extensionScanResult?.hasExtensions ?? false;
          if (hasExtensions) {
            // Extensions detected - don't advance, user must remove them first
            return;
          }
        }

        // Don't auto-advance - user must click "Next" button manually
        // The Next button will be shown in the UI
      }
    },
    [
      currentStep,
      checkBrowser,
      checkNetwork,
      checkCamera,
      checkMicrophone,
      cameraStream,
      microphoneStream,
      fetchAudioDevices,
      extensionScanResult,
      isExtensionScanning,
    ],
  );

  // Fetch audio devices when microphone step becomes active
  useEffect(() => {
    if (currentStep === 3 && audioDevices.length === 0) {
      fetchAudioDevices();
    }
  }, [currentStep, audioDevices.length, fetchAudioDevices]);

  // Auto-run step when it becomes current
  // IMPORTANT: Skip auto-run for microphone step (3) - must be user-triggered
  useEffect(() => {
    if (isLoading) return;

    // Auto-run for steps 0,1,2 only. Microphone (3) must be user-triggered.
    if (steps[currentStep].status === "pending" && currentStep !== 3) {
      runCurrentStep();
    }
  }, [currentStep, isLoading, steps, runCurrentStep]);

  // Auto-scan extensions when browser check step is active
  useEffect(() => {
    if (
      currentStep === 0 &&
      !isLoading &&
      !extensionScanResult &&
      !isExtensionScanning
    ) {
      // Automatically scan for extensions when browser check step is shown
      // The scan function already has a 750ms delay built-in
      const timer = setTimeout(() => {
        scanExtensions().catch((err) => {
          console.error("Extension scan error:", err);
        });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [
    currentStep,
    isLoading,
    extensionScanResult,
    isExtensionScanning,
    scanExtensions,
  ]);

  // Update browser step status based on extension scan results
  useEffect(() => {
    // Only update if we're on browser step (step 0) and extension scan has completed
    if (currentStep === 0 && extensionScanResult && browserInfo) {
      const hasExtensions = extensionScanResult.hasExtensions;

      setSteps((prev) =>
        prev.map((step, idx) => {
          if (idx === 0) {
            // If extensions are detected, mark browser step as failed
            // This prevents auto-advance and shows the blocking message
            if (hasExtensions) {
              return {
                ...step,
                status: "failed",
                message:
                  "Browser extensions detected - Please remove all extensions to continue",
              };
            } else {
              // If no extensions and browser is compatible, mark as passed
              // This allows progression to next step
              if (browserInfo.isSupported) {
                return {
                  ...step,
                  status: "passed",
                  message:
                    "Your browser is compatible and no extensions detected",
                };
              }
            }
          }
          return step;
        }),
      );
    }
  }, [extensionScanResult, currentStep, browserInfo]);

  // Handle retry for current step
  const handleRetry = useCallback(() => {
    runCurrentStep(true);
  }, [runCurrentStep]);

  // Cleanup streams
  useEffect(() => {
    return () => {
      cameraStream?.getTracks().forEach((track) => track.stop());
      microphoneStream?.getTracks().forEach((track) => track.stop());
      if (faceDetectionIntervalRef.current) {
        clearTimeout(faceDetectionIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        try {
          audioContextRef.current.close();
        } catch (e) {
          // AudioContext might already be closed
          console.log("[Microphone] AudioContext already closed in cleanup");
        }
      }
      audioContextRef.current = null;
    };
  }, [cameraStream, microphoneStream]);

  // Handle completion
  const handleComplete = useCallback(async () => {
    // Prevent multiple navigation attempts
    if (hasNavigatedRef.current) {
      console.log(
        "[PRECHECK] ⚠️ Navigation already initiated, skipping duplicate call",
      );
      return;
    }

    const allPassed = steps.every((step) => step.status === "passed");

    // Note: Extension blocking is handled on browser step (step 0) only
    // If user reaches here, they've already passed the browser step without extensions
    if (!allPassed) return;

    // Mark navigation as initiated BEFORE any async operations
    hasNavigatedRef.current = true;

    // Store precheck completion
    try {
      if (assessmentId && token && email && name) {
        const precheckResults = {
          browser: steps[0].status === "passed",
          network: steps[1].status === "passed",
          camera: steps[2].status === "passed",
          microphone: steps[3].status === "passed",
        };

        const ctx = getGateContext(assessmentId as string);
        const isAIFlow = !ctx || ctx.flowType === "ai";
        // AI-only backend tracking (other flows just use sessionStorage gate flags)
        if (isAIFlow) {
          await axios.post("/api/assessment/precheck-complete", {
            assessmentId,
            token,
            email,
            name,
            precheckResults,
          });
        }

        sessionStorage.setItem(`precheckCompleted_${assessmentId}`, "true");
        sessionStorage.setItem("capturedPhoto", capturedPhoto || "");
      }
    } catch (error) {
      console.error("Error storing precheck completion:", error);
    }

    // Route to new instructions page
    // Use replace to avoid adding to history stack and prevent navigation conflicts
    if (router.isReady && assessmentId && token) {
      const targetUrl = `/assessment/${assessmentId}/${token}/instructions-new`;
      console.log("[PRECHECK] 🔄 Navigating to instructions-new", {
        targetUrl,
        assessmentId,
        token,
        routerIsReady: router.isReady,
        timestamp: new Date().toISOString(),
      });
      try {
        await router.replace(targetUrl);
        console.log("[PRECHECK] ✅ Navigation to instructions-new completed");
      } catch (error: any) {
        // Ignore navigation cancellation errors (expected when navigating quickly)
        if (error?.name === "AbortError" || error?.message?.includes("Abort")) {
          console.log("[PRECHECK] ⚠️ Navigation was cancelled (expected)", {
            errorName: error?.name,
            errorMessage: error?.message,
          });
          return;
        }
        console.error("[PRECHECK] ❌ Navigation error:", {
          error,
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        });
        // Reset navigation flag on error (except abort errors)
        hasNavigatedRef.current = false;
      }
    } else {
      console.log("[PRECHECK] ⚠️ Cannot navigate - conditions not met", {
        routerIsReady: router.isReady,
        hasAssessmentId: !!assessmentId,
        hasToken: !!token,
      });
      // Reset navigation flag if conditions not met
      hasNavigatedRef.current = false;
    }
  }, [steps, assessmentId, token, email, name, capturedPhoto, router]);

  const allStepsPassed = steps.every((step) => step.status === "passed");
  const hasExtensions = extensionScanResult?.hasExtensions ?? false;
  // Extension detection is informational only - no longer blocks progression
  const canProceedToNext = allStepsPassed;
  const currentStepData = steps[currentStep];

  // Auto-redirect to instructions page when all steps pass
  useEffect(() => {
    console.log("[Precheck] Checking redirect conditions:", {
      allStepsPassed,
      assessmentId,
      token,
      stepsStatus: steps.map((s) => ({ id: s.id, status: s.status })),
      hasNavigated: hasNavigatedRef.current,
    });

    // Prevent duplicate navigation attempts
    if (hasNavigatedRef.current) {
      console.log(
        "[Precheck] ⚠️ Navigation already initiated, skipping auto-redirect",
      );
      return;
    }

    if (allStepsPassed && assessmentId && token) {
      console.log(
        "[Precheck] ✅ All steps passed! Redirecting to instructions page in 1.5 seconds...",
      );
      // Small delay to show completion message
      const redirectTimer = setTimeout(() => {
        console.log("[Precheck] Executing redirect now...");
        handleComplete();
      }, 1500); // 1.5 second delay to show success message

      return () => {
        console.log("[Precheck] Clearing redirect timer");
        clearTimeout(redirectTimer);
      };
    } else {
      console.log("[Precheck] ⚠️ Not redirecting - conditions not met:", {
        allStepsPassed,
        hasAssessmentId: !!assessmentId,
        hasToken: !!token,
      });
    }
  }, [allStepsPassed, assessmentId, token, handleComplete, steps]);

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f7f3e8",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              border: "4px solid #e2e8f0",
              borderTopColor: "#6953a3",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 1rem",
            }}
          />
          <p style={{ color: "#64748b" }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#ffffff", // Changed to white
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              color: "#00684A",
              marginBottom: "0.5rem",
            }}
          >
            System Pre-Check
          </h1>
          {name && email && (
            <p style={{ color: "#64748b" }}>
              {name} ({email})
            </p>
          )}
        </div>

        {/* Progress Steps */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "3rem",
            position: "relative",
          }}
        >
          {steps.map((step, idx) => (
            <React.Fragment key={step.id}>
              <div style={{ flex: 1, textAlign: "center" }}>
                <div
                  style={{
                    width: "48px",
                    height: "48px",
                    borderRadius: "50%",
                    backgroundColor:
                      step.status === "passed"
                        ? "#00684A" // Emerald Green
                        : step.status === "failed"
                          ? "#ef4444"
                          : idx === currentStep
                            ? "#00684A" // Emerald Green for active too
                            : "#e2e8f0",
                    color: "#ffffff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 0.5rem",
                    fontWeight: 600,
                    fontSize: "1.125rem",
                  }}
                >
                  {step.status === "passed" ? "✓" : idx + 1}
                </div>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#64748b",
                    fontWeight: idx === currentStep ? 600 : 400,
                  }}
                >
                  {step.title}
                </p>
              </div>
              {idx < steps.length - 1 && (
                <div
                  style={{
                    position: "absolute",
                    top: "24px",
                    left: `${(idx + 1) * (100 / steps.length)}%`,
                    width: `${100 / steps.length - 10}%`,
                    height: "2px",
                    backgroundColor:
                      step.status === "passed" ? "#00684A" : "#E1F2E9", // Emerald and light Mint
                    transform: "translateX(-50%)",
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Current Step Content */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "1rem",
            padding: "2rem",
            marginBottom: "2rem",
            border: "1px solid #D1D5DB", // Added subtle border
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)", // Softened shadow
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              marginBottom: "1rem",
              color: "#00684A",
            }}
          >
            Step {currentStep + 1}: {currentStepData.title}
          </h2>

          {/* Browser Check */}
          {currentStep === 0 && (
            <div>
              {browserInfo && (
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: browserInfo.isSupported
                      ? "#f0fdf4"
                      : "#fef2f2",
                    borderRadius: "0.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <p
                    style={{
                      color: browserInfo.isSupported ? "#065f46" : "#991b1b",
                      fontWeight: 600,
                    }}
                  >
                    {browserInfo.isSupported ? "✓" : "✖"}{" "}
                    {currentStepData.message}
                  </p>
                  <p
                    style={{
                      fontSize: "0.875rem",
                      color: "#64748b",
                      marginTop: "0.5rem",
                    }}
                  >
                    Browser: {browserInfo.name} {browserInfo.version}
                  </p>
                </div>
              )}
              {currentStepData.status === "failed" && (
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: extensionScanResult?.hasExtensions
                      ? "#fef2f2"
                      : "#fffbeb",
                    border: `1px solid ${extensionScanResult?.hasExtensions ? "#fecaca" : "#fcd34d"}`,
                    borderRadius: "0.5rem",
                    marginTop: "1rem",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: extensionScanResult?.hasExtensions
                        ? "#991b1b"
                        : "#92400e",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    }}
                  >
                    {extensionScanResult?.hasExtensions
                      ? "🚫 Cannot proceed: Browser extensions detected. Please remove all extensions before continuing."
                      : "⚠️ Browser not supported. Please use Chrome (version 110+) or Edge (version 110+) to continue. Update your browser if needed."}
                  </p>
                </div>
              )}

              {/* USB Device Detection */}
              {currentStep === 0 && (
                <div style={{ marginTop: "1.5rem" }}>
                  <USBDeviceCheck
                    assessmentId={
                      Array.isArray(assessmentId)
                        ? assessmentId[0]
                        : assessmentId || ""
                    }
                    userId={email || ""}
                    onComplete={(hasSuspiciousDevices) => {
                      console.log(
                        "[Precheck] USB devices:",
                        hasSuspiciousDevices
                          ? "Suspicious devices found"
                          : "All clear",
                      );
                    }}
                  />
                </div>
              )}

              {/* Extension Detection */}
              {currentStep === 0 && (
                <>
                  {/* Scanning State */}
                  {isExtensionScanning && (
                    <div
                      style={{
                        padding: "1.25rem",
                        backgroundColor: "#f8fafc",
                        border: "2px solid #e2e8f0",
                        borderRadius: "0.75rem",
                        marginTop: "1.5rem",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.75rem",
                        }}
                      >
                        <div
                          style={{
                            width: "24px",
                            height: "24px",
                            border: "2px solid #e2e8f0",
                            borderTopColor: "#066243ff",
                            borderRadius: "50%",
                            animation: "spin 1s linear infinite",
                          }}
                        />
                        <div style={{ flex: 1 }}>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              color: "#1e293b",
                            }}
                          >
                            {EXTENSION_DETECTION_CONFIG.MESSAGES.SCANNING}
                          </p>
                          <p
                            style={{
                              margin: "0.25rem 0 0 0",
                              fontSize: "0.8125rem",
                              color: "#64748b",
                            }}
                          >
                            {EXTENSION_DETECTION_CONFIG.MESSAGES.SCANNING_DESCRIPTION(
                              KNOWN_EXTENSIONS.length,
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Web-based Detection Results */}
                  {extensionScanResult &&
                    !extensionScanResult.permissionGranted && (
                      <div
                        style={{
                          padding: "1.25rem",
                          backgroundColor: extensionScanResult.hasExtensions
                            ? "#fef2f2"
                            : "#f0fdf4",
                          border: `2px solid ${extensionScanResult.hasExtensions ? "#fecaca" : "#86efac"}`,
                          borderRadius: "0.75rem",
                          marginTop: "1.5rem",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "0.75rem",
                          }}
                        >
                          <span style={{ fontSize: "1.5rem" }}>
                            {extensionScanResult.hasExtensions ? "⚠️" : "✅"}
                          </span>
                          <div style={{ flex: 1 }}>
                            <p
                              style={{
                                margin: "0 0 0.5rem 0",
                                fontSize: "0.9375rem",
                                fontWeight: 700,
                                color: extensionScanResult.hasExtensions
                                  ? "#991b1b"
                                  : "#065f46",
                              }}
                            >
                              {extensionScanResult.hasExtensions
                                ? `Extension Indicators Detected (${extensionScanResult.count})`
                                : "No Extension Indicators Found"}
                            </p>
                            {extensionScanResult.hasExtensions ? (
                              <>
                                <p
                                  style={{
                                    margin: "0 0 0.75rem 0",
                                    fontSize: "0.875rem",
                                    color: "#991b1b",
                                  }}
                                >
                                  Extension database detection found the
                                  following extensions. Please disable them to
                                  continue.
                                </p>
                                {extensionScanResult.details.extensions.length >
                                0 ? (
                                  <div
                                    style={{
                                      padding: "0.75rem",
                                      backgroundColor: "#ffffff",
                                      borderRadius: "0.375rem",
                                      marginBottom: "0.75rem",
                                    }}
                                  >
                                    <p
                                      style={{
                                        margin: "0 0 0.5rem 0",
                                        fontSize: "0.8125rem",
                                        fontWeight: 600,
                                        color: "#991b1b",
                                      }}
                                    >
                                      Detected Extensions:
                                    </p>
                                    <ul
                                      style={{
                                        margin: 0,
                                        paddingLeft: "1.25rem",
                                        fontSize: "0.875rem",
                                        color: "#991b1b",
                                      }}
                                    >
                                      {extensionScanResult.details.extensions.map(
                                        (ext, idx) => (
                                          <li
                                            key={idx}
                                            style={{
                                              marginBottom: "0.25rem",
                                              padding: "0.5rem",
                                              backgroundColor: "#fef2f2",
                                              borderRadius: "0.375rem",
                                              border: "1px solid #fecaca",
                                            }}
                                          >
                                            <strong>{ext.name}</strong>{" "}
                                            {ext.version && (
                                              <span
                                                style={{
                                                  color: "#64748b",
                                                  fontSize: "0.8125rem",
                                                }}
                                              >
                                                (v{ext.version})
                                              </span>
                                            )}
                                            {ext.id && (
                                              <span
                                                style={{
                                                  color: "#64748b",
                                                  fontSize: "0.75rem",
                                                  display: "block",
                                                  marginTop: "0.25rem",
                                                }}
                                              >
                                                ID: {ext.id.substring(0, 8)}...
                                              </span>
                                            )}
                                          </li>
                                        ),
                                      )}
                                    </ul>
                                  </div>
                                ) : extensionScanResult.details
                                    .uniqueExtensionIds.length > 0 ? (
                                  <div
                                    style={{
                                      padding: "0.75rem",
                                      backgroundColor: "#ffffff",
                                      borderRadius: "0.375rem",
                                      marginBottom: "0.75rem",
                                    }}
                                  >
                                    <p
                                      style={{
                                        margin: "0 0 0.5rem 0",
                                        fontSize: "0.8125rem",
                                        fontWeight: 600,
                                        color: "#991b1b",
                                      }}
                                    >
                                      Detected Extension IDs (names not
                                      available):
                                    </p>
                                    <ul
                                      style={{
                                        margin: 0,
                                        paddingLeft: "1.25rem",
                                        fontSize: "0.8125rem",
                                        color: "#991b1b",
                                      }}
                                    >
                                      {extensionScanResult.details.uniqueExtensionIds.map(
                                        (id, idx) => (
                                          <li key={idx}>{id}</li>
                                        ),
                                      )}
                                    </ul>
                                  </div>
                                ) : null}
                                <div
                                  style={{
                                    padding: "0.75rem",
                                    backgroundColor: "#fffbeb",
                                    borderRadius: "0.375rem",
                                    marginBottom: "0.75rem",
                                  }}
                                >
                                  <p
                                    style={{
                                      margin: "0 0 0.5rem 0",
                                      fontSize: "0.8125rem",
                                      fontWeight: 600,
                                      color: "#92400e",
                                    }}
                                  >
                                    How to disable:
                                  </p>
                                  <ol
                                    style={{
                                      margin: 0,
                                      paddingLeft: "1.25rem",
                                      fontSize: "0.8125rem",
                                      color: "#92400e",
                                    }}
                                  >
                                    <li>
                                      Go to{" "}
                                      <code
                                        style={{
                                          backgroundColor: "#fef3c7",
                                          padding: "0.125rem 0.25rem",
                                          borderRadius: "0.25rem",
                                        }}
                                      >
                                        {
                                          EXTENSION_DETECTION_CONFIG
                                            .EXTENSION_MANAGEMENT_URLS.CHROME
                                        }
                                      </code>{" "}
                                      or{" "}
                                      <code
                                        style={{
                                          backgroundColor: "#fef3c7",
                                          padding: "0.125rem 0.25rem",
                                          borderRadius: "0.25rem",
                                        }}
                                      >
                                        {
                                          EXTENSION_DETECTION_CONFIG
                                            .EXTENSION_MANAGEMENT_URLS.EDGE
                                        }
                                      </code>
                                    </li>
                                    <li>
                                      Toggle OFF each extension listed above
                                    </li>
                                    <li>
                                      Click &quot;Re-scan&quot; below to verify
                                    </li>
                                  </ol>
                                </div>
                                <button
                                  onClick={async () => {
                                    await scanExtensions();
                                  }}
                                  disabled={isExtensionScanning}
                                  style={{
                                    width: "100%",
                                    padding: "0.875rem",
                                    backgroundColor: "#f59e0b",
                                    color: "#ffffff",
                                    border: "none",
                                    borderRadius: "0.5rem",
                                    fontSize: "0.875rem",
                                    fontWeight: 600,
                                    cursor: isExtensionScanning
                                      ? "not-allowed"
                                      : "pointer",
                                    opacity: isExtensionScanning ? 0.6 : 1,
                                  }}
                                >
                                  {isExtensionScanning
                                    ? "⏳ Scanning..."
                                    : " Re-scan Extensions"}
                                </button>
                              </>
                            ) : (
                              <p
                                style={{
                                  margin: "0 0 0.75rem 0",
                                  fontSize: "0.875rem",
                                  color: "#065f46",
                                }}
                              >
                                Web-based detection completed. No extension
                                indicators found. However, some extensions may
                                not be detectable. Please manually verify all
                                extensions are disabled.
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Extensions Detected (Permission Granted) */}
                  {extensionScanResult &&
                    extensionScanResult.permissionGranted && (
                      <div
                        style={{
                          padding: "1.25rem",
                          backgroundColor: extensionScanResult.hasExtensions
                            ? "#fef2f2"
                            : "#f0fdf4",
                          border: `2px solid ${extensionScanResult.hasExtensions ? "#fecaca" : "#86efac"}`,
                          borderRadius: "0.75rem",
                          marginTop: "1.5rem",
                        }}
                      >
                        <h3
                          style={{
                            margin: "0 0 0.75rem 0",
                            fontSize: "1rem",
                            fontWeight: 600,
                            color: extensionScanResult.hasExtensions
                              ? "#dc2626"
                              : "#065f46",
                          }}
                        >
                          {extensionScanResult.hasExtensions
                            ? `🚫 ${extensionScanResult.count} Extension(s) Detected`
                            : "✅ No Extensions Detected"}
                        </h3>

                        {extensionScanResult.hasExtensions && (
                          <>
                            <p
                              style={{
                                margin: "0 0 0.75rem 0",
                                fontSize: "0.875rem",
                                color: "#991b1b",
                              }}
                            >
                              The following extensions must be disabled:
                            </p>

                            <ul
                              style={{
                                margin: "0 0 1rem 0",
                                paddingLeft: "1.25rem",
                                fontSize: "0.875rem",
                                color: "#991b1b",
                              }}
                            >
                              {extensionScanResult.details.extensions.map(
                                (ext, idx) => (
                                  <li
                                    key={idx}
                                    style={{
                                      marginBottom: "0.25rem",
                                      padding: "0.5rem",
                                      backgroundColor: "#ffffff",
                                      borderRadius: "0.375rem",
                                      border: "1px solid #fecaca",
                                    }}
                                  >
                                    <strong>{ext.name}</strong>{" "}
                                    {ext.version && (
                                      <span
                                        style={{
                                          color: "#64748b",
                                          fontSize: "0.8125rem",
                                        }}
                                      >
                                        (v{ext.version})
                                      </span>
                                    )}
                                  </li>
                                ),
                              )}
                            </ul>

                            <div
                              style={{
                                padding: "0.75rem",
                                backgroundColor: "#fffbeb",
                                borderRadius: "0.375rem",
                                marginBottom: "0.75rem",
                              }}
                            >
                              <p
                                style={{
                                  margin: "0 0 0.5rem 0",
                                  fontSize: "0.8125rem",
                                  fontWeight: 600,
                                  color: "#92400e",
                                }}
                              >
                                How to disable:
                              </p>
                              <ol
                                style={{
                                  margin: 0,
                                  paddingLeft: "1.25rem",
                                  fontSize: "0.8125rem",
                                  color: "#92400e",
                                }}
                              >
                                <li>
                                  Go to{" "}
                                  <code
                                    style={{
                                      backgroundColor: "#fef3c7",
                                      padding: "0.125rem 0.25rem",
                                      borderRadius: "0.25rem",
                                    }}
                                  >
                                    {
                                      EXTENSION_DETECTION_CONFIG
                                        .EXTENSION_MANAGEMENT_URLS.CHROME
                                    }
                                  </code>{" "}
                                  or{" "}
                                  <code
                                    style={{
                                      backgroundColor: "#fef3c7",
                                      padding: "0.125rem 0.25rem",
                                      borderRadius: "0.25rem",
                                    }}
                                  >
                                    {
                                      EXTENSION_DETECTION_CONFIG
                                        .EXTENSION_MANAGEMENT_URLS.EDGE
                                    }
                                  </code>
                                </li>
                                <li>Toggle OFF each extension listed above</li>
                                <li>Click &quot;Re-scan&quot; below</li>
                              </ol>
                            </div>

                            <button
                              onClick={async () => {
                                await scanExtensions();
                              }}
                              disabled={isExtensionScanning}
                              style={{
                                width: "100%",
                                padding: "0.875rem",
                                backgroundColor: "#f59e0b",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: "0.5rem",
                                fontSize: "0.875rem",
                                fontWeight: 600,
                                cursor: isExtensionScanning
                                  ? "not-allowed"
                                  : "pointer",
                                opacity: isExtensionScanning ? 0.6 : 1,
                              }}
                            >
                              {isExtensionScanning
                                ? "⏳ Scanning..."
                                : "🔄 Re-scan Extensions"}
                            </button>
                          </>
                        )}

                        {!extensionScanResult.hasExtensions && (
                          <p
                            style={{
                              margin: 0,
                              fontSize: "0.875rem",
                              color: "#065f46",
                            }}
                          >
                            ✅ Your browser is clean - No extensions detected
                          </p>
                        )}
                      </div>
                    )}
                </>
              )}
            </div>
          )}

          {/* Network Check */}
          {currentStep === 1 && (
            <div>
              {networkMetrics && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 1fr)",
                    gap: "1rem",
                    marginBottom: "1rem",
                  }}
                >
                  <div
                    style={{
                      padding: "1rem",
                      backgroundColor: "#f8fafc",
                      borderRadius: "0.5rem",
                    }}
                  >
                    <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                      Ping
                    </p>
                    <p
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        color:
                          networkMetrics.ping < 300 ? "#10b981" : "#ef4444",
                      }}
                    >
                      {networkMetrics.ping}ms
                    </p>
                  </div>
                  <div
                    style={{
                      padding: "1rem",
                      backgroundColor: "#f8fafc",
                      borderRadius: "0.5rem",
                    }}
                  >
                    <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                      Download Speed
                    </p>
                    <p
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        color:
                          networkMetrics.downloadSpeed >= 2
                            ? "#10b981"
                            : "#ef4444",
                      }}
                    >
                      {networkMetrics.downloadSpeed.toFixed(2)} Mbps
                    </p>
                  </div>
                </div>
              )}
              <p
                style={{
                  color:
                    currentStepData.status === "passed"
                      ? "#065f46"
                      : currentStepData.status === "failed"
                        ? "#991b1b"
                        : "#64748b",
                  marginBottom:
                    currentStepData.status === "failed" ? "1rem" : "0",
                }}
              >
                {currentStepData.message}
              </p>
              {currentStepData.status === "failed" && (
                <button
                  onClick={handleRetry}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    backgroundColor: "#084A2A",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginTop: "1rem",
                  }}
                >
                  🔄 Retry Network Test
                </button>
              )}
            </div>
          )}

          {/* Camera Check */}
          {currentStep === 2 && (
            <div>
              <div style={{ marginBottom: "1rem", position: "relative" }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    maxWidth: "640px",
                    borderRadius: "0.5rem",
                    transform: "scaleX(-1)",
                    backgroundColor: "#000",
                  }}
                />
                <canvas ref={canvasRef} style={{ display: "none" }} />
                {cameraStream && (
                  <div
                    style={{
                      position: "absolute",
                      top: "1rem",
                      right: "1rem",
                      backgroundColor:
                        faceCount === 1
                          ? "#10b981"
                          : faceCount === 0
                            ? "#ef4444"
                            : "#f59e0b",
                      color: "#ffffff",
                      padding: "0.5rem 1rem",
                      borderRadius: "0.5rem",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                    }}
                  >
                    {faceCount === 1
                      ? "✓ Face Detected"
                      : faceCount === 0
                        ? "✖ No Face Detected"
                        : `⚠ ${faceCount} Faces Detected`}
                  </div>
                )}
              </div>
              <div
                style={{
                  padding: "1rem",
                  backgroundColor: "#f8fafc",
                  borderRadius: "0.5rem",
                  marginBottom: "1rem",
                }}
              >
                <p
                  style={{ margin: 0, color: "#64748b", fontSize: "0.875rem" }}
                >
                  <strong>Tips:</strong> Ensure your face is clearly visible,
                  well-lit, and centered in the frame. Make sure only you are in
                  the camera view.
                </p>
              </div>
              <p
                style={{
                  color:
                    currentStepData.status === "passed"
                      ? "#065f46"
                      : currentStepData.status === "failed"
                        ? "#991b1b"
                        : "#64748b",
                  marginBottom:
                    currentStepData.status === "failed" ? "1rem" : "0",
                }}
              >
                {currentStepData.message ||
                  "Position yourself in front of the camera..."}
              </p>
              {currentStepData.status === "failed" && (
                <button
                  onClick={handleRetry}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    backgroundColor: "#084A2A",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    marginTop: "1rem",
                  }}
                >
                  🔄 Retry Camera Check
                </button>
              )}
            </div>
          )}

          {/* Microphone Check */}
          {currentStep === 3 && (
            <div>
              {/* Instructions Card */}
              {!micTestStarted && currentStepData.status !== "running" && (
                <div
                  style={{
                    padding: "1.25rem",
                    backgroundColor: "#F0F9F4", // Changed from #eff6ff
                    border: "1px solid #E1F2E9", // Changed from 2px solid #3b82f6
                    borderRadius: "0.75rem",
                    marginBottom: "1.5rem",
                  }}
                >
                  <h3
                    style={{
                      margin: "0 0 0.75rem 0",
                      fontSize: "1rem",
                      fontWeight: 700,
                      color: "#00684A", // Changed from #1e40af
                    }}
                  >
                    🎤 Microphone Test Instructions
                  </h3>
                  <p
                    style={{
                      margin: "0 0 0.75rem 0",
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      color: "#00684A", // Changed from #1e40af
                    }}
                  >
                    Please read this phrase clearly:
                  </p>
                  <div
                    style={{
                      padding: "0.75rem",
                      backgroundColor: "#ffffff",
                      borderRadius: "0.5rem",
                      marginBottom: "0.75rem",
                      border: "1px solid #E1F2E9", // Changed from #93c5fd
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "1rem",
                        fontWeight: 600,
                        color: "#00684A", // Changed from #1e40af
                        fontStyle: "italic",
                      }}
                    >
                      "{MIC_CHECK_CONFIG.PHRASE}"
                    </p>
                  </div>
                  <ol
                    style={{
                      margin: 0,
                      paddingLeft: "1.25rem",
                      fontSize: "0.875rem",
                      color: "#00684A", // Changed from #1e40af
                    }}
                  >
                    <li>Click "Start Microphone Check" below</li>
                    <li>Read the phrase clearly when testing begins</li>
                    <li>Speak at normal volume (don't whisper)</li>
                    <li>Watch the progress bar fill up as you speak</li>
                    <li>Test takes 3 seconds - keep speaking!</li>
                  </ol>
                </div>
              )}

              {/* Microphone Selection Dropdown */}
              {audioDevices.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      color: "#374151",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Select Microphone:
                  </label>
                  <select
                    value={selectedAudioDeviceId}
                    onChange={(e) => {
                      setSelectedAudioDeviceId(e.target.value);
                      // Stop current stream if running
                      if (microphoneStream) {
                        microphoneStream
                          .getTracks()
                          .forEach((track) => track.stop());
                        setMicrophoneStream(null);
                        if (animationFrameRef.current) {
                          cancelAnimationFrame(animationFrameRef.current);
                        }
                        if (
                          audioContextRef.current &&
                          audioContextRef.current.state !== "closed"
                        ) {
                          try {
                            audioContextRef.current.close();
                          } catch (e) {
                            // AudioContext might already be closed
                            console.log(
                              "[Microphone] AudioContext already closed",
                            );
                          }
                        }
                        audioContextRef.current = null;
                        setAudioLevel(-Infinity);
                        setAudioDataArray(null);
                        setIsListening(false);
                        setMicTestStarted(false);
                        setSamplesAboveThreshold(0);
                        setTotalSamples(0);
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.5rem",
                      fontSize: "0.95rem",
                      backgroundColor: "#ffffff",
                      color: "#1f2937",
                      cursor: "pointer",
                    }}
                    disabled={
                      currentStepData.status === "running" || isListening
                    }
                  >
                    {audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label ||
                          `Microphone ${audioDevices.indexOf(device) + 1}`}
                      </option>
                    ))}
                  </select>
                  <p
                    style={{
                      marginTop: "0.5rem",
                      fontSize: "0.75rem",
                      color: "#6b7280",
                    }}
                  >
                    {audioDevices.length > 1
                      ? `${audioDevices.length} microphones detected. Select the one you want to use.`
                      : "Using default microphone."}
                  </p>
                </div>
              )}

              {/* Enhanced Audio Visualizer with Threshold Line */}
              <div
                style={{
                  height: "150px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "0.5rem",
                  marginBottom: "1rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  border: isListening
                    ? "2px solid #3b82f6"
                    : "1px solid #e2e8f0",
                  overflow: "hidden",
                }}
              >
                {/* Waveform Visualization */}
                {audioDataArray && audioDataArray.length > 0 ? (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "1rem",
                      position: "relative",
                    }}
                  >
                    <svg
                      width="100%"
                      height="100%"
                      style={{ overflow: "visible" }}
                    >
                      {/* Threshold line at -40 dB (shown at 50% height) */}
                      <line
                        x1="0%"
                        y1="50%"
                        x2="100%"
                        y2="50%"
                        stroke="#fbbf24"
                        strokeWidth="2"
                        strokeDasharray="4,4"
                        opacity={0.8}
                      />
                      <text
                        x="2%"
                        y="48%"
                        fill="#fbbf24"
                        fontSize="10"
                        fontWeight="600"
                      >
                        -40 dB
                      </text>
                      {/* Waveform bars */}
                      {Array.from(audioDataArray)
                        .slice(0, 128)
                        .map((value, index) => {
                          const normalizedValue = (value - 128) / 128;
                          const barHeight = Math.abs(normalizedValue) * 60;
                          const x = (index / 128) * 100 + "%";
                          // Color: green if above threshold, blue if below
                          const color =
                            audioLevel >= MIC_CHECK_CONFIG.THRESHOLD_DB
                              ? "#10b981"
                              : "#3b82f6";

                          return (
                            <rect
                              key={index}
                              x={x}
                              y="50%"
                              width="2"
                              height={barHeight}
                              fill={color}
                              opacity={0.7}
                              transform={`translate(0, ${-barHeight / 2})`}
                              style={{ transition: "height 0.05s ease" }}
                            />
                          );
                        })}
                    </svg>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        border: "3px solid #e2e8f0",
                        borderTopColor: isListening ? "#3b82f6" : "#e2e8f0",
                        borderRadius: "50%",
                        animation: isListening
                          ? "spin 1s linear infinite"
                          : "none",
                      }}
                    />
                    <p
                      style={{
                        fontSize: "0.875rem",
                        color: "#64748b",
                        margin: 0,
                      }}
                    >
                      {isListening
                        ? "Listening..."
                        : "Waiting for microphone..."}
                    </p>
                  </div>
                )}

                {/* Enhanced Audio Level Indicator with Color Coding */}
                <div
                  style={{
                    position: "absolute",
                    bottom: "0.5rem",
                    left: "50%",
                    transform: "translateX(-50%)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    padding: "0.375rem 0.875rem",
                    borderRadius: "1rem",
                    fontSize: "0.875rem",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  {audioLevel > -Infinity ? (
                    <>
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor:
                            audioLevel >= MIC_CHECK_CONFIG.THRESHOLD_DB
                              ? "#10b981"
                              : audioLevel > -80
                                ? "#fbbf24"
                                : "#ef4444",
                          animation:
                            audioLevel >= MIC_CHECK_CONFIG.THRESHOLD_DB
                              ? "pulse 1s ease-in-out infinite"
                              : "none",
                        }}
                      />
                      <span
                        style={{
                          color:
                            audioLevel >= MIC_CHECK_CONFIG.THRESHOLD_DB
                              ? "#065f46"
                              : audioLevel > -80
                                ? "#92400e"
                                : "#991b1b",
                          fontWeight: 600,
                        }}
                      >
                        {audioLevel >= MIC_CHECK_CONFIG.THRESHOLD_DB
                          ? `🟢 ${audioLevel.toFixed(1)} dB ✓ Good!`
                          : audioLevel > -80
                            ? `🟡 ${audioLevel.toFixed(1)} dB`
                            : `🔴 ${audioLevel.toFixed(1)} dB`}
                      </span>
                    </>
                  ) : (
                    <>
                      <div
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: "#ef4444",
                        }}
                      />
                      <span style={{ color: "#991b1b", fontWeight: 600 }}>
                        No audio detected
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Progress Tracking (during test only) */}
              {isListening && micTestStarted && (
                <div style={{ marginBottom: "1rem" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.5rem",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#374151",
                      }}
                    >
                      Voice Detection Progress
                    </span>
                    <span
                      style={{
                        fontSize: "0.875rem",
                        fontWeight: 700,
                        color: "#10b981",
                      }}
                    >
                      {Math.min(
                        100,
                        Math.round(
                          (samplesAboveThreshold /
                            MIC_CHECK_CONFIG.REQUIRED_SAMPLES) *
                            100,
                        ),
                      )}
                      %
                    </span>
                  </div>
                  <div
                    style={{
                      height: "12px",
                      backgroundColor: "#e2e8f0",
                      borderRadius: "6px",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.min(100, (samplesAboveThreshold / MIC_CHECK_CONFIG.REQUIRED_SAMPLES) * 100)}%`,
                        height: "100%",
                        backgroundColor: "#10b981",
                        borderRadius: "6px",
                        transition: "width 0.2s ease",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {isListening && (
                        <div
                          style={{
                            position: "absolute",
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background:
                              "linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)",
                            animation: "shimmer 1.5s infinite",
                          }}
                        />
                      )}
                    </div>
                  </div>
                  <p
                    style={{
                      margin: "0.5rem 0 0 0",
                      fontSize: "0.75rem",
                      color: "#6b7280",
                    }}
                  >
                    Minimum required: {MIC_CHECK_CONFIG.REQUIRED_SAMPLES}{" "}
                    samples above {MIC_CHECK_CONFIG.THRESHOLD_DB} dB
                  </p>
                </div>
              )}

              {/* Dynamic Status Messages */}
              {currentStepData.status === "running" && isListening && (
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor: "#f0fdf4",
                    border: "1px solid #10b981",
                    borderRadius: "0.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "#065f46",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                    }}
                  >
                    {currentStepData.message}
                  </p>
                </div>
              )}

              {/* Final Status Message */}
              {currentStepData.status !== "running" && (
                <div
                  style={{
                    padding: "1rem",
                    backgroundColor:
                      currentStepData.status === "passed"
                        ? "#f0fdf4"
                        : currentStepData.status === "failed"
                          ? "#fef2f2"
                          : "#f8fafc",
                    border: `1px solid ${currentStepData.status === "passed" ? "#10b981" : currentStepData.status === "failed" ? "#ef4444" : "#e2e8f0"}`,
                    borderRadius: "0.5rem",
                    marginBottom: "1rem",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color:
                        currentStepData.status === "passed"
                          ? "#065f46"
                          : currentStepData.status === "failed"
                            ? "#991b1b"
                            : "#64748b",
                      fontSize: "0.875rem",
                      fontWeight:
                        currentStepData.status !== "pending" ? 600 : 400,
                    }}
                  >
                    {currentStepData.message}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              {!micTestStarted &&
                currentStepData.status !== "running" &&
                currentStepData.status !== "passed" && (
                  <button
                    onClick={async () => {
                      await checkMicrophone();
                    }}
                    disabled={isListening}
                    style={{
                      width: "100%",
                      padding: "1rem",
                      backgroundColor: "#084A2A",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      fontWeight: 600,
                      cursor: isListening ? "not-allowed" : "pointer",
                      opacity: isListening ? 0.6 : 1,
                      marginBottom: "1rem",
                    }}
                  >
                    🎤 Start Microphone Check
                  </button>
                )}

              {isListening && micTestStarted && (
                <div
                  style={{
                    width: "100%",
                    padding: "1rem",
                    backgroundColor: "#F0F9F4", // Mint background
                    border: "1px solid #E1F2E9", // Mint border
                    borderRadius: "0.5rem",
                    textAlign: "center",
                    marginBottom: "1rem",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "#1e40af",
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                    }}
                  >
                    🎙️ Testing in progress... Keep speaking!
                  </p>
                </div>
              )}

              {currentStepData.status === "failed" && (
                <button
                  onClick={handleRetry}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    backgroundColor: "#084A2A",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  🔄 Retry Microphone Check
                </button>
              )}
            </div>
          )}

          {/* Status Indicator */}
          {currentStepData.status === "running" && (
            <div style={{ textAlign: "center", marginTop: "1rem" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  border: "3px solid #e2e8f0",
                  borderTopColor: "#3b82f6",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: "0 auto",
                }}
              />
            </div>
          )}

          {/* Next Button - Show when current step passes */}
          {currentStepData.status === "passed" &&
            currentStep < steps.length - 1 && (
              <div
                style={{
                  marginTop: "1.5rem",
                  paddingTop: "1.5rem",
                  borderTop: "1px solid #e2e8f0",
                }}
              >
                <button
                  onClick={() => {
                    if (currentStep < steps.length - 1) {
                      setCurrentStep(currentStep + 1);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "1rem",
                    backgroundColor: "#084A2A",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.5rem",
                  }}
                >
                  Next: {steps[currentStep + 1]?.title || "Next Step"} →
                </button>
              </div>
            )}
        </div>

        {/* Continue Button - Only shown when all steps are complete */}
        {allStepsPassed && (
          <button
            onClick={handleComplete}
            disabled={!canProceedToNext}
            style={{
              width: "100%",
              padding: "1rem 2rem",
              backgroundColor: canProceedToNext ? "#084A2A" : "#D1D5DB", // Emerald Green
              color: "#ffffff",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "1.125rem",
              fontWeight: 600,
              cursor: canProceedToNext ? "pointer" : "not-allowed",
              boxShadow: canProceedToNext
                ? "0 4px 6px -1px rgba(0, 104, 74, 0.3)"
                : "none",
              transition: "all 0.2s ease",
              opacity: canProceedToNext ? 1 : 0.7,
            }}
          >
            Continue to Instructions →
          </button>
        )}
      </div>

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
