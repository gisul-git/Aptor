import React from 'react';
import { Activity, ArrowRight, FileText, Award, BookOpen, Github, Clock } from 'lucide-react';

const ACTIVITIES = [
  {
    id: 1,
    type: 'assessment',
    title: 'Completed Full Stack Developer Assessment with 91% score',
    time: '2 hours ago',
    icon: FileText
  },
  {
    id: 2,
    type: 'certification',
    title: 'Earned AWS Certified Solutions Architect certification',
    time: '1 day ago',
    icon: Award
  },
  {
    id: 3,
    type: 'learning',
    title: 'Started Advanced React Patterns course on Udemy',
    time: '3 days ago',
    icon: BookOpen
  },
  {
    id: 4,
    type: 'github',
    title: 'Pushed 5 commits to main repository',
    time: '5 days ago',
    icon: Github
  },
  {
    id: 5,
    type: 'assessment',
    title: 'Completed Data Structures & Algorithms Assessment',
    time: '1 week ago',
    icon: FileText
  }
];

const RecentActivity = () => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-200">
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-2">
          <Activity size={24} className="text-gray-400" />
          <h2 className="text-2xl font-semibold text-gray-900">Recent Activity</h2>
        </div>
        <button className="text-sm font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors">
          View All <ArrowRight size={16} />
        </button>
      </div>

      {/* Timeline */}
      <div className="relative flex flex-col gap-8">
        {/* Vertical Connecting Line */}
        <div className="absolute left-[20px] top-4 bottom-4 w-[2px] bg-gray-100 z-0"></div>

        {ACTIVITIES.map((item) => (
          <div key={item.id} className="group relative z-10 pl-16">
            
            {/* Icon Circle */}
            <div className="absolute left-0 top-0 w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 transition-all duration-300 group-hover:border-[#0A5F38] group-hover:text-[#0A5F38]">
              <item.icon size={20} />
            </div>

            {/* Content */}
            <div className="flex flex-col gap-1.5">
              <h4 className="text-sm font-medium text-gray-900 group-hover:text-gray-950 transition-colors">
                {item.title}
              </h4>
              
              <div className="flex items-center gap-3 text-xs text-gray-500">
                {/* Type Badge */}
                <span className="px-2.5 py-0.5  border border-gray-100 rounded-full font-medium text-gray-500">
                  {item.type}
                </span>
                
                {/* Timestamp */}
                <div className="flex items-center gap-1">
                  <Clock size={12} className="text-gray-400" />
                  <span>{item.time}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RecentActivity;