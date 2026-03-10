import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  FileSpreadsheet,
  List,
  Mail,
  Server,
  Users,
  X,
} from "lucide-react";
import apiClient from "@/services/api/client";
import { useCloudTests } from "@/hooks/api/useCloud";

const formatDate = (dateString?: string) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  const istDate = new Date(date.getTime() + (5 * 60 + 30) * 60 * 1000);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[istDate.getMonth()];
  const day = istDate.getDate();
  const year = istDate.getFullYear();
  const hours = istDate.getHours().toString().padStart(2, "0");
  const minutes = istDate.getMinutes().toString().padStart(2, "0");
  return `${month} ${day}, ${year} ${hours}:${minutes}`;
};

interface CloudTestCard {
  id: string;
  title: string;
  description: string;
  duration_minutes: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  is_published: boolean;
  invited_users: string[];
  question_ids?: string[];
  test_token?: string;
  pausedAt?: string | null;
  schedule?: { startTime?: string; endTime?: string; duration?: number } | null;
  questions?: Array<{ id?: string; title?: string; difficulty?: string; kind?: string }>;
  created_by?: string;
  test_type?: string;
  candidateRequirements?: Record<string, any> | null;
  examMode?: "strict" | "flexible" | string;
  timer_mode?: "GLOBAL" | "PER_QUESTION" | string;
  question_timings?: Array<{ question_id: string; duration_minutes: number }>;
  proctoringSettings?: {
    aiProctoringEnabled?: boolean;
    faceMismatchEnabled?: boolean;
    liveProctoringEnabled?: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

const mapCloudTest = (t: any): CloudTestCard => ({
  id: String(t?.id || t?._id || ""),
  title: t?.title || "",
  description: t?.description || "",
  duration_minutes: t?.duration_minutes || t?.duration || t?.schedule?.duration || 60,
  start_time: t?.start_time || t?.schedule?.startTime || "",
  end_time: t?.end_time || t?.schedule?.endTime || "",
  is_active: t?.is_active !== undefined ? t.is_active : true,
  is_published: t?.is_published || false,
  invited_users: Array.isArray(t?.invited_users) ? t.invited_users : [],
  question_ids: t?.question_ids || t?.questions?.map((q: any) => q?.id || q) || [],
  questions: Array.isArray(t?.questions) ? t.questions : [],
  test_token: t?.test_token || "",
  pausedAt: t?.pausedAt || null,
  schedule: t?.schedule || null,
  created_by: t?.created_by || t?.createdBy || "",
  test_type: t?.test_type || t?.type || "",
  candidateRequirements: t?.schedule?.candidateRequirements || null,
  examMode: t?.examMode,
  timer_mode: t?.timer_mode,
  question_timings: Array.isArray(t?.question_timings) ? t.question_timings : [],
  proctoringSettings: t?.proctoringSettings || {},
  created_at: t?.created_at || t?.createdAt,
  updated_at: t?.updated_at || t?.updatedAt,
});

export default function CloudTestsListPage() {
  const router = useRouter();
  const { data: testsData, isLoading: loading, refetch } = useCloudTests();
  const [tests, setTests] = useState<CloudTestCard[]>([]);
  const [loadingById, setLoadingById] = useState(false);
  const [inviteModal, setInviteModal] = useState<{ testId: string; open: boolean }>({ testId: "", open: false });
  const [candidateName, setCandidateName] = useState("");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<{ testId: string; name: string; email: string } | null>(null);

  useEffect(() => {
    const apiTests = Array.isArray(testsData) ? (testsData as any[]) : [];
    const mapped: CloudTestCard[] = apiTests.map(mapCloudTest);
    setTests((prev) => {
      const byId = new Map<string, CloudTestCard>();
      [...mapped, ...prev].forEach((item) => {
        if (!item?.id) return;
        byId.set(String(item.id), { ...(byId.get(String(item.id)) || {}), ...item });
      });
      return Array.from(byId.values()).sort((a, b) => {
        const ta = new Date(a.created_at || 0).getTime();
        const tb = new Date(b.created_at || 0).getTime();
        return tb - ta;
      });
    });
  }, [testsData]);

  useEffect(() => {
    let active = true;
    const fetchAllFallback = async () => {
      try {
        const response = await fetch("/api/cloud/list-tests");
        const json = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const rows = Array.isArray(json?.data) ? json.data : [];
        const mapped: CloudTestCard[] = rows.map(mapCloudTest);
        if (active && mapped.length > 0) {
          setTests((prev) => {
            const byId = new Map<string, CloudTestCard>();
            [...mapped, ...prev].forEach((item) => {
              if (!item?.id) return;
              byId.set(String(item.id), { ...(byId.get(String(item.id)) || {}), ...item });
            });
            return Array.from(byId.values()).sort((a, b) => {
              const ta = new Date(a.created_at || 0).getTime();
              const tb = new Date(b.created_at || 0).getTime();
              return tb - ta;
            });
          });
        }
      } catch {
        // Keep existing list if fallback fails
      }
    };
    fetchAllFallback();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const q = router.query.testId;
    const testId = typeof q === "string" ? q : Array.isArray(q) ? q[0] : undefined;
    if (!testId) return;

    let active = true;
    const fetchById = async () => {
      setLoadingById(true);
      try {
        const response = await fetch(`/api/cloud/get-test?id=${encodeURIComponent(testId)}`);
        const json = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const t = json?.data || json;
        if (!t || !(t.id || t._id)) return;
        const mapped: CloudTestCard = mapCloudTest(t);
        if (active) {
          setTests((prev) => {
            const idx = prev.findIndex((x) => String(x.id) === String(mapped.id));
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...mapped };
              return next;
            }
            return [mapped, ...prev];
          });
        }
      } finally {
        if (active) setLoadingById(false);
      }
    };
    fetchById();
    return () => {
      active = false;
    };
  }, [router.query.testId]);

