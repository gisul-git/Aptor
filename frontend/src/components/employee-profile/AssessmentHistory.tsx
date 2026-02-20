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

// --- Data Structure for Future API ---
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
    <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-200">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-semibold text-gray-900">Assessment History</h2>
        <span className="px-3 py-1 bg-gray-100 text-gray-600 text-xs font-semibold rounded-full">
          {ASSESSMENT_DATA.length} Completed
        </span>
      </div>

      {/* Timeline List */}
      <div className="flex flex-col gap-8 relative">
        {/* Vertical Connecting Line */}
        <div className="absolute left-[19px] top-4 bottom-4 w-[2px] bg-gray-100 z-0"></div>

        {ASSESSMENT_DATA.map((item, index) => (
          // Added 'group' class here to trigger child hover effects
          <div key={item.id} className="relative z-10 pl-14 group">
            {/* Timeline Icon */}

            <div className="absolute left-0 top-0 w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-[#0A5F38] shadow-sm transition-all duration-300 group-hover:border-[#0A5F38] group-hover:border-2">
              <item.icon size={18} />
            </div>

            {/* Assessment Card */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow duration-200 cursor-pointer">
              {/* Top Row: Type Badge & Score */}
              <div className="flex justify-between items-start mb-2">
                <div>
                  <span className="inline-block px-3 py-1 bg-white border border-gray-200 text-gray-500 text-xs font-medium rounded-full mb-3 shadow-sm">
                    {item.type}
                  </span>
                  <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                    {item.title}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="block text-2xl font-semibold text-gray-900 leading-none">
                    {item.score}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">
                    Score
                  </span>
                </div>
              </div>

              {/* Meta Data */}
              <div className="flex items-center gap-4 text-base text-gray-500 mb-5">
                <div className="flex items-center gap-1.5 text-sm">
                  <Calendar size={14} />
                  <span>{item.date}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Clock size={14} />
                  <span>{item.duration}</span>
                </div>
              </div>

              {/* Progress Bars for Sub-skills */}
              <div className="space-y-3 mb-4">
                {item.details.map((detail, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-gray-600 font-medium shrink-0">
                      {detail.label}
                    </span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-[#0A5F38] to-[#88B89D] rounded-full"
                        style={{ width: `${detail.value}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-700 font-medium w-8 text-right">
                      {detail.value}%
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer Link */}
              <button className="flex items-center gap-1 text-sm font-semibold text-gray-500 hover:text-[#0A5F38] transition-colors mt-2">
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
