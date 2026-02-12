import { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { getProviders, signIn } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import fastApiClient from "../../lib/fastapi";
import { validateEmailWithCommonTypos } from "../../lib/validation/email";

interface SignInPageProps {
  providers: Awaited<ReturnType<typeof getProviders>>;
}

// Google Logo SVG
const GoogleLogo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <g fill="#000" fillRule="evenodd">
      <path
        d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"
        fill="#EA4335"
      />
      <path
        d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.21 1.18-.84 2.08-1.79 2.71l2.85 2.2c2.01-1.86 3.17-4.57 3.17-7.41z"
        fill="#4285F4"
      />
      <path
        d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"
        fill="#FBBC05"
      />
      <path
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.85-2.2c-.76.53-1.78.9-3.11.9-2.38 0-4.4-1.57-5.12-3.74L.96 13.04C2.45 15.98 5.48 18 9 18z"
        fill="#34A853"
      />
    </g>
  </svg>
);

// Microsoft Logo SVG
const MicrosoftLogo = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
    <path fill="#F25022" d="M0 0h8.4v8.4H0z" />
    <path fill="#00A4EF" d="M9.6 0H18v8.4H9.6z" />
    <path fill="#7FBA00" d="M0 9.6h8.4V18H0z" />
    <path fill="#FFB900" d="M9.6 9.6H18V18H9.6z" />
  </svg>
);

