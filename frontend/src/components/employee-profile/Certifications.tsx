import React from 'react';
import { Award, Cloud, FileCode, Layers, Calendar, Building2, FileJson, Server } from 'lucide-react';

// --- Dynamic Data ---
const CERT_DATA = [
  { 
    title: 'AWS Certified Solutions Architect', 
    provider: 'Amazon Web Services', 
    date: 'Jan 2024', 
    verified: true,
    icon: Cloud 
  },
  { 
    title: 'React Advanced Patterns', 
    provider: 'Udemy', 
    date: 'Dec 2023', 
    verified: true,
    icon: FileCode
  },
  { 
    title: 'TypeScript Mastery', 
    provider: 'LinkedIn Learning', 
    date: 'Nov 2023', 
    verified: true,
    icon: FileJson
  },
  { 
    title: 'Node.js Production Best Practices', 
    provider: 'Coursera', 
    date: 'Oct 2023', 
    verified: true,
    icon: Server
  },
  { 
    title: 'Full Stack Development', 
    provider: 'freeCodeCamp', 
    date: 'Sep 2023', 
    verified: true,
    icon: Layers
  },
];

const Certifications = () => {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-200 h-fit">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <Award size={24} className="text-gray-400" />
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Certifications</h2>
        </div>
        <span className="px-3 py-1 bg-gray-100 text-gray-500 text-xs font-bold rounded-full border border-gray-100 whitespace-nowrap">
          {CERT_DATA.length} Earned
        </span>
      </div>

      {/* Cert List */}
      <div className="flex flex-col gap-4">
        {CERT_DATA.map((cert, index) => (
          <div key={index} className="group p-3 sm:p-4 border border-gray-100 rounded-xl hover:border-gray-200 hover:shadow-sm transition-all flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 bg-white relative">
            
            <div className="flex items-start gap-3 w-full sm:w-auto">
              {/* Icon Box */}
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gray-50 flex items-center justify-center shrink-0 border border-gray-100 text-gray-500 group-hover:text-gray-700 group-hover:bg-gray-100 transition-colors">
                 <cert.icon size={20} className="sm:w-[22px] sm:h-[22px]" strokeWidth={1.5} />
              </div>

              {/* Mobile Title Wrapper (Title + Badge on same row for mobile if space permits, or stacked) */}
              <div className="flex-1 min-w-0 sm:hidden">
                 <h4 className="text-sm font-semibold text-gray-900 leading-tight mb-1 break-words">
                   {cert.title}
                 </h4>
                 {/* Mobile Verified Badge */}
                 {cert.verified && (
                    <span className="inline-flex items-center px-2 py-0.5 bg-gray-50 text-gray-500 text-[10px] font-medium rounded border border-gray-100 tracking-wide mt-1">
                      Verified
                    </span>
                 )}
              </div>
            </div>

            {/* Content (Desktop Layout & Mobile Details) */}
            <div className="flex-1 min-w-0 w-full pl-0 sm:pl-0"> 
            {/* Added pl-0 to reset padding on desktop if needed, though flex handles spacing via gap */}
            
               {/* Desktop Title */}
               <h4 className="hidden sm:block text-base font-semibold text-gray-900 truncate leading-tight mb-2">
                 {cert.title}
               </h4>
               
               {/* Metadata Row: Provider & Date */}
               <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 font-medium">
                  {/* Provider */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto">
                    <Building2 size={14} className="text-gray-400 shrink-0" />
                    <span className="truncate max-w-[200px] sm:max-w-none text-xs sm:text-sm">{cert.provider}</span>
                  </div>
                  
                  <span className="text-gray-300 hidden sm:inline">•</span>
                  
                  {/* Date */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto mt-1 sm:mt-0">
                    <Calendar size={14} className="text-gray-400 shrink-0" />
                    <span className='text-xs sm:text-sm'>{cert.date}</span>
                  </div>
               </div>
            </div>

            {/* Verified Badge (Desktop Position) */}
            {cert.verified && (
              <span className="hidden sm:inline-flex shrink-0 px-3 py-1 bg-gray-50 text-gray-500 text-xs font-medium rounded-full border border-gray-100 tracking-wide">
                Verified
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Certifications;