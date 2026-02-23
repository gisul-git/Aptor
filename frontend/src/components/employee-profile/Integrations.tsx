import React from 'react';
import { Link2, Github, Linkedin, BookOpen, Slack, CheckCircle2 } from 'lucide-react';

const INTEGRATIONS = [
  { 
    name: 'GitHub', 
    desc: '15 commits this month', 
    icon: Github, 
    status: 'Connected' 
  },
  { 
    name: 'LinkedIn', 
    desc: '2 certifications added', 
    icon: Linkedin, 
    status: 'Connected' 
  },
  { 
    name: 'Udemy', 
    desc: '3 courses in progress', 
    icon: BookOpen, 
    status: 'Connected' 
  },
  { 
    name: 'Slack', 
    desc: 'Not connected', 
    icon: Slack, 
    status: 'Connect' 
  },
];

const Integrations = () => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-200 h-full">
      
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <Link2 size={20} className="text-gray-500 " strokeWidth={2.5} />
        <h2 className="text-2xl font-semibold text-gray-900">Integrations</h2>
      </div>

      {/* Integration List */}
      <div className="flex flex-col gap-4">
        {INTEGRATIONS.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-4 border border-gray-100 rounded-xl bg-white hover:border-gray-200 transition-colors">
            
            <div className="flex items-center gap-4">
              {/* Icon Box */}
              <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center text-gray-600 border border-gray-100 shrink-0">
                <item.icon size={22} strokeWidth={1.5} />
              </div>
              
              {/* Text Content */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 leading-tight mb-1">{item.name}</h4>
                
                <div className="flex items-center gap-1.5">
                  {/* Conditionally render green checkmark for connected items */}
                  {item.status === 'Connected' && (
                    <CheckCircle2 size={12} className="text-[#0A5F38] fill-transparent" strokeWidth={2} />
                  )}
                  <p className="text-xs text-gray-500 ">{item.desc}</p>
                </div>
              </div>
            </div>

            {/* Action Button/Badge */}
            {item.status === 'Connected' ? (
              <span className="px-4 py-1.5 bg-[#025a3b] text-white text-sm font-medium rounded-full tracking-wide shadow-sm">
                Connected
              </span>
            ) : (
              <button className="px-5 py-1.5 bg-white border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm">
                Connect
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Integrations;