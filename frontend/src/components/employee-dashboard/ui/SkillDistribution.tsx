import React, { useState, useEffect } from 'react';
import { Info } from 'lucide-react';

export interface SkillData {
  category: string; 
  score: number;    
}

interface SkillDistributionProps {
  data: SkillData[];
}

const SkillDistribution: React.FC<SkillDistributionProps> = ({ data }) => {
  const [animate, setAnimate] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setAnimate(true), 200);
    return () => clearTimeout(timer);
  }, []);

  // --- Radar Chart Logic ---
  const size = 300;
  const center = size / 2;
  const radius = 100; 
  const angleSlice = (Math.PI * 2) / data.length;

  const getCoordinates = (value: number, index: number) => {
    const angle = index * angleSlice - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const dataPoints = data.map((d, i) => {
      const { x, y } = getCoordinates(animate ? d.score : 0, i);
      return `${x},${y}`;
    }).join(" ");

  const renderGrid = (level: number) => {
    return data.map((_, i) => {
      const { x, y } = getCoordinates(level, i);
      return `${x},${y}`;
    }).join(" ");
  };

  return (
    <div style={{
      backgroundColor: "#ffffff",
      borderRadius: "1rem",
      padding: "2rem",
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
      border: "1px solid #E2E8F0",
      display: "flex",
      flexDirection: "column",
      gap: "2.5rem",
      minHeight: "600px"
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>Skill Distribution</h2>
        <Info size={20} color="#94A3B8" style={{ cursor: 'pointer' }} />
      </div>

      {/* Content Container */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem", flex: 1 }}>
        
        {/* 1. Radar Chart Area */}
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "320px", position: "relative" }}>
          <svg width={size} height={size} style={{ overflow: "visible" }}>
            <defs>
              <filter id="tooltipShadow" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="rgba(0,0,0,0.15)" />
              </filter>
            </defs>

            {/* A. Grid Levels */}
            {[100, 75, 50, 25].map((level) => (
              <polygon
                key={level}
                points={renderGrid(level)}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="1"
                strokeDasharray="4 4"
              />
            ))}
            
            {/* B. Axes Lines */}
            {data.map((_, i) => {
              const { x, y } = getCoordinates(100, i);
              return <line key={i} x1={center} y1={center} x2={x} y2={y} stroke="#E2E8F0" strokeWidth="1" />;
            })}
            
            {/* C. The Main Shape */}
            <polygon
              points={dataPoints}
              fill="rgba(16, 185, 129, 0.15)" 
              stroke="#10B981" 
              strokeWidth="2"
              strokeLinejoin="round"
              style={{ transition: "all 1.5s cubic-bezier(0.22, 1, 0.36, 1)" }}
            />

            {/* D. Static Labels (MOVED UP: Rendered BEFORE tooltip so they are behind it) */}
            {data.map((d, i) => {
              const labelPos = getCoordinates(125, i);
              return (
                <text
                  key={i}
                  x={labelPos.x}
                  y={labelPos.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={hoveredIndex === i ? "#10B981" : "#64748B"}
                  style={{ 
                    fontSize: "0.75rem", 
                    fontWeight: hoveredIndex === i ? 700 : 600,
                    transition: "color 0.2s ease"
                  }}
                >
                  {d.category}
                </text>
              );
            })}

            {/* E. Interactive Dots (Circles) */}
            {data.map((d, i) => {
               const { x, y } = getCoordinates(animate ? d.score : 0, i);
               const isHovered = hoveredIndex === i;

               return (
                 <circle 
                    key={i}
                    cx={x} cy={y} r={isHovered ? 8 : 5} 
                    fill="#ffffff" stroke="#10B981" strokeWidth={isHovered ? 3 : 2}
                    style={{ 
                      transition: "all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)", 
                      cursor: "pointer"
                    }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                 />
               );
            })}

            {/* F. The Tooltip (Rendered LAST to float on top of everything) */}
            {hoveredIndex !== null && (() => {
               const d = data[hoveredIndex];
               const { x, y } = getCoordinates(animate ? d.score : 0, hoveredIndex);
               
               return (
                 <g 
                    style={{ 
                       transform: `translate(${x}px, ${y - 15}px)`,
                       pointerEvents: 'none',
                       transition: "transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)"
                    }}
                 >
                    {/* Tooltip Box */}
                    <rect 
                       x="-45" y="-60" 
                       width="90" height="50" 
                       rx="8" fill="white" 
                       filter="url(#tooltipShadow)"
                    />
                    {/* Arrow */}
                    <polygon points="-6,-10 6,-10 0,0" fill="white" transform="translate(0, -11)" />
                    
                    {/* Category Name */}
                    <text 
                       x="0" y="-42" 
                       textAnchor="middle" 
                       fill="#64748B" 
                       fontSize="10" 
                       fontWeight="600"
                    >
                       {d.category}
                    </text>
                    
                    {/* Score Number */}
                    <text 
                       x="0" y="-22" 
                       textAnchor="middle" 
                       fill="#0F172A" 
                       fontSize="18" 
                       fontWeight="800"
                    >
                       {d.score}%
                    </text>
                 </g>
               );
            })()}

          </svg>
        </div>

        {/* 2. Skills List Grid */}
        <div style={{ 
            display: "grid", 
            gridTemplateColumns: "1fr 1fr", 
            gap: "1rem",
            alignContent: "start"
        }}>
          {data.map((skill, index) => (
            <div 
              key={index} 
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                backgroundColor: hoveredIndex === index ? "#DCFCE7" : "#F0FDF4",
                borderRadius: "0.5rem",
                padding: "0.75rem 1rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "background-color 0.2s ease",
                cursor: "pointer"
            }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "#334155" }}>
                  {skill.category}
                </span>
                
                <span style={{ 
                  backgroundColor: "#065F46", 
                  color: "#ffffff",
                  fontSize: "0.75rem", 
                  fontWeight: 700, 
                  padding: "0.25rem 0.75rem", 
                  borderRadius: "99px"
                }}>
                  {skill.score}%
                </span>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default SkillDistribution;