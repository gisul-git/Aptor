import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { useSession } from "next-auth/react";
import { requireAuth } from "../../../../../lib/auth";
import Link from "next/link";
import ProctorSummaryCard from "../../../../../components/admin/ProctorSummaryCard";
import ProctorLogsReview from "../../../../../components/admin/ProctorLogsReview";
import { useProctorPolling, EVENT_TYPE_LABELS, type ProctorLog } from "@/hooks/proctoring/useProctorPolling";
import { useAssessment, useCandidateResults, useAnswerLogs } from "@/hooks/api/useAssessments";
// admin No
interface CandidateData {
  email: string;
  name: string;
  score: number;
  maxScore: number;
  aiScore?: number;
  percentageScored?: number;
  passPercentage?: number;
  passed?: boolean;
  attempted: number;
  notAttempted: number;
  submittedAt?: string;
  startedAt?: string;  // Candidate's actual session start time
}

interface ProctorSummary {
  summary: Record<string, number>;
  totalViolations: number;
  violations: Array<{
    _id: string;
    eventType: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
    snapshotBase64?: string;
  }>;
  eventTypeLabels: Record<string, string>;
}

// ProctorLog is now imported from useProctorPollings

interface AssessmentData {
  title: string;
  description?: string;
  status: string;
}

interface ScheduleData {
  startTime?: string;
  endTime?: string;
}

interface AnswerLog {
  answer: string;
  questionType: string;
  timestamp: string;
  version: number;
}

interface QuestionLog {
  questionIndex: number;
  questionText: string;
  questionType: string;
  logs: AnswerLog[];
  aiScore?: number;
  aiFeedback?: string;
  maxScore?: number;
  isMcqCorrect?: boolean;
  correctAnswer?: string;
  options?: string[];
  topic?: string;
}

interface SectionData {
  name: string;
  type: string;
  questions: QuestionLog[];
  totalScore: number;
  maxScore: number;
  isExpanded: boolean;
}

