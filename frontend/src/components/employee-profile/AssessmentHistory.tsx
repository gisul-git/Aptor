import React from "react";
import {
  Code,
  Database,
  Cloud,
  Brain,
  ChevronRight,
  Clock,
  Calendar,
} from "lucide-react";

//  Data Structure for Future API 
const ASSESSMENT_DATA = [
  {
    id: 1,
    type: "General",
    title: "Full Stack Developer Assessment",
    date: "Jun 15, 2024",
    duration: "45 min",
    score: 91,
    icon: Code,
    details: [
      { label: "Frontend", value: 95 },
      { label: "Backend", value: 88 },
      { label: "Database", value: 90 },
    ],
  },
  {
    id: 2,
    type: "DSA",
    title: "Data Structures & Algorithms",
    date: "May 28, 2024",
    duration: "60 min",
    score: 85,
    icon: Database,
    details: [
      { label: "Arrays", value: 90 },
      { label: "Trees", value: 82 },
      { label: "Graphs", value: 83 },
    ],
  },
  {
    id: 3,
    type: "Cloud",
    title: "AWS Cloud Architecture",
    date: "Apr 20, 2024",
    duration: "50 min",
    score: 88,
    icon: Cloud,
    details: [
      { label: "EC2", value: 92 },
      { label: "S3", value: 85 },
      { label: "Lambda", value: 87 },
    ],
  },
  {
    id: 4,
    type: "AI/ML",
    title: "Machine Learning Fundamentals",
    date: "Mar 12, 2024",
    duration: "55 min",
    score: 79,
    icon: Brain,
    details: [
      { label: "Supervised", value: 82 },
      { label: "Unsupervised", value: 76 },
      { label: "Neural Networks", value: 79 },
    ],
  },
];

const AssessmentHistory = () => {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4 sm:gap-0">
        <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Assessment History</h2>
        <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full whitespace-nowrap">
          {ASSESSMENT_DATA.length} Completed
        </span>
      </div>

      {/* Timeline List */}
      <div className="flex flex-col gap-6 sm:gap-8 relative">
        {/* Vertical Connecting Line (Hidden on Mobile) */}
        <div className="hidden sm:block absolute left-[19px] top-4 bottom-4 w-[2px] bg-gray-100 z-0"></div>

        {ASSESSMENT_DATA.map((item, index) => (
          // On mobile: remove left padding (pl-0). On desktop: add padding for timeline (pl-14)
          <div key={item.id} className="relative z-10 pl-0 sm:pl-14 group">
            
            {/* Timeline Icon (Hidden on Mobile) */}
            <div className="hidden sm:flex absolute left-0 top-0 w-10 h-10 rounded-full bg-white border border-gray-200 items-center justify-center text-[#0A5F38] shadow-sm transition-all duration-300 group-hover:border-[#0A5F38] group-hover:border-2">
              <item.icon size={18} />
            </div>

            {/* Assessment Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-4 sm:p-5 hover:shadow-md transition-shadow duration-200 cursor-pointer w-full">
              
              {/* Top Row: Mobile Icon + Type Badge + Score */}
              <div className="flex flex-col sm:flex-row justify-between items-start mb-2 gap-4 sm:gap-0">
                <div className="w-full sm:w-auto">
                   {/* Mobile-only Header Row with Icon */}
                   <div className="flex items-center gap-3 mb-3 sm:hidden">
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-[#0A5F38]">
                        <item.icon size={16} />
                      </div>
                      <span className="inline-block px-2.5 py-0.5 bg-white border border-gray-200 text-gray-500 text-xs font-medium rounded-full shadow-sm">
                        {item.type}
                      </span>
                   </div>

                   {/* Desktop Type Badge (Hidden on Mobile to avoid duplication) */}
                  <span className="hidden sm:inline-block px-3 py-1 bg-white border border-gray-200 text-gray-500 text-xs font-medium rounded-full mb-3 shadow-sm">
                    {item.type}
                  </span>

                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 leading-tight">
                    {item.title}
                  </h3>
                </div>

                {/* Score Section */}
                <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0">
                  <span className="text-sm font-medium text-gray-500 sm:hidden">Score</span>
                  <div className="text-right">
                    <span className="block text-xl sm:text-2xl font-semibold text-gray-900 leading-none">
                      {item.score}
                    </span>
                    <span className="hidden sm:block text-xs text-gray-400 font-medium mt-1">
                      Score
                    </span>
                  </div>
                </div>
              </div>

              {/* Meta Data */}
              <div className="flex flex-wrap items-center gap-4 text-gray-500 mb-5 text-sm">
                <div className="flex items-center gap-1.5">
                  <Calendar size={14} className="shrink-0" />
                  <span>{item.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock size={14} className="shrink-0" />
                  <span>{item.duration}</span>
                </div>
              </div>

              {/* Progress Bars for Sub-skills */}
              <div className="space-y-3 mb-4">
                {item.details.map((detail, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    {/* Fixed width label on desktop, smaller/responsive on mobile */}
                    <span className="w-20 sm:w-24 text-xs text-gray-600 font-medium shrink-0 truncate">
                      {detail.label}
                    </span>
                    <div className="flex-1 h-1.5 sm:h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#0A5F38] to-[#88B89D] rounded-full"
                        style={{ width: `${detail.value}%` }}
                      />
                    </div>
                    <span className="text-xs sm:text-sm text-gray-700 font-medium w-8 text-right">
                      {detail.value}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer Link */}
              <button className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-[#0A5F38] transition-colors mt-2 w-full sm:w-auto justify-center sm:justify-start py-2 sm:py-0 bg-gray-50 sm:bg-transparent rounded sm:rounded-none">
                View Details <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssessmentHistory;