import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { signOut, useSession } from "next-auth/react";
import { GetServerSideProps } from "next";
import { requireAuth } from "../lib/auth";
import Image from "next/image";
import QuickActions from "../components/QuickActions";
import AssessmentsList from "../components/AssessmentsList";
// React Query hooks
import { 
  useAssessments, 
  usePauseAssessment, 
  useResumeAssessment, 
  useCloneAssessment,
  useDeleteAssessment 
} from "@/hooks/api/useAssessments";
import { 
  useCustomMCQAssessments, 
  usePauseCustomMCQ, 
  useResumeCustomMCQ, 
  useCloneCustomMCQ,
  useDeleteCustomMCQAssessment 
} from "@/hooks/api/useCustomMCQ";
import { 
  useDSATests, 
  useDeleteDSATest,
  usePauseDSATest,
  useResumeDSATest,
  useCloneDSATest
} from "@/hooks/api/useDSA";
import { 
  useAIMLTests, 
  useDeleteAIMLTest,
  usePauseAIMLTest,
  useResumeAIMLTest,
  useCloneAIMLTest
} from "@/hooks/api/useAIML";
import { 
  useDesignTests, 
  useDeleteDesignTest,
  usePauseDesignTest,
  useResumeDesignTest,
  useCloneDesignTest
} from "@/hooks/api/useDesign";
import { 
  useDataEngineeringTests, 
  useDeleteDataEngineeringTest,
  usePauseDataEngineeringTest,
  useResumeDataEngineeringTest,
  useCloneDataEngineeringTest
} from "@/hooks/api/useDataEngineering";
import { 
  useCloudTests, 
  useDeleteCloudTest,
  usePauseCloudTest,
  useResumeCloudTest,
  useCloneCloudTest
} from "@/hooks/api/useCloud";
import { 
  useDevOpsTests, 
  useDeleteDevOpsTest,
  usePauseDevOpsTest,
  useResumeDevOpsTest,
  useCloneDevOpsTest
} from "@/hooks/api/useDevOps";
import { useUserProfile } from "@/hooks/auth";
import { useDashboardAssessments } from "@/hooks/useDashboardAssessments";

interface DashboardPageProps {
  session: any;
}