export default function SignInPage({ providers }: SignInPageProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [codeExpired, setCodeExpired] = useState(false);

  const googleProvider = providers ? providers["google"] : undefined;
  const microsoftProvider = providers ? providers["azure-ad"] ?? providers["azuread"] : undefined;
  const callbackUrl = (router.query.callbackUrl as string) ?? "/employee/management";

  // Check for OAuth errors in URL
  useEffect(() => {
    const error = router.query.error as string | undefined;
    if (error && (error.includes("OAuthSignupRequired") || error.includes("Account not found"))) {
      // Redirect to error page which will handle the signup redirect
      router.push(`/auth/error?error=${encodeURIComponent(error)}`);
    }
  }, [router.query.error, router]);

  // Countdown timer effect
  useEffect(() => {
    if (!showVerification || timeRemaining === null) return;

    if (timeRemaining <= 0) {
      setCodeExpired(true);
      setTimeRemaining(0);
      return;
    }

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          setCodeExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showVerification, timeRemaining]);

  const handleSendVerificationCode = async () => {
    setSendingCode(true);
    setError(null);
    setCodeExpired(false);
    try {
      await axios.post("/api/auth/send-verification-code", { email });
      setError(null);
      setTimeRemaining(60);
    } catch (err: any) {
      let errorMessage = err.response?.data?.message || err.message || "Failed to send verification code";
      setError(errorMessage);
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length < 4) {
      setError("Please enter a valid 6-digit verification code");
      return;
    }

    if (codeExpired) {
      setError("Verification code has expired. Please request a new code.");
      return;
    }

    setVerifyingCode(true);
    setError(null);
    try {
      await axios.post("/api/auth/verify-email-code", {
        email,
        code: verificationCode,
      });
      setShowVerification(false);
      await handleSubmitAfterVerification();
    } catch (err: any) {
      let errorMessage = err.response?.data?.message || err.message || "Invalid verification code";
      
      if (errorMessage.toLowerCase().includes("expired") && !errorMessage.toLowerCase().includes("invalid")) {
        errorMessage = "Verification code has expired. Please request a new code.";
        setCodeExpired(true);
      } else if (errorMessage.includes("Invalid") || errorMessage.includes("invalid") || errorMessage.includes("incorrect")) {
        errorMessage = "Invalid verification code. Please check and try again.";
      } else if (errorMessage.includes("not found") || errorMessage.includes("User not found")) {
        errorMessage = "User not found. Please sign up first.";
      }
      
      setError(errorMessage);
    } finally {
      setVerifyingCode(false);
    }
  };

  const handleSubmitAfterVerification = async () => {
    setLoading(true);
    setError(null);

    const signInPayload: any = {
      redirect: false,
      email,
      password,
      callbackUrl,
    };
    
    // Add org_id if provided
    if (orgId.trim()) {
      signInPayload.org_id = orgId.trim().toUpperCase();
    }
    
    const result = await signIn("credentials", signInPayload);

    setLoading(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    // Check if this is a post-signup login
    const isPostSignup = router.query.fromSignup === 'true' || 
                        (typeof window !== 'undefined' && sessionStorage.getItem('post_signup_verified') === 'true');
    
    // Clear the flag
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('post_signup_verified');
      sessionStorage.removeItem('verified_email');
    }
    
    // Always redirect to employee management page after successful login
    window.location.replace("/employee/management");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const emailValidation = validateEmailWithCommonTypos(email);
    if (!emailValidation.valid) {
      setError(emailValidation.message);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First check if MFA is required by calling backend directly
      const loginPayload: any = {
        email,
        password,
      };
      
      // Add org_id if provided (required for org_admin users)
      if (orgId.trim()) {
        loginPayload.org_id = orgId.trim().toUpperCase();
      }
      
      const loginResponse = await fastApiClient.post("/api/v1/auth/login", loginPayload);

      // Check if MFA is required - check multiple possible response structures
      const responseData = loginResponse.data;
      const requireMfa = responseData?.data?.require_mfa || responseData?.require_mfa;
      
      if (requireMfa) {
        // Store email for MFA page
        if (typeof window !== "undefined") {
          sessionStorage.setItem("super_admin_email", email);
          // Use window.location for immediate redirect to prevent any code execution after
          window.location.href = `/super-admin/mfa?email=${encodeURIComponent(email)}`;
        }
        setLoading(false);
        return; // IMPORTANT: Return early to prevent NextAuth call
      }

      // If no MFA required, proceed with normal NextAuth signin
      const signInPayload: any = {
        redirect: false,
        email,
        password,
        callbackUrl,
      };
      
      // Add org_id if provided
      if (orgId.trim()) {
        signInPayload.org_id = orgId.trim().toUpperCase();
      }
      
      const result = await signIn("credentials", signInPayload);

      setLoading(false);

      if (result?.error) {
        if (result.error.includes("Email not verified") || result.error.includes("email verification")) {
          setShowVerification(true);
          setTimeRemaining(60);
          setCodeExpired(false);
          await handleSendVerificationCode();
        } else {
          setError(result.error);
        }
        return;
      }

      // Clear any post-signup flags if they exist
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('post_signup_verified');
        sessionStorage.removeItem('verified_email');
      }
      
      // Redirect to employee management page after successful login
      window.location.replace("/employee/management");
    } catch (err: any) {
      setLoading(false);
      
      // Check if the error response contains require_mfa (in case axios throws an error)
      const errorData = err?.response?.data;
      const requireMfaFromError = errorData?.data?.require_mfa || errorData?.require_mfa;
      
      if (requireMfaFromError) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("super_admin_email", email);
          window.location.href = `/super-admin/mfa?email=${encodeURIComponent(email)}`;
        }
        return; // IMPORTANT: Return early to prevent NextAuth call
      }

      // Check for backend connection errors
      if (err?.code === "ECONNREFUSED" || err?.code === "ENOTFOUND" || err?.message?.includes("not found")) {
        setError("Cannot connect to API Gateway. Please ensure the gateway is running on http://localhost:80");
        return; // Don't try NextAuth if backend is down
      }

      // For other errors, try NextAuth as fallback
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl,
      });

      if (result?.error) {
        if (result.error.includes("Email not verified") || result.error.includes("email verification")) {
          setShowVerification(true);
          setTimeRemaining(60);
          setCodeExpired(false);
          await handleSendVerificationCode();
        } else {
          const errorMessage = err?.response?.data?.detail || err?.response?.data?.message || err?.message || result.error;
          setError(errorMessage);
        }
        return;
      }

      // Check if this is a post-signup login
      const isPostSignup = router.query.fromSignup === 'true' || 
                          (typeof window !== 'undefined' && sessionStorage.getItem('post_signup_verified') === 'true');
      
      // Clear the flag
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('post_signup_verified');
        sessionStorage.removeItem('verified_email');
      }
      
      // Always redirect to employee management page after successful login
      window.location.replace("/employee/management");
    }
  };

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
          {!showVerification ? (
            <form onSubmit={handleSubmit} style={{ margin: 0 }}>
              <label htmlFor="email" style={{ fontSize: "0.8125rem", marginTop: 0, marginBottom: "0.375rem" }}>
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={{ marginBottom: "0.75rem", padding: "0.625rem 0.75rem", fontSize: "0.875rem" }}
              />

              <label htmlFor="password" style={{ fontSize: "0.8125rem", marginTop: 0, marginBottom: "0.375rem" }}>
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                style={{ marginBottom: "0.75rem", padding: "0.625rem 0.75rem", fontSize: "0.875rem" }}
              />

              <label htmlFor="orgId" style={{ fontSize: "0.8125rem", marginTop: 0, marginBottom: "0.375rem" }}>
                Organization ID <span style={{ color: "#6b6678", fontSize: "0.75rem" }}>(Required for Organization Admins)</span>
              </label>
              <input
                id="orgId"
                type="text"
                value={orgId}
                onChange={(event) => setOrgId(event.target.value.toUpperCase().trim())}
                placeholder="ORG001"
                style={{ marginBottom: "0.75rem", padding: "0.625rem 0.75rem", fontSize: "0.875rem", textTransform: "uppercase" }}
              />

              {/* Informational banner about OAuth requirement */}
              {(googleProvider || microsoftProvider) && (
                <div
                  style={{
                    backgroundColor: "#eff6ff",
                    borderLeft: "4px solid #3b82f6",
                    padding: "0.75rem",
                    marginBottom: "0.75rem",
                    borderRadius: "0.25rem",
                  }}
                >
                  <p style={{ margin: 0, color: "#1e40af", fontSize: "0.75rem", lineHeight: "1.5" }}>
                    <strong>Note:</strong> OAuth login (Google/Microsoft) requires prior signup. 
                    Please create an account first if you haven't already.
                  </p>
                </div>
              )}

              {error && (
                <div className="alert alert-error" role="alert" style={{ marginTop: "0.75rem", marginBottom: "0.75rem", padding: "0.75rem", fontSize: "0.8125rem" }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
                style={{ width: "100%", marginTop: "0.5rem", padding: "0.75rem", fontSize: "0.875rem" }}
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          ) : (
            <div>
              <h2 style={{ marginTop: 0, marginBottom: "0.75rem", fontSize: "1.25rem", fontWeight: 600 }}>
                Email Verification Required
              </h2>
              <p style={{ color: "#6b6678", marginBottom: "1rem", fontSize: "0.8125rem" }}>
                We&apos;ve sent a verification code to <strong>{email}</strong>. Please enter the code below.
              </p>

              <label htmlFor="verificationCode" style={{ fontSize: "0.8125rem", marginTop: 0, marginBottom: "0.375rem" }}>
                Verification Code
              </label>
              <input
                id="verificationCode"
                type="text"
                required
                maxLength={10}
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(event) => {
                  setVerificationCode(event.target.value.replace(/\D/g, ""));
                  if (codeExpired) {
                    setCodeExpired(false);
                  }
                }}
                style={{
                  textAlign: "center",
                  fontSize: "1.125rem",
                  letterSpacing: "0.5rem",
                  marginBottom: "0.5rem",
                  padding: "0.625rem 0.75rem",
                }}
              />

              {timeRemaining !== null && (
                <div style={{ marginTop: "0.5rem", textAlign: "center", marginBottom: "0.75rem" }}>
                  {codeExpired ? (
                    <p style={{ color: "#ef4444", fontSize: "0.75rem", fontWeight: 500 }}>
                      Code expired. Please request a new code.
                    </p>
                  ) : (
                    <p style={{ color: "#6b6678", fontSize: "0.75rem" }}>
                      Code expires in{" "}
                      <strong style={{ color: timeRemaining < 60 ? "#ef4444" : "#6953a3" }}>
                        {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
                      </strong>
                    </p>
                  )}
                </div>
              )}

              {error && (
                <div className="alert alert-error" role="alert" style={{ marginTop: "0.75rem", marginBottom: "0.75rem", padding: "0.75rem", fontSize: "0.8125rem" }}>
                  {error}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleVerifyCode}
                  disabled={verifyingCode || !verificationCode}
                  style={{ flex: 1, padding: "0.75rem", fontSize: "0.875rem" }}
                >
                  {verifyingCode ? "Verifying..." : "Verify Code"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleSendVerificationCode}
                  disabled={sendingCode}
                  style={{ padding: "0.75rem", fontSize: "0.875rem" }}
                >
                  {sendingCode ? "Sending..." : "Resend"}
                </button>
              </div>

              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setShowVerification(false);
                  setVerificationCode("");
                  setError(null);
                }}
                style={{ width: "100%", marginTop: "0.5rem", padding: "0.75rem", fontSize: "0.875rem" }}
              >
                Back to Sign In
              </button>
            </div>
          )}

          {!showVerification && (
            <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: "1px solid #e8e0d0" }}>
              <p style={{ color: "#6b6678", marginBottom: "0.75rem", fontSize: "0.8125rem", textAlign: "center" }}>
                Or continue with
              </p>
              <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                {googleProvider && (
                  <button
                    type="button"
                    onClick={() => signIn("google", { callbackUrl })}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.75rem",
                      fontSize: "0.875rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      backgroundColor: "#ffffff",
                      color: "#1a1625",
                      border: "1px solidrgb(216, 165, 63)",
                      borderRadius: "0.5rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background-color 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8f8f8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                  >
                    <GoogleLogo />
                    Continue with a Google
                  </button>
                )}
                {microsoftProvider && (
                  <button
                    type="button"
                    onClick={() => signIn(microsoftProvider.id, { callbackUrl })}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.75rem",
                      fontSize: "0.875rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.5rem",
                      backgroundColor: "#ffffff",
                      color: "#1a1625",
                      border: "1px solid #e8e0d0",
                      borderRadius: "0.5rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background-color 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8f8f8";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#ffffff";
                    }}
                  >
                    <MicrosoftLogo />
                    Continue with Microsoft
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {!showVerification && (
          <div style={{ marginTop: "1rem", textAlign: "center", color: "#6b6678" }}>
            <p style={{ fontSize: "0.8125rem", margin: 0 }}>
              Don&apos;t have an account?{" "}
              <Link href="/auth/signup" style={{ color: "#6953a3", fontWeight: 600 }}>
                Sign up
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<SignInPageProps> = async () => {
  const providers = await getProviders();
  return {
    props: {
      providers,
    },
  };
};
