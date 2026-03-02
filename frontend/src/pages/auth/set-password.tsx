/**
 * Employee Set Password Page
 * * Allows employees to set their password using temporary password from welcome email
 * Accessed via: /auth/set-password?aaptorId=AAP0010001
 */

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import fastApiClient from "../../lib/fastapi";
import {
  Lock,
  CheckCircle,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  KeyRound,
  Code2,
  Terminal,
} from "lucide-react";

export default function SetPasswordPage() {
  const router = useRouter();
  const { aaptorId } = router.query;
  const [tempPassword, setTempPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!aaptorId && router.isReady) {
      setError(
        "Aaptor ID is required. Please use the link from your welcome email.",
      );
    }
  }, [aaptorId, router.isReady]);

  const validatePassword = (
    password: string,
  ): { valid: boolean; message?: string } => {
    if (password.length < 8) {
      return {
        valid: false,
        message: "Password must be at least 8 characters long",
      };
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return {
        valid: false,
        message: "Password must contain at least one lowercase letter",
      };
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return {
        valid: false,
        message: "Password must contain at least one uppercase letter",
      };
    }
    if (!/(?=.*\d)/.test(password)) {
      return {
        valid: false,
        message: "Password must contain at least one number",
      };
    }
    if (!/(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password)) {
      return {
        valid: false,
        message:
          'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)',
      };
    }
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!aaptorId || typeof aaptorId !== "string") {
      setError(
        "Aaptor ID is required. Please use the link from your welcome email.",
      );
      return;
    }

    if (!tempPassword.trim()) {
      setError("Temporary password is required");
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message || "Invalid password");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const response = await fastApiClient.post(
        "/api/v1/employees/set-password",
        {
          aaptorId: aaptorId.trim().toUpperCase(),
          tempPassword: tempPassword.trim(),
          newPassword: newPassword.trim(),
        },
      );

      if (response.data?.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push(
            `/auth/employee-login?aaptorId=${encodeURIComponent(aaptorId)}`,
          );
        }, 2000);
      }
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        "Failed to set password. Please check your temporary password and try again.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="h-screen flex items-center justify-center p-4 bg-[#f1dcba]">
        <div className="w-full max-w-md bg-white rounded-[2rem] p-10 shadow-2xl text-center animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 bg-[#C9F4D4] rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-[#2D7A52]" />
          </div>
          <h2 className="text-3xl font-black text-[#1a1625] mb-2">
            Password Set Successfully!
          </h2>
          <p className="text-gray-500 font-medium text-lg">
            Your password has been set. Redirecting to login page...
          </p>
          <div className="mt-8 flex justify-center">
            <div className="w-8 h-8 border-4 border-[#2D7A52] border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-white overflow-hidden">
      {/* Left Side: Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#0A5F38] relative overflow-hidden items-center justify-center p-12 h-full">
        {/* 1. Animated Tech "Aura" Background */}
        <div className="absolute inset-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#C9F4D4] opacity-20 blur-[120px] animate-pulse"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#88B89D] opacity-10 blur-[150px]"></div>

          {/* Tech Grid Overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
              backgroundSize: "30px 30px",
            }}
          ></div>
        </div>

        <div className="relative z-10 w-full max-w-xl text-center">
          {/* 2. Central Interactive "Skill Core" */}
          <div className="relative mb-16 inline-block">
            {/* Outer Rotating Ring */}
            <div className="absolute inset-[-20px] border-2 border-dashed border-[#C9F4D4]/30 rounded-full animate-[spin_20s_linear_infinite]"></div>

            {/* Floating Skill Orbs */}
            <div className="absolute -top-10 -left-10 w-12 h-12 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center animate-bounce shadow-lg">
              <Code2 className="text-[#C9F4D4] w-6 h-6" />
            </div>
            <div
              className="absolute -bottom-8 -right-4 w-14 h-14 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center justify-center animate-pulse shadow-lg"
              style={{ animationDelay: "1s" }}
            >
              <Terminal className="text-[#C9F4D4] w-7 h-7" />
            </div>

            {/* Main Logo Container */}
            <div className="w-32 h-32 bg-gradient-to-br from-[#C9F4D4] to-[#88B89D] rounded-[3rem] flex items-center justify-center shadow-[0_20px_50px_rgba(0,0,0,0.3)] transform -rotate-6">
              <ShieldCheck
                className="w-16 h-16 text-[#0A5F38]"
                strokeWidth={1.5}
              />
            </div>
          </div>

          {/* 3. Typography: The "Reinventing Education" Message */}
          <div className="space-y-6">
            <h1 className="text-7xl font-black text-white leading-[0.9] tracking-tighter">
              GROW <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C9F4D4] to-white opacity-90">
                WITHOUT LIMITS.
              </span>
            </h1>

            <p className="text-white/80 text-xl font-medium leading-relaxed max-w-md mx-auto">
              Join the ecosystem where{" "}
              <span className="text-[#C9F4D4] font-bold">
                Industry Expertise
              </span>{" "}
              meets{" "}
              <span className="text-[#C9F4D4] font-bold">
                Practical Mastery
              </span>
              . Your journey at Aptor starts here.
            </p>
          </div>

          {/* 4. Glassmorphism Statistics Card */}
          <div className="mt-16 grid grid-cols-2 gap-4 text-left">
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 transition-colors group">
              <div className="text-[#C9F4D4] font-black text-3xl mb-1 group-hover:scale-110 transition-transform">
                90%
              </div>
              <div className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">
                Practical Curriculum
              </div>
            </div>
            <div className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-[2rem] hover:bg-white/10 transition-colors group">
              <div className="text-[#C9F4D4] font-black text-3xl mb-1 group-hover:scale-110 transition-transform">
                Expert
              </div>
              <div className="text-white/60 text-[10px] font-bold uppercase tracking-[0.2em]">
                Industry Mentors
              </div>
            </div>
          </div>
        </div>

        {/* 5. Floating Particle Decoration */}
        <div className="absolute bottom-10 left-10 flex gap-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-[#C9F4D4] animate-ping"
              style={{ animationDelay: `${i * 0.5}s` }}
            ></div>
          ))}
        </div>
      </div>

      {/* Right Side: Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 bg-[#f1dcba] lg:bg-white h-full overflow-hidden">
        <div className="w-full max-w-[460px] bg-white lg:bg-transparent p-8 sm:p-0 rounded-[2rem] lg:rounded-none shadow-xl lg:shadow-none">
          <div className="mb-6">
            <div className="lg:hidden w-10 h-10 bg-[#E8FAF0] rounded-xl flex items-center justify-center mb-3">
              <Lock className="w-5 h-5 text-[#2D7A52]" />
            </div>
            <h2 className="text-3xl font-black text-[#1a1625] mb-1 uppercase tracking-tight">
              Set Your Password
            </h2>
            <p className="text-gray-500 text-base font-medium">
              {aaptorId ? (
                <span className="flex items-center gap-2">
                  Assigning for{" "}
                  <span className="px-2.5 py-1 bg-[#C9F4D4] text-[#2D7A52] rounded-md font-bold text-sm tracking-wide">
                    {aaptorId}
                  </span>
                </span>
              ) : (
                "Enter your temporary password to set a new password"
              )}
            </p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-center gap-3 animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
              <p className="text-red-700 text-sm font-bold leading-tight">
                {error}
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-black text-[#1A1625] uppercase tracking-widest px-1">
                Aaptor ID
              </label>
              <input
                type="text"
                value={aaptorId || ""}
                disabled
                className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-xl text-gray-400 font-bold font-monospace uppercase shadow-inner text-base"
              />
            </div>

            <div className="space-y-1.5 group">
              <label className="text-xs font-black text-[#1A1625] uppercase tracking-widest px-1 group-focus-within:text-[#2D7A52] transition-colors">
                Temporary Password
              </label>
              <div className="relative">
                <input
                  type={showTempPassword ? "text" : "password"}
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  required
                  placeholder="Enter temp password from email"
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-[#2D7A52] focus:bg-white outline-none transition-all text-base pr-11 text-slate-700 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowTempPassword(!showTempPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#2D7A52]"
                >
                  {showTempPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 group">
              <label className="text-xs font-black text-[#1A1625] uppercase tracking-widest px-1 group-focus-within:text-[#2D7A52] transition-colors">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Create a strong password"
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-[#2D7A52] focus:bg-white outline-none transition-all text-base pr-11 text-slate-700 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#2D7A52]"
                >
                  {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5 group">
              <label className="text-xs font-black text-[#1A1625] uppercase tracking-widest px-1 group-focus-within:text-[#2D7A52] transition-colors">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat new password"
                  className="w-full px-4 py-3.5 bg-gray-50 border-2 border-gray-100 rounded-xl focus:border-[#2D7A52] focus:bg-white outline-none transition-all text-base pr-11 text-slate-700 font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#2D7A52]"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={20} />
                  ) : (
                    <Eye size={20} />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !aaptorId}
              className={`w-full py-4 rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#2D7A52]/20 active:scale-[0.98] mt-2 ${
                loading || !aaptorId
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-[#2D7A52] text-white hover:bg-green-600"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <KeyRound size={20} />
                  <span className="text-base">Set Password</span>
                </>
              )}
            </button>

            <div className="pt-6 border-t border-gray-100 text-center">
              <p className="text-xs font-black text-gray-400 uppercase tracking-tighter">
                Already set your password?{" "}
                <Link
                  href={`/auth/employee-login${aaptorId ? `?aaptorId=${encodeURIComponent(aaptorId as string)}` : ""}`}
                  className="text-[#2D7A52] hover:underline decoration-2 underline-offset-4 ml-1 text-sm font-black"
                >
                  SIGN IN
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
