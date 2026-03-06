import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { signIn } from "next-auth/react";
import Image from "next/image";
import axios from "axios";
import { Shield, Mail, Key, AlertCircle, Loader2, ArrowLeft } from "lucide-react";

export default function MFAVerifyPage() {
  const router = useRouter();
  const { email, tempToken } = router.query;
  
  const [method, setMethod] = useState<"totp" | "email" | "backup">("totp");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [requestsRemaining, setRequestsRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Wait for router to be ready before checking parameters
    if (!router.isReady) {
      console.log("🔄 [MFA Verify] Router not ready yet, waiting...");
      return;
    }
    
    console.log("🔍 [MFA Verify] Router ready, checking parameters");
    console.log("🔍 [MFA Verify] Email:", email);
    console.log("🔍 [MFA Verify] TempToken:", tempToken ? "present" : "missing");
    
    if (!email || !tempToken) {
      console.log("❌ [MFA Verify] Missing email or tempToken, redirecting to signin");
      router.push("/auth/signin");
    } else {
      console.log("✅ [MFA Verify] Parameters valid, ready for verification");
    }
  }, [email, tempToken, router.isReady]);

  const verifyTOTP = async () => {
    if (code.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/mfa/verify-totp`,
        {
          email: email as string,
          code: code,
          temp_token: tempToken as string,
        }
      );
      
      const { accessToken, refreshToken, user } = response.data.data;
      
      console.log("✅ [MFA Verify] TOTP verification successful");
      
      // Store tokens in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        localStorage.setItem("user", JSON.stringify(user));
      }
      
      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("❌ [MFA Verify] TOTP verification error:", err);
      setError(err.response?.data?.detail || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const sendEmailOTP = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/mfa/send-email-otp`,
        {
          email: email as string,
          temp_token: tempToken as string,
        }
      );
      
      setEmailSent(true);
      setRequestsRemaining(response.data.data.requestsRemaining);
      setMethod("email");
      setCode("");
    } catch (err: any) {
      if (err.response?.status === 429) {
        setError("Too many requests. Please try again later.");
      } else {
        setError(err.response?.data?.detail || "Failed to send email code");
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyEmailOTP = async () => {
    if (code.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/mfa/verify-email-otp`,
        {
          email: email as string,
          code: code,
          temp_token: tempToken as string,
        }
      );
      
      const { accessToken, refreshToken, user } = response.data.data;
      
      console.log("✅ [MFA Verify] Email OTP verification successful");
      
      // Store tokens in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        localStorage.setItem("user", JSON.stringify(user));
      }
      
      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("❌ [MFA Verify] Email OTP verification error:", err);
      setError(err.response?.data?.detail || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const verifyBackupCode = async () => {
    if (code.length < 8) {
      setError("Please enter a valid backup code");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/mfa/verify-backup-code`,
        {
          email: email as string,
          code: code,
          temp_token: tempToken as string,
        }
      );
      
      const { accessToken, refreshToken, user, backupCodesRemaining } = response.data.data;
      
      console.log("✅ [MFA Verify] Backup code verification successful");
      
      // Store tokens in localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
        localStorage.setItem("user", JSON.stringify(user));
      }
      
      // Show warning if low on backup codes
      if (backupCodesRemaining < 3) {
        alert(`Warning: You have only ${backupCodesRemaining} backup codes remaining. Please generate new codes from your settings.`);
      }
      
      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("❌ [MFA Verify] Backup code verification error:", err);
      setError(err.response?.data?.detail || "Invalid or already used backup code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = () => {
    if (method === "totp") {
      verifyTOTP();
    } else if (method === "email") {
      verifyEmailOTP();
    } else if (method === "backup") {
      verifyBackupCode();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length >= 6) {
      handleVerify();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-mint-50 via-white to-mint-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/Aaptor%20Logo.png" alt="Aaptor" width={60} height={60} />
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Two-Factor Authentication
          </h1>
          <p className="text-text-secondary">
            {email}
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Method Selection */}
          {method === "totp" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-mint-100 rounded-full mb-4">
                  <Shield className="w-8 h-8 text-mint-200" />
                </div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">
                  Enter Verification Code
                </h2>
                <p className="text-text-secondary text-sm">
                  Open your authenticator app and enter the 6-digit code
                </p>
              </div>

              <div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(value);
                    setError(null);
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="000000"
                  className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-200 rounded-lg focus:border-mint-200 focus:outline-none"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <button
                onClick={handleVerify}
                disabled={loading || code.length !== 6}
                className="w-full py-3 bg-mint-200 text-white rounded-lg font-medium hover:bg-mint-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </button>

              <div className="space-y-2">
                <button
                  onClick={() => {
                    setMethod("email");
                    setCode("");
                    setError(null);
                  }}
                  className="w-full py-3 text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Use email code instead
                </button>
                <button
                  onClick={() => {
                    setMethod("backup");
                    setCode("");
                    setError(null);
                  }}
                  className="w-full py-3 text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-2"
                >
                  <Key className="w-4 h-4" />
                  Use backup code
                </button>
              </div>
            </div>
          )}

          {/* Email OTP Method */}
          {method === "email" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                  <Mail className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">
                  Email Verification
                </h2>
                <p className="text-text-secondary text-sm">
                  {emailSent
                    ? `We've sent a 6-digit code to ${email}`
                    : "We'll send a verification code to your email"}
                </p>
              </div>

              {!emailSent ? (
                <button
                  onClick={sendEmailOTP}
                  disabled={loading}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    "Send Code"
                  )}
                </button>
              ) : (
                <>
                  <div>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                        setCode(value);
                        setError(null);
                      }}
                      onKeyPress={handleKeyPress}
                      placeholder="000000"
                      className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-200 rounded-lg focus:border-blue-600 focus:outline-none"
                      maxLength={6}
                      autoFocus
                    />
                    <p className="text-xs text-text-subtle text-center mt-2">
                      Code expires in 10 minutes
                    </p>
                  </div>

                  <button
                    onClick={handleVerify}
                    disabled={loading || code.length !== 6}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Verify Code"
                    )}
                  </button>

                  <button
                    onClick={sendEmailOTP}
                    disabled={loading || requestsRemaining === 0}
                    className="w-full py-3 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {requestsRemaining !== null && requestsRemaining === 0
                      ? "No more requests available"
                      : "Resend Code"}
                  </button>
                </>
              )}

              <button
                onClick={() => {
                  setMethod("totp");
                  setCode("");
                  setError(null);
                  setEmailSent(false);
                }}
                className="w-full py-3 text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to authenticator
              </button>
            </div>
          )}

          {/* Backup Code Method */}
          {method === "backup" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mb-4">
                  <Key className="w-8 h-8 text-yellow-600" />
                </div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">
                  Use Backup Code
                </h2>
                <p className="text-text-secondary text-sm">
                  Enter one of your backup codes
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    Each backup code can only be used once. After using this code, you'll have one less backup code available.
                  </p>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
                    setCode(value);
                    setError(null);
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder="XXXX-XXXX"
                  className="w-full px-4 py-3 text-center text-xl font-mono tracking-wider border-2 border-gray-200 rounded-lg focus:border-yellow-600 focus:outline-none"
                  autoFocus
                />
              </div>

              <button
                onClick={handleVerify}
                disabled={loading || code.length < 8}
                className="w-full py-3 bg-yellow-600 text-white rounded-lg font-medium hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  "Verify Code"
                )}
              </button>

              <button
                onClick={() => {
                  setMethod("totp");
                  setCode("");
                  setError(null);
                }}
                className="w-full py-3 text-text-secondary hover:text-text-primary transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to authenticator
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-text-subtle">
            Having trouble?{" "}
            <a href="mailto:support@aaptor.com" className="text-mint-200 hover:underline">
              Contact support
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
