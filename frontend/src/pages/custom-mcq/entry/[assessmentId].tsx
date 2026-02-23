import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { customMCQApi } from "../../../lib/custom-mcq/api";
import { setGateContext } from "../../../lib/gateContext";

export default function CustomMCQEntryPage() {
  const router = useRouter();
  const { assessmentId, token } = router.query;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (assessmentId && token) {
      setLoading(false);
    }
  }, [assessmentId, token]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      setError("Please enter both name and email");
      return;
    }

    try {
      setVerifying(true);
      setError(null);

      const result = await customMCQApi.verifyCandidate(
        assessmentId as string,
        token as string,
        email.trim(),
        name.trim()
      );

      if (result.verified) {
        // Store candidate info in sessionStorage (shared gate + legacy custom-mcq take)
        sessionStorage.setItem("candidateEmail", email.trim().toLowerCase());
        sessionStorage.setItem("candidateName", name.trim());
        sessionStorage.setItem(
          `custom_mcq_${assessmentId}`,
          JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), token: token as string })
        );

        // Store gate routing context so shared gate can route to Custom MCQ take page
        setGateContext({
          flowType: "custom-mcq",
          assessmentId: assessmentId as string,
          token: token as string,
          candidateEmail: email.trim().toLowerCase(),
          candidateName: name.trim(),
          entryUrl: `/custom-mcq/entry/${assessmentId}?token=${encodeURIComponent(token as string)}`,
          finalTakeUrl: `/custom-mcq/take/${assessmentId}?token=${encodeURIComponent(token as string)}`,
        });

        // Redirect into unified gate
        router.push(`/precheck/${assessmentId}/${encodeURIComponent(token as string)}`);
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      // Extract error message from different possible structures
      const errorMessage = err.response?.data?.message || 
                          err.response?.data?.detail ||
                          err.message || 
                          "Verification failed. Please check your details and the assessment link.";
      setError(errorMessage);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (!assessmentId || !token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <h1>Invalid Assessment Link</h1>
          <p>Please check the assessment URL and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem", backgroundColor: "#E8FAF0" }}>
      <div
        style={{
          maxWidth: "500px",
          width: "100%",
          padding: "2rem",
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          border: "1px solid #A8E8BC",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h1 style={{ marginBottom: "1rem", color: "#1E5A3B", textAlign: "center" }}>Access Assessment</h1>
        <p style={{ marginBottom: "2rem", color: "#2D7A52", textAlign: "center" }}>
          Please enter your details to access the assessment
        </p>

        {error && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#fee2e2",
              border: "1px solid #ef4444",
              borderRadius: "0.5rem",
              color: "#991b1b",
              marginBottom: "1.5rem",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleVerify}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            <div>
              <label
                htmlFor="name"
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: 600,
                  color: "#1E5A3B",
                }}
              >
                Full Name <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter your full name"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #A8E8BC",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>

            <div>
              <label
                htmlFor="email"
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: 600,
                  color: "#1E5A3B",
                }}
              >
                Email Address <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email address"
                style={{
                  width: "100%",
                  padding: "0.75rem",
                  border: "1px solid #A8E8BC",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                }}
              />
            </div>

            <button
              type="submit"
              disabled={verifying}
              className="btn-primary"
              style={{
                width: "100%",
                padding: "0.75rem",
                fontSize: "1rem",
                fontWeight: 600,
              }}
            >
              {verifying ? "Verifying..." : "Continue to Assessment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

