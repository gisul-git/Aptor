import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { GetServerSideProps } from "next";
import { requireAuth } from "../lib/auth";
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
import { useDashboardAssessments } from "@/hooks/useDashboardAssessments";
import { FloatingTopBar } from "@/components/dashboard/FloatingTopBar";
import { FloatingTabs } from "@/components/dashboard/FloatingTabs";
import ConfirmationModal from "@/components/ConfirmationModal";

interface AssessmentsPageProps {
  session: any;
}

export default function AssessmentsPage({ session: serverSession }: AssessmentsPageProps) {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  
  // React Query hooks for refetching
  const { refetch: refetchAssessments } = useAssessments();
  const { refetch: refetchCustomMCQ } = useCustomMCQAssessments();
  const { refetch: refetchDSA } = useDSATests();
  const { refetch: refetchAIML } = useAIMLTests();
  const { refetch: refetchDesign } = useDesignTests();
  const { refetch: refetchDataEngineering } = useDataEngineeringTests();
  const { refetch: refetchCloud } = useCloudTests();
  const { refetch: refetchDevOps } = useDevOpsTests();
  
  // Use the dashboard assessments hook to get combined data
  const {
    assessments,
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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [cloneModal, setCloneModal] = useState<{ show: boolean; assessmentId: string | null; assessmentTitle: string; newTitle: string }>({
    show: false,
    assessmentId: null,
    assessmentTitle: "",
    newTitle: "",
  });
  const [cloning, setCloning] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [resuming, setResuming] = useState<{ show: boolean; testName: string }>({ show: false, testName: "" });
  const [pausing, setPausing] = useState<{ show: boolean; testName: string }>({ show: false, testName: "" });
  const [deleteModal, setDeleteModal] = useState<{ 
    isOpen: boolean; 
    assessmentId: string | null; 
    assessmentTitle: string; 
    assessmentType?: 'assessment' | 'dsa' | 'custom_mcq' | 'aiml' | 'design' | 'data_engineering' | 'cloud' | 'devops';
    isDeleting: boolean;
  }>({
    isOpen: false,
    assessmentId: null,
    assessmentTitle: '',
    isDeleting: false,
  });

  useEffect(() => {
    // Close menu when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (openMenuId && !target.closest(`[data-menu-id="${openMenuId}"]`)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openMenuId]);

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
      router.replace('/assessments', undefined, { shallow: true });
    }
  }, [router.query.refresh, refetchAssessments, refetchCustomMCQ, refetchDSA, refetchAIML, refetchDesign, refetchDataEngineering, refetchCloud, refetchDevOps, router]);

  const handleDeleteAssessment = (assessmentId: string, assessmentTitle: string, assessmentType?: 'assessment' | 'dsa' | 'custom_mcq' | 'aiml' | 'design' | 'data_engineering' | 'cloud' | 'devops') => {
    // Open delete confirmation modal instead of browser confirm
    setDeleteModal({
      isOpen: true,
      assessmentId,
      assessmentTitle,
      assessmentType,
      isDeleting: false,
    });
  };

  const confirmDeleteAssessment = async () => {
    if (!deleteModal.assessmentId) return;

    try {
      setDeleteModal(prev => ({ ...prev, isDeleting: true }));
      setUiError(null);
      
      const assessmentId = deleteModal.assessmentId;
      const assessmentType = deleteModal.assessmentType;
      
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
      
      // Close modal and React Query will automatically refetch and update the UI
      setDeleteModal({
        isOpen: false,
        assessmentId: null,
        assessmentTitle: '',
        isDeleting: false,
      });
    } catch (err: any) {
      console.error("Error deleting assessment:", err);
      setUiError(err.message || "Failed to delete assessment");
      setDeleteModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  const cancelDeleteAssessment = () => {
    setDeleteModal({
      isOpen: false,
      assessmentId: null,
      assessmentTitle: '',
      isDeleting: false,
    });
  };

  const handlePauseAssessment = async (assessmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    
    // Find the assessment to get its name and type
    const assessment = assessments.find(a => a.id === assessmentId);
    const assessmentType = assessment?.type || 'assessment';
    const testName = assessment?.title || "Assessment";
    
    // Show pausing modal immediately
    setPausing({ show: true, testName });
    setUiError(null);
    
    try {
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
      // Close the modal after successful pause
      setPausing({ show: false, testName: "" });
    } catch (err: any) {
      console.error("Error pausing assessment:", err);
      setUiError(err.message || "Failed to pause assessment");
      // Close the modal on error as well
      setPausing({ show: false, testName: "" });
    }
  };

  const handleResumeAssessment = async (assessmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    
    // Find the assessment to get its name and type
    const assessment = assessments.find(a => a.id === assessmentId);
    const assessmentType = assessment?.type || 'assessment';
    const testName = assessment?.title || "Assessment";
    
    // Show resuming modal immediately
    setResuming({ show: true, testName });
    setUiError(null);
    
    try {
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
      // Close the modal after successful resume
      setResuming({ show: false, testName: "" });
    } catch (err: any) {
      console.error("Error resuming assessment:", err);
      setUiError(err.message || "Failed to resume assessment");
      // Close the modal on error as well
      setResuming({ show: false, testName: "" });
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
      
      // Manually refetch all assessments to ensure the cloned test appears
      await Promise.all([
        refetchAssessments(),
        refetchCustomMCQ(),
        refetchDSA(),
        refetchAIML(),
        refetchDesign(),
        refetchDataEngineering(),
        refetchCloud(),
        refetchDevOps()
      ]);
      
      alert("Assessment cloned successfully");
    } catch (err: any) {
      console.error("Error cloning assessment:", err);
      setUiError(err.message || "Failed to clone assessment");
    } finally {
      setCloning(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-mint-50/90 via-white to-forest-50/70 relative overflow-hidden">
      {/* Soft decorative blobs - mint cream ambience */}
      <div className="pointer-events-none absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-mint-100/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute top-1/3 -left-32 w-[400px] h-[400px] rounded-full bg-forest-100/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[300px] h-[300px] rounded-full bg-mint-200/25 blur-3xl" aria-hidden />
      <FloatingTopBar />
      <FloatingTabs />
      <div className="assessments-container relative z-10" style={{ paddingTop: "6rem" }}>
        {(error || uiError) ? (
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
            isLoading={loading}
          />
        )}
      </div>

      {/* Pausing Modal */}
      {pausing.show && (
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
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}} />
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "1rem",
              padding: "2rem",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)",
              animation: "slideUp 0.2s ease-out",
              textAlign: "center",
            }}
          >
            {/* Spinner */}
            <div style={{
              width: "48px",
              height: "48px",
              margin: "0 auto 1.5rem",
              border: "4px solid #e5e7eb",
              borderTopColor: "#f59e0b",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            
            {/* Message */}
            <h3 style={{ 
              margin: "0 0 0.5rem", 
              fontSize: "1.125rem", 
              fontWeight: 600, 
              color: "#1a1625" 
            }}>
              Pausing the test
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: "0.9375rem", 
              color: "#64748b" 
            }}>
              {pausing.testName}
            </p>
          </div>
        </div>
      )}

      {/* Resuming Modal */}
      {resuming.show && (
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
            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}} />
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "1rem",
              padding: "2rem",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)",
              animation: "slideUp 0.2s ease-out",
              textAlign: "center",
            }}
          >
            {/* Spinner */}
            <div style={{
              width: "48px",
              height: "48px",
              margin: "0 auto 1.5rem",
              border: "4px solid #e5e7eb",
              borderTopColor: "#10b981",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            
            {/* Message */}
            <h3 style={{ 
              margin: "0 0 0.5rem", 
              fontSize: "1.125rem", 
              fontWeight: 600, 
              color: "#1a1625" 
            }}>
              Resuming the test
            </h3>
            <p style={{ 
              margin: 0, 
              fontSize: "0.9375rem", 
              color: "#64748b" 
            }}>
              {resuming.testName}
            </p>
          </div>
        </div>
      )}

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
                  
                  await handleCloneAssessment(cloneModal.assessmentId, cloneModal.newTitle);
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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Delete Assessment"
        message={`Are you sure you want to delete "${deleteModal.assessmentTitle}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={confirmDeleteAssessment}
        onCancel={cancelDeleteAssessment}
        isLoading={deleteModal.isDeleting}
        confirmButtonStyle={{
          backgroundColor: '#ef4444',
          color: '#ffffff',
        }}
      />
    </div>
  );
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth;