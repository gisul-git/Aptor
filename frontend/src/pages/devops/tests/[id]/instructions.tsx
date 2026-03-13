import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { getGateContext } from "@/lib/gateContext";
import { useDevOpsTest } from "@/hooks/api/useDevOps";

export default function DevOpsInstructionsPage() {
  const router = useRouter();
  const testId = typeof router.query.id === "string" ? router.query.id : undefined;
  const token = typeof router.query.token === "string" ? router.query.token : undefined;
  const { data: testData } = useDevOpsTest(testId);

  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const checkedRef = useRef(false);
  const testTitle =
    typeof (testData as { title?: unknown } | undefined)?.title === "string"
      ? ((testData as { title?: string }).title as string)
      : "Assessment";

  useEffect(() => {
    if (!router.isReady || !testId || !token) return;
    if (checkedRef.current) return;

    const candidateEmail = sessionStorage.getItem("candidateEmail");
    const candidateName = sessionStorage.getItem("candidateName");
    if (!candidateEmail || !candidateName) {
      checkedRef.current = true;
      router.replace(`/devops/tests/${testId}/entry?token=${encodeURIComponent(token)}`);
      return;
    }

    const ctx = getGateContext(testId);
    if (!ctx || ctx.flowType !== "devops") {
      checkedRef.current = true;
      router.replace(`/devops/tests/${testId}/entry?token=${encodeURIComponent(token)}`);
      return;
    }

    const precheckCompleted = sessionStorage.getItem(`precheckCompleted_${testId}`);
    if (!precheckCompleted) {
      checkedRef.current = true;
      router.replace(`/precheck/${testId}/${encodeURIComponent(token)}`);
      return;
    }

    setEmail(candidateEmail);
    setName(candidateName);
    checkedRef.current = true;
    setReady(true);
  }, [router, testId, token]);

  const handleContinue = async () => {
    if (!testId || !token || continuing) return;
    setContinuing(true);

    sessionStorage.setItem(`instructionsAcknowledged_${testId}`, "true");
    sessionStorage.setItem(`candidateRequirementsCompleted_${testId}`, "true");
    sessionStorage.setItem(`identityVerificationCompleted_${testId}`, "true");

    await router.replace(`/devops/tests/${testId}/take?token=${encodeURIComponent(token)}`);
  };

  if (!ready) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p>Loading instructions...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "2rem",
        background: "linear-gradient(160deg, #f0f9ff 0%, #f8fafc 100%)",
      }}
    >
      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          background: "#ffffff",
          border: "1px solid #dbeafe",
          borderRadius: "14px",
          padding: "2rem",
        }}
      >
        <h1 style={{ marginTop: 0, color: "#0f172a" }}>DevOps Assessment Instructions</h1>
        {name && email ? (
          <p style={{ color: "#334155", marginTop: "-0.25rem" }}>
            Candidate: {name} ({email})
          </p>
        ) : null}

        <div
          style={{
            marginTop: "1.25rem",
            padding: "1rem 1.25rem",
            borderRadius: "10px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <p style={{ marginTop: 0, fontWeight: 600, color: "#0f172a" }}>
            {testTitle}
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#334155", lineHeight: 1.7 }}>
            <li>Camera/mic/system precheck must remain valid during the test.</li>
            <li>Keep browser tab active and avoid switching away from the test window.</li>
            <li>Use your own work. Suspicious activity can be flagged in proctoring logs.</li>
            <li>Submit each question after validation and complete before the timer ends.</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={continuing}
          style={{
            marginTop: "1.5rem",
            background: "#0369a1",
            color: "#ffffff",
            border: "none",
            borderRadius: "8px",
            padding: "0.8rem 1.25rem",
            fontWeight: 600,
            cursor: continuing ? "not-allowed" : "pointer",
            opacity: continuing ? 0.7 : 1,
          }}
        >
          {continuing ? "Opening Test..." : "I Understand, Start Test"}
        </button>
      </div>
    </div>
  );
}
