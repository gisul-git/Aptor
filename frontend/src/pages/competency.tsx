import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { GetServerSideProps } from "next";
import { requireAuth } from "../lib/auth";
import QuickActions from "../components/QuickActions";
import { useDashboardAssessments } from "@/hooks/useDashboardAssessments";
import { FloatingTopBar } from "@/components/dashboard/FloatingTopBar";

interface CompetencyPageProps {
  session: any;
}

export default function CompetencyPage({ session: serverSession }: CompetencyPageProps) {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  
  // Use server session if available, fallback to client session
  const activeSession = serverSession || session;
  
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
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <FloatingTopBar />
      <div className="container" style={{ paddingTop: "6rem" }}>
        <div className="card" style={{ 
          marginBottom: "2rem",
          background: "linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)",
          border: "1.5px solid #A8E8BC",
          borderRadius: "1rem",
          boxShadow: "0 4px 12px rgba(168, 232, 188, 0.15)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {/* Header Section */}
            <div style={{ 
              paddingBottom: "1.5rem",
              borderBottom: "2px solid #E8FAF0",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "250px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                    <div style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "0.75rem",
                      backgroundColor: "#2D7A52",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(45, 122, 82, 0.2)",
                    }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                    </div>
                    <div>
                      <h1 style={{ 
                        margin: 0, 
                        fontSize: "clamp(1.5rem, 4vw, 2rem)", 
                        color: "#1a1625", 
                        fontWeight: 700,
                        lineHeight: 1.2,
                      }}>
                        Assessments Dashboard
                      </h1>
                    </div>
                  </div>
                </div>
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}>
                  {/* Employee Management Button */}
                  <button
                    onClick={() => router.push('/employee/management')}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      padding: "0.625rem 1rem",
                      backgroundColor: "#2D7A52",
                      color: "#ffffff",
                      border: "none",
                      borderRadius: "0.75rem",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      boxShadow: "0 2px 4px rgba(45, 122, 82, 0.2)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#1e5a3b";
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 4px 8px rgba(45, 122, 82, 0.3)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#2D7A52";
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 4px rgba(45, 122, 82, 0.2)";
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    <span>Employee Management</span>
                  </button>
                  
                  {/* User Info */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.625rem 1rem",
                    backgroundColor: "#E8FAF0",
                    borderRadius: "0.75rem",
                    border: "1px solid #A8E8BC",
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2D7A52" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span style={{ 
                      color: "#2D7A52", 
                      fontSize: "0.875rem",
                      fontWeight: 500,
                    }}>
                      {activeSession?.user?.name || activeSession?.user?.email || "User"}
                    </span>
                  </div>
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