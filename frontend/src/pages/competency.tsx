import { GetServerSideProps } from "next";
import { requireAuth } from "../lib/auth";
import QuickActions from "../components/QuickActions";
import { useDashboardAssessments } from "@/hooks/useDashboardAssessments";
import { FloatingTopBar } from "@/components/dashboard/FloatingTopBar";
import { FloatingTabs } from "@/components/dashboard/FloatingTabs";

interface CompetencyPageProps {
  session: any;
}

export default function CompetencyPage({ session: serverSession }: CompetencyPageProps) {
  
  // Use the dashboard assessments hook to get combined data for QuickActions
  const {
    hasAIAssessments,
    hasCustomMCQAssessments,
    hasDSAAssessments,
    hasAIMLAssessments,
    hasDesignAssessments,
    hasDataEngineeringAssessments,
    hasCloudAssessments,
    hasDevOpsAssessments,
  } = useDashboardAssessments();

  return (
    <div style={{ 
      backgroundColor: "#ffffff", 
      minHeight: "100vh",
      position: "relative",
      background: "linear-gradient(135deg, rgba(232, 250, 240, 0.3) 0%, #ffffff 50%, rgba(232, 250, 240, 0.2) 100%)",
    }}>
      {/* Subtle background pattern */}
      <div style={{
        position: "absolute",
        inset: 0,
        backgroundImage: "radial-gradient(circle at 50% 50%, rgba(30, 90, 59, 0.03) 0%, transparent 50%)",
        pointerEvents: "none",
        zIndex: 0,
      }} />
      
      <FloatingTopBar />
      <FloatingTabs />
      <div className="container" style={{ 
        paddingTop: "7rem", 
        paddingLeft: "clamp(1rem, 4vw, 1.5rem)",
        paddingRight: "clamp(1rem, 4vw, 1.5rem)",
        position: "relative", 
        zIndex: 1,
        maxWidth: "100%",
      }}>
        <div className="card" style={{ 
          marginBottom: "2rem",
          background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
          border: "1.5px solid #A8E8BC",
          borderRadius: "clamp(0.75rem, 2vw, 1rem)",
          boxShadow: "0 4px 12px rgba(168, 232, 188, 0.15)",
          padding: "clamp(1rem, 3vw, 1.5rem)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "clamp(1rem, 3vw, 1.5rem)" }}>
            {/* Enhanced Header Section */}
            <div style={{ 
              padding: "clamp(1rem, 3vw, 1.5rem) 0",
              borderBottom: "2px solid #E8FAF0",
              background: "linear-gradient(135deg, rgba(232, 250, 240, 0.5) 0%, #ffffff 100%)",
              borderRadius: "0.5rem 0.5rem 0 0",
            }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "clamp(0.5rem, 2vw, 0.75rem)",
                flexWrap: "wrap",
              }}>
                <div style={{
                  width: "clamp(40px, 8vw, 56px)",
                  height: "clamp(40px, 8vw, 56px)",
                  borderRadius: "0.75rem",
                  backgroundColor: "#1E5A3B",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 4px 12px rgba(30, 90, 59, 0.25)",
                  flexShrink: 0,
                }}>
                  <svg 
                    width="clamp(20px, 5vw, 28px)" 
                    height="clamp(20px, 5vw, 28px)" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="#ffffff" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <h1 style={{ 
                    margin: 0, 
                    fontSize: "clamp(1.5rem, 5vw, 2.25rem)", 
                    color: "#1E5A3B", 
                    fontWeight: 700,
                    lineHeight: 1.2,
                    marginBottom: "0.5rem",
                  }}>
                    Assessments Dashboard
                  </h1>
                  <p style={{
                    margin: 0,
                    fontSize: "clamp(0.875rem, 2.5vw, 1rem)",
                    color: "#64748b",
                    lineHeight: 1.5,
                  }}>
                    Create and manage skill assessments for your organization
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons Section */}
            <QuickActions
              hasAIAssessments={hasAIAssessments}
              hasCustomMCQAssessments={hasCustomMCQAssessments}
              hasDSAAssessments={hasDSAAssessments}
              hasAIMLAssessments={hasAIMLAssessments}
              hasDesignAssessments={hasDesignAssessments}
              hasDataEngineeringAssessments={hasDataEngineeringAssessments}
              hasCloudAssessments={hasCloudAssessments}
              hasDevOpsAssessments={hasDevOpsAssessments}
            />
          </div>
        </div>

      </div>
    </div>
  );
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth;