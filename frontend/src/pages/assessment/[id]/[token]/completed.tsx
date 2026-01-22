import { useEffect } from "react";
import { useRouter } from "next/router";

export default function AssessmentCompletedPage() {
  const router = useRouter();
  const { id, token } = router.query;

  useEffect(() => {
    // Clear session storage after submissions
    sessionStorage.removeItem("candidateEmail");
    sessionStorage.removeItem("candidateName");
  }, []);

  return (
    <div style={{ backgroundColor: "#f1dcba", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="card" style={{ maxWidth: "600px", width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: "4rem", marginBottom: "1.5rem" }}>✅</div>
        <h1 style={{ marginBottom: "1rem", fontSize: "2rem", color: "#1a1625", fontWeight: 700 }}>
          Assessment Submitted Successfully!
        </h1>
        <p style={{ color: "#6b6678", marginBottom: "2rem", fontSize: "1.125rem", lineHeight: 1.6 }}>
          Thank you for completing the assessment. Your responses have been recorded and submitted.
        </p>
        <div style={{ 
          backgroundColor: "#f0f9ff", 
          border: "1px solid #bae6fd", 
          borderRadius: "0.75rem", 
          padding: "1.5rem",
          marginBottom: "2rem"
        }}>
          <p style={{ color: "#0c4a6e", fontSize: "0.875rem", margin: 0 }}>
            You will be notified about your results via email once the assessment is evaluated.
          </p>
        </div>
        <p style={{ color: "#64748b", fontSize: "0.875rem" }}>
          You can now close this window.
        </p>
      </div>
    </div>
  );
}

