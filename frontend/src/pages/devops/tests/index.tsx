import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  ArrowLeft,
  AlertCircle,
  Calendar,
  Clock,
  Copy,
  Eye,
  EyeOff,
  List,
  Server,
  Users,
} from "lucide-react";
import apiClient from "@/services/api/client";
import { useDevOpsTests } from "@/hooks/api/useDevOps";

interface DevOpsTestCard {
  id: string;
  title: string;
  description?: string;
  duration_minutes?: number;
  start_time?: string;
  end_time?: string;
  is_active?: boolean;
  is_published?: boolean;
  invited_users?: string[];
  question_ids?: string[];
  test_token?: string;
  created_at?: string;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

export default function DevOpsTestsListPage() {
  const router = useRouter();
  const { data: testsData, isLoading: loading, refetch } = useDevOpsTests();
  const [tests, setTests] = useState<DevOpsTestCard[]>([]);
  const [loadingById, setLoadingById] = useState(false);

  useEffect(() => {
    const apiTests = Array.isArray(testsData) ? (testsData as any[]) : [];
    const mappedApi: DevOpsTestCard[] = apiTests.map((t) => ({
      id: String(t.id || t._id || ""),
      title: t.title || "Untitled DevOps Test",
      description: t.description || "",
      duration_minutes: t.duration_minutes || t.duration || 60,
      start_time: t.start_time || t.schedule?.startTime,
      end_time: t.end_time || t.schedule?.endTime,
      is_active: t.is_active !== undefined ? t.is_active : true,
      is_published: t.is_published || false,
      invited_users: t.invited_users || [],
      question_ids: t.question_ids || t.questions?.map((q: any) => q.id || q) || [],
      test_token: t.test_token || "",
      created_at: t.created_at || t.createdAt,
    }));
    setTests(mappedApi);
  }, [testsData]);

  useEffect(() => {
    const q = router.query.testId;
    const testId = typeof q === "string" ? q : Array.isArray(q) ? q[0] : undefined;
    if (!testId) return;
    if (tests.some((t) => String(t.id) === String(testId))) return;

    let active = true;
    const fetchById = async () => {
      setLoadingById(true);
      try {
        const response = await fetch(`/api/devops/get-test?id=${encodeURIComponent(testId)}`);
        const json = await response.json().catch(() => ({}));
        if (!response.ok) return;
        const t = json?.data || json;
        if (!t || !t.id) return;
        const mapped: DevOpsTestCard = {
          id: String(t.id || t._id || ""),
          title: t.title || "Untitled DevOps Test",
          description: t.description || "",
          duration_minutes: t.duration_minutes || t.duration || 60,
          start_time: t.start_time || t.schedule?.startTime,
          end_time: t.end_time || t.schedule?.endTime,
          is_active: t.is_active !== undefined ? t.is_active : true,
          is_published: t.is_published || false,
          invited_users: t.invited_users || [],
          question_ids: t.question_ids || t.questions?.map((q: any) => q.id || q) || [],
          test_token: t.test_token || "",
          created_at: t.created_at || t.createdAt,
        };
        if (active) {
          setTests((prev) => {
            if (prev.some((x) => String(x.id) === String(mapped.id))) return prev;
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
  }, [router.query.testId, tests]);

  const filteredTests = useMemo(() => {
    const q = router.query.testId;
    const testId = typeof q === "string" ? q : Array.isArray(q) ? q[0] : undefined;
    if (!testId) return tests;
    return tests.filter((t) => String(t.id) === String(testId));
  }, [router.query.testId, tests]);

  const updateLocalTest = (id: string, patch: Partial<DevOpsTestCard>) => {
    setTests((prev) => prev.map((t) => (String(t.id) === String(id) ? { ...t, ...patch } : t)));
  };

  const handlePublish = async (testId: string, currentStatus: boolean) => {
    const newStatus = !currentStatus;
    updateLocalTest(testId, { is_published: newStatus });
    try {
      try {
        await apiClient.patch(`/api/v1/devops/tests/${testId}/publish`, { is_published: newStatus });
      } catch {
        await apiClient.patch(`/api/v1/devops/tests/${testId}/publish?is_published=${newStatus}`);
      }
      await refetch();
    } catch {
      // Revert optimistic update if backend failed.
      updateLocalTest(testId, { is_published: currentStatus });
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
            onClick={() => router.push("/devops")}
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
              Manage your DevOps assessments, publish tests, and review configurations.
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
              {router.query.testId ? "The requested test could not be found." : "You have not created any DevOps assessments yet."}
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
                  <div style={{ flex: 1, minWidth: "350px" }}>
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

                    <p style={{ margin: "0 0 1rem 0", color: "#4B5563", fontSize: "0.95rem", lineHeight: "1.5" }}>{test.description || "No description"}</p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <Clock size={14} /> {test.duration_minutes || 60} mins
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <Calendar size={14} /> {formatDate(test.start_time)} - {formatDate(test.end_time)}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <Users size={14} /> {test.invited_users?.length || 0} Candidates
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.8rem", color: "#6B7280", backgroundColor: "#F9FAFB", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E5E7EB", fontWeight: 500 }}>
                        <List size={14} /> {test.question_ids?.length || 0} Questions
                      </span>
                    </div>

                    {test.is_published && test.test_token && (
                      <div style={{ padding: "1rem", backgroundColor: "#F0F9F4", border: "1px solid #A8E8BC", borderRadius: "0.5rem", marginTop: "1rem" }}>
                        <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#00684A", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                          Assessment Link
                        </label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                          <input
                            type="text"
                            value={`${typeof window !== "undefined" ? window.location.origin : ""}/devops/tests/${test.id}/take?token=${encodeURIComponent(test.test_token)}`}
                            readOnly
                            style={{ flex: 1, padding: "0.5rem 0.75rem", border: "1px solid #D1D5DB", borderRadius: "0.375rem", backgroundColor: "#ffffff", fontSize: "0.875rem", fontFamily: "monospace", color: "#374151", outline: "none" }}
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const link = `${window.location.origin}/devops/tests/${test.id}/take?token=${encodeURIComponent(test.test_token || "")}`;
                              try {
                                await navigator.clipboard.writeText(link);
                              } catch {
                                const input = document.createElement("input");
                                input.value = link;
                                document.body.appendChild(input);
                                input.select();
                                document.execCommand("copy");
                                document.body.removeChild(input);
                              }
                            }}
                            style={{ display: "flex", alignItems: "center", gap: "0.375rem", padding: "0.5rem 1rem", backgroundColor: "#00684A", border: "1px solid #00684A", borderRadius: "0.375rem", color: "#ffffff", fontSize: "0.875rem", fontWeight: 600, cursor: "pointer" }}
                          >
                            <Copy size={14} /> Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div style={{ width: "260px", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <button
                      onClick={() => handlePublish(test.id, !!test.is_published)}
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
                        cursor: "pointer",
                      }}
                    >
                      {test.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
                      {test.is_published ? "Unpublish" : "Publish"}
                    </button>

                    <Link href={`/devops/tests/${test.id}/take`} style={{ textDecoration: "none" }}>
                      <button
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.375rem",
                          width: "100%",
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
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

