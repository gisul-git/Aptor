import { useEffect } from "react";
import { useRouter } from "next/router";

export default function TestCompletedPage() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    // Clear any test-related session storage
    // Add any cleanup logic here if needed
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
      <div className="card" style={{ maxWidth: "600px", width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>✅</div>
        <h1 style={{ marginBottom: "1rem", fontSize: "2rem", color: "#ffffff", fontWeight: 700 }}>
          Test Submitted Successfully!
        </h1>
        <p style={{ color: "#94a3b8", marginBottom: "2rem", fontSize: "1.125rem", lineHeight: 1.6 }}>
          Thank you for completing the test. Your responses have been submitted successfully.
        </p>
        <div style={{
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          marginBottom: "2rem"
        }}>

          <p style={{ color: "#cbd5e1", fontSize: "0.875rem", margin: 0, marginBottom: "0.5rem" }}>
            Your test is being evaluated in the background.
          </p>
          <p style={{ color: "#94a3b8", fontSize: "0.875rem", margin: 0 }}>
            You will be notified about your results via email once the evaluation is complete.
          </p>
        </div>
        <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
          You can now close this window.
        </p>
      </div>
    </div>
  );
}