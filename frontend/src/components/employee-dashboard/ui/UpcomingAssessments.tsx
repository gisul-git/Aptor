import React from 'react';
import { Code, Database, Cloud, Clock, HelpCircle, ArrowRight } from 'lucide-react';

export type AssessmentStatus = 'not_started' | 'in_progress';

export interface AssessmentItem {
  id: string | number;
  category: 'General' | 'DSA' | 'Cloud' | 'DevOps';
  title: string;
  isOverdue?: boolean;
  questions: number;
  status: AssessmentStatus;
  progress?: number; 
}

interface UpcomingAssessmentsProps {
  assessments: AssessmentItem[];
}

const UpcomingAssessments: React.FC<UpcomingAssessmentsProps> = ({ assessments }) => {
  
  const getIcon = (category: string) => {
    switch (category) {
      case 'General': return <Code size={22} />;
      case 'DSA': return <Database size={22} />;
      case 'Cloud': return <Cloud size={22} />;
      default: return <Code size={22} />;
    }
  };

  const getTheme = (category: string) => {
    switch (category) {
      case 'General': return { bg: '#ECFDF5', text: '#065F46', iconColor: '#059669' }; 
      case 'DSA': return { bg: '#ECFDF5', text: '#065F46', iconColor: '#059669' };
      case 'Cloud': return { bg: '#EFF6FF', text: '#1E40AF', iconColor: '#2563EB' }; 
      default: return { bg: '#F1F5F9', text: '#475569', iconColor: '#64748B' };
    }
  };

  return (
    <>
      <style>{`
        /* --- CARD CONTAINER --- */
        .assessment-card {
          background-color: #ffffff;
          border-radius: 1rem;
          padding: 1.75rem; /* Desktop Padding */
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
          border: 1px solid #F1F5F9;
          border-left: 6px solid #065F46; 
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          cursor: pointer;
          transition: transform 0.3s ease, box-shadow 0.3s ease, border-left-color 0.5s ease;
          width: 100%;
          box-sizing: border-box;
        }

        .assessment-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
          border-left-color: rgba(6, 95, 70, 0); 
        }

        /* --- HEADER (Icon + Status) --- */
        .assessment-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1rem;
          width: 100%;
        }

        .header-left {
          display: flex; 
          flex-direction: column; 
          gap: 0.5rem; 
          align-items: flex-start;
        }

        .header-right {
          align-self: flex-start;
        }

        /* --- TITLE --- */
        .assessment-title {
          margin: 0.25rem 0 0.5rem 0;
          font-size: 1.25rem;
          font-weight: 800;
          color: #1E293B;
          line-height: 1.3;
        }

        /* --- METADATA (Overdue, Questions) --- */
        .assessment-metadata {
          display: flex;
          gap: 1.5rem;
          font-size: 0.9rem;
          color: #64748B;
          flex-wrap: wrap;
          align-items: center;
        }

        /* --- BUTTON STYLES --- */
        .action-button {
          width: 100%;
          padding: 0.875rem;
          border-radius: 0.5rem;
          border: none;
          background-color: #065F46;
          color: #ffffff;
          font-weight: 700;
          font-size: 0.95rem;
          cursor: pointer;
          position: relative; 
          overflow: hidden;
          transition: background-color 0.2s ease;
          box-shadow: 0 4px 6px -1px rgba(6, 95, 70, 0.2);
          min-height: 48px; /* Touch target size */
        }

        .action-button:hover {
          background-color: #047857;
        }

        .btn-text {
          display: block;
          transition: all 0.4s ease;
          opacity: 1;
          transform: translateX(0);
        }

        .action-button:hover .btn-text {
          opacity: 0;
          transform: translateX(20px); 
        }

        .btn-arrow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-200%, -50%); 
          opacity: 0;
          transition: all 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .action-button:hover .btn-arrow {
          transform: translate(-50%, -50%);
          opacity: 1;
        }

        /* =========================================
           RESPONSIVE BREAKPOINTS
           ========================================= */

        /* Tablet (Max Width: 768px) */
        @media (max-width: 768px) {
          .assessment-card {
            padding: 1.5rem;
            gap: 1rem;
          }
          .assessment-title {
            font-size: 1.15rem;
          }
        }

        /* Mobile (Max Width: 480px) */
        @media (max-width: 480px) {
          .assessment-card {
            padding: 1.25rem; /* Less padding on mobile */
          }
          
          .assessment-header {
             /* Keeps them side-by-side unless super narrow */
             flex-direction: row; 
          }

          .assessment-title {
            font-size: 1.1rem; /* Smaller title */
          }
          
          .assessment-metadata {
            gap: 1rem;
            font-size: 0.85rem;
          }
        }

        /* Small Mobile (Max Width: 360px) */
        @media (max-width: 360px) {
           .assessment-card {
             padding: 1rem;
           }
           
           /* Stack header elements if screen is tiny */
           .assessment-header {
             flex-direction: column;
             align-items: flex-start;
           }
           
           .header-right {
             align-self: flex-start;
             margin-top: 0.5rem;
           }
        }
      `}</style>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", width: "100%" }}>
        {/* Section Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <h2 style={{ fontSize: "clamp(1.25rem, 4vw, 1.5rem)", fontWeight: 800, color: "#0F172A", margin: 0 }}>
            Upcoming Assessments
          </h2>
          <a href="#" style={{ fontSize: "0.9rem", fontWeight: 600, color: "#065F46", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.25rem" }}>
            View All <ArrowRight size={18} />
          </a>
        </div>

        {assessments.map((item) => {
          const theme = getTheme(item.category);
          
          return (
            <div key={item.id} className="assessment-card">
              
              {/* Top Row: Header */}
              <div className="assessment-header">
                 {/* Left: Icon + Tag */}
                 <div className="header-left">
                    <div style={{
                      width: "48px", height: "48px", borderRadius: "0.75rem",
                      backgroundColor: theme.bg, color: theme.iconColor,
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>
                      {getIcon(item.category)}
                    </div>
                    
                    <span style={{ 
                      backgroundColor: theme.bg, color: theme.text, 
                      padding: "0.2rem 0.6rem", borderRadius: "99px", 
                      fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.05em", textTransform: 'uppercase'
                    }}>
                      {item.category}
                    </span>
                 </div>

                 {/* Right: Status Badge */}
                 <div className="header-right">
                   {item.isOverdue ? (
                      <span style={{ 
                        border: "1px solid #F87171", color: "#EF4444", 
                        padding: "0.3rem 0.8rem", borderRadius: "99px", 
                        fontSize: "0.75rem", fontWeight: 700, backgroundColor: "#fff",
                        display: "inline-block"
                      }}>
                        Overdue
                      </span>
                   ) : item.status === 'not_started' ? (
                      <span style={{ 
                        border: "1px solid #F97316", color: "#EA580C", 
                        padding: "0.3rem 0.8rem", borderRadius: "99px", 
                        fontSize: "0.75rem", fontWeight: 700, backgroundColor: "#fff",
                        display: "inline-block"
                      }}>
                        Not Started
                      </span>
                   ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: "120px" }}>
                        <div style={{ flex: 1, height: "8px", backgroundColor: "#E2E8F0", borderRadius: "99px" }}>
                          <div style={{ width: `${item.progress}%`, height: "100%", backgroundColor: "#10B981", borderRadius: "99px" }} />
                        </div>
                        <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155" }}>{item.progress}%</span>
                      </div>
                   )}
                 </div>
              </div>

              {/* Middle Row: Content */}
              <div>
                <h3 className="assessment-title">
                  {item.title}
                </h3>

                <div className="assessment-metadata">
                  {item.isOverdue && (
                    <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", color: "#EF4444", fontWeight: 600 }}>
                      <Clock size={16} /> Overdue
                    </span>
                  )}
                  <span style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontWeight: 500 }}>
                    <HelpCircle size={16} /> {item.questions} questions
                  </span>
                </div>
              </div>

              {/* Bottom Row: Button */}
              <div style={{ marginTop: "auto" }}>
                <button className="action-button">
                   <span className="btn-text">
                     {item.status === 'in_progress' ? 'Continue' : 'Start Assessment'}
                   </span>
                   <div className="btn-arrow">
                     <ArrowRight size={24} />
                   </div>
                </button>
              </div>

            </div>
          );
        })}
      </div>
    </>
  );
};

export default UpcomingAssessments;