import React from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Target } from "lucide-react";

const RADAR_DATA = [
  { subject: "General", A: 88, fullMark: 100 },
  { subject: "DSA", A: 85, fullMark: 100 },
  { subject: "AI/ML", A: 79, fullMark: 100 },
  { subject: "Cloud", A: 88, fullMark: 100 },
  { subject: "DevOps", A: 75, fullMark: 100 },
  { subject: "Data Eng", A: 72, fullMark: 100 },
  { subject: "Design", A: 68, fullMark: 100 },
];

const SKILL_SCORES = [
  { name: "General", score: 88 },
  { name: "DSA", score: 85 },
  { name: "AI/ML", score: 79 },
  { name: "Cloud", score: 88 },
  { name: "DevOps", score: 75 },
  { name: "Data Eng", score: 72 },
  { name: "Design", score: 68 },
];

// Custom Tooltip Component
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-100 flex flex-col items-center min-w-[100px] animate-in fade-in zoom-in duration-200">
        <p className="text-sm font-bold text-gray-900 mb-1">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{payload[0].value}%</p>
      </div>
    );
  }
  return null;
};

const SkillDistribution = () => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-200 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-2">
          <Target size={24} className="text-gray-400 stroke-[1.5]" />
          <h2 className="text-2xl font-semibold text-gray-900">
            Skill Distribution
          </h2>
        </div>
        {/* Info Icon placeholder if needed */}
        <div className="text-gray-300 cursor-pointer hover:text-gray-500">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
        </div>
      </div>

      {/* Radar Chart */}
      <div className="h-[320px] w-full mb-6 relative -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={RADAR_DATA}>
            <PolarGrid stroke="#E2E8F0" strokeDasharray="3 3" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "#475569", fontSize: 12, fontWeight: 500 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={false}
              axisLine={false}
            />

            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: "#0A5F38",
                strokeWidth: 1,
                strokeDasharray: "4 4",
              }}
            />

            <Radar
              name="Skills"
              dataKey="A"
              stroke="#0A5F38"
              strokeWidth={2}
              fill="#0A5F38"
              fillOpacity={0.15}
              activeDot={{
                r: 6,
                fill: "#0A5F38",
                stroke: "white",
                strokeWidth: 2,
              }}
              isAnimationActive={true}
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score Grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 mt-auto">
        {SKILL_SCORES.map((skill, index) => (
          <div
            key={index}
            className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 shadow-sm hover:border-gray-200 transition-colors bg-[#F9FAFB]"
          >
            <span className="text-sm font-medium text-gray-600">
              {skill.name}
            </span>
            <span className="px-3 py-1 bg-[#0A5F38] text-white text-sm font-medium rounded-full">
              {skill.score}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SkillDistribution;
