import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Eye,
  Globe,
  Globe2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Bot,
  FileText,
  Server,
} from "lucide-react";

type Difficulty = "easy" | "medium" | "hard";
type QuestionKind = "command" | "terraform" | "lint";

interface DevOpsQuestionView {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  kind: QuestionKind;
  points: number;
  ai_generated?: boolean;
  is_published: boolean;
  created_at: string;
}

const SAMPLE_QUESTIONS: DevOpsQuestionView[] = [
  {
    id: "scenario-docker-node-fix",
    title: "Scenario: Node.js Docker startup failure",
    description:
      "A Node.js app fails to start in Docker with missing dependencies. Fix the Dockerfile to install dependencies in a cache-friendly order.",
    difficulty: "easy",
    kind: "lint",
    points: 35,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "scenario-runtime-inspection",
    title: "Scenario: Investigate unhealthy container",
    description:
      "Write one operational command to list container names and statuses for quick triage.",
    difficulty: "easy",
    kind: "command",
    points: 30,
    is_published: true,
    created_at: new Date().toISOString(),
  },
  {
    id: "scenario-terraform-plan",
    title: "Scenario: Validate infra change before apply",
    description:
      "Prepare minimal Terraform configuration that supports plan execution successfully.",
    difficulty: "medium",
    kind: "terraform",
    points: 35,
    is_published: false,
    created_at: new Date().toISOString(),
  },
];

