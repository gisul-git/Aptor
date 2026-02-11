import React, { useRef } from 'react';
import { FileText, BookOpen, Award, Github, ArrowRight } from 'lucide-react';

export type ActivityType = 'assessment' | 'learning' | 'certification' | 'github';

export interface ActivityItem {
  id: string | number;
  type: ActivityType;
  title: string;
  time: string;
  tag?: string; 
}

interface RecentActivityProps {
  activities: ActivityItem[];
}

const RecentActivity: React.FC<RecentActivityProps> = ({ activities }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const getStyles = (type: ActivityType) => {
    switch (type) {
      case 'assessment':
        return { 
          icon: <FileText size={20} />, 
          bg: '#ECFDF5', color: '#059669', // Mint
          pillBg: '#F1F5F9', pillText: '#64748B'
        };
      case 'learning':
        return { 
          icon: <BookOpen size={20} />, 
          bg: '#F3E8FF', color: '#7E22CE', // Purple
          pillBg: '#F1F5F9', pillText: '#64748B'
        };
      case 'certification':
        return { 
          icon: <Award size={20} />, 
          bg: '#FEF3C7', color: '#D97706', // Yellow
          pillBg: '#FFFBEB', pillText: '#B45309'
        };
      case 'github':
        return { 
          icon: <Github size={20} />, 
          bg: '#DBEAFE', color: '#2563EB', // Blue
          pillBg: '#EFF6FF', pillText: '#1E40AF'
        };
      default:
        return { icon: <FileText size={20} />, bg: '#F1F5F9', color: '#64748B', pillBg: '#F1F5F9', pillText: '#475569' };
    }
  };

  return (
    <div style={{
      width: "100%",
      backgroundColor: "#ffffff",
      borderRadius: "1rem",
      padding: "1.5rem",
      border: "1px solid #E2E8F0",
      boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
      marginBottom: "3rem",
      boxSizing: "border-box"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F172A", margin: 0 }}>Recent Activity</h2>
        <button style={{ 
          background: "none", border: "none", cursor: "pointer", 
          display: "flex", alignItems: "center", gap: "0.25rem",
          fontSize: "0.875rem", fontWeight: 600, color: "#065F46"
        }}>
          View All <ArrowRight size={16} />
        </button>
      </div>

      <div 
        ref={scrollRef}
        style={{
          display: "flex",
          gap: "1.5rem",
          overflowX: "auto",
          paddingBottom: "0.5rem",
          scrollbarWidth: "none", 
          msOverflowStyle: "none",
        }}
        className="hide-scrollbar"
      >
        <style>{`.hide-scrollbar::-webkit-scrollbar { display: none; }`}</style>

        {activities.map((item) => {
          const style = getStyles(item.type);
          
          return (
            <div 
              key={item.id}
              style={{
                minWidth: "320px",
                backgroundColor: "#ffffff",
                border: "1px solid #E2E8F0",
                borderRadius: "0.75rem",
                padding: "1.25rem",
                display: "flex",
                gap: "1rem",
                cursor: "pointer",
                transition: "border-color 0.2s"
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = "#CBD5E1"}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = "#E2E8F0"}
            >
              {/* Icon */}
              <div style={{
                width: "44px", height: "44px", borderRadius: "0.5rem",
                backgroundColor: style.bg, color: style.color,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0
              }}>
                {style.icon}
              </div>

              {/* Text Content */}
              <div style={{ flex: 1 }}>
                <h3 style={{ 
                  margin: "0 0 0.5rem 0", fontSize: "0.95rem", fontWeight: 600, color: "#1E293B",
                  lineHeight: 1.4
                }}>
                  {item.title}
                </h3>
                
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  {item.tag && (
                    <span style={{
                        backgroundColor: style.pillBg, color: style.pillText,
                        padding: "0.15rem 0.6rem", borderRadius: "99px",
                        fontSize: "0.7rem", fontWeight: 600, textTransform: 'lowercase'
                    }}>
                        {item.tag}
                    </span>
                  )}
                  <span style={{ fontSize: "0.75rem", color: "#94A3B8" }}>
                    {item.time}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentActivity;