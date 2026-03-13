import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { devopsCandidateApi } from "@/lib/devops/api";
import { setGateContext } from "@/lib/gateContext";

function getCandidateUserId(
  candidate: Record<string, unknown> | undefined,
  fallbackEmail: string
): string {
  if (!candidate) return fallbackEmail;
  const userId = candidate.user_id;
  if (typeof userId === "string" && userId.trim()) return userId;
  const id = candidate.id;
  if (typeof id === "string" && id.trim()) return id;
  return fallbackEmail;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null) {
    const maybeResponse = (error as { response?: { data?: { message?: string; detail?: string } } }).response;
    if (maybeResponse?.data?.message) return maybeResponse.data.message;
    if (maybeResponse?.data?.detail) return maybeResponse.data.detail;
  }
  return "Verification failed. Please check your details and try again.";
}

export default function DevOpsEntryPage() {
  const router = useRouter();
  const testId = typeof router.query.id === "string" ? router.query.id : undefined;
  const token = typeof router.query.token === "string" ? router.query.token : undefined;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    setLoading(false);
  }, [router.isReady]);

  const handleVerify = async (event: FormEvent) => {
    event.preventDefault();
    if (!testId || !token) return;

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName || !cleanEmail) {
      setError("Please enter both name and email.");
      return;
    }

    try {
      setVerifying(true);
      setError(null);

      const result = await devopsCandidateApi.verifyCandidate(testId, token, cleanEmail, cleanName);
      if (!result?.verified) {
        setError("Candidate verification failed.");
        return;
      }

      sessionStorage.setItem("candidateEmail", cleanEmail);
      sessionStorage.setItem("candidateName", cleanName);
      const candidateUserId = getCandidateUserId(result.candidate, cleanEmail);
      sessionStorage.setItem("candidateUserId", candidateUserId);

      setGateContext({
        flowType: "devops",
        assessmentId: testId,
        token,
        candidateEmail: cleanEmail,
        candidateName: cleanName,
        candidateUserId,
        entryUrl: `/devops/tests/${testId}/entry?token=${encodeURIComponent(token)}`,
        finalTakeUrl: `/devops/tests/${testId}/take?token=${encodeURIComponent(token)}`,
      });

      await router.push(`/precheck/${testId}/${encodeURIComponent(token)}`);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!testId || !token) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 520, textAlign: "center" }}>
          <h1 style={{ marginBottom: "0.75rem" }}>Invalid test link</h1>
          <p>Please use the invitation URL shared with you.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "2rem",
        background: "linear-gradient(145deg, #e7f9ef 0%, #f6fbff 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#ffffff",
          border: "1px solid #cde8d8",
          borderRadius: "12px",
          padding: "2rem",
        }}
      >
        <h1 style={{ margin: 0, marginBottom: "0.5rem", color: "#114b2f" }}>DevOps Test Access</h1>
        <p style={{ marginTop: 0, marginBottom: "1.5rem", color: "#3f5f4f" }}>
          Enter the same candidate details used while invitation was added.
        </p>

        {error ? (
          <div
            style={{
              marginBottom: "1rem",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              padding: "0.75rem",
              borderRadius: "8px",
            }}
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleVerify} style={{ display: "grid", gap: "1rem" }}>
          <label style={{ display: "grid", gap: "0.4rem" }}>
            <span style={{ fontWeight: 600, color: "#1f2937" }}>Full Name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Enter your full name"
              style={{
                padding: "0.75rem",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "1rem",
              }}
            />
          </label>

          <label style={{ display: "grid", gap: "0.4rem" }}>
            <span style={{ fontWeight: 600, color: "#1f2937" }}>Email Address</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              style={{
                padding: "0.75rem",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                fontSize: "1rem",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={verifying}
            style={{
              marginTop: "0.5rem",
              background: "#0f766e",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              padding: "0.8rem 1rem",
              fontWeight: 600,
              cursor: verifying ? "not-allowed" : "pointer",
              opacity: verifying ? 0.7 : 1,
            }}
          >
            {verifying ? "Verifying..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
