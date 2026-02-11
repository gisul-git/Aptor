import React from 'react';
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
  return (
    <div className="min-h-screen bg-[#F0FDF4]/30 pb-12 font-sans text-gray-900">
      
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
           
           {/* Left Column */}
           <div className="w-full">
              <AssessmentHistory />
           </div>

           {/* Right Column */}
           <div className="w-full flex flex-col gap-8">
              <TopSkills />
              <Certifications />
           </div>

        </section>

        {/* Row 3: Skill Distribution vs Integrations/Strengths/Weaknesses */}
        <section className="grid grid-cols-1 lg:grid-cols-[55%_45%] gap-8 items-start">
           
           {/* Left Column: Skill Distribution (Radar) */}
           <div className="w-full h-full">
              <SkillDistribution />
           </div>

           {/* Right Column: Stacked Components */}
           <div className="w-full flex flex-col gap-8">
              
              {/* Integrations Card */}
              <Integrations />

              {/* Strengths & Weaknesses Grid */}
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