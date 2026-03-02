import React, { useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import Link from "next/link";
import fastApiClient from "../../lib/fastapi";
import { validateEmailWithCommonTypos } from "../../lib/validation/email";
import { Mail, Building2, AlertCircle, CheckCircle2, Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [orgId, setOrgId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showOrgId, setShowOrgId] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [orgIdFocused, setOrgIdFocused] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const emailValidation = validateEmailWithCommonTypos(email);
    if (!emailValidation.valid) {
      setError(emailValidation.message);
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const payload: any = { email };
      if (orgId.trim()) {
        payload.org_id = orgId.trim().toUpperCase();
      }

      await fastApiClient.post("/api/v1/auth/forgot-password", payload);

      setSuccess(true);
      setLoading(false);
    } catch (err: any) {
      setLoading(false);
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to send reset email. Please try again.";
      setError(errorMessage);
    }
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
                Forgot Password?
              </h1>
              <p className="text-sm sm:text-base" style={{ color: "#4A9A6A" }}>
                Enter your email address and we'll send you a link to reset your password.
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
                      Reset link sent!
                    </p>
                    <p className="text-sm mt-1" style={{ color: "#047857" }}>
                      If an account with that email exists, a password reset link has been sent. Please check your email.
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
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#2D7A52";
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 8px 12px rgba(0, 0, 0, 0.15)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#1E5A3B";
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";
                  }}
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                {/* Email Input */}
                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-semibold mb-2"
                    style={{ color: "#1E5A3B" }}
                  >
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5"
                      style={{ color: emailFocused ? "#1E5A3B" : "#4A9A6A" }}
                    />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      required
                      placeholder="Enter your email"
                      className="w-full h-12 sm:h-14 pl-11 pr-4 rounded-xl border-2 text-sm sm:text-base transition-all focus:outline-none"
                      style={{
                        backgroundColor: "#FFFFFF",
                        color: "#1E5A3B",
                        borderColor: emailFocused ? "#1E5A3B" : "#C9F4D4",
                        boxShadow: emailFocused
                          ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)"
                          : "0 1px 3px rgba(0, 0, 0, 0.05)",
                      }}
                    />
                  </div>
                </div>

                {/* Organization ID Toggle */}
                <div className="flex items-center">
                  <label htmlFor="showOrgId" className="flex items-center cursor-pointer group">
                    <input
                      id="showOrgId"
                      type="checkbox"
                      checked={showOrgId}
                      onChange={(e) => setShowOrgId(e.target.checked)}
                      className="mr-2 sm:mr-2.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-mint-200"
                      style={{ accentColor: "#C9F4D4" }}
                    />
                    <span
                      className="text-xs sm:text-sm transition-colors group-hover:opacity-80"
                      style={{ color: "#2D7A52" }}
                    >
                      I'm an Organization Admin
                    </span>
                  </label>
                </div>

                {/* Organization ID Input */}
                {showOrgId && (
                  <div>
                    <label
                      htmlFor="orgId"
                      className="block text-sm font-semibold mb-2"
                      style={{ color: "#1E5A3B" }}
                    >
                      Organization ID
                    </label>
                    <div className="relative">
                      <Building2
                        className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5"
                        style={{ color: orgIdFocused ? "#1E5A3B" : "#4A9A6A" }}
                      />
                      <input
                        id="orgId"
                        type="text"
                        value={orgId}
                        onChange={(e) => setOrgId(e.target.value.toUpperCase())}
                        onFocus={() => setOrgIdFocused(true)}
                        onBlur={() => setOrgIdFocused(false)}
                        placeholder="Enter your Organization ID"
                        className="w-full h-12 sm:h-14 pl-11 pr-4 rounded-xl border-2 text-sm sm:text-base transition-all focus:outline-none uppercase"
                        style={{
                          backgroundColor: "#FFFFFF",
                          color: "#1E5A3B",
                          borderColor: orgIdFocused ? "#1E5A3B" : "#C9F4D4",
                          boxShadow: orgIdFocused
                            ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)"
                            : "0 1px 3px rgba(0, 0, 0, 0.05)",
                        }}
                      />
                    </div>
                    <p id="orgId-help" className="mt-1.5 text-xs" style={{ color: "#4A9A6A" }}>
                      Required for Organization Admins
                    </p>
                  </div>
                )}

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
                      Sending...
                    </span>
                  ) : (
                    "Send Reset Link"
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

      {/* Right Panel - Placeholder (matching signin page) */}
      <div className="hidden lg:flex lg:w-1/2 h-screen items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0" style={{ backgroundColor: "#E8FAF0" }} />
      </div>
    </div>
  );
}