export default function CandidateProctorPage() {
  const router = useRouter();
  const { assessmentId: assessmentIdParam, userId: userIdParam } = router.query;
  const assessmentId = typeof assessmentIdParam === 'string' ? assessmentIdParam : undefined;
  const userId = typeof userIdParam === 'string' ? userIdParam : undefined;
  const { data: session } = useSession();
  
  // React Query hooks
  const { data: assessmentData, isLoading: loadingAssessment } = useAssessment(assessmentId);
  const { data: candidatesData, isLoading: loadingCandidates } = useCandidateResults(assessmentId);
  const [candidateEmail, setCandidateEmail] = useState<string>("");
  const [candidateName, setCandidateName] = useState<string>("");
  const { data: answerLogsData, isLoading: loadingAnswerLogs } = useAnswerLogs(assessmentId, candidateEmail, candidateName);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<AssessmentData | null>(null);
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [candidateData, setCandidateData] = useState<CandidateData | null>(null);
  const [answerLogs, setAnswerLogs] = useState<QuestionLog[]>([]);
  const [sections, setSections] = useState<SectionData[]>([]);
  const [showSnapshots, setShowSnapshots] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<ProctorLog | null>(null);
  
  // Update local state from React Query data
  useEffect(() => {
    if (assessmentData) {
      setAssessment(assessmentData as any);
      if ((assessmentData as any).schedule) {
        setSchedule((assessmentData as any).schedule);
      }
    }
  }, [assessmentData]);
  
  useEffect(() => {
    if (candidatesData && userId) {
      const decodedUserId = decodeURIComponent(userId);
      const candidate = candidatesData.find(
        (c: any) => c.email === userId || c.email === decodedUserId
      );
      if (candidate) {
        setCandidateData(candidate);
        setCandidateEmail(candidate.email);
        setCandidateName(candidate.name);
      }
    }
  }, [candidatesData, userId]);
  
  useEffect(() => {
    if (answerLogsData) {
      setAnswerLogs(answerLogsData as any);
    }
  }, [answerLogsData]);
  
  useEffect(() => {
    setLoading(loadingAssessment || loadingCandidates);
  }, [loadingAssessment, loadingCandidates]);

  // Use polling hook for proctoring data
  const {
    summary: proctorSummary,
    logs: proctorLogs,
    totalViolations,
    eventTypeLabels,
    isLoading: proctorLoading,
    isPolling,
    error: proctorError,
    lastUpdated,
    refresh: refreshProctorData,
    startPolling,
    stopPolling,
  } = useProctorPolling({
    assessmentId: (assessmentId as string) || "",
    userId: (userId as string) || "",
    enabled: !!(assessmentId && userId),
    pollInterval: 5000, // 5 seconds
  });

  // Data is now fetched via React Query hooks
  // No need for manual fetchData

  // Group answer logs into sections by question type
  useEffect(() => {
    if (answerLogs.length > 0) {
      const sectionMap: Record<string, QuestionLog[]> = {};
      
      answerLogs.forEach((log) => {
        const sectionKey = log.questionType || "Other";
        if (!sectionMap[sectionKey]) {
          sectionMap[sectionKey] = [];
        }
        sectionMap[sectionKey].push(log);
      });

      const sectionsList: SectionData[] = Object.entries(sectionMap).map(([type, questions]) => {
        const totalScore = questions.reduce((sum, q) => sum + (q.aiScore || 0), 0);
        const maxScore = questions.reduce((sum, q) => sum + (q.maxScore || 5), 0);
        
        return {
          name: `${type} Section`,
          type,
          questions,
          totalScore,
          maxScore,
          isExpanded: false,
        };
      });

      setSections(sectionsList);
    }
  }, [answerLogs]);

  // Data fetching is now handled by React Query hooks
  // No need for manual fetchData or fetchAnswerLogs functions

  const calculateTimeTaken = () => {
    // Priority 1: Use candidate's actual startedAt timestamp (most accurate)
    if (candidateData?.startedAt && candidateData?.submittedAt) {
      const start = new Date(candidateData.startedAt).getTime();
      const end = new Date(candidateData.submittedAt).getTime();
      
      if (end > start) {
        const diffMs = end - start;
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        
        if (hours > 0) {
          return `${hours}h ${mins}m ${secs}s`;
        }
        return `${mins}m ${secs}s`;
      }
    }
    
    // Fallback: Use schedule startTime (less accurate, for backward compatibility)
    if (schedule?.startTime && candidateData?.submittedAt) {
      console.warn("[TimeTaken] Using schedule startTime as fallback - candidate startedAt not found");
      const start = new Date(schedule.startTime).getTime();
      const end = new Date(candidateData.submittedAt).getTime();
      
      if (end > start) {
        const diffMs = end - start;
        const hours = Math.floor(diffMs / 3600000);
        const mins = Math.floor((diffMs % 3600000) / 60000);
        const secs = Math.floor((diffMs % 60000) / 1000);
        
        if (hours > 0) {
          return `${hours}h ${mins}m ${secs}s`;
        }
        return `${mins}m ${secs}s`;
      }
    }
    
    return "N/A";
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const toggleSection = (index: number) => {
    setSections((prev) =>
      prev.map((section, i) =>
        i === index ? { ...section, isExpanded: !section.isExpanded } : section
      )
    );
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: "#f1f5f9", minHeight: "100vh", padding: "2rem" }}>
        <div className="container">
          <div className="card">
            <p style={{ textAlign: "center", color: "#475569" }}>Loading candidate details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ backgroundColor: "#f1f5f9", minHeight: "100vh", padding: "2rem" }}>
        <div className="container">
          <div className="card">
            <div className="alert alert-error">{error}</div>
            <Link href={`/assessments/${assessmentId}`}>
              <button type="button" className="btn-secondary" style={{ marginTop: "1rem" }}>
                Back to Assessment
              </button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const snapshotsWithImages = proctorLogs.filter((v) => v.snapshotBase64) || [];

  return (
    <div style={{ backgroundColor: "#f1f5f9", minHeight: "100vh", padding: "2rem" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto" }}>
        {/* Back Link */}
        <div style={{ marginBottom: "1.5rem" }}>
          <Link 
            href={`/assessments/${assessmentId}`} 
            style={{ color: "#3b82f6", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.5rem" }}
          >
            ← Back to Assessment
          </Link>
        </div>

        {/* Header Card */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "0.75rem",
            padding: "1.5rem 2rem",
            marginBottom: "1.5rem",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            borderBottom: "4px solid #6953a3",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.5rem", color: "#1a1625", fontWeight: 700 }}>
            {assessment?.title || "Assessment Results"}
          </h1>
          {candidateData && (
            <p style={{ margin: "0.5rem 0 0", color: "#64748b", fontSize: "1rem" }}>
              Candidate: <strong style={{ color: "#1e293b" }}>{candidateData.name}</strong> ({candidateData.email})
            </p>
          )}
        </div>

        {/* Stats Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          {/* Final Score Card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              padding: "1.25rem 1.5rem",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#fef3c7",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                <circle cx="12" cy="8" r="7" />
                <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>Final score</p>
              <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#1e293b" }}>
                {candidateData?.aiScore !== undefined ? candidateData.aiScore : candidateData?.score || 0}
                <span style={{ fontSize: "1rem", fontWeight: 400, color: "#64748b" }}>
                  /{candidateData?.maxScore || 0}
                </span>
              </p>
            </div>
          </div>

          {/* Time Taken Card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              padding: "1.25rem 1.5rem",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#dbeafe",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>Time taken</p>
              <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#3b82f6" }}>
                {calculateTimeTaken()}
              </p>
            </div>
          </div>

          {/* Accuracy Card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              padding: "1.25rem 1.5rem",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: "#d1fae5",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>Accuracy</p>
              <p style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#10b981" }}>
                {candidateData?.percentageScored !== undefined
                  ? `${candidateData.percentageScored.toFixed(0)}%`
                  : candidateData?.maxScore && candidateData.maxScore > 0
                  ? `${Math.round((candidateData.score / candidateData.maxScore) * 100)}%`
                  : "N/A"}
              </p>
            </div>
          </div>

          {/* Status Card */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              padding: "1.25rem 1.5rem",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                backgroundColor: candidateData?.passed ? "#d1fae5" : "#fee2e2",
                borderRadius: "0.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {candidateData?.passed ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </svg>
              )}
            </div>
            <div>
              <p style={{ margin: 0, fontSize: "0.875rem", color: "#64748b" }}>Status</p>
              <p
                style={{
                  margin: 0,
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  color: candidateData?.passed ? "#10b981" : "#ef4444",
                }}
              >
                {candidateData?.passed ? "Passed" : "Failed"}
              </p>
            </div>
          </div>
        </div>

        {/* Proctoring Section Header with Live Status */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "1rem",
            flexWrap: "wrap",
            gap: "1rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#1a1625", fontWeight: 700 }}>
              Proctoring Monitor
            </h2>
            {/* Live Indicator */}
            {isPolling && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  backgroundColor: "#d1fae5",
                  color: "#059669",
                  padding: "0.25rem 0.625rem",
                  borderRadius: "9999px",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.025em",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    backgroundColor: "#10b981",
                    borderRadius: "50%",
                    animation: "pulse 2s infinite",
                  }}
                />
                Live
              </span>
            )}
            {/* Total Violations Badge */}
            {totalViolations > 0 && (
              <span
                style={{
                  backgroundColor: "#ef4444",
                  color: "#ffffff",
                  padding: "0.25rem 0.625rem",
                  borderRadius: "9999px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                }}
              >
                {totalViolations} violation{totalViolations !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            {/* Last Updated */}
            {lastUpdated && (
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {/* Refresh Button */}
            <button
              type="button"
              onClick={refreshProctorData}
              disabled={proctorLoading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                backgroundColor: "#f1f5f9",
                color: "#475569",
                border: "1px solid #e2e8f0",
                borderRadius: "0.5rem",
                padding: "0.5rem 0.875rem",
                fontSize: "0.8125rem",
                fontWeight: 500,
                cursor: proctorLoading ? "not-allowed" : "pointer",
                opacity: proctorLoading ? 0.6 : 1,
                transition: "all 0.2s",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{
                  animation: proctorLoading ? "spin 1s linear infinite" : "none",
                }}
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              {proctorLoading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        {/* Proctoring Error */}
        {proctorError && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "0.5rem",
              padding: "0.75rem 1rem",
              marginBottom: "1rem",
              color: "#dc2626",
              fontSize: "0.875rem",
            }}
          >
            Error loading proctoring data: {proctorError}
          </div>
        )}

        {/* Proctoring Summary */}
        {proctorSummary && (
          <ProctorSummaryCard
            summary={proctorSummary.summary}
            totalViolations={proctorSummary.totalViolations}
            eventTypeLabels={eventTypeLabels}
          />
        )}

        {/* Proctoring Logs Review */}
        {proctorLogs.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <ProctorLogsReview 
              logs={proctorLogs}
              candidateName={candidateData?.name || candidateData?.email}
            />
          </div>
        )}

        {/* CSS for animations */}
        <style jsx>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>

        {/* Section Breakdown */}
        <div
          style={{
            backgroundColor: "#ffffff",
            borderRadius: "0.75rem",
            padding: "1.5rem 2rem",
            marginBottom: "1.5rem",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6953a3" strokeWidth="2">
              <path d="M3 3v18h18" />
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
            </svg>
            <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#1a1625", fontWeight: 700 }}>
              Section breakdown
            </h2>
          </div>

          {loadingAnswerLogs ? (
            <div style={{ textAlign: "center", padding: "2rem" }}>
              <p style={{ color: "#64748b" }}>Loading sections...</p>
            </div>
          ) : sections.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
              <p>No sections found for this candidate.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {sections.map((section, index) => (
                <div
                  key={section.type}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    overflow: "hidden",
                  }}
                >
                  {/* Section Header */}
                  <div
                    onClick={() => toggleSection(index)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "1rem 1.5rem",
                      backgroundColor: "#f8fafc",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          backgroundColor: "#3b82f6",
                          borderRadius: "0.5rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#ffffff",
                          fontWeight: 700,
                          fontSize: "0.875rem",
                        }}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#1e293b" }}>
                          {section.name}
                        </h3>
                        <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                          Click to {section.isExpanded ? "collapse" : "expand"} details
                        </p>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>Section score</p>
                        <p style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#1e293b" }}>
                          {section.totalScore}/{section.maxScore}
                        </p>
                      </div>
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#64748b"
                        strokeWidth="2"
                        style={{
                          transform: section.isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                          transition: "transform 0.2s",
                        }}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </div>

                  {/* Section Content (Expanded) */}
                  {section.isExpanded && (
                    <div style={{ padding: "1.5rem", borderTop: "1px solid #e2e8f0" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                        {section.questions.map((questionLog) => (
                          <div
                            key={questionLog.questionIndex}
                            style={{
                              border: "1px solid #e2e8f0",
                              borderRadius: "0.5rem",
                              padding: "1.25rem",
                              backgroundColor: "#ffffff",
                            }}
                          >
                            <div style={{ marginBottom: "1rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                                <span
                                  style={{
                                    backgroundColor: "#6953a3",
                                    color: "#ffffff",
                                    padding: "0.25rem 0.75rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.75rem",
                                    fontWeight: 700,
                                  }}
                                >
                                  Q{questionLog.questionIndex + 1}
                                </span>
                                <span
                                  style={{
                                    backgroundColor: "#eff6ff",
                                    color: "#1e40af",
                                    padding: "0.25rem 0.75rem",
                                    borderRadius: "9999px",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                  }}
                                >
                                  {questionLog.questionType}
                                </span>
                              </div>
                              <p style={{ color: "#1e293b", lineHeight: 1.6, margin: 0, fontSize: "0.9375rem" }}>
                                {questionLog.questionText}
                              </p>
                              
                              {/* MCQ Options Display */}
                              {questionLog.questionType === "MCQ" && questionLog.options && questionLog.options.length > 0 && (
                                <div style={{ marginTop: "1rem" }}>
                                  <h4 style={{ margin: 0, marginBottom: "0.75rem", fontSize: "0.875rem", color: "#64748b", fontWeight: 600 }}>
                                    Options:
                                  </h4>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                    {questionLog.options.map((option, optIndex) => {
                                      const optionLetter = String.fromCharCode(65 + optIndex);
                                      const isSelected = questionLog.logs.length > 0 && questionLog.logs[questionLog.logs.length - 1]?.answer === optionLetter;
                                      const isCorrect = optionLetter === questionLog.correctAnswer;
                                      const showAsCorrect = isSelected && isCorrect;
                                      const showAsWrong = isSelected && !isCorrect;
                                      
                                      return (
                                        <div
                                          key={optIndex}
                                          style={{
                                            padding: "0.75rem",
                                            backgroundColor: showAsCorrect ? "#d1fae5" : showAsWrong ? "#fee2e2" : "#f8fafc",
                                            border: `2px solid ${showAsCorrect ? "#10b981" : showAsWrong ? "#ef4444" : "#e2e8f0"}`,
                                            borderRadius: "0.5rem",
                                            display: "flex",
                                            alignItems: "center",
                                            gap: "0.5rem",
                                          }}
                                        >
                                          <span
                                            style={{
                                              fontWeight: 700,
                                              color: showAsCorrect ? "#059669" : showAsWrong ? "#dc2626" : "#64748b",
                                              fontSize: "0.875rem",
                                              minWidth: "24px",
                                            }}
                                          >
                                            {optionLetter}.
                                          </span>
                                          <span style={{ flex: 1, color: "#1e293b", fontSize: "0.875rem" }}>
                                            {option}
                                          </span>
                                          {showAsCorrect && (
                                            <span style={{ color: "#059669", fontWeight: 700, fontSize: "0.875rem" }}>
                                              ✓ Correct
                                            </span>
                                          )}
                                          {showAsWrong && (
                                            <span style={{ color: "#dc2626", fontWeight: 700, fontSize: "0.875rem" }}>
                                              ✗ Selected (Wrong)
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                  {questionLog.isMcqCorrect !== undefined && (
                                    <div style={{ marginTop: "0.75rem", padding: "0.75rem", backgroundColor: questionLog.isMcqCorrect ? "#f0fdf4" : "#fef2f2", border: `1px solid ${questionLog.isMcqCorrect ? "#10b981" : "#ef4444"}`, borderRadius: "0.5rem" }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <span style={{ fontWeight: 600, color: questionLog.isMcqCorrect ? "#065f46" : "#991b1b", fontSize: "0.875rem" }}>
                                          Answer Status:
                                        </span>
                                        <span style={{ fontWeight: 700, color: questionLog.isMcqCorrect ? "#059669" : "#dc2626", fontSize: "1rem" }}>
                                          {questionLog.isMcqCorrect ? "✓ Correct" : "✗ Incorrect"}
                                        </span>
                                      </div>
                                      {!questionLog.isMcqCorrect && questionLog.correctAnswer && (
                                        <p style={{ marginTop: "0.5rem", marginBottom: 0, fontSize: "0.875rem", color: "#991b1b", fontWeight: 600 }}>
                                          Correct Answer: {questionLog.correctAnswer}
                                        </p>
                                      )}
                                      {questionLog.aiScore !== undefined && (
                                        <p style={{ marginTop: "0.5rem", marginBottom: 0, fontSize: "0.875rem", color: questionLog.isMcqCorrect ? "#047857" : "#991b1b", fontWeight: 600 }}>
                                          Score: {questionLog.aiScore} / {questionLog.maxScore || 5} points
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* AI Score for non-MCQ questions */}
                              {questionLog.questionType !== "MCQ" && questionLog.aiScore !== undefined && (
                                <div style={{ marginTop: "0.75rem", padding: "0.75rem", backgroundColor: "#f0fdf4", border: "1px solid #10b981", borderRadius: "0.5rem" }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span style={{ fontWeight: 600, color: "#065f46", fontSize: "0.875rem" }}>
                                      AI Evaluated Score (Last Version):
                                    </span>
                                    <span style={{ fontWeight: 700, color: "#059669", fontSize: "1rem" }}>
                                      {questionLog.aiScore} / {questionLog.maxScore || 5} points
                                    </span>
                                  </div>
                                  {questionLog.aiFeedback && (
                                    <p style={{ marginTop: "0.5rem", marginBottom: 0, fontSize: "0.875rem", color: "#047857" }}>
                                      {questionLog.aiFeedback}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Answer Versions */}
                            <div style={{ marginTop: "1rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
                              <h4 style={{ margin: 0, marginBottom: "1rem", fontSize: "0.9375rem", color: "#1e293b", fontWeight: 600 }}>
                                Answer Versions:
                              </h4>
                              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                                {questionLog.logs.map((log, logIndex) => (
                                  <div
                                    key={logIndex}
                                    style={{
                                      padding: "0.875rem",
                                      backgroundColor: "#f8fafc",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: "0.5rem",
                                    }}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                                      <span
                                        style={{
                                          backgroundColor: "#dbeafe",
                                          color: "#1e40af",
                                          padding: "0.25rem 0.75rem",
                                          borderRadius: "9999px",
                                          fontSize: "0.75rem",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Version {log.version}
                                      </span>
                                      <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                        {formatTimestamp(log.timestamp)}
                                      </span>
                                    </div>
                                    <p
                                      style={{
                                        color: "#1e293b",
                                        lineHeight: 1.6,
                                        whiteSpace: "pre-wrap",
                                        margin: 0,
                                        fontSize: "0.875rem",
                                      }}
                                    >
                                      {log.answer || "(Empty answer)"}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence Gallery (Snapshots) */}
        {snapshotsWithImages.length > 0 && (
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              padding: "1.5rem 2rem",
              marginBottom: "1.5rem",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6953a3" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#1a1625", fontWeight: 700 }}>
                  Evidence Gallery ({snapshotsWithImages.length} snapshots)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowSnapshots(!showSnapshots)}
                className="btn-secondary"
                style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
              >
                {showSnapshots ? "Hide" : "Show"} Snapshots
              </button>
            </div>

            {showSnapshots && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                  gap: "1rem",
                  marginTop: "1rem",
                }}
              >
                {snapshotsWithImages.map((log, index) => (
                  <div
                    key={log._id || index}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.5rem",
                      overflow: "hidden",
                      backgroundColor: "#f8fafc",
                      cursor: "pointer",
                    }}
                    onClick={() => setSelectedSnapshot(log)}
                  >
                    <div style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>
                      <span
                        style={{
                          backgroundColor: "#fecaca",
                          color: "#dc2626",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "0.25rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        {log.eventType}
                      </span>
                      <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: "#64748b" }}>
                        {formatTimestamp(log.timestamp)}
                      </p>
                    </div>
                    <div style={{ padding: "0.5rem" }}>
                      <img
                        src={log.snapshotBase64}
                        alt={`Snapshot for ${log.eventType}`}
                        style={{
                          width: "100%",
                          height: "auto",
                          borderRadius: "0.25rem",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Snapshot Modal */}
      {selectedSnapshot && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "2rem",
          }}
          onClick={() => setSelectedSnapshot(null)}
          onKeyDown={(e) => e.key === "Escape" && setSelectedSnapshot(null)}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              maxWidth: "90vw",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "1.5rem",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div>
                <span
                  style={{
                    backgroundColor: "#fecaca",
                    color: "#dc2626",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "0.25rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                  }}
                >
                  {selectedSnapshot.eventType}
                </span>
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.875rem", color: "#64748b" }}>
                  {formatTimestamp(selectedSnapshot.timestamp)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSnapshot(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "1.5rem",
                  cursor: "pointer",
                  color: "#64748b",
                }}
                aria-label="Close modal"
              >
                ×
              </button>
            </div>
            {selectedSnapshot.snapshotBase64 && (
              <img
                src={selectedSnapshot.snapshotBase64}
                alt={`Full snapshot for ${selectedSnapshot.eventType}`}
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  borderRadius: "0.5rem",
                }}
              />
            )}
            {selectedSnapshot.metadata && Object.keys(selectedSnapshot.metadata).length > 0 && (
              <div style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f8fafc", borderRadius: "0.5rem" }}>
                <h4 style={{ margin: "0 0 0.5rem", fontSize: "0.875rem", color: "#1e293b" }}>Metadata:</h4>
                <pre style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", whiteSpace: "pre-wrap" }}>
                  {JSON.stringify(selectedSnapshot.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth;
