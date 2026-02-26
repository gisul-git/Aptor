import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/router";

export default function AssessmentInstructionsPage() {
  const router = useRouter();
  const { id, token } = router.query;
  const [acknowledged, setAcknowledged] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const hasCheckedPrecheckRef = useRef(false); // Prevent multiple redirects

  useEffect(() => {
    // Prevent multiple redirects
    if (hasCheckedPrecheckRef.current) return;
    
    const storedEmail = sessionStorage.getItem("candidateEmail");
    const storedName = sessionStorage.getItem("candidateName");
    setEmail(storedEmail);
    setName(storedName);

    if (!storedEmail || !storedName) {
      if (id && token) {
        hasCheckedPrecheckRef.current = true;
        router.replace(`/assessment/${id}/${token}`);
      }
      return;
    }

    // Check if pre-check was completed
    const precheckCompleted = sessionStorage.getItem(`precheckCompleted_${id}`);
    if (!precheckCompleted && id && token) {
      // Pre-check not completed, redirect to new pre-check page
      hasCheckedPrecheckRef.current = true;
      router.replace(`/precheck/${id}/${token}`);
      return;
    }

    hasCheckedPrecheckRef.current = true;
    setIsCheckingSession(false);
  }, [id, token, router]);

  // Start candidate session (record startedAt in backend)
  const startSession = useCallback(async (): Promise<boolean> => {
    if (!id || !token || !email || !name) return false;
    
    try {
      const response = await fetch("/api/assessment/start-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessmentId: id,
          token,
          email,
          name,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data?.startedAt) {
          // Store startedAt in sessionStorage for client-side timer reference
          sessionStorage.setItem("assessmentStartedAt", data.data.startedAt);
          sessionStorage.setItem("serverTime", data.data.serverTime);
          return true;
        }
      }
      
      console.error("[Session] Failed to start session");
      return false;
    } catch (error) {
      console.error("[Session] Error starting session:", error);
      return false;
    }
  }, [id, token, email, name]);

  // Request fullscreen
  const requestFullscreen = useCallback(async (): Promise<boolean> => {
    try {
      const elem = document.documentElement;
      
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      } else if ((elem as any).mozRequestFullScreen) {
        await (elem as any).mozRequestFullScreen();
      } else if ((elem as any).msRequestFullscreen) {
        await (elem as any).msRequestFullscreen();
      }
      
      // Verify fullscreen was actually entered
      await new Promise(resolve => setTimeout(resolve, 100));
      const isFullscreen = !!(
        document.fullscreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).mozFullScreenElement ||
        (document as any).msFullscreenElement
      );
      
      return isFullscreen;
    } catch (error) {
      console.error("[Proctor] Failed to enter fullscreen:", error);
      return false;
    }
  }, []);

  // Handle "Start Assessment" click - go directly to camera modal
  const handleStartClick = () => {
    if (!acknowledged || !id || !token) return;
    handleStartAssessment();
  };

  // Handle start assessment
  const handleStartAssessment = async () => {
    setIsStarting(true);
    
    // Start candidate session in background (don't block navigation)
    startSession().catch((err) => {
      console.warn("[Session] Failed to record session start:", err);
    });
    
    // Navigate to assessment
    router.push(`/assessment/${id}/${token}/take`);
  };

  if (isCheckingSession) {
    return null;
  }

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh", padding: "2rem" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div 
          className="card" 
          style={{ 
            padding: "2rem",
            backgroundColor: "#ffffff",
            borderRadius: "1rem",
            border: "1px solid #D1D5DB", 
            boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
          }}
        >
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <p style={{ margin: 0, color: "#6b7280", fontSize: "0.9rem" }}>Candidate</p>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#00684A" }}>
              Assessment Instructions
            </h1>
            {email && name && (
              <p style={{ color: "#4b5563", marginTop: "0.5rem" }}>
                {name} ({email})
              </p>
            )}
          </div>

          <div style={{ display: "grid", gap: "1.5rem", marginBottom: "2rem" }}>
            <InstructionCard
              title="General Guidelines"
              bullets={[
                "Ensure a stable internet connection and a quiet environment.",
                "Do not refresh or close the browser tab during the assessment.",
                "Each section may have its own timer—keep an eye on the countdown.",
              ]}
            />
            <InstructionCard
              title="Answering Questions"
              bullets={[
                "Read each question carefully before responding.",
                "For descriptive questions, type answers in your own words. Copy/paste is disabled.",
                "Multiple-choice questions allow only one selection; ensure you click the correct option.",
              ]}
            />
            <InstructionCard
              title="Submission Rules"
              bullets={[
                "You must submit each section before proceeding to the next.",
                "If time expires, remaining answers will be auto-submitted.",
                "Use the navigation controls to move between questions in the current section.",
              ]}
            />
            
            {/* Proctoring Guidelines Card - Mandatory Fullscreen (Kept Red for Warning UX) */}
            <div
              style={{
                border: "1px solid #fecaca",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                backgroundColor: "#fef2f2",
              }}
            >
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#991b1b", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Proctoring Requirements (Mandatory)
              </h2>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#991b1b", lineHeight: 1.6 }}>
                <li style={{ marginBottom: "0.5rem" }}>
                  <strong>Fullscreen Mode (Required):</strong> You must enter fullscreen mode to start the exam. The assessment will not begin without it.
                </li>
                <li style={{ marginBottom: "0.5rem" }}>
                  <strong>Camera Proctoring:</strong> Your camera will be used to monitor face presence, gaze direction, and multiple faces. Snapshots are captured only on violations.
                </li>
                <li style={{ marginBottom: "0.5rem" }}>
                  <strong>Tab Switching:</strong> Switching to other browser tabs will be detected and recorded.
                </li>
                <li style={{ marginBottom: "0.5rem" }}>
                  <strong>Window Focus:</strong> Clicking outside the browser window will be monitored.
                </li>
                <li style={{ marginBottom: "0.5rem" }}>
                  <strong>Copy/Paste:</strong> Copy and paste actions are restricted and will be logged.
                </li>
              </ul>
            </div>
            
            <InstructionCard
              title="Code of Conduct"
              bullets={[
                "Any attempt to switch tabs, copy content, or seek unauthorized help may disqualify your attempt.",
                "Keep your webcam and microphone ready if proctoring is enabled.",
                "Contact the assessment administrator immediately if you face technical issues.",
              ]}
            />
          </div>

          <div style={{ 
            marginBottom: "1.5rem", 
            padding: "1rem",
            backgroundColor: "#F0F9F4",
            borderRadius: "0.5rem",
            border: "1px solid #E1F2E9"
          }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                style={{ width: "1.25rem", height: "1.25rem" }}
              />
              <span style={{ fontSize: "0.95rem", color: "#00684A", fontWeight: 500 }}>
                I have read and understood the instructions, and I agree to follow the assessment rules.
              </span>
            </label>
          </div>

          <button
            type="button"
            className="bg-brand-primary hover:bg-[#084A2A] text-white font-medium px-4 sm:px-6 py-2.5 sm:py-3 h-auto shadow-sm hover:shadow-md transition-all text-sm sm:text-base w-full"
            onClick={handleStartClick}
            disabled={!acknowledged || isStarting}
            style={{
              opacity: acknowledged ? 1 : 0.6,
              cursor: acknowledged ? "pointer" : "not-allowed",
            }}
          >
            {isStarting ? "Starting..." : "Start Assessment"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InstructionCard({ title, bullets }: { title: string; bullets: string[] }) {
  return (
    <div
      style={{
        border: "1px solid #E1F2E9",
        borderRadius: "0.75rem",
        padding: "1.25rem",
        backgroundColor: "#F0F9F4",
      }}
    >
      <h2 style={{ fontSize: "1.1rem", fontWeight: 600, color: "#00684A", marginBottom: "0.75rem" }}>
        {title}
      </h2>
      <ul style={{ margin: 0, paddingLeft: "1.25rem", color: "#475569", lineHeight: 1.6 }}>
        {bullets.map((item, idx) => (
          <li key={idx} style={{ marginBottom: "0.5rem" }}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}