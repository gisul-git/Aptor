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

  const getTheme = (level: SkillLevel) => {
    switch (level) {
      case 'Expert':
      case 'Advanced': return { color: '#065F46' }; 
      case 'Intermediate': return { color: '#84A98C' }; 
      default: return { color: '#94A3B8' };
    }
  };

  return (
    <>
      <style>{`
        /* --- CONTAINER --- */
        .top-skills-card {
          background-color: #ffffff;
          border-radius: 1rem;
          border: 1px solid #E2E8F0;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
          margin-bottom: 2rem;
          padding: 1.5rem; /* Desktop Padding */
        }

        /* --- HEADER --- */
        .skills-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .skills-title {
          font-size: 1.25rem;
          font-weight: 800;
          color: #0F172A;
          margin: 0;
        }

        .skills-badge {
          font-size: 0.75rem;
          color: #64748B;
          background-color: #F1F5F9;
          padding: 0.25rem 0.75rem;
          border-radius: 99px;
          font-weight: 600;
        }

        /* --- SKILL ITEM ROW --- */
        .skill-item {
          padding: 0.75rem 1rem;
          /* Negative margin allows hover effect to bleed out while keeping text aligned */
          margin: 0 -1rem; 
          border-radius: 0.75rem;
          cursor: pointer;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        .skill-info-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 0.5rem;
        }

        .skill-name {
          font-size: 1rem;
          font-weight: 700;
          color: #0F172A;
          transition: color 0.3s ease;
        }

        .skill-meta {
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
        }

        .skill-percent {
          font-size: 1rem;
          font-weight: 800;
        }

        .skill-level-text {
          font-size: 0.75rem;
          font-weight: 700;
          color: #94A3B8;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        /* --- RESPONSIVE BREAKPOINTS --- */
        
        /* Mobile (Max Width: 480px) */
        @media (max-width: 480px) {
          .top-skills-card {
            padding: 1rem; /* Reduced padding */
          }
          
          .skills-title {
            font-size: 1.1rem;
          }

          /* Adjust Hover Item Spacing */
          .skill-item {
            padding: 0.5rem 0.75rem;
            margin: 0 -0.75rem;
          }

          .skill-name {
            font-size: 0.9rem;
          }

          .skill-percent {
            font-size: 0.9rem;
          }
          
          .skill-level-text {
            font-size: 0.7rem;
          }
        }
      `}</style>

      <div ref={sectionRef} className="top-skills-card">
        {/* Header */}
        <div className="skills-header">
           <h2 className="skills-title">Top Skills</h2>
           <span className="skills-badge">{skills.length} Total</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {skills.map((skill, index) => {
            const theme = getTheme(skill.level);
            const isHovered = hoveredIndex === index;

            return (
              <div 
                key={index}
                className="skill-item"
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                // Dynamic styles kept inline for interactivity
                style={{
                  backgroundColor: isHovered ? "#F8FAFC" : "transparent",
                  transform: isHovered ? "translateX(6px) scale(1.02)" : "translateX(0) scale(1)",
                  boxShadow: isHovered ? "0 4px 12px -2px rgba(0, 0, 0, 0.05)" : "none",
                  border: isHovered ? "1px solid #F1F5F9" : "1px solid transparent"
                }}
              >
                {/* Info Row */}
                <div className="skill-info-header">
                  <span className="skill-name">
                    {skill.name}
                  </span>
                  
                  <div className="skill-meta">
                     <span className="skill-percent" style={{ color: theme.color }}>
                       {skill.percentage}%
                     </span>
                     <span className="skill-level-text">
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
                    filter: isHovered ? "brightness(1.1)" : "brightness(1)",
                    transition: `width 1.5s cubic-bezier(0.22, 1, 0.36, 1) ${index * 150}ms, filter 0.3s ease`
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default TopSkills;