import React, { useEffect, useState, useRef } from "react";
import {
  Star,
  Code2,
  FileJson,
  Server,
  Terminal,
  Cloud,
  ArrowRight,
} from "lucide-react";

// --- Dynamic Data ---
const SKILLS_DATA = [
  { name: "React", score: 92, level: "EXPERT", icon: Code2 },
  { name: "TypeScript", score: 88, level: "ADVANCED", icon: FileJson },
  { name: "Node.js", score: 85, level: "ADVANCED", icon: Server },
  { name: "Python", score: 78, level: "INTERMEDIATE", icon: Terminal },
  { name: "AWS", score: 72, level: "INTERMEDIATE", icon: Cloud },
];

const getSkillColor = (level: string) => {
  switch (level) {
    case "EXPERT":
      return "#065F46";
    case "ADVANCED":
      return "#059669";
    case "INTERMEDIATE":
      return "#84A98C";
    default:
      return "#94A3B8";
  }
};

const TopSkills = () => {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;

        if (entry.isIntersecting) {
          setIsVisible(true);

          if (sectionRef.current) observer.unobserve(sectionRef.current);
        }
      },
      {
        threshold: 0.2,
      },
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) observer.unobserve(sectionRef.current);
    };
  }, []);

  return (
    <div
      ref={sectionRef}
      className="bg-white rounded-xl p-4 sm:p-6 shadow-[0_1px_3px_rgba(0,0,0,0.08)] border border-gray-200 h-full flex flex-col transition-all duration-300 hover:shadow-md"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6 sm:mb-8">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Star size={24} className="text-gray-400 relative z-10" />
            <div className="absolute inset-0 bg-yellow-100 blur-md opacity-50 rounded-full"></div>
          </div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Top Skills</h2>
        </div>
        <span className="px-2.5 py-1 sm:px-3 sm:py-1 bg-gray-100 text-gray-500 text-xs font-semibold rounded-full border border-gray-100 whitespace-nowrap">
          {SKILLS_DATA.length} Total
        </span>
      </div>

      {/* Skills List */}
      <div className="flex flex-col gap-6 sm:gap-7 flex-1">
        {SKILLS_DATA.map((skill, index) => {
          const activeColor = getSkillColor(skill.level);
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={index}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className="group cursor-default"
            >
              {/* Top Row */}
              <div className="flex justify-between items-end mb-2 sm:mb-3 transition-transform duration-300 group-hover:-translate-y-0.5">
                {/* Left: Icon & Name */}
                <div className="flex items-center gap-3 overflow-hidden">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-300 shrink-0 ${
                      isHovered ? "bg-gray-100 text-gray-900" : "bg-gray-50 text-gray-600"
                    } border border-gray-100`}
                  >
                    <skill.icon size={18} />
                  </div>
                  <span
                    className={`text-sm sm:text-base font-semibold transition-colors duration-300 truncate ${
                      isHovered ? "text-[#0A5F38]" : "text-gray-900"
                    }`}
                  >
                    {skill.name}
                  </span>
                </div>

                {/* Right: Score & Level */}
                <div className="flex flex-col sm:flex-row items-end sm:items-baseline gap-0.5 sm:gap-2 shrink-0">
                  <span
                    className="text-sm sm:text-base font-bold transition-all duration-300"
                    style={{
                      color: activeColor,
                      transform: isHovered ? "scale(1.1)" : "scale(1)",
                    }}
                  >
                    {skill.score}%
                  </span>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {skill.level}
                  </span>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div className="h-1.5 sm:h-2 w-full bg-gray-100 rounded-full overflow-hidden relative">
                {/* Background Shimmer */}
                <div className="absolute inset-0 bg-gray-100 w-full h-full"></div>

                {/* Animated Fill */}
                <div
                  className="h-full rounded-full relative"
                  style={{
                    width: isVisible ? `${skill.score}%` : "0%",
                    backgroundColor: activeColor,
                    transition: `width 1.2s cubic-bezier(0.22, 1, 0.36, 1) ${index * 150}ms`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Button */}
      <button className="w-full mt-6 sm:mt-8 py-2.5 sm:py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all duration-200 flex items-center justify-center gap-2 group active:scale-[0.98]">
        View All Skills
        <ArrowRight
          size={16}
          className="text-gray-400 group-hover:text-gray-600 transition-transform duration-300 group-hover:translate-x-1"
        />
      </button>
    </div>
  );
};

export default TopSkills;