import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function AuthErrorPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [isSignupRequired, setIsSignupRequired] = useState(false);

  useEffect(() => {
    const { error } = router.query;
    
    if (error) {
      const errorStr = error as string;
      
      // Check if this is an OAuth signup required error
      if (errorStr.includes("OAuthSignupRequired") || errorStr.includes("Account not found")) {
        setIsSignupRequired(true);
        
        // Extract email if available (format: OAuthSignupRequired:email:message)
        if (errorStr.includes(":")) {
          const parts = errorStr.split(":");
          if (parts.length >= 2) {
            setEmail(parts[1]);
          }
          if (parts.length >= 3) {
            setErrorMessage(parts.slice(2).join(":"));
          } else {
            setErrorMessage("Please sign up first before using OAuth login.");
          }
        } else {
          setErrorMessage("Please sign up first before using OAuth login.");
        }
      } else if (errorStr === "OAuthSignin") {
        setErrorMessage("Error in OAuth sign-in process. Please try again.");
      } else if (errorStr === "OAuthCallback") {
        setErrorMessage("Error in OAuth callback. Please try again.");
      } else if (errorStr === "OAuthAccountNotLinked") {
        setErrorMessage("This account is already linked to another provider. Please sign in with your original provider.");
      } else if (errorStr.includes("Email not verified")) {
        setErrorMessage("Email not verified. Please verify your email before signing in.");
      } else {
        setErrorMessage(errorStr || "An authentication error occurred. Please try again.");
      }
    }
  }, [router.query]);

  const handleGoToSignup = () => {
    // Redirect to signup with email pre-filled if available
    if (email) {
      router.push(`/auth/signup?email=${encodeURIComponent(email)}&fromOAuth=true`);
    } else {
      router.push("/auth/signup?fromOAuth=true");
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
      <div style={{ width: "100%", maxWidth: "500px" }}>
        <div className="card" style={{ padding: "2rem" }}>
          <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
            <h1 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.5rem", fontWeight: 600, color: "#1a1625" }}>
              Authentication Error
            </h1>
          </div>

          {isSignupRequired ? (
            <div>
              <div
                style={{
                  backgroundColor: "#fef3c7",
                  borderLeft: "4px solid #f59e0b",
                  padding: "1rem",
                  marginBottom: "1.5rem",
                  borderRadius: "0.5rem",
                }}
              >
                <p style={{ margin: 0, color: "#92400e", fontSize: "0.875rem", fontWeight: 500 }}>
                  <strong>OAuth Login Requires Prior Signup</strong>
                </p>
                <p style={{ margin: "0.5rem 0 0 0", color: "#78350f", fontSize: "0.8125rem" }}>
                  {errorMessage || "You need to create an account first before using Google or Microsoft login."}
                </p>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <p style={{ color: "#6b6678", fontSize: "0.875rem", lineHeight: "1.6" }}>
                  To use OAuth login (Google or Microsoft), you must first create an account using email and password. 
                  After completing signup and verifying your email, you'll be able to use OAuth for future logins.
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <button
                  onClick={handleGoToSignup}
                  className="btn-primary"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  Go to Sign Up Page
                </button>
                <Link
                  href="/auth/signin"
                  style={{
                    display: "block",
                    textAlign: "center",
                    color: "#6953a3",
                    fontSize: "0.875rem",
                    textDecoration: "none",
                    padding: "0.5rem",
                  }}
                >
                  Back to Sign In
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  backgroundColor: "#fee2e2",
                  borderLeft: "4px solid #ef4444",
                  padding: "1rem",
                  marginBottom: "1.5rem",
                  borderRadius: "0.5rem",
                }}
              >
                <p style={{ margin: 0, color: "#991b1b", fontSize: "0.875rem" }}>
                  {errorMessage || "An authentication error occurred."}
                </p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <Link
                  href="/auth/signin"
                  className="btn-primary"
                  style={{
                    display: "block",
                    textAlign: "center",
                    padding: "0.75rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Try Again
                </Link>
                <Link
                  href="/auth/signup"
                  style={{
                    display: "block",
                    textAlign: "center",
                    color: "#6953a3",
                    fontSize: "0.875rem",
                    textDecoration: "none",
                    padding: "0.5rem",
                  }}
                >
                  Create New Account
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

