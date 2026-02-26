import React from 'react';
import { AlertCircle, Target } from 'lucide-react';

const AREAS = [
  { name: 'MySQL', score: '62% proficiency' },
  { name: 'Kubernetes', score: '68% proficiency' },
];

const AreasForImprovement = () => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-200 h-full">
      <div className="flex items-center gap-2 mb-6">
        <Target size={20} className="text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">Areas for Improvement</h2>
      </div>

      <div className="flex flex-col gap-3">
        {AREAS.map((item, index) => (
          <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-100 flex items-start gap-3">
            <div className="mt-0.5 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
               <AlertCircle size={12} className="text-gray-500" />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-900">{item.name}</h4>
              <p className="text-xs text-gray-500 mb-2">{item.score}</p>
              <button className="px-3 py-1.5 bg-white border border-gray-200 rounded text-[12px] font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-colors">
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