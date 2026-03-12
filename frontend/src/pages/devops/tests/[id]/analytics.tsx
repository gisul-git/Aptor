import { useEffect, useMemo, useState } from "react";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import {
  ArrowLeft,
  BarChart3,
  Clipboard,
  Download,
  Mail,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { requireAuth } from "../../../../lib/auth";
import {
  useDevOpsTest,
  useDevOpsCandidates,
  useDevOpsCandidateAnalytics,
  type DevOpsCandidateAnalytics,
} from "@/hooks/api/useDevOps";

interface CandidateRow {
  user_id: string;
  name: string;
  email: string;
  has_submitted?: boolean;
  submission_score?: number;
  submitted_at?: string;
}

function formatDate(value?: string) {
  if (!value) return "N/A";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString();
}

function toCandidateRows(rows: any[]): CandidateRow[] {
  return rows
    .map((row: any) => {
      if (typeof row === "string") {
        const email = row.trim();
        if (!email) return null;
        return {
          user_id: email,
          name: email.split("@")[0] || email,
          email,
          has_submitted: false,
        } as CandidateRow;
      }
      if (!row || typeof row !== "object") return null;
      const email = String(row.email || row.candidate_email || "").trim();
      const userId = String(row.user_id || row.id || email).trim();
      if (!userId) return null;
      return {
        user_id: userId,
        name: String(row.name || row.full_name || email || "Candidate"),
        email,
        has_submitted: !!row.has_submitted,
        submission_score: typeof row.submission_score === "number" ? row.submission_score : undefined,
        submitted_at: typeof row.submitted_at === "string" ? row.submitted_at : undefined,
      } as CandidateRow;
    })
    .filter((row): row is CandidateRow => !!row && !!row.user_id);
}

export default function DevOpsAnalyticsPage() {
  const router = useRouter();
  const rawTestId = router.query.id;
  const testId = typeof rawTestId === "string" ? rawTestId : undefined;
  const candidateQuery = typeof router.query.candidate === "string" ? router.query.candidate : undefined;

  const { data: testInfo, isLoading: loadingTestInfo } = useDevOpsTest(testId);
  const { data: apiCandidates, isLoading: loadingCandidates } = useDevOpsCandidates(testId);

  const [origin, setOrigin] = useState("");
  const [managementCandidates, setManagementCandidates] = useState<CandidateRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | undefined>(candidateQuery);

  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!testId) return;
    let active = true;

    const fetchManagementCandidates = async () => {
      try {
        const byIdResponse = await fetch(`/api/devops/get-test?id=${encodeURIComponent(testId)}`);
        const byIdJson = await byIdResponse.json().catch(() => ({}));
        const byIdData = byIdJson?.data || byIdJson || {};
        const byIdInvited = Array.isArray(byIdData?.invited_users) ? byIdData.invited_users : [];

        const listResponse = await fetch("/api/devops/list-tests");
        const listJson = await listResponse.json().catch(() => ({}));
        const listRows = Array.isArray(listJson?.data) ? listJson.data : [];
        const matching = listRows.find((row: any) => String(row?.id || row?._id || "") === String(testId));
        const listInvited = Array.isArray(matching?.invited_users) ? matching.invited_users : [];

        if (active) setManagementCandidates(toCandidateRows([...byIdInvited, ...listInvited]));
      } catch {
        if (active) setManagementCandidates([]);
      }
    };

    void fetchManagementCandidates();
    return () => {
      active = false;
    };
  }, [testId]);

  const fallbackCandidates = useMemo(() => {
    const invited = Array.isArray((testInfo as any)?.invited_users) ? (testInfo as any).invited_users : [];
    return toCandidateRows(invited);
  }, [testInfo]);

  const candidates = useMemo(() => {
    const fromApi = Array.isArray(apiCandidates) ? toCandidateRows(apiCandidates as any[]) : [];
    const byId = new Map<string, CandidateRow>();
    [...fromApi, ...managementCandidates, ...fallbackCandidates].forEach((candidate) => {
      const key = String(candidate.user_id);
      const existing = byId.get(key);
      byId.set(key, { ...(existing || {}), ...candidate });
    });
    return Array.from(byId.values());
  }, [apiCandidates, managementCandidates, fallbackCandidates]);

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [candidates, searchQuery]);

  useEffect(() => {
    if (candidateQuery) {
      setSelectedCandidateId(candidateQuery);
      return;
    }
    if (!selectedCandidateId && filteredCandidates.length > 0) {
      setSelectedCandidateId(filteredCandidates[0].user_id);
    }
  }, [candidateQuery, selectedCandidateId, filteredCandidates]);

  const selectedCandidate = useMemo(
    () => filteredCandidates.find((c) => c.user_id === selectedCandidateId) || null,
    [filteredCandidates, selectedCandidateId]
  );

  const { data: analytics, isLoading: loadingAnalytics } = useDevOpsCandidateAnalytics(testId, selectedCandidateId);
  const questionAnalytics = useMemo(() => {
    const rows = (analytics as DevOpsCandidateAnalytics | undefined)?.question_analytics;
    return Array.isArray(rows) ? rows : [];
  }, [analytics]);

  const totalCandidates = candidates.length;
  const submittedCandidates = candidates.filter((c) => c.has_submitted);
  const submittedCount = submittedCandidates.length;
  const avgScore =
    submittedCount > 0
      ? submittedCandidates.reduce((sum, c) => sum + (c.submission_score || 0), 0) / submittedCount
      : 0;
  const passedCount = submittedCandidates.filter((c) => (c.submission_score || 0) >= 60).length;
  const failedCount = submittedCandidates.filter((c) => (c.submission_score || 0) < 60).length;

  const takeUrl = useMemo(() => {
    const token = String((testInfo as any)?.test_token || "").trim();
    if (!origin || !testId) return "";
    return token
      ? `${origin}/devops/tests/${testId}/take?token=${encodeURIComponent(token)}`
      : `${origin}/devops/tests/${testId}/take`;
  }, [origin, testId, testInfo]);

  const copyTakeUrl = async () => {
    if (!takeUrl) return;
    try {
      await navigator.clipboard.writeText(takeUrl);
      alert("URL copied");
    } catch {
      alert("Failed to copy URL");
    }
  };

  const exportResults = () => {
    const rows = [
      ["Name", "Email", "Status", "Score", "Submitted At"],
      ...candidates.map((c) => [
        c.name,
        c.email,
        c.has_submitted ? "Submitted" : "Pending",
        c.submission_score != null ? String(c.submission_score) : "",
        c.submitted_at || "",
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `devops-${testId || "analytics"}-results.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const card = {
    border: "1px solid #d1d5db",
    borderRadius: "1rem",
    background: "#f3f4f6",
    padding: "1.25rem",
  };

  const btnOutline = {
    border: "2px solid #6ee7b7",
    borderRadius: "0.75rem",
    padding: "0.65rem 1rem",
    background: "#ffffff",
    color: "#065f46",
    fontWeight: 700,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };

  const btnSolid = {
    ...btnOutline,
    background: "#bbf7d0",
  };

  const statusPill = (candidate: CandidateRow) => ({
    display: "inline-flex",
    borderRadius: 999,
    padding: "0.25rem 0.8rem",
    fontSize: "0.85rem",
    fontWeight: 600,
    background: candidate.has_submitted ? "#dcfce7" : "#e5e7eb",
    color: candidate.has_submitted ? "#166534" : "#6b7280",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#e5e7eb", padding: "0.75rem" }}>
      <div style={{ maxWidth: 1280, margin: "0 auto", border: "1px solid #86efac", borderRadius: "1rem", background: "#f3f4f6", padding: "1.5rem" }}>
        <button
          type="button"
          onClick={() => router.push("/devops/assessments")}
          style={{ ...btnOutline, marginBottom: "1.25rem" }}
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <h1 style={{ margin: 0, fontSize: "2.3rem", color: "#065f46", lineHeight: 1.2 }}>DevOps Test Analytics</h1>
        <p style={{ marginTop: "0.35rem", fontSize: "1.05rem", color: "#64748b", marginBottom: "1.4rem" }}>
          {(testInfo as any)?.title || "DevOps Assessment"} - View detailed analytics and submissions
        </p>

        <section style={{ ...card, marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, color: "#065f46", fontSize: "1.85rem" }}>Test Access & Settings</h2>
            <button
              type="button"
              onClick={() => router.push(`/devops/tests?testId=${encodeURIComponent(testId || "")}`)}
              style={btnOutline}
            >
              <BarChart3 size={16} />
              Manage Test
            </button>
          </div>

          <div style={{ marginTop: "0.9rem", color: "#0f172a", fontWeight: 700, fontSize: "1.05rem" }}>Test URL</div>
          <div style={{ marginTop: "0.75rem", display: "grid", gridTemplateColumns: "1fr auto", gap: "0.6rem" }}>
            <input
              value={takeUrl}
              readOnly
              style={{
                border: "1px solid #d8b4fe",
                borderRadius: "0.75rem",
                padding: "0.9rem 1rem",
                background: "#ffffff",
                color: "#065f46",
                fontSize: "0.95rem",
              }}
            />
            <button type="button" onClick={copyTakeUrl} style={btnOutline}>
              Copy URL
            </button>
          </div>
        </section>

        <section style={{ ...card, marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, color: "#065f46", fontSize: "1.85rem" }}>Candidates</h2>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <button type="button" onClick={exportResults} style={btnOutline}>
                <Download size={16} />
                Export Results
              </button>
              <button type="button" onClick={() => alert("Send Email to All not wired yet for DevOps")} style={btnOutline}>
                <Mail size={16} />
                Send Email to All
              </button>
              <button type="button" onClick={() => alert("Bulk Upload not wired yet for DevOps")} style={btnOutline}>
                <Clipboard size={16} />
                Bulk Upload
              </button>
              <button type="button" onClick={() => router.push(`/devops/tests?testId=${encodeURIComponent(testId || "")}`)} style={btnSolid}>
                <Plus size={16} />
                Add Candidate
              </button>
            </div>
          </div>

          <div style={{ marginTop: "1rem", border: "1px solid #cbd5e1", borderRadius: "0.75rem", overflow: "hidden", background: "#f8fafc" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#e5e7eb", color: "#111827", textAlign: "left" }}>
                  <th style={{ padding: "0.9rem 0.8rem", fontSize: "1rem" }}>Email</th>
                  <th style={{ padding: "0.9rem 0.8rem", fontSize: "1rem" }}>Name</th>
                  <th style={{ padding: "0.9rem 0.8rem", fontSize: "1rem" }}>Status</th>
                  <th style={{ padding: "0.9rem 0.8rem", fontSize: "1rem" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingCandidates || loadingTestInfo ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "1rem", color: "#475569" }}>
                      Loading candidates...
                    </td>
                  </tr>
                ) : filteredCandidates.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: "1rem", color: "#475569" }}>
                      No candidates available.
                    </td>
                  </tr>
                ) : (
                  filteredCandidates.map((candidate) => (
                    <tr key={candidate.user_id} style={{ borderTop: "1px solid #cbd5e1" }}>
                      <td style={{ padding: "0.9rem 0.8rem", color: "#065f46", fontSize: "0.95rem" }}>{candidate.email || "N/A"}</td>
                      <td style={{ padding: "0.9rem 0.8rem", color: "#065f46", fontSize: "0.95rem" }}>{candidate.name}</td>
                      <td style={{ padding: "0.9rem 0.8rem" }}>
                        <span style={statusPill(candidate)}>{candidate.has_submitted ? "Completed" : "Pending"}</span>
                      </td>
                      <td style={{ padding: "0.9rem 0.8rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button type="button" style={{ border: "none", borderRadius: 10, padding: "0.5rem 0.9rem", background: "#10b981", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                          Resend Invitation
                        </button>
                        <button type="button" style={{ border: "none", borderRadius: 10, padding: "0.5rem 0.9rem", background: "#ef4444", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
                          <Trash2 size={14} style={{ display: "inline", marginRight: 4, verticalAlign: "-2px" }} />
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(260px, 360px) 1fr", gap: "1rem" }}>
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", gap: 8 }}>
              <h3 style={{ margin: 0, color: "#065f46", fontSize: "1.65rem" }}>Candidates</h3>
              <div style={{ position: "relative" }}>
                <Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "#64748b" }} />
                <input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: "1px solid #cbd5e1", borderRadius: 10, padding: "0.5rem 0.7rem 0.5rem 1.8rem", width: 170 }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setSelectedCandidateId(undefined);
                void router.replace({ pathname: router.pathname, query: { id: testId } }, undefined, { shallow: true });
              }}
              style={{
                width: "100%",
                textAlign: "left",
                border: !selectedCandidateId ? "2px solid #7c3aed" : "1px solid #cbd5e1",
                borderRadius: 12,
                padding: "0.8rem",
                marginBottom: "0.6rem",
                background: "#ede9fe",
                fontWeight: 700,
                color: "#065f46",
                cursor: "pointer",
              }}
            >
              📊 Overall Analytics
            </button>

            <div style={{ display: "grid", gap: "0.55rem" }}>
              {filteredCandidates.map((candidate) => (
                <button
                  key={candidate.user_id}
                  type="button"
                  onClick={() => {
                    setSelectedCandidateId(candidate.user_id);
                    void router.replace(
                      { pathname: router.pathname, query: { ...router.query, candidate: candidate.user_id } },
                      undefined,
                      { shallow: true }
                    );
                  }}
                  style={{
                    width: "100%",
                    textAlign: "left",
                    border: selectedCandidateId === candidate.user_id ? "2px solid #10b981" : "1px solid #cbd5e1",
                    borderRadius: 12,
                    padding: "0.75rem",
                    background: "#ffffff",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "#065f46", fontSize: "1rem" }}>{candidate.name}</div>
                  <div style={{ color: "#64748b", marginTop: 2 }}>{candidate.email}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={card}>
            <h3 style={{ marginTop: 0, color: "#065f46", fontSize: "1.85rem" }}>Overall Test Performance</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.92rem" }}>Total Candidates</div>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#065f46" }}>{totalCandidates}</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.92rem" }}>Submitted</div>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#065f46" }}>
                  {submittedCount} / {totalCandidates}
                </div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.92rem" }}>Average Score</div>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#065f46" }}>{avgScore.toFixed(1)}</div>
              </div>
              <div>
                <div style={{ color: "#64748b", fontSize: "0.92rem" }}>Passed</div>
                <div style={{ fontSize: "2rem", fontWeight: 700, color: "#065f46" }}>{passedCount}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
              <div style={{ border: "1px solid #34d399", borderRadius: 12, background: "#d1fae5", padding: "0.9rem" }}>
                <div style={{ color: "#166534", fontWeight: 700, fontSize: "1rem" }}>Passed</div>
                <div style={{ color: "#059669", fontWeight: 800, fontSize: "2rem" }}>{passedCount}</div>
              </div>
              <div style={{ border: "1px solid #f87171", borderRadius: 12, background: "#fee2e2", padding: "0.9rem" }}>
                <div style={{ color: "#991b1b", fontWeight: 700, fontSize: "1rem" }}>Failed</div>
                <div style={{ color: "#dc2626", fontWeight: 800, fontSize: "2rem" }}>{failedCount}</div>
              </div>
            </div>

            {selectedCandidate && (
              <div style={{ marginTop: 14, border: "1px solid #cbd5e1", borderRadius: 12, background: "#fff", padding: "0.9rem" }}>
                <div style={{ fontWeight: 700, color: "#065f46", fontSize: "1.3rem" }}>Selected Candidate Snapshot</div>
                <div style={{ marginTop: 8, color: "#334155" }}>
                  <div>Name: {selectedCandidate.name}</div>
                  <div>Email: {selectedCandidate.email || "N/A"}</div>
                  <div>Submitted At: {formatDate(selectedCandidate.submitted_at)}</div>
                  <div>
                    Score:{" "}
                    {typeof (analytics as any)?.submission?.score === "number"
                      ? `${(analytics as any).submission.score}/100`
                      : selectedCandidate.submission_score != null
                        ? `${selectedCandidate.submission_score}/100`
                        : "N/A"}
                  </div>
                  <div style={{ marginTop: 8, color: "#64748b" }}>
                    {loadingAnalytics
                      ? "Loading candidate analytics..."
                      : `${questionAnalytics.length} question analytics records`}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
