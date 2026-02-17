import React, { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { getProviders, signIn } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import fastApiClient from "../../lib/fastapi";
import { validateEmailWithCommonTypos } from "../../lib/validation/email";
import { Eye, EyeOff, Brain, TrendingUp, BookOpen, Users, Code, BarChart3, FileText, Lightbulb, Mail, Lock, Building2, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

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

// Capability Card Component - Reusable card for showcasing product metrics
interface CapabilityCardProps {
  icon: React.ElementType<{ size?: number | string; className?: string; style?: React.CSSProperties }>;
  title: string;
  primaryMetric: string;
  secondaryLabel: string;
  trend?: string;
  progress?: number;
  modules?: { total: number; completed: number };
  scale?: number;
  zIndex: number;
  position: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  animationDelay: number;
  animationDuration: number;
  backgroundColor: string;
  iconColor: string;
  iconBg: string;
  opacity?: number;
  blur?: boolean;
}

function CapabilityCard({
  icon: Icon,
  title,
  primaryMetric,
  secondaryLabel,
  trend,
  progress,
  modules,
  scale = 1,
  zIndex,
  position,
  animationDelay,
  animationDuration,
  backgroundColor,
  iconColor,
  iconBg,
  opacity = 1,
  blur = false,
}: CapabilityCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="absolute will-change-transform"
      style={{
        ...position,
        zIndex: isHovered ? 50 : zIndex,
        opacity,
        filter: blur ? 'blur(2px)' : 'none',
        transition: 'z-index 0.3s ease-out',
        animation: `capabilityFloat ${animationDuration}s ease-in-out infinite`,
        animationDelay: `${animationDelay}s`,
      }}
    >
      <div
        className="rounded-2xl backdrop-blur-sm transition-all duration-300 cursor-default will-change-transform"
        style={{
          backgroundColor,
          width: '16rem',
          height: '20rem',
          padding: '1.5rem',
          boxShadow: isHovered
            ? '0 24px 48px rgba(30, 90, 59, 0.25), 0 8px 16px rgba(0, 0, 0, 0.1)'
            : '0 12px 24px rgba(30, 90, 59, 0.15), 0 4px 8px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.8)',
          transform: isHovered 
            ? `scale(${scale * 1.03}) translateY(-4px)` 
            : `scale(${scale})`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="h-full flex flex-col">
          {/* Header with Icon */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="rounded-full p-2 flex-shrink-0 transition-transform duration-300"
              style={{
                backgroundColor: iconBg,
                transform: isHovered ? 'scale(1.1) rotate(6deg)' : 'scale(1) rotate(0deg)',
              }}
            >
              <Icon size={18} style={{ color: iconColor }} />
            </div>
            <div className="text-xs font-bold uppercase tracking-wide" style={{ color: '#1E5A3B' }}>
              {title}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 flex flex-col justify-center">
            {/* Primary Metric */}
            <div className="text-4xl font-bold mb-1" style={{ color: '#1E5A3B' }}>
              {primaryMetric}
            </div>

            {/* Secondary Label */}
            <div className="text-xs mb-3" style={{ color: '#2D7A52' }}>
              {secondaryLabel}
            </div>

            {/* Trend Indicator */}
            {trend && (
              <div className="text-xs font-semibold mb-3" style={{ color: '#10b981' }}>
                {trend} ↗
              </div>
            )}

            {/* Progress Bar */}
            {progress !== undefined && (
              <div className="w-full h-2 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'rgba(30, 90, 59, 0.1)' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #C9F4D4 0%, #B0EFC0 100%)',
                  }}
                />
              </div>
            )}

            {/* Modules List */}
            {modules && (
              <div className="space-y-2">
                {Array.from({ length: modules.total }).map((_, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: idx < modules.completed ? '#C9F4D4' : 'rgba(30, 90, 59, 0.1)',
                      }}
                    >
                      {idx < modules.completed && (
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1E5A3B' }} />
                      )}
                    </div>
                    <div className="text-xs" style={{ color: '#2D7A52' }}>
                      Module {idx + 1}
                    </div>
                  </div>
                ))}
                <div className="text-xs font-semibold mt-2" style={{ color: '#1E5A3B' }}>
                  {modules.completed}/{modules.total} Complete
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Capability Panel Component - Product showcase panel
function CapabilityPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden"
      style={{
        height: '100vh',
        position: 'fixed',
        right: 0,
        top: 0,
      }}
      aria-hidden="true"
      tabIndex={-1}
    >
      {/* Background Gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(135deg, #C9F4D4 0%, #B0EFC0 40%, #FFFEC0 100%)',
          opacity: 0.9,
        }}
      />

      {/* Radial Glow behind primary card */}
      <div
        className="absolute"
        style={{
          top: '8%',
          left: '5%',
          width: '20rem',
          height: '24rem',
          background: 'radial-gradient(circle, rgba(201, 244, 212, 0.4) 0%, transparent 70%)',
          filter: 'blur(20px)',
          pointerEvents: 'none',
        }}
      />

      {/* Cards Container */}
      <div className="absolute inset-0">
        {/* AI Assessment - Primary, Largest */}
        <CapabilityCard
          icon={Brain}
          title="AI Assessment"
          primaryMetric="247"
          secondaryLabel="Assessments"
          trend="+12%"
          scale={1}
          zIndex={30}
          position={{ top: '8%', left: '5%' }}
          animationDelay={0}
          animationDuration={8}
          backgroundColor="#FFFFFF"
          iconColor="#1E5A3B"
          iconBg="#C9F4D4"
        />

        {/* Code Review - Top Right */}
        <CapabilityCard
          icon={Code}
          title="Code Review"
          primaryMetric="24"
          secondaryLabel="Reviews"
          scale={0.95}
          zIndex={28}
          position={{ top: '8%', right: '5%' }}
          animationDelay={0.3}
          animationDuration={7}
          backgroundColor="#FFFFFF"
          iconColor="#1E5A3B"
          iconBg="#C9F4D4"
          opacity={0.9}
        />

        {/* Capability Score - Top Background */}
        <CapabilityCard
          icon={TrendingUp}
          title="Capability Score"
          primaryMetric="87"
          secondaryLabel="Avg Score"
          progress={87}
          scale={0.9}
          zIndex={25}
          position={{ top: '15%', left: 'calc(50% - 7.2rem)' }}
          animationDelay={0.2}
          animationDuration={9}
          backgroundColor="#FFFEC0"
          iconColor="#92400E"
          iconBg="#FCD34D"
          opacity={0.85}
          blur={true}
        />

        {/* DSA Challenges - Bottom Right */}
        <CapabilityCard
          icon={Code}
          title="DSA Challenges"
          primaryMetric="89"
          secondaryLabel="Solved"
          scale={0.9}
          zIndex={26}
          position={{ bottom: '15%', right: '8%' }}
          animationDelay={0.8}
          animationDuration={6}
          backgroundColor="#FFFFFF"
          iconColor="#1E5A3B"
          iconBg="#C9F4D4"
          opacity={0.88}
        />

        {/* Learning Progress - Bottom Left */}
        <CapabilityCard
          icon={BookOpen}
          title="Learning Path"
          primaryMetric="2/3"
          secondaryLabel="Modules"
          modules={{ total: 3, completed: 2 }}
          scale={0.95}
          zIndex={27}
          position={{ bottom: '15%', left: '8%' }}
          animationDelay={0.4}
          animationDuration={7}
          backgroundColor="#D4E4F7"
          iconColor="#1E40AF"
          iconBg="#93C5FD"
          opacity={0.9}
        />
      </div>

      {/* Floating Animation Keyframes */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes capabilityFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-12px);
          }
        }
      `}} />
    </div>
  );
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showOrgId, setShowOrgId] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [orgIdFocused, setOrgIdFocused] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);

  const googleProvider = providers ? providers["google"] : undefined;
  const microsoftProvider = providers ? providers["azure-ad"] ?? providers["azuread"] : undefined;
  const callbackUrl = (router.query.callbackUrl as string) ?? "/employee/management";

  // Caps Lock detection
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.getModifierState && e.getModifierState("CapsLock")) {
        setCapsLockOn(true);
      } else {
        setCapsLockOn(false);
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    window.addEventListener("keyup", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      window.removeEventListener("keyup", handleKeyPress);
    };
  }, []);

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
      setTimeRemaining((prev: number | null) => {
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
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
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden" style={{ backgroundColor: "#E8FAF0" }}>
      {/* Left Panel - Login Form - Enhanced Contrast */}
      <div 
        className="w-full lg:w-1/2 h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-mint-200 scrollbar-track-white" 
        style={{ 
          backgroundColor: "#FFFFFF",
          scrollbarWidth: "thin",
          scrollbarColor: "#C9F4D4 #FFFFFF"
        }}
        id="signin-scroll-container"
      >
        <style dangerouslySetInnerHTML={{__html: `
          #signin-scroll-container {
            overflow-y: scroll !important;
          }
          #signin-scroll-container::-webkit-scrollbar {
            width: 10px;
            -webkit-appearance: none;
          }
          #signin-scroll-container::-webkit-scrollbar-track {
            background: #FFFFFF;
            border-left: 1px solid #E5E7EB;
          }
          #signin-scroll-container::-webkit-scrollbar-thumb {
            background: #C9F4D4;
            border-radius: 5px;
            border: 2px solid #FFFFFF;
          }
          #signin-scroll-container::-webkit-scrollbar-thumb:hover {
            background: #B0EFC0;
          }
        `}} />
        <div className="min-h-full flex items-center justify-center p-4 sm:p-6 md:p-6 lg:px-10 lg:py-8 xl:px-12 xl:py-10">
          <div className="w-full max-w-md lg:max-w-lg my-auto">
            {/* Aaptor Logo + Product Name */}
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

            {/* Welcome Heading - Enhanced Typography */}
            <div className="text-center mb-6 sm:mb-7 lg:mb-8">
              <h1 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 tracking-tight leading-tight" 
                style={{ color: "#1E5A3B", fontWeight: 700 }}
              >
                Welcome back
              </h1>
            </div>

            {!showVerification ? (
              <>
                {/* OAuth Buttons - Enhanced with Shadows */}
                {(googleProvider || microsoftProvider) && (
                  <div className="mb-6 sm:mb-7 lg:mb-8">
                    <p className="text-sm font-semibold mb-3 sm:mb-4 text-center" style={{ color: "#1E5A3B" }}>
                      Sign in with your work account
                    </p>
                    <div className="space-y-2.5 sm:space-y-3">
                    {googleProvider && (
                      <button
                        type="button"
                        onClick={() => {
                          setSsoLoading("google");
                          signIn("google", { callbackUrl });
                        }}
                        disabled={ssoLoading !== null}
                        aria-label="Sign in with Google"
                        className="w-full h-12 sm:h-14 px-4 rounded-xl border-2 flex items-center justify-center gap-3 font-semibold text-sm sm:text-base transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: "#FFFFFF",
                          color: "#1E5A3B",
                          borderColor: "#E5E7EB",
                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.07)",
                        }}
                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                          if (ssoLoading === null) {
                            e.currentTarget.style.backgroundColor = "#E8FAF0";
                            e.currentTarget.style.borderColor = "#C9F4D4";
                            e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";
                            e.currentTarget.style.boxShadow = "0 8px 12px rgba(0, 0, 0, 0.12)";
                          }
                        }}
                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.currentTarget.style.backgroundColor = "#FFFFFF";
                          e.currentTarget.style.borderColor = "#E5E7EB";
                          e.currentTarget.style.transform = "translateY(0) scale(1)";
                          e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.07)";
                        }}
                      >
                        {ssoLoading === "google" ? (
                          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#1E5A3B" }} />
                        ) : (
                          <div className="w-5 h-5">
                            <GoogleLogo />
                          </div>
                        )}
                        {ssoLoading === "google" ? "Connecting..." : "Continue with Google"}
                      </button>
                    )}
                    {microsoftProvider && (
                      <button
                        type="button"
                        onClick={() => {
                          setSsoLoading("microsoft");
                          signIn(microsoftProvider.id, { callbackUrl });
                        }}
                        disabled={ssoLoading !== null}
                        aria-label="Sign in with Microsoft"
                        className="w-full h-12 sm:h-14 px-4 rounded-xl border-2 flex items-center justify-center gap-3 font-semibold text-sm sm:text-base transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                        style={{
                          backgroundColor: "#FFFFFF",
                          color: "#1E5A3B",
                          borderColor: "#E5E7EB",
                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.07)",
                        }}
                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                          if (ssoLoading === null) {
                            e.currentTarget.style.backgroundColor = "#E8FAF0";
                            e.currentTarget.style.borderColor = "#C9F4D4";
                            e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";
                            e.currentTarget.style.boxShadow = "0 8px 12px rgba(0, 0, 0, 0.12)";
                          }
                        }}
                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                          e.currentTarget.style.backgroundColor = "#FFFFFF";
                          e.currentTarget.style.borderColor = "#E5E7EB";
                          e.currentTarget.style.transform = "translateY(0) scale(1)";
                          e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.07)";
                        }}
                      >
                        {ssoLoading === "microsoft" ? (
                          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#1E5A3B" }} />
                        ) : (
                          <div className="w-5 h-5">
                            <MicrosoftLogo />
                          </div>
                        )}
                        {ssoLoading === "microsoft" ? "Connecting..." : "Continue with Microsoft"}
                      </button>
                    )}
                  </div>
                  </div>
                )}

              {/* Divider - Enhanced */}
              {(googleProvider || microsoftProvider) && (
                <div className="flex items-center justify-center my-5 sm:my-6 lg:my-7">
                  <div className="flex-1 border-t" style={{ borderColor: "rgba(168, 232, 188, 0.3)" }}></div>
                  <span className="px-4 text-xs sm:text-sm uppercase tracking-wider font-medium" style={{ color: "#4A9A6A" }}>
                    or
                  </span>
                  <div className="flex-1 border-t" style={{ borderColor: "rgba(168, 232, 188, 0.3)" }}></div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                {/* Email Field - Floating Label */}
                <div>
                  <div className="relative">
                    <Mail className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 z-10" size={18} style={{ color: emailFocused || email ? "#4A9A6A" : "#9CA3AF" }} />
                    <label 
                      htmlFor="email" 
                      className={`absolute left-10 sm:left-12 transition-all duration-200 pointer-events-none ${
                        emailFocused || email 
                          ? "top-2 text-xs font-semibold" 
                          : "text-sm"
                      }`}
                      style={{ 
                        color: emailFocused || email ? "#2D7A52" : "#9CA3AF",
                        top: emailFocused || email ? "0.5rem" : "20px",
                        transform: emailFocused || email ? "none" : "none",
                        lineHeight: "1.5",
                        display: "flex",
                        alignItems: "center"
                      }}
                    >
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      value={email}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                      onFocus={() => setEmailFocused(true)}
                      onBlur={() => setEmailFocused(false)}
                      aria-label="Email address"
                      aria-required="true"
                      aria-invalid={error && error.toLowerCase().includes("email") ? "true" : "false"}
                      aria-describedby={error && error.toLowerCase().includes("email") ? "email-error" : undefined}
                      className="w-full h-14 sm:h-16 pt-5 pb-2 pl-10 sm:pl-12 pr-4 rounded-xl border-2 transition-all duration-200 focus:outline-none text-sm sm:text-base"
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderColor: error && error.toLowerCase().includes("email") ? "#EF4444" : (emailFocused ? "#C9F4D4" : "#D1D5DB"),
                        color: "#1E5A3B",
                        fontSize: "0.9375rem",
                        boxShadow: emailFocused ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
                      }}
                    />
                  </div>
                  {error && error.toLowerCase().includes("email") && (
                    <p id="email-error" className="mt-1.5 text-xs flex items-center gap-1.5" style={{ color: "#EF4444" }} role="alert">
                      <AlertCircle size={14} />
                      {error}
                    </p>
                  )}
                </div>

                {/* Password Field - Floating Label with Caps Lock */}
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 z-10" size={18} style={{ color: passwordFocused || password ? "#4A9A6A" : "#9CA3AF" }} />
                    <label 
                      htmlFor="password" 
                      className={`absolute left-10 sm:left-12 transition-all duration-200 pointer-events-none ${
                        passwordFocused || password 
                          ? "top-2 text-xs font-semibold" 
                          : "text-sm"
                      }`}
                      style={{ 
                        color: passwordFocused || password ? "#2D7A52" : "#9CA3AF",
                        top: passwordFocused || password ? "0.5rem" : "50%",
                        transform: passwordFocused || password ? "none" : "translateY(-50%)",
                        lineHeight: "1.5",
                        display: "flex",
                        alignItems: "center"
                      }}
                    >
                      Password
                    </label>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      value={password}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                      onFocus={() => setPasswordFocused(true)}
                      onBlur={() => setPasswordFocused(false)}
                      onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.getModifierState && e.getModifierState("CapsLock")) {
                          setCapsLockOn(true);
                        } else {
                          setCapsLockOn(false);
                        }
                      }}
                      aria-label="Password"
                      aria-required="true"
                      aria-invalid={error && error.toLowerCase().includes("password") ? "true" : "false"}
                      aria-describedby={error && error.toLowerCase().includes("password") ? "password-error" : undefined}
                      className="w-full h-14 sm:h-16 pt-5 pb-2 pl-10 sm:pl-12 pr-12 sm:pr-14 rounded-xl border-2 transition-all duration-200 focus:outline-none text-sm sm:text-base"
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderColor: error && error.toLowerCase().includes("password") ? "#EF4444" : (passwordFocused ? "#C9F4D4" : "#D1D5DB"),
                        color: "#1E5A3B",
                        fontSize: "0.9375rem",
                        boxShadow: passwordFocused ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 p-1.5 transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-mint-200 rounded"
                      style={{ color: "#4A9A6A" }}
                    >
                      {showPassword ? <EyeOff size={18} className="sm:w-5 sm:h-5" /> : <Eye size={18} className="sm:w-5 sm:h-5" />}
                    </button>
                  </div>
                  {capsLockOn && passwordFocused && (
                    <p className="mt-1.5 text-xs flex items-center gap-1.5" style={{ color: "#F59E0B" }} role="alert">
                      <AlertCircle size={14} />
                      Caps Lock is on
                    </p>
                  )}
                  {error && error.toLowerCase().includes("password") && (
                    <p id="password-error" className="mt-1.5 text-xs flex items-center gap-1.5" style={{ color: "#EF4444" }} role="alert">
                      <AlertCircle size={14} />
                      {error}
                    </p>
                  )}
                </div>

                {/* Organization ID Field - Hidden by Default */}
                {!showOrgId && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowOrgId(true)}
                      className="text-sm font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-mint-200 rounded px-2 py-1 transition-colors"
                      style={{ color: "#4A9A6A" }}
                      aria-label="Show organization ID field"
                    >
                      Are you an Organization Admin? Enter Org ID
                    </button>
                  </div>
                )}
                {showOrgId && (
                  <div className="animate-in slide-in-from-top-2 duration-200">
                    <div className="relative">
                      <Building2 className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 z-10" size={18} style={{ color: orgIdFocused || orgId ? "#4A9A6A" : "#9CA3AF" }} />
                      <label 
                        htmlFor="orgId" 
                        className={`absolute left-10 sm:left-12 transition-all duration-200 pointer-events-none ${
                          orgIdFocused || orgId 
                            ? "top-2 text-xs font-semibold" 
                            : "text-sm"
                        }`}
                        style={{ 
                          color: orgIdFocused || orgId ? "#2D7A52" : "#9CA3AF",
                          top: orgIdFocused || orgId ? "0.5rem" : "50%",
                          transform: orgIdFocused || orgId ? "none" : "translateY(-50%)",
                          lineHeight: "1.5",
                          display: "flex",
                          alignItems: "center"
                        }}
                      >
                        Organization ID
                      </label>
                      <input
                        id="orgId"
                        type="text"
                        value={orgId}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => setOrgId(event.target.value.toUpperCase().trim())}
                        onFocus={() => setOrgIdFocused(true)}
                        onBlur={() => setOrgIdFocused(false)}
                        placeholder=""
                        aria-label="Organization ID"
                        aria-describedby="orgId-help"
                        className="w-full h-14 sm:h-16 pt-5 pb-2 pl-10 sm:pl-12 pr-4 rounded-xl border-2 transition-all duration-200 focus:outline-none uppercase text-sm sm:text-base"
                        style={{
                          backgroundColor: "#FFFFFF",
                          borderColor: orgIdFocused ? "#C9F4D4" : "#D1D5DB",
                          color: "#1E5A3B",
                          fontSize: "0.9375rem",
                          boxShadow: orgIdFocused ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
                        }}
                      />
                    </div>
                    <p id="orgId-help" className="mt-1.5 text-xs" style={{ color: "#4A9A6A" }}>
                      Required for Organization Admins
                    </p>
                  </div>
                )}

                {/* Remember Me & Forgot Password - Enhanced */}
                <div className="flex items-center justify-between pt-1 sm:pt-2">
                  <label htmlFor="rememberMe" className="flex items-center cursor-pointer group">
                    <input
                      id="rememberMe"
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      aria-label="Remember me on this device"
                      className="mr-2 sm:mr-2.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded cursor-pointer transition-all focus:outline-none focus:ring-2 focus:ring-mint-200"
                      style={{
                        accentColor: "#C9F4D4",
                      }}
                    />
                    <span className="text-xs sm:text-sm transition-colors group-hover:opacity-80" style={{ color: "#2D7A52" }}>
                      Remember me
                    </span>
                  </label>
                  <Link
                    href="/auth/forgot-password"
                    className="text-xs sm:text-sm font-medium transition-all hover:underline focus:outline-none focus:ring-2 focus:ring-mint-200 rounded px-1"
                    style={{ color: "#1E5A3B" }}
                    aria-label="Reset your password"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#C9F4D4";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#1E5A3B";
                    }}
                  >
                    Forgot password?
                  </Link>
                </div>

                {/* General Error Message (for non-field-specific errors) */}
                {error && !error.toLowerCase().includes("email") && !error.toLowerCase().includes("password") && (
                  <div
                    className="p-3 sm:p-3.5 rounded-lg flex items-start gap-2"
                    style={{
                      backgroundColor: "#FEF2F2",
                      color: "#991B1B",
                      borderLeft: "4px solid #EF4444",
                      fontSize: "0.8125rem",
                    }}
                    role="alert"
                    aria-live="polite"
                  >
                    <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Sign In Button - Primary CTA - Most Dominant */}
                <button
                  type="submit"
                  disabled={loading}
                  aria-label="Sign in to your account"
                  aria-busy={loading}
                  className="w-full h-14 sm:h-16 rounded-xl font-bold text-base sm:text-lg transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2"
                  style={{
                    background: loading 
                      ? "linear-gradient(135deg, #B0EFC0 0%, #9DE8B0 100%)"
                      : "linear-gradient(135deg, #1E5A3B 0%, #2D7A52 100%)",
                    color: "#FFFFFF",
                    boxShadow: loading 
                      ? "0 4px 8px rgba(30, 90, 59, 0.2)"
                      : "0 8px 20px rgba(30, 90, 59, 0.3), 0 0 0 1px rgba(201, 244, 212, 0.1)",
                    fontWeight: 700,
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (!loading) {
                      e.currentTarget.style.background = "linear-gradient(135deg, #2D7A52 0%, #1E5A3B 100%)";
                      e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";
                      e.currentTarget.style.boxShadow = "0 12px 28px rgba(30, 90, 59, 0.4), 0 0 0 1px rgba(201, 244, 212, 0.2)";
                    }
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {
                    if (!loading) {
                      e.currentTarget.style.background = "linear-gradient(135deg, #1E5A3B 0%, #2D7A52 100%)";
                      e.currentTarget.style.transform = "translateY(0) scale(1)";
                      e.currentTarget.style.boxShadow = "0 8px 20px rgba(30, 90, 59, 0.3), 0 0 0 1px rgba(201, 244, 212, 0.1)";
                    }
                  }}
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    "Sign In"
                  )}
              </button>
              </form>

              {/* Sign Up Link - Enhanced */}
              <div className="mt-5 sm:mt-6 text-center">
                <p className="text-xs sm:text-sm" style={{ color: "#4A9A6A" }}>
                  Don&apos;t have an account?{" "}
                  <Link 
                    href="/auth/signup" 
                    className="font-semibold transition-all hover:underline"
                    style={{ color: "#1E5A3B" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = "#C9F4D4";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "#1E5A3B";
                    }}
                  >
                    Sign up
                  </Link>
                </p>
              </div>

              {/* Trust Signals Footer */}
              <div className="mt-6 sm:mt-8 pt-4 sm:pt-5 border-t text-center">
                <p className="text-xs text-gray-600 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                  <span className="font-medium" style={{ color: "#4A9A6A" }}>SSO</span>
                  <span style={{ color: "#9CA3AF" }}>•</span>
                  <span className="font-medium" style={{ color: "#4A9A6A" }}>SOC2</span>
                  <span style={{ color: "#9CA3AF" }}>•</span>
                  <span className="font-medium" style={{ color: "#4A9A6A" }}>ISO 27001</span>
                  <span style={{ color: "#9CA3AF" }}>•</span>
                  <span className="font-medium" style={{ color: "#4A9A6A" }}>GDPR Compliant</span>
                </p>
              </div>
              </>
            ) : (
              <div>
                <h2 className="text-2xl font-semibold mb-2" style={{ color: "#1E5A3B" }}>
                  Email Verification Required
                </h2>
                <p className="mb-6" style={{ color: "#2D7A52" }}>
                  We&apos;ve sent a verification code to <strong>{email}</strong>. Please enter the code below.
                </p>

              <label htmlFor="verificationCode" className="block text-sm font-semibold mb-2" style={{ color: "#2D7A52" }}>
                Verification Code
              </label>
              <input
                id="verificationCode"
                type="text"
                required
                maxLength={10}
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                  setVerificationCode(event.target.value.replace(/\D/g, ""));
                  if (codeExpired) {
                    setCodeExpired(false);
                  }
                }}
                className="w-full px-4 py-3 rounded-lg border text-center"
                style={{
                  backgroundColor: "#ffffff",
                  borderColor: "#A8E8BC",
                  color: "#1E5A3B",
                  fontSize: "1.125rem",
                  letterSpacing: "0.5rem",
                }}
              />

              {timeRemaining !== null && (
                <div className="mt-3 text-center mb-4">
                  {codeExpired ? (
                    <p className="text-sm font-medium" style={{ color: "#ef4444" }}>
                      Code expired. Please request a new code.
                    </p>
                  ) : (
                    <p className="text-sm" style={{ color: "#4A9A6A" }}>
                      Code expires in{" "}
                      <strong style={{ color: timeRemaining < 60 ? "#ef4444" : "#1E5A3B" }}>
                        {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, "0")}
                      </strong>
                    </p>
                  )}
                </div>
              )}

              {error && (
                <div
                  className="p-3 rounded-lg mb-4"
                  style={{
                    backgroundColor: "#fee2e2",
                    color: "#991b1b",
                    borderLeft: "4px solid #ef4444",
                    fontSize: "0.875rem",
                  }}
                  role="alert"
                >
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  className="flex-1 py-3 rounded-lg font-semibold transition-all duration-200 disabled:opacity-60"
                  style={{
                    backgroundColor: "#C9F4D4",
                    color: "#1E5A3B",
                  }}
                  onClick={handleVerifyCode}
                  disabled={verifyingCode || !verificationCode}
                >
                  {verifyingCode ? "Verifying..." : "Verify Code"}
                </button>
                <button
                  type="button"
                  className="px-6 py-3 rounded-lg font-semibold border-2 transition-all duration-200 disabled:opacity-60"
                  style={{
                    backgroundColor: "transparent",
                    color: "#2D7A52",
                    borderColor: "#B0EFC0",
                  }}
                  onClick={handleSendVerificationCode}
                  disabled={sendingCode}
                >
                  {sendingCode ? "Sending..." : "Resend"}
                </button>
              </div>

              <button
                type="button"
                className="w-full mt-3 py-3 rounded-lg font-semibold border-2 transition-all duration-200"
                style={{
                  backgroundColor: "transparent",
                  color: "#2D7A52",
                  borderColor: "#B0EFC0",
                }}
                onClick={() => {
                  setShowVerification(false);
                  setVerificationCode("");
                  setError(null);
                }}
              >
                Back to Sign In
              </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Capability Showcase - Hidden on Mobile */}
      <CapabilityPanel />
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
