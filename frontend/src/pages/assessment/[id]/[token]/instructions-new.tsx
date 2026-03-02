import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { getGateContext } from "@/lib/gateContext";

export default function AssessmentInstructionsPage() {
  const router = useRouter();
  const { id, token } = router.query;
  
  console.log("[INSTRUCTIONS-NEW] Component rendering", {
    id,
    token,
    routerIsReady: router.isReady,
    currentPath: router.asPath,
    timestamp: new Date().toISOString()
  });
  
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [assessmentInfo, setAssessmentInfo] = useState<any>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isNavigating, setIsNavigating] = useState(false);
  const hasCheckedRef = useRef(false); // Prevent multiple redirects
  
  useEffect(() => {
    console.log("[INSTRUCTIONS-NEW] useEffect triggered", {
      routerIsReady: router.isReady,
      hasChecked: hasCheckedRef.current,
      id,
      token,
      timestamp: new Date().toISOString()
    });
    
    // Wait for router to be ready
    if (!router.isReady) {
      console.log("[INSTRUCTIONS-NEW] Router not ready, waiting...");
      return;
    }
    
    // Prevent multiple redirects
    if (hasCheckedRef.current) {
      console.log("[INSTRUCTIONS-NEW] Already checked, skipping...");
      return;
    }
    
    const storedEmail = sessionStorage.getItem("candidateEmail");
    const storedName = sessionStorage.getItem("candidateName");
    
    console.log("[INSTRUCTIONS-NEW] Session storage check", {
      storedEmail: !!storedEmail,
      storedName: !!storedName,
      emailLength: storedEmail?.length,
      nameLength: storedName?.length
    });
    
    setEmail(storedEmail);
    setName(storedName);
    
    if (!storedEmail || !storedName) {
      console.log("[INSTRUCTIONS-NEW] ⚠️ Missing email/name, redirecting to entry", {
        hasId: !!id,
        hasToken: !!token
      });
      if (id && token) {
        hasCheckedRef.current = true;
        const ctx = getGateContext(id as string);
        const targetUrl = ctx?.entryUrl || `/assessment/${id}/${token}`;
        console.log("[INSTRUCTIONS-NEW] 🔄 Navigating to:", targetUrl);
        router.replace(targetUrl).catch((err) => {
          console.error("[INSTRUCTIONS-NEW] ❌ Navigation error:", {
            error: err,
            name: err?.name,
            message: err?.message,
            stack: err?.stack
          });
        });
      }
      return;
    }
    
    // Check precheck completion
    const precheckCompleted = sessionStorage.getItem(`precheckCompleted_${id}`);
    console.log("[INSTRUCTIONS-NEW] Precheck check", {
      precheckCompleted: !!precheckCompleted,
      id
    });
    
    if (!precheckCompleted && id && token) {
      console.log("[INSTRUCTIONS-NEW] ⚠️ Precheck not completed, redirecting to precheck");
      hasCheckedRef.current = true;
      const targetUrl = `/precheck/${id}/${token}`;
      console.log("[INSTRUCTIONS-NEW] 🔄 Navigating to:", targetUrl);
      router.replace(targetUrl).catch((err) => {
        console.error("[INSTRUCTIONS-NEW] ❌ Navigation error:", {
          error: err,
          name: err?.name,
          message: err?.message,
          stack: err?.stack
        });
      });
      return;
    }
    
    console.log("[INSTRUCTIONS-NEW] ✅ All checks passed, proceeding with component initialization");
    hasCheckedRef.current = true;
    
    const ctx = getGateContext(id as string);
    const isAIFlow = !ctx || ctx.flowType === "ai";
    
    console.log("[INSTRUCTIONS-NEW] Flow type check", {
      ctx,
      flowType: ctx?.flowType,
      isAIFlow
    });

    // AI: fetch schedule; non-AI: skip fetch and show defaults
    if (!isAIFlow) {
      console.log("[INSTRUCTIONS-NEW] Non-AI flow, skipping fetch");
      setAssessmentInfo(null);
      setIsLoading(false);
      return;
    }

    const fetchAssessment = async () => {
      console.log("[INSTRUCTIONS-NEW] Starting assessment fetch");
      try {
        const response = await axios.get(
          `/api/assessment/get-schedule?assessmentId=${id}&token=${token}`
        );

        if (response.data?.success) {
          console.log("[INSTRUCTIONS-NEW] ✅ Assessment fetched successfully");
          setAssessmentInfo(response.data.data);
        }
      } catch (error) {
        console.error("[INSTRUCTIONS-NEW] ❌ Error fetching assessment:", error);
      } finally {
        setIsLoading(false);
        console.log("[INSTRUCTIONS-NEW] Fetch complete, loading set to false");
      }
    };

    if (id && token) {
      fetchAssessment();
    }
  }, [id, token, router]);
  
  const handleAcknowledge = useCallback(async () => {
    if (!id || isNavigating || !router.isReady) return;
    
    setIsNavigating(true);
    setAcknowledged(true);
    sessionStorage.setItem(`instructionsAcknowledged_${id}`, "true");
    
    try {
      // Route to candidate requirements page
      // Use replace instead of push to avoid adding to history stack
      await router.replace(`/assessment/${id}/${token}/candidate-requirements`);
    } catch (error: any) {
      // Ignore navigation cancellation errors (they're expected when navigating quickly)
      if (error?.name === 'AbortError' || error?.message?.includes('Abort')) {
        console.log("[Instructions] Navigation was cancelled (expected)");
        return;
      }
      console.error("[Instructions] Navigation error:", error);
      setIsNavigating(false);
      setAcknowledged(false);
    }
  }, [id, token, router, isNavigating]);
  
  if (isLoading) {
    return (
      <div style={{ 
        minHeight: "100vh", 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center",
        backgroundColor: "#ffffff" // Changed to white
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: "48px",
            height: "48px",
            border: "4px solid #E1F2E9", // Light mint border
            borderTopColor: "#00684A", // Emerald spinner
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
            margin: "0 auto 1rem"
          }} />
          <p style={{ color: "#64748b" }}>Loading instructions...</p>
        </div>
        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }
  
  return (
    <div style={{ 
      minHeight: "100vh", 
      backgroundColor: "#ffffff", // Changed to white
      padding: "2rem"
    }}>
      <div style={{ maxWidth: "900px", margin: "0 auto" }}>
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          padding: "2rem",
          border: "1px solid #D1D5DB", // Added subtle border
          boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)" // Softened shadow
        }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "2rem" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: 700, color: "#00684A", marginBottom: "0.5rem" }}>
              Assessment Instructions
            </h1>
            {name && email && (
              <p style={{ color: "#64748b" }}>
                {name} ({email})
              </p>
            )}
          </div>
          
          {/* Instructions Content */}
          <div style={{
            marginBottom: "2rem",
            padding: "1.5rem",
            backgroundColor: "#F0F9F4", // Mint background
            borderRadius: "0.5rem",
            border: "1px solid #E1F2E9" // Mint border
          }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem", color: "#00684A" }}>
              Please read the following instructions carefully:
            </h2>
            
            <div style={{ 
              lineHeight: "1.75",
              color: "#475569",
              fontSize: "1rem"
            }}>
              {assessmentInfo?.instructions ? (
                <div dangerouslySetInnerHTML={{ __html: assessmentInfo.instructions }} />
              ) : (
                <ul style={{ paddingLeft: "1.5rem", margin: 0 }}>
                  <li style={{ marginBottom: "0.75rem" }}>
                    <strong>Duration:</strong> Complete the assessment within the allocated time. The timer will be displayed at the top of the screen.
                  </li>
                  <li style={{ marginBottom: "0.75rem" }}>
                    <strong>Navigation:</strong> Use the "Next" and "Previous" buttons to navigate between questions. You can review your answers before submitting.
                  </li>
                  <li style={{ marginBottom: "0.75rem" }}>
                    <strong>Auto-save:</strong> Your answers are automatically saved as you progress through the assessment.
                  </li>
                  <li style={{ marginBottom: "0.75rem" }}>
                    <strong>Proctoring:</strong> This assessment is proctored. Your camera and screen are being monitored for integrity purposes.
                  </li>
                  <li style={{ marginBottom: "0.75rem" }}>
                    <strong>Fullscreen:</strong> You must remain in fullscreen mode throughout the assessment. Exiting fullscreen may result in disqualification.
                  </li>
                  <li style={{ marginBottom: "0.75rem" }}>
                    <strong>No External Help:</strong> Do not use external resources, communication tools, or assistance during the assessment.
                  </li>
                  <li style={{ marginBottom: "0.75rem" }}>
                    <strong>Submission:</strong> Once you submit the assessment, you cannot make any changes. Review your answers carefully before submitting.
                  </li>
                </ul>
              )}
            </div>
          </div>
          
          {/* Rules Section (Kept Red/Pink for Warning UX) */}
          <div style={{
            marginBottom: "2rem",
            padding: "1.5rem",
            backgroundColor: "#fef2f2",
            borderRadius: "0.5rem",
            border: "1px solid #fecaca"
          }}>
            <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem", color: "#991b1b" }}>
              ⚠️ Important Rules:
            </h3>
            <ul style={{ paddingLeft: "1.5rem", margin: 0, color: "#991b1b" }}>
              <li style={{ marginBottom: "0.5rem" }}>Do not switch tabs or windows during the assessment</li>
              <li style={{ marginBottom: "0.5rem" }}>Do not copy, paste, or use keyboard shortcuts to copy content</li>
              <li style={{ marginBottom: "0.5rem" }}>Do not use mobile devices or external communication tools</li>
              <li style={{ marginBottom: "0.5rem" }}>Ensure you have a stable internet connection</li>
              <li style={{ marginBottom: "0.5rem" }}>Keep your face visible to the camera at all times</li>
            </ul>
          </div>
          
          {/* Acknowledgment Checkbox */}
          <div style={{
            marginBottom: "2rem",
            padding: "1rem",
            backgroundColor: "#F0F9F4", // Mint background
            borderRadius: "0.5rem",
            border: "1px solid #E1F2E9" // Mint border
          }}>
            <label style={{ 
              display: "flex", 
              alignItems: "center",
              cursor: "pointer",
              fontSize: "1rem",
              color: "#00684A" // Emerald text
            }}>
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                style={{
                  width: "1.25rem",
                  height: "1.25rem",
                  marginRight: "0.75rem",
                  cursor: "pointer"
                }}
              />
              <span>
                I have read and understood all the instructions and rules. I agree to abide by them during the assessment.
              </span>
            </label>
          </div>
          
          {/* Continue Button */}
          <button
            onClick={handleAcknowledge}
            disabled={!acknowledged || isNavigating}
            className={`transition-all ${
              acknowledged && !isNavigating 
                ? "hover:bg-[#084A2A] hover:shadow-md" 
                : ""
            }`}
            style={{
              width: "100%",
              padding: "1rem 2rem",
              backgroundColor: (acknowledged && !isNavigating) ? "#00684A" : "#D1D5DB", // Emerald or disabled Gray
              color: (acknowledged && !isNavigating) ? "#ffffff" : "#6B7280",
              border: "none",
              borderRadius: "0.5rem",
              fontSize: "1.125rem",
              fontWeight: 500, // Matched font-medium from Tailwind
              cursor: (acknowledged && !isNavigating) ? "pointer" : "not-allowed",
              boxShadow: (acknowledged && !isNavigating) ? "0 1px 2px 0 rgba(0, 0, 0, 0.05)" : "none", // Matched shadow-sm from Tailwind
              opacity: isNavigating ? 0.7 : 1,
            }}
          >
            {isNavigating ? "Loading..." : "Continue to Assessment →"}
          </button>
        </div>
      </div>
    </div>
  );
}