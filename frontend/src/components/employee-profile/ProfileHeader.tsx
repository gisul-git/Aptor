import React from 'react';
import { Share2, FileDown, Building2, Calendar, Pencil } from 'lucide-react';

const ProfileHeader = () => {
  return (
    <div className="w-full bg-[#F5FFFA]">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 sm:py-8">
        
        {/* Main Flex Container: Stack vertical on mobile, Row on Large screens */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          
          {/* Left: Avatar & Info */}
          {/* Stack vertical on tiny screens, horizontal on small+ screens */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 w-full lg:w-auto">
            
            {/* Avatar */}
            <div className="relative shrink-0 self-start sm:self-center">
              <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-[#0A5F38] flex items-center justify-center text-white text-xl sm:text-3xl font-bold shadow-sm">
                TM
              </div>
            </div>

            {/* User Details */}
            <div className="flex flex-col gap-1 w-full">
              
              {/* Name Row */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-[32px] font-semibold text-gray-900 leading-tight">
                  Tushar Mishra
                </h1>
                <button className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100">
                  <Pencil size={14} className="sm:w-4 sm:h-4" />
                </button>
              </div>
              
              {/* Role */}
              <p className="text-sm sm:text-lg text-gray-600 font-normal mb-2 sm:mb-2">
                Senior Full Stack Developer
              </p>

              {/* Metadata Badges - Flex wrap for small screens */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500">
                {/* ID Pill */}
                <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-white text-gray-600 rounded-full border border-gray-200 tracking-wide whitespace-nowrap">
                  # A-2024-1234
                </span>
                
                {/* Organization */}
                <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                  <Building2 size={14} className="text-gray-400 sm:w-4 sm:h-4" />
                  <span>Accenture</span>
                </div>

                {/* Date */}
                <div className="flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                  <Calendar size={14} className="text-gray-400 sm:w-4 sm:h-4" />
                  <span>Joined Jan 2024</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          {/* Full width container on mobile, auto on desktop */}
          <div className="flex items-center gap-3 w-full lg:w-auto mt-2 lg:mt-0 shrink-0">
            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-white border border-gray-300 rounded-lg text-gray-700 text-sm sm:text-base font-medium hover:bg-gray-50 hover:border-gray-400 transition-all shadow-sm">
              <Share2 size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span>Share</span>
            </button>
            
            <button className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-[#0A5F38] border border-transparent rounded-lg text-white text-sm sm:text-base font-medium hover:bg-[#047857] transition-all shadow-sm">
              <FileDown size={16} className="sm:w-[18px] sm:h-[18px]" />
              <span>Export PDF</span>
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;