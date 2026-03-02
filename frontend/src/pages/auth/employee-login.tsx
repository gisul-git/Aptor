/**
 * Employee Login Page
 
 */
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import fastApiClient from '../../lib/fastapi';
import { motion } from 'framer-motion';
import { 
  LogIn, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  User, 
  Mail, 
  ShieldCheck, 
  Terminal, 
  Cpu, 
  Database, 
  ChevronRight,
  Lock
} from 'lucide-react';

export default function EmployeeLoginPage() {
  const router = useRouter();
  const [aaptorId, setAaptorId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Pre-fill Aaptor ID from query if available (client-side only)
  useEffect(() => {
    setMounted(true);
    if (router.isReady) {
      const { aaptorId: queryAaptorId } = router.query;
      if (queryAaptorId && typeof queryAaptorId === 'string') {
        setAaptorId(queryAaptorId.toUpperCase());
      }
    }
  }, [router.isReady, router.query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!aaptorId.trim()) {
      setError('Aaptor ID is required');
      return;
    }
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fastApiClient.post('/api/v1/employees/login', {
        aaptorId: aaptorId.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      const responseData = response.data?.data || response.data;
      const token = responseData?.token;
      const employee = responseData?.employee;

      if (token && employee) {
        if (typeof window !== 'undefined') {
          localStorage.setItem('employee_token', token);
          localStorage.setItem('employee_data', JSON.stringify(employee));
          sessionStorage.setItem('employee_token', token);
          sessionStorage.setItem('employee_data', JSON.stringify(employee));
        }
        router.push('/employee/dashboard');
      } else {
        setError('Invalid response from server. Please try again.');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || 
                          err?.response?.data?.message || 
                          err?.message || 
                          'Login failed. Please check your credentials and try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen lg:h-screen flex flex-col lg:flex-row bg-white overflow-x-hidden font-sans">
      
      {/* Left Side:  Branding (Aptor Skill Engine) */}
      
<div className="hidden md:flex lg:w-1/2 bg-[#0A5F38] relative overflow-hidden items-center justify-center p-8 lg:p-12 min-h-screen shrink-0">
  
  {/* 1. Background Layers: Asymmetric Overlays */}
  <div className="absolute top-0 right-0 w-full h-full">
    {/* Large Geometric Shape */}
    <div className="absolute -top-[10%] -right-[10%] w-[80%] h-[120%] bg-[#C9F4D4] opacity-[0.03] rounded-bl-[20rem] rotate-12"></div>
    
    {/* Dynamic Data Stream (CSS Animation) */}
    <div className="absolute inset-0 opacity-[0.08]" 
         style={{ 
           backgroundImage: `linear-gradient(to bottom, transparent, #C9F4D4 50%, transparent)`,
           backgroundSize: '1px 200px',
           animation: 'dataStream 8s linear infinite'
         }}>
    </div>
  </div>

  {/* 2. Main Visual Content: The "Step-Up" Layout */}
  <div className="relative z-10 w-full flex flex-col lg:flex-row items-end gap-8">
    
    {/* Vertical Labeling */}
    <div className="hidden xl:block h-full py-4">
      <p className="text-[#C9F4D4] font-black text-[10px] uppercase tracking-[1em] [writing-mode:vertical-lr] rotate-180 opacity-40">
        Bridging the Skill Gap — Gisul Services
      </p>
    </div>

    <div className="flex-1 space-y-12">
      {/* 3. Innovative Icon Block */}
      <div className="relative group inline-block">
        {/* Pulsing Backlight */}
        <div className="absolute inset-0 bg-[#C9F4D4] blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity duration-1000"></div>
        
        <div className="relative flex items-center gap-6">
          <div className="w-24 h-24 bg-[#C9F4D4] rounded-tr-[3rem] rounded-bl-[3rem] flex items-center justify-center shadow-2xl rotate-12 group-hover:rotate-0 transition-transform duration-700">
            <ShieldCheck className="w-12 h-12 text-[#0A5F38]" strokeWidth={2.5} />
          </div>
          <div className="space-y-1">
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="w-6 h-1 bg-[#C9F4D4] rounded-full"></div>
              ))}
            </div>
            <p className="text-white font-black text-xl tracking-tighter uppercase">Secure Access</p>
          </div>
        </div>
      </div>

      {/* 4. Impact Typography */}
      <div className="space-y-2">
        <h1 className="text-6xl lg:text-8xl font-black text-white leading-none tracking-tight">
          YOUR <br />
          <span className="relative">
            LEGACY
            <svg className="absolute -bottom-2 left-0 w-full h-3 text-[#C9F4D4] opacity-40" viewBox="0 0 100 10" preserveAspectRatio="none">
              <path d="M0 5 Q 25 0, 50 5 T 100 5" fill="none" stroke="currentColor" strokeWidth="4" />
            </svg>
          </span>
          <br />
          <span className="text-[#C9F4D4]">STARTS.</span>
        </h1>
        <p className="text-white/60 text-lg font-medium leading-relaxed max-w-md pt-6 border-t border-white/10">
          Welcome to <span className="text-white font-bold tracking-widest">Aptor</span>. 
          Step into a curriculum designed by <span className="text-[#C9F4D4]">industry experts</span> to propel your career into the future.
        </p>
      </div>

      {/* 5. Floating Skill Badges (Asymmetric) */}
      <div className="flex flex-wrap gap-3 pt-4">
        {[
          { icon: <Database size={14}/>, label: "Analytics" },
          { icon: <Cpu size={14}/>, label: "Hardware" },
          { icon: <Terminal size={14}/>, label: "Full-Stack" }
        ].map((badge, idx) => (
          <div key={idx} className="flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full hover:bg-white/10 transition-all cursor-default">
            <span className="text-[#C9F4D4]">{badge.icon}</span>
            <span className="text-white text-[10px] font-black uppercase tracking-widest">{badge.label}</span>
          </div>
        ))}
      </div>
    </div>
  </div>

  {/* CSS for Data Stream Animation */}
  <style jsx>{`
    @keyframes dataStream {
      0% { transform: translateY(-100%); }
      100% { transform: translateY(100%); }
    }
  `}</style>
</div>

      {/* Right Side: Login Form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 bg-[#f1dcba] lg:bg-white lg:h-full overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-[440px] bg-white lg:bg-transparent p-8 sm:p-0 rounded-[2.5rem] lg:rounded-none shadow-2xl lg:shadow-none my-8 lg:my-0 animate-in fade-in slide-in-from-right-4 duration-500">
          
          <header className="mb-10 text-center lg:text-left">
            <div className="inline-flex lg:hidden w-14 h-14 bg-[#0A5F38] rounded-2xl items-center justify-center mb-4 shadow-lg">
              <LogIn className="w-7 h-7 text-[#C9F4D4]" />
            </div>
            <h2 className="text-3xl font-black text-[#1a1625] mb-2 uppercase tracking-tight">
              Employee Login
            </h2>
            <p className="text-gray-500 text-base font-medium">
              Sign in to access your specialized employee portal.
            </p>
          </header>

          {error && (
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm font-bold leading-tight">{error}</p>
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Aaptor ID Field */}
            <div className="space-y-2 group">
              <label className="text-xs font-black text-[#1A1625]/60 uppercase tracking-widest px-1 group-focus-within:text-[#0A5F38] transition-colors">
                Aaptor ID 
              </label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0A5F38] transition-colors" size={20} />
                <input
                  type="text"
                  value={aaptorId}
                  onChange={(e) => setAaptorId(e.target.value.toUpperCase())}
                  required
                  placeholder="AAP0010001"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#0A5F38] focus:bg-white outline-none transition-all font-bold text-slate-700 tracking-wider uppercase font-mono shadow-inner text-base"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2 group">
              <label className="text-xs font-black text-[#1A1625]/60 uppercase tracking-widest px-1 group-focus-within:text-[#0A5F38] transition-colors">
                Work Email 
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0A5F38] transition-colors" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value.toLowerCase())}
                  required
                  placeholder="employee@gisul.com"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#0A5F38] focus:bg-white outline-none transition-all font-medium text-slate-700 shadow-inner text-base"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2 group">
              <label className="text-xs font-black text-[#1A1625]/60 uppercase tracking-widest px-1 group-focus-within:text-[#0A5F38] transition-colors">
                Password 
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0A5F38] transition-colors" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#0A5F38] focus:bg-white outline-none transition-all text-base shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#0A5F38] transition-colors p-1"
                >
                  {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-xl shadow-[#0A5F38]/10 active:scale-[0.98] mt-4 min-h-[64px] ${
                loading 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-[#0A5F38] text-white hover:bg-green-600 border-2 border-transparent'
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ChevronRight size={18} />
                </>
              )}
            </button>

            <footer className="pt-8 border-t border-gray-100 text-center">
              <p className="text-xs font-black text-gray-400 uppercase tracking-tighter">
                Need to secure your account?{' '}
                <Link 
                  href={`/auth/set-password${aaptorId ? `?aaptorId=${encodeURIComponent(aaptorId)}` : ''}`}
                  className="text-[#0A5F38] hover:underline decoration-2 underline-offset-4 ml-1 text-sm font-black transition-all"
                >
                  SET PASSWORD
                </Link>
              </p>
            </footer>
          </form>
        </div>
      </div>
    </div>
  );
}