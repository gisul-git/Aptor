import React from 'react';
import { TrendingUp, CheckCircle2 } from 'lucide-react';

const STRENGTHS = [
  { name: 'React', score: '92% proficiency' },
  { name: 'TypeScript', score: '88% proficiency' },
  { name: 'Node.js', score: '85% proficiency' },
];

const Strengths = () => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-200 h-full">
      
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-6">
        <TrendingUp size={22} className="text-[#0A5F38]" strokeWidth={2} />
        <h2 className="text-lg font-semibold text-gray-900">Strengths</h2>
      </div>

      {/* List */}
      <div className="flex flex-col gap-4">
        {STRENGTHS.map((item, index) => (
          <div key={index} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-gray-300 transition-colors">
            
            {/* Green Icon Box */}
            <div className="w-8 h-8 rounded-lg bg-[#0A5F38] flex items-center justify-center shrink-0 shadow-sm">
               <CheckCircle2 size={20} className="text-white" strokeWidth={2} />
            </div>
            
            {/* Text Content */}
            <div className="flex flex-col">
              <h4 className="text-sm font-semibold text-gray-900 leading-tight mb-1">
                {item.name}
              </h4>
              <p className="text-xs text-gray-500 ">
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