  const filteredTests = useMemo(() => {
    const q = router.query.testId;
    const selectedTestId = typeof q === "string" ? q : Array.isArray(q) ? q[0] : undefined;
    if (!selectedTestId) return tests;
    const selected = tests.filter((t) => String(t.id) === String(selectedTestId));
    const others = tests.filter((t) => String(t.id) !== String(selectedTestId));
    return [...selected, ...others];
  }, [router.query.testId, tests]);

  const updateLocalTest = (id: string, patch: Partial<CloudTestCard>) => {
    setTests((prev) => prev.map((t) => (String(t.id) === String(id) ? { ...t, ...patch } : t)));
  };

  const handlePublish = async (testId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    updateLocalTest(testId, { is_published: newStatus });
    try {
      try {
        await apiClient.patch(`/api/v1/cloud/tests/${testId}/publish`, { is_published: newStatus });
      } catch {
        await apiClient.patch(`/api/v1/cloud/tests/${testId}/publish?is_published=${newStatus}`);
      }
      await refetch();
      alert(`Test ${newStatus ? "published" : "unpublished"} successfully!`);
    } catch (error: any) {
      updateLocalTest(testId, { is_published: currentStatus });
      alert(error?.response?.data?.detail || "Failed to update publish status");
    }
  };

  const handleAddCandidate = async (testId: string) => {
    if (!candidateName.trim() || !candidateEmail.trim()) {
      alert("Please enter both name and email");
      return;
    }
    setAddingCandidate(true);
    try {
      const response = await apiClient.post(`/api/v1/cloud/tests/${testId}/add-candidate`, {
        name: candidateName.trim(),
        email: candidateEmail.trim(),
      });
      const data = response?.data?.data || {};
      setGeneratedLink({
        testId,
        name: data?.name || candidateName.trim(),
        email: data?.email || candidateEmail.trim(),
      });
      await refetch();
    } catch (error: any) {
      alert(error?.response?.data?.detail || "Failed to add candidate");
    } finally {
      setAddingCandidate(false);
    }
  };

