import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import Link from "next/link";

export default function CandidateEntryPage() {
  const router = useRouter();
  const { id, token, email: urlEmail, name: urlName } = router.query;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Auto-fill email and name from URL parameters if present (from invitation email)
  useEffect(() => {
    if (router.isReady) {
      if (urlEmail && typeof urlEmail === "string") {
        setEmail(decodeURIComponent(urlEmail));
      }
      if (urlName && typeof urlName === "string") {
        setName(decodeURIComponent(urlName));
      }
    }
  }, [router.isReady, urlEmail, urlName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim() || !name.trim()) {
      setError("Please enter both email and name");
      return;
    }

    setLoading(true);
    setError(null);

    console.log("[Entry] ========== VERIFICATION START ==========");
    console.log("[Entry] Request payload:", {
      assessmentId: id,
      token,
      email: email.trim(),
      name: name.trim(),
    });

    try {
      const response = await axios.post("/api/assessment/verify-candidate", {
        assessmentId: id,
        token,
        email: email.trim(),
        name: name.trim(),
      });

      console.log("[Entry] ========== VERIFICATION RESPONSE ==========");
      console.log("[Entry] Response status:", response.status);
      console.log("[Entry] Response data:", response.data);
      console.log("[Entry] Response success?", response.data?.success);

      if (response.data?.success) {
        console.log("[Entry] ✅ Verification successful - redirecting to precheck");
        // Store candidate info in sessionStorage
        sessionStorage.setItem("candidateEmail", email.trim());
        sessionStorage.setItem("candidateName", name.trim());
        // Redirect to new precheck flow
        router.push(`/precheck/${id}/${token}`);
      } else {
        console.log("[Entry] ❌ Verification failed - no success flag");
        setError(response.data?.message || "Invalid credentials");
      }
    } catch (err: any) {
      // Extract error message from different possible response structures
      const errorMessage = err.response?.data?.detail || 
                          err.response?.data?.message || 
                          err.message || 
                          "Failed to verify. Please check your email and name.";
      
      console.error("[Entry] ========== VERIFICATION ERROR ==========");
      console.error("[Entry] Error status:", err.response?.status);
      console.error("[Entry] Error statusText:", err.response?.statusText);
      console.error("[Entry] Error data:", err.response?.data);
      console.error("[Entry] Error message:", errorMessage);
      console.error("[Entry] Full error object:", err);
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      console.log("[Entry] ==========================================");
    }
  };

  return (
    <div style={{ backgroundColor: "#f1dcba", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
      <div className="card" style={{ maxWidth: "500px", width: "100%" }}>
        <h1 style={{ marginBottom: "0.5rem", fontSize: "2rem", color: "#1a1625", fontWeight: 700, textAlign: "center" }}>
          Assessment Entry
        </h1>
        <p style={{ color: "#6b6678", marginBottom: "2rem", fontSize: "1rem", textAlign: "center" }}>
          Please enter your email and name to access the assessment
        </p>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
              Email *
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.5rem",
                fontSize: "1rem",
              }}
            />
          </div>

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              required
              style={{
                width: "100%",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.5rem",
                fontSize: "1rem",
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !email.trim() || !name.trim()}
            style={{ width: "100%", marginTop: "1rem" }}
          >
            {loading ? "Verifying..." : "Continue to Assessment"}
          </button>
        </form>
      </div>
    </div>
  );
}

