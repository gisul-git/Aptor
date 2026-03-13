import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import type { GetServerSideProps } from "next";
import { requireAuth } from "../../lib/auth";
import AssessmentsList from "../../components/AssessmentsList";
import { FloatingTopBar } from "@/components/dashboard/FloatingTopBar";
import { FloatingTabs } from "@/components/dashboard/FloatingTabs";
import ConfirmationModal from "@/components/ConfirmationModal";
import { useDashboardAssessments, type Assessment } from "@/hooks/useDashboardAssessments";
import {
  useCloudTests,
  useDeleteCloudTest,
  usePauseCloudTest,
  useResumeCloudTest,
  useCloneCloudTest,
} from "@/hooks/api/useCloud";

export default function CloudAssessmentsPage() {
  const { data: session, update: updateSession } = useSession();
  const router = useRouter();
  const { refetch: refetchCloud } = useCloudTests();
  const { assessments, isLoading: loading, error } = useDashboardAssessments();

  const deleteCloudTestMutation = useDeleteCloudTest();
  const pauseCloudTestMutation = usePauseCloudTest();
  const resumeCloudTestMutation = useResumeCloudTest();
  const cloneCloudTestMutation = useCloneCloudTest();

  const cloudAssessments = useMemo(
    () => (Array.isArray(assessments) ? assessments.filter((a) => a.type === "cloud") : []),
    [assessments]
  );
  const [fallbackCloudAssessments, setFallbackCloudAssessments] = useState<Assessment[]>([]);
  const mergedCloudAssessments = useMemo(() => {
    const byId = new Map<string, Assessment>();
    [...fallbackCloudAssessments, ...cloudAssessments].forEach((item) => {
      if (!item?.id) return;
      const existing = byId.get(String(item.id));
      byId.set(String(item.id), { ...(existing || {}), ...item } as Assessment);
    });
    return Array.from(byId.values()).sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });
  }, [cloudAssessments, fallbackCloudAssessments]);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [uiError, setUiError] = useState<string | null>(null);
  const [cloning, setCloning] = useState(false);
  const [resuming, setResuming] = useState<{ show: boolean; testName: string }>({ show: false, testName: "" });
  const [pausing, setPausing] = useState<{ show: boolean; testName: string }>({ show: false, testName: "" });
  const [cloneModal, setCloneModal] = useState<{
    show: boolean;
    assessmentId: string | null;
    assessmentTitle: string;
    newTitle: string;
  }>({
    show: false,
    assessmentId: null,
    assessmentTitle: "",
    newTitle: "",
  });
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    assessmentId: string | null;
    assessmentTitle: string;
    isDeleting: boolean;
  }>({
    isOpen: false,
    assessmentId: null,
    assessmentTitle: "",
    isDeleting: false,
  });

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (openMenuId && !target.closest(`[data-menu-id="${openMenuId}"]`)) {
        setOpenMenuId(null);
      }
    };

    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [openMenuId]);

  useEffect(() => {
    const handleTokenRefresh = async (event: Event) => {
      const customEvent = event as CustomEvent<{ backendToken: string; refreshToken: string }>;
      const { backendToken, refreshToken } = customEvent.detail || {};
      try {
        await updateSession({ backendToken, refreshToken });
        setTimeout(() => refetchCloud(), 250);
      } catch (err) {
        console.error("Failed to update NextAuth session:", err);
      }
    };

    window.addEventListener("token-refreshed", handleTokenRefresh);
    return () => window.removeEventListener("token-refreshed", handleTokenRefresh);
  }, [updateSession, refetchCloud]);

  useEffect(() => {
    if (router.query.refresh) {
      refetchCloud();
      router.replace("/cloud/assessments", undefined, { shallow: true });
    }
  }, [router.query.refresh, refetchCloud, router]);

  useEffect(() => {
    let active = true;
    const loadFallbackCloud = async () => {
      try {
        const response = await fetch("/api/cloud/list-tests");
        const json = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const rows = Array.isArray(json?.data) ? json.data : [];
        const mapped: Assessment[] = rows.map((test: any) => {
          const schedule = test?.schedule || {};
          const hasSchedule = !!(test?.start_time && test?.end_time);
          const questionCount = Array.isArray(test?.question_ids)
            ? test.question_ids.length
            : Array.isArray(test?.questions)
              ? test.questions.length
              : 0;
          const totalAssigned = Array.isArray(test?.invited_users) ? test.invited_users.length : 0;
          const assignedCount = typeof test?.assignedCount === "number" ? test.assignedCount : null;
          const avgScoreRaw = [test?.avg_score, test?.avgScore, test?.average_score, test?.averageScore].find(
            (v) => typeof v === "number"
          );

          let status: "draft" | "active" | "paused" = "draft";
          if (test?.pausedAt) status = "paused";
          else if (test?.is_published) status = "active";
          return {
            id: test.id || test._id,
            title: test.title || "Untitled Cloud Test",
            status,
            hasSchedule,
            scheduleStatus: {
              startTime: test.start_time,
              endTime: test.end_time,
              duration: test.duration_minutes || test.duration || schedule?.duration || 0,
              isActive: !!test.is_active,
            },
            createdAt: test.created_at || null,
            updatedAt: test.updated_at || null,
            type: "cloud" as const,
            is_published: !!test.is_published,
            is_active: !!test.is_active,
            pausedAt: test.pausedAt || undefined,
            questionCount,
            assignedCount,
            totalAssigned,
            avgScore: typeof avgScoreRaw === "number" ? avgScoreRaw : 0,
          };
        });
        if (active) setFallbackCloudAssessments(mapped);
      } catch {
        // Keep primary hook data if fallback fails.
      }
    };
    loadFallbackCloud();
    return () => {
      active = false;
    };
  }, []);

  const handleDeleteAssessment = (assessmentId: string, assessmentTitle: string) => {
    setDeleteModal({
      isOpen: true,
      assessmentId,
      assessmentTitle,
      isDeleting: false,
    });
  };

  const confirmDeleteAssessment = async () => {
    if (!deleteModal.assessmentId) return;
    try {
      setDeleteModal((prev) => ({ ...prev, isDeleting: true }));
      setUiError(null);
      await deleteCloudTestMutation.mutateAsync(deleteModal.assessmentId);
      setDeleteModal({
        isOpen: false,
        assessmentId: null,
        assessmentTitle: "",
        isDeleting: false,
      });
    } catch (err: any) {
      setUiError(err?.message || "Failed to delete assessment");
      setDeleteModal((prev) => ({ ...prev, isDeleting: false }));
    }
  };

  const cancelDeleteAssessment = () => {
    setDeleteModal({
      isOpen: false,
      assessmentId: null,
      assessmentTitle: "",
      isDeleting: false,
    });
  };

  const handlePauseAssessment = async (assessmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    const assessment = mergedCloudAssessments.find((a) => a.id === assessmentId);
    const testName = assessment?.title || "Cloud Assessment";
    setPausing({ show: true, testName });
    setUiError(null);
    try {
      await pauseCloudTestMutation.mutateAsync(assessmentId);
      setPausing({ show: false, testName: "" });
    } catch (err: any) {
      setUiError(err?.message || "Failed to pause assessment");
      setPausing({ show: false, testName: "" });
    }
  };

  const handleResumeAssessment = async (assessmentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenMenuId(null);
    const assessment = mergedCloudAssessments.find((a) => a.id === assessmentId);
    const testName = assessment?.title || "Cloud Assessment";
    setResuming({ show: true, testName });
    setUiError(null);
    try {
      await resumeCloudTestMutation.mutateAsync(assessmentId);
      setResuming({ show: false, testName: "" });
    } catch (err: any) {
      setUiError(err?.message || "Failed to resume assessment");
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
      await cloneCloudTestMutation.mutateAsync({
        testId: assessmentId,
        newTitle: newTitle.trim(),
        keepSchedule: false,
        keepCandidates: false,
      });
      setCloneModal({ show: false, assessmentId: null, assessmentTitle: "", newTitle: "" });
      setOpenMenuId(null);
      await refetchCloud();
      alert("Assessment cloned successfully");
    } catch (err: any) {
      setUiError(err?.message || "Failed to clone assessment");
    } finally {
      setCloning(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-mint-50/90 via-white to-forest-50/70 relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full bg-mint-100/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute top-1/3 -left-32 w-[400px] h-[400px] rounded-full bg-forest-100/30 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-20 right-1/4 w-[300px] h-[300px] rounded-full bg-mint-200/25 blur-3xl" aria-hidden />
      <FloatingTopBar />
      <FloatingTabs />
      <div className="assessments-container relative z-10" style={{ paddingTop: "6rem" }}>
        {error || uiError ? (
          <div className="card">
            <div className="alert alert-error">{error || uiError}</div>
            <button type="button" className="btn-primary" onClick={() => { refetchCloud(); setUiError(null); }} style={{ marginTop: "1rem" }}>
              Retry
            </button>
          </div>
        ) : (
          <AssessmentsList
            assessments={mergedCloudAssessments}
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

      {pausing.show && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "1rem", padding: "2rem", maxWidth: "400px", width: "90%", boxShadow: "0 20px 50px rgba(0, 0, 0, 0.15)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", fontWeight: 600, color: "#1a1625" }}>Pausing the test</h3>
            <p style={{ margin: 0, fontSize: "0.9375rem", color: "#64748b" }}>{pausing.testName}</p>
          </div>
        </div>
      )}

      {resuming.show && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "1rem", padding: "2rem", maxWidth: "400px", width: "90%", boxShadow: "0 20px 50px rgba(0, 0, 0, 0.15)", textAlign: "center" }}>
            <h3 style={{ margin: "0 0 0.5rem", fontSize: "1.125rem", fontWeight: 600, color: "#1a1625" }}>Resuming the test</h3>
            <p style={{ margin: 0, fontSize: "0.9375rem", color: "#64748b" }}>{resuming.testName}</p>
          </div>
        </div>
      )}

      {cloneModal.show && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2100, padding: "1rem" }}>
          <div style={{ backgroundColor: "#fff", borderRadius: "1rem", width: "100%", maxWidth: "540px", padding: "1.5rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.25)" }}>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#111827" }}>Clone Assessment</h3>
            <p style={{ margin: "0.5rem 0 1rem 0", color: "#6B7280", fontSize: "0.92rem" }}>
              Cloning <strong>{cloneModal.assessmentTitle}</strong>
            </p>
            <input
              type="text"
              value={cloneModal.newTitle}
              onChange={(e) => setCloneModal((p) => ({ ...p, newTitle: e.target.value }))}
              style={{ width: "100%", padding: "0.7rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", marginBottom: "1rem" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
              <button type="button" onClick={() => setCloneModal({ show: false, assessmentId: null, assessmentTitle: "", newTitle: "" })} style={{ padding: "0.6rem 1rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", background: "#fff", color: "#374151", fontWeight: 600 }}>
                Cancel
              </button>
              <button
                type="button"
                disabled={cloning || !cloneModal.assessmentId}
                onClick={() => cloneModal.assessmentId && handleCloneAssessment(cloneModal.assessmentId, cloneModal.newTitle)}
                style={{ padding: "0.6rem 1rem", border: "none", borderRadius: "0.5rem", background: "#00684A", color: "#fff", fontWeight: 700, opacity: cloning ? 0.7 : 1 }}
              >
                {cloning ? "Cloning..." : "Clone"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        title="Delete Assessment"
        message={`Are you sure you want to delete "${deleteModal.assessmentTitle}"? This action cannot be undone.`}
        confirmText={deleteModal.isDeleting ? "Deleting..." : "Delete"}
        cancelText="Cancel"
        type="danger"
        onConfirm={confirmDeleteAssessment}
        onCancel={cancelDeleteAssessment}
        isLoading={deleteModal.isDeleting}
      />
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;