  if (loading || loadingById) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", color: "#00684A" }}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#00684A]"></div>
          <span style={{ fontWeight: 500 }}>Loading tests...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        <div style={{ marginBottom: "2rem" }}>
          <button
            type="button"
            onClick={() => router.push("/cloud")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0",
              fontSize: "0.875rem",
              color: "#6B7280",
              backgroundColor: "transparent",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              transition: "color 0.2s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.color = "#00684A")}
            onMouseOut={(e) => (e.currentTarget.style.color = "#6B7280")}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back
          </button>
        </div>

        <div style={{ marginBottom: "2.5rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <h1 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.025em" }}>
              Test Management
            </h1>
            <p style={{ color: "#6B7280", fontSize: "1rem", margin: 0 }}>
              Manage your Cloud assessments, invite candidates, and review configurations.
            </p>
          </div>
          <button
            onClick={() => router.push("/dashboard")}
            style={{
              padding: "0.625rem 1.5rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#00684A",
              border: "none",
              borderRadius: "9999px",
              cursor: "pointer",
              boxShadow: "0 4px 6px -1px rgba(0, 104, 74, 0.2)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#084A2A")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#00684A")}
          >
            Save & Exit
          </button>
        </div>

        {filteredTests.length === 0 ? (
          <div style={{ backgroundColor: "#ffffff", padding: "4rem 2rem", borderRadius: "1rem", border: "1px dashed #D1D5DB", textAlign: "center" }}>
            <AlertCircle size={40} color="#9CA3AF" style={{ margin: "0 auto 1rem auto" }} />
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.125rem", fontWeight: 600 }}>No tests found</h3>
            <p style={{ margin: 0, color: "#6B7280", fontSize: "0.95rem" }}>
              {router.query.testId ? "The requested test could not be found." : "You have not created any tests yet."}
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
            {filteredTests.map((test) => (
              <div
                key={test.id}
                style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "1rem",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  padding: "2rem",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#00684A";
                  e.currentTarget.style.boxShadow = "0 8px 16px rgba(0, 104, 74, 0.08)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#E5E7EB";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "2rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "300px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                      <h3 style={{ margin: 0, color: "#111827", fontSize: "1.25rem", fontWeight: 700 }}>{test.title}</h3>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.625rem", borderRadius: "2rem", fontSize: "0.75rem", fontWeight: 600, color: test.is_active ? "#059669" : "#4B5563", backgroundColor: test.is_active ? "#D1FAE5" : "#F3F4F6", border: `1px solid ${test.is_active ? "#A7F3D0" : "#E5E7EB"}` }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: test.is_active ? "#059669" : "#6B7280" }} />
                        {test.is_active ? "Active" : "Inactive"}
                      </span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "0.375rem", padding: "0.25rem 0.625rem", borderRadius: "2rem", fontSize: "0.75rem", fontWeight: 600, color: test.is_published ? "#00684A" : "#6B7280", backgroundColor: test.is_published ? "#E8FAF0" : "#F3F4F6", border: `1px solid ${test.is_published ? "#A8E8BC" : "#E5E7EB"}` }}>
                        {test.is_published ? "Published" : "Draft"}
                      </span>
                    </div>

                    <p style={{ margin: "0 0 1.25rem 0", color: "#4B5563", fontSize: "0.95rem", lineHeight: "1.5" }}>
                      {test.description}
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <Clock size={14} /> {test.duration_minutes} mins
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <Calendar size={14} /> {formatDate(test.schedule?.startTime || test.start_time)} - {formatDate(test.schedule?.endTime || test.end_time)}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <Users size={14} /> {test.invited_users?.length || 0} Candidates
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <List size={14} /> {test.question_ids?.length || 0} Questions
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        Mode: {String(test.examMode || "strict")}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        Timer: {String(test.timer_mode || "GLOBAL")}
                      </span>
                    </div>

                    <div style={{ marginTop: "0.25rem", padding: "0.875rem", border: "1px solid #E5E7EB", borderRadius: "0.5rem", backgroundColor: "#FCFDFD" }}>
                      <div style={{ fontSize: "0.8rem", color: "#4B5563", marginBottom: "0.4rem", fontWeight: 700 }}>Assessment Details</div>
                      <div style={{ fontSize: "0.8rem", color: "#6B7280", lineHeight: 1.6 }}>
                        Test ID: {test.id || "-"}
                        <br />
                        Owner: {test.created_by || "-"} | Type: {test.test_type || "cloud"}
                        <br />
                        Experience Requirement: {String(test.candidateRequirements?.yearsOfExperience || test.candidateRequirements?.years_of_experience || "-")}
                        <br />
                        Start: {formatDate(test.schedule?.startTime || test.start_time) || "-"} | End: {formatDate(test.schedule?.endTime || test.end_time) || "-"}
                        <br />
                        AI Proctoring: {test.proctoringSettings?.aiProctoringEnabled ? "Enabled" : "Disabled"} | Face Mismatch: {test.proctoringSettings?.faceMismatchEnabled ? "Enabled" : "Disabled"} | Live Proctoring: {test.proctoringSettings?.liveProctoringEnabled ? "Enabled" : "Disabled"}
                        <br />
                        Created: {formatDate(test.created_at)} | Updated: {formatDate(test.updated_at)}
                        {test.timer_mode === "PER_QUESTION" && (
                          <>
                            <br />
                            Per-question timings: {Array.isArray(test.question_timings) && test.question_timings.length > 0
                              ? test.question_timings.map((qt) => `${qt.question_id}: ${qt.duration_minutes}m`).join(", ")
                              : "Not available"}
                          </>
                        )}
                        {Array.isArray(test.questions) && test.questions.length > 0 && (
                          <>
                            <br />
                            Question titles: {test.questions.map((q, idx) => q?.title || `Question ${idx + 1}`).join(" | ")}
                          </>
                        )}
                      </div>
                    </div>

                    {test.is_published && test.test_token && (
                      <div style={{ padding: "1rem", backgroundColor: "#F0F9F4", border: "1px solid #A8E8BC", borderRadius: "0.5rem", marginTop: "1rem" }}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#00684A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                          Assessment Link
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <input
                            type="text"
                            value={`${typeof window !== "undefined" ? window.location.origin : ""}/cloud/tests/${test.id}/take?token=${encodeURIComponent(test.test_token)}`}
                            readOnly
                            style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", backgroundColor: "#ffffff", fontSize: "0.875rem", fontFamily: "monospace", color: "#374151", outline: "none" }}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const link = `${window.location.origin}/cloud/tests/${test.id}/take?token=${encodeURIComponent(test.test_token || "")}`;
                              try {
                                await navigator.clipboard.writeText(link);
                                alert("Link copied to clipboard!");
                              } catch {
                                const input = document.createElement("input");
                                input.value = link;
                                document.body.appendChild(input);
                                input.select();
                                document.execCommand("copy");
                                document.body.removeChild(input);
                                alert("Link copied to clipboard!");
                              }
                            }}
                            style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.375rem", color: "#374151", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}
                          >
                            <Copy size={14} /> Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "flex-start", justifyContent: "flex-end", minWidth: "220px" }}>
                    <button
                      onClick={() => handlePublish(test.id, test.is_published || false)}
                      disabled={!test.question_ids || test.question_ids.length === 0}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        width: "100%",
                        justifyContent: "center",
                        padding: "0.5rem 1rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: test.is_published ? "#D97706" : "#00684A",
                        backgroundColor: test.is_published ? "#FEF3C7" : "#F0F9F4",
                        border: `1px solid ${test.is_published ? "#FCD34D" : "#E1F2E9"}`,
                        borderRadius: "0.5rem",
                        cursor: !test.question_ids || test.question_ids.length === 0 ? "not-allowed" : "pointer",
                        opacity: !test.question_ids || test.question_ids.length === 0 ? 0.5 : 1,
                      }}
                    >
                      {test.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
                      {test.is_published ? "Unpublish" : "Publish"}
                    </button>

                    <button
                      onClick={() => router.push(`/cloud/tests/${test.id}/take`)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        flex: 1,
                        justifyContent: "center",
                        padding: "0.5rem 1rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#374151",
                        backgroundColor: "#ffffff",
                        border: "1px solid #D1D5DB",
                        borderRadius: "0.5rem",
                        cursor: "pointer",
                      }}
                    >
                      <Server size={16} /> Open Test
                    </button>

                    <button
                      onClick={() => {
                        setInviteModal({ testId: test.id, open: true });
                        setGeneratedLink(null);
                        setCandidateName("");
                        setCandidateEmail("");
                      }}
                      disabled={!test.is_published}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.375rem",
                        width: "100%",
                        justifyContent: "center",
                        padding: "0.5rem 1rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#ffffff",
                        backgroundColor: "#00684A",
                        border: "1px solid #00684A",
                        borderRadius: "0.5rem",
                        cursor: !test.is_published ? "not-allowed" : "pointer",
                        opacity: !test.is_published ? 0.5 : 1,
                      }}
                    >
                      <Mail size={16} /> Invite Candidates
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {inviteModal.open && (
        <div
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(17, 24, 39, 0.7)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setInviteModal({ testId: "", open: false });
              setGeneratedLink(null);
              setCandidateName("");
              setCandidateEmail("");
            }
          }}
        >
          <div style={{ backgroundColor: "#ffffff", borderRadius: "1rem", width: "100%", maxWidth: "450px", padding: "2rem", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Add Candidates</h3>
              <button onClick={() => setInviteModal({ testId: "", open: false })} style={{ background: "transparent", border: "none", color: "#9CA3AF", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: "1.5rem", padding: "1.25rem", backgroundColor: "#F9FAFB", border: "1px dashed #D1D5DB", borderRadius: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                <FileSpreadsheet size={18} color="#00684A" />
                <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600, color: "#374151" }}>Bulk Upload (CSV)</h4>
              </div>
              <p style={{ margin: "0 0 1rem 0", fontSize: "0.8rem", color: "#6B7280" }}>
                Upload a CSV file containing <code style={{ backgroundColor: "#E5E7EB", padding: "0.1rem 0.3rem", borderRadius: "0.25rem" }}>name</code> and <code style={{ backgroundColor: "#E5E7EB", padding: "0.1rem 0.3rem", borderRadius: "0.25rem" }}>email</code> columns.
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const formData = new FormData();
                  formData.append("file", file);
                  try {
                    const response = await apiClient.post(`/api/v1/cloud/tests/${inviteModal.testId}/bulk-add-candidates`, formData, {
                      headers: { "Content-Type": "multipart/form-data" },
                    });
                    const summary = response?.data?.data || {};
                    alert(
                      `Bulk upload completed!\nSuccess: ${summary.success_count || 0}\nFailed: ${summary.failed_count || 0}\nDuplicates: ${summary.duplicate_count || 0}`,
                    );
                    await refetch();
                  } catch (error: any) {
                    alert(error?.response?.data?.detail || "Failed to upload CSV");
                  } finally {
                    e.target.value = "";
                  }
                }}
                style={{ width: "100%", padding: "0.625rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", backgroundColor: "#ffffff", cursor: "pointer", fontSize: "0.875rem", color: "#4B5563" }}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", margin: "1.5rem 0" }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }}></div>
              <span style={{ padding: "0 1rem", color: "#9CA3AF", fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase" }}>OR SINGLE INVITE</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#E5E7EB" }}></div>
            </div>

            {generatedLink && generatedLink.testId === inviteModal.testId ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ padding: "1rem", backgroundColor: "#F0FDF4", border: "1px solid #A7F3D0", borderRadius: "0.5rem", display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                  <CheckCircle2 size={20} color="#059669" style={{ marginTop: "0.1rem" }} />
                  <div>
                    <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.95rem", fontWeight: 600, color: "#065F46" }}>Candidate Added Successfully!</p>
                    <p style={{ margin: 0, fontSize: "0.875rem", color: "#047857" }}>
                      {generatedLink.name} ({generatedLink.email}) has been invited.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setInviteModal({ testId: "", open: false });
                    setGeneratedLink(null);
                    setCandidateName("");
                    setCandidateEmail("");
                    refetch();
                  }}
                  style={{ width: "100%", padding: "0.75rem", backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem", fontWeight: 600, color: "#374151", cursor: "pointer" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>Candidate Name</label>
                  <input
                    type="text"
                    value={candidateName}
                    onChange={(e) => setCandidateName(e.target.value)}
                    placeholder="e.g., John Doe"
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", outline: "none", boxSizing: "border-box", fontSize: "0.95rem" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 600, color: "#374151", marginBottom: "0.5rem" }}>Candidate Email</label>
                  <input
                    type="email"
                    value={candidateEmail}
                    onChange={(e) => setCandidateEmail(e.target.value)}
                    placeholder="e.g., john@example.com"
                    style={{ width: "100%", padding: "0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.5rem", outline: "none", boxSizing: "border-box", fontSize: "0.95rem" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.5rem" }}>
                  <button
                    onClick={() => {
                      setInviteModal({ testId: "", open: false });
                      setGeneratedLink(null);
                      setCandidateName("");
                      setCandidateEmail("");
                    }}
                    disabled={addingCandidate}
                    style={{ flex: 1, padding: "0.75rem", backgroundColor: "#ffffff", border: "1px solid #D1D5DB", borderRadius: "0.5rem", fontWeight: 600, color: "#374151", cursor: addingCandidate ? "not-allowed" : "pointer", opacity: addingCandidate ? 0.7 : 1 }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleAddCandidate(inviteModal.testId)}
                    disabled={addingCandidate || !candidateName || !candidateEmail}
                    style={{ flex: 1, padding: "0.75rem", backgroundColor: "#00684A", border: "1px solid #00684A", borderRadius: "0.5rem", fontWeight: 600, color: "#ffffff", cursor: addingCandidate || !candidateName || !candidateEmail ? "not-allowed" : "pointer", opacity: addingCandidate || !candidateName || !candidateEmail ? 0.7 : 1 }}
                  >
                    {addingCandidate ? "Adding..." : "Add Candidate"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

