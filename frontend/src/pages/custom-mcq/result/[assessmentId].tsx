import { useRouter } from "next/router";

export default function CustomMCQResultPage() {
  const router = useRouter();
  const { gradingStatus, isEvaluating } = router.query;

  const gradingStatusStr = gradingStatus as string || "completed";
  const isEvaluatingBool = isEvaluating === "true" || gradingStatusStr === "grading";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", backgroundColor: "#E8FAF0" }}>
      <div
        style={{
          maxWidth: "600px",
          width: "100%",
          padding: "3rem",
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          border: "1px solid #A8E8BC",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: "100px",
            height: "100px",
            borderRadius: "50%",
            backgroundColor: "#dcfce7",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 2rem",
            fontSize: "3rem",
          }}
        >
          ✓
        </div>

        <h1 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>
          {isEvaluatingBool ? "Test Submitted" : "Assessment Submitted"}
        </h1>

        <p style={{ marginBottom: "2rem", color: "#2D7A52", fontSize: "1.125rem" }}>
          {isEvaluatingBool 
            ? "Thank you for completing the assessment. Your submission has been received successfully. AI evaluation is in progress and results will be available shortly."
            : "Thank you for completing the assessment. Your submission has been received successfully."}
        </p>

        <p style={{ color: "#4A9A6A", fontSize: "0.875rem", marginBottom: "1.5rem" }}>
          Your assessment has been submitted successfully. You can close this page.
        </p>

        <button
          type="button"
          onClick={() => window.close()}
          className="btn-secondary"
          style={{ padding: "0.75rem 2rem" }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