interface DeleteConfirmModalProps {
  isOpen: boolean;
  questionTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirmModal({ isOpen, questionTitle, onConfirm, onCancel }: DeleteConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(17, 24, 39, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: "1rem",
      }}
      onClick={onCancel}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "1rem",
          maxWidth: "480px",
          width: "100%",
          padding: "2rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #E5E7EB",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <div style={{ backgroundColor: "#FEE2E2", color: "#DC2626", padding: "0.5rem", borderRadius: "0.5rem" }}>
              <Trash2 size={24} />
            </div>
            <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#111827" }}>Delete Question</h3>
          </div>
          <p style={{ margin: 0, color: "#4B5563", fontSize: "0.95rem", lineHeight: "1.5" }}>
            Are you sure you want to delete <strong>"{questionTitle}"</strong>? This action cannot be undone.
          </p>
        </div>
        <div style={{ display: "flex", gap: "1rem", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#374151",
              backgroundColor: "#ffffff",
              border: "1px solid #D1D5DB",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#ffffff",
              backgroundColor: "#DC2626",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            Yes, Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeDifficulty(value: string): Difficulty {
  const lowered = String(value || "").toLowerCase();
  if (lowered === "easy" || lowered === "medium" || lowered === "hard") return lowered;
  return "medium";
}

function normalizeKind(value: string): QuestionKind {
  const lowered = String(value || "").toLowerCase();
  if (lowered === "command" || lowered === "terraform" || lowered === "lint") return lowered;
  return "command";
}

function getDifficultyColor(difficulty: Difficulty) {
  switch (difficulty) {
    case "easy":
      return { color: "#059669", bg: "#D1FAE5", border: "#34D399" };
    case "medium":
      return { color: "#D97706", bg: "#FEF3C7", border: "#FBBF24" };
    case "hard":
      return { color: "#DC2626", bg: "#FEE2E2", border: "#F87171" };
  }
}

export default function DevOpsQuestionsPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<DevOpsQuestionView[]>(SAMPLE_QUESTIONS);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<{ id: string; title: string } | null>(null);
  const [successToast, setSuccessToast] = useState({ isOpen: false, message: "" });
  const [errorToast, setErrorToast] = useState({ isOpen: false, message: "" });

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("devopsAIGeneratedPayload");
      if (!raw) return;
      const parsed = JSON.parse(raw) as { questions?: Array<Record<string, unknown>> };
      if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) return;

      const generated = parsed.questions.map((item, idx) => ({
        id: String(item.id || `generated-devops-${idx + 1}`),
        title: String(item.title || `Generated DevOps Question ${idx + 1}`),
        description: String(item.description || "Generated DevOps question."),
        difficulty: normalizeDifficulty(String(item.difficulty || "medium")),
        kind: normalizeKind(String(item.kind || "command")),
        points: Number(item.points || 10),
        ai_generated: true,
        is_published: true,
        created_at: new Date().toISOString(),
      }));

      setQuestions(generated);
    } catch {
      setErrorToast({ isOpen: true, message: "Failed to load generated DevOps questions." });
    }
  }, []);

  useEffect(() => {
    if (!successToast.isOpen) return;
    const t = setTimeout(() => setSuccessToast({ isOpen: false, message: "" }), 2500);
    return () => clearTimeout(t);
  }, [successToast.isOpen]);

  useEffect(() => {
    if (!errorToast.isOpen) return;
    const t = setTimeout(() => setErrorToast({ isOpen: false, message: "" }), 4000);
    return () => clearTimeout(t);
  }, [errorToast.isOpen]);

  const sortedQuestions = useMemo(() => [...questions], [questions]);

  const handleDeleteClick = (questionId: string, questionTitle: string) => {
    setQuestionToDelete({ id: questionId, title: questionTitle });
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!questionToDelete) return;
    setQuestions((prev) => prev.filter((q) => q.id !== questionToDelete.id));
    setDeleteModalOpen(false);
    setSuccessToast({ isOpen: true, message: "Question deleted successfully!" });
    setQuestionToDelete(null);
  };

  const handleTogglePublish = (questionId: string) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === questionId ? { ...q, is_published: !q.is_published } : q))
    );
    setSuccessToast({ isOpen: true, message: "Question status updated." });
  };

  return (
    <>
      <style jsx>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <DeleteConfirmModal
          isOpen={deleteModalOpen}
          questionTitle={questionToDelete?.title || ""}
          onConfirm={handleDeleteConfirm}
          onCancel={() => {
            setDeleteModalOpen(false);
            setQuestionToDelete(null);
          }}
        />

        {successToast.isOpen && (
          <div
            style={{
              position: "fixed",
              top: "1.5rem",
              right: "1.5rem",
              backgroundColor: "#F0FDF4",
              border: "1px solid #10B981",
              color: "#065F46",
              padding: "1rem 1.25rem",
              borderRadius: "0.5rem",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              zIndex: 10001,
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              minWidth: "300px",
              animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <CheckCircle2 size={20} strokeWidth={2.5} />
            <span style={{ fontSize: "0.9375rem", fontWeight: 600 }}>{successToast.message}</span>
          </div>
        )}

        {errorToast.isOpen && (
          <div
            style={{
              position: "fixed",
              top: "1.5rem",
              right: "1.5rem",
              backgroundColor: "#FEF2F2",
              border: "1px solid #EF4444",
              color: "#991B1B",
              padding: "1rem 1.25rem",
              borderRadius: "0.5rem",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              zIndex: 10001,
              display: "flex",
              alignItems: "center",
              gap: "0.75rem",
              minWidth: "300px",
              animation: "slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            <XCircle size={20} strokeWidth={2.5} />
            <span style={{ fontSize: "0.9375rem", fontWeight: 600 }}>{errorToast.message}</span>
          </div>
        )}

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 2rem" }}>
          <div style={{ marginBottom: "2rem", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
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
                  marginBottom: "1rem",
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = "#00684A")}
                onMouseOut={(e) => (e.currentTarget.style.color = "#6B7280")}
              >
                <ArrowLeft size={16} strokeWidth={2.5} /> DevOps Dashboard
              </button>
              <h1 style={{ margin: 0, color: "#111827", fontSize: "2.25rem", fontWeight: 800, letterSpacing: "-0.025em" }}>
                DevOps Question Repository
              </h1>
              <p style={{ margin: "0.5rem 0 0 0", color: "#6B7280", fontSize: "1rem" }}>
                Manage {sortedQuestions.length} existing DevOps questions.
              </p>
            </div>

            <Link href="/devops/questions/create" style={{ textDecoration: "none" }}>
              <button
                style={{
                  padding: "0.75rem 1.25rem",
                  backgroundColor: "#00684A",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontWeight: 600,
                  fontSize: "0.9375rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  cursor: "pointer",
                }}
              >
                <Plus size={18} strokeWidth={2.5} /> Create New Question
              </button>
            </Link>
          </div>

          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              border: "1px solid #E5E7EB",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              overflow: "hidden",
            }}
          >
            {sortedQuestions.length === 0 ? (
              <div style={{ padding: "5rem 2rem", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ backgroundColor: "#F3F4F6", padding: "1.5rem", borderRadius: "50%", marginBottom: "1.5rem", color: "#9CA3AF" }}>
                  <FileText size={48} strokeWidth={1.5} />
                </div>
                <h3 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600 }}>Repository is empty</h3>
                <p style={{ margin: "0 0 1.5rem 0", color: "#6B7280", maxWidth: "400px", lineHeight: "1.5" }}>
                  You have no DevOps questions yet. Generate questions to populate this repository.
                </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {sortedQuestions.map((q, idx) => {
                  const diffColors = getDifficultyColor(q.difficulty);
                  return (
                    <div
                      key={q.id}
                      style={{
                        padding: "1.5rem 2rem",
                        borderBottom: idx !== sortedQuestions.length - 1 ? "1px solid #E5E7EB" : "none",
                        backgroundColor: "#ffffff",
                        transition: "background-color 0.2s",
                        display: "flex",
                        alignItems: "flex-start",
                        justifyContent: "space-between",
                        gap: "2rem",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                          <h3 style={{ margin: 0, color: "#111827", fontSize: "1.125rem", fontWeight: 700 }}>{q.title}</h3>
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.375rem",
                              padding: "0.25rem 0.625rem",
                              borderRadius: "2rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: q.is_published ? "#059669" : "#6B7280",
                              backgroundColor: q.is_published ? "#D1FAE5" : "#F3F4F6",
                              border: `1px solid ${q.is_published ? "#A7F3D0" : "#E5E7EB"}`,
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                backgroundColor: q.is_published ? "#059669" : "#6B7280",
                              }}
                            />
                            {q.is_published ? "Published" : "Draft"}
                          </span>
                        </div>
                        <p style={{ margin: "0 0 1rem 0", color: "#4B5563", fontSize: "0.9375rem", lineHeight: "1.5" }}>{q.description}</p>
                        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                          <span
                            style={{
                              padding: "0.25rem 0.75rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: diffColors.color,
                              backgroundColor: diffColors.bg,
                              border: `1px solid ${diffColors.border}`,
                            }}
                          >
                            {q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1)}
                          </span>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.375rem",
                              padding: "0.25rem 0.75rem",
                              borderRadius: "0.375rem",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: "#00684A",
                              backgroundColor: "#F0F9F4",
                              border: "1px solid #E1F2E9",
                            }}
                          >
                            <Server size={12} /> {q.kind.toUpperCase()}
                          </span>
                          {q.ai_generated && (
                            <span
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "0.375rem",
                                padding: "0.25rem 0.75rem",
                                borderRadius: "0.375rem",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                color: "#6D28D9",
                                backgroundColor: "#EDE9FE",
                                border: "1px solid #DDD6FE",
                              }}
                            >
                              <Bot size={12} /> AI Generated
                            </span>
                          )}
                          <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", color: "#9CA3AF", fontSize: "0.75rem", marginLeft: "0.5rem" }}>
                            <Clock size={12} /> {new Date(q.created_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
                        <Link href="/devops/tests/sample/take" style={{ textDecoration: "none" }}>
                          <button
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "0.375rem",
                              padding: "0.5rem 0.75rem",
                              fontSize: "0.875rem",
                              fontWeight: 600,
                              color: "#4B5563",
                              backgroundColor: "#ffffff",
                              border: "1px solid #D1D5DB",
                              borderRadius: "0.5rem",
                              cursor: "pointer",
                            }}
                          >
                            <Eye size={16} /> Preview
                          </button>
                        </Link>
                        <button
                          onClick={() => handleTogglePublish(q.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.375rem",
                            padding: "0.5rem 0.75rem",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color: q.is_published ? "#D97706" : "#059669",
                            backgroundColor: "transparent",
                            border: "1px solid transparent",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                          }}
                          title={q.is_published ? "Unpublish" : "Publish"}
                        >
                          {q.is_published ? <Globe2 size={16} /> : <Globe size={16} />}
                          {q.is_published ? "Unpublish" : "Publish"}
                        </button>
                        <button
                          onClick={() => handleDeleteClick(q.id, q.title)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: "0.5rem",
                            color: "#DC2626",
                            backgroundColor: "transparent",
                            border: "1px solid transparent",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                          }}
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
