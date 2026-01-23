import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../../lib/auth";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { useAssessmentQuestions, useGenerateQuestions, useFinalizeAssessment } from "@/hooks/api/useAssessments";

interface Question {
  questionText: string;
  type: string;
  difficulty: string;
  options?: string[];
  correctAnswer?: string;
  idealAnswer?: string;
  expectedLogic?: string;
  topic?: string;
  questionIndex?: number;
  time?: number;
  score?: number;
}

interface Topic {
  topic: string;
  questions: Question[];
  numQuestions: number;
  questionTypes: string[];
  difficulty: string;
}

export default function QuestionsPage() {
  const router = useRouter();
  const { id } = router.query;
  const assessmentId = typeof id === 'string' ? id : undefined;
  
  // React Query hooks
  const { data: questionsData, isLoading: loading, error: queryError, refetch: refetchQuestions } = useAssessmentQuestions(assessmentId);
  const generateQuestionsMutation = useGenerateQuestions();
  const finalizeAssessmentMutation = useFinalizeAssessment();
  
  const [topics, setTopics] = useState<Topic[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [showFinalize, setShowFinalize] = useState(false);
  const [finalTitle, setFinalTitle] = useState("");
  const [finalDescription, setFinalDescription] = useState("");
  const [generationSummary, setGenerationSummary] = useState<any>(null);

  // Transform questions data into topics structure
  useEffect(() => {
    if (questionsData) {
      // The hook returns questions array, but we need to check if it's wrapped in assessment
      const data = (questionsData as any).assessment || (questionsData as any).data || questionsData;
        // Transform the data into topics with questions
        const topicsMap: { [key: string]: Topic } = {};
        
        if (data.topics && Array.isArray(data.topics)) {
          data.topics.forEach((topic: any) => {
            topicsMap[topic.topic] = {
              topic: topic.topic,
              questions: [],
              numQuestions: topic.numQuestions || 0,
              questionTypes: topic.questionTypes || [],
              difficulty: topic.difficulty || "Medium",
            };
          });
        }

        // Questions might be in data.questions array OR inside topics
        if (data.questions && Array.isArray(data.questions)) {
          data.questions.forEach((question: any) => {
            const topicName = question.topic;
            if (topicsMap[topicName]) {
              topicsMap[topicName].questions.push(question);
            }
          });
        }

        // Also check if questions are directly in topics (this is the main source)
        if (data.topics && Array.isArray(data.topics)) {
          data.topics.forEach((topic: any) => {
            if (topic.questions && Array.isArray(topic.questions) && topic.questions.length > 0) {
              const topicName = topic.topic;
              if (topicsMap[topicName]) {
                // Replace questions array with questions from topic
                topicsMap[topicName].questions = topic.questions;
              }
            }
          });
        }

        const topicsList = Object.values(topicsMap);
        setTopics(topicsList);
        // Auto-expand all topics if questions exist
        if (topicsList.some(t => t.questions.length > 0)) {
          setExpandedTopics(new Set(topicsList.map(t => t.topic)));
        }
      }
  }, [questionsData]);

  // Handle query errors
  useEffect(() => {
    if (queryError) {
      setError((queryError as Error).message || "Failed to load questions");
    }
  }, [queryError]);

  const handleGenerateQuestions = async () => {
    if (!assessmentId) return;
    
    setGenerating(true);
    setError(null);
    setSuccess(null);
    setGenerationSummary(null);

    try {
      const response = await generateQuestionsMutation.mutateAsync({ assessmentId });
      const data = response.data;

      if (data?.summary) {
        setGenerationSummary(data.summary);
      }
      
      if (data?.failedTopics && data.failedTopics.length > 0) {
        setError(`Some questions failed to generate for: ${data.failedTopics.join(", ")}`);
      } else {
        setSuccess(`Successfully generated ${data?.summary?.totalQuestions || 0} questions!`);
      }
      
      await refetchQuestions();
    } catch (err: any) {
      console.error("Error generating questions:", err);
      setError(err.response?.data?.message || err.message || "Failed to generate questions");
    } finally {
      setGenerating(false);
    }
  };


  const handleFinalize = async () => {
    if (!finalTitle.trim() || !assessmentId) {
      setError("Title is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await finalizeAssessmentMutation.mutateAsync({
        assessmentId: assessmentId,
        title: finalTitle.trim(),
        description: finalDescription.trim() || undefined,
      });

      if (response?.success) {
        setSuccess("Assessment finalized successfully!");
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } else {
        setError("Failed to finalize assessment");
      }
    } catch (err: any) {
      console.error("Error finalizing assessment:", err);
      setError(err.response?.data?.message || err.message || "Failed to finalize assessment");
    } finally {
      setSaving(false);
    }
  };

  const toggleTopic = (topicName: string) => {
    const newExpanded = new Set(expandedTopics);
    if (newExpanded.has(topicName)) {
      newExpanded.delete(topicName);
    } else {
      newExpanded.add(topicName);
    }
    setExpandedTopics(newExpanded);
  };

  const toggleQuestion = (questionKey: string) => {
    const newExpanded = new Set(expandedQuestions);
    if (newExpanded.has(questionKey)) {
      newExpanded.delete(questionKey);
    } else {
      newExpanded.add(questionKey);
    }
    setExpandedQuestions(newExpanded);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Hard":
        return { bg: "#fee2e2", text: "#991b1b", border: "#fecaca" };
      case "Medium":
        return { bg: "#fef3c7", text: "#92400e", border: "#fde68a" };
      default:
        return { bg: "#d1fae5", text: "#065f46", border: "#a7f3d0" };
    }
  };

  const getTypeColor = (type: string) => {
    const colors: { [key: string]: { bg: string; text: string } } = {
      MCQ: { bg: "#dbeafe", text: "#1e40af" },
      Subjective: { bg: "#e0e7ff", text: "#3730a3" },
      "Pseudo Code": { bg: "#fce7f3", text: "#831843" },
      Descriptive: { bg: "#f3e8ff", text: "#6b21a8" },
      Aptitude: { bg: "#fef3c7", text: "#92400e" },
      Reasoning: { bg: "#d1fae5", text: "#065f46" },
    };
    return colors[type] || { bg: "#f1f5f9", text: "#475569" };
  };

  const totalQuestions = topics.reduce((sum, topic) => sum + topic.questions.length, 0);
  const hasQuestions = totalQuestions > 0;

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div style={{ textAlign: "center", padding: "3rem" }}>
            <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
            <p style={{ color: "#475569", fontSize: "1.125rem" }}>Loading questions...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: "#f1dcba", minHeight: "100vh" }}>
      <div className="container">
        <div className="card">
          <div style={{ marginBottom: "2rem" }}>
            <Link href="/dashboard" style={{ color: "#6953a3", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.5rem", fontWeight: 600 }}>
              <span>←</span> Back to Dashboard
            </Link>
          </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div>
              <h1 style={{ margin: 0, marginBottom: "0.5rem", fontSize: "clamp(1.5rem, 4vw, 2rem)", color: "#1a1625", fontWeight: 700 }}>Generated Questions</h1>
              <p style={{ color: "#64748b", margin: 0, fontSize: "0.9375rem" }}>
                {hasQuestions
                  ? `${totalQuestions} question${totalQuestions !== 1 ? "s" : ""} across ${topics.length} topic${topics.length !== 1 ? "s" : ""}`
                  : "Generate questions for your configured topics"}
              </p>
            </div>
            {id && typeof id === 'string' && (
              <Link href={`/assessments/${id}/analytics`}>
                <button
                  type="button"
                  className="btn-primary"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.75rem 1.5rem",
                    fontSize: "0.875rem",
                    marginTop: 0,
                  }}
                >
                  <BarChart3 style={{ width: "16px", height: "16px" }} />
                  Analytics
                </button>
              </Link>
            )}
          </div>
          {!hasQuestions && (
            <button
              type="button"
              onClick={handleGenerateQuestions}
              className="btn-primary"
              disabled={generating}
              style={{ 
                padding: "0.75rem 1.5rem",
                fontSize: "1rem",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                width: "100%",
                marginTop: 0
              }}
            >
              {generating ? (
                <>
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
                  Generating...
                </>
              ) : (
                <>
                  <span>✨</span>
                  Generate Questions
                </>
              )}
            </button>
          )}
        </div>

        {error && (
          <div className="alert alert-error" style={{ marginBottom: "1.5rem", padding: "1rem", borderRadius: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "start", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.25rem" }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <strong style={{ display: "block", marginBottom: "0.25rem" }}>Error</strong>
                <span>{error}</span>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="alert alert-success" style={{ marginBottom: "1.5rem", padding: "1rem", borderRadius: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "start", gap: "0.75rem" }}>
              <span style={{ fontSize: "1.25rem" }}>✅</span>
              <div style={{ flex: 1 }}>
                <strong style={{ display: "block", marginBottom: "0.25rem" }}>Success</strong>
                <span>{success}</span>
              </div>
            </div>
          </div>
        )}

        {generationSummary && (
          <div style={{ 
            marginBottom: "1.5rem", 
            padding: "1rem", 
            backgroundColor: "#f0f9ff", 
            borderRadius: "0.5rem",
            border: "1px solid #bae6fd"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "1.25rem" }}>📊</span>
              <strong style={{ color: "#0c4a6e" }}>Generation Summary</strong>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))", gap: "1rem", marginTop: "0.75rem" }}>
              <div>
                <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Total Topics</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0c4a6e" }}>{generationSummary.totalTopics}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Successful</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#059669" }}>{generationSummary.successfulTopics}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Failed</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: generationSummary.failedTopics > 0 ? "#dc2626" : "#059669" }}>
                  {generationSummary.failedTopics}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Total Questions</div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#0c4a6e" }}>{generationSummary.totalQuestions}</div>
              </div>
            </div>
          </div>
        )}

        {!hasQuestions ? (
          <div style={{ textAlign: "center", padding: "4rem 2rem", backgroundColor: "#f8fafc", borderRadius: "0.75rem" }}>
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>📝</div>
            <h3 style={{ marginBottom: "0.5rem", color: "#1e293b" }}>No Questions Generated Yet</h3>
            <p style={{ color: "#64748b", marginBottom: "2rem", maxWidth: "500px", margin: "0 auto 2rem" }}>
              Click the button above to generate high-quality questions using AI. The system will create questions based on your configured topics, difficulty levels, and question types.
            </p>
          </div>
        ) : (
          <>
            {topics.map((topic) => {
              const isExpanded = expandedTopics.has(topic.topic);
              const diffColor = getDifficultyColor(topic.difficulty);
              const hasAllQuestions = topic.questions.length >= topic.numQuestions;
              
              return (
                <div
                  key={topic.topic}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    marginBottom: "1.5rem",
                    backgroundColor: "#ffffff",
                    overflow: "hidden",
                    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
                  }}
                >
                  {/* Topic Header */}
                  <div
                    onClick={() => toggleTopic(topic.topic)}
                    style={{
                      padding: "1.25rem 1.5rem",
                      backgroundColor: isExpanded ? "#f8fafc" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      borderBottom: isExpanded ? "1px solid #e2e8f0" : "none",
                      transition: "background-color 0.2s",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem", flexWrap: "wrap" }}>
                        <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#0f172a", fontWeight: 600 }}>
                          {topic.topic}
                        </h2>
                        <span
                          style={{
                            backgroundColor: diffColor.bg,
                            color: diffColor.text,
                            padding: "0.25rem 0.75rem",
                            borderRadius: "9999px",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            border: `1px solid ${diffColor.border}`,
                          }}
                        >
                          {topic.difficulty}
                        </span>
                        {!hasAllQuestions && (
                          <span style={{ 
                            fontSize: "0.75rem", 
                            color: "#dc2626",
                            fontWeight: 500
                          }}>
                            ⚠️ {topic.questions.length}/{topic.numQuestions} questions
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                        <span style={{ color: "#64748b", fontSize: "0.875rem" }}>
                          {topic.questions.length} question{topic.questions.length !== 1 ? "s" : ""}
                        </span>
                        {topic.questionTypes.length > 0 && (
                          <>
                            <span style={{ color: "#cbd5e1" }}>•</span>
                            <span style={{ color: "#64748b", fontSize: "0.875rem" }}>
                              {topic.questionTypes.join(", ")}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: "1.5rem", color: "#64748b", transition: "transform 0.2s", transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                      ▼
                    </div>
                  </div>

                  {/* Questions List */}
                  {isExpanded && (
                    <div style={{ padding: "1.5rem" }}>
                      {topic.questions.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                          No questions generated for this topic yet.
                        </div>
                      ) : (
                        topic.questions.map((question, qIndex) => {
                          const questionKey = `${topic.topic}-${qIndex}`;
                          const isQExpanded = expandedQuestions.has(questionKey);
                          const typeColor = getTypeColor(question.type);
                          const qDiffColor = getDifficultyColor(question.difficulty);

                          return (
                            <div
                              key={qIndex}
                              style={{
                                border: "1px solid #e2e8f0",
                                borderRadius: "0.5rem",
                                marginBottom: "1rem",
                                backgroundColor: "#ffffff",
                                overflow: "hidden",
                              }}
                            >
                              {/* Question Header */}
                              <div
                                onClick={() => toggleQuestion(questionKey)}
                                style={{
                                  padding: "1rem 1.25rem",
                                  backgroundColor: isQExpanded ? "#f8fafc" : "#ffffff",
                                  cursor: "pointer",
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "start",
                                  borderBottom: isQExpanded ? "1px solid #e2e8f0" : "none",
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                                    <span
                                      style={{
                                        backgroundColor: "#6953a3",
                                        color: "#ffffff",
                                        padding: "0.25rem 0.75rem",
                                        borderRadius: "9999px",
                                        fontSize: "0.75rem",
                                        fontWeight: 700,
                                        minWidth: "2.5rem",
                                        textAlign: "center",
                                      }}
                                    >
                                      Q{qIndex + 1}
                                    </span>
                                    <span
                                      style={{
                                        backgroundColor: typeColor.bg,
                                        color: typeColor.text,
                                        padding: "0.25rem 0.75rem",
                                        borderRadius: "9999px",
                                        fontSize: "0.75rem",
                                        fontWeight: 600,
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      {question.type}
                                    </span>
                                    <span
                                      style={{
                                        backgroundColor: qDiffColor.bg,
                                        color: qDiffColor.text,
                                        padding: "0.25rem 0.75rem",
                                        borderRadius: "9999px",
                                        fontSize: "0.75rem",
                                        fontWeight: 500,
                                        border: `1px solid ${qDiffColor.border}`,
                                      }}
                                    >
                                      {question.difficulty}
                                    </span>
                                  </div>
                                  {!isQExpanded && (
                                    <p
                                      style={{
                                        color: "#64748b",
                                        margin: 0,
                                        marginTop: "0.5rem",
                                        lineHeight: 1.5,
                                        fontWeight: 400,
                                        fontSize: "0.875rem",
                                        fontStyle: "italic",
                                      }}
                                    >
                                      Click to view question details
                                    </p>
                                  )}
                                </div>
                                <div style={{ fontSize: "1.25rem", color: "#64748b", marginLeft: "1rem", transition: "transform 0.2s", transform: isQExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>
                                  ▼
                                </div>
                              </div>

                              {/* Question Details */}
                              {isQExpanded && (
                                <div style={{ padding: "1.25rem", backgroundColor: "#f8fafc" }}>
                                  <div style={{ marginBottom: "1rem" }}>
                                    <p style={{ color: "#1e293b", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontWeight: 700 }}>
                                      {question.questionText}
                                    </p>
                                  </div>

                                  {question.type === "MCQ" && question.options && (
                                    <div style={{ marginBottom: "1rem" }}>
                                      <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#475569", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                        Options
                                      </h4>
                                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                                        {question.options.map((option, optIndex) => {
                                          const isCorrect = question.correctAnswer === String.fromCharCode(65 + optIndex) || 
                                                           question.correctAnswer === option ||
                                                           (optIndex === 0 && !question.correctAnswer);
                                          return (
                                            <div
                                              key={optIndex}
                                              style={{
                                                padding: "0.75rem 1rem",
                                                backgroundColor: "#ffffff",
                                                borderRadius: "0.5rem",
                                                border: `2px solid ${isCorrect ? "#10b981" : "#e2e8f0"}`,
                                                display: "flex",
                                                alignItems: "start",
                                                gap: "0.75rem",
                                              }}
                                            >
                                              <span style={{ 
                                                fontWeight: 700, 
                                                color: isCorrect ? "#10b981" : "#64748b",
                                                minWidth: "1.5rem"
                                              }}>
                                                {String.fromCharCode(65 + optIndex)}.
                                              </span>
                                              <span style={{ flex: 1, color: "#1e293b" }}>{option}</span>
                                              {isCorrect && (
                                                <span style={{ color: "#10b981", fontWeight: 700, fontSize: "1.125rem" }}>
                                                  ✓
                                                </span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}

                                  {(question.type === "Subjective" || question.type === "Descriptive") && question.idealAnswer && (
                                    <div style={{ marginBottom: "1rem" }}>
                                      <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#475569", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                        Ideal Answer
                                      </h4>
                                      <div style={{ 
                                        backgroundColor: "#ffffff", 
                                        padding: "1rem", 
                                        borderRadius: "0.5rem",
                                        border: "1px solid #e2e8f0"
                                      }}>
                                        <p style={{ color: "#1e293b", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0 }}>
                                          {question.idealAnswer}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {question.type === "Pseudo Code" && question.expectedLogic && (
                                    <div>
                                      <h4 style={{ fontSize: "0.875rem", fontWeight: 700, color: "#475569", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                        Expected Logic
                                      </h4>
                                      <div style={{ 
                                        backgroundColor: "#ffffff", 
                                        padding: "1rem", 
                                        borderRadius: "0.5rem",
                                        border: "1px solid #e2e8f0"
                                      }}>
                                        <p style={{ color: "#1e293b", lineHeight: 1.7, whiteSpace: "pre-wrap", margin: 0, fontFamily: "monospace", fontSize: "0.875rem" }}>
                                          {question.expectedLogic}
                                        </p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "2px solid #e2e8f0" }}>
              {!showFinalize ? (
                <div style={{ textAlign: "center" }}>
                  <button
                    type="button"
                    onClick={() => setShowFinalize(true)}
                    className="btn-primary"
                    style={{ fontSize: "1rem", padding: "0.875rem 2rem", fontWeight: 600, width: "100%" }}
                  >
                    Finalize Assessment
                  </button>
                </div>
              ) : (
                <div style={{ backgroundColor: "#f8fafc", padding: "1.5rem", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
                  <h3 style={{ marginBottom: "1.5rem", fontSize: "1.25rem", color: "#0f172a" }}>Finalize Assessment</h3>
                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                      Title <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <input
                      type="text"
                      value={finalTitle}
                      onChange={(e) => setFinalTitle(e.target.value)}
                      placeholder="Enter assessment title"
                      required
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #e2e8f0",
                        borderRadius: "0.5rem",
                        fontSize: "1rem",
                      }}
                    />
                  </div>
                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                      Description
                    </label>
                    <textarea
                      value={finalDescription}
                      onChange={(e) => setFinalDescription(e.target.value)}
                      placeholder="Enter assessment description (optional)"
                      rows={4}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #e2e8f0",
                        borderRadius: "0.5rem",
                        fontSize: "1rem",
                        fontFamily: "inherit",
                        resize: "vertical",
                      }}
                    />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={handleFinalize}
                      className="btn-primary"
                      disabled={saving || !finalTitle.trim()}
                      style={{ width: "100%" }}
                    >
                      {saving ? "Finalizing..." : "Finalize & Complete"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowFinalize(false)}
                      className="btn-secondary"
                      disabled={saving}
                      style={{ width: "100%" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth;
