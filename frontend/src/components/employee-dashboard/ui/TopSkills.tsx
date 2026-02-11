import React, { useState, useEffect, useRef } from 'react';

export type SkillLevel = 'Expert' | 'Advanced' | 'Intermediate';

export interface TopSkillItem {
  name: string;
  percentage: number;
  level: SkillLevel;
}

interface TopSkillsProps {
  skills: TopSkillItem[];
}

const TopSkills: React.FC<TopSkillsProps> = ({ skills }) => {
  const [animate, setAnimate] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  
  // ADDED: State to track which specific skill is being hovered
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setAnimate(true);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  // Theme Logic
  const getTheme = (level: SkillLevel) => {
    switch (level) {
      case 'Expert':
      case 'Advanced':
        return { color: '#065F46' }; // Dark Forest Green
      case 'Intermediate':
        return { color: '#84A98C' }; // Sage Green
      default:
        return { color: '#94A3B8' };
    }
  };

  return (
    <div 
      ref={sectionRef} 
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "1rem",
        padding: "1.5rem",
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        marginBottom: "2rem"
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
         <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
            Top Skills
         </h2>
         <span style={{ 
            fontSize: "0.75rem", 
            color: "#64748B", 
            backgroundColor: "#F1F5F9", 
            padding: "0.25rem 0.75rem", 
            borderRadius: "99px",
            fontWeight: 600
         }}>
            {skills.length} Total
         </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {skills.map((skill, index) => {
          const theme = getTheme(skill.level);
          const isHovered = hoveredIndex === index;

          return (
            <div 
              key={index}
              // ADDED: Interaction Events
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
              // ADDED: Dynamic Styles for Hover Animation
              style={{
                padding: "0.75rem 1rem",
                // Negative margin compensates for padding so it stays aligned but has room to glow
                margin: "0 -1rem", 
                borderRadius: "0.75rem",
                cursor: "pointer",
                // Smooth spring-like transition
                transition: "all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)", 
                // Hover Effects:
                backgroundColor: isHovered ? "#F8FAFC" : "transparent",
                transform: isHovered ? "translateX(6px) scale(1.02)" : "translateX(0) scale(1)",
                boxShadow: isHovered ? "0 4px 12px -2px rgba(0, 0, 0, 0.05)" : "none",
                border: isHovered ? "1px solid #F1F5F9" : "1px solid transparent"
              }}
            >
              {/* Info Row */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "0.5rem" }}>
                <span style={{ 
                  fontSize: "1rem", 
                  fontWeight: 700, 
                  color: "#0F172A",
                  // Text color transition
                  transition: "color 0.3s ease" 
                }}>
                  {skill.name}
                </span>
                
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                   <span style={{ fontSize: "1rem", fontWeight: 800, color: theme.color }}>
                     {skill.percentage}%
                   </span>
                   <span style={{ 
                     fontSize: "0.75rem", 
                     fontWeight: 700, 
                     color: "#94A3B8", 
                     textTransform: 'uppercase',
                     letterSpacing: "0.02em"
                   }}>
                     {skill.level}
                   </span>
                </div>
              </div>

              {/* Progress Bar Container */}
              <div style={{ 
                width: "100%", 
                height: "8px", 
                backgroundColor: "#F1F5F9", 
                borderRadius: "99px", 
                overflow: "hidden" 
              }}>
                {/* Animated Fill Bar */}
                <div style={{
                  height: "100%",
                  width: `${animate ? skill.percentage : 0}%`,
                  backgroundColor: theme.color,
                  borderRadius: "99px",
                  // Combine load-in animation with hover brightness
                  filter: isHovered ? "brightness(1.1)" : "brightness(1)",
                  transition: `width 1.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 150}ms, filter 0.3s ease`
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TopSkills;