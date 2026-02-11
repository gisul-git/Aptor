import React from 'react';
import { TrendingUp, CheckCircle2 } from 'lucide-react';

const STRENGTHS = [
  { name: 'React', score: '92% proficiency' },
  { name: 'TypeScript', score: '88% proficiency' },
  { name: 'Node.js', score: '85% proficiency' },
];

const Strengths = () => {
  return (
    <div className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-200 h-full">
      
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-4 sm:mb-6">
        <TrendingUp size={22} className="text-[#0A5F38]" strokeWidth={2} />
        <h2 className="text-lg font-semibold text-gray-900">Strengths</h2>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3 sm:gap-4">
        {STRENGTHS.map((item, index) => (
          <div key={index} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition-colors">
            
            {/* Green Icon Box - Responsive Size */}
            <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-lg bg-[#0A5F38] flex items-center justify-center shrink-0 shadow-sm">
               <CheckCircle2 size={10} className="text-white sm:w-5 sm:h-5" strokeWidth={1.5} />
            </div>
            
            {/* Text Content */}
            <div className="flex flex-col min-w-0">
              <h4 className="text-sm sm:text-base font-semibold text-gray-900 leading-tight mb-0.5 sm:mb-1 truncate">
                {item.name}
              </h4>
              <p className="text-xs sm:text-sm text-gray-500 font-medium truncate">
                {item.score}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Strengths;