export default function DashboardPage({ session: serverSession }: DashboardPageProps) {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  
  // Use server session if available, fallback to client session
  const activeSession = serverSession || session;
  
  // Check if user is super_admin - show back button for super admins
  const isSuperAdmin = Boolean(activeSession && (activeSession as any)?.user?.role === "super_admin");
  
  // React Query hooks for refetching
  const { refetch: refetchAssessments } = useAssessments();
  const { refetch: refetchCustomMCQ } = useCustomMCQAssessments();
  const { refetch: refetchDSA } = useDSATests();
  const { refetch: refetchAIML } = useAIMLTests();
  const { refetch: refetchDesign } = useDesignTests();
  const { refetch: refetchDataEngineering } = useDataEngineeringTests();
  const { refetch: refetchCloud } = useCloudTests();
  const { refetch: refetchDevOps } = useDevOpsTests();
  const { data: userProfileData, isLoading: loadingProfile } = useUserProfile();
  
  // Use the dashboard assessments hook to get combined data
  const {
    assessments,
    hasAIAssessments,
    hasCustomMCQAssessments,
    hasDSAAssessments,
    hasAIMLAssessments,
    hasDesignAssessments,
    hasDataEngineeringAssessments,
    hasCloudAssessments,
    hasDevOpsAssessments,
    isLoading: loading,
    error
  } = useDashboardAssessments();
  
  // Mutations
  const pauseAssessmentMutation = usePauseAssessment();
  const resumeAssessmentMutation = useResumeAssessment();
  const cloneAssessmentMutation = useCloneAssessment();
  const deleteAssessmentMutation = useDeleteAssessment();
  const pauseCustomMCQMutation = usePauseCustomMCQ();
  const resumeCustomMCQMutation = useResumeCustomMCQ();
  const cloneCustomMCQMutation = useCloneCustomMCQ();
  const deleteCustomMCQMutation = useDeleteCustomMCQAssessment();
  const deleteDSATestMutation = useDeleteDSATest();
  const pauseDSATestMutation = usePauseDSATest();
  const resumeDSATestMutation = useResumeDSATest();
  const cloneDSATestMutation = useCloneDSATest();
  const deleteAIMLTestMutation = useDeleteAIMLTest();
  const pauseAIMLTestMutation = usePauseAIMLTest();
  const resumeAIMLTestMutation = useResumeAIMLTest();
  const cloneAIMLTestMutation = useCloneAIMLTest();
  const deleteDesignTestMutation = useDeleteDesignTest();
  const pauseDesignTestMutation = usePauseDesignTest();
  const resumeDesignTestMutation = useResumeDesignTest();
  const cloneDesignTestMutation = useCloneDesignTest();
  const deleteDataEngineeringTestMutation = useDeleteDataEngineeringTest();
  const pauseDataEngineeringTestMutation = usePauseDataEngineeringTest();
  const resumeDataEngineeringTestMutation = useResumeDataEngineeringTest();
  const cloneDataEngineeringTestMutation = useCloneDataEngineeringTest();
  const deleteCloudTestMutation = useDeleteCloudTest();
  const pauseCloudTestMutation = usePauseCloudTest();
  const resumeCloudTestMutation = useResumeCloudTest();
  const cloneCloudTestMutation = useCloneCloudTest();
  const deleteDevOpsTestMutation = useDeleteDevOpsTest();
  const pauseDevOpsTestMutation = usePauseDevOpsTest();
  const resumeDevOpsTestMutation = useResumeDevOpsTest();
  const cloneDevOpsTestMutation = useCloneDevOpsTest();
  
  // UI state
  const [showProfile, setShowProfile] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [cloneModal, setCloneModal] = useState<{ show: boolean; assessmentId: string | null; assessmentTitle: string; newTitle: string }>({
    show: false,
    assessmentId: null,
    assessmentTitle: "",
    newTitle: "",
  });
  const [cloning, setCloning] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  useEffect(() => {
    // Close profile dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showProfile && !target.closest('[data-profile-dropdown]')) {
        setShowProfile(false);
      }
      if (openMenuId && !target.closest(`[data-menu-id="${openMenuId}"]`)) {
        setOpenMenuId(null);
      }
    };

    if (showProfile || openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showProfile, openMenuId]);

  useEffect(() => {
    // Listen for token refresh events from the interceptor
    const handleTokenRefresh = async (event: Event) => {
      const customEvent = event as CustomEvent<{ backendToken: string; refreshToken: string }>;
      const { backendToken, refreshToken } = customEvent.detail;
      try {
        await updateSession({
          backendToken,
          refreshToken,
        });
        // Refetch assessments after session update
        setTimeout(() => {
          refetchAssessments();
          refetchCustomMCQ();
          refetchDSA();
          refetchAIML();
          refetchDesign();
          refetchDataEngineering();
          refetchCloud();
          refetchDevOps();
        }, 300);
      } catch (err) {
        console.error("Failed to update NextAuth session:", err);
      }
    };

    window.addEventListener("token-refreshed", handleTokenRefresh);

    // Check if session has backendToken, if not try to refresh
    if (session?.user && !session.backendToken) {
      // Trigger a session update to re-run the JWT callback
      updateSession().then(() => {
        // Wait a bit for session to update, then refetch
        setTimeout(() => {
          refetchAssessments();
          refetchCustomMCQ();
          refetchDSA();
          refetchAIML();
          refetchDesign();
          refetchDataEngineering();
          refetchCloud();
          refetchDevOps();
        }, 500);
      }).catch((err) => {
        console.error("Failed to update session:", err);
        // Try anyway
        refetchAssessments();
        refetchCustomMCQ();
        refetchDSA();
        refetchAIML();
        refetchDesign();
        refetchDataEngineering();
        refetchCloud();
        refetchDevOps();
      });
    }

    return () => {
      window.removeEventListener("token-refreshed", handleTokenRefresh);
    };
  }, [session, updateSession, refetchAssessments, refetchCustomMCQ, refetchDSA, refetchAIML, refetchDesign, refetchDataEngineering, refetchCloud, refetchDevOps]);

  // Refresh assessments when refresh query param is present
  useEffect(() => {
    if (router.query.refresh) {
      // Force fresh fetch from API
      refetchAssessments();
      refetchCustomMCQ();
      refetchDSA();
      refetchAIML();
      refetchDesign();
      refetchDataEngineering();
      refetchCloud();
      refetchDevOps();
      // Remove refresh param from URL
      router.replace('/dashboard', undefined, { shallow: true });
    }
  }, [router.query.refresh, refetchAssessments, refetchCustomMCQ, refetchDSA, refetchAIML, refetchDesign, refetchDataEngineering, refetchCloud, refetchDevOps, router]);

  const handleDeleteAssessment = async (assessmentId: string, assessmentTitle: string, assessmentType?: 'assessment' | 'dsa' | 'custom_mcq' | 'aiml' | 'design' | 'data_engineering' | 'cloud' | 'devops') => {
    if (!confirm(`Are you sure you want to delete "${assessmentTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      setUiError(null);
      
      if (assessmentType === 'dsa') {
        await deleteDSATestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'aiml') {
        await deleteAIMLTestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'custom_mcq') {
        await deleteCustomMCQMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'design') {
        await deleteDesignTestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'data_engineering') {
        await deleteDataEngineeringTestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'cloud') {
        await deleteCloudTestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'devops') {
        await deleteDevOpsTestMutation.mutateAsync(assessmentId);
      } else {
        await deleteAssessmentMutation.mutateAsync(assessmentId);
      }
      // React Query will automatically refetch and update the UI
    } catch (err: any) {
      console.error("Error deleting assessment:", err);
      setUiError(err.message || "Failed to delete assessment");
    }
  };

  const handlePauseAssessment = async (assessmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    
    try {
      setUiError(null);
      // Find the assessment to determine its type
      const assessment = assessments.find(a => a.id === assessmentId);
      const assessmentType = assessment?.type || 'assessment';
      
      // Use appropriate mutation based on type
      if (assessmentType === 'custom_mcq') {
        await pauseCustomMCQMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'aiml') {
        await pauseAIMLTestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'dsa') {
        await pauseDSATestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'design') {
        await pauseDesignTestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'data_engineering') {
        await pauseDataEngineeringTestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'cloud') {
        await pauseCloudTestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'devops') {
        await pauseDevOpsTestMutation.mutateAsync(assessmentId);
      } else {
        await pauseAssessmentMutation.mutateAsync(assessmentId);
      }
      
      // React Query will automatically refetch and update the UI
      alert("Assessment paused — current candidates may continue; new entrants are blocked");
    } catch (err: any) {
      console.error("Error pausing assessment:", err);
      setUiError(err.message || "Failed to pause assessment");
    }
  };

  const handleResumeAssessment = async (assessmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    
    try {
      setUiError(null);
      // Find the assessment to determine its type
      const assessment = assessments.find(a => a.id === assessmentId);
      const assessmentType = assessment?.type || 'assessment';
      
      // Use appropriate mutation based on type
      if (assessmentType === 'custom_mcq') {
        await resumeCustomMCQMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'aiml') {
        await resumeAIMLTestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'dsa') {
        await resumeDSATestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'design') {
        await resumeDesignTestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'data_engineering') {
        await resumeDataEngineeringTestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'cloud') {
        await resumeCloudTestMutation.mutateAsync(assessmentId);
      } else if (assessmentType === 'devops') {
        await resumeDevOpsTestMutation.mutateAsync(assessmentId);
      } else {
        await resumeAssessmentMutation.mutateAsync(assessmentId);
      }
      
      // React Query will automatically refetch and update the UI
      alert("Assessment resumed");
    } catch (err: any) {
      console.error("Error resuming assessment:", err);
      setUiError(err.message || "Failed to resume assessment");
    }
  };

  const handleCloneAssessment = async (assessmentId: string, newTitle: string) => {
    if (!newTitle || newTitle.trim().length < 3) {
      setUiError("Assessment name must be at least 3 characters");
      return;
    }

    setCloning(true);
    setUiError(null);
    
    try {
      // Find the original assessment to get its type
      const originalAssessment = assessments.find(a => a.id === assessmentId);
      const assessmentType = originalAssessment?.type || 'assessment';
      
      const cloneData = {
        newTitle: newTitle.trim(),
        keepSchedule: false,
        keepCandidates: false,
      };
      
      // Use appropriate mutation based on type
      if (assessmentType === 'dsa') {
        await cloneDSATestMutation.mutateAsync({ testId: assessmentId, ...cloneData });
      } else if (assessmentType === 'aiml') {
        await cloneAIMLTestMutation.mutateAsync({ testId: assessmentId, ...cloneData });
      } else if (assessmentType === 'custom_mcq') {
        await cloneCustomMCQMutation.mutateAsync({ assessmentId, ...cloneData });
      } else if (assessmentType === 'design') {
        await cloneDesignTestMutation.mutateAsync({ testId: assessmentId, ...cloneData });
      } else if (assessmentType === 'data_engineering') {
        await cloneDataEngineeringTestMutation.mutateAsync({ testId: assessmentId, ...cloneData });
      } else if (assessmentType === 'cloud') {
        await cloneCloudTestMutation.mutateAsync({ testId: assessmentId, ...cloneData });
      } else if (assessmentType === 'devops') {
        await cloneDevOpsTestMutation.mutateAsync({ testId: assessmentId, ...cloneData });
      } else {
        await cloneAssessmentMutation.mutateAsync({ assessmentId, ...cloneData });
      }
      
      // Close modal
      setCloneModal({ show: false, assessmentId: null, assessmentTitle: "", newTitle: "" });
      setOpenMenuId(null);
      
      // React Query will automatically refetch and update the UI
      alert("Assessment cloned successfully");
    } catch (err: any) {
      console.error("Error cloning assessment:", err);
      setUiError(err.message || "Failed to clone assessment");
    } finally {
      setCloning(false);
    }
  };

  // User profile is now handled by useUserProfile hook
  // Fallback to session data if hook data is not available
  const userProfile = userProfileData || (activeSession?.user ? {
    name: (activeSession.user as any).name,
    email: (activeSession.user as any).email,
    phone: (activeSession.user as any).phone,
    country: (activeSession.user as any).country,
  } : null);

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <header className="enterprise-header">
        <div className="enterprise-header-content">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", flex: 1, minWidth: 0, marginLeft: "-5rem" }}>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => router.push("/super-admin/dashboard")}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "rgba(255, 255, 255, 0.2)",
                  border: "1px solid rgba(255, 255, 255, 0.3)",
                  borderRadius: "0.5rem",
                  color: "#ffffff",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  transition: "background-color 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
                }}
                title="Back to Super Admin Dashboard"
              >
                <span>←</span>
                <span>Back to Super Admin</span>
              </button>
            )}
            <Image 
              src="/Aaptor%20Logo.png" 
              alt="Aaptor Logo" 
              width={250} 
              height={100} 
              style={{ 
                objectFit: "contain", 
                height: "auto", 
                maxHeight: "100px",
                width: "auto",
                maxWidth: "200px"
              }}
              priority
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0, position: "relative" }}>
            <button
              type="button"
              onClick={() => {
                setShowProfile(!showProfile);
              }}
              style={{
                marginTop: 0,
                padding: "0.5rem",
                fontSize: "1.25rem",
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                border: "1px solid rgba(255, 255, 255, 0.3)",
                borderRadius: "50%",
                color: "#ffffff",
                width: "40px",
                height: "40px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
              }}
              title={activeSession?.user?.name || activeSession?.user?.email || "Profile"}
            >
              👤
            </button>
            {showProfile && (
              <div
                data-profile-dropdown
                style={{
                  position: "absolute",
                  top: "100%",
                  right: 0,
                  marginTop: "0.5rem",
                  backgroundColor: "#ffffff",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.5rem",
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  minWidth: "250px",
                  zIndex: 1000,
                  padding: "1rem",
                }}
              >
                {loadingProfile && !userProfile ? (
                  <div style={{ textAlign: "center", padding: "1rem" }}>Loading...</div>
                ) : userProfile ? (
                  <div>
                    <div style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid #e2e8f0" }}>
                      <div style={{ fontWeight: 600, fontSize: "1rem", color: "#1a1625", marginBottom: "0.25rem" }}>
                        {userProfile.name || "User"}
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b" }}>{userProfile.email}</div>
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "#1e293b", marginBottom: "0.5rem" }}>
                      <div><strong>Phone:</strong> {userProfile.phone || "Not provided"}</div>
                      <div><strong>Country:</strong> {userProfile.country || "Not provided"}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                      className="btn-secondary"
                      style={{
                        width: "100%",
                        marginTop: "0.5rem",
                        padding: "0.5rem 1rem",
                        fontSize: "0.875rem",
                      }}
                    >
                      Sign Out
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "1rem" }}>Failed to load profile</div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="container">
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

        {loading ? (
          <div className="card">
            <div style={{ textAlign: "center", padding: "3rem" }}>
              <div className="spinner" style={{ fontSize: "2rem", marginBottom: "1rem" }}>⟳</div>
              <p style={{ color: "#2D7A52" }}>Loading assessments...</p>
            </div>
          </div>
        ) : (error || uiError) ? (
          <div className="card">
            <div className="alert alert-error">{error || uiError}</div>
            <button 
              type="button" 
              className="btn-primary" 
              onClick={() => {
                refetchAssessments();
                refetchCustomMCQ();
                refetchDSA();
                refetchAIML();
                refetchDesign();
                refetchDataEngineering();
                refetchCloud();
                refetchDevOps();
                setUiError(null);
              }} 
              style={{ marginTop: "1rem" }}
            >
              Retry
            </button>
          </div>
        ) : (
          <AssessmentsList
            assessments={assessments}
            openMenuId={openMenuId}
            onMenuToggle={(id) => setOpenMenuId(openMenuId === id ? null : id)}
            onPause={handlePauseAssessment}
            onResume={handleResumeAssessment}
            onDelete={handleDeleteAssessment}
            onClone={(id, title) => {
              setCloneModal({
                show: true,
                assessmentId: id,
                assessmentTitle: title,
                newTitle: `${title} (Copy)`,
              });
              setOpenMenuId(null);
            }}
          />
        )}
      </div>

      {/* Clone Confirmation Modal */}
      {cloneModal.show && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
            animation: "fadeIn 0.2s ease-out",
          }}
          onClick={() => {
            if (!cloning) {
              setCloneModal({ show: false, assessmentId: null, assessmentTitle: "", newTitle: "" });
            }
          }}
        >
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes fadeIn {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            @keyframes slideUp {
              from {
                opacity: 0;
                transform: translateY(20px) scale(0.95);
              }
              to {
                opacity: 1;
                transform: translateY(0) scale(1);
              }
            }
          `}} />
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "1rem",
              padding: "2rem",
              maxWidth: "520px",
              width: "90%",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)",
              animation: "slideUp 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Icon Header */}
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "1rem", 
              marginBottom: "1.25rem" 
            }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "0.75rem",
                backgroundColor: "#ecfdf5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, color: "#1a1625" }}>
                  Clone Assessment
                </h3>
                <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
                  Create a copy of "{cloneModal.assessmentTitle}"
                </p>
              </div>
            </div>

            {/* Input Field */}
            <div style={{ marginBottom: "1.5rem" }}>
              <label style={{ 
                display: "block", 
                marginBottom: "0.5rem", 
                fontSize: "0.875rem", 
                fontWeight: 500, 
                color: "#374151" 
              }}>
                New Assessment Title
              </label>
              <input
                type="text"
                value={cloneModal.newTitle}
                onChange={(e) => setCloneModal({ ...cloneModal, newTitle: e.target.value })}
                placeholder="Enter new assessment title"
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  fontSize: "0.9375rem",
                  transition: "all 0.2s",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "#10b981";
                  e.target.style.boxShadow = "0 0 0 3px rgba(16, 185, 129, 0.1)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#e5e7eb";
                  e.target.style.boxShadow = "none";
                }}
                autoFocus
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => {
                  if (!cloning) {
                    setCloneModal({ show: false, assessmentId: null, assessmentTitle: "", newTitle: "" });
                  }
                }}
                disabled={cloning}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "1.5px solid #e5e7eb",
                  borderRadius: "0.5rem",
                  backgroundColor: "#ffffff",
                  color: "#374151",
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  cursor: cloning ? "not-allowed" : "pointer",
                  opacity: cloning ? 0.6 : 1,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => {
                  if (!cloning) {
                    e.currentTarget.style.borderColor = "#d1d5db";
                    e.currentTarget.style.backgroundColor = "#f9fafb";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!cloning) {
                    e.currentTarget.style.borderColor = "#e5e7eb";
                    e.currentTarget.style.backgroundColor = "#ffffff";
                  }
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!cloneModal.assessmentId || !cloneModal.newTitle.trim() || cloning) return;
                  
                  setCloning(true);
                  try {
                    // Determine which mutation to use based on assessment type
                    const assessment = assessments.find(a => a.id === cloneModal.assessmentId);
                    const assessmentType = assessment?.type || 'assessment';
                    
                    if (assessmentType === 'dsa') {
                      await cloneDSATestMutation.mutateAsync({
                        testId: cloneModal.assessmentId,
                        newTitle: cloneModal.newTitle.trim(),
                      });
                    } else if (assessmentType === 'aiml') {
                      await cloneAIMLTestMutation.mutateAsync({
                        testId: cloneModal.assessmentId,
                        newTitle: cloneModal.newTitle.trim(),
                      });
                    } else if (assessmentType === 'custom_mcq') {
                      await cloneCustomMCQMutation.mutateAsync({
                        assessmentId: cloneModal.assessmentId,
                        newTitle: cloneModal.newTitle.trim(),
                      });
                    } else if (assessmentType === 'design') {
                      await cloneDesignTestMutation.mutateAsync({
                        testId: cloneModal.assessmentId,
                        newTitle: cloneModal.newTitle.trim(),
                      });
                    } else if (assessmentType === 'data_engineering') {
                      await cloneDataEngineeringTestMutation.mutateAsync({
                        testId: cloneModal.assessmentId,
                        newTitle: cloneModal.newTitle.trim(),
                      });
                    } else if (assessmentType === 'cloud') {
                      await cloneCloudTestMutation.mutateAsync({
                        testId: cloneModal.assessmentId,
                        newTitle: cloneModal.newTitle.trim(),
                      });
                    } else if (assessmentType === 'devops') {
                      await cloneDevOpsTestMutation.mutateAsync({
                        testId: cloneModal.assessmentId,
                        newTitle: cloneModal.newTitle.trim(),
                      });
                    } else {
                      await cloneAssessmentMutation.mutateAsync({
                        assessmentId: cloneModal.assessmentId,
                        newTitle: cloneModal.newTitle.trim(),
                      });
                    }
                    
                    setCloneModal({ show: false, assessmentId: null, assessmentTitle: "", newTitle: "" });
                  } catch (err: any) {
                    console.error("Failed to clone assessment:", err);
                    setUiError(err?.message || "Failed to clone assessment. Please try again.");
                  } finally {
                    setCloning(false);
                  }
                }}
                disabled={cloning || !cloneModal.newTitle.trim()}
                style={{
                  padding: "0.75rem 1.5rem",
                  border: "none",
                  borderRadius: "0.5rem",
                  backgroundColor: cloning || !cloneModal.newTitle.trim() ? "#9ca3af" : "#10b981",
                  color: "#ffffff",
                  fontSize: "0.9375rem",
                  fontWeight: 500,
                  cursor: cloning || !cloneModal.newTitle.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
                onMouseEnter={(e) => {
                  if (!cloning && cloneModal.newTitle.trim()) {
                    e.currentTarget.style.backgroundColor = "#059669";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!cloning && cloneModal.newTitle.trim()) {
                    e.currentTarget.style.backgroundColor = "#10b981";
                  }
                }}
              >
                {cloning ? (
                  <>
                    <div className="spinner" style={{ fontSize: "1rem" }}>⟳</div>
                    Cloning...
                  </>
                ) : (
                  "Clone Assessment"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth;
