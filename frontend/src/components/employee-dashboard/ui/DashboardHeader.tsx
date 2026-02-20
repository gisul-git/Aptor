import React from 'react';
import CapabilityGauge from './CapabilityGauge';
import WelcomeSection from './WelcomeSection';

export interface EmployeeData {
  name: string;
  role?: string; 
  department?: string;
}

interface DashboardHeaderProps {
  employeeData: EmployeeData;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({ employeeData }) => {
  return (
    // Container: 
    // - Flex-col by default (Mobile) -> Flex-row on Large screens (lg:)
    // - Gap scales from 2rem (8) -> 5rem (20)
    <div className="relative flex flex-col lg:flex-row items-center gap-8 lg:gap-20 mb-8 lg:mb-12 p-6 lg:p-10">
      
      {/* Background Blob */}
      {/* Hidden on very small screens, visible on sm+ */}
      <div
        className="hidden sm:block absolute top-[-50px] left-[50px] w-[250px] h-[250px] bg-[#D1FAE5] opacity-40 rounded-full blur-[80px] -z-10 pointer-events-none"
      />

      {/* 1. Gauge Component */}
      {/* shrink-0 prevents the gauge from getting squished */}
      <div className="shrink-0 w-full lg:w-auto flex justify-center">
        <CapabilityGauge score={78} increase={12} />
      </div>

      {/* 2. Welcome Section */}
      {/* Text center on mobile, left on desktop */}
      <div className="w-full text-center lg:text-left">
        <WelcomeSection 
          userName={employeeData.name} 
          companyName="Accenture" 
          certCount={5} 
          assessmentCount={12} 
        />
      </div>
    </div>
  );
};

export default DashboardHeader;