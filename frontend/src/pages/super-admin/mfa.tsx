import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import Link from "next/link";
import fastApiClient from "../../lib/fastapi";

export default function SuperAdminMFAPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");

  useEffect(() => {
    // Get email from query params or session storage
    const emailParam = router.query.email as string;
    const storedEmail = typeof window !== "undefined" ? sessionStorage.getItem("super_admin_email") : null;
    const emailToUse = emailParam || storedEmail || "";

    if (!emailToUse) {
      router.push("/auth/signin");
      return;
    }

    setEmail(emailToUse);
    if (typeof window !== "undefined") {
      sessionStorage.setItem("super_admin_email", emailToUse);
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!code || code.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);

    try {
      // Verify MFA code - use fastApiClient to hit backend directly
      const response = await fastApiClient.post("/api/v1/super-admin/verify-mfa", {
        email,
        code,
      });

      const responseData = response.data;
      const data = responseData?.data;
      
      if (!data || !data.token || !data.user) {
        setError("Invalid response from server");
        setLoading(false);
        return;
      }

      // Sign in with NextAuth using the MFA-verified token
      const result = await signIn("credentials", {
        redirect: false,
        email: data.user.email,
        password: "", // Not needed for MFA flow
        mfaToken: data.token,
        refreshToken: data.refreshToken,
        callbackUrl: "/super-admin/dashboard",
      });

      if (result?.error) {
        setError(result.error);
        setLoading(false);
        return;
      }

      // Redirect to dashboard
      window.location.href = "/super-admin/dashboard";
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.response?.data?.message || err?.message || "MFA verification failed";
      setError(errorMessage);
      setLoading(false);
    }
  };

  if (!email) {
    return null; // Will redirect
  }

  return (
    <div
      style={{
        backgroundColor: "#f1dcba",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px" }}>
        <div className="card" style={{ padding: "1.5rem" }}>
          <h2 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.25rem", fontWeight: 600 }}>
            Multi-Factor Authentication
          </h2>
          <p style={{ color: "#6b6678", marginBottom: "1rem", fontSize: "0.8125rem" }}>
            Enter the 6-digit code from your authenticator app for <strong>{email}</strong>
          </p>

          <form onSubmit={handleSubmit}>
            <label htmlFor="code" style={{ fontSize: "0.8125rem", marginTop: 0, marginBottom: "0.375rem" }}>
              Authentication Code
            </label>
            <input
              id="code"
              type="text"
              required
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setCode(value);
              }}
              style={{
                textAlign: "center",
                fontSize: "1.125rem",
                letterSpacing: "0.5rem",
                marginBottom: "0.5rem",
                padding: "0.625rem 0.75rem",
                width: "100%",
              }}
              autoFocus
            />

            {error && (
              <div
                className="alert alert-error"
                role="alert"
                style={{ marginTop: "0.75rem", marginBottom: "0.75rem", padding: "0.75rem", fontSize: "0.8125rem" }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || code.length !== 6}
              style={{ width: "100%", marginTop: "0.5rem", padding: "0.75rem", fontSize: "0.875rem" }}
            >
              {loading ? "Verifying..." : "Verify Code"}
            </button>
          </form>

          <Link
            href="/auth/signin"
            style={{
              display: "block",
              textAlign: "center",
              marginTop: "1rem",
              color: "#6953a3",
              fontSize: "0.8125rem",
              textDecoration: "none",
            }}
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

