import { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import axios from "axios";
import { getProviders, signIn } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import fastApiClient from "../../lib/fastapi";
import { sortedCountryCodes, getCountryNameFromCode } from "../../lib/countryCodes";
import { validateEmailWithCommonTypos } from "../../lib/validation/email";

// Phone number validation based on country code
const validatePhoneNumber = (phone: string, countryCode: string): { valid: boolean; error?: string } => {
  const phoneDigits = phone.replace(/\D/g, "");
  
  if (!phoneDigits) {
    return { valid: false, error: "Phone number is required" };
  }

  // Common phone number length validations by country code
  const phoneRules: { [key: string]: { min: number; max: number; pattern?: RegExp } } = {
    "+1": { min: 10, max: 10 }, // US/Canada
    "+91": { min: 10, max: 10, pattern: /^[6-9]\d{9}$/ }, // India (starts with 6-9)
    "+44": { min: 10, max: 10 }, // UK
    "+86": { min: 11, max: 11 }, // China
    "+81": { min: 10, max: 11 }, // Japan
    "+49": { min: 10, max: 11 }, // Germany
    "+33": { min: 9, max: 9 }, // France
    "+39": { min: 9, max: 10 }, // Italy
    "+34": { min: 9, max: 9 }, // Spain
    "+61": { min: 9, max: 9 }, // Australia
    "+55": { min: 10, max: 11 }, // Brazil
    "+52": { min: 10, max: 10 }, // Mexico
    "+7": { min: 10, max: 10 }, // Russia
    "+82": { min: 9, max: 11 }, // South Korea
    "+65": { min: 8, max: 8 }, // Singapore
    "+971": { min: 9, max: 9 }, // UAE
    "+966": { min: 9, max: 9 }, // Saudi Arabia
  };

  const rule = phoneRules[countryCode];
  
  if (!rule) {
    // Default validation for countries not in the list
    if (phoneDigits.length < 7 || phoneDigits.length > 15) {
      return { valid: false, error: `Phone number format doesn't match ${getCountryNameFromCode(countryCode)}` };
    }
    return { valid: true };
  }

  // Check length
  if (phoneDigits.length < rule.min || phoneDigits.length > rule.max) {
    return { valid: false, error: `Phone number format doesn't match ${getCountryNameFromCode(countryCode)}` };
  }

  // Check pattern if available
  if (rule.pattern && !rule.pattern.test(phoneDigits)) {
    return { valid: false, error: `Phone number format doesn't match ${getCountryNameFromCode(countryCode)}` };
  }

  return { valid: true };
};

interface StatusMessage {
  type: "success" | "error";
  text: string;
}

interface SignupPageProps {
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

export default function SignupPage({ providers }: SignupPageProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [organization, setOrganization] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+91");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("India");
  const [phoneError, setPhoneError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<StatusMessage | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [codeExpired, setCodeExpired] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string>("");

  const googleProvider = providers ? providers["google"] : undefined;
  const microsoftProvider = providers ? providers["azure-ad"] ?? providers["azuread"] : undefined;
  
  // Get callback URL from query or default to dashboard
  const callbackUrl = (router.query.callbackUrl as string) ?? "/dashboard";

  const showMessage = (type: StatusMessage["type"], text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 6000);
  };

  // Check for OAuth redirect and pre-fill email
  useEffect(() => {
    const { email: emailParam, fromOAuth } = router.query;
    
    // Pre-fill email if coming from OAuth error
    if (emailParam && typeof emailParam === "string") {
      setEmail(emailParam);
    }
    
    // Show message if coming from OAuth attempt
    if (fromOAuth === "true") {
      showMessage(
        "success",
        "You attempted OAuth login. Please complete signup below, then you can use OAuth for future logins."
      );
      // Clean up URL
      router.replace("/auth/signup", undefined, { shallow: true });
    }
    
    // Check for OAuth errors in URL (from NextAuth callback)
    const error = router.query.error as string | undefined;
    if (error) {
      let errorMessage = "Authentication failed. Please try again.";
      if (error === "OAuthSignin") {
        errorMessage = "Error in OAuth sign-in process. Please try again.";
      } else if (error === "OAuthCallback") {
        errorMessage = "Error in OAuth callback. Please try again.";
      } else if (error === "OAuthCreateAccount") {
        errorMessage = "Could not create OAuth account. Please try again.";
      } else if (error === "EmailCreateAccount") {
        errorMessage = "Could not create email account. Please try again.";
      } else if (error === "Callback") {
        errorMessage = "Error in callback. Please try again.";
      } else if (error === "OAuthAccountNotLinked") {
        errorMessage = "This account is already linked to another provider. Please sign in with your original provider.";
      } else if (error === "EmailSignin") {
        errorMessage = "Error sending email. Please try again.";
      } else if (error === "CredentialsSignin") {
        errorMessage = "Invalid credentials. Please check your email and password.";
      } else if (error === "SessionRequired") {
        errorMessage = "Please sign in to access this page.";
      }
      showMessage("error", errorMessage);
      // Clean up URL
      router.replace("/auth/signup", undefined, { shallow: true });
    }
  }, [router.query, router]);

  // Set country based on default country code on mount
  useEffect(() => {
    setCountry(getCountryNameFromCode(phoneCountryCode));
  }, []);

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
    setMessage(null);
    setCodeExpired(false);
    try {
      const response = await axios.post("/api/auth/send-verification-code", { email });
      setMessage({ type: "success", text: "Verification code sent successfully" });
      setTimeRemaining(60);
    } catch (err: any) {
      console.error("Error sending verification code:", err);
      const errorMessage = err.response?.data?.message || err.message || "Failed to send verification code";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length < 4) {
      setMessage({ type: "error", text: "Please enter a valid 6-digit verification code" });
      return;
    }

    if (codeExpired) {
      setMessage({ type: "error", text: "Verification code has expired. Please request a new code." });
      return;
    }

    setVerifyingCode(true);
    setMessage(null);
    try {
      await axios.post("/api/auth/verify-email-code", {
        email,
        code: verificationCode,
      });
      
      // Mark email as verified
      setIsEmailVerified(true);
      setVerifiedEmail(email);
      setMessage({ type: "success", text: "Email verified successfully! Redirecting to sign in..." });
      
      // Store flag in sessionStorage to indicate post-signup redirect
      // This will be used by signin page to redirect to employee management after login
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('post_signup_verified', 'true');
        sessionStorage.setItem('verified_email', email);
      }
      
      // Redirect to signin page - user needs to login with their password
      // The signin page will handle redirect to employee management after successful login
      setTimeout(() => {
        router.push("/auth/signin?fromSignup=true");
      }, 1500);
    } catch (err: any) {
      let errorMessage = err.response?.data?.message || err.message || "Invalid verification code";
      
      if (errorMessage.toLowerCase().includes("expired") && !errorMessage.toLowerCase().includes("invalid")) {
        errorMessage = "Verification code has expired. Please request a new code.";
        setCodeExpired(true);
      } else if (errorMessage.includes("Invalid") || errorMessage.includes("invalid") || errorMessage.includes("incorrect")) {
        errorMessage = "Invalid verification code. Please check and try again.";
      } else if (errorMessage.includes("not found") || errorMessage.includes("User not found")) {
        errorMessage = "User not found. Please sign up again.";
      }
      
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setVerifyingCode(false);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const emailValidation = validateEmailWithCommonTypos(email);
    if (!emailValidation.valid) {
      showMessage("error", emailValidation.message);
      return;
    }
    
    // Validate phone number
    if (!phone.trim()) {
      setPhoneError("Phone number is required");
      showMessage("error", "Phone number is required");
      return;
    }

    const phoneValidation = validatePhoneNumber(phone, phoneCountryCode);
    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.error || "");
      showMessage("error", phoneValidation.error || "Invalid phone number format");
      return;
    }
    
    if (password !== confirmPassword) {
      showMessage("error", "Passwords do not match");
      return;
    }

    if (!organization.trim()) {
      showMessage("error", "Organization name is required");
      return;
    }

    try {
      setLoading(true);
      setMessage(null);
      setPhoneError("");
      const { data } = await axios.post("/api/auth/signup", {
        name,
        email,
        password,
        organization: organization.trim(),
        phone: phone.trim() ? `${phoneCountryCode} ${phone.trim()}` : undefined,
        country: country.trim() || undefined,
      });
      setShowVerification(true);
      setMessage({
        type: "success",
        text: "Please check your email for verification code.",
      });
      setTimeRemaining(60);
      setCodeExpired(false);
    } catch (error: any) {
      showMessage("error", error?.response?.data?.message ?? error?.message ?? "Signup failed");
    } finally {
      setLoading(false);
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
       

        <div className="card" style={{ padding: "1rem", maxHeight: "calc(100vh - 2rem)", overflowY: "auto" }}>
          {isEmailVerified ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <div
                style={{
                  backgroundColor: '#d1fae5',
                  borderLeft: '4px solid #10b981',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem',
                }}
              >
                <p style={{ margin: 0, color: '#065f46', fontSize: '0.875rem', fontWeight: 500 }}>
                  Email verified successfully! Redirecting to sign in...
                </p>
              </div>
            </div>
          ) : !showVerification ? (
            <>
              <form onSubmit={onSubmit} style={{ margin: 0 }}>
                <label htmlFor="name" style={{ fontSize: "0.8125rem", marginTop: 0, marginBottom: "0.25rem" }}>
                  Full Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  style={{ marginBottom: "0.5rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                />

                <label htmlFor="email" style={{ fontSize: "0.8125rem", marginTop: 0, marginBottom: "0.25rem" }}>
                  Work Email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  style={{ marginBottom: "0.5rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                />

                <label htmlFor="password" style={{ fontSize: "0.8125rem", marginTop: 0, marginBottom: "0.25rem" }}>
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  style={{ marginBottom: "0.5rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                />

                <label htmlFor="confirmPassword" style={{ fontSize: "0.8125rem", marginTop: 0, marginBottom: "0.25rem" }}>
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  style={{ marginBottom: "0.5rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                />

                <label htmlFor="organization" style={{ fontSize: "0.8125rem", marginTop: 0, marginBottom: "0.25rem" }}>
                  Organization Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  id="organization"
                  type="text"
                  required
                  value={organization}
                  onChange={(event) => setOrganization(event.target.value)}
                  placeholder="Enter your organization name"
                  style={{ marginBottom: "0.5rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem" }}
                />

                <label htmlFor="phone" style={{ fontSize: "0.8125rem", marginTop: 0, marginBottom: "0.25rem" }}>
                  Phone Number
                </label>
                <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                  <select
                    id="phoneCountryCode"
                    value={phoneCountryCode}
                    onChange={(event) => {
                      const selectedCode = event.target.value;
                      setPhoneCountryCode(selectedCode);
                      setCountry(getCountryNameFromCode(selectedCode));
                      // Re-validate phone number when country code changes
                      if (phone.trim()) {
                        const validation = validatePhoneNumber(phone, selectedCode);
                        if (!validation.valid) {
                          setPhoneError(validation.error || "");
                        } else {
                          setPhoneError("");
                        }
                      }
                    }}
                    style={{
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.875rem",
                      border: "1px solid #e8e0d0",
                      borderRadius: "0.5rem",
                      backgroundColor: "#ffffff",
                      cursor: "pointer",
                      width: "180px",
                    }}
                  >
                    {sortedCountryCodes.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.code} {country.country}
                      </option>
                    ))}
                  </select>
                  <input
                    id="phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(event) => {
                      const value = event.target.value.replace(/\D/g, "");
                      setPhone(value);
                      // Validate on change
                      if (value.trim()) {
                        const validation = validatePhoneNumber(value, phoneCountryCode);
                        if (!validation.valid) {
                          setPhoneError(validation.error || "");
                        } else {
                          setPhoneError("");
                        }
                      } else {
                        setPhoneError("");
                      }
                    }}
                    onBlur={() => {
                      if (phone.trim()) {
                        const validation = validatePhoneNumber(phone, phoneCountryCode);
                        if (!validation.valid) {
                          setPhoneError(validation.error || "");
                        } else {
                          setPhoneError("");
                        }
                      }
                    }}
                    placeholder="234 567 8900"
                    style={{
                      flex: 1,
                      padding: "0.5rem 0.75rem",
                      fontSize: "0.875rem",
                      border: phoneError ? "1px solid #ef4444" : "1px solid #e8e0d0",
                      borderRadius: "0.5rem",
                    }}
                  />
                </div>
                {phoneError && (
                  <div style={{ color: "#ef4444", fontSize: "0.75rem", marginTop: "-0.25rem", marginBottom: "0.5rem" }}>
                    {phoneError}
                  </div>
                )}

                <input
                  id="country"
                  type="hidden"
                  value={country}
                />

                {message && (
                  <div
                    className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}
                    style={{ marginTop: "0.5rem", marginBottom: "0.5rem", padding: "0.5rem", fontSize: "0.8125rem" }}
                  >
                    {message.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading || !phone.trim() || !organization.trim()}
                  style={{ 
                    width: "100%", 
                    marginTop: "0.25rem", 
                    padding: "0.625rem", 
                    fontSize: "0.875rem",
                    opacity: ((!phone.trim() || !organization.trim()) && !loading) ? 0.6 : 1,
                    cursor: ((!phone.trim() || !organization.trim()) && !loading) ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Submitting..." : "Sign Up"}
                </button>
              </form>

              <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid #e8e0d0" }}>
                <p style={{ color: "#6b6678", marginBottom: "0.5rem", fontSize: "0.8125rem", textAlign: "center" }}>
                  Or continue with
                </p>
                <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                  {googleProvider && (
                    <button
                      type="button"
                      onClick={() => signIn("google", { callbackUrl })}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        fontSize: "0.8125rem",
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
                      <GoogleLogo />
                      Continue with Google
                    </button>
                  )}
                  {microsoftProvider && (
                    <button
                      type="button"
                      onClick={() => signIn(microsoftProvider.id, { callbackUrl })}
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        fontSize: "0.8125rem",
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
            </>
          ) : (
            <div>
              <h2 style={{ marginTop: 0, marginBottom: "0.5rem", fontSize: "1.125rem", fontWeight: 600 }}>
                Email Verification Required
              </h2>
              <p style={{ color: "#6b6678", marginBottom: "0.75rem", fontSize: "0.8125rem" }}>
                We&apos;ve sent a verification code to <strong>{email}</strong>. Please enter the code below.
              </p>

              <label htmlFor="verificationCode" style={{ fontSize: "0.8125rem", marginTop: 0, marginBottom: "0.25rem" }}>
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
                  fontSize: "1rem",
                  letterSpacing: "0.5rem",
                  marginBottom: "0.5rem",
                  padding: "0.5rem 0.75rem",
                }}
              />

              {timeRemaining !== null && (
                <div style={{ marginTop: "0.25rem", textAlign: "center", marginBottom: "0.5rem" }}>
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

              {message && (
                <div
                  className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}
                  style={{ marginTop: "0.5rem", marginBottom: "0.5rem", padding: "0.5rem", fontSize: "0.8125rem" }}
                >
                  {message.text}
                </div>
              )}

              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleVerifyCode}
                  disabled={verifyingCode || !verificationCode}
                  style={{ flex: 1, padding: "0.625rem", fontSize: "0.875rem" }}
                >
                  {verifyingCode ? "Verifying..." : "Verify Code"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleSendVerificationCode}
                  disabled={sendingCode}
                  style={{ padding: "0.625rem", fontSize: "0.875rem" }}
                >
                  {sendingCode ? "Sending..." : "Resend"}
                </button>
              </div>
            </div>
          )}
        </div>

        {!showVerification && (
          <div style={{ marginTop: "0.75rem", textAlign: "center", color: "#6b6678" }}>
            <p style={{ fontSize: "0.8125rem", margin: 0 }}>
              Already have an account?{" "}
              <Link href="/auth/signin" style={{ color: "#6953a3", fontWeight: 600 }}>
                Sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps<SignupPageProps> = async () => {
  const providers = await getProviders();
  return {
    props: {
      providers,
    },
  };
};
