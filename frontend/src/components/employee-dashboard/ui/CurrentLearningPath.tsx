import React, { useState, useEffect, useRef } from 'react';
import { BookOpen, Lock, ArrowRight } from 'lucide-react';

export interface LearningPathItem {
  id: string | number;
  title: string;
  provider: string;
  duration: string;
  progress: number; 
  isLocked?: boolean;
}

interface CurrentLearningPathProps {
  paths: LearningPathItem[];
}

const CurrentLearningPath: React.FC<CurrentLearningPathProps> = ({ paths }) => {
  const [visible, setVisible] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Trigger Entrance Animation on Scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={containerRef}
      style={{
        backgroundColor: "#ffffff",
        borderRadius: "1rem",
        padding: "1.5rem",
        border: "1px solid #E2E8F0",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>
            Current Learning Path
        </h2>
        <span style={{ fontSize: "0.75rem", color: "#64748B", backgroundColor: "#F1F5F9", padding: "0.2rem 0.6rem", borderRadius: "99px" }}>
            3 courses
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {paths.map((item, index) => {
          const isHovered = hoveredId === item.id;
          
          return (
            <div 
              key={item.id}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                padding: "1rem",
                borderRadius: "0.75rem",
                display: "flex",
                gap: "1rem",
                alignItems: "flex-start",
                cursor: item.isLocked ? "not-allowed" : "pointer",
                
                // --- ANIMATION STYLES ---
                // 1. Entrance: Opacity and slight upward slide
                opacity: visible ? 1 : 0,
                transform: visible 
                  ? (isHovered ? "translateY(-5px)" : "translateY(0)") // Hover Lift vs Neutral
                  : "translateY(20px)", // Initial state before scroll

                // 2. Dynamic Colors based on State & Hover
                backgroundColor: item.isLocked ? "#FFFBEB" : "#ffffff",
                border: isHovered 
                  ? (item.isLocked ? "1px solid #F59E0B" : "1px solid #065F46") // Glow Orange or Green on hover
                  : (item.isLocked ? "1px solid #FCD34D" : "1px solid #E2E8F0"),

                boxShadow: isHovered 
                  ? "0 10px 20px -5px rgba(0, 0, 0, 0.1)" // Deep shadow on lift
                  : "0 1px 2px 0 rgba(0, 0, 0, 0.05)",

                // 3. Smooth Transitions
                // Staggered delay for entrance (index * 100), fast transition for hover
                transition: `
                  opacity 0.6s ease ${index * 100}ms, 
                  transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), 
                  border-color 0.3s ease, 
                  box-shadow 0.3s ease
                `
              }}
            >
              {/* Icon Box */}
              <div style={{
                width: "40px", height: "40px", borderRadius: "0.5rem",
                backgroundColor: item.isLocked ? "#F59E0B" : "#F0FDF4", 
                color: item.isLocked ? "#ffffff" : "#065F46",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                // Small icon pop animation on hover
                transform: isHovered ? "scale(1.1)" : "scale(1)",
                transition: "transform 0.3s ease"
              }}>
                {item.isLocked ? <Lock size={18} /> : <BookOpen size={20} />}
              </div>

              {/* Content */}
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                   <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "0.9rem", fontWeight: 700, color: "#1E293B", lineHeight: 1.3 }}>
                     {item.isLocked ? "Complete 80% to unlock reassessment" : item.title}
                   </h4>
                   {!item.isLocked && (
                     <span style={{ 
                        fontSize: "0.75rem", fontWeight: 700, color: "#065F46", 
                        display: "flex", alignItems: "center", gap: "2px",
                        // Arrow slide animation
                        transform: isHovered ? "translateX(4px)" : "translateX(0)",
                        transition: "transform 0.3s ease"
                     }}>
                       Continue <ArrowRight size={12} />
                     </span>
                   )}
                </div>

                {!item.isLocked && (
                   <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
                     <span style={{ 
                       backgroundColor: "#F1F5F9", color: "#64748B", 
                       padding: "0.1rem 0.5rem", borderRadius: "4px", fontSize: "0.7rem", fontWeight: 600 
                     }}>
                       {item.provider}
                     </span>
                     <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>{item.duration}</span>
                   </div>
                )}

                {/* Progress Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <div style={{ flex: 1, height: "6px", backgroundColor: item.isLocked ? "#FDE68A" : "#E2E8F0", borderRadius: "99px", overflow: "hidden" }}>
                     <div style={{ 
                       width: `${item.progress}%`, 
                       height: "100%", 
                       backgroundColor: item.isLocked ? "#D97706" : "#065F46", 
                       borderRadius: "99px",
                       // Progress bar sheen effect
                       position: "relative"
                     }}>
                        {isHovered && !item.isLocked && (
                          <div style={{
                            position: "absolute",
                            top: 0, left: 0, bottom: 0, width: "100%",
                            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                            transform: "translateX(-100%)",
                            animation: "shimmer 1s infinite"
                          }} />
                        )}
                     </div>
                  </div>
                  <span style={{ fontSize: "0.75rem", fontWeight: 700, color: item.isLocked ? "#B45309" : "#1E293B" }}>
                      {item.progress}%
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Internal CSS for the progress bar shimmer effect */}
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default CurrentLearningPath;