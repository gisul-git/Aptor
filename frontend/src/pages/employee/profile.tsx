import React from 'react';
import { useRouter } from 'next/router';
import { LayoutDashboard, Bell, User as UserIcon, Settings, ChevronLeft } from 'lucide-react';
import ProfileHeader from '@/components/employee-profile/ProfileHeader';
import CapabilityTrend from '@/components/employee-profile/CapabilityTrend';
import AssessmentHistory from '@/components/employee-profile/AssessmentHistory';
import TopSkills from '@/components/employee-profile/TopSkills';
import Certifications from '@/components/employee-profile/Certifications';
import SkillDistribution from '@/components/employee-profile/SkillDistribution';
import Integrations from '@/components/employee-profile/Integrations';
import Strengths from '@/components/employee-profile/Strengths';
import AreasForImprovement from '@/components/employee-profile/AreasForImprovement';
import RecentActivity from '@/components/employee-profile/RecentActivity';

const EmployeeProfilePage = () => {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#F0FDF4]/30 pb-12 ">
      
      {/*  NAVBAR */}
      <nav className="sticky top-0 z-[100] w-full bg-white/70 backdrop-blur-xl border-b border-[#A8E8BC]/30 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Left: Brand & Navigation */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => router.push('/employee/dashboard')}>
               <div className="w-8 h-8 bg-[#0A5F38] rounded-lg flex items-center justify-center shadow-lg shadow-[#0A5F38]/20">
                  <span className="text-[#C9F4D4] font-black text-xs">A</span>
               </div>
               <span className="hidden sm:inline font-black text-[#0A5F38] tracking-tighter uppercase text-lg">Aptor</span>
            </div>
            
            <div className="h-6 w-px bg-slate-200 hidden md:block" />
            <button 
              onClick={() => router.push('/employee/dashboard')}
              className="group flex items-center gap-2 px-4 py-2 bg-[#C9F4D4]/50 hover:bg-[#C9F4D4] text-[#0A5F38] rounded-xl transition-all font-bold text-sm border border-transparent hover:border-[#0A5F38]/20 active:scale-95"
            >
              <LayoutDashboard size={18} className="group-hover:rotate-12 transition-transform" />
              <span className="hidden sm:inline">Go to Dashboard</span>
            </button>
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center gap-3">
            <div className="hidden lg:flex items-center gap-4 px-4 py-2 bg-slate-100/50 rounded-full border border-white mr-2">
               <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Active Status</span>
               </div>
            </div>

            <button className="p-2.5 text-slate-400 hover:text-[#0A5F38] hover:bg-[#C9F4D4]/30 rounded-xl transition-colors relative">
               <Bell size={20} />
               <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
            <button className="p-2.5 text-slate-400 hover:text-[#0A5F38] hover:bg-[#C9F4D4]/30 rounded-xl transition-colors">
               <Settings size={20} />
            </button>

            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0A5F38] to-[#2D7A52] p-0.5 shadow-md shadow-emerald-900/10 cursor-pointer">
               <div className="w-full h-full bg-white rounded-[10px] flex items-center justify-center text-[#0A5F38]">
                  <UserIcon size={20} strokeWidth={2.5} />
               </div>
            </div>
          </div>
        </div>
      </nav>
      {/*  NAVBAR END  */}

      {/* 1. Profile Header */}
      <ProfileHeader />

      {/* 2. Main Content Area */}
      <main className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 flex flex-col gap-8">
        
        {/* Row 1: Capability Trend (Full Width) */}
        <section className="w-full">
            <CapabilityTrend />
        </section>

        {/* Row 2: Assessment History vs Skills/Certs */}
        <section className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-8 items-start">
            <div className="w-full">
               <AssessmentHistory />
            </div>
            <div className="w-full flex flex-col gap-8">
               <TopSkills />
               <Certifications />
            </div>
        </section>

        {/* Row 3: Skill Distribution vs Integrations/Strengths/Weaknesses */}
        <section className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-8 items-start">
            <div className="w-full h-full">
               <SkillDistribution />
            </div>
            <div className="w-full flex flex-col gap-8">
               <Integrations />
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Strengths />
                  <AreasForImprovement />
               </div>
            </div>
        </section>

        {/* Row 4: Recent Activity (Full Width) */}
        <section className="w-full">
            <RecentActivity />
        </section>

      </main>
    </div>
  );
};

export default EmployeeProfilePage;