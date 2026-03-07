import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";
import fastApiClient from "../../lib/fastapi";
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { token } = router.query;
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [tokenValid, setTokenValid] = useState(false);

  // Password strength indicators
  const [passwordStrength, setPasswordStrength] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  useEffect(() => {
    if (token && typeof token === "string") {
      verifyToken(token);
    } else if (router.isReady && !token) {
      setVerifying(false);
      setError("Invalid reset link. Please request a new password reset.");
    }
  }, [token, router.isReady]);

  useEffect(() => {
    // Check password strength
    setPasswordStrength({
      length: newPassword.length >= 8,
      uppercase: /[A-Z]/.test(newPassword),
      lowercase: /[a-z]/.test(newPassword),
      number: /\d/.test(newPassword),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(newPassword),
    });
  }, [newPassword]);

  async function verifyToken(token: string) {
    try {
      const response = await fastApiClient.get("/api/v1/auth/verify-reset-token", {
        params: { token },
      });
      if (response.data?.success) {
        setTokenValid(true);
      } else {
        setError("Invalid or expired reset token. Please request a new password reset.");
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Invalid or expired reset token. Please request a new password reset.";
      setError(errorMessage);
      setTokenValid(false);
    } finally {
      setVerifying(false);
    }
  }

  function validatePassword(): string | null {
    if (newPassword.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(newPassword)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(newPassword)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/\d/.test(newPassword)) {
      return "Password must contain at least one number";
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return "Password must contain at least one special character";
    }
    if (newPassword !== confirmPassword) {
      return "Passwords do not match";
    }
    return null;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationError = validatePassword();
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!token || typeof token !== "string") {
      setError("Invalid reset token");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fastApiClient.post("/api/v1/auth/reset-password", {
        token,
        newPassword,
      });

      setSuccess(true);
      setLoading(false);

      // Always redirect to sign in after password reset
      // The login flow will handle MFA setup enforcement
      setTimeout(() => {
        router.push("/auth/signin");
      }, 2000);
    } catch (err: any) {
      setLoading(false);
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to reset password. Please try again.";
      setError(errorMessage);
    }
  }

  if (verifying) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "#E8FAF0" }}>
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: "#1E5A3B" }} />
          <p className="text-sm" style={{ color: "#4A9A6A" }}>
            Verifying reset token...
          </p>
        </div>
      </div>
    );
  }

  if (!tokenValid && !verifying) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ backgroundColor: "#E8FAF0" }}>
        <div className="w-full max-w-md p-6">
          <div
            className="p-4 rounded-lg flex items-start gap-3 mb-4"
            style={{ backgroundColor: "#FEE2E2", border: "1px solid #EF4444" }}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
            <div className="flex-1">
              <p className="text-sm font-medium" style={{ color: "#991B1B" }}>
                Invalid Reset Link
              </p>
              <p className="text-sm mt-1" style={{ color: "#991B1B" }}>
                {error || "This password reset link is invalid or has expired. Please request a new one."}
              </p>
            </div>
          </div>
          <Link
            href="/auth/forgot-password"
            className="block w-full h-12 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm transition-all duration-200 text-center"
            style={{
              backgroundColor: "#1E5A3B",
              color: "#FFFFFF",
              boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
            }}
          >
            Request New Reset Link
          </Link>
          <Link
            href="/auth/signin"
            className="block text-center mt-4 text-sm font-medium transition-all hover:underline"
            style={{ color: "#1E5A3B" }}
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden" style={{ backgroundColor: "#E8FAF0" }}>
      {/* Left Panel - Form */}
      <div
        className="w-full lg:w-1/2 h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-mint-200 scrollbar-track-white"
        style={{
          backgroundColor: "#FFFFFF",
          scrollbarWidth: "thin",
          scrollbarColor: "#C9F4D4 #FFFFFF",
        }}
      >
        <div className="min-h-full flex items-center justify-center p-4 sm:p-6 md:p-6 lg:px-10 lg:py-8 xl:px-12 xl:py-10">
          <div className="w-full max-w-md lg:max-w-lg my-auto">
            {/* Aaptor Logo */}
            <div className="mb-6 sm:mb-7 lg:mb-8 flex flex-col items-center">
              <div className="mb-3 sm:mb-4">
                <Image
                  src="/Aaptor%20Logo.png"
                  alt="Aaptor logo"
                  width={160}
                  height={70}
                  className="h-10 sm:h-14 lg:h-16 w-auto object-contain"
                  priority
                />
              </div>
            </div>

            {/* Heading */}
            <div className="text-center mb-6 sm:mb-7 lg:mb-8">
              <h1
                className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 tracking-tight leading-tight"
                style={{ color: "#1E5A3B", fontWeight: 700 }}
              >
                Reset Password
              </h1>
              <p className="text-sm sm:text-base" style={{ color: "#4A9A6A" }}>
                Enter your new password below.
              </p>
            </div>

            {success ? (
              <div className="space-y-4">
                <div
                  className="p-4 rounded-lg flex items-start gap-3"
                  style={{ backgroundColor: "#D1FAE5", border: "1px solid #10B981" }}
                >
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#10B981" }} />
                  <div className="flex-1">
                    <p className="text-sm font-medium" style={{ color: "#065F46" }}>
                      Password Reset Successful!
                    </p>
                    <p className="text-sm mt-1" style={{ color: "#047857" }}>
                      Your password has been reset. Redirecting to sign in...
                    </p>
                  </div>
                </div>
                <Link
                  href="/auth/signin"
                  className="w-full h-12 sm:h-14 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm sm:text-base transition-all duration-200"
                  style={{
                    backgroundColor: "#1E5A3B",
                    color: "#FFFFFF",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  Go to Sign In
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                {/* New Password Input */}
                <div>
                  <label
                    htmlFor="newPassword"
                    className="block text-sm font-semibold mb-2"
                    style={{ color: "#1E5A3B" }}
                  >
                    New Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5"
                      style={{ color: passwordFocused ? "#1E5A3B" : "#4A9A6A" }}
                    />
                    <input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      required
                      placeholder="Enter new password"
                      className="w-full h-12 sm:h-14 pl-11 pr-12 rounded-xl border-2 text-sm sm:text-base transition-all focus:outline-none"
                      style={{
                        backgroundColor: "#FFFFFF",
                        color: "#1E5A3B",
                        borderColor: passwordFocused ? "#1E5A3B" : "#C9F4D4",
                        boxShadow: passwordFocused
                          ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)"
                          : "0 1px 3px rgba(0, 0, 0, 0.05)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      style={{ color: "#4A9A6A" }}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-medium" style={{ color: "#1E5A3B" }}>
                        Password Requirements:
                      </p>
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span style={{ color: passwordStrength.length ? "#10B981" : "#6B7280" }}>
                            {passwordStrength.length ? "✓" : "○"}
                          </span>
                          <span style={{ color: passwordStrength.length ? "#10B981" : "#6B7280" }}>
                            At least 8 characters
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{ color: passwordStrength.uppercase ? "#10B981" : "#6B7280" }}>
                            {passwordStrength.uppercase ? "✓" : "○"}
                          </span>
                          <span style={{ color: passwordStrength.uppercase ? "#10B981" : "#6B7280" }}>
                            One uppercase letter
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{ color: passwordStrength.lowercase ? "#10B981" : "#6B7280" }}>
                            {passwordStrength.lowercase ? "✓" : "○"}
                          </span>
                          <span style={{ color: passwordStrength.lowercase ? "#10B981" : "#6B7280" }}>
                            One lowercase letter
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{ color: passwordStrength.number ? "#10B981" : "#6B7280" }}>
                            {passwordStrength.number ? "✓" : "○"}
                          </span>
                          <span style={{ color: passwordStrength.number ? "#10B981" : "#6B7280" }}>
                            One number
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span style={{ color: passwordStrength.special ? "#10B981" : "#6B7280" }}>
                            {passwordStrength.special ? "✓" : "○"}
                          </span>
                          <span style={{ color: passwordStrength.special ? "#10B981" : "#6B7280" }}>
                            One special character
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm Password Input */}
                <div>
                  <label
                    htmlFor="confirmPassword"
                    className="block text-sm font-semibold mb-2"
                    style={{ color: "#1E5A3B" }}
                  >
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5"
                      style={{ color: confirmPasswordFocused ? "#1E5A3B" : "#4A9A6A" }}
                    />
                    <input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      onFocus={() => setConfirmPasswordFocused(true)}
                      onBlur={() => setConfirmPasswordFocused(false)}
                      required
                      placeholder="Confirm new password"
                      className="w-full h-12 sm:h-14 pl-11 pr-12 rounded-xl border-2 text-sm sm:text-base transition-all focus:outline-none"
                      style={{
                        backgroundColor: "#FFFFFF",
                        color: "#1E5A3B",
                        borderColor:
                          confirmPassword && newPassword !== confirmPassword
                            ? "#EF4444"
                            : confirmPasswordFocused
                            ? "#1E5A3B"
                            : "#C9F4D4",
                        boxShadow: confirmPasswordFocused
                          ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)"
                          : "0 1px 3px rgba(0, 0, 0, 0.05)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                      style={{ color: "#4A9A6A" }}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="mt-1.5 text-xs" style={{ color: "#EF4444" }}>
                      Passwords do not match
                    </p>
                  )}
                </div>

                {/* Error Message */}
                {error && (
                  <div
                    className="p-3 sm:p-3.5 rounded-lg flex items-start gap-2"
                    style={{ backgroundColor: "#FEE2E2", border: "1px solid #EF4444" }}
                  >
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
                    <p className="text-sm" style={{ color: "#991B1B" }}>
                      {error}
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 sm:h-14 px-4 rounded-xl font-semibold text-sm sm:text-base transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: "#1E5A3B",
                    color: "#FFFFFF",
                    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  }}
                  onMouseEnter={(e) => {
                    if (!loading) {
                      e.currentTarget.style.backgroundColor = "#2D7A52";
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 8px 12px rgba(0, 0, 0, 0.15)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#1E5A3B";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
                  }}
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Resetting Password...
                    </span>
                  ) : (
                    "Reset Password"
                  )}
                </button>

                {/* Back to Sign In */}
                <div className="text-center">
                  <Link
                    href="/auth/signin"
                    className="text-sm font-medium transition-all hover:underline"
                    style={{ color: "#1E5A3B" }}
                  >
                    <ArrowLeft className="inline w-4 h-4 mr-1" />
                    Back to Sign In
                  </Link>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Placeholder */}
      <div className="hidden lg:flex lg:w-1/2 h-screen items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundColor: "#E8FAF0" }} />
      </div>
    </div>
  );
}


