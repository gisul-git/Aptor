import React, { useState, useEffect } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { getProviders, signIn } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import axios from "axios";
import fastApiClient from "../../lib/fastapi";
import { sortedCountryCodes, getCountryNameFromCode } from "../../lib/countryCodes";
import { validateEmailWithCommonTypos } from "../../lib/validation/email";
import { Eye, EyeOff, Brain, TrendingUp, BookOpen, Users, Code, BarChart3, FileText, Lightbulb, Mail, Lock, Building2, AlertCircle, CheckCircle2, Loader2, User, Phone } from "lucide-react";

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

// Capability Panel Component - Product showcase panel (on LEFT for signup)
function CapabilityPanel() {
  return (
    <div
      className="hidden lg:flex lg:w-1/2 relative items-center justify-center overflow-hidden"
      style={{
        height: '100vh',
        position: 'fixed',
        left: 0,
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
  const [error, setError] = useState<string | null>(null);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [codeExpired, setCodeExpired] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);
  const [organizationFocused, setOrganizationFocused] = useState(false);
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [ssoLoading, setSsoLoading] = useState<string | null>(null);

  const googleProvider = providers ? providers["google"] : undefined;
  const microsoftProvider = providers ? providers["azure-ad"] ?? providers["azuread"] : undefined;
  const callbackUrl = (router.query.callbackUrl as string) ?? "/dashboard";

  // Set country based on default country code on mount
  useEffect(() => {
    setCountry(getCountryNameFromCode(phoneCountryCode));
  }, []);

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

  // Check for OAuth redirect and pre-fill email
  useEffect(() => {
    const { email: emailParam, fromOAuth } = router.query;

    // Pre-fill email if coming from OAuth error
    if (emailParam && typeof emailParam === "string") {
      setEmail(emailParam);
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
      setError(errorMessage);
      // Clean up URL
      router.replace("/auth/signup", undefined, { shallow: true });
    }
  }, [router.query, router]);

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

      // Mark email as verified
      setIsEmailVerified(true);
      setVerifiedEmail(email);

      // Store flag in sessionStorage to indicate post-signup redirect
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('post_signup_verified', 'true');
        sessionStorage.setItem('verified_email', email);
      }

      // Redirect to signin page
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

      setError(errorMessage);
    } finally {
      setVerifyingCode(false);
    }
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const emailValidation = validateEmailWithCommonTypos(email);
    if (!emailValidation.valid) {
      setError(emailValidation.message);
      return;
    }

    // Validate phone number
    if (!phone.trim()) {
      setPhoneError("Phone number is required");
      setError("Phone number is required");
      return;
    }
    const phoneValidation = validatePhoneNumber(phone, phoneCountryCode);
    if (!phoneValidation.valid) {
      setPhoneError(phoneValidation.error || "");
      setError(phoneValidation.error || "Invalid phone number format");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!organization.trim()) {
      setError("Organization name is required");
      return;
    }
    try {
      setLoading(true);
      setError(null);
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
      setError(null);
      setTimeRemaining(60);
      setCodeExpired(false);
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message ?? error?.message ?? "Signup failed";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (    <div className="h-screen flex flex-col lg:flex-row overflow-hidden" style={{ backgroundColor: "#E8FAF0" }}>      {/* Left Panel - Capability Showcase - Hidden on Mobile */}      <CapabilityPanel />      {/* Right Panel - Signup Form - Enhanced Contrast */}      <div         className="w-full lg:w-1/2 h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-mint-200 scrollbar-track-white ml-auto"         style={{           backgroundColor: "#FFFFFF",          scrollbarWidth: "thin",          scrollbarColor: "#C9F4D4 #FFFFFF"        }}        id="signup-scroll-container"      >        <style dangerouslySetInnerHTML={{__html: `          #signup-scroll-container {            overflow-y: scroll !important;          }          #signup-scroll-container::-webkit-scrollbar {            width: 10px;            -webkit-appearance: none;          }          #signup-scroll-container::-webkit-scrollbar-track {            background: #FFFFFF;            border-left: 1px solid #E5E7EB;          }          #signup-scroll-container::-webkit-scrollbar-thumb {            background: #C9F4D4;            border-radius: 5px;            border: 2px solid #FFFFFF;          }          #signup-scroll-container::-webkit-scrollbar-thumb:hover {            background: #B0EFC0;          }        `}} />        <div className="min-h-full flex items-center justify-center p-4 sm:p-6 md:p-6 lg:px-10 lg:py-8 xl:px-12 xl:py-10">          <div className="w-full max-w-md lg:max-w-lg my-auto">            {/* Aaptor Logo + Product Name */}            <div className="mb-6 sm:mb-7 lg:mb-8 flex flex-col items-center">              <div className="mb-3 sm:mb-4">                <Image                  src="/Aaptor%20Logo.png"                  alt="Aaptor logo"                  width={160}                  height={70}                  className="h-10 sm:h-14 lg:h-16 w-auto object-contain"                  priority                />              </div>            </div>            {/* Create Account Heading - Enhanced Typography */}            <div className="text-center mb-6 sm:mb-7 lg:mb-8">              <h1                 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-2 sm:mb-3 tracking-tight leading-tight"                 style={{ color: "#1E5A3B", fontWeight: 700 }}              >                Create your account              </h1>            </div>            {isEmailVerified ? (              <div style={{ textAlign: 'center', padding: '2rem' }}>                <div                  style={{                    backgroundColor: '#d1fae5',                    borderLeft: '4px solid #10b981',                    padding: '1rem',                    borderRadius: '0.5rem',                    marginBottom: '1rem',                  }}                >                  <p style={{ margin: 0, color: '#065f46', fontSize: '0.875rem', fontWeight: 500 }}>                    Email verified successfully! Redirecting to sign in...                  </p>                </div>              </div>            ) : !showVerification ? (              <>                {/* OAuth Buttons - Enhanced with Shadows */}                {(googleProvider || microsoftProvider) && (                  <div className="mb-6 sm:mb-7 lg:mb-8">                    <p className="text-sm font-semibold mb-3 sm:mb-4 text-center" style={{ color: "#1E5A3B" }}>                      Sign up with your work account                    </p>                    <div className="space-y-2.5 sm:space-y-3">                    {googleProvider && (                      <button                        type="button"                        onClick={() => {                          setSsoLoading("google");                          signIn("google", { callbackUrl });                        }}                        disabled={ssoLoading !== null}                        aria-label="Sign up with Google"                        className="w-full h-12 sm:h-14 px-4 rounded-xl border-2 flex items-center justify-center gap-3 font-semibold text-sm sm:text-base transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"                        style={{                          backgroundColor: "#FFFFFF",                          color: "#1E5A3B",                          borderColor: "#E5E7EB",                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.07)",                        }}                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {                          if (ssoLoading === null) {                            e.currentTarget.style.backgroundColor = "#E8FAF0";                            e.currentTarget.style.borderColor = "#C9F4D4";                            e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";                            e.currentTarget.style.boxShadow = "0 8px 12px rgba(0, 0, 0, 0.12)";                          }                        }}                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {                          e.currentTarget.style.backgroundColor = "#FFFFFF";                          e.currentTarget.style.borderColor = "#E5E7EB";                          e.currentTarget.style.transform = "translateY(0) scale(1)";                          e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.07)";                        }}                      >                        {ssoLoading === "google" ? (                          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#1E5A3B" }} />                        ) : (                          <div className="w-5 h-5">                            <GoogleLogo />                          </div>                        )}                        {ssoLoading === "google" ? "Connecting..." : "Continue with Google"}                      </button>                    )}                    {microsoftProvider && (                      <button                        type="button"                        onClick={() => {                          setSsoLoading("microsoft");                          signIn(microsoftProvider.id, { callbackUrl });                        }}                        disabled={ssoLoading !== null}                        aria-label="Sign up with Microsoft"                        className="w-full h-12 sm:h-14 px-4 rounded-xl border-2 flex items-center justify-center gap-3 font-semibold text-sm sm:text-base transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"                        style={{                          backgroundColor: "#FFFFFF",                          color: "#1E5A3B",                          borderColor: "#E5E7EB",                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.07)",                        }}                        onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => {                          if (ssoLoading === null) {                            e.currentTarget.style.backgroundColor = "#E8FAF0";                            e.currentTarget.style.borderColor = "#C9F4D4";                            e.currentTarget.style.transform = "translateY(-2px) scale(1.01)";                            e.currentTarget.style.boxShadow = "0 8px 12px rgba(0, 0, 0, 0.12)";                          }                        }}                        onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => {                          e.currentTarget.style.backgroundColor = "#FFFFFF";                          e.currentTarget.style.borderColor = "#E5E7EB";                          e.currentTarget.style.transform = "translateY(0) scale(1)";                          e.currentTarget.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.07)";                        }}                      >                        {ssoLoading === "microsoft" ? (                          <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#1E5A3B" }} />                        ) : (                          <div className="w-5 h-5">                            <MicrosoftLogo />                          </div>                        )}                        {ssoLoading === "microsoft" ? "Connecting..." : "Continue with Microsoft"}                      </button>                    )}                  </div>                  </div>                )}                {/* Divider - Enhanced */}                {(googleProvider || microsoftProvider) && (                  <div className="flex items-center justify-center my-5 sm:my-6 lg:my-7">                    <div className="flex-1 border-t" style={{ borderColor: "rgba(168, 232, 188, 0.3)" }}></div>                    <span className="px-4 text-xs sm:text-sm uppercase tracking-wider font-medium" style={{ color: "#4A9A6A" }}>                      or                    </span>                    <div className="flex-1 border-t" style={{ borderColor: "rgba(168, 232, 188, 0.3)" }}></div>                  </div>                )}                <form onSubmit={onSubmit} className="space-y-5 sm:space-y-6">                  {/* Full Name Field - Floating Label */}                  <div>                    <div className="relative">                      <User className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 z-10" size={18} style={{ color: nameFocused || name ? "#4A9A6A" : "#9CA3AF" }} />                      <label                         htmlFor="name"                         className={`absolute left-10 sm:left-12 transition-all duration-200 pointer-events-none ${                          nameFocused || name                             ? "top-2 text-xs font-semibold"                             : "text-sm"                        }`}                        style={{                           color: nameFocused || name ? "#2D7A52" : "#9CA3AF",                          top: nameFocused || name ? "0.5rem" : "50%",                          transform: nameFocused || name ? "none" : "translateY(-50%)",                          lineHeight: "1.5",                          display: "flex",                          alignItems: "center"                        }}                      >                        Full Name                      </label>                      <input                        id="name"                        type="text"                        required                        autoComplete="name"                        value={name}                        onChange={(event) => setName(event.target.value)}                        onFocus={() => setNameFocused(true)}                        onBlur={() => setNameFocused(false)}                        aria-label="Full Name"                        aria-required="true"                        className="w-full h-14 sm:h-16 pt-5 pb-2 pl-10 sm:pl-12 pr-4 rounded-xl border-2 transition-all duration-200 focus:outline-none text-sm sm:text-base"                        style={{                          backgroundColor: "#FFFFFF",                          borderColor: nameFocused ? "#C9F4D4" : "#D1D5DB",                          color: "#1E5A3B",                          fontSize: "0.9375rem",                          boxShadow: nameFocused ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.05)",                        }}                      />                    </div>                  </div>                  {/* Email Field - Floating Label */}                  <div>                    <div className="relative">                      <Mail className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 z-10" size={18} style={{ color: emailFocused || email ? "#4A9A6A" : "#9CA3AF" }} />                      <label                         htmlFor="email"                         className={`absolute left-10 sm:left-12 transition-all duration-200 pointer-events-none ${                          emailFocused || email                             ? "top-2 text-xs font-semibold"                             : "text-sm"                        }`}                        style={{                           color: emailFocused || email ? "#2D7A52" : "#9CA3AF",                          top: emailFocused || email ? "0.5rem" : "50%",                          transform: emailFocused || email ? "none" : "translateY(-50%)",                          lineHeight: "1.5",                          display: "flex",                          alignItems: "center"                        }}                      >                        Work Email                      </label>                      <input                        id="email"                        type="email"                        required                        autoComplete="email"                        value={email}                        onChange={(event) => setEmail(event.target.value)}                        onFocus={() => setEmailFocused(true)}                        onBlur={() => setEmailFocused(false)}                        aria-label="Work Email"                        aria-required="true"                        aria-invalid={error && error.toLowerCase().includes("email") ? "true" : "false"}                        className="w-full h-14 sm:h-16 pt-5 pb-2 pl-10 sm:pl-12 pr-4 rounded-xl border-2 transition-all duration-200 focus:outline-none text-sm sm:text-base"                        style={{                          backgroundColor: "#FFFFFF",                          borderColor: error && error.toLowerCase().includes("email") ? "#EF4444" : (emailFocused ? "#C9F4D4" : "#D1D5DB"),                          color: "#1E5A3B",                          fontSize: "0.9375rem",                          boxShadow: emailFocused ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.05)",                        }}                      />                    </div>                    {error && error.toLowerCase().includes("email") && (                      <p className="mt-1.5 text-xs flex items-center gap-1.5" style={{ color: "#EF4444" }} role="alert">                        <AlertCircle size={14} />                        {error}                      </p>                    )}                  </div>                  {/* Password Field - Floating Label */}                  <div>                    <div className="relative">                      <Lock className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 z-10" size={18} style={{ color: passwordFocused || password ? "#4A9A6A" : "#9CA3AF" }} />                      <label                         htmlFor="password"                         className={`absolute left-10 sm:left-12 transition-all duration-200 pointer-events-none ${                          passwordFocused || password                             ? "top-2 text-xs font-semibold"                             : "text-sm"                        }`}                        style={{                           color: passwordFocused || password ? "#2D7A52" : "#9CA3AF",                          top: passwordFocused || password ? "0.5rem" : "50%",                          transform: passwordFocused || password ? "none" : "translateY(-50%)",                          lineHeight: "1.5",                          display: "flex",                          alignItems: "center"                        }}                      >                        Password                      </label>                      <input                        id="password"                        type={showPassword ? "text" : "password"}                        required                        autoComplete="new-password"                        value={password}                        onChange={(event) => setPassword(event.target.value)}                        onFocus={() => setPasswordFocused(true)}                        onBlur={() => setPasswordFocused(false)}                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {                          if (e.getModifierState && e.getModifierState("CapsLock")) {                            setCapsLockOn(true);                          } else {                            setCapsLockOn(false);                          }                        }}                        aria-label="Password"                        aria-required="true"                        className="w-full h-14 sm:h-16 pt-5 pb-2 pl-10 sm:pl-12 pr-12 sm:pr-14 rounded-xl border-2 transition-all duration-200 focus:outline-none text-sm sm:text-base"                        style={{                          backgroundColor: "#FFFFFF",                          borderColor: passwordFocused ? "#C9F4D4" : "#D1D5DB",                          color: "#1E5A3B",                          fontSize: "0.9375rem",                          boxShadow: passwordFocused ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.05)",                        }}                      />                      <button                        type="button"                        onClick={() => setShowPassword(!showPassword)}                        aria-label={showPassword ? "Hide password" : "Show password"}                        className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 p-1.5 transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-mint-200 rounded"                        style={{ color: "#4A9A6A" }}                      >                        {showPassword ? <EyeOff size={18} className="sm:w-5 sm:h-5" /> : <Eye size={18} className="sm:w-5 sm:h-5" />}                      </button>                    </div>                    {capsLockOn && passwordFocused && (                      <p className="mt-1.5 text-xs flex items-center gap-1.5" style={{ color: "#F59E0B" }} role="alert">                        <AlertCircle size={14} />                        Caps Lock is on                      </p>                    )}                  </div>                  {/* Confirm Password Field - Floating Label */}                  <div>                    <div className="relative">                      <Lock className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 z-10" size={18} style={{ color: confirmPasswordFocused || confirmPassword ? "#4A9A6A" : "#9CA3AF" }} />                      <label                         htmlFor="confirmPassword"                         className={`absolute left-10 sm:left-12 transition-all duration-200 pointer-events-none ${                          confirmPasswordFocused || confirmPassword                             ? "top-2 text-xs font-semibold"                             : "text-sm"                        }`}                        style={{                           color: confirmPasswordFocused || confirmPassword ? "#2D7A52" : "#9CA3AF",                          top: confirmPasswordFocused || confirmPassword ? "0.5rem" : "50%",                          transform: confirmPasswordFocused || confirmPassword ? "none" : "translateY(-50%)",                          lineHeight: "1.5",                          display: "flex",                          alignItems: "center"                        }}                      >                        Confirm Password                      </label>                      <input                        id="confirmPassword"                        type={showConfirmPassword ? "text" : "password"}                        required                        autoComplete="new-password"                        value={confirmPassword}                        onChange={(event) => setConfirmPassword(event.target.value)}                        onFocus={() => setConfirmPasswordFocused(true)}                        onBlur={() => setConfirmPasswordFocused(false)}                        aria-label="Confirm Password"                        aria-required="true"                        className="w-full h-14 sm:h-16 pt-5 pb-2 pl-10 sm:pl-12 pr-12 sm:pr-14 rounded-xl border-2 transition-all duration-200 focus:outline-none text-sm sm:text-base"                        style={{                          backgroundColor: "#FFFFFF",                          borderColor: error && error.toLowerCase().includes("password") ? "#EF4444" : (confirmPasswordFocused ? "#C9F4D4" : "#D1D5DB"),                          color: "#1E5A3B",                          fontSize: "0.9375rem",                          boxShadow: confirmPasswordFocused ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.05)",                        }}                      />                      <button                        type="button"                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}                        className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 p-1.5 transition-transform duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-mint-200 rounded"                        style={{ color: "#4A9A6A" }}                      >                        {showConfirmPassword ? <EyeOff size={18} className="sm:w-5 sm:h-5" /> : <Eye size={18} className="sm:w-5 sm:h-5" />}                      </button>                    </div>                    {error && error.toLowerCase().includes("password") && !error.toLowerCase().includes("email") && (                      <p className="mt-1.5 text-xs flex items-center gap-1.5" style={{ color: "#EF4444" }} role="alert">                        <AlertCircle size={14} />                        {error}                      </p>                    )}                  </div>                  {/* Organization Name Field - Floating Label */}                  <div>                    <div className="relative">                      <Building2 className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 z-10" size={18} style={{ color: organizationFocused || organization ? "#4A9A6A" : "#9CA3AF" }} />                      <label                         htmlFor="organization"                         className={`absolute left-10 sm:left-12 transition-all duration-200 pointer-events-none ${                          organizationFocused || organization                             ? "top-2 text-xs font-semibold"                             : "text-sm"                        }`}                        style={{                           color: organizationFocused || organization ? "#2D7A52" : "#9CA3AF",                          top: organizationFocused || organization ? "0.5rem" : "50%",                          transform: organizationFocused || organization ? "none" : "translateY(-50%)",                          lineHeight: "1.5",                          display: "flex",                          alignItems: "center"                        }}                      >                        Organization Name <span style={{ color: "#EF4444" }}>*</span>                      </label>                      <input                        id="organization"                        type="text"                        required                        value={organization}                        onChange={(event) => setOrganization(event.target.value)}                        onFocus={() => setOrganizationFocused(true)}                        onBlur={() => setOrganizationFocused(false)}                        placeholder=""                        aria-label="Organization Name"                        aria-required="true"                        className="w-full h-14 sm:h-16 pt-5 pb-2 pl-10 sm:pl-12 pr-4 rounded-xl border-2 transition-all duration-200 focus:outline-none text-sm sm:text-base"                        style={{                          backgroundColor: "#FFFFFF",                          borderColor: organizationFocused ? "#C9F4D4" : "#D1D5DB",                          color: "#1E5A3B",                          fontSize: "0.9375rem",                          boxShadow: organizationFocused ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.05)",                        }}                      />                    </div>                  </div>                  {/* Phone Number Field - Floating Label with Country Code */}                  <div>                    <div className="relative flex gap-2">                      <div className="relative" style={{ width: "180px", flexShrink: 0 }}>                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10" size={18} style={{ color: phoneFocused || phone ? "#4A9A6A" : "#9CA3AF" }} />                        <select                          id="phoneCountryCode"                          value={phoneCountryCode}                          onChange={(event) => {                            const selectedCode = event.target.value;                            setPhoneCountryCode(selectedCode);                            setCountry(getCountryNameFromCode(selectedCode));                            if (phone.trim()) {                              const validation = validatePhoneNumber(phone, selectedCode);                              if (!validation.valid) {                                setPhoneError(validation.error || "");                              } else {                                setPhoneError("");                              }                            }                          }}                          onFocus={() => setPhoneFocused(true)}                          onBlur={() => setPhoneFocused(false)}                          className="w-full h-14 sm:h-16 pl-10 pr-4 rounded-xl border-2 transition-all duration-200 focus:outline-none text-sm sm:text-base appearance-none cursor-pointer"                          style={{                            backgroundColor: "#FFFFFF",                            borderColor: phoneFocused ? "#C9F4D4" : "#D1D5DB",                            color: "#1E5A3B",                            fontSize: "0.9375rem",
                            boxShadow: phoneFocused ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
                          }}
                        >
                          {sortedCountryCodes.map((country) => (
                            <option key={country.code} value={country.code}>
                              {country.code} {country.country}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="relative flex-1">
                        <label 
                          htmlFor="phone" 
                          className={`absolute left-3 sm:left-4 transition-all duration-200 pointer-events-none ${
                            phoneFocused || phone 
                              ? "top-2 text-xs font-semibold" 
                              : "text-sm"
                          }`}
                          style={{ 
                            color: phoneFocused || phone ? "#2D7A52" : "#9CA3AF",
                            top: phoneFocused || phone ? "0.5rem" : "50%",
                            transform: phoneFocused || phone ? "none" : "translateY(-50%)",
                            lineHeight: "1.5",
                            display: "flex",
                            alignItems: "center"
                          }}
                        >
                          Phone Number
                        </label>
                        <input
                          id="phone"
                          type="tel"
                          required
                          value={phone}
                          onChange={(event) => {
                            const value = event.target.value.replace(/\D/g, "");
                            setPhone(value);
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
                          onFocus={() => setPhoneFocused(true)}
                          onBlur={() => {
                            setPhoneFocused(false);
                            if (phone.trim()) {
                              const validation = validatePhoneNumber(phone, phoneCountryCode);
                              if (!validation.valid) {
                                setPhoneError(validation.error || "");
                              } else {
                                setPhoneError("");
                              }
                            }
                          }}
                          placeholder=""
                          aria-label="Phone Number"
                          aria-required="true"
                          className="w-full h-14 sm:h-16 pt-5 pb-2 pl-3 sm:pl-4 pr-4 rounded-xl border-2 transition-all duration-200 focus:outline-none text-sm sm:text-base"
                          style={{
                            backgroundColor: "#FFFFFF",
                            borderColor: phoneError ? "#EF4444" : (phoneFocused ? "#C9F4D4" : "#D1D5DB"),
                            color: "#1E5A3B",
                            fontSize: "0.9375rem",
                            boxShadow: phoneFocused ? "0 0 0 3px rgba(201, 244, 212, 0.2), 0 4px 6px rgba(0, 0, 0, 0.1)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
                          }}
                        />
                      </div>
                    </div>
                    {phoneError && (
                      <p className="mt-1.5 text-xs flex items-center gap-1.5" style={{ color: "#EF4444" }} role="alert">
                        <AlertCircle size={14} />
                        {phoneError}
                      </p>
                    )}
                  </div>

                  {/* General Error Message */}
                  {error && !error.toLowerCase().includes("email") && !error.toLowerCase().includes("password") && !error.toLowerCase().includes("phone") && (
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

                  {/* Sign Up Button */}
                  <button
                    type="submit"
                    disabled={loading}
                    aria-label="Sign up to create your account"
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
                        <span>Signing up...</span>
                      </>
                    ) : (
                      "Sign Up"
                    )}
                  </button>
                </form>

                {/* Sign In Link */}
                <div className="mt-5 sm:mt-6 text-center">
                  <p className="text-xs sm:text-sm" style={{ color: "#4A9A6A" }}>
                    Already have an account?{" "}
                    <Link 
                      href="/auth/signin" 
                      className="font-semibold transition-all hover:underline"
                      style={{ color: "#1E5A3B" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#C9F4D4";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#1E5A3B";
                      }}
                    >
                      Sign in
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
                  Back to Sign Up
                </button>
              </div>
            )}
          </div>
        </div>
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
