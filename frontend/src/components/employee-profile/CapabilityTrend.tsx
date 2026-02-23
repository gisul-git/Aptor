import React, { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp } from 'lucide-react';

const data = [
  { month: 'Jan', score: 66 },
  { month: 'Feb', score: 68 },
  { month: 'Mar', score: 72 },
  { month: 'Apr', score: 74 },
  { month: 'May', score: 76 },
  { month: 'Jun', score: 78 },
];

// --- Custom Tooltip Component ---
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-[0_8px_30px_rgb(0,0,0,0.12)] flex flex-col items-center min-w-[70px]">
        <span className="text-xs text-gray-400 font-medium mb-1">{label}</span>
        <span className="text-2xl font-bold text-gray-900 leading-none">
          {payload[0].value}
        </span>
      </div>
    );
  }
  return null;
};

const CapabilityTrend = () => {
  const targetScore = 78;
  const radius = 70;
  const circumference = 2 * Math.PI * radius; // ~440

  // State for animations
  const [score, setScore] = useState(0);
  const [dashOffset, setDashOffset] = useState(circumference);

  useEffect(() => {
    let animationFrameId: number;
    const duration = 1500; // 1.5 seconds for the full animation
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // --- Easing Function: EaseOutCubic ---
      // This makes both the bar and number start fast and slow down smoothly at the end
      const easeProgress = 1 - Math.pow(1 - progress, 3);

      // 1. Calculate Score based on eased progress
      const currentScore = Math.round(easeProgress * targetScore);
      setScore(currentScore);

      // 2. Calculate Stroke Offset based on eased progress
      // Full circle (circumference) -> Target empty space
      const maxOffset = circumference - (circumference * targetScore) / 100;
      const currentOffset = circumference - (circumference - maxOffset) * easeProgress;
      setDashOffset(currentOffset);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    // Start animation
    animationFrameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationFrameId);
  }, [circumference, targetScore]);

  return (
    <div className="bg-white rounded-xl p-6 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-200 w-full">
      <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-center">
        
        {/* --- LEFT: CIRCULAR GAUGE --- */}
        <div className="flex flex-col items-center justify-center lg:w-1/3 lg:border-r border-gray-100 lg:pr-12 w-full pb-8 lg:pb-0 border-b lg:border-b-0">
          <div className="relative w-48 h-48 sm:w-52 sm:h-52">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
              <defs>
                <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#0A5F38" /> {/* Deep Forest Green */}
                  <stop offset="100%" stopColor="#88B89D" /> {/* Sage Green */}
                </linearGradient>
              </defs>
              
              {/* Background Track */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="10"
              />
              
              {/* Animated Progress Bar */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="url(#gaugeGradient)"
                strokeWidth="10"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset} 
                strokeLinecap="round"
           
              />
            </svg>
            
            {/* Center Content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-5xl sm:text-[56px] font-bold text-gray-900 leading-none tracking-tight">
                {score}
              </span>
              <span className="text-gray-400 text-lg font-medium mt-1">/100</span>
              
              <div className="flex items-center gap-1 mt-2 text-[#0A5F38] bg-[#F0FDF4] px-3 py-1 rounded-full">
                <TrendingUp size={14} strokeWidth={2.5} />
                <span className="text-sm font-bold">+12</span>
              </div>
            </div>
          </div>
          
          <p className="mt-6 text-sm text-gray-600 font-medium">
            Percentile: <span className="text-gray-600 ">Top 15% in organization</span>
          </p>
        </div>

        {/* --- RIGHT: AREA CHART --- */}
        <div className="flex-1 w-full flex flex-col">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 tracking-tight">
              Capability Growth Trend
            </h2>
          </div>

          <div className="h-[200px] w-full">
            {/* @ts-ignore - recharts ResponsiveContainer type conflict with React 18 */}
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0A5F38" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#0A5F38" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={true} horizontal={true} stroke="#F1F5F9" />
                <XAxis 
                  dataKey="month" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#94A3B8', fontSize: 12 }} 
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                />
                
                {/* Custom Tooltip */}
                <Tooltip 
                  content={<CustomTooltip />}
                  cursor={{ stroke: '#0A5F38', strokeWidth: 2, strokeDasharray: '5 5' }}
                />
                
                <Area 
                  type="monotone" 
                  dataKey="score" 
                  stroke="#0A5F38" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#colorScore)" 
                  activeDot={{ r: 6, strokeWidth: 3, stroke: '#fff', fill: '#0A5F38' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-50">
             <div className="text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Starting Score</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">66</p>
             </div>
             <div className="text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Current Score</p>
                <p className="text-xl sm:text-2xl font-semibold text-gray-900">78</p>
             </div>
             <div className="text-center">
                <p className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">Total Growth</p>
                <p className="text-xl sm:text-2xl font-semibold text-[#0A5F38]">+12</p>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CapabilityTrend;