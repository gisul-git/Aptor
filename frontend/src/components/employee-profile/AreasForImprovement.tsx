import React from 'react';
import { AlertCircle, Target } from 'lucide-react';

const AREAS = [
  { name: 'MySQL', score: '62% proficiency' },
  { name: 'Kubernetes', score: '68% proficiency' },
];

const AreasForImprovement = () => {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-200 h-full">
      
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 sm:mb-6">
        <Target size={20} className="text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Areas for Improvement</h2>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {AREAS.map((item, index) => (
          <div key={index} className="p-3 sm:p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
            
            {/* Icon */}
            <div className="mt-0.5 w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center shrink-0">
               <AlertCircle size={16} className="text-gray-500" />
            </div>
            
            {/* Content */}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs sm:text-base font-semibold text-gray-900 truncate">
                {item.name}
              </h4>
              <p className="text-xs sm:text-sm text-gray-500 font-medium mb-2 sm:mb-3">
                {item.score}
              </p>
              
              {/* Responsive Button: Full width on mobile, auto on desktop */}
              <button className="w-full sm:w-auto px-3 py-1.5 sm:py-1.5 bg-white border border-gray-200 rounded-lg text-xs sm:text-[12px] font-bold text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm text-center">
                View Learning Path
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AreasForImprovement;