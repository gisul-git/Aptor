import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../lib/auth";
import Link from "next/link";
import { QuestionGenerationSkeleton } from "@/components/QuestionGenerationSkeleton";
// React Query hooks
import {
  useAssessment,
  useAssessmentQuestions,
  useCurrentDraft,
  useUpdateDraft,
  useGenerateTopicCards,
  useFetchAndSummarizeUrl,
  useGenerateTopicsV2,
  useGenerateTopicsFromRequirements,
  useGenerateTopics,
  useCreateFromJobDesignation,
  useImproveTopic,
  useGenerateQuestion,
  useImproveAllTopics,
  useGenerateTopicContext,
  useValidateTopicCategory,
  useCheckTechnicalTopic,
  useSuggestTopics,
  useAddCustomTopic,
  useClassifyTechnicalTopic,
  useDetectTopicCategory,
  useSuggestTopicContexts,
  useAddQuestionRow,
  useRegenerateQuestion,
  useRegenerateTopic,
  useRemoveTopic,
  useFinalizeAssessment,
  useUpdateQuestions,
  useUpdateScheduleAndCandidates,
  useUpdateSingleQuestion,
  useGenerateQuestionsFromConfig,
  useAITopicSuggestion,
  useRemoveQuestionRow,
  useUpdateQuestionType,
  useDeleteTopicQuestions,
  useSendInvitations,
} from "@/hooks/api/useAssessments";


import { User, Plus, X, Sparkles, FileType, CheckCircle2, ChevronRight, ArrowLeft, ArrowRight, Edit3, Link as LinkIcon, Copy, Lightbulb, BookOpen, FileText, Clock, FastForward, Check, Calendar, Globe, Info, Mail, ChevronDown, RefreshCw } from 'lucide-react';
// ============================================
// QUESTION RENDERING COMPONENTS
// ============================================

const renderMCQQuestion = (
  question: any,
  isEditing: boolean,
  onEditChange?: (value: string) => void,
) => {
  // Handle both 'question' and 'questionText' field names for backward compatibility
  const questionText = question.question || question.questionText || "";

  if (isEditing && onEditChange) {
    return (
      <div>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 600,
            color: "#1e293b",
          }}
        >  
          Question:
        </label>
        <textarea
          value={questionText}
          onChange={(e) =>
            onEditChange(
              JSON.stringify(
                {
                  ...question,
                  question: e.target.value,
                  questionText: e.target.value,
                },
                null,
                2,
              ),
            )
          }
          style={{
            width: "100%",
            minHeight: "80px",
            padding: "0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}
        />
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 600,
            color: "#1e293b",
          }}
        >
          Options:
        </label>
        {(question.options || []).map((option: string, idx: number) => (
          <div
            key={idx}
            style={{
              marginBottom: "0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span
              style={{ fontWeight: 600, color: "#64748b", minWidth: "24px" }}
            >
              {String.fromCharCode(65 + idx)}.
            </span>
            <input
              type="text"
              value={option}
              onChange={(e) => {
                const newOptions = [...(question.options || [])];
                newOptions[idx] = e.target.value;
                onEditChange(
                  JSON.stringify({ ...question, options: newOptions }, null, 2),
                );
              }}
              style={{
                flex: 1,
                padding: "0.5rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
              }}
            />
          </div>
        ))}
        <label
          style={{
            display: "block",
            marginTop: "1rem",
            marginBottom: "0.5rem",
            fontWeight: 600,
            color: "#1e293b",
          }}
        >
          Correct Answer:
        </label>
        <input
          type="text"
          value={question.correctAnswer || ""}
          onChange={(e) =>
            onEditChange(
              JSON.stringify(
                { ...question, correctAnswer: e.target.value },
                null,
                2,
              ),
            )
          }
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        <h3
          style={{
            fontSize: "1.125rem",
            fontWeight: 600,
            color: "#1e293b",
            marginBottom: "1rem",
          }}
        >
          {question.question || "Question"}
        </h3>
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}
        >
          {(question.options || []).map((option: string, idx: number) => {
            const isCorrect = option === question.correctAnswer;
            return (
              <div
                key={idx}
                style={{
                  padding: "0.75rem 1rem",
                  border: `2px solid ${isCorrect ? "#10b981" : "#e2e8f0"}`,
                  borderRadius: "0.5rem",
                  backgroundColor: isCorrect ? "#d1fae5" : "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    color: isCorrect ? "#065f46" : "#64748b",
                    minWidth: "32px",
                    fontSize: "0.875rem",
                  }}
                >
                  {String.fromCharCode(65 + idx)}.
                </span>
                <span style={{ flex: 1, color: "#1e293b" }}>{option}</span>
                {isCorrect && (
                  <span
                    style={{
                      padding: "0.25rem 0.75rem",
                      backgroundColor: "#10b981",
                      color: "#ffffff",
                      borderRadius: "0.375rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                    }}
                  >
                    Correct
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const renderSubjectiveQuestion = (
  question: any,
  isEditing: boolean,
  onEditChange?: (value: string) => void,
) => {
  // Handle both 'question' and 'questionText' field names for backward compatibility
  const questionText = question.question || question.questionText || "";

  if (isEditing && onEditChange) {
    return (
      <div>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 600,
            color: "#1e293b",
          }}
        >
          Question:
        </label>
        <textarea
          value={questionText}
          onChange={(e) =>
            onEditChange(
              JSON.stringify(
                {
                  ...question,
                  question: e.target.value,
                  questionText: e.target.value,
                },
                null,
                2,
              ),
            )
          }
          style={{
            width: "100%",
            minHeight: "150px",
            padding: "0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
          }}
          placeholder="Enter your subjective question (scenario-based or conceptual)..."
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        {questionText ? (
          <div
            style={{
              padding: "1.25rem",
              backgroundColor: "#ffffff",
              borderRadius: "0.5rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            }}
          >
            <div
              style={{
                fontSize: "1rem",
                color: "#1e293b",
                whiteSpace: "pre-wrap",
                lineHeight: "1.6",
              }}
            >
              {questionText}
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#fef3c7",
              borderRadius: "0.5rem",
              color: "#92400e",
            }}
          >
            No question text available. Please regenerate this question.
          </div>
        )}
      </div>
    </div>
  );
};

const renderPseudoCodeQuestion = (
  question: any,
  isEditing: boolean,
  onEditChange?: (value: string) => void,
) => {
  // Handle both 'question' and 'questionText' field names for backward compatibility
  // Also handle 'expectedLogic' (old) and 'expectedAnswer' (new) field names
  const questionText = question.question || question.questionText || "";
  const expectedAnswer =
    question.expectedAnswer || question.expectedLogic || "";
  const explanation = question.explanation || "";

  if (isEditing && onEditChange) {
    return (
      <div>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 600,
            color: "#1e293b",
          }}
        >
          Question:
        </label>
        <textarea
          value={questionText}
          onChange={(e) =>
            onEditChange(
              JSON.stringify(
                {
                  ...question,
                  question: e.target.value,
                  questionText: e.target.value,
                },
                null,
                2,
              ),
            )
          }
          style={{
            width: "100%",
            minHeight: "100px",
            padding: "0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}
        />
        {/* ⭐ REMOVED: Expected Answer (Pseudocode) - User doesn't want this field */}
        {explanation && (
          <>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: 600,
                color: "#1e293b",
              }}
            >
              Explanation:
            </label>
            <textarea
              value={explanation}
              onChange={(e) =>
                onEditChange(
                  JSON.stringify(
                    { ...question, explanation: e.target.value },
                    null,
                    2,
                  ),
                )
              }
              style={{
                width: "100%",
                minHeight: "100px",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
              }}
            />
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: "1.5rem" }}>
        {questionText ? (
          <h3
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "#1e293b",
              marginBottom: "1rem",
            }}
          >
            {questionText}
          </h3>
        ) : (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#fef3c7",
              borderRadius: "0.5rem",
              color: "#92400e",
            }}
          >
            No question text available. Please regenerate this question.
          </div>
        )}
        {/* ⭐ REMOVED: Expected Answer/Output - User doesn't want this displayed */}
        {explanation && (
          <div style={{ marginTop: "1rem" }}>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#64748b",
                marginBottom: "0.5rem",
              }}
            >
              Explanation:
            </div>
            <div
              style={{
                padding: "1rem",
                backgroundColor: "#f8fafc",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                color: "#1e293b",
                lineHeight: "1.6",
              }}
            >
              {explanation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const renderCodingQuestion = (
  question: any,
  isEditing: boolean,
  onEditChange?: (value: string) => void,
) => {
  // ⭐ CRITICAL FIX: Support multiple formats for problem statement
  // Priority: questionText > description > question > problemStatement > title + description/problemStatement
  // Backend generates questionText from title + description + examples, but also preserves description separately
  const questionText =
    question.questionText ||
    question.description ||
    question.question ||
    question.problemStatement ||
    (question.title
      ? `${question.title}\n\n${question.description || question.problemStatement || ""}`
      : "");

  const starterCode = question.starterCode || "";
  const visibleTestCases =
    question.visibleTestCases || (question.visibleTestCases ? [] : []);
  const hiddenTestCases = question.hiddenTestCases || [];
  const constraints = question.constraints || "";
  const functionSignature = question.functionSignature || "";
  const explanation = question.explanation || "";

  if (isEditing && onEditChange) {
    return (
      <div>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 600,
            color: "#1e293b",
          }}
        >
          Title:
        </label>
        <input
          type="text"
          value={question.title || ""}
          onChange={(e) =>
            onEditChange(
              JSON.stringify({ ...question, title: e.target.value }, null, 2),
            )
          }
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}
        />
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 600,
            color: "#1e293b",
          }}
        >
          Problem Statement:
        </label>
        <textarea
          value={
            question.questionText ||
            question.problemStatement ||
            question.description ||
            question.question ||
            ""
          }
          onChange={(e) =>
            onEditChange(
              JSON.stringify(
                {
                  ...question,
                  questionText: e.target.value,
                  problemStatement: e.target.value,
                },
                null,
                2,
              ),
            )
          }
          style={{
            width: "100%",
            minHeight: "100px",
            padding: "0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}
        />
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 600,
            color: "#1e293b",
          }}
        >
          Function Signature:
        </label>
        <textarea
          value={
            question.functionSignatureString ||
            (typeof question.functionSignature === "string"
              ? question.functionSignature
              : typeof question.functionSignature === "object" &&
                  question.functionSignature
                ? `${question.functionSignature.name || "function"}(${question.functionSignature.parameters?.map((p: any) => `${p.name}: ${p.type}`).join(", ") || ""}): ${question.functionSignature.return_type || ""}`
                : "")
          }
          onChange={(e) =>
            onEditChange(
              JSON.stringify(
                {
                  ...question,
                  functionSignature: e.target.value,
                  functionSignatureString: e.target.value,
                },
                null,
                2,
              ),
            )
          }
          style={{
            width: "100%",
            minHeight: "60px",
            padding: "0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontFamily: "monospace",
            marginBottom: "1rem",
          }}
        />
        {/* ⭐ Only show Input Format/Output Format if they have values (legacy support) */}
        {(question.inputFormat || question.outputFormat) && (
          <>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: 600,
                color: "#1e293b",
              }}
            >
              Input Format:
            </label>
            <textarea
              value={question.inputFormat || ""}
              onChange={(e) =>
                onEditChange(
                  JSON.stringify(
                    { ...question, inputFormat: e.target.value },
                    null,
                    2,
                  ),
                )
              }
              style={{
                width: "100%",
                minHeight: "60px",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                marginBottom: "1rem",
              }}
            />
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: 600,
                color: "#1e293b",
              }}
            >
              Output Format:
            </label>
            <textarea
              value={question.outputFormat || ""}
              onChange={(e) =>
                onEditChange(
                  JSON.stringify(
                    { ...question, outputFormat: e.target.value },
                    null,
                    2,
                  ),
                )
              }
              style={{
                width: "100%",
                minHeight: "60px",
                padding: "0.75rem",
                border: "1px solid #e2e8f0",
                borderRadius: "0.5rem",
                fontSize: "0.875rem",
                marginBottom: "1rem",
              }}
            />
          </>
        )}
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 600,
            color: "#1e293b",
          }}
        >
          Constraints:
        </label>
        <textarea
          value={question.constraints || ""}
          onChange={(e) =>
            onEditChange(
              JSON.stringify(
                { ...question, constraints: e.target.value },
                null,
                2,
              ),
            )
          }
          style={{
            width: "100%",
            minHeight: "80px",
            padding: "0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}
        />
        {/* ⭐ Only show Sample Input/Output if they have actual values AND no visibleTestCases (legacy support) */}
        {(!visibleTestCases || visibleTestCases.length === 0) &&
          (question.sampleInput?.trim() || question.sampleOutput?.trim()) && (
            <>
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: 600,
                  color: "#1e293b",
                }}
              >
                Sample Input:
              </label>
              <textarea
                value={question.sampleInput || ""}
                onChange={(e) =>
                  onEditChange(
                    JSON.stringify(
                      { ...question, sampleInput: e.target.value },
                      null,
                      2,
                    ),
                  )
                }
                style={{
                  width: "100%",
                  minHeight: "60px",
                  padding: "0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  fontFamily: "monospace",
                  marginBottom: "1rem",
                }}
              />
              <label
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  fontWeight: 600,
                  color: "#1e293b",
                }}
              >
                Sample Output:
              </label>
              <textarea
                value={question.sampleOutput || ""}
                onChange={(e) =>
                  onEditChange(
                    JSON.stringify(
                      { ...question, sampleOutput: e.target.value },
                      null,
                      2,
                    ),
                  )
                }
                style={{
                  width: "100%",
                  minHeight: "60px",
                  padding: "0.75rem",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  fontFamily: "monospace",
                  marginBottom: "1rem",
                }}
              />
            </>
          )}

        {/* Visible Test Cases */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <label style={{ fontWeight: 600, color: "#1e293b" }}>
              Visible Test Cases ({visibleTestCases.length || 0}):
            </label>
            <button
              type="button"
              onClick={() => {
                const newTestCases = [
                  ...(visibleTestCases || []),
                  { input: "", output: "", expected_output: "" },
                ];
                onEditChange(
                  JSON.stringify(
                    { ...question, visibleTestCases: newTestCases },
                    null,
                    2,
                  ),
                );
              }}
              style={{
                padding: "0.25rem 0.75rem",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              + Add Test Case
            </button>
          </div>
          {(visibleTestCases || []).map((testCase: any, idx: number) => (
            <div
              key={idx}
              style={{
                padding: "1rem",
                backgroundColor: "#f8fafc",
                borderRadius: "0.5rem",
                border: "1px solid #e2e8f0",
                marginBottom: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "#64748b",
                  }}
                >
                  Test Case {idx + 1}:
                </div>
                {(visibleTestCases || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newTestCases = (visibleTestCases || []).filter(
                        (_: any, i: number) => i !== idx,
                      );
                      onEditChange(
                        JSON.stringify(
                          { ...question, visibleTestCases: newTestCases },
                          null,
                          2,
                        ),
                      );
                    }}
                    style={{
                      padding: "0.25rem 0.5rem",
                      backgroundColor: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#64748b",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Input:
                  </label>
                  <textarea
                    value={testCase.input || ""}
                    onChange={(e) => {
                      const newTestCases = [...(visibleTestCases || [])];
                      newTestCases[idx] = {
                        ...newTestCases[idx],
                        input: e.target.value,
                      };
                      onEditChange(
                        JSON.stringify(
                          { ...question, visibleTestCases: newTestCases },
                          null,
                          2,
                        ),
                      );
                    }}
                    style={{
                      width: "100%",
                      minHeight: "60px",
                      padding: "0.5rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      fontFamily: "monospace",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#64748b",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Expected Output:
                  </label>
                  <textarea
                    value={testCase.output || testCase.expected_output || ""}
                    onChange={(e) => {
                      const newTestCases = [...(visibleTestCases || [])];
                      newTestCases[idx] = {
                        ...newTestCases[idx],
                        output: e.target.value,
                        expected_output: e.target.value,
                      };
                      onEditChange(
                        JSON.stringify(
                          { ...question, visibleTestCases: newTestCases },
                          null,
                          2,
                        ),
                      );
                    }}
                    style={{
                      width: "100%",
                      minHeight: "60px",
                      padding: "0.5rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Hidden Test Cases */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <label style={{ fontWeight: 600, color: "#1e293b" }}>
              Hidden Test Cases ({hiddenTestCases.length || 0}):
            </label>
            <button
              type="button"
              onClick={() => {
                const newTestCases = [
                  ...(hiddenTestCases || []),
                  { input: "", output: "", expected_output: "" },
                ];
                onEditChange(
                  JSON.stringify(
                    { ...question, hiddenTestCases: newTestCases },
                    null,
                    2,
                  ),
                );
              }}
              style={{
                padding: "0.25rem 0.75rem",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                cursor: "pointer",
              }}
            >
              + Add Test Case
            </button>
          </div>
          {(hiddenTestCases || []).map((testCase: any, idx: number) => (
            <div
              key={idx}
              style={{
                padding: "1rem",
                backgroundColor: "#fef3c7",
                borderRadius: "0.5rem",
                border: "1px solid #fbbf24",
                marginBottom: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.5rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "#64748b",
                  }}
                >
                  Hidden Test Case {idx + 1}:
                </div>
                {(hiddenTestCases || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newTestCases = (hiddenTestCases || []).filter(
                        (_: any, i: number) => i !== idx,
                      );
                      onEditChange(
                        JSON.stringify(
                          { ...question, hiddenTestCases: newTestCases },
                          null,
                          2,
                        ),
                      );
                    }}
                    style={{
                      padding: "0.25rem 0.5rem",
                      backgroundColor: "#ef4444",
                      color: "white",
                      border: "none",
                      borderRadius: "0.25rem",
                      fontSize: "0.75rem",
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                )}
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#64748b",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Input:
                  </label>
                  <textarea
                    value={testCase.input || ""}
                    onChange={(e) => {
                      const newTestCases = [...(hiddenTestCases || [])];
                      newTestCases[idx] = {
                        ...newTestCases[idx],
                        input: e.target.value,
                      };
                      onEditChange(
                        JSON.stringify(
                          { ...question, hiddenTestCases: newTestCases },
                          null,
                          2,
                        ),
                      );
                    }}
                    style={{
                      width: "100%",
                      minHeight: "60px",
                      padding: "0.5rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      fontFamily: "monospace",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#64748b",
                      marginBottom: "0.25rem",
                    }}
                  >
                    Expected Output:
                  </label>
                  <textarea
                    value={testCase.output || testCase.expected_output || ""}
                    onChange={(e) => {
                      const newTestCases = [...(hiddenTestCases || [])];
                      newTestCases[idx] = {
                        ...newTestCases[idx],
                        output: e.target.value,
                        expected_output: e.target.value,
                      };
                      onEditChange(
                        JSON.stringify(
                          { ...question, hiddenTestCases: newTestCases },
                          null,
                          2,
                        ),
                      );
                    }}
                    style={{
                      width: "100%",
                      minHeight: "60px",
                      padding: "0.5rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ⭐ CRITICAL FIX: Use questionText which contains title + description + examples
  // Don't display description separately to avoid duplication
  const problemStatementText =
    question.questionText ||
    questionText ||
    question.description ||
    question.problemStatement ||
    question.question ||
    question.title ||
    "";

  const shouldShowProblemStatement = !!(
    problemStatementText && problemStatementText.trim()
  );

  return (
    <div>
      {/* Problem Statement - Display ONCE (contains title + description + examples) */}
      {shouldShowProblemStatement ? (
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#64748b",
              marginBottom: "0.5rem",
            }}
          >
            Problem Statement:
          </div>
          <div
            style={{
              color: "#1e293b",
              whiteSpace: "pre-wrap",
              lineHeight: "1.7",
              padding: "1.25rem",
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              border: "1px solid #e2e8f0",
              fontSize: "1rem",
              minHeight: "50px",
            }}
          >
            {problemStatementText}
          </div>
        </div>
      ) : (
        <div
          style={{
            marginBottom: "1.5rem",
            padding: "1rem",
            backgroundColor: "#fee2e2",
            borderRadius: "0.5rem",
            border: "1px solid #ef4444",
            color: "#991b1b",
          }}
        >
          ⚠️ Problem statement is missing. Please regenerate this question.
        </div>
      )}

      {/* Starter Code (Readonly) */}
      {starterCode && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#64748b",
              marginBottom: "0.5rem",
            }}
          >
            Starter Code (Readonly):
          </div>
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#1e293b",
              color: "#f1f5f9",
              borderRadius: "0.5rem",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              whiteSpace: "pre-wrap",
              border: "2px solid #3b82f6",
              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: "0.5rem",
                right: "0.5rem",
                fontSize: "0.75rem",
                color: "#94a3b8",
                backgroundColor: "#1e293b",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.25rem",
              }}
            >
              Readonly
            </div>
            {starterCode}
          </div>
          <p
            style={{
              fontSize: "0.75rem",
              color: "#64748b",
              marginTop: "0.5rem",
              fontStyle: "italic",
            }}
          >
            This starter code cannot be modified. Only the editable region can
            be changed.
          </p>
        </div>
      )}

      {/* Function Signature */}
      {functionSignature && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#64748b",
              marginBottom: "0.5rem",
            }}
          >
            Function Signature:
          </div>
          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "#1e293b",
              color: "#f1f5f9",
              borderRadius: "0.5rem",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              whiteSpace: "pre-wrap",
            }}
          >
            {typeof functionSignature === "object"
              ? `${functionSignature.name || "function"}(${functionSignature.parameters?.map((p: any) => `${p.name}: ${p.type}`).join(", ") || ""}): ${functionSignature.return_type || ""}`
              : functionSignature}
          </div>
        </div>
      )}

      {/* Constraints */}
      {constraints && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#64748b",
              marginBottom: "0.5rem",
            }}
          >
            Constraints:
          </div>
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#fef3c7",
              borderRadius: "0.5rem",
              border: "1px solid #fbbf24",
            }}
          >
            {typeof constraints === "string" && constraints.includes("\n") ? (
              <ul
                style={{
                  paddingLeft: "1.5rem",
                  color: "#1e293b",
                  lineHeight: "1.8",
                  margin: 0,
                }}
              >
                {constraints
                  .split("\n")
                  .filter((c: string) => c.trim())
                  .map((constraint: string, idx: number) => (
                    <li key={idx} style={{ marginBottom: "0.25rem" }}>
                      {constraint.trim()}
                    </li>
                  ))}
              </ul>
            ) : (
              <div style={{ color: "#1e293b", whiteSpace: "pre-wrap" }}>
                {constraints}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visible Test Cases */}
      {visibleTestCases &&
        Array.isArray(visibleTestCases) &&
        visibleTestCases.length > 0 && (
          <div style={{ marginBottom: "1.5rem" }}>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#64748b",
                marginBottom: "0.75rem",
              }}
            >
              Visible Test Cases ({visibleTestCases.length}):
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {visibleTestCases.map((testCase: any, idx: number) => (
                <div
                  key={idx}
                  style={{
                    padding: "1rem",
                    backgroundColor: "#f8fafc",
                    borderRadius: "0.5rem",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "#64748b",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Test Case {idx + 1}:
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "0.75rem",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "#64748b",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Input:
                      </div>
                      <div
                        style={{
                          padding: "0.75rem",
                          backgroundColor: "#1e293b",
                          color: "#f1f5f9",
                          borderRadius: "0.375rem",
                          fontFamily: "monospace",
                          fontSize: "0.875rem",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                        }}
                      >
                        {testCase.input || ""}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "#64748b",
                          marginBottom: "0.25rem",
                        }}
                      >
                        Expected Output:
                      </div>
                      <div
                        style={{
                          padding: "0.75rem",
                          backgroundColor: "#10b981",
                          color: "#ffffff",
                          borderRadius: "0.375rem",
                          fontFamily: "monospace",
                          fontSize: "0.875rem",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-all",
                        }}
                      >
                        {testCase.output || testCase.expected_output || ""}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p
              style={{
                fontSize: "0.75rem",
                color: "#64748b",
                marginTop: "0.5rem",
                fontStyle: "italic",
              }}
            >
              These test cases are visible to candidates. Hidden test cases (
              {hiddenTestCases.length || 0}) are used for evaluation only.
            </p>
          </div>
        )}

      {/* Legacy support for old format test cases - only show if no visibleTestCases AND legacy fields have actual content */}
      {(!visibleTestCases || visibleTestCases.length === 0) &&
        (question.sampleInput?.trim() || question.sampleOutput?.trim()) && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#64748b",
                  marginBottom: "0.5rem",
                }}
              >
                Sample Input:
              </div>
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "#1e293b",
                  color: "#f1f5f9",
                  borderRadius: "0.5rem",
                  fontFamily: "monospace",
                  fontSize: "0.875rem",
                  whiteSpace: "pre-wrap",
                }}
              >
                {question.sampleInput}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#64748b",
                  marginBottom: "0.5rem",
                }}
              >
                Sample Output:
              </div>
              <div
                style={{
                  padding: "0.75rem",
                  backgroundColor: "#1e293b",
                  color: "#f1f5f9",
                  borderRadius: "0.5rem",
                  fontFamily: "monospace",
                  fontSize: "0.875rem",
                  whiteSpace: "pre-wrap",
                }}
              >
                {question.sampleOutput}
              </div>
            </div>
          </div>
        )}

      {/* Legacy support for old format input/output format */}
      {question.inputFormat && question.outputFormat && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#64748b",
                marginBottom: "0.5rem",
              }}
            >
              Input Format:
            </div>
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#f8fafc",
                borderRadius: "0.5rem",
                border: "1px solid #e2e8f0",
                fontSize: "0.875rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {question.inputFormat}
            </div>
          </div>
          <div>
            <div
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "#64748b",
                marginBottom: "0.5rem",
              }}
            >
              Output Format:
            </div>
            <div
              style={{
                padding: "0.75rem",
                backgroundColor: "#f8fafc",
                borderRadius: "0.5rem",
                border: "1px solid #e2e8f0",
                fontSize: "0.875rem",
                whiteSpace: "pre-wrap",
              }}
            >
              {question.outputFormat}
            </div>
          </div>
        </div>
      )}

      {/* Explanation */}
      {explanation && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "#64748b",
              marginBottom: "0.5rem",
            }}
          >
            Explanation:
          </div>
          <div
            style={{
              color: "#1e293b",
              whiteSpace: "pre-wrap",
              lineHeight: "1.6",
              padding: "0.75rem",
              backgroundColor: "#f0f9ff",
              borderRadius: "0.5rem",
              border: "1px solid #bae6fd",
            }}
          >
            {explanation}
          </div>
        </div>
      )}
    </div>
  );
};

// SQL Question Renderer - pretty UI using schema + sample data when available
const renderSqlQuestion = (
  question: any,
  isEditing: boolean,
  onEditChange?: (value: string) => void,
) => {
  // When editing, fall back to simple subjective-style text editing for now
  if (isEditing && onEditChange) {
    const questionText = question.question || question.questionText || "";
    return (
      <div>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 600,
            color: "#1e293b",
          }}
        >
          Question text (shown to candidates):
        </label>
        <textarea
          value={questionText}
          onChange={(e) =>
            onEditChange(
              JSON.stringify(
                {
                  ...question,
                  question: e.target.value,
                  questionText: e.target.value,
                },
                null,
                2,
              ),
            )
          }
          style={{
            width: "100%",
            minHeight: "160px",
            padding: "0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontFamily: "monospace",
          }}
          placeholder="Edit the SQL question text..."
        />
      </div>
    );
  }

  // Read structured SQL data if present
  const sqlData = question.sql_data || {};
  const title = sqlData.title || "SQL Query Challenge";
  const description =
    sqlData.description ||
    question.question ||
    question.questionText ||
    "SQL question description not available.";
  const schemas = sqlData.schemas || {};
  const sampleData = sqlData.sample_data || {};
  const constraints: string[] = sqlData.constraints || [];
  const starterQuery: string | undefined = sqlData.starter_query;
  const hints: string[] = sqlData.hints || [];
  const sqlCategory: string = sqlData.sql_category || "select";
  const evaluation = sqlData.evaluation || {};

  // ⭐ ENHANCED: Also check for alternative data structures
  const allSchemas = schemas || sqlData.database_schema || sqlData.schema || {};
  const allSampleData = sampleData || sqlData.sample_data || sqlData.data || {};
  const allTables = sqlData.tables || Object.keys(allSchemas);

  const hasSchema = allSchemas && Object.keys(allSchemas).length > 0;
  const hasSampleData = allSampleData && Object.keys(allSampleData).length > 0;
  const hasConstraints = constraints && constraints.length > 0;
  const hasHints = hints && hints.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Title and SQL Category Badge */}
      <div
        style={{
          padding: "1rem 1.25rem",
          backgroundColor: "#f8fafc",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>
          {title}
        </div>
        <div
          style={{
            padding: "0.25rem 0.75rem",
            backgroundColor: "#dbeafe",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#1e40af",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          {sqlCategory}
        </div>
      </div>

      {/* Database Information Summary */}
      {(hasSchema || hasSampleData) && (
        <div
          style={{
            padding: "1rem 1.25rem",
            backgroundColor: "#eff6ff",
            borderRadius: "0.75rem",
            border: "1px solid #bfdbfe",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <span style={{ fontSize: "1.5rem" }}>🗄️</span>
            <div>
              <div
                style={{ fontSize: "1rem", fontWeight: 700, color: "#1e40af" }}
              >
                Database Information
              </div>
              <div
                style={{
                  fontSize: "0.875rem",
                  color: "#3b82f6",
                  marginTop: "0.25rem",
                }}
              >
                {Object.keys(allSchemas).length} table
                {Object.keys(allSchemas).length !== 1 ? "s" : ""} available
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "1.5rem",
              fontSize: "0.875rem",
              color: "#1e40af",
            }}
          >
            {hasSchema && (
              <span>
                <strong>{Object.keys(allSchemas).length}</strong> schema
                {Object.keys(allSchemas).length !== 1 ? "s" : ""}
              </span>
            )}
            {hasSampleData && (
              <span>
                <strong>{Object.keys(allSampleData).length}</strong> table
                {Object.keys(allSampleData).length !== 1 ? "s" : ""} with data
              </span>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      <div
        style={{
          padding: "1.25rem",
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#64748b",
            marginBottom: "0.5rem",
          }}
        >
          Problem Description
        </div>
        <div
          style={{
            fontSize: "1rem",
            color: "#111827",
            lineHeight: "1.7",
            whiteSpace: "pre-wrap",
          }}
        >
          {description}
        </div>
      </div>

      {/* Layout: schema + data side by side on large screens */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            hasSchema && hasSampleData
              ? "minmax(0, 1.1fr) minmax(0, 1.1fr)"
              : "minmax(0, 1fr)",
          gap: "1.25rem",
        }}
      >
        {/* Schema */}
        {hasSchema && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#f8fafc",
              borderRadius: "0.75rem",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              <span
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "999px",
                  backgroundColor: "#e0f2fe",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  color: "#0369a1",
                  fontWeight: 700,
                }}
              >
                DB
              </span>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                Database Schema
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {Object.entries<any>(allSchemas).map(([tableName, tableInfo]) => {
                const columns = (tableInfo && tableInfo.columns) || {};
                return (
                  <div
                    key={tableName}
                    style={{
                      borderRadius: "0.5rem",
                      border: "1px solid #e2e8f0",
                      overflow: "hidden",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        padding: "0.5rem 0.75rem",
                        backgroundColor: "#eff6ff",
                        borderBottom: "1px solid #e5e7eb",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "#1d4ed8",
                        }}
                      >
                        {tableName}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>
                        Schema
                      </span>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "0.75rem",
                        }}
                      >
                        <thead>
                          <tr style={{ backgroundColor: "#f9fafb" }}>
                            <th
                              style={{
                                textAlign: "left",
                                padding: "0.4rem 0.6rem",
                                borderBottom: "1px solid #e5e7eb",
                                color: "#6b7280",
                                fontWeight: 600,
                              }}
                            >
                              Column
                            </th>
                            <th
                              style={{
                                textAlign: "left",
                                padding: "0.4rem 0.6rem",
                                borderBottom: "1px solid #e5e7eb",
                                color: "#6b7280",
                                fontWeight: 600,
                              }}
                            >
                              Type
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries<any>(columns).map(
                            ([colName, colType]) => (
                              <tr key={colName}>
                                <td
                                  style={{
                                    padding: "0.4rem 0.6rem",
                                    borderTop: "1px solid #f3f4f6",
                                    fontFamily: "monospace",
                                    color: "#111827",
                                  }}
                                >
                                  {colName}
                                </td>
                                <td
                                  style={{
                                    padding: "0.4rem 0.6rem",
                                    borderTop: "1px solid #f3f4f6",
                                    color: "#4b5563",
                                  }}
                                >
                                  {String(colType)}
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sample data */}
        {hasSampleData && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#f8fafc",
              borderRadius: "0.75rem",
              border: "1px solid #e2e8f0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              <span
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "999px",
                  backgroundColor: "#fef3c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  color: "#92400e",
                  fontWeight: 700,
                }}
              >
                rows
              </span>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "#0f172a",
                }}
              >
                Sample Data
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
              }}
            >
              {Object.entries<any>(allSampleData).map(([tableName, rows]) => {
                const tableRows: any[] = Array.isArray(rows) ? rows : [];
                if (!tableRows.length) return null;

                const schema = allSchemas[tableName] || {};
                const schemaColumns = (schema && schema.columns) || {};
                let columnNames: string[] = Object.keys(schemaColumns || {});

                if (!columnNames.length) {
                  const firstRow = tableRows[0];
                  if (Array.isArray(firstRow)) {
                    columnNames = firstRow.map((_, idx) => `col_${idx + 1}`);
                  } else if (firstRow && typeof firstRow === "object") {
                    columnNames = Object.keys(firstRow);
                  }
                }

                return (
                  <div
                    key={tableName}
                    style={{
                      borderRadius: "0.5rem",
                      border: "1px solid #e2e8f0",
                      overflow: "hidden",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    <div
                      style={{
                        padding: "0.5rem 0.75rem",
                        backgroundColor: "#f9fafb",
                        borderBottom: "1px solid #e5e7eb",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          color: "#1f2937",
                        }}
                      >
                        {tableName}
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>
                        {tableRows.length} row{tableRows.length > 1 ? "s" : ""}
                      </span>
                    </div>
                    <div
                      style={{
                        overflowX: "auto",
                        maxHeight: "400px",
                        overflowY: "auto",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: "0.75rem",
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              backgroundColor: "#f9fafb",
                              position: "sticky",
                              top: 0,
                              zIndex: 10,
                            }}
                          >
                            {columnNames.map((col) => (
                              <th
                                key={col}
                                style={{
                                  textAlign: "left",
                                  padding: "0.4rem 0.6rem",
                                  borderBottom: "1px solid #e5e7eb",
                                  color: "#6b7280",
                                  fontWeight: 600,
                                  backgroundColor: "#f9fafb",
                                }}
                              >
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tableRows.map((row, idx) => {
                            const cells: any[] = Array.isArray(row)
                              ? row
                              : columnNames.map((col) =>
                                  row && typeof row === "object"
                                    ? row[col]
                                    : "",
                                );
                            return (
                              <tr key={idx}>
                                {cells.map((cell, cellIdx) => (
                                  <td
                                    key={cellIdx}
                                    style={{
                                      padding: "0.4rem 0.6rem",
                                      borderTop: "1px solid #f3f4f6",
                                      fontFamily: "monospace",
                                      color:
                                        cell === null || cell === undefined
                                          ? "#9ca3af"
                                          : "#111827",
                                    }}
                                  >
                                    {cell === null ||
                                    cell === undefined ||
                                    cell === ""
                                      ? "NULL"
                                      : String(cell)}
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Requirements / constraints */}
      {hasConstraints && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#ecfeff",
            borderRadius: "0.75rem",
            border: "1px solid #bae6fd",
          }}
        >
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#075985",
              marginBottom: "0.5rem",
            }}
          >
            Requirements
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              fontSize: "0.875rem",
              color: "#0f172a",
              lineHeight: 1.6,
            }}
          >
            {constraints.map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Starter query (optional) */}
      {starterQuery && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#0f172a",
            borderRadius: "0.75rem",
            color: "#e5e7eb",
            fontFamily: "monospace",
            fontSize: "0.8rem",
            whiteSpace: "pre-wrap",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "#93c5fd",
              marginBottom: "0.5rem",
            }}
          >
            Starter Query
          </div>
          {starterQuery}
        </div>
      )}

      {/* Hints (optional) */}
      {hasHints && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#fef3c7",
            borderRadius: "0.75rem",
            border: "1px solid #fbbf24",
          }}
        >
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#92400e",
              marginBottom: "0.5rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>💡</span>
            <span>Hints</span>
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              fontSize: "0.875rem",
              color: "#78350f",
              lineHeight: 1.6,
            }}
          >
            {hints.map((hint, idx) => (
              <li key={idx}>{hint}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Evaluation Configuration (optional) */}
      {evaluation && Object.keys(evaluation).length > 0 && (
        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "#f3f4f6",
            borderRadius: "0.5rem",
            border: "1px solid #d1d5db",
            display: "flex",
            gap: "1.5rem",
            fontSize: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          {evaluation.engine && (
            <div>
              <span style={{ fontWeight: 600, color: "#6b7280" }}>
                Engine:{" "}
              </span>
              <span style={{ color: "#111827", fontFamily: "monospace" }}>
                {evaluation.engine}
              </span>
            </div>
          )}
          {evaluation.comparison && (
            <div>
              <span style={{ fontWeight: 600, color: "#6b7280" }}>
                Comparison:{" "}
              </span>
              <span style={{ color: "#111827" }}>{evaluation.comparison}</span>
            </div>
          )}
          {evaluation.order_sensitive !== undefined && (
            <div>
              <span style={{ fontWeight: 600, color: "#6b7280" }}>
                Order Sensitive:{" "}
              </span>
              <span style={{ color: "#111827" }}>
                {evaluation.order_sensitive ? "Yes" : "No"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// AIML Question Renderer - pretty UI using dataset when available
const renderAimlQuestion = (
  question: any,
  isEditing: boolean,
  onEditChange?: (value: string) => void,
) => {
  // When editing, fall back to simple subjective-style text editing for now
  if (isEditing && onEditChange) {
    const questionText = question.question || question.questionText || "";
    return (
      <div>
        <label
          style={{
            display: "block",
            marginBottom: "0.5rem",
            fontWeight: 600,
            color: "#1e293b",
          }}
        >
          Question text (shown to candidates):
        </label>
        <textarea
          value={questionText}
          onChange={(e) =>
            onEditChange(
              JSON.stringify(
                {
                  ...question,
                  question: e.target.value,
                  questionText: e.target.value,
                },
                null,
                2,
              ),
            )
          }
          style={{
            width: "100%",
            minHeight: "160px",
            padding: "0.75rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontFamily: "monospace",
          }}
          placeholder="Edit the AIML question text..."
        />
      </div>
    );
  }

  // Read structured AIML data if present
  const aimlData = question.aiml_data || {};
  const description =
    aimlData.description ||
    question.question ||
    question.questionText ||
    "AIML question description not available.";
  const tasks: string[] = aimlData.tasks || [];
  const constraints: string[] = aimlData.constraints || [];
  const libraries: string[] = aimlData.libraries || [];
  // ⭐ ENHANCED: Check multiple possible dataset locations
  const dataset = aimlData.dataset || aimlData.data || null;
  const schema = dataset?.schema || dataset?.columns || aimlData.schema || [];
  const rows: any[] = dataset?.rows || dataset?.data || aimlData.rows || [];
  const executionEnv: string =
    aimlData.execution_environment ||
    aimlData.environment ||
    "jupyter_notebook";
  const requiresDataset: boolean = aimlData.requires_dataset || false;

  // ⭐ ENHANCED: Additional dataset metadata
  const datasetName = dataset?.name || aimlData.dataset_name || "Dataset";
  const datasetDescription =
    dataset?.description || aimlData.dataset_description || null;

  const hasTasks = tasks && tasks.length > 0;
  const hasConstraints = constraints && constraints.length > 0;
  const hasLibraries = libraries && libraries.length > 0;
  const hasDataset = (schema && schema.length > 0) || (rows && rows.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      {/* Execution Environment Badge */}
      <div
        style={{
          padding: "0.5rem 1rem",
          backgroundColor: "#f0fdf4",
          borderRadius: "0.5rem",
          border: "1px solid #86efac",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          alignSelf: "flex-start",
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "#166534",
        }}
      >
        <span>🔬</span>
        <span>
          Environment:{" "}
          {executionEnv === "jupyter_notebook"
            ? "Jupyter Notebook"
            : executionEnv}
        </span>
      </div>

      {/* Description */}
      <div
        style={{
          padding: "1.25rem",
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#64748b",
            marginBottom: "0.5rem",
          }}
        >
          Problem Description
        </div>
        <div
          style={{
            fontSize: "1rem",
            color: "#111827",
            lineHeight: "1.7",
            whiteSpace: "pre-wrap",
          }}
        >
          {description}
        </div>
      </div>

      {/* Tasks */}
      {hasTasks && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#f0fdf4",
            borderRadius: "0.75rem",
            border: "1px solid #bbf7d0",
          }}
        >
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#166534",
              marginBottom: "0.5rem",
            }}
          >
            Tasks
          </div>
          <ol
            style={{
              margin: 0,
              paddingLeft: "1.5rem",
              fontSize: "0.875rem",
              color: "#0f172a",
              lineHeight: 1.8,
            }}
          >
            {tasks.map((task, idx) => (
              <li key={idx} style={{ marginBottom: "0.25rem" }}>
                {task}
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Dataset Information Header */}
      {hasDataset && (
        <div
          style={{
            padding: "1rem 1.25rem",
            backgroundColor: "#f0fdf4",
            borderRadius: "0.75rem",
            border: "1px solid #86efac",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}
          >
            <span style={{ fontSize: "1.5rem" }}>📊</span>
            <div>
              <div
                style={{ fontSize: "1rem", fontWeight: 700, color: "#166534" }}
              >
                {datasetName}
              </div>
              {datasetDescription && (
                <div
                  style={{
                    fontSize: "0.875rem",
                    color: "#15803d",
                    marginTop: "0.25rem",
                  }}
                >
                  {datasetDescription}
                </div>
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: "1.5rem",
              fontSize: "0.875rem",
              color: "#166534",
            }}
          >
            {schema.length > 0 && (
              <span>
                <strong>{schema.length}</strong> column
                {schema.length > 1 ? "s" : ""}
              </span>
            )}
            {rows.length > 0 && (
              <span>
                <strong>{rows.length}</strong> row{rows.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Dataset Schema and Data - side by side layout */}
      {hasDataset && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              schema.length > 0
                ? "minmax(0, 1fr) minmax(0, 2fr)"
                : "minmax(0, 1fr)",
            gap: "1.25rem",
          }}
        >
          {/* Schema */}
          {schema.length > 0 && (
            <div
              style={{
                padding: "1rem",
                backgroundColor: "#f8fafc",
                borderRadius: "0.75rem",
                border: "1px solid #e2e8f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.75rem",
                }}
              >
                <span
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "999px",
                    backgroundColor: "#e0f2fe",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.75rem",
                    color: "#0369a1",
                    fontWeight: 700,
                  }}
                >
                  📊
                </span>
                <div
                  style={{
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    color: "#0f172a",
                  }}
                >
                  Dataset Schema
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.75rem",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#f9fafb" }}>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.4rem 0.6rem",
                          borderBottom: "1px solid #e5e7eb",
                          color: "#6b7280",
                          fontWeight: 600,
                        }}
                      >
                        Column
                      </th>
                      <th
                        style={{
                          textAlign: "left",
                          padding: "0.4rem 0.6rem",
                          borderBottom: "1px solid #e5e7eb",
                          color: "#6b7280",
                          fontWeight: 600,
                        }}
                      >
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {schema.map((col: any, idx: number) => (
                      <tr key={idx}>
                        <td
                          style={{
                            padding: "0.4rem 0.6rem",
                            borderTop: "1px solid #f3f4f6",
                            fontFamily: "monospace",
                            color: "#111827",
                          }}
                        >
                          {col.name || `col_${idx + 1}`}
                        </td>
                        <td
                          style={{
                            padding: "0.4rem 0.6rem",
                            borderTop: "1px solid #f3f4f6",
                            color: "#4b5563",
                          }}
                        >
                          {col.type || "string"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sample Data - Show ALL rows */}
          {rows.length > 0 && (
            <div
              style={{
                padding: "1rem",
                backgroundColor: "#f8fafc",
                borderRadius: "0.75rem",
                border: "1px solid #e2e8f0",
                maxHeight: "600px",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.75rem",
                  flexWrap: "wrap",
                  gap: "0.5rem",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <span
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "999px",
                      backgroundColor: "#fef3c7",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.75rem",
                      color: "#92400e",
                      fontWeight: 700,
                    }}
                  >
                    📋
                  </span>
                  <div
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: "#0f172a",
                    }}
                  >
                    Complete Dataset
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "1rem",
                    fontSize: "0.75rem",
                    color: "#6b7280",
                  }}
                >
                  <span>
                    <strong>{rows.length}</strong> rows
                  </span>
                  <span>
                    <strong>{schema.length}</strong> columns
                  </span>
                </div>
              </div>
              <div
                style={{
                  borderRadius: "0.5rem",
                  border: "1px solid #e2e8f0",
                  overflow: "hidden",
                  backgroundColor: "#ffffff",
                }}
              >
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: "0.75rem",
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          backgroundColor: "#f9fafb",
                          position: "sticky",
                          top: 0,
                          zIndex: 10,
                        }}
                      >
                        <th
                          style={{
                            textAlign: "center",
                            padding: "0.5rem 0.75rem",
                            borderBottom: "2px solid #e5e7eb",
                            color: "#6b7280",
                            fontWeight: 600,
                            backgroundColor: "#f9fafb",
                            width: "50px",
                          }}
                        >
                          #
                        </th>
                        {schema.map((col: any, idx: number) => (
                          <th
                            key={idx}
                            style={{
                              textAlign: "left",
                              padding: "0.5rem 0.75rem",
                              borderBottom: "2px solid #e5e7eb",
                              color: "#6b7280",
                              fontWeight: 600,
                              backgroundColor: "#f9fafb",
                            }}
                          >
                            {col.name || `Column ${idx + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, rowIdx) => {
                        const cells: any[] = Array.isArray(row)
                          ? row
                          : schema.map((col: any) =>
                              row && typeof row === "object"
                                ? row[col.name]
                                : "",
                            );
                        return (
                          <tr
                            key={rowIdx}
                            style={{
                              backgroundColor:
                                rowIdx % 2 === 0 ? "#ffffff" : "#f9fafb",
                            }}
                          >
                            <td
                              style={{
                                padding: "0.5rem 0.75rem",
                                borderTop: "1px solid #f3f4f6",
                                textAlign: "center",
                                color: "#9ca3af",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                              }}
                            >
                              {rowIdx + 1}
                            </td>
                            {cells.map((cell, cellIdx) => (
                              <td
                                key={cellIdx}
                                style={{
                                  padding: "0.5rem 0.75rem",
                                  borderTop: "1px solid #f3f4f6",
                                  fontFamily: "monospace",
                                  color:
                                    cell === null ||
                                    cell === undefined ||
                                    cell === ""
                                      ? "#9ca3af"
                                      : "#111827",
                                  fontSize: "0.8rem",
                                }}
                              >
                                {cell === null ||
                                cell === undefined ||
                                cell === "" ? (
                                  <span
                                    style={{
                                      fontStyle: "italic",
                                      color: "#9ca3af",
                                    }}
                                  >
                                    NULL
                                  </span>
                                ) : (
                                  String(cell)
                                )}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Constraints */}
      {hasConstraints && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#ecfeff",
            borderRadius: "0.75rem",
            border: "1px solid #bae6fd",
          }}
        >
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#075985",
              marginBottom: "0.5rem",
            }}
          >
            Constraints
          </div>
          <ul
            style={{
              margin: 0,
              paddingLeft: "1.25rem",
              fontSize: "0.875rem",
              color: "#0f172a",
              lineHeight: 1.6,
            }}
          >
            {constraints.map((c, idx) => (
              <li key={idx}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Required Libraries */}
      {hasLibraries && (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#fef3c7",
            borderRadius: "0.75rem",
            border: "1px solid #fbbf24",
          }}
        >
          <div
            style={{
              fontSize: "0.9rem",
              fontWeight: 600,
              color: "#92400e",
              marginBottom: "0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>📚</span>
            <span>Required Libraries</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {libraries.map((lib, idx) => (
              <span
                key={idx}
                style={{
                  padding: "0.375rem 0.75rem",
                  backgroundColor: "#ffffff",
                  borderRadius: "0.375rem",
                  border: "1px solid #fbbf24",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#92400e",
                  fontFamily: "monospace",
                }}
              >
                {lib}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const renderQuestionByType = (
  question: any,
  questionType: string,
  isEditing: boolean,
  onEditChange?: (value: string) => void,
) => {
  switch (questionType) {
    case "MCQ":
      return renderMCQQuestion(question, isEditing, onEditChange);
    case "Subjective":
      return renderSubjectiveQuestion(question, isEditing, onEditChange);
    case "PseudoCode":
      return renderPseudoCodeQuestion(question, isEditing, onEditChange);
    case "Coding":
      return renderCodingQuestion(question, isEditing, onEditChange);
    case "SQL":
      return renderSqlQuestion(question, isEditing, onEditChange);
    case "AIML":
      return renderAimlQuestion(question, isEditing, onEditChange);
    default:
      return (
        <div
          style={{
            padding: "1rem",
            backgroundColor: "#fef3c7",
            borderRadius: "0.5rem",
            color: "#92400e",
          }}
        >
          Unknown question type: {questionType}
        </div>
      );
  }
};

const QUESTION_TYPES = [
  "MCQ",
  "Subjective",
  "Pseudo Code",
  "Descriptive",
  "coding",
];
const DIFFICULTY_LEVELS = ["Easy", "Medium", "Hard"];

// Helper function to get student level from slider value
function getStudentLevel(value: number): string {
  if (value < 1.5) return "Beginner";
  if (value < 3) return "Intermediate";
  return "Advanced";
}

// Helper function to truncate text to ~80 words
function truncateText(
  text: string,
  maxWords: number = 80,
): { truncated: string; isTruncated: boolean } {
  if (!text) return { truncated: "", isTruncated: false };
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return { truncated: text, isTruncated: false };
  }
  const truncated = words.slice(0, maxWords).join(" ") + "...";
  return { truncated, isTruncated: true };
}

// Helper function to extract question text for display
function getQuestionText(question: any, questionType: string): string {
  switch (questionType) {
    case "MCQ":
      return question.question || question.questionText || "";
    case "Subjective":
      return question.question || question.questionText || "";
    case "PseudoCode":
      return question.question || question.questionText || "";
    case "Coding":
      return question.problemStatement || question.title || "";
    case "SQL":
      return question.question || question.questionText || "";
    case "AIML":
      return question.question || question.questionText || "";
    default:
      return JSON.stringify(question);
  }
}

// Helper function to calculate base time per question type (in seconds)
function getBaseTimePerQuestion(questionType: string): number {
  // Base time in seconds per question type
  // Recommended base timing:
  // MCQ → Maximum 40 seconds per question (base 20s, max 40s with Hard difficulty)
  // Pseudocode → 5–8 minutes per question (use 6.5 min = 390 seconds)
  // Subjective → 6–10 minutes per question (use 8 min = 480 seconds)
  // Coding → 12–20 minutes per question (use 16 min = 960 seconds)
  switch (questionType) {
    case "MCQ":
      return 20; // Base 20 seconds (Easy: 20s, Medium: 30s, Hard: 40s - max 40 seconds)
    case "Subjective":
      return 480; // 8 minutes (6-10 min range)
    case "PseudoCode":
      return 390; // 6.5 minutes (5-8 min range)
    case "Coding":
      return 960; // 16 minutes (12-20 min range)
    case "SQL":
      return 600; // 10 minutes baseline
    case "AIML":
      return 720; // 12 minutes baseline
    default:
      return 120; // 2 minutes default
  }
}

// Helper function to get difficulty multiplier
function getDifficultyMultiplier(difficulty: string): number {
  switch (difficulty) {
    case "Easy":
      return 1.0;
    case "Medium":
      return 1.5;
    case "Hard":
      return 2.0;
    default:
      return 1.0;
  }
}

// Helper function to get default score suggestion based on question type and difficulty
function getDefaultScore(questionType: string, difficulty: string): number {
  // Base scores per type
  const baseScores: {
    [key: string]: { Easy: number; Medium: number; Hard: number };
  } = {
    MCQ: { Easy: 1, Medium: 2, Hard: 3 },
    Subjective: { Easy: 4, Medium: 6, Hard: 8 },
    PseudoCode: { Easy: 6, Medium: 8, Hard: 10 },
    Coding: { Easy: 10, Medium: 15, Hard: 20 },
    // SQL/AIML are execution-oriented environments, typically heavier than Subjective
    SQL: { Easy: 8, Medium: 10, Hard: 12 },
    AIML: { Easy: 10, Medium: 12, Hard: 15 },
  };

  const typeScores = baseScores[questionType] || {
    Easy: 1,
    Medium: 2,
    Hard: 3,
  };
  return (
    typeScores[difficulty as "Easy" | "Medium" | "Hard"] || typeScores.Easy
  );
}

// Helper function to calculate section timer (in seconds, convert to minutes for display)
function calculateSectionTimer(
  questions: Array<{ questionType: string; difficulty: string }>,
): number {
  let totalSeconds = 0;
  questions.forEach((q) => {
    const baseTime = getBaseTimePerQuestion(q.questionType);
    const multiplier = getDifficultyMultiplier(q.difficulty);
    let questionTime = baseTime * multiplier;

    // Cap MCQ questions at 40 seconds maximum
    if (q.questionType === "MCQ" && questionTime > 40) {
      questionTime = 40;
    }

    totalSeconds += questionTime;
  });
  // Convert to minutes and round up
  return Math.ceil(totalSeconds / 60);
}

// Helper function to format time in minutes to readable format
function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hour${hours !== 1 ? "s" : ""}`;
  }
  return `${hours} hour${hours !== 1 ? "s" : ""} ${mins} minute${mins !== 1 ? "s" : ""}`;
}

// Helper function to detect if a topic is SQL-related (for showing SQL option in dropdown)
function isTopicSqlRelated(topicLabel: string): boolean {
  const label = topicLabel.toLowerCase();

  // SQL execution keywords (indicates query/procedure writing)
  const sqlExecutionKeywords = [
    "write sql",
    "write query",
    "sql query",
    "implement query",
    "optimize query",
    "query optimization",
    "recursive query",
    "stored procedure",
    "sql procedure",
    "create procedure",
    "sql to",
    "query to",
    "using sql",
    "sql with",
  ];

  // SQL indicator keywords (database/SQL concepts)
  const sqlIndicators = [
    "sql",
    "mysql",
    "postgresql",
    "sqlite",
    "database query",
    "sql query",
    "sql queries",
    "query",
    "joins",
    "subquery",
    "stored procedure",
    "trigger",
    "sql injection",
    "sql optimization",
  ];

  // Theory/comparison keywords (NOT execution - don't show SQL option for these)
  const sqlTheoryKeywords = [
    " vs ",
    " versus ",
    "compare",
    "comparison",
    "difference",
    "advantages",
    "disadvantages",
    "explained",
    "explanation",
    "concepts",
    "principles",
    "overview",
    "strategies",
    "design",
    "vulnerabilities",
    "security",
    "prevention",
  ];

  // If has theory keywords, it's NOT SQL execution (use Subjective instead)
  if (sqlTheoryKeywords.some((kw) => label.includes(kw))) {
    return false;
  }

  // Check for execution keywords or SQL indicators
  return (
    sqlExecutionKeywords.some((kw) => label.includes(kw)) ||
    sqlIndicators.some((ind) => {
      // Use word boundaries to avoid false positives (e.g., "overview" contains "view")
      const regex = new RegExp(
        `\\b${ind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i",
      );
      return regex.test(label);
    })
  );
}

// Helper function to detect if a topic is AIML-related (for showing AIML option in dropdown)
function isTopicAimlRelated(topicLabel: string): boolean {
  const label = topicLabel.toLowerCase();

  // AIML execution keywords (indicates ML code writing)
  const aimlExecutionKeywords = [
    "implement",
    "implementation",
    "build model",
    "train model",
    "using pandas",
    "using numpy",
    "using sklearn",
    "using tensorflow",
    "using pytorch",
    "ml implementation",
    "ml task",
    "data preprocessing code",
    "model training",
    "notebook",
    "jupyter",
    "colab",
  ];

  // AIML indicator keywords
  const aimlIndicators = [
    "machine learning",
    "deep learning",
    "neural network",
    "ml model",
    "pandas",
    "numpy",
    "sklearn",
    "tensorflow",
    "pytorch",
    "keras",
    "data preprocessing",
    "feature engineering",
    "model training",
    "random forest",
    "decision tree",
    "regression",
    "classification",
    "clustering",
    "supervised learning",
    "unsupervised learning",
  ];

  // Theory/comparison keywords (NOT execution - don't show AIML option for these)
  const aimlTheoryKeywords = [
    " vs ",
    " versus ",
    "compare",
    "comparison",
    "difference",
    "advantages",
    "disadvantages",
    "explained",
    "explanation",
    "concepts",
    "principles",
    "theory",
    "overview",
    "architecture",
    "design",
    "workflow",
  ];

  // If has theory keywords, it's NOT AIML execution (use Subjective instead)
  if (aimlTheoryKeywords.some((kw) => label.includes(kw))) {
    return false;
  }

  // Check for execution keywords or AIML indicators
  return (
    aimlExecutionKeywords.some((kw) => label.includes(kw)) ||
    aimlIndicators.some((ind) => {
      const regex = new RegExp(
        `\\b${ind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
        "i",
      );
      return regex.test(label);
    })
  );
}

// Helper function to detect if a topic is web-related (for excluding Coding option)
function isTopicWebRelated(topicLabel: string): boolean {
  const label = topicLabel.toLowerCase();

  // Web technology keywords (platform doesn't support browser/web execution)
  const webKeywords = [
    // Frontend frameworks
    "react",
    "angular",
    "vue",
    "svelte",
    "nextjs",
    "next.js",
    "nuxt",
    "gatsby",
    "ember",
    // Web technologies
    "html",
    "css",
    "scss",
    "sass",
    "less",
    "tailwind",
    "bootstrap",
    "material ui",
    "chakra ui",
    "ant design",
    // Browser/DOM
    "dom",
    "browser",
    "document",
    "window",
    "event listener",
    "fetch api",
    "localstorage",
    "sessionstorage",
    "cookie",
    "webstorage",
    // Web frameworks (backend)
    "express",
    "koa",
    "fastify",
    "nest",
    "nestjs",
    "meteor",
    // Frontend build tools
    "webpack",
    "vite",
    "rollup",
    "parcel",
    "babel",
    // UI libraries
    "jquery",
    "d3",
    "chart.js",
    "three.js",
    "gsap",
    "anime.js",
    // Web concepts
    "frontend",
    "web development",
    "responsive design",
    "web page",
    "website",
    "web app",
    "web application",
    "spa",
    "single page",
    "ssr",
    "server side rendering",
    "csr",
    "client side rendering",
    "node server",
    "express server",
    "api endpoint",
    "http server",
    "rest api in node",
  ];

  // Check if any web keyword appears in the topic label (using word boundaries to avoid false positives)
  return webKeywords.some((keyword) => {
    const regex = new RegExp(
      `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    return regex.test(label);
  });
}

// Helper function to detect if a topic supports Judge0-compatible Coding (DSA/algorithmic in supported languages)
function isTopicCodingSupported(topicLabel: string): boolean {
  const label = topicLabel.toLowerCase();

  // Judge0 supported languages (must mention one of these)
  const supportedLanguages = [
    "javascript",
    "typescript",
    "java",
    "python",
    "c++",
    "cpp",
    "c#",
    "csharp",
    "c",
    "go",
    "golang",
    "rust",
    "kotlin",
  ];

  // DSA/algorithmic keywords
  const dsaKeywords = [
    "algorithm",
    "algorithms",
    "data structure",
    "data structures",
    "dsa",
    "problem solving",
    "sorting",
    "searching",
    "binary search",
    "merge sort",
    "quick sort",
    "quicksort",
    "two sum",
    "array",
    "arrays",
    "string",
    "strings",
    "hash",
    "hash table",
    "hashtable",
    "stack",
    "queue",
    "linked list",
    "tree",
    "binary tree",
    "bst",
    "heap",
    "trie",
    "graph",
    "bfs",
    "dfs",
    "dijkstra",
    "dynamic programming",
    "dp",
    "recursion",
  ];

  // Must mention at least one supported language AND one DSA keyword
  const hasSupportedLanguage = supportedLanguages.some((lang) => {
    const regex = new RegExp(
      `\\b${lang.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    return regex.test(label);
  });

  const hasDsaKeyword = dsaKeywords.some((keyword) => {
    const regex = new RegExp(
      `\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "i",
    );
    return regex.test(label);
  });

  return hasSupportedLanguage && hasDsaKeyword;
}

interface QuestionTypeConfig {
  questionType: string;
  difficulty: string;
  numQuestions: number;
  language?: string; // Selected language ID
  judge0_enabled?: boolean; // Whether Judge0 is enabled
}

interface Topic {
  topic: string;
  questionTypeConfigs: QuestionTypeConfig[]; // Multiple question types per topic
  // For aptitude topics
  isAptitude?: boolean;
  subTopic?: string; // Selected sub-topic (e.g., "Number Systems")
  aptitudeStructure?: {
    subTopics: {
      [key: string]: string[]; // Sub-topic name -> question types
    };
  };
  availableSubTopics?: string[]; // List of available sub-topics for this main topic
  coding_supported?: boolean; // Whether this topic supports coding questions
}

export default function CreateNewAssessmentPage() {
  const router = useRouter();
  const { id } = router.query; // Get assessment ID from URL query params if editing
  const isEditMode = !!(id && typeof id === "string"); // True if we have an ID (editing draft)

  // Initialize React Query hooks
  const assessmentIdFromQuery = typeof id === "string" ? id : undefined;
  const { data: assessmentData, refetch: refetchAssessment } = useAssessment(
    assessmentIdFromQuery,
  );
  const { data: questionsData, refetch: refetchQuestions } =
    useAssessmentQuestions(assessmentIdFromQuery);

  // Mutations
  const updateDraftMutation = useUpdateDraft();
  const generateTopicCardsMutation = useGenerateTopicCards();
  const fetchAndSummarizeUrlMutation = useFetchAndSummarizeUrl();
  const generateTopicsV2Mutation = useGenerateTopicsV2();
  const generateTopicsFromRequirementsMutation =
    useGenerateTopicsFromRequirements();
  const generateTopicsMutation = useGenerateTopics();
  const createFromJobDesignationMutation = useCreateFromJobDesignation();
  const improveTopicMutation = useImproveTopic();
  const generateQuestionMutation = useGenerateQuestion();
  const improveAllTopicsMutation = useImproveAllTopics();
  const generateTopicContextMutation = useGenerateTopicContext();
  const validateTopicCategoryMutation = useValidateTopicCategory();
  const checkTechnicalTopicMutation = useCheckTechnicalTopic();
  const suggestTopicsMutation = useSuggestTopics();
  const addCustomTopicMutation = useAddCustomTopic();
  const classifyTechnicalTopicMutation = useClassifyTechnicalTopic();
  const detectTopicCategoryMutation = useDetectTopicCategory();
  const suggestTopicContextsMutation = useSuggestTopicContexts();
  const addQuestionRowMutation = useAddQuestionRow();
  const regenerateQuestionMutation = useRegenerateQuestion();
  const regenerateTopicMutation = useRegenerateTopic();
  const removeTopicMutation = useRemoveTopic();
  const finalizeAssessmentMutation = useFinalizeAssessment();
  const updateQuestionsMutation = useUpdateQuestions();
  const updateScheduleAndCandidatesMutation = useUpdateScheduleAndCandidates();
  const updateSingleQuestionMutation = useUpdateSingleQuestion();
  const generateQuestionsFromConfigMutation = useGenerateQuestionsFromConfig();
  const aiTopicSuggestionMutation = useAITopicSuggestion();
  const removeQuestionRowMutation = useRemoveQuestionRow();
  const updateQuestionTypeMutation = useUpdateQuestionType();
  const deleteTopicQuestionsMutation = useDeleteTopicQuestions();
  const sendInvitationsMutation = useSendInvitations();

  // Smart question type filtering based on topic content
  const getRelevantQuestionTypes = (topicLabel: string): string[] => {
    const label = topicLabel.toLowerCase();
    const allowedTypes: string[] = [];

    // Always include universal types
    allowedTypes.push("MCQ", "Subjective");

    // SQL/Database topics
    if (
      label.includes("sql") ||
      label.includes("database") ||
      label.includes("query") ||
      label.includes("mysql") ||
      label.includes("postgresql") ||
      label.includes("oracle") ||
      label.includes("mongodb") ||
      label.includes("nosql")
    ) {
      allowedTypes.push("SQL");
    }

    // AI/ML topics
    if (
      label.includes("machine learning") ||
      label.includes("ml") ||
      label.includes("ai") ||
      label.includes("artificial intelligence") ||
      label.includes("neural") ||
      label.includes("deep learning") ||
      label.includes("nlp") ||
      label.includes("computer vision") ||
      label.includes("tensorflow") ||
      label.includes("pytorch")
    ) {
      allowedTypes.push("AIML", "PseudoCode", "Coding");
    }

    // Programming/Coding topics
    if (
      label.includes("java") ||
      label.includes("python") ||
      label.includes("javascript") ||
      label.includes("c++") ||
      label.includes("programming") ||
      label.includes("coding") ||
      label.includes("oop") ||
      label.includes("data structure") ||
      label.includes("algorithm") ||
      label.includes("array") ||
      label.includes("linked list") ||
      label.includes("tree") ||
      label.includes("graph") ||
      label.includes("sorting") ||
      label.includes("searching")
    ) {
      allowedTypes.push("PseudoCode", "Coding");
    }

    // Remove duplicates and return
    return Array.from(new Set(allowedTypes));
  };

  const [currentStation, setCurrentStation] = useState(1);
  const [jobDesignation, setJobDesignation] = useState("");
  const [topicCards, setTopicCards] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [manualSkillInput, setManualSkillInput] = useState("");
  const [loadingCards, setLoadingCards] = useState(false);
  const [topics, setTopics] = useState<string[]>([]);
  const [experienceMin, setExperienceMin] = useState(0);
  const [experienceMax, setExperienceMax] = useState(10);
  const [experienceMode, setExperienceMode] = useState<"corporate" | "student">(
    "corporate",
  );
  const [availableQuestionTypes, setAvailableQuestionTypes] =
    useState<string[]>(QUESTION_TYPES);
  const [topicConfigs, setTopicConfigs] = useState<Topic[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(false); // Loading existing draft data
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalTitle, setFinalTitle] = useState("");
  const [finalDescription, setFinalDescription] = useState("");
  const [passPercentage, setPassPercentage] = useState<number>(60); // Default 60%
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [candidates, setCandidates] = useState<
    Array<{
      email: string;
      name: string;
      invited?: boolean;
      inviteSentAt?: string;
      status?: string;
    }>
  >([]);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [assessmentUrl, setAssessmentUrl] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<"public" | "private">("private");
  const [emailValidationError, setEmailValidationError] = useState<
    string | null
  >(null);
  const [invitationTemplate, setInvitationTemplate] = useState({
    logoUrl: "",
    companyName: "",
    message:
      "You have been invited to take an assessment. Please click the link below to start.",
    footer: "",
    sentBy: "AI Assessment Platform",
  });
  const [showEmailTemplate, setShowEmailTemplate] = useState(false);
  const [hasVisitedConfigureStation, setHasVisitedConfigureStation] =
    useState(false);
  const [hasVisitedReviewStation, setHasVisitedReviewStation] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false); // Track if assessment is finalized
  // Edit mode is always enabled - removed isConfigureEditMode state

  // Requirements free text field
  const [requirementsText, setRequirementsText] = useState<string>("");
  const [requirementsUrl, setRequirementsUrl] = useState<string | null>(null);
  const [requirementsSummary, setRequirementsSummary] = useState<string | null>(
    null,
  );
  const [processingUrl, setProcessingUrl] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  // Refs to prevent infinite loops and multiple calls
  const isProcessingUrlRef = useRef(false);
  const lastProcessedUrlRef = useRef<string | null>(null);
  const urlTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const categorySaveDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const topicsV2Ref = useRef<any[]>([]);
  const difficultySaveDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // CSV Upload state (kept for backward compatibility but not used in UI)
  const [activeMethod, setActiveMethod] = useState<"role" | "manual" | "csv">(
    "role",
  );
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<
    Array<{
      skill_name: string;
      skill_description: string;
      importance_level: string;
    }>
  >([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvExperienceMode, setCsvExperienceMode] = useState<
    "corporate" | "student"
  >("corporate");
  const [csvExperienceMin, setCsvExperienceMin] = useState(0);
  const [csvExperienceMax, setCsvExperienceMax] = useState(10);
  const [generatingFromCsv, setGeneratingFromCsv] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<
    number | null
  >(null);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [regeneratingQuestionIndex, setRegeneratingQuestionIndex] = useState<
    number | null
  >(null);
  const [customTopicInput, setCustomTopicInput] = useState("");
  const [regeneratingTopicIndex, setRegeneratingTopicIndex] = useState<
    number | null
  >(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false); // Prevent auto-save from overwriting during initial load

  // ============================================
  // NEW MULTI-ROW TOPIC V2 STATE (STRICT MODEL)
  // ============================================
  interface QuestionRow {
    rowId: string;
    questionType:
      | "MCQ"
      | "Subjective"
      | "PseudoCode"
      | "Coding"
      | "SQL"
      | "AIML";
    difficulty: "Easy" | "Medium" | "Hard";
    questionsCount: number;
    canUseJudge0: boolean;
    status: "pending" | "generated" | "completed";
    locked: boolean;
    questions: any[];
    additionalRequirements?: string; // Optional additional requirements for question generation
  }

  interface TopicV2 {
    source?: "role" | "manual" | "csv" | "ai"; // Source of the topic
    regenerated?: boolean; // Whether topic has been improved
    previousVersion?: string[]; // History of previous topic labels
    allowedQuestionTypes?: string[]; // Optional: For soft skills (aptitude, communication, logical_reasoning)
    id: string;
    label: string;
    locked: boolean;
    questionRows: QuestionRow[];
    category?: "aptitude" | "communication" | "logical_reasoning" | "technical";
    contextSummary?: string;
    suggestedQuestionType?: "MCQ" | "Subjective";
    coding_supported?: boolean; // Whether this topic supports coding questions
    status?: "pending" | "generated" | "completed" | "regenerated"; // Topic generation status
  }

  const [topicsV2, setTopicsV2] = useState<TopicV2[]>([]);
  const [fullTopicRegenLocked, setFullTopicRegenLocked] = useState(false);
  const [allQuestionsGenerated, setAllQuestionsGenerated] = useState(false);
  const [generatingRowId, setGeneratingRowId] = useState<string | null>(null);
  const [generatingAllQuestions, setGeneratingAllQuestions] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    currentTopic: "",
    currentQuestionType: "",
    estimatedTimeRemaining: 0,
  });
  const [showGenerationSkeleton, setShowGenerationSkeleton] = useState(false);
  const [customTopicInputV2, setCustomTopicInputV2] = useState("");

  // Topic suggestion states
  const [topicSuggestions, setTopicSuggestions] = useState<
    Array<{ label: string; value: string }>
  >([]);
  const [showingSuggestionsFor, setShowingSuggestionsFor] = useState<
    string | null
  >(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [topicInputValues, setTopicInputValues] = useState<{
    [topicId: string]: string;
  }>({});

  // AI-powered topic suggestions for custom topic input
  const [aiTopicSuggestions, setAiTopicSuggestions] = useState<string[]>([]);
  const [suggestionsFetched, setSuggestionsFetched] = useState(false); // Track if suggestions have been fetched
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [suggestionDebounceTimer, setSuggestionDebounceTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Topic validation states
  const [validatingTopic, setValidatingTopic] = useState(false);
  const [topicValidationError, setTopicValidationError] = useState<
    string | null
  >(null);
  const [topicValidationTimer, setTopicValidationTimer] =
    useState<NodeJS.Timeout | null>(null);
  const [isTopicValid, setIsTopicValid] = useState<boolean | null>(null);
  const [addingTopic, setAddingTopic] = useState(false); // Loading state for adding topic

  // Scoring system - per question type (all questions of same type have same score)
  const [scoringRules, setScoringRules] = useState<{
    MCQ: number;
    Subjective: number;
    PseudoCode: number;
    Coding: number;
    SQL: number;
    AIML: number;
  }>({
    MCQ: 1,
    Subjective: 4,
    PseudoCode: 6,
    Coding: 10,
    SQL: 8,
    AIML: 10,
  });
  // Per-section timer settings
  const [enablePerSectionTimers, setEnablePerSectionTimers] =
    useState<boolean>(false);
  const [sectionTimers, setSectionTimers] = useState<{
    MCQ: number;
    Subjective: number;
    PseudoCode: number;
    Coding: number;
    SQL: number;
    AIML: number;
  }>({
    MCQ: 0,
    Subjective: 0,
    PseudoCode: 0,
    Coding: 0,
    SQL: 0,
    AIML: 0,
  });
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(
    null,
  );
  const [editingReviewQuestion, setEditingReviewQuestion] = useState<
    any | null
  >(null);
  // Regenerate question modal state
  const [regeneratingQuestionId, setRegeneratingQuestionId] = useState<
    string | null
  >(null);
  const [regenerateQuestionFeedback, setRegenerateQuestionFeedback] =
    useState<string>("");
  // Expanded question rows state for Station 4.5
  const [expandedQuestionRows, setExpandedQuestionRows] = useState<Record<string, boolean>>({});
  // Schedule settings (Station 4)
 const [examMode, setExamMode] = useState<"strict" | "flexible">("strict");
  const [duration, setDuration] = useState<string>("");
  const [visibilityMode, setVisibilityMode] = useState<string>("public");
  const [candidateRequirements, setCandidateRequirements] = useState<{
    requireEmail: boolean;
    requireName: boolean;
    requirePhone: boolean;
    requireResume: boolean;
  }>({
    requireEmail: true,
    requireName: true,
    requirePhone: false,
    requireResume: false,
  });

  // Simple AI proctoring toggle (controls camera-based proctoring on candidate side)
  const [proctoringSettings, setProctoringSettings] = useState({
    aiProctoringEnabled: false, // default OFF until explicitly enabled
    faceMismatchEnabled: false, // default OFF until explicitly enabled
    liveProctoringEnabled: false, // default OFF until explicitly enabled
  });

  // For Custom Topic Modal (Step - 4)
  const [showCustomTopicModal, setShowCustomTopicModal] = useState(false);
  const [toastMessageCustom, setToastMessageCustom] = useState<string | null>(
    null,
  );
  const [isCrafting, setIsCrafting] = useState(false);
  const [craftingProgress, setCraftingProgress] = useState(0);
  const [showFinalReview, setShowFinalReview] = useState(false);

  const [activeCandidateTab, setActiveCandidateTab] = useState<
    "individual" | "bulk"
  >("individual");

const [isUrlCopied, setIsUrlCopied] = useState(false);

const handleCopyUrl = () => {
    if (assessmentUrl) {
        navigator.clipboard.writeText(assessmentUrl);
        setIsUrlCopied(true);
        // Reset back to original state after 1 seconds
        setTimeout(() => setIsUrlCopied(false), 1000);
    }
};

const handleStartCrafting = async () => {
  console.log("🎬 handleStartCrafting CALLED");
  console.log("  - assessmentId:", assessmentId);
  console.log("  - examMode:", examMode);
  console.log("  - startTime:", startTime);
  console.log("  - endTime:", endTime);
  console.log("  - duration:", duration);
  console.log("  - candidates count:", candidates.length);
  
  if (!assessmentId) {
    console.error("❌ Assessment ID is missing. URL cannot be generated.");
    return;
  }

  // Validate required fields before proceeding
  if (!startTime) {
    setError("Please enter a start time for the assessment");
    return;
  }
  
  if (!duration || parseInt(duration) <= 0) {
    setError("Please enter a valid duration");
    return;
  }
  
  if (examMode === "flexible" && !endTime) {
    setError("Please enter an end time for flexible mode");
    return;
  }

  // Generate dynamic URL
  const token = Math.random().toString(36).substring(2, 15);
  const url = `${window.location.origin}/assessment/${assessmentId}/${token}`;
  setAssessmentUrl(url);
  console.log("🔗 Generated assessment URL:", url);

  // Save schedule and candidates to backend BEFORE showing animation
  try {
    console.log("💾 Saving schedule and candidates to backend...");
    
    // Normalize datetime strings
    const normalizeDateTime = (dt: string): string => {
      if (!dt) return dt;
      if (dt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
        const dtWithSeconds = dt + ":00";
        const istDate = new Date(dtWithSeconds + "+05:30");
        if (!isNaN(istDate.getTime())) {
          return istDate.toISOString();
        } else {
          return dt + ":00Z";
        }
      }
      if (dt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
        return dt + "Z";
      }
      return dt;
    };

    const scheduleData: any = {
      examMode,
      duration: parseInt(duration || "0"),
    };

    if (examMode === "strict") {
      scheduleData.startTime = normalizeDateTime(startTime);
    } else if (examMode === "flexible") {
      scheduleData.startTime = normalizeDateTime(startTime);
      scheduleData.endTime = normalizeDateTime(endTime);
    }

    console.log("📦 Schedule data to save:", scheduleData);

    await updateScheduleAndCandidatesMutation.mutateAsync({
      assessmentId,
      ...scheduleData,
      candidates: accessMode === "private" ? candidates : [],
      assessmentUrl: url,
      token,
      accessMode: accessMode,
    });

    console.log("✅ Schedule and candidates saved successfully");

    // Now start the animation
    setIsCrafting(true);
    setCraftingProgress(0);

    const interval = setInterval(() => {
      setCraftingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsCrafting(false);
            setShowFinalReview(true);
          }, 600);
          return 100;
        }
        return Math.min(prev + Math.floor(Math.random() * 8) + 2, 100);
      });
    }, 120);
  } catch (err: any) {
    console.error("❌ Error saving schedule:", err);
    setError(err.message || "Failed to save schedule and candidates");
    setIsCrafting(false);
  }
};
  
const handleStartReviewProcess = () => {
  setIsCrafting(true);
  setCraftingProgress(0);

  const interval = setInterval(() => {
    setCraftingProgress((prev) => {
      if (prev >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          setIsCrafting(false);
          setShowFinalReview(true);
        }, 600); // Visual delay at 100%
        return 100;
      }
      const increment = Math.floor(Math.random() * 6) + 3;
      return Math.min(prev + increment, 100);
    });
  }, 100);
};

  const handleFinalComplete = async () => {
    setIsCrafting(true); // Trigger the animation window

    // Simulate progress animation
    const interval = setInterval(() => {
      setCraftingProgress((prev) => (prev < 95 ? prev + 5 : prev));
    }, 500);

    try {
      if (assessmentId) {
        await updateScheduleAndCandidatesMutation.mutateAsync({
          assessmentId,
          examMode,
          duration: parseInt(duration || "0"),
          startTime,
          endTime,
          candidates: accessMode === "private" ? candidates : [],
          complete: true,
          accessMode: accessMode,
        });

        setCraftingProgress(100);
        clearInterval(interval);

        // Navigate after a short delay to show 100% completion
        setTimeout(() => {
          router.push("/dashboard?refresh=" + Date.now());
        }, 1000);
      }
    } catch (err) {
      setIsCrafting(false);
      clearInterval(interval);
      setError("Failed to save.");
    }
  };

  const handleToggleQuestionType = (topicId: string, type: string) => {
    setTopicsV2((prev) =>
      prev.map((topic) => {
        if (topic.id === topicId) {
          const existingRow = topic.questionRows.find(
            (r) => r.questionType === type,
          );

          if (existingRow) {
            // If it exists, remove it (uncheck)
            return {
              ...topic,
              questionRows: topic.questionRows.filter(
                (r) => r.questionType !== type,
              ),
            };
          } else {
            // If it doesn't exist, add a new row (check)
            const newRow: QuestionRow = {
              rowId: `row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              questionType: type as "MCQ" | "Subjective" | "PseudoCode" | "Coding" | "SQL" | "AIML",
              difficulty: "Medium",
              questionsCount: 5, // Default starting value
              canUseJudge0: type === "Coding",
              status: "pending",
              locked: false,
              questions: [],
            };
            return {
              ...topic,
              questionRows: [...topic.questionRows, newRow],
            };
          }
        }
        return topic;
      }),
    );
  };

  const sliderRef = useRef<HTMLDivElement>(null);
  const originalTopicConfigsRef = useRef<Topic[]>([]);
  const minHandleRef = useRef<HTMLDivElement>(null);
  const maxHandleRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const dragTargetRef = useRef<"min" | "max" | null>(null);
  const experienceRef = useRef({ min: experienceMin, max: experienceMax });
  const previousModeRef = useRef<"corporate" | "student">(experienceMode);

  // Update ref when state changes and update slider positions
  useEffect(() => {
    experienceRef.current = { min: experienceMin, max: experienceMax };
    if (minHandleRef.current && maxHandleRef.current && sliderRef.current) {
      const maxValue = experienceMode === "corporate" ? 20 : 3;

      // Only clamp when mode changes
      let clampedMin = experienceMin;
      let clampedMax = experienceMax;

      if (previousModeRef.current !== experienceMode) {
        // Mode changed - clamp values to new range
        clampedMin = Math.max(0, Math.min(experienceMin, maxValue));
        clampedMax = Math.max(
          clampedMin + 1,
          Math.min(experienceMax, maxValue),
        );

        // Update state if values were clamped
        if (clampedMin !== experienceMin) {
          setExperienceMin(clampedMin);
        }
        if (clampedMax !== experienceMax) {
          setExperienceMax(clampedMax);
        }

        previousModeRef.current = experienceMode;
      } else {
        // Normal update - just ensure values are in valid range
        clampedMin = Math.max(0, Math.min(experienceMin, maxValue));
        clampedMax = Math.max(
          clampedMin + 1,
          Math.min(experienceMax, maxValue),
        );
      }

      const minPercent = Math.max(
        0,
        Math.min(100, (clampedMin / maxValue) * 100),
      );
      const maxPercent = Math.max(
        0,
        Math.min(100, (clampedMax / maxValue) * 100),
      );
      minHandleRef.current.style.left = `${minPercent}%`;
      maxHandleRef.current.style.left = `${maxPercent}%`;
    }
  }, [experienceMin, experienceMax, experienceMode]);

  // Handle experience range slider
  useEffect(() => {
    // Only initialize slider when on Station 1
    if (currentStation !== 1) return;
    if (!sliderRef.current || !minHandleRef.current || !maxHandleRef.current)
      return;

    const slider = sliderRef.current;
    const minHandle = minHandleRef.current;
    const maxHandle = maxHandleRef.current;

    const getValueFromPosition = (x: number) => {
      const rect = slider.getBoundingClientRect();
      const percentage = Math.max(
        0,
        Math.min(100, ((x - rect.left) / rect.width) * 100),
      );
      // For corporate: 0-20 years, For student: 0-3 academic levels
      const maxValue = experienceMode === "corporate" ? 20 : 3;
      return Math.round((percentage / 100) * maxValue);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragTargetRef.current) return;

      const value = getValueFromPosition(e.clientX);
      const { min: currentMin, max: currentMax } = experienceRef.current;

      const maxValue = experienceMode === "corporate" ? 20 : 3;
      if (dragTargetRef.current === "min") {
        const newMin = Math.max(0, Math.min(value, currentMax - 1));
        experienceRef.current.min = newMin;
        const minPercent = Math.max(
          0,
          Math.min(100, (newMin / maxValue) * 100),
        );
        minHandle.style.left = `${minPercent}%`;
        setExperienceMin(newMin);
      } else if (dragTargetRef.current === "max") {
        const newMax = Math.max(currentMin + 1, Math.min(value, maxValue));
        experienceRef.current.max = newMax;
        const maxPercent = Math.max(
          0,
          Math.min(100, (newMax / maxValue) * 100),
        );
        maxHandle.style.left = `${maxPercent}%`;
        setExperienceMax(newMax);
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      dragTargetRef.current = null;
    };

    const minMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      dragTargetRef.current = "min";
      e.preventDefault();
      e.stopPropagation();
    };

    const maxMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      dragTargetRef.current = "max";
      e.preventDefault();
      e.stopPropagation();
    };

    minHandle.addEventListener("mousedown", minMouseDown);
    maxHandle.addEventListener("mousedown", maxMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    // Initial position - clamp values first
    const maxValue = experienceMode === "corporate" ? 20 : 3;
    const clampedMin = Math.max(0, Math.min(experienceMin, maxValue));
    const clampedMax = Math.max(
      clampedMin + 1,
      Math.min(experienceMax, maxValue),
    );

    if (clampedMin !== experienceMin) {
      setExperienceMin(clampedMin);
    }
    if (clampedMax !== experienceMax) {
      setExperienceMax(clampedMax);
    }

    const minPercent = Math.max(
      0,
      Math.min(100, (clampedMin / maxValue) * 100),
    );
    const maxPercent = Math.max(
      0,
      Math.min(100, (clampedMax / maxValue) * 100),
    );
    minHandle.style.left = `${minPercent}%`;
    maxHandle.style.left = `${maxPercent}%`;

    return () => {
      minHandle.removeEventListener("mousedown", minMouseDown);
      maxHandle.removeEventListener("mousedown", maxMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [currentStation, experienceMin, experienceMax, experienceMode]);

  // Auto-calculate initial scores when questions are loaded in Review Questions page
  useEffect(() => {
    if (currentStation !== 3 || !topicsV2 || topicsV2.length === 0) return;

    // Extract all questions grouped by type
    const questionsByType: { [key: string]: Array<{ difficulty: string }> } = {
      MCQ: [],
      Subjective: [],
      PseudoCode: [],
      Coding: [],
      SQL: [],
      AIML: [],
    };

    // Aggregate questions from ALL topics including custom topics
    topicsV2.forEach((topic) => {
      topic.questionRows.forEach((row) => {
        // Include questions if they exist and status is "generated" or "completed"
        const rowStatus = row.status;
        const isGeneratedOrCompleted =
          rowStatus === "generated" || rowStatus === "completed";
        if (
          row.questions &&
          row.questions.length > 0 &&
          isGeneratedOrCompleted
        ) {
          const questionType = row.questionType;
          if (questionsByType[questionType]) {
            row.questions.forEach(() => {
              questionsByType[questionType].push({
                difficulty: row.difficulty,
              });
            });
          }
        }
      });
    });

    // Calculate initial scores based on first question of each type
    // Only update if scoring rules are at default values (not manually set)
    setScoringRules((prev) => {
      const newScoringRules = { ...prev };
      let hasChanges = false;

      (
        ["MCQ", "Subjective", "PseudoCode", "Coding", "SQL", "AIML"] as const
      ).forEach((questionType) => {
        const typeQuestions = questionsByType[questionType];
        if (typeQuestions.length > 0) {
          // Get difficulty of first question
          const firstDifficulty = typeQuestions[0].difficulty;
          const suggestedScore = getDefaultScore(questionType, firstDifficulty);

          // Only auto-set if it's still at the initial default value
          // This allows manual edits to persist
          const defaultEasy = getDefaultScore(questionType, "Easy");
          if (prev[questionType] === defaultEasy || prev[questionType] === 0) {
            if (prev[questionType] !== suggestedScore) {
              newScoringRules[questionType] = suggestedScore;
              hasChanges = true;
            }
          }
        }
      });

      return hasChanges ? newScoringRules : prev;
    });
  }, [currentStation, topicsV2]);

  // Auto-update duration when per-section timers are enabled and section times change
  useEffect(() => {
    if (!enablePerSectionTimers) return;

    const totalSectionTime = Object.values(sectionTimers).reduce(
      (sum, time) => sum + time,
      0,
    );
    if (totalSectionTime > 0) {
      setDuration(totalSectionTime.toString());
    }
  }, [sectionTimers, enablePerSectionTimers]);

  // Auto-calculate section timers from questions when enabled
  useEffect(() => {
    if (
      currentStation !== 3 ||
      !enablePerSectionTimers ||
      !topicsV2 ||
      topicsV2.length === 0
    )
      return;

    // Extract all questions grouped by type
    const questionsByType: {
      MCQ: Array<{ difficulty: string }>;
      Subjective: Array<{ difficulty: string }>;
      PseudoCode: Array<{ difficulty: string }>;
      Coding: Array<{ difficulty: string }>;
      SQL: Array<{ difficulty: string }>;
      AIML: Array<{ difficulty: string }>;
    } = {
      MCQ: [],
      Subjective: [],
      PseudoCode: [],
      Coding: [],
      SQL: [],
      AIML: [],
    };

    topicsV2.forEach((topic) => {
      topic.questionRows.forEach((row) => {
        const rowStatus = row.status;
        const isGeneratedOrCompleted =
          rowStatus === "generated" || rowStatus === "completed";
        if (
          row.questions &&
          row.questions.length > 0 &&
          isGeneratedOrCompleted
        ) {
          const questionType = row.questionType as keyof typeof questionsByType;
          if (questionsByType[questionType]) {
            row.questions.forEach((question) => {
              questionsByType[questionType].push({
                difficulty: row.difficulty,
              });
            });
          }
        }
      });
    });

    // Calculate section timers as sum of question times (in minutes)
    const calculateSectionTime = (
      questions: Array<{ difficulty: string }>,
      questionType: string,
    ): number => {
      if (questions.length === 0) {
        return 0; // Return 0 if no questions
      }
      const totalSeconds = questions.reduce((sum, q) => {
        const baseTime = getBaseTimePerQuestion(questionType);
        const multiplier = getDifficultyMultiplier(q.difficulty);
        let questionTime = baseTime * multiplier;
        if (questionType === "MCQ" && questionTime > 40) {
          questionTime = 40;
        }
        return sum + questionTime;
      }, 0);
      return Math.max(1, Math.ceil(totalSeconds / 60)); // Convert to minutes, minimum 1
    };

    const newTimers = {
      MCQ: calculateSectionTime(questionsByType.MCQ, "MCQ"),
      Subjective: calculateSectionTime(
        questionsByType.Subjective,
        "Subjective",
      ),
      PseudoCode: calculateSectionTime(
        questionsByType.PseudoCode,
        "PseudoCode",
      ),
      Coding: calculateSectionTime(questionsByType.Coding, "Coding"),
      SQL: calculateSectionTime(questionsByType.SQL, "SQL"),
      AIML: calculateSectionTime(questionsByType.AIML, "AIML"),
    };

    // Always update section timers based on current questions when per-section timers are enabled
    // This ensures timers reflect the actual question count (reduces when questions are removed)
    setSectionTimers(newTimers);
  }, [currentStation, enablePerSectionTimers, topicsV2]);

  // Save scoring rules, pass percentage, and section timers to draft when they change
  useEffect(() => {
    if (currentStation !== 3 || !assessmentId) return;

    // Debounce draft updates
    const timeoutId = setTimeout(() => {
      console.log("=".repeat(80));
      console.log("[FRONTEND] Saving draft with scoringRules and settings");
      console.log("[FRONTEND] assessmentId:", assessmentId);
      console.log("[FRONTEND] scoringRules:", scoringRules);
      console.log("[FRONTEND] passPercentage:", passPercentage);
      console.log("[FRONTEND] enablePerSectionTimers:", enablePerSectionTimers);
      console.log(
        "[FRONTEND] sectionTimers:",
        enablePerSectionTimers ? sectionTimers : undefined,
      );
      console.log("=".repeat(80));

      updateDraftMutation.mutate(
        {
          assessmentId,
          scoringRules,
          passPercentage,
          enablePerSectionTimers,
          sectionTimers: enablePerSectionTimers ? sectionTimers : undefined,
        },
        {
          onSuccess: (response) => {
            console.log("[FRONTEND] ✓ Draft saved successfully", response.data);
          },
          onError: (err) => {
            console.error(
              "[FRONTEND] ❌ Error saving review settings to draft:",
              err,
            );
          },
        },
      );
    }, 1000);

    return () => clearTimeout(timeoutId);
  }, [
    currentStation,
    assessmentId,
    scoringRules,
    passPercentage,
    enablePerSectionTimers,
    sectionTimers,
  ]);

  // Clear all state function for new assessment
  const clearAllState = () => {
    setAssessmentId(null);
    setJobDesignation("");
    setTopicCards([]);
    setSelectedSkills([]);
    setManualSkillInput("");
    setTopics([]);
    setExperienceMin(0);
    setExperienceMax(10);
    setExperienceMode("corporate");
    setTopicConfigs([]);
    setTopicsV2([]);
    setQuestions([]);
    setFullTopicRegenLocked(false);
    setAllQuestionsGenerated(false);
    setCurrentStation(1);
    setHasVisitedConfigureStation(false);
    setHasVisitedReviewStation(false);
    setError(null);
    setLoading(false);
    setGeneratingRowId(null);
    setGeneratingAllQuestions(false);
    setInitialLoadDone(false); // Reset initial load flag
    console.log("✅ All state cleared for new assessment");
  };

  // Load draft ONLY when explicitly in edit mode (URL has id parameter)
  useEffect(() => {
    if (isEditMode && id && typeof id === "string") {
      // Edit/Continue Draft mode: load the draft assessment specified in URL
      console.log("📝 Edit mode: Loading draft assessment", id);
      loadDraftAssessment(id);
    } else if (!isEditMode) {
      // CREATE NEW mode: Clear all state and start fresh
      console.log("🆕 Create New mode: Starting fresh assessment");
      clearAllState();
      setInitialLoadDone(true); // Allow auto-save immediately for new assessments
    }
  }, [isEditMode, id]);

  // SINGLE DRAFT LOGIC: Auto-save draft on changes (debounced)
  // Only auto-save if we have an assessmentId (draft exists) AND initial load is complete
  useEffect(() => {
    if (!assessmentId) return; // No draft yet, don't auto-save
    if (!initialLoadDone) return; // Don't auto-save until initial load from edit mode is complete

    // Debounce draft saves to avoid too many API calls
    const timeoutId = setTimeout(async () => {
      try {
        const titleToSave =
          finalTitle ||
          (jobDesignation.trim()
            ? `Assessment for ${jobDesignation.trim()}`
            : "Untitled Assessment");

        const draftData: any = {
          assessmentId: assessmentId || undefined,
          title: titleToSave,
          description: finalDescription || "",
          jobDesignation: jobDesignation.trim(),
          selectedSkills: selectedSkills,
          experienceMin: experienceMin,
          experienceMax: experienceMax,
          experienceMode: experienceMode,
        };

        // Add topics_v2 if configured (new structure)
        if (topicsV2 && topicsV2.length > 0) {
          draftData.topics_v2 = topicsV2;
        }

        // Add old topics structure if still in use
        if (topicConfigs.length > 0) {
          draftData.topics = topicConfigs;
        }

        // Add questions if available
        if (questions.length > 0) {
          draftData.questions = questions;
          draftData.passPercentage = passPercentage;
        }

        // Add schedule if available
        if (startTime && endTime) {
          const normalizeDateTime = (dt: string): string => {
            if (!dt) return dt;
            if (dt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
              const dtWithSeconds = dt + ":00";
              const istDate = new Date(dtWithSeconds + "+05:30");
              if (!isNaN(istDate.getTime())) {
                return istDate.toISOString();
              } else {
                return dt + ":00Z";
              }
            }
            if (dt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
              return dt + "Z";
            }
            return dt;
          };

          draftData.schedule = {
            startTime: normalizeDateTime(startTime),
            endTime: normalizeDateTime(endTime),
          };
        }

        // Add candidates if available
        if (candidates.length > 0) {
          draftData.candidates = candidates;
        }

        if (assessmentUrl) {
          draftData.assessmentUrl = assessmentUrl;
        }

        // Fire-and-forget save (don't block UI) - using React Query mutation
        updateDraftMutation.mutate(draftData, {
          onError: (err) => {
            console.error("Error auto-saving draft:", err);
          },
        });
      } catch (err: any) {
        console.error("Error preparing draft data:", err);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [
    assessmentId,
    initialLoadDone, // Add initialLoadDone to dependencies
    finalTitle,
    finalDescription,
    jobDesignation,
    selectedSkills,
    startTime,
    endTime,
    visibilityMode,
    candidateRequirements,
    experienceMin,
    experienceMax,
    experienceMode,
    topicsV2,
    topicConfigs,
    questions,
    passPercentage,
    startTime,
    endTime,
    examMode,
    duration,
    candidates,
    assessmentUrl,
  ]);

  // Auto-fetch skills when jobDesignation or experience range changes (with 1 second debounce)
  // Auto-generate skills when Assessment Title, Job Designation, Experience Range, or Experience Mode changes
  useEffect(() => {
    // Don't generate if job designation is empty
    if (!jobDesignation.trim()) {
      setTopicCards([]);
      return;
    }

    // Skip topic card regeneration in edit mode (topics already loaded from draft)
    if (isEditMode) {
      return; // Don't regenerate topic cards in edit mode
    }

    // Only fetch if we haven't visited configure station yet
    if (hasVisitedConfigureStation) {
      return;
    }

    // Debounce the API call to reduce load
    const timeoutId = setTimeout(async () => {
      setLoadingCards(true);
      setError(null);

      setLoadingCards(true);
      try {
        const response = await generateTopicCardsMutation.mutateAsync({
          jobDesignation: jobDesignation.trim(),
          experienceMin: experienceMin,
          experienceMax: experienceMax,
          experienceMode: experienceMode,
          assessmentTitle: finalTitle.trim() || undefined, // Include title if provided
        });

        if (response?.success) {
          // Only update topic cards - don't touch selectedSkills (manual skills are preserved)
          setTopicCards(response.data?.cards || []);
        } else {
          setError("Failed to generate topic cards");
        }
      } catch (err: any) {
        console.error("Error generating topic cards:", err);
        setError(err.message || "Failed to generate topic cards");
      } finally {
        setLoadingCards(false);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [
    finalTitle,
    jobDesignation,
    experienceMin,
    experienceMax,
    experienceMode,
    isEditMode,
    hasVisitedConfigureStation,
  ]);

  // Constrain experience range when mode changes
  useEffect(() => {
    if (experienceMode === "student") {
      // For students: 0-4 (representing years 1-5)
      if (experienceMin > 4) setExperienceMin(4);
      if (experienceMax > 4) setExperienceMax(4);
      if (experienceMin >= experienceMax) {
        setExperienceMax(Math.min(experienceMin + 1, 4));
      }
    } else {
      // For corporate: 0-20 years
      if (experienceMin > 20) setExperienceMin(20);
      if (experienceMax > 20) setExperienceMax(20);
      if (experienceMin >= experienceMax) {
        setExperienceMax(Math.min(experienceMin + 1, 20));
      }
    }
  }, [experienceMode]);

  const loadDraftAssessment = async (assessmentId: string) => {
    setLoadingDraft(true);
    setError(null);
    setInitialLoadDone(false); // Reset initial load flag - prevent auto-save during load

    try {
      // Fetch assessment data using React Query hook
      // Note: This will be handled by useAssessmentQuestions hook, but we can also refetch here
      await refetchQuestions();

      // For backward compatibility, we'll still check the response structure
      // In a full migration, we'd use questionsData directly from the hook
      const response = { data: { success: true, data: questionsData as any } };

      if (response.data.data?.success && response.data?.data) {
        const responseData: any = response.data.data;
        // The backend returns assessment in responseData.assessment, but also check if it's directly in responseData
        const assessment = (responseData?.assessment || responseData) as any;

        // Debug logging - check ALL possible locations for topics_v2
        console.log("Loading draft assessment:", {
          assessmentId,
          hasAssessment: !!assessment,
          topicsCount: assessment?.topics?.length || 0,
          topicsV2Count: assessment?.topics_v2?.length || 0,
          topicsV2FromData: responseData?.topics_v2?.length || 0,
          topics: assessment?.topics,
          topics_v2: assessment?.topics_v2,
          topics_v2_from_data: responseData?.topics_v2,
          assessmentDataKeys: assessmentData ? Object.keys(assessmentData) : [],
          assessmentKeys: assessment ? Object.keys(assessment) : [],
          fullAssessment: assessment,
        });

        // Set assessment ID
        setAssessmentId(assessmentId);

        // Load Station 1 data
        if (assessment.jobDesignation) {
          setJobDesignation(assessment.jobDesignation);
        }
        if (
          assessment.selectedSkills &&
          Array.isArray(assessment.selectedSkills)
        ) {
          // Only set if not already set to prevent duplicates when navigating back
          setSelectedSkills((prev) => {
            // If already loaded, don't overwrite (prevents duplicates)
            if (prev.length > 0) {
              return prev;
            }
            return assessment.selectedSkills;
          });
        }
        if (assessment.experienceMin !== undefined) {
          setExperienceMin(assessment.experienceMin);
        }
        if (assessment.experienceMax !== undefined) {
          setExperienceMax(assessment.experienceMax);
        }
        if (assessment.experienceMode) {
          setExperienceMode(assessment.experienceMode);
        }
        if (assessment.title) {
          setFinalTitle(assessment.title);
        }
        if (assessment.availableQuestionTypes) {
          setAvailableQuestionTypes(assessment.availableQuestionTypes);
        }

        // Load Station 4 data (Schedule & Proctoring Settings)
        if (assessment.schedule) {
          const schedule = assessment.schedule;
          if (schedule.startTime) {
            // Convert ISO string to datetime-local format
            const startDate = new Date(schedule.startTime);
            const startLocal = new Date(
              startDate.getTime() - startDate.getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16);
            setStartTime(startLocal);
          }
          if (schedule.endTime) {
            const endDate = new Date(schedule.endTime);
            const endLocal = new Date(
              endDate.getTime() - endDate.getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16);
            setEndTime(endLocal);
          }
          if (schedule.examMode) {
            setExamMode(schedule.examMode);
          }
          if (schedule.duration) {
            setDuration(schedule.duration.toString());
          }
          if (schedule.visibilityMode) {
            setVisibilityMode(schedule.visibilityMode);
          }
          if (schedule.candidateRequirements) {
            setCandidateRequirements(schedule.candidateRequirements);
          }
        }

        // Load Station 3 data (Review Questions)
        if (assessment.scoringRules) {
          setScoringRules(assessment.scoringRules);
        }
        if (assessment.passPercentage !== undefined) {
          setPassPercentage(assessment.passPercentage);
        }
        if (assessment.enablePerSectionTimers !== undefined) {
          setEnablePerSectionTimers(assessment.enablePerSectionTimers);
        }
        if (assessment.sectionTimers) {
          setSectionTimers(assessment.sectionTimers);
        }

        // Regenerate topic cards for draft (to show Related Technologies & Skills)
        if (assessment.jobDesignation && assessment.jobDesignation.trim()) {
          try {
            setLoadingCards(true);
            const topicCardsResponse =
              await generateTopicCardsMutation.mutateAsync({
                jobDesignation: assessment.jobDesignation.trim(),
                experienceMin:
                  assessment.experienceMin !== undefined
                    ? assessment.experienceMin
                    : 0,
                experienceMax:
                  assessment.experienceMax !== undefined
                    ? assessment.experienceMax
                    : 10,
                experienceMode: assessment.experienceMode || "corporate",
                assessmentTitle: assessment.title || undefined,
              });
            if (topicCardsResponse?.success) {
              setTopicCards(topicCardsResponse.data?.cards || []);
            }
          } catch (err: any) {
            console.error("Error loading topic cards for draft:", err);
            // Don't show error, just continue loading
          } finally {
            setLoadingCards(false);
          }
        }

        // Load Station 2 data (topics configuration)
        // PRIORITY: Load topics_v2 if available (new v2 format) - this is the primary format
        // Check multiple possible locations: assessment.topics_v2, responseData.topics_v2, response.data.data.topics_v2
        const responseDataAny: any = responseData;
        const topicsV2ToLoad =
          assessment.topics_v2 ||
          responseDataAny?.topics_v2 ||
          response.data?.data?.topics_v2 ||
          null;

        console.log("🔍 Checking for topics_v2:", {
          fromAssessment: !!assessment.topics_v2,
          fromResponseData: !!responseDataAny?.topics_v2,
          fromResponseDataData: !!response.data?.data?.topics_v2,
          topicsV2ToLoad: topicsV2ToLoad
            ? Array.isArray(topicsV2ToLoad)
              ? topicsV2ToLoad.length
              : "not array"
            : null,
        });

        if (
          topicsV2ToLoad &&
          Array.isArray(topicsV2ToLoad) &&
          topicsV2ToLoad.length > 0
        ) {
          console.log(
            `✅ Found topics_v2 to load: ${topicsV2ToLoad.length} topics`,
          );
          // Deep clone to ensure we have a fresh copy
          const restoredTopicsV2 = JSON.parse(JSON.stringify(topicsV2ToLoad));

          // Ensure all questionRows have proper structure
          restoredTopicsV2.forEach((topic: any) => {
            // Ensure questionRows array exists
            if (!topic.questionRows || !Array.isArray(topic.questionRows)) {
              topic.questionRows = [];
            }

            // Ensure topic status is preserved or set based on questions
            if (!topic.status) {
              // If topic has any generated questions, mark as "generated", otherwise "pending"
              const hasGeneratedQuestions = topic.questionRows.some(
                (row: any) =>
                  row.questions &&
                  row.questions.length > 0 &&
                  row.status === "generated",
              );
              topic.status = hasGeneratedQuestions ? "generated" : "pending";
            }

            // Ensure each questionRow has all required fields with defaults
            topic.questionRows.forEach((row: any) => {
              // Ensure status defaults to "pending" if not set
              if (!row.status) {
                row.status =
                  row.questions && row.questions.length > 0
                    ? "generated"
                    : "pending";
              }

              // ⭐ CRITICAL FIX: Ensure questionType has a default value if missing
              if (!row.questionType) {
                row.questionType = "MCQ"; // Default to MCQ if not set
              }

              // ⭐ CRITICAL FIX: Ensure difficulty has a default value if missing
              if (!row.difficulty) {
                row.difficulty = "Medium"; // Default to Medium if not set
              }

              // ⭐ CRITICAL FIX: Ensure questionsCount has a default value if missing
              if (!row.questionsCount || row.questionsCount < 1) {
                row.questionsCount = 1; // Default to 1 if not set
              }

              // IMPORTANT: locked should ONLY be true if questions are generated AND exist
              // If status is "pending" or questions don't exist, locked MUST be false
              if (
                row.status === "pending" ||
                !row.questions ||
                row.questions.length === 0
              ) {
                row.locked = false;
              } else if (row.locked === undefined) {
                // Only set locked to true if status is "generated" AND questions exist
                row.locked =
                  row.status === "generated" &&
                  row.questions &&
                  row.questions.length > 0;
              }

              // Ensure questions array exists
              if (!row.questions) {
                row.questions = [];
              }

              // Ensure rowId exists
              if (!row.rowId) {
                row.rowId = `row_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              }

              // Ensure additionalRequirements is preserved
              if (row.additionalRequirements === undefined) {
                row.additionalRequirements = null;
              }
            });

            // Ensure topic has id
            if (!topic.id) {
              topic.id = `topic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            }
          });

          // 🔍 DEBUG: Log restored topics data structure
          console.log("🔍 DEBUG: restoredTopicsV2 structure:", {
            count: restoredTopicsV2.length,
            sampleTopic: restoredTopicsV2[0]
              ? {
                  id: restoredTopicsV2[0].id,
                  label: restoredTopicsV2[0].label,
                  questionRows:
                    restoredTopicsV2[0].questionRows?.map((r: any) => ({
                      rowId: r.rowId,
                      questionType: r.questionType,
                      difficulty: r.difficulty,
                      questionsCount: r.questionsCount,
                    })) || [],
                }
              : null,
            allTopics: restoredTopicsV2.map((t: any) => ({
              id: t.id,
              label: t.label,
              hasQuestionRows: !!t.questionRows,
              questionRowsCount: t.questionRows?.length || 0,
            })),
          });

          setTopicsV2(restoredTopicsV2);
          setFullTopicRegenLocked(assessment.fullTopicRegenLocked || false);
          setAllQuestionsGenerated(assessment.allQuestionsGenerated || false);
          setHasVisitedConfigureStation(true);

          // ⭐ CRITICAL FIX: Initialize topicInputValues with topic labels
          const initialTopicInputValues: { [topicId: string]: string } = {};
          restoredTopicsV2.forEach((topic: any) => {
            if (topic.id && topic.label) {
              initialTopicInputValues[topic.id] = topic.label;
            }
          });

          // 🔍 DEBUG: Log initialized topicInputValues
          console.log(
            "🔍 DEBUG: initialTopicInputValues:",
            initialTopicInputValues,
          );
          console.log("🔍 DEBUG: Sample topic input value:", {
            firstTopicId: restoredTopicsV2[0]?.id,
            firstTopicLabel: restoredTopicsV2[0]?.label,
            inputValue: initialTopicInputValues[restoredTopicsV2[0]?.id],
          });

          setTopicInputValues(initialTopicInputValues);

          // Auto-navigate to Station 3 (skip Station 2)
          if (restoredTopicsV2.length > 0) {
            setCurrentStation(3);
          }

          console.log("✅ Topics_v2 fully restored:", {
            topicsV2Count: restoredTopicsV2.length,
            topicsV2: restoredTopicsV2.map((t: any) => ({
              id: t.id,
              label: t.label,
              locked: t.locked,
              questionRowsCount: t.questionRows?.length || 0,
              questionRows: t.questionRows?.map((r: any) => ({
                rowId: r.rowId,
                questionType: r.questionType,
                difficulty: r.difficulty,
                questionsCount: r.questionsCount,
                status: r.status,
                locked: r.locked,
                generatedQuestionsCount: r.questions?.length || 0,
              })),
            })),
            fullTopicRegenLocked:
              assessment.fullTopicRegenLocked ||
              responseData.fullTopicRegenLocked ||
              false,
            allQuestionsGenerated:
              assessment.allQuestionsGenerated ||
              responseData.allQuestionsGenerated ||
              false,
            navigatedToStation2: true,
          });
        } else {
          console.warn("⚠️ No topics_v2 found in assessment. Available keys:", {
            assessmentKeys: assessment ? Object.keys(assessment) : [],
            assessmentDataKeys: assessmentData
              ? Object.keys(assessmentData)
              : [],
            responseDataKeys: response.data?.data
              ? Object.keys(response.data.data)
              : [],
            topicsV2ToLoad: topicsV2ToLoad,
          });
        }

        // Check both assessment.topics and assessmentData.topics (backend might return topics separately)
        // Only load old format if topics_v2 is not available
        const topicsToLoad =
          !assessment.topics_v2 || assessment.topics_v2.length === 0
            ? assessment.topics || (assessmentData as any)?.topics || []
            : [];
        console.log("Topics to load (old format):", {
          fromAssessment: assessment.topics?.length || 0,
          fromAssessmentData: (assessmentData as any)?.topics?.length || 0,
          topicsToLoad: topicsToLoad.length,
          topics: topicsToLoad,
          topicsV2: assessment.topics_v2?.length || 0,
          usingOldFormat: topicsToLoad.length > 0,
        });

        if (topicsToLoad && topicsToLoad.length > 0) {
          const isAptitude = assessment.isAptitudeAssessment || false;
          setTopics(topicsToLoad.map((t: any) => t.topic || t));

          const configs = topicsToLoad.map((t: any) => {
            const isTopicAptitude =
              t.isAptitude === true ||
              (isAptitude && t.category === "aptitude");

            // Load question type configs from questionConfigs if available
            let questionTypeConfigs: QuestionTypeConfig[] = [];

            if (t.questionConfigs && t.questionConfigs.length > 0) {
              // Group by question type and difficulty
              const configMap: { [key: string]: QuestionTypeConfig } = {};
              for (const qc of t.questionConfigs) {
                // Handle both plain objects and MongoDB documents
                const qcType =
                  typeof qc === "object" && qc !== null
                    ? qc.type || (qc as any).get?.("type")
                    : null;
                const qcDifficulty =
                  typeof qc === "object" && qc !== null
                    ? qc.difficulty || (qc as any).get?.("difficulty")
                    : null;
                const qcLanguage =
                  typeof qc === "object" && qc !== null
                    ? qc.language || (qc as any).get?.("language")
                    : undefined;
                const qcJudge0 =
                  typeof qc === "object" && qc !== null
                    ? qc.judge0_enabled !== undefined
                      ? qc.judge0_enabled
                      : (qc as any).get?.("judge0_enabled") !== undefined
                        ? (qc as any).get("judge0_enabled")
                        : undefined
                    : undefined;

                const type = qcType || "MCQ";
                const difficulty = qcDifficulty || "Medium";
                const key = `${type}_${difficulty}`;

                if (!configMap[key]) {
                  configMap[key] = {
                    questionType: type,
                    difficulty: difficulty,
                    numQuestions: 0,
                    language: qcLanguage,
                    judge0_enabled: qcJudge0,
                  };
                }
                configMap[key].numQuestions++;
              }
              questionTypeConfigs = Object.values(configMap);
            } else if (t.questionTypes && t.questionTypes.length > 0) {
              // Fallback: create configs from questionTypes array
              questionTypeConfigs = t.questionTypes.map((qt: string) => ({
                questionType: qt,
                difficulty: t.difficulty || "Medium",
                numQuestions:
                  Math.floor((t.numQuestions || 1) / t.questionTypes.length) ||
                  1,
                language:
                  qt === "coding"
                    ? t.language || getLanguageFromTopic(t.topic)
                    : undefined,
                judge0_enabled:
                  qt === "coding"
                    ? t.judge0_enabled !== undefined
                      ? t.judge0_enabled
                      : true
                    : undefined,
              }));
            } else {
              // Default: single question type
              const questionType =
                availableQuestionTypes[0] || QUESTION_TYPES[0];
              questionTypeConfigs = [
                {
                  questionType: questionType,
                  difficulty: t.difficulty || "Medium",
                  numQuestions: t.numQuestions || 1,
                  language:
                    questionType === "coding"
                      ? t.language || getLanguageFromTopic(t.topic)
                      : undefined,
                  judge0_enabled:
                    questionType === "coding"
                      ? t.judge0_enabled !== undefined
                        ? t.judge0_enabled
                        : true
                      : undefined,
                },
              ];
            }

            if (isTopicAptitude) {
              const availableSubTopics =
                t.availableSubTopics || t.subTopics || [];
              const defaultSubTopic =
                availableSubTopics.length > 0
                  ? availableSubTopics[0]
                  : undefined;
              const selectedSubTopic = t.subTopic || defaultSubTopic;

              return {
                topic: t.topic,
                questionTypeConfigs: questionTypeConfigs,
                isAptitude: true,
                subTopic: selectedSubTopic,
                aptitudeStructure: t.aptitudeStructure || undefined,
                availableSubTopics: availableSubTopics,
              };
            } else {
              return {
                topic: t.topic,
                questionTypeConfigs: questionTypeConfigs,
                isAptitude: false,
                coding_supported:
                  t.coding_supported !== undefined
                    ? t.coding_supported
                    : undefined,
              };
            }
          });

          setTopicConfigs(configs);
          originalTopicConfigsRef.current = JSON.parse(JSON.stringify(configs));
          setHasVisitedConfigureStation(true);

          // Debug logging
          console.log("Topic configs loaded:", {
            configsCount: configs.length,
            configs: configs,
          });
        }

        // Note: topics_v2 loading is now handled above with full restoration
        // This section is only for old format topics (if topics_v2 doesn't exist)
        if (!assessment.topics_v2 || assessment.topics_v2.length === 0) {
          if (!topicsToLoad || topicsToLoad.length === 0) {
            // Debug logging if no topics found
            console.log("⚠️ No topics found in assessment:", {
              assessmentId,
              hasTopics: !!assessment.topics,
              topicsLength: assessment.topics?.length || 0,
              hasTopicsV2: !!assessment.topics_v2,
              topicsV2Length: assessment.topics_v2?.length || 0,
              hasTopicsInData: !!topicsToLoad,
              topicsToLoadLength: topicsToLoad?.length || 0,
              assessmentKeys: Object.keys(assessment),
              assessmentDataKeys: assessmentData
                ? Object.keys(assessmentData)
                : [],
            });
          }
        }

        // Load Station 3 data (questions)
        if (responseData.questions && responseData.questions.length > 0) {
          setQuestions(responseData.questions);
          setHasVisitedReviewStation(true);

          // Load scoring rules if available
          if (assessment.scoringRules) {
            setScoringRules(assessment.scoringRules);
          }

          // Load pass percentage if available
          if (assessment.passPercentage !== undefined) {
            setPassPercentage(assessment.passPercentage);
          }

          // Load section timer settings if available
          if (assessment.enablePerSectionTimers !== undefined) {
            setEnablePerSectionTimers(assessment.enablePerSectionTimers);
          }
          if (assessment.sectionTimers) {
            setSectionTimers(assessment.sectionTimers);
          }
        }

        // Load Station 4 data (schedule)
        if (assessment.schedule) {
          const schedule = assessment.schedule;
          if (schedule.startTime) {
            // Convert ISO string to datetime-local format
            const startDate = new Date(schedule.startTime);
            const startLocal = new Date(
              startDate.getTime() - startDate.getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16);
            setStartTime(startLocal);
          }
          if (schedule.endTime) {
            const endDate = new Date(schedule.endTime);
            const endLocal = new Date(
              endDate.getTime() - endDate.getTimezoneOffset() * 60000,
            )
              .toISOString()
              .slice(0, 16);
            setEndTime(endLocal);
          }
          if (schedule.examMode) {
            setExamMode(schedule.examMode);
          }
          if (schedule.duration) {
            setDuration(schedule.duration.toString());
          }
          if (schedule.visibilityMode) {
            setVisibilityMode(schedule.visibilityMode);
          }
          if (schedule.candidateRequirements) {
            setCandidateRequirements(schedule.candidateRequirements);
          }
        }

        // Load proctoring settings with migration from old schema

        // Load Station 5 data (candidates, URL, accessMode, invitationTemplate)
        if (assessment.candidates && assessment.candidates.length > 0) {
          setCandidates(assessment.candidates);
        }
        if (assessment.assessmentUrl) {
          setAssessmentUrl(assessment.assessmentUrl);
        }
        if (assessment.accessMode) {
          setAccessMode(assessment.accessMode);
        }
        if (assessment.invitationTemplate) {
          setInvitationTemplate(assessment.invitationTemplate);
        }

        // Load finalization data (always load, even if empty/placeholder)
        setFinalTitle(assessment.title || "");
        setFinalDescription(assessment.description || "");
        if (assessment.passPercentage !== undefined) {
          setPassPercentage(assessment.passPercentage);
        }

        // Load questions if available
        if (
          assessment.questions &&
          Array.isArray(assessment.questions) &&
          assessment.questions.length > 0
        ) {
          setQuestions(assessment.questions);
        }

        // SINGLE DRAFT: No need to store in localStorage - backend maintains single draft

        // Check if assessment is finalized (active or completed)
        const assessmentStatus = assessment.status || "draft";
        const finalized =
          assessmentStatus === "ready" ||
          assessmentStatus === "active" ||
          assessmentStatus === "completed" ||
          assessmentStatus === "scheduled";
        setIsFinalized(finalized);

        // If finalized (active or completed), redirect to Analytics page - NO EDIT ALLOWED
        if (finalized) {
          router.push(`/assessments/${assessmentId}/analytics`);
          return;
        }

        // Determine which station to show based on what's been completed
        // PRIORITY: Check topics_v2 first (new format)
        // Also respect saved currentStation if available
        if (
          assessment.currentStation !== undefined &&
          assessment.currentStation > 0
        ) {
          setCurrentStation(assessment.currentStation);
          console.log(
            `✅ Restored currentStation from draft: ${assessment.currentStation}`,
          );
        } else if (
          assessment.status === "ready" ||
          assessment.status === "scheduled"
        ) {
          setCurrentStation(5); // Show candidates station if finalized
        } else if (assessment.candidates && assessment.candidates.length > 0) {
          setCurrentStation(5);
        } else if (assessment.schedule) {
          setCurrentStation(4);
        } else if (
          (assessmentData as any)?.questions &&
          (assessmentData as any).questions.length > 0
        ) {
          setCurrentStation(3);
        } else if (
          (assessment.topics_v2 && assessment.topics_v2.length > 0) ||
          (assessment.topics && assessment.topics.length > 0)
        ) {
          // Navigate to Station 3 (skip Station 2)
          setCurrentStation(3);
        } else {
          setCurrentStation(1);
        }

        // Mark initial load as complete AFTER all states are populated
        // This prevents auto-save from overwriting topics before they're loaded
        setInitialLoadDone(true);
        console.log("✅ Initial load complete - auto-save now enabled", {
          topicsV2Count: assessment.topics_v2?.length || 0,
          topicsCount: assessment.topics?.length || 0,
          topicConfigsCount: topicConfigs.length,
          questionsCount: (assessmentData as any)?.questions?.length || 0,
          currentStation: assessment.currentStation || "auto-determined",
        });
      }
    } catch (err: any) {
      console.error("Error loading draft assessment:", err);

      // If assessment not found (404), just continue with new assessment
      if (err.response?.status === 404 || err.response?.status === 400) {
        console.log("Assessment not found, will create new draft when needed");
        // Don't show error to user - just silently continue with new assessment
        setError(null);
        setInitialLoadDone(true); // Allow auto-save even if assessment not found
      } else {
        // For other errors, show the error message
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load draft assessment",
        );
        setInitialLoadDone(true); // Still allow auto-save to prevent blocking
      }
    } finally {
      setLoadingDraft(false);
      // Ensure initialLoadDone is set even if there was an error
      if (!initialLoadDone) {
        setInitialLoadDone(true);
      }
    }
  };

  const handleGenerateTopicCards = async () => {
    if (!jobDesignation.trim()) {
      setError("Please enter a job designation");
      return;
    }

    setLoadingCards(true);
    setError(null);

    try {
      console.log(
        "🔵 [Component] handleGenerateTopicCards - Starting request:",
        {
          jobDesignation: jobDesignation.trim(),
          experienceMin,
          experienceMax,
          experienceMode,
          assessmentTitle: finalTitle.trim() || undefined,
        },
      );

      const response = await generateTopicCardsMutation.mutateAsync({
        jobDesignation: jobDesignation.trim(),
        experienceMin: experienceMin,
        experienceMax: experienceMax,
        experienceMode: experienceMode,
        assessmentTitle: finalTitle.trim() || undefined,
      });

      console.log(
        "🟢 [Component] handleGenerateTopicCards - Response received:",
        {
          response,
          responseType: typeof response,
          responseKeys: response ? Object.keys(response) : null,
          hasData: "data" in (response || {}),
          responseData: response?.data,
          dataType: typeof response?.data,
          dataKeys: response?.data ? Object.keys(response?.data) : null,
          hasSuccess: response?.data ? "success" in response.data : false,
          successValue: response?.data?.success,
          hasDataData: response?.data ? "data" in response.data : false,
          dataData: response?.data?.data,
          hasCards: response?.data?.data
            ? "cards" in response.data.data
            : false,
          cards: response?.data?.data?.cards,
          cardsType: typeof response?.data?.data?.cards,
          cardsIsArray: Array.isArray(response?.data?.data?.cards),
          cardsLength: Array.isArray(response?.data?.data?.cards)
            ? response.data.data.cards.length
            : null,
        },
      );

      if (response?.success) {
        console.log(
          "✅ [Component] handleGenerateTopicCards - Success path, setting cards:",
          response.data?.cards,
        );
        setTopicCards(response.data?.cards || []);
      } else {
        console.warn(
          "⚠️ [Component] handleGenerateTopicCards - Success check failed:",
          {
            hasResponse: !!response,
            successValue: response?.success,
            fullResponse: response,
          },
        );
        setError("Failed to generate topic cards");
      }
    } catch (err: any) {
      console.error("🔴 [Component] handleGenerateTopicCards - Error caught:", {
        error: err,
        message: err?.message,
        response: err?.response,
        responseStatus: err?.response?.status,
        responseData: err?.response?.data,
        responseDataKeys: err?.response?.data
          ? Object.keys(err.response.data)
          : null,
        stack: err?.stack,
      });
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to generate topic cards",
      );
    } finally {
      setLoadingCards(false);
    }
  };

  const handleCardClick = (card: string) => {
    if (!selectedSkills.includes(card)) {
      setSelectedSkills([...selectedSkills, card]);
    }
  };

  const handleAddManualSkill = () => {
    if (
      manualSkillInput.trim() &&
      !selectedSkills.includes(manualSkillInput.trim())
    ) {
      setSelectedSkills([...selectedSkills, manualSkillInput.trim()]);
      setManualSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSelectedSkills(selectedSkills.filter((s) => s !== skillToRemove));
  };

  // CSV Template Download
  const downloadCsvTemplate = () => {
    const csvContent = `skill_name,skill_description,importance_level
Java OOP,"Encapsulation; polymorphism basics; abstraction fundamentals",High
React Hooks,"useState and useEffect patterns; lifecycle behavior",Medium
SQL Queries,"JOIN operations and subqueries; indexing strategies",High`;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "skill_requirements_template.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV File Parsing (handles quoted fields, semicolon-separated descriptions, and strict 3-column validation)
  const parseCsvFile = (
    file: File,
  ): Promise<
    Array<{
      skill_name: string;
      skill_description: string;
      importance_level: string;
    }>
  > => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split("\n").filter((line) => line.trim());
          if (lines.length < 2) {
            reject(
              new Error("CSV must have at least a header row and one data row"),
            );
            return;
          }

          // Robust CSV parser that handles quoted fields properly (works in Chrome, Edge, Safari, Firefox)
          const parseCsvLine = (line: string): string[] => {
            const result: string[] = [];
            let current = "";
            let inQuotes = false;

            for (let i = 0; i < line.length; i++) {
              const char = line[i];
              const nextChar = i < line.length - 1 ? line[i + 1] : null;

              if (char === '"') {
                // Handle escaped quotes ("")
                if (inQuotes && nextChar === '"') {
                  current += '"';
                  i++; // Skip next quote
                } else {
                  inQuotes = !inQuotes;
                }
              } else if (char === "," && !inQuotes) {
                result.push(current.trim());
                current = "";
              } else {
                current += char;
              }
            }
            // Add the last field
            result.push(current.trim());
            return result;
          };

          // Parse header
          const header = parseCsvLine(lines[0]).map((h) =>
            h.toLowerCase().replace(/^"|"$/g, "").trim(),
          );

          // STRICT VALIDATION: Must have exactly 3 columns
          if (header.length !== 3) {
            reject(
              new Error(
                "Invalid CSV: Only three columns allowed — skill_name, skill_description, importance_level.",
              ),
            );
            return;
          }

          const skillNameIdx = header.indexOf("skill_name");
          const skillDescIdx = header.indexOf("skill_description");
          const importanceIdx = header.indexOf("importance_level");

          if (
            skillNameIdx === -1 ||
            skillDescIdx === -1 ||
            importanceIdx === -1
          ) {
            reject(
              new Error(
                "CSV must have columns: skill_name, skill_description, importance_level",
              ),
            );
            return;
          }

          // Parse data rows
          const data: Array<{
            skill_name: string;
            skill_description: string;
            importance_level: string;
          }> = [];
          for (let i = 1; i < lines.length; i++) {
            const values = parseCsvLine(lines[i]).map((v) => {
              // Remove surrounding quotes if present, but preserve content
              v = v.trim();
              if (v.startsWith('"') && v.endsWith('"')) {
                v = v.slice(1, -1);
              }
              // Unescape double quotes
              v = v.replace(/""/g, '"');
              return v.trim();
            });

            // STRICT VALIDATION: Each row must have exactly 3 columns
            if (values.length !== 3) {
              reject(
                new Error(
                  `Row ${i + 1}: Invalid CSV format. Each row must have exactly 3 columns (found ${values.length}).`,
                ),
              );
              return;
            }

            const skillName = values[skillNameIdx]?.trim() || "";
            const skillDesc = values[skillDescIdx]?.trim() || "";
            const importance = values[importanceIdx]?.trim() || "";

            if (!skillName) {
              reject(new Error(`Row ${i + 1}: skill_name cannot be empty`));
              return;
            }

            if (!["Low", "Medium", "High"].includes(importance)) {
              reject(
                new Error(
                  `Row ${i + 1}: importance_level must be Low, Medium, or High (found: "${importance}")`,
                ),
              );
              return;
            }

            data.push({
              skill_name: skillName,
              skill_description: skillDesc, // Can contain semicolons - that's allowed
              importance_level: importance,
            });
          }

          if (data.length === 0) {
            reject(new Error("No valid data rows found in CSV"));
            return;
          }

          resolve(data);
        } catch (err: any) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read CSV file"));
      reader.readAsText(file);
    });
  };

  // Handle Skill Requirements CSV File Upload
  const handleSkillRequirementsCsvUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setCsvError(null);

    try {
      const parsed = await parseCsvFile(file);
      setCsvData(parsed);
    } catch (err: any) {
      setCsvError(err.message || "Failed to parse CSV file");
      setCsvData([]);
    }
  };

  // Delete a row from CSV data
  const handleDeleteCsvRow = (index: number) => {
    setCsvData((prevData) => prevData.filter((_, idx) => idx !== index));
  };

  // Helper function to detect URLs in text
  const detectUrl = (text: string): string | null => {
    const urlRegex = /(https?:\/\/[^\s]+)/gi;
    const matches = text.match(urlRegex);
    return matches && matches.length > 0 ? matches[0] : null;
  };

  // Fetch and summarize website content from URL
  const fetchAndSummarizeUrl = async (url: string) => {
    // Prevent multiple simultaneous calls for the same URL
    if (isProcessingUrlRef.current) {
      console.log("URL fetch already in progress, skipping duplicate call");
      return;
    }

    // Check if we've already processed this URL
    if (lastProcessedUrlRef.current === url && requirementsSummary) {
      console.log("URL already processed, skipping");
      return;
    }

    isProcessingUrlRef.current = true;
    setProcessingUrl(true);
    setUrlError(null);
    setRequirementsUrl(url);

    try {
      // Call backend API to fetch and summarize URL
      const response = await fetchAndSummarizeUrlMutation.mutateAsync({
        url: url,
      });

      if (response?.success && response.data?.summary) {
        const summary = response.data.summary;
        setRequirementsSummary(summary);
        lastProcessedUrlRef.current = url;

        // Append the summary to requirements text if it's not already there
        // Use a callback to avoid triggering the useEffect
        setRequirementsText((prev) => {
          // Check if summary is already in the text
          if (prev.includes(summary)) {
            return prev;
          }
          const urlRemoved = prev.replace(url, "").trim();
          return urlRemoved
            ? `${urlRemoved}\n\n--- Website Summary ---\n${summary}`
            : `--- Website Summary ---\n${summary}`;
        });
      } else {
        throw new Error(
          response.data?.message || "Failed to fetch and summarize URL",
        );
      }
    } catch (err: any) {
      console.error("Error fetching URL:", err);
      setUrlError(
        err.response?.data?.message ||
          err.message ||
          "Failed to fetch and summarize website. Please check the URL and try again.",
      );
      setRequirementsUrl(null);
      setRequirementsSummary(null);
      lastProcessedUrlRef.current = null;
    } finally {
      setProcessingUrl(false);
      isProcessingUrlRef.current = false;
    }
  };

  // Handle requirements text change
  const handleRequirementsChange = (value: string) => {
    setRequirementsText(value);
    setUrlError(null);
  };

  // Auto-detect and fetch URL when requirements text changes (debounced)
  useEffect(() => {
    // Clear any existing timeout
    if (urlTimeoutRef.current) {
      clearTimeout(urlTimeoutRef.current);
      urlTimeoutRef.current = null;
    }

    // Don't process if already processing or if text is empty
    if (
      !requirementsText.trim() ||
      processingUrl ||
      isProcessingUrlRef.current
    ) {
      return;
    }

    // Don't process if summary is already in the text (prevents infinite loop)
    if (requirementsSummary && requirementsText.includes(requirementsSummary)) {
      return;
    }

    const url = detectUrl(requirementsText);

    // Only process if URL is different from last processed and different from current requirementsUrl
    if (url && url !== requirementsUrl && url !== lastProcessedUrlRef.current) {
      // Debounce: wait 2 seconds after user stops typing
      urlTimeoutRef.current = setTimeout(() => {
        // Double-check conditions before calling
        if (
          !isProcessingUrlRef.current &&
          url !== lastProcessedUrlRef.current
        ) {
          fetchAndSummarizeUrl(url);
        }
        urlTimeoutRef.current = null;
      }, 2000);
    }

    return () => {
      if (urlTimeoutRef.current) {
        clearTimeout(urlTimeoutRef.current);
        urlTimeoutRef.current = null;
      }
    };
  }, [requirementsText, requirementsUrl, processingUrl, requirementsSummary]);

  // Unified topic generation that merges skills from all three methods
  // Helper function to check if a skill/topic is supported by Judge0
  const isJudge0Supported = (skillName: string): boolean => {
    const skillLower = skillName.toLowerCase().trim();

    // List of frameworks/libraries not supported by Judge0
    const unsupportedFrameworks = [
      "django",
      "flask",
      "fastapi",
      "react",
      "angular",
      "vue",
      "next",
      "nextjs",
      "express",
      "spring",
      "hibernate",
      "laravel",
      "symfony",
      "rails",
      "ruby on rails",
      "asp.net",
      "dotnet",
      ".net",
      "tensorflow",
      "pytorch",
      "keras",
      "scikit-learn",
      "scikit",
      "pandas",
      "numpy",
      "matplotlib",
      "seaborn",
      "jupyter",
      "jupyter notebook",
      "selenium",
      "cypress",
      "jest",
      "mocha",
      "junit",
      "pytest",
      "unittest",
      "maven",
      "gradle",
      "npm",
      "yarn",
      "webpack",
      "babel",
      "gulp",
      "grunt",
    ];

    // Check if the skill matches any unsupported framework
    for (const framework of unsupportedFrameworks) {
      if (skillLower === framework || skillLower.startsWith(framework + " ")) {
        return false;
      }
    }

    return true;
  };

  // Helper function to filter topics that have coding questions but are unsupported by Judge0
  const filterTopicsWithCoding = (topics: TopicV2[]): TopicV2[] => {
    return topics.filter((topic) => {
      // Check if topic has any coding question rows
      const hasCodingQuestions = topic.questionRows.some(
        (row) => row.questionType === "Coding",
      );

      // If topic has coding questions, check if it's supported by Judge0
      if (hasCodingQuestions) {
        return isJudge0Supported(topic.label);
      }

      // If no coding questions, keep the topic
      return true;
    });
  };

  // Helper function to filter skills that are unsupported by Judge0
  const filterUnsupportedSkills = <T extends { skill_name: string }>(
    skills: T[],
  ): T[] => {
    return skills.filter((skill) => isJudge0Supported(skill.skill_name));
  };

  const handleGenerateTopicsUnified = async () => {
    // Validation: Must have at least one source of requirements (text, URL summary, or skills)
    if (
      !requirementsText.trim() &&
      !requirementsSummary &&
      selectedSkills.length === 0 &&
      csvData.length === 0
    ) {
      setError(
        "Please provide at least one of the following: requirements text/URL, selected skills, or CSV upload",
      );
      return;
    }

    // Collect skills from all sources (optional - can be used to supplement requirements)

    // Parse manual skill input (comma-separated)
    const manualSkillsFromInput = manualSkillInput
      .split(',')
      .map(skill => skill.trim())
      .filter(skill => skill.length > 0);

    // Merge manual input skills with selectedSkills
    const allSelectedSkills = [...new Set([...selectedSkills, ...manualSkillsFromInput])];

    // Method A (Role-based): Skills from topic cards (auto-generated from job designation)
    const roleBasedSkills = allSelectedSkills
      .filter((skill) => topicCards.includes(skill))
      .map((skill) => ({
        skill_name: skill.trim(),
        source: "role" as const,
        description: null,
        importance_level: null,
      }));

    // Method B (Manual): Skills manually entered that are NOT in topic cards
    const manualSkills = allSelectedSkills
      .filter((skill) => !topicCards.includes(skill))
      .map((skill) => ({
        skill_name: skill.trim(),
        source: "manual" as const,
        description: null,
        importance_level: null,
      }));

    // Method C (CSV): Skills from CSV upload
    const csvSkills = csvData.map((row) => ({
      skill_name: row.skill_name.trim(),
      source: "csv" as const,
      description: row.skill_description || null,
      importance_level: row.importance_level || null,
    }));

    // Merge all skills from all methods that have data
    const allSkills = [...roleBasedSkills, ...manualSkills, ...csvSkills];

    // Deduplicate by skill_name (case-insensitive) - keep first occurrence
    const seen = new Set<string>();
    let combinedSkills: Array<{
      skill_name: string;
      source: "role" | "manual" | "csv";
      description: string | null;
      importance_level: string | null;
    }> = allSkills.filter((skill) => {
      const normalized = skill.skill_name.toLowerCase().trim();
      if (seen.has(normalized)) {
        return false; // Skip duplicates
      }
      seen.add(normalized);
      return true;
    });

    // Filter out unsupported frameworks from skills (since coding questions might be generated)
    // This ensures that topics with coding questions will only use Judge0-supported technologies
    combinedSkills = filterUnsupportedSkills(
      combinedSkills,
    ) as typeof combinedSkills;

    // Log for debugging (can be removed in production)
    console.log("Generating topics with requirements and combined skills:", {
      requirementsText: requirementsText.trim()
        ? requirementsText.trim().substring(0, 100) + "..."
        : "(empty)",
      requirementsUrl: requirementsUrl || "(none)",
      requirementsSummary: requirementsSummary
        ? requirementsSummary.substring(0, 100) + "..."
        : "(none)",
      roleBased: roleBasedSkills.length,
      manual: manualSkills.length,
      csv: csvSkills.length,
      total: combinedSkills.length,
      skills: combinedSkills.map((s) => `${s.skill_name} (${s.source})`),
    });

    setLoading(true);
    setError(null);
    setCsvError(null);

    try {
      const response = await generateTopicsV2Mutation.mutateAsync({
        assessmentId: assessmentId || undefined,
        assessmentTitle: finalTitle.trim() || undefined,
        jobDesignation: jobDesignation.trim() || undefined,
        requirementsText: requirementsText.trim() || undefined, // Optional requirements input
        requirementsUrl: requirementsUrl || undefined, // URL if provided
        requirementsSummary: requirementsSummary || undefined, // Summarized content from URL
        combinedSkills: combinedSkills.length > 0 ? combinedSkills : undefined, // Optional skills list (filtered for Judge0 support)
        experienceMin: experienceMin,
        experienceMax: experienceMax,
        experienceMode: experienceMode,
      });

      if (response?.success) {
        let generatedTopics = response.data?.topics || [];

        // Filter out topics that have coding questions but are not supported by Judge0
        generatedTopics = filterTopicsWithCoding(generatedTopics);

        // Ensure all newly generated topics have status "pending"
        const topicsWithStatus = generatedTopics.map((topic: TopicV2) => ({
          ...topic,
          status: "pending" as const, // Newly generated topics are always "pending"
        }));
        setTopicsV2(topicsWithStatus);

        // ⭐ CRITICAL FIX: Initialize topicInputValues with topic labels
        const initialTopicInputValues: { [topicId: string]: string } = {};
        topicsWithStatus.forEach((topic: TopicV2) => {
          if (topic.id && topic.label) {
            initialTopicInputValues[topic.id] = topic.label;
          }
        });
        setTopicInputValues(initialTopicInputValues);

        setAssessmentId(response.data?.assessmentId || assessmentId);
        setFullTopicRegenLocked(false);
        setAllQuestionsGenerated(false);
        setHasVisitedConfigureStation(true);
        setCurrentStation(3);
      } else {
        setError("Failed to generate topics");
      }
    } catch (err: any) {
      console.error("Error generating topics:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to generate topics",
      );
    } finally {
      setLoading(false);
      setGeneratingFromCsv(false);
    }
  };

  // Generate Topics from CSV Requirements (DEPRECATED - use handleGenerateTopicsUnified)
  const handleGenerateTopicsFromCsv = async () => {
    if (csvData.length === 0) {
      setCsvError("Please upload a valid CSV file first");
      return;
    }

    setGeneratingFromCsv(true);
    setError(null);
    setCsvError(null);

    try {
      const response = await generateTopicsFromRequirementsMutation.mutateAsync(
        {
          experienceMode: experienceMode,
          experienceMin: experienceMin,
          experienceMax: experienceMax,
          requirements: csvData,
        },
      );

      if (response?.success) {
        const generatedTopics = response.data?.topics || [];

        // Update topics_v2 with CSV-generated topics
        setTopicsV2(generatedTopics);

        // If editing, update the assessment draft
        if (isEditMode && assessmentId) {
          await updateDraftMutation.mutateAsync({
            assessmentId: assessmentId || undefined,
            topics_v2: generatedTopics,
          });
        } else if (!assessmentId) {
          // Create new assessment draft with CSV-generated topics
          const createResponse = await generateTopicsMutation.mutateAsync({
            assessmentTitle: finalTitle.trim() || undefined,
            jobDesignation: "CSV Requirements",
            selectedSkills: csvData.map((r) => r.skill_name),
            experienceMin: experienceMin,
            experienceMax: experienceMax,
            experienceMode: experienceMode,
          });

          if (createResponse?.success) {
            setAssessmentId(createResponse.data?.assessmentId);
            // Override with CSV-generated topics
            setTopicsV2(generatedTopics);
            await updateDraftMutation.mutateAsync({
              assessmentId: createResponse.data?.assessmentId,
              topics_v2: generatedTopics,
            });
          }
        }

        // Show success message
        setError(null);
        setCsvError(null);
        // Navigate to Station 3 (skip Station 2)
        setCurrentStation(3);
      } else {
        setCsvError("Failed to generate topics from requirements");
      }
    } catch (err: any) {
      console.error("Error generating topics from CSV:", err);
      setCsvError(
        err.response?.data?.message ||
          err.message ||
          "Failed to generate topics from requirements",
      );
    } finally {
      setGeneratingFromCsv(false);
    }
  };

  const handleGenerateTopics = async () => {
    if (selectedSkills.length === 0) {
      setError("Please select at least one skill to assess");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // If editing and assessment already exists, skip creation and just update topics
      if (isEditMode && assessmentId) {
        // For editing, we'll update the existing assessment's topics
        // Call create-from-job-designation which will update existing assessment
        const response = await createFromJobDesignationMutation.mutateAsync({
          assessmentId: assessmentId || undefined, // Pass assessmentId to update existing instead of creating new
          jobDesignation: jobDesignation.trim(),
          selectedSkills: selectedSkills,
          experienceMin: experienceMin.toString(),
          experienceMax: experienceMax.toString(),
          experienceMode: experienceMode,
        });

        // If a new assessment was created, use its ID; otherwise keep the existing one
        if (response?.success) {
          const data = response.data;
          const newAssessmentId = data?.assessment?._id || data?.assessment?.id;
          // Only update if we got a different ID (shouldn't happen, but safety check)
          if (newAssessmentId !== assessmentId) {
            setAssessmentId(newAssessmentId);
          }

          // IMPORTANT: Use the response data directly (it's already the updated assessment)
          // No need to fetch again - the backend returns the updated assessment
          const updatedAssessment = data.assessment;
          const isAptitude = updatedAssessment?.isAptitudeAssessment || false;

          console.log(
            `[Regenerate Topics] Updated topics from response:`,
            updatedAssessment.topics?.map((t: any) => t.topic),
          );
          console.log(
            `[Regenerate Topics] Total topics: ${updatedAssessment.topics?.length || 0}`,
          );

          // Update state immediately with new topics
          setTopics(updatedAssessment.topics.map((t: any) => t.topic));
          setAvailableQuestionTypes(data.questionTypes || QUESTION_TYPES);

          setTopicConfigs(
            updatedAssessment.topics.map((t: any) => {
              const isTopicAptitude =
                t.isAptitude === true ||
                (isAptitude && t.category === "aptitude");

              if (isTopicAptitude) {
                const availableSubTopics =
                  t.availableSubTopics || t.subTopics || [];
                const defaultSubTopic =
                  availableSubTopics.length > 0
                    ? availableSubTopics[0]
                    : undefined;
                const selectedSubTopic = t.subTopic || defaultSubTopic;

                let defaultQuestionType = "MCQ";
                if (
                  selectedSubTopic &&
                  t.aptitudeStructure?.subTopics?.[selectedSubTopic]
                ) {
                  const questionTypes =
                    t.aptitudeStructure.subTopics[selectedSubTopic];
                  defaultQuestionType =
                    questionTypes.length > 0 ? questionTypes[0] : "MCQ";
                }

                return {
                  topic: t.topic,
                  questionTypeConfigs: [
                    {
                      questionType: defaultQuestionType,
                      difficulty: t.difficulty || "Medium",
                      numQuestions: 1,
                    },
                  ],
                  isAptitude: true,
                  subTopic: selectedSubTopic,
                  aptitudeStructure: t.aptitudeStructure || undefined,
                  availableSubTopics: availableSubTopics,
                };
              } else {
                // Handle technical topic
                const questionType =
                  t.questionTypes?.[0] ||
                  data.questionTypes?.[0] ||
                  QUESTION_TYPES[0];
                const isCoding = questionType === "coding";
                // Auto-detect language for coding questions
                const autoLanguage = isCoding
                  ? getLanguageFromTopic(t.topic)
                  : undefined;

                return {
                  topic: t.topic,
                  questionTypeConfigs: [
                    {
                      questionType: questionType,
                      difficulty: t.difficulty || "Medium",
                      numQuestions: 1,
                      language: autoLanguage,
                      judge0_enabled: isCoding ? true : undefined,
                    },
                  ],
                  isAptitude: false,
                  coding_supported:
                    t.coding_supported !== undefined
                      ? t.coding_supported
                      : isCoding
                        ? true
                        : undefined,
                };
              }
            }),
          );
        }
        setLoading(false);
        // After generating topics in edit mode, navigate to Station 3 (skip Station 2)
        setCurrentStation(3);
        return;
      }

      // CREATE NEW: Do NOT pass assessmentId - backend will create a brand new draft
      // Only pass assessmentId if we're explicitly in edit mode

      // Convert selectedSkills (string[]) to combinedSkills (CombinedSkill[])
      const roleBasedSkills = selectedSkills
        .filter((skill) => topicCards.includes(skill))
        .map((skill) => ({
          skill_name: skill.trim(),
          source: "role" as const,
          description: null,
          importance_level: null,
        }));

      const manualSkills = selectedSkills
        .filter((skill) => !topicCards.includes(skill))
        .map((skill) => ({
          skill_name: skill.trim(),
          source: "manual" as const,
          description: null,
          importance_level: null,
        }));

      const combinedSkills = [...roleBasedSkills, ...manualSkills];

      const topicsResponse = await generateTopicsV2Mutation.mutateAsync({
        // Only pass assessmentId if in edit mode - for new assessments, always omit it
        assessmentId: isEditMode && assessmentId ? assessmentId : undefined,
        assessmentTitle: finalTitle.trim() || undefined,
        jobDesignation: jobDesignation.trim(),
        combinedSkills: combinedSkills,
        experienceMin: experienceMin,
        experienceMax: experienceMax,
        experienceMode: experienceMode,
      });

      if (topicsResponse?.success) {
        const topicsData = topicsResponse.data;
        const returnedAssessmentId = topicsData?.assessmentId;

        // Update assessmentId if we got one back (new draft created or existing found)
        if (returnedAssessmentId && returnedAssessmentId !== assessmentId) {
          setAssessmentId(returnedAssessmentId);
        }

        // Update topics_v2 in the assessment
        if (topicsData?.topics) {
          setTopicsV2(topicsData.topics);

          // ⭐ CRITICAL FIX: Initialize topicInputValues with topic labels
          const initialTopicInputValues: { [topicId: string]: string } = {};
          topicsData.topics.forEach((topic: TopicV2) => {
            if (topic.id && topic.label) {
              initialTopicInputValues[topic.id] = topic.label;
            }
          });
          setTopicInputValues(initialTopicInputValues);

          setFullTopicRegenLocked(false);
          setAllQuestionsGenerated(false);
        }

        // Fetch the updated assessment to get the full data
        const finalAssessmentId = returnedAssessmentId || assessmentId;
        if (finalAssessmentId) {
          // Use React Query hook to fetch assessment data
          await refetchQuestions();
          // Get assessment data from hook
          const fetchedAssessment =
            assessmentData || (questionsData as any)?.assessment;
          if (fetchedAssessment) {
            const isAptitude = fetchedAssessment?.isAptitudeAssessment || false;

            // Update old topics structure if needed (for backward compatibility)
            if (
              fetchedAssessment?.topics &&
              fetchedAssessment.topics.length > 0
            ) {
              setTopics(fetchedAssessment.topics.map((t: any) => t.topic));
              setAvailableQuestionTypes(
                fetchedAssessment.availableQuestionTypes || QUESTION_TYPES,
              );
            }
          }
        }

        // Navigate to Station 3 (skip Station 2)
        setHasVisitedConfigureStation(true);
        setCurrentStation(3);
      } else {
        setError("Failed to generate topics");
      }
    } catch (err: any) {
      console.error("Error generating topics:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to generate topics",
      );
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // NEW TOPIC V2 HANDLERS
  // ============================================

  const handleGenerateTopicsV2 = async () => {
    if (
      !assessmentId ||
      selectedSkills.length === 0 ||
      !jobDesignation.trim()
    ) {
      setError("Please complete Station 1 first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Convert selectedSkills (string[]) to combinedSkills (CombinedSkill[])
      const roleBasedSkills = selectedSkills
        .filter((skill) => topicCards.includes(skill))
        .map((skill) => ({
          skill_name: skill.trim(),
          source: "role" as const,
          description: null,
          importance_level: null,
        }));

      const manualSkills = selectedSkills
        .filter((skill) => !topicCards.includes(skill))
        .map((skill) => ({
          skill_name: skill.trim(),
          source: "manual" as const,
          description: null,
          importance_level: null,
        }));

      const combinedSkills = [...roleBasedSkills, ...manualSkills];

      const response = await generateTopicsV2Mutation.mutateAsync({
        assessmentId: assessmentId || undefined,
        assessmentTitle: finalTitle.trim() || undefined,
        jobDesignation: jobDesignation.trim(),
        combinedSkills: combinedSkills,
        experienceMin: experienceMin,
        experienceMax: experienceMax,
        experienceMode: experienceMode,
      });

      if (response?.success) {
        let generatedTopics = response.data?.topics || [];

        // Filter out topics that have coding questions but are not supported by Judge0
        generatedTopics = filterTopicsWithCoding(generatedTopics);

        setTopicsV2(generatedTopics);
        setFullTopicRegenLocked(false);
        setAllQuestionsGenerated(false);
        setHasVisitedConfigureStation(true);
        setCurrentStation(3);
      } else {
        setError("Failed to generate topics");
      }
    } catch (err: any) {
      console.error("Error generating topics:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to generate topics",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateTopicV2 = async (topicId: string) => {
    if (!assessmentId || fullTopicRegenLocked) {
      setError("Topic improvement is locked");
      return;
    }

    const topic = topicsV2.find((t) => t.id === topicId);
    if (!topic || topic.locked) {
      setError("Topic is locked and cannot be improved");
      return;
    }

    // Disable regenerate for custom topics once they have generated questions
    // Custom topics are identified by having only one questionRow with questionsCount: 1
    const isCustomTopic =
      topic.questionRows.length === 1 &&
      topic.questionRows[0].questionsCount === 1 &&
      topic.questionRows.some(
        (row) =>
          row.questions &&
          row.questions.length > 0 &&
          row.status === "generated",
      );

    if (isCustomTopic) {
      setError(
        "Custom topics cannot be improved. Use the Preview button on the question row to regenerate individual questions.",
      );
      return;
    }

    setGeneratingRowId(topicId); // Reuse this state for topic regeneration
    setError(null);

    try {
      // Get previous topic label
      const previousTopicLabel = topic.label || "";
      if (!previousTopicLabel) {
        setError("Topic label is missing");
        return;
      }

      // Get topic source (default to "manual" if not set, map "ai" to "manual")
      const rawSource = topic.source || "manual";
      const topicSource =
        rawSource === "ai" || !["role", "manual", "csv"].includes(rawSource)
          ? "manual"
          : (rawSource as "role" | "manual" | "csv");

      // Reconstruct skill metadata based on source
      let skillMetadataProvided: any = undefined;

      if (topicSource === "csv") {
        // Try to find skill from CSV data
        const csvSkill = csvData.find(
          (row) =>
            row.skill_name.toLowerCase().trim() ===
              previousTopicLabel.toLowerCase().trim() ||
            previousTopicLabel
              .toLowerCase()
              .includes(row.skill_name.toLowerCase().trim()),
        );
        if (csvSkill) {
          skillMetadataProvided = {
            skill_name: csvSkill.skill_name,
            description: csvSkill.skill_description,
            importance_level: csvSkill.importance_level,
          };
        }
      } else if (topicSource === "role") {
        // For role-based, try to find in selectedSkills
        const matchingSkill = selectedSkills.find(
          (skill) =>
            skill.toLowerCase().trim() ===
              previousTopicLabel.toLowerCase().trim() ||
            previousTopicLabel
              .toLowerCase()
              .includes(skill.toLowerCase().trim()),
        );
        if (matchingSkill) {
          skillMetadataProvided = {
            skill_name: matchingSkill,
          };
        }
      }

      // Check if topic has coding questions - if so, verify it's supported by Judge0
      const hasCodingQuestions = topic.questionRows.some(
        (row) => row.questionType === "Coding",
      );

      if (hasCodingQuestions && !isJudge0Supported(previousTopicLabel)) {
        setError(
          `Cannot regenerate topic "${previousTopicLabel}" - it contains coding questions but is not supported by Judge0. Please use a different topic or change the question type.`,
        );
        setGeneratingRowId(null);
        return;
      }

      // Filter skill metadata if it contains unsupported frameworks and topic has coding questions
      if (
        hasCodingQuestions &&
        skillMetadataProvided &&
        !isJudge0Supported(skillMetadataProvided.skill_name)
      ) {
        setError(
          `Cannot regenerate topic "${previousTopicLabel}" - the related skill "${skillMetadataProvided.skill_name}" is not supported by Judge0 for coding questions.`,
        );
        setGeneratingRowId(null);
        return;
      }

      const response = await improveTopicMutation.mutateAsync({
        assessmentId: assessmentId || "",
        topicId: topicId,
        previousTopicLabel: previousTopicLabel,
        experienceMode: experienceMode,
        experienceMin: experienceMin,
        experienceMax: experienceMax,
        source: topicSource,
        skillMetadataProvided: skillMetadataProvided,
      });

      if (response?.success) {
        const responseData = response.data;
        const updatedTopicLabel =
          responseData?.updatedTopicLabel || responseData?.topic?.label;

        // Check if the updated topic has coding questions and is supported by Judge0
        if (updatedTopicLabel) {
          const updatedTopic = topicsV2.find((t) => t.id === topicId);
          const hasCodingQuestions =
            updatedTopic?.questionRows.some(
              (row) => row.questionType === "Coding",
            ) || false;

          // If topic has coding questions, verify the updated label is supported
          if (hasCodingQuestions && !isJudge0Supported(updatedTopicLabel)) {
            setError(
              `Cannot update topic to "${updatedTopicLabel}" - it contains coding questions but is not supported by Judge0.`,
            );
            setGeneratingRowId(null);
            return;
          }
        }

        if (updatedTopicLabel) {
          // Update only the label, preserve everything else
          setTopicsV2((prev) =>
            prev.map((t) => {
              if (t.id === topicId) {
                const previousVersions = t.previousVersion || [];
                const currentLabel = t.label;
                if (!previousVersions.includes(currentLabel)) {
                  previousVersions.push(currentLabel);
                }
                return {
                  ...t,
                  label: updatedTopicLabel,
                  regenerated: true,
                  previousVersion: previousVersions,
                  status: "regenerated" as const, // Set status to "regenerated" so questions will be regenerated
                };
              }
              return t;
            }),
          );

          // Also update topicInputValues to reflect the new label in the input field
          setTopicInputValues((prev) => ({
            ...prev,
            [topicId]: updatedTopicLabel,
          }));
        } else {
          console.error("No updatedTopicLabel in response:", response.data);
          setError("Failed to get improved topic label");
        }
      } else {
        setError("Failed to improve topic");
      }
    } catch (err: any) {
      console.error("Error improving topic:", err);
      setError(
        err.response?.data?.message || err.message || "Failed to improve topic",
      );
    } finally {
      setGeneratingRowId(null);
    }
  };

  // Preview functionality removed - handlePreviewRow and handlePreviewAllQuestionsV2 functions removed

  // ============================================================================
  // PART 2: REGENERATION LOGIC FOR ALL QUESTION TYPES (INCLUDING CODING)
  // ============================================================================
  const handleRegenerateRow = async (topicId: string, rowId: string) => {
    if (!assessmentId) {
      setError("Assessment ID is required");
      return;
    }

    const topic = topicsV2.find((t) => t.id === topicId);
    if (!topic) {
      setError("Topic not found");
      return;
    }

    const row = topic.questionRows.find((r) => r.rowId === rowId);
    if (!row) {
      setError("Question row not found");
      return;
    }

    // PART 7: Regeneration disable conditions
    // Check if assessment is locked or attempts started
    if (topic.locked && row.locked) {
      setError("This row is locked and cannot be regenerated");
      return;
    }

    setGeneratingRowId(rowId);
    setError(null);

    try {
      // PART 2: Regeneration behavior
      // 1. Delete ONLY that row's existing question
      // 2. Set row.status = "pending"
      // 3. Call generate-question API for THIS row ONLY
      // 4. Replace old question object with newly generated content
      // 5. Update UI immediately

      // Step 1 & 2: Delete existing questions and set status to pending
      // Also set topic status to "regenerated" so it will regenerate questions
      const updatedTopics = topicsV2.map((t) => {
        if (t.id === topicId) {
          return {
            ...t,
            status: "regenerated" as const, // Set topic status to "regenerated"
            questionRows: t.questionRows.map((r) => {
              if (r.rowId === rowId) {
                return {
                  ...r,
                  questions: [], // Delete existing questions
                  status: "pending" as const, // Set to pending
                  locked: false, // Unlock row for regeneration
                };
              }
              return r;
            }),
          };
        }
        return t;
      });
      setTopicsV2(updatedTopics);

      // Step 3: Generate new question for this row ONLY
      const response = await generateQuestionMutation.mutateAsync({
        assessmentId: assessmentId || "",
        topicId: topicId,
        rowId: rowId,
        topicLabel: topic.label,
        questionType: row.questionType,
        difficulty: row.difficulty,
        questionsCount: row.questionsCount,
        canUseJudge0: row.canUseJudge0 || false,
        category: topic.category || "technical",
        experienceMin: experienceMin,
        experienceMax: experienceMax,
        experienceMode: experienceMode,
        additionalRequirements: row.additionalRequirements || undefined,
      });

      if (response?.success) {
        const updatedRow = response.data?.row;
        const updatedTopic = response.data?.topic;

        // Step 4 & 5: Replace old question and update UI immediately
        const finalTopics = updatedTopics.map((t) => {
          if (t.id === topicId) {
            const updatedRows = t.questionRows.map((r) => {
              if (r.rowId === rowId) {
                return {
                  ...updatedRow,
                  status: "generated" as const, // Mark as generated after regeneration
                };
              }
              return r;
            });

            // Check if all rows have generated questions
            const allRowsGenerated = updatedRows.every(
              (r) =>
                r.status === "generated" &&
                r.questions &&
                r.questions.length > 0,
            );

            return {
              ...t,
              questionRows: updatedRows,
              status: allRowsGenerated
                ? ("generated" as const)
                : t.status || "pending", // Update topic status
            };
          }
          return t;
        });

        setTopicsV2(finalTopics);

        // Update draft
        if (assessmentId) {
          try {
            await updateDraftMutation.mutateAsync({
              assessmentId,
              topics_v2: finalTopics,
            });
          } catch (err: any) {
            console.error("Error saving draft after regeneration:", err);
          }
        }

        // Preview modal removed - no longer updating preview state
      } else {
        setError(response.data?.message || "Failed to regenerate question");
      }
    } catch (err: any) {
      console.error("Error regenerating row:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to regenerate question",
      );
    } finally {
      setGeneratingRowId(null);
    }
  };

  // Auto-generate all pending questions when moving to Review Questions
  // ONLY generates for topics with status "pending" or "regenerated"
  // NEVER regenerates topics with status "generated" or "completed"
  const handleNextToReviewQuestions = async () => {
    console.log("🚀 ========== QUESTION GENERATION START ==========");
    console.log("📋 Assessment ID:", assessmentId);
    console.log("📊 Total topics configured:", topicsV2?.length || 0);
    
    if (!assessmentId) {
      console.error("❌ ERROR: Assessment ID is required");
      setError("Assessment ID is required");
      return;
    }

    if (!topicsV2 || topicsV2.length === 0) {
      console.error("❌ ERROR: No topics configured");
      setError("Please configure at least one topic");
      return;
    }

    // Find topics that need question generation (ONLY pending or regenerated)
    const topicsToGenerate: Array<{
      topic: TopicV2;
      rows: Array<{ rowId: string; row: QuestionRow }>;
    }> = [];

    console.log("🔍 Analyzing topics for generation...");
    topicsV2.forEach((topic, index) => {
      const topicStatus = topic.status || "pending";
      console.log(`  Topic ${index + 1}: "${topic.label}" - Status: ${topicStatus}`);

      // ONLY generate for topics with status "pending" or "regenerated"
      // SKIP topics with status "generated" or "completed"
      if (topicStatus === "pending" || topicStatus === "regenerated") {
        const rowsToGenerate: Array<{ rowId: string; row: QuestionRow }> = [];

        topic.questionRows.forEach((row, rowIndex) => {
          // Only generate for rows that don't have questions or are pending
          const needsGeneration =
            row.status === "pending" ||
            !row.questions ||
            row.questions.length === 0;

          console.log(`    Row ${rowIndex + 1}: ${row.questionType} (${row.difficulty}) - Count: ${row.questionsCount} - Needs generation: ${needsGeneration} - Locked: ${row.locked || false}`);

          if (needsGeneration && !row.locked) {
            rowsToGenerate.push({
              rowId: row.rowId,
              row,
            });
          }
        });

        if (rowsToGenerate.length > 0) {
          console.log(`  ✅ Topic "${topic.label}" has ${rowsToGenerate.length} rows to generate`);
          topicsToGenerate.push({
            topic,
            rows: rowsToGenerate,
          });
        } else {
          console.log(`  ⏭️  Topic "${topic.label}" - All rows already generated or locked`);
        }
      } else {
        console.log(`  ⏭️  Topic "${topic.label}" - Skipped (status: ${topicStatus})`);
      }
    });

    console.log(`\n📈 Summary: ${topicsToGenerate.length} topics need generation`);

    if (topicsToGenerate.length === 0) {
      console.log("✅ All topics already have questions generated, moving to Review station");
      // All topics already have questions generated, just move to Review station
      setCurrentStation(4.5);
      return;
    }

    // Generate questions for all pending/regenerated topics
    setGeneratingAllQuestions(true);
    setError(null);

    // ✅ SPEED OPTIMIZATION: Calculate total tasks for progress tracking
    const totalTasks = topicsToGenerate.reduce(
      (sum, { rows }) => sum + rows.length,
      0,
    );
    
    console.log(`\n🎯 Total question rows to generate: ${totalTasks}`);
    console.log(`⚡ Concurrency limit: 5 parallel requests`);
    console.log(`🔄 Max retries per row: 3`);
    
    setGenerationProgress({
      total: totalTasks,
      completed: 0,
      failed: 0,
      currentTopic: "",
      currentQuestionType: "",
      estimatedTimeRemaining: totalTasks * 3, // ~3 seconds per question initial estimate
    });
    setShowGenerationSkeleton(true);

    const startTime = Date.now();
    console.log(`⏰ Generation started at: ${new Date(startTime).toISOString()}\n`);

    try {
      // ✅ SPEED OPTIMIZATION: Parallel generation with concurrency limit (3)
      // Reduced from 5 to 3 to prevent OpenAI API timeout/cancellation issues
      const CONCURRENCY_LIMIT = 3;

      // Create all tasks
      const allTasks: Array<{
        topic: TopicV2;
        rowId: string;
        row: QuestionRow;
        task: () => Promise<any>;
      }> = [];

      for (const { topic, rows } of topicsToGenerate) {
        for (const { rowId, row } of rows) {
          allTasks.push({
            topic,
            rowId,
            row,
            task: async () => {
              console.log(`\n🔨 Generating: "${topic.label}" > ${row.questionType} (${row.difficulty}) - ${row.questionsCount} questions`);
              let retries = 0;
              const maxRetries = 3;
              const baseDelay = 1000; // 1 second

              while (retries <= maxRetries) {
                try {
                  console.log(`  📤 API Call attempt ${retries + 1}/${maxRetries + 1}...`);
                  const response = await generateQuestionMutation.mutateAsync({
                    assessmentId: assessmentId || "",
                    topicId: topic.id,
                    rowId: rowId,
                    topicLabel: topic.label,
                    questionType: row.questionType,
                    difficulty: row.difficulty,
                    questionsCount: row.questionsCount,
                    canUseJudge0: row.canUseJudge0 || false,
                    category: topic.category || "technical",
                    experienceMin: experienceMin,
                    experienceMax: experienceMax,
                    experienceMode: experienceMode,
                    additionalRequirements:
                      row.additionalRequirements || undefined,
                  });

                  if (response?.success) {
                    console.log(`  ✅ SUCCESS: Generated ${response.data?.row?.questions?.length || 0} questions`);
                    return {
                      success: true,
                      topic,
                      rowId,
                      row,
                      response: response,
                    };
                  } else {
                    console.error(`  ❌ FAILED: Response not successful`, response);
                    throw new Error(
                      `Failed to generate questions for topic ${topic.label}, row ${rowId}`,
                    );
                  }
                } catch (err: any) {
                  console.error(`  ⚠️  ERROR on attempt ${retries + 1}:`, err.message);
                  console.error(`     Status: ${err.response?.status || 'N/A'}`);
                  console.error(`     Error code: ${err.code || 'N/A'}`);
                  
                  // ✅ SPEED OPTIMIZATION: Automatic backoff for rate limiting
                  if (
                    err.response?.status === 429 ||
                    err.response?.status === 503
                  ) {
                    // Rate limit hit - exponential backoff
                    if (retries < maxRetries) {
                      const delay = baseDelay * Math.pow(2, retries);
                      console.warn(
                        `  🔄 Rate limit hit for ${topic.label}/${rowId}, retrying in ${delay}ms...`,
                      );
                      await new Promise((resolve) =>
                        setTimeout(resolve, delay),
                      );
                      retries++;
                      continue;
                    }
                  }

                  // Other errors or max retries reached
                  if (retries < maxRetries) {
                    const delay = baseDelay * Math.pow(2, retries);
                    console.warn(`  🔄 Retrying in ${delay}ms...`);
                    await new Promise((resolve) => setTimeout(resolve, delay));
                    retries++;
                  } else {
                    console.error(`  ❌ MAX RETRIES REACHED - Giving up on this row`);
                    throw err;
                  }
                }
              }

              console.error(`  ❌ FINAL FAILURE: Max retries reached without success`);
              return {
                success: false,
                topic,
                rowId,
                row,
                error: "Max retries reached",
              };
            },
          });
        }
      }

      // ✅ SPEED OPTIMIZATION: Execute tasks with concurrency limit using batch processing
      let completedCount = 0;
      let failedCount = 0;

      const processBatch = async (batch: typeof allTasks) => {
        return Promise.allSettled(
          batch.map(async (taskData) => {
            try {
              // Update current task before starting
              setGenerationProgress((prev) => ({
                ...prev,
                currentTopic: taskData.topic.label,
                currentQuestionType: taskData.row.questionType,
              }));

              const result = await taskData.task();

              // Calculate time-based progress
              const elapsed = (Date.now() - startTime) / 1000;
              const processed = completedCount + failedCount + 1;
              const avgTimePerQuestion =
                processed > 0 ? elapsed / processed : 3;
              const remaining = totalTasks - processed;

              if (result.success) {
                completedCount++;
                const { topic, rowId, row, response } = result;
                const updatedRow = response.data.row;

                // Add timer to each question if not present
                if (
                  updatedRow.questions &&
                  Array.isArray(updatedRow.questions)
                ) {
                  updatedRow.questions = updatedRow.questions.map((q: any) => {
                    if (!q.timer) {
                      // Calculate timer based on question type and difficulty
                      const baseTime = getBaseTimePerQuestion(row.questionType);
                      const multiplier = getDifficultyMultiplier(
                        row.difficulty,
                      );
                      let questionTime = baseTime * multiplier;

                      // Cap MCQ questions at 40 seconds maximum
                      if (row.questionType === "MCQ" && questionTime > 40) {
                        questionTime = 40;
                      }

                      // Convert to minutes (minimum 1 minute)
                      q.timer = Math.max(1, Math.ceil(questionTime / 60));
                    }
                    // Initialize oldVersions if not present
                    if (!q.oldVersions) {
                      q.oldVersions = [];
                    }
                    return q;
                  });
                }

                // Update the topic in state
                setTopicsV2((prev) =>
                  prev.map((t) =>
                    t.id === topic.id
                      ? {
                          ...t,
                          questionRows: t.questionRows.map((r) =>
                            r.rowId === rowId ? updatedRow : r,
                          ),
                          // Update topic status to "generated" after successful generation
                          status: "generated" as const,
                        }
                      : t,
                  ),
                );
              } else {
                failedCount++;
                console.error(
                  `  ❌ FAILED: Topic "${result.topic.label}", row ${result.rowId} - Error: ${result.error || 'Unknown'}`,
                );
              }

              // Update progress with all metrics
              setGenerationProgress((prev) => ({
                ...prev,
                completed: completedCount,
                failed: failedCount,
                estimatedTimeRemaining: Math.max(
                  0,
                  Math.ceil(avgTimePerQuestion * remaining),
                ),
              }));

              return result;
            } catch (err) {
              failedCount++;
              const elapsed = (Date.now() - startTime) / 1000;
              const processed = completedCount + failedCount;
              const avgTimePerQuestion =
                processed > 0 ? elapsed / processed : 3;
              const remaining = totalTasks - processed;

              setGenerationProgress((prev) => ({
                ...prev,
                completed: completedCount,
                failed: failedCount,
                estimatedTimeRemaining: Math.max(
                  0,
                  Math.ceil(avgTimePerQuestion * remaining),
                ),
              }));

              console.error(
                `  ❌ EXCEPTION: Topic "${taskData.topic.label}", row ${taskData.rowId}:`,
                err,
              );
              return {
                success: false,
                topic: taskData.topic,
                rowId: taskData.rowId,
                error: err,
              };
            }
          }),
        );
      };

      // Process tasks in batches with concurrency limit
      console.log(`\n🔄 Processing ${allTasks.length} tasks in batches of ${CONCURRENCY_LIMIT}...`);
      for (let i = 0; i < allTasks.length; i += CONCURRENCY_LIMIT) {
        const batch = allTasks.slice(i, i + CONCURRENCY_LIMIT);
        const batchNumber = Math.floor(i / CONCURRENCY_LIMIT) + 1;
        const totalBatches = Math.ceil(allTasks.length / CONCURRENCY_LIMIT);
        console.log(`\n📦 Batch ${batchNumber}/${totalBatches} - Processing ${batch.length} tasks...`);
        await processBatch(batch);
        console.log(`✅ Batch ${batchNumber}/${totalBatches} completed - Success: ${completedCount}, Failed: ${failedCount}`);
      }

      // Save draft after generation with updated statuses
      if (assessmentId) {
        // Reconstruct combinedSkills from current state (same logic as handleGenerateTopicsUnified)
        const roleBasedSkills = selectedSkills
          .filter((skill) => topicCards.includes(skill))
          .map((skill) => ({
            skill_name: skill.trim(),
            source: "role" as const,
            description: null,
            importance_level: null,
          }));

        const manualSkills = selectedSkills
          .filter((skill) => !topicCards.includes(skill))
          .map((skill) => ({
            skill_name: skill.trim(),
            source: "manual" as const,
            description: null,
            importance_level: null,
          }));

        const csvSkills = csvData.map((row) => ({
          skill_name: row.skill_name.trim(),
          source: "csv" as const,
          description: row.skill_description || null,
          importance_level: row.importance_level || null,
        }));

        const allSkills = [...roleBasedSkills, ...manualSkills, ...csvSkills];
        const seen = new Set<string>();
        const combinedSkills = allSkills.filter((skill) => {
          const normalized = skill.skill_name.toLowerCase().trim();
          if (seen.has(normalized)) {
            return false;
          }
          seen.add(normalized);
          return true;
        });

        await updateDraftMutation.mutateAsync({
          assessmentId: assessmentId || undefined,
          draft: {
            topics_v2: topicsV2.map((t) => {
              const topicToGen = topicsToGenerate.find(
                (tg) => tg.topic.id === t.id,
              );
              if (topicToGen) {
                return {
                  ...t,
                  status: "generated" as const,
                  questionRows: t.questionRows.map((r) => {
                    const rowUpdate = topicToGen.rows.find(
                      (ru) => ru.rowId === r.rowId,
                    );
                    return rowUpdate
                      ? { ...r, status: "generated" as const }
                      : r;
                  }),
                };
              }
              return t;
            }),
            combinedSkills: combinedSkills,
            experienceMode: experienceMode,
            experienceMin: experienceMin,
            experienceMax: experienceMax,
          },
        });
      }

      // Hide skeleton and move to Review Generated Questions station
      const endTime = Date.now();
      const totalTime = ((endTime - startTime) / 1000).toFixed(2);
      
      console.log(`\n🏁 ========== QUESTION GENERATION COMPLETE ==========`);
      console.log(`⏱️  Total time: ${totalTime} seconds`);
      console.log(`✅ Successfully generated: ${completedCount}/${totalTasks} rows`);
      console.log(`❌ Failed: ${failedCount}/${totalTasks} rows`);
      console.log(`📊 Success rate: ${((completedCount / totalTasks) * 100).toFixed(1)}%`);
      
      if (failedCount > 0) {
        console.warn(`\n⚠️  WARNING: ${failedCount} question rows failed to generate`);
        console.warn(`   You may need to regenerate these manually or try again`);
      }
      
      console.log(`\n🎯 Navigating to Station 4.5 (Review Generated Questions)`);
      console.log(`====================================================\n`);
      
      setShowGenerationSkeleton(false);
      setCurrentStation(4.5);
    } catch (err: any) {
      console.error("\n❌ ========== GENERATION ERROR ==========");
      console.error("Error details:", err);
      console.error("Error message:", err.message);
      console.error("Error response:", err.response?.data);
      console.error("=========================================\n");
      
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to generate some questions. Please try again.",
      );
      setShowGenerationSkeleton(false);
    } finally {
      setGeneratingAllQuestions(false);
      console.log("🔚 Question generation process ended\n");
    }
  };

  const handleRegenerateAllTopicsV2 = async () => {
    // Check if any topics have generated questions - if so, disable regenerate all
    const hasGeneratedQuestions = topicsV2.some(
      (topic) =>
        topic.status === "generated" ||
        topic.status === "completed" ||
        topic.questionRows.some(
          (row) =>
            row.questions &&
            row.questions.length > 0 &&
            row.status === "generated",
        ),
    );

    if (
      !assessmentId ||
      fullTopicRegenLocked ||
      allQuestionsGenerated ||
      hasGeneratedQuestions
    ) {
      setError(
        "Topic improvement is locked after questions have been generated. Use 'Regenerate Topic' for individual topics.",
      );
      return;
    }

    if (topicsV2.length === 0) {
      setError("No topics to improve");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Reconstruct combinedSkills for context
      const roleBasedSkills = topicCards.map((skill) => ({
        skill_name: skill.trim(),
        source: "role" as const,
        description: null,
        importance_level: null,
      }));

      const manualSkills = selectedSkills
        .filter((skill) => !topicCards.includes(skill))
        .map((skill) => ({
          skill_name: skill.trim(),
          source: "manual" as const,
          description: null,
          importance_level: null,
        }));

      const csvSkills = csvData.map((row) => ({
        skill_name: row.skill_name.trim(),
        source: "csv" as const,
        description: row.skill_description || null,
        importance_level: row.importance_level || null,
      }));

      const allSkills = [...roleBasedSkills, ...manualSkills, ...csvSkills];
      const seen = new Set<string>();
      let combinedSkills = allSkills.filter((skill) => {
        const normalized = skill.skill_name.toLowerCase().trim();
        if (seen.has(normalized)) {
          return false;
        }
        seen.add(normalized);
        return true;
      });

      // Filter out unsupported frameworks from skills (since coding questions might be regenerated)
      combinedSkills = filterUnsupportedSkills(combinedSkills);

      // Build previousTopics array with topic info
      // Filter out topics that have coding questions but are not supported by Judge0
      const previousTopics = topicsV2
        .filter((topic) => !topic.locked) // Skip locked topics
        .filter((topic) => {
          // If topic has coding questions, check if it's supported by Judge0
          const hasCodingQuestions = topic.questionRows.some(
            (row) => row.questionType === "Coding",
          );
          if (hasCodingQuestions) {
            return isJudge0Supported(topic.label);
          }
          return true; // Keep topics without coding questions
        })
        .map((topic) => {
          // Try to find related skill
          let relatedSkill: string | undefined = undefined;
          const rawSource = topic.source || "manual";
          const topicSource =
            rawSource === "ai" || !["role", "manual", "csv"].includes(rawSource)
              ? "manual"
              : (rawSource as "role" | "manual" | "csv");

          if (topicSource === "csv") {
            const csvSkill = csvData.find(
              (row) =>
                row.skill_name.toLowerCase().trim() ===
                  topic.label.toLowerCase().trim() ||
                topic.label
                  .toLowerCase()
                  .includes(row.skill_name.toLowerCase().trim()),
            );
            relatedSkill = csvSkill?.skill_name;
          } else if (topicSource === "role") {
            const matchingSkill = selectedSkills.find(
              (skill) =>
                skill.toLowerCase().trim() ===
                  topic.label.toLowerCase().trim() ||
                topic.label.toLowerCase().includes(skill.toLowerCase().trim()),
            );
            relatedSkill = matchingSkill;
          } else {
            // For manual, try to find in selectedSkills
            const matchingSkill = selectedSkills.find(
              (skill) =>
                skill.toLowerCase().trim() ===
                  topic.label.toLowerCase().trim() ||
                topic.label.toLowerCase().includes(skill.toLowerCase().trim()),
            );
            relatedSkill = matchingSkill;
          }

          return {
            topicId: topic.id,
            previousTopicLabel: topic.label,
            source: topicSource,
            relatedSkill: relatedSkill,
          };
        });

      if (previousTopics.length === 0) {
        setError("No topics available to improve");
        return;
      }

      const response = await improveAllTopicsMutation.mutateAsync({
        assessmentId: assessmentId || "",
        experienceMode: experienceMode,
        experienceMin: experienceMin,
        experienceMax: experienceMax,
        previousTopics: previousTopics,
        combinedSkills: combinedSkills.length > 0 ? combinedSkills : undefined,
      });

      if (response?.success) {
        let updatedTopics = response.data?.topics || topicsV2;

        // Filter out topics that have coding questions but are not supported by Judge0
        updatedTopics = filterTopicsWithCoding(updatedTopics);

        // Update topics with improved labels, preserve everything else
        setTopicsV2((prev) =>
          prev.map((topic) => {
            const updated = updatedTopics.find((ut: any) => ut.id === topic.id);
            if (updated) {
              return {
                ...topic,
                label: updated.label,
                regenerated: true,
                previousVersion: updated.previousVersion || [],
              };
            }
            return topic;
          }),
        );
      } else {
        setError("Failed to improve topics");
      }
    } catch (err: any) {
      console.error("Error improving topics:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to improve topics",
      );
    } finally {
      setLoading(false);
    }
  };

  // OLD: Keep for backward compatibility with existing UI
  const [selectedCategoryForNewTopic, setSelectedCategoryForNewTopic] =
    useState<"aptitude" | "communication" | "logical_reasoning" | null>(null);
  const [showTechnicalInput, setShowTechnicalInput] = useState(false);

  // NEW: Redesigned Add Custom Topic states (for future use)
  const [selectedCategory, setSelectedCategory] = useState<
    "aptitude" | "communication" | "logical" | "technical" | null
  >(null);
  const [topicInput, setTopicInput] = useState("");
  const [isAddingTopicNew, setIsAddingTopicNew] = useState(false);
  const [aiValidationResult, setAiValidationResult] = useState<{
    isValid: boolean;
    reason: string;
    suggestions: string[];
  } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [validationDebounceTimerNew, setValidationDebounceTimerNew] =
    useState<NodeJS.Timeout | null>(null);

  // Helper function to determine default question type based on category and topic name
  const getDefaultQuestionType = async (
    topicName: string,
    category: "aptitude" | "communication" | "logical_reasoning",
  ): Promise<"MCQ" | "Subjective"> => {
    // For communication, default to Subjective
    if (category === "communication") {
      return "Subjective";
    }

    // For aptitude and logical reasoning, try to determine based on semantic meaning
    try {
      const response = await generateTopicContextMutation.mutateAsync({
        topicName: topicName.trim(),
        category: category,
      });

      if (response?.success && response.data?.suggestedQuestionType) {
        return response.data.suggestedQuestionType as "MCQ" | "Subjective";
      }
    } catch (err) {
      console.error("Error getting suggested question type:", err);
    }

    // Default fallbacks
    if (category === "aptitude") {
      // Check if topic suggests numeric calculations
      const numericKeywords = [
        "percentage",
        "ratio",
        "profit",
        "loss",
        "interest",
        "average",
        "mixture",
        "number",
      ];
      const isNumeric = numericKeywords.some((keyword) =>
        topicName.toLowerCase().includes(keyword),
      );
      return isNumeric ? "MCQ" : "Subjective";
    }

    if (category === "logical_reasoning") {
      // Check if topic suggests puzzles/patterns
      const puzzleKeywords = [
        "puzzle",
        "pattern",
        "sequence",
        "arrangement",
        "coding",
        "decoding",
      ];
      const isPuzzle = puzzleKeywords.some((keyword) =>
        topicName.toLowerCase().includes(keyword),
      );
      return isPuzzle ? "MCQ" : "Subjective";
    }

    return "MCQ"; // Final fallback
  };

  // Helper function to generate UUID-like ID
  const generateId = () => {
    return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Ref for the custom topic input field
  const customTopicInputRef = useRef<HTMLInputElement>(null);
  // Ref for suggestions container (input + dropdown)
  const suggestionsContainerRef = useRef<HTMLDivElement>(null);

  // Handler for suggestion clicks - fills input field only (user must click Add button manually)
  const handleSuggestionClick = (suggestion: string) => {
    console.log(
      "Suggestion clicked:",
      suggestion,
      "Category:",
      selectedCategoryForNewTopic,
    ); // Debug log

    // Just fill the input field with the suggestion
    setCustomTopicInputV2(suggestion);

    // Mark as valid since it's an AI-generated suggestion (skip validation)
    setIsTopicValid(true);
    setTopicValidationError(null);

    // Close suggestions dropdown and reset fetched flag
    setShowAiSuggestions(false);
    setAiTopicSuggestions([]);
    setSuggestionsFetched(false); // Reset so suggestions can be fetched again if user edits

    // Focus the input field and move cursor to end
    setTimeout(() => {
      if (customTopicInputRef.current) {
        customTopicInputRef.current.focus();
        const length = suggestion.length;
        customTopicInputRef.current.setSelectionRange(length, length);
      }
    }, 50);

    // User must now manually click the "Add" button to actually add the topic
  };

  // Validate topic category with debouncing
  const validateTopicCategory = async (topic: string, category: string) => {
    if (!topic || !topic.trim() || !category) {
      setIsTopicValid(null);
      setTopicValidationError(null);
      return;
    }

    setValidatingTopic(true);
    setTopicValidationError(null);

    try {
      const response = await validateTopicCategoryMutation.mutateAsync({
        topic: topic.trim(),
        category: category,
      });

      if (response?.success && response.data) {
        const validationResult = response.data;
        if (validationResult.valid) {
          setIsTopicValid(true);
          setTopicValidationError(null);
        } else {
          setIsTopicValid(false);
          setTopicValidationError(
            validationResult.error ||
              "The entered topic does not match the selected category. Please enter a valid topic.",
          );
        }
      } else {
        setIsTopicValid(false);
        setTopicValidationError("Unable to validate topic. Please try again.");
      }
    } catch (err: any) {
      console.error("Error validating topic category:", err);
      setIsTopicValid(false);
      setTopicValidationError(
        err.response?.data?.data?.error ||
          "Unable to validate topic. Please try again.",
      );
    } finally {
      setValidatingTopic(false);
    }
  };

  // Debounced validation handler
  const handleTopicInputChange = (value: string) => {
    setCustomTopicInputV2(value);
    setIsTopicValid(null);
    setTopicValidationError(null);

    // Clear existing timer
    if (topicValidationTimer) {
      clearTimeout(topicValidationTimer);
    }

    // Only validate if category is selected and topic has content
    if (selectedCategoryForNewTopic && value.trim().length > 0) {
      const timer = setTimeout(() => {
        validateTopicCategory(value.trim(), selectedCategoryForNewTopic);
      }, 150); // 150ms debounce
      setTopicValidationTimer(timer);
    }
  };

  // Helper function to check if topic is technical using OpenAI API (fast, low-token model)
  const checkIfTechnicalTopic = async (topic: string): Promise<boolean> => {
    if (!topic || !topic.trim()) return false;

    try {
      const response = await checkTechnicalTopicMutation.mutateAsync({
        topic: topic.trim(),
      });

      if (response?.success && response.data) {
        return response.data.isTechnical || false;
      }
      return false; // Default to false on API error
    } catch (err: any) {
      console.error("Error checking if topic is technical:", err);
      return false; // Default to false on error to allow backend validation to catch it
    }
  };

  // Helper function to reset UI state on validation failure
  const resetUIOnValidationFailure = (errorMessage: string) => {
    setAddingTopic(false);
    setValidatingTopic(false);
    setIsTopicValid(false);
    setTopicValidationError(errorMessage);
    setCustomTopicInputV2(""); // Clear input field
    setShowAiSuggestions(false);
    setAiTopicSuggestions([]);
    setSuggestionsFetched(false); // Reset fetched flag
    setToastMessage(errorMessage);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Separate handler for soft-skill topics to ensure immediate UI update
  const handleAddSoftSkillTopic = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault(); // REQUIRED: Prevent form refresh
      e.stopPropagation(); // Prevent event bubbling
    }

    // Prevent multiple simultaneous additions
    if (addingTopic) {
      return;
    }

    const topicName = customTopicInputV2.trim();
    if (!topicName) return;

    // Check for duplicate topic names (case-insensitive)
    const topicExists = topicsV2.some(
      (t) => t.label.toLowerCase() === topicName.toLowerCase(),
    );
    if (topicExists) {
      setToastMessage("Topic already added.");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }

    // Must have a soft skill category selected
    if (!selectedCategoryForNewTopic) {
      return; // Don't add if no category selected
    }

    const finalCategory = selectedCategoryForNewTopic;

    // Set loading state
    setAddingTopic(true);

    // CLIENT-SIDE VALIDATION: Check if topic is technical using OpenAI (fast, low-token model)
    try {
      const isTechnical = await checkIfTechnicalTopic(topicName);
      if (isTechnical) {
        const errorMsg =
          "Invalid topic for selected category. Please enter only aptitude/communication/logical reasoning topics. Technical topics are not allowed.";
        resetUIOnValidationFailure(errorMsg);
        return;
      }
    } catch (err: any) {
      console.error("Error checking if topic is technical:", err);
      // Continue to backend validation if AI check fails
    }

    // Validate topic before adding
    if (isTopicValid === false || validatingTopic) {
      if (validatingTopic) {
        setToastMessage("Please wait for validation to complete.");
        setTimeout(() => setToastMessage(null), 3000);
        setAddingTopic(false);
      } else if (topicValidationError) {
        resetUIOnValidationFailure(topicValidationError);
      }
      return;
    }

    // If validation hasn't been done yet, do it now
    if (isTopicValid === null) {
      setValidatingTopic(true);
      try {
        const validationResponse =
          await validateTopicCategoryMutation.mutateAsync({
            topic: topicName.trim(),
            category: finalCategory,
          });

        if (validationResponse?.success && validationResponse.data) {
          const validationResult = validationResponse.data;
          if (!validationResult.valid) {
            const errorMsg =
              validationResult.error ||
              "Invalid topic for selected category. Please enter only aptitude/communication/logical reasoning topics.";
            resetUIOnValidationFailure(errorMsg);
            return;
          }
          // Update state to reflect validation passed
          setIsTopicValid(true);
          setTopicValidationError(null);
        } else {
          const errorMsg = "Unable to validate topic. Please try again.";
          resetUIOnValidationFailure(errorMsg);
          return;
        }
      } catch (err: any) {
        console.error("Error validating topic:", err);
        const errorMsg =
          err.response?.data?.data?.error ||
          err.response?.data?.message ||
          "Invalid topic for selected category. Please enter only aptitude/communication/logical reasoning topics.";
        resetUIOnValidationFailure(errorMsg);
        return;
      } finally {
        setValidatingTopic(false);
      }
    }

    try {
      // 1. Call backend for context (already working)
      let contextData: any = {};
      let defaultQuestionType: "MCQ" | "Subjective" = "MCQ";
      let contextSummary: string | undefined = undefined;

      try {
        const response = await generateTopicContextMutation.mutateAsync({
          topicName: topicName.trim(),
          category: finalCategory,
        });

        if (response?.success && response.data) {
          contextData = response.data;
          defaultQuestionType = contextData.suggestedQuestionType || "MCQ";
          contextSummary = contextData.contextSummary;
        }
      } catch (err: any) {
        console.error("Error getting topic context:", err);
        // If context generation fails, check if it's a validation error
        const errorMsg =
          err.response?.data?.data?.error || err.response?.data?.message;
        if (
          errorMsg &&
          (errorMsg.toLowerCase().includes("invalid") ||
            errorMsg.toLowerCase().includes("not match"))
        ) {
          resetUIOnValidationFailure(errorMsg);
          return;
        }
        // Fallback to defaults - don't block topic creation for other errors
        defaultQuestionType =
          finalCategory === "communication" ? "Subjective" : "MCQ";
      }

      // Double-check for duplicate before adding (race condition protection)
      const topicExistsNow = topicsV2.some(
        (t) => t.label.toLowerCase() === topicName.toLowerCase(),
      );
      if (topicExistsNow) {
        setToastMessage("Topic already added.");
        setTimeout(() => setToastMessage(null), 3000);
        setAddingTopic(false);
        setCustomTopicInputV2(""); // Clear input
        setSuggestionsFetched(false); // Reset fetched flag
        return;
      }

      // 2. Build valid topic object
      const newTopic: TopicV2 = {
        id: generateId(),
        label: topicName,
        category: finalCategory,
        locked: false,
        allowedQuestionTypes: ["MCQ", "Subjective"], // REQUIRED: Soft skills only allow MCQ and Subjective
        contextSummary: contextSummary,
        questionRows: [
          {
            rowId: generateId(),
            questionType: defaultQuestionType,
            difficulty: contextData.difficulty || "Medium",
            questionsCount: 1,
            canUseJudge0: false, // Soft skills never use Judge0
            status: "pending",
            locked: false,
            questions: [],
          },
        ],
      };

      // 3. INSERT TOPIC INTO STATE IMMEDIATELY (REQUIRES FUNCTIONAL UPDATE)
      // CRITICAL: Use functional update to guarantee immediate UI update
      // Calculate updated topics array for draft save
      const updatedTopics = [...topicsV2, newTopic];
      setTopicsV2((prev) => [...prev, newTopic]);

      // 4. CLEAR UI STATE (must happen after state update)
      setCustomTopicInputV2("");
      setShowAiSuggestions(false);
      setAiTopicSuggestions([]);
      setSuggestionsFetched(false); // Reset fetched flag
      setTopicInputValues((prev) => ({ ...prev, [newTopic.id]: topicName }));
      setIsTopicValid(null);
      setTopicValidationError(null);

      // 5. Save in draft (async, don't block UI)
      if (assessmentId) {
        await updateDraftMutation.mutateAsync({
          assessmentId: assessmentId || undefined,
          topics_v2: updatedTopics, // Use calculated updated topics array
        });
      }
    } catch (err: any) {
      console.error("Error adding topic:", err);
      const errorMsg =
        err.response?.data?.data?.error ||
        err.response?.data?.message ||
        "Failed to add topic. Please try again.";

      // Check if it's a validation error
      if (
        errorMsg.toLowerCase().includes("invalid") ||
        errorMsg.toLowerCase().includes("not match") ||
        errorMsg.toLowerCase().includes("technical")
      ) {
        resetUIOnValidationFailure(errorMsg);
      } else {
        // Generic error - reset UI but keep input for user to edit
        setAddingTopic(false);
        setValidatingTopic(false);
        setIsTopicValid(false);
        setTopicValidationError(errorMsg);
        setToastMessage(errorMsg);
        setTimeout(() => setToastMessage(null), 5000);
      }
    } finally {
      // Always reset adding state, even if error was handled above
      setAddingTopic(false);
    }
  };

  // NEW: AI topic validation and suggestions handler (for redesigned section)
  const handleTopicInputChangeNew = async (value: string) => {
    setTopicInput(value);

    // Only validate for soft skills (aptitude, communication, logical)
    if (
      !selectedCategory ||
      selectedCategory === "technical" ||
      value.trim().length < 2
    ) {
      setAiValidationResult(null);
      setShowSuggestions(false);
      return;
    }

    // Debounce validation
    if (validationDebounceTimerNew) {
      clearTimeout(validationDebounceTimerNew);
    }

    const timer = setTimeout(async () => {
      setLoadingValidation(true);
      try {
        const response = await aiTopicSuggestionMutation.mutateAsync({
          category: selectedCategory,
          input: value.trim(),
        });

        if (response?.success && response.data) {
          const result = response.data;
          setAiValidationResult(result);

          if (result.isValid && result.suggestions.length > 0) {
            setShowSuggestions(true);
          } else {
            setShowSuggestions(false);
          }
        }
      } catch (err: any) {
        console.error("Error validating topic:", err);
        setAiValidationResult(null);
        setShowSuggestions(false);
      } finally {
        setLoadingValidation(false);
      }
    }, 500);

    setValidationDebounceTimerNew(timer);
  };

  // NEW: Add custom topic handler (for redesigned section)
  const handleAddCustomTopicNew = async () => {
    if (!selectedCategory || !topicInput.trim() || isAddingTopicNew) return;

    const topicName = topicInput.trim();

    // For soft skills, check AI validation
    if (selectedCategory !== "technical") {
      if (!aiValidationResult || !aiValidationResult.isValid) {
        const reason =
          aiValidationResult?.reason || "Topic is not valid for this category";
        setToastMessage(
          `This topic is not relevant to ${selectedCategory}. Reason: ${reason}`,
        );
        setTimeout(() => setToastMessage(null), 5000);
        setTopicInput("");
        setAiValidationResult(null);
        setShowSuggestions(false);
        return;
      }
    }

    setIsAddingTopicNew(true);

    try {
      const response = await addCustomTopicMutation.mutateAsync({
        category: selectedCategory,
        topicName: topicName,
      });

      if (response?.success) {
        // Refresh topics list
        if (assessmentId) {
          await refetchAssessment();
          if ((assessmentData as any)?.topics_v2) {
            setTopicsV2((assessmentData as any).topics_v2);
          }
        }

        // Clear input and reset
        setTopicInput("");
        setAiValidationResult(null);
        setShowSuggestions(false);
        setToastMessage("Topic added successfully!");
        setTimeout(() => setToastMessage(null), 3000);
      }
    } catch (err: any) {
      console.error("Error adding topic:", err);
      const errorMsg =
        err.response?.data?.message || "Failed to add topic. Please try again.";
      setToastMessage(errorMsg);
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsAddingTopicNew(false);
    }
  };

  const handleAddCustomTopicV2 = async (
    isTechnical: boolean = true,
    topicNameOverride?: string,
    event?: any,
  ) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    // Use customTopicInput (from modal) if no override is provided
    const topicName = topicNameOverride || customTopicInput.trim();

    if (!topicName || addingTopic) return;

    // Check for duplicates
    if (
      topicsV2.some((t) => t.label.toLowerCase() === topicName.toLowerCase())
    ) {
      setToastMessageCustom("Topic already added.");
      setTimeout(() => setToastMessageCustom(null), 3000);
      return;
    }

    setAddingTopic(true);
    let defaultQuestionType: any = "MCQ";
    let codingSupported = false;

    try {
      if (isTechnical) {
        try {
          const response = await classifyTechnicalTopicMutation.mutateAsync({
            topic: topicName,
          });
          if (response?.success && response.data) {
            defaultQuestionType = response.data.questionType;
            codingSupported = response.data.coding_supported || false;
          }
        } catch (classifyErr) {
          console.warn("AI classification failed, using local fallback");
        }
      }

      const newTopic: TopicV2 = {
        id: generateId(),
        label: topicName,
        locked: false,
        category: isTechnical ? "technical" : undefined,
        status: "pending",
        questionRows: [
          {
            rowId: generateId(),
            questionType: defaultQuestionType,
            difficulty: "Medium",
            questionsCount: 5, // Default to 5 so it's visible
            canUseJudge0: defaultQuestionType === "Coding",
            status: "pending",
            locked: false,
            questions: [],
          },
        ],
      };

      // 🟢 CRITICAL: Update local state immediately so Station 4 re-renders
      const updatedTopics = [...topicsV2, newTopic];
      setTopicsV2(updatedTopics);

      // 🟢 CRITICAL: Close modal and clear the specific input state you are using
      setCustomTopicInput("");
      setShowCustomTopicModal(false);

      if (assessmentId) {
        await updateDraftMutation.mutateAsync({
          assessmentId,
          topics_v2: updatedTopics,
        });
      }

      setToastMessageCustom("Topic added successfully!");
      setTimeout(() => setToastMessageCustom(null), 3000);
    } catch (err: any) {
      const errorText =
        err.response?.data?.message || err.message || "Failed to add topic.";
      setToastMessageCustom(errorText);
    } finally {
      setAddingTopic(false);
    }
  };

  const handleRemoveTopicV2 = (topicId: string) => {
    setTopicsV2((prev) => prev.filter((t) => t.id !== topicId));
  };

  // Detect category from topic name (semantic)
  const detectTopicCategory = async (
    topicName: string,
  ): Promise<
    "aptitude" | "communication" | "logical_reasoning" | "technical"
  > => {
    if (!topicName || topicName.trim().length < 2) return "technical";

    try {
      // Use OpenAI to detect category semantically
      const response = await detectTopicCategoryMutation.mutateAsync({
        topicName: topicName.trim(),
      });

      if (response?.success && response.data?.category) {
        return response.data.category;
      }
    } catch (err) {
      console.error("Error detecting category:", err);
    }

    // Fallback: return technical
    return "technical";
  };

  // Fetch topic suggestions (debounced)
  const fetchTopicSuggestions = async (
    partialInput: string,
    category: string,
  ) => {
    if (!partialInput || partialInput.length < 2) {
      setTopicSuggestions([]);
      return;
    }

    setLoadingSuggestions(true);
    try {
      const response = await suggestTopicContextsMutation.mutateAsync({
        partialInput: partialInput.trim(),
        category: category,
      });

      if (response?.success && response.data?.suggestions) {
        setTopicSuggestions(response.data.suggestions);
      } else {
        setTopicSuggestions([]);
      }
    } catch (err: any) {
      console.error("Error fetching suggestions:", err);
      setTopicSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  // Fetch AI-powered topic suggestions for custom topic input (ONLY for soft skills)
  // Fetches with debouncing as user types
  const fetchAiTopicSuggestions = async (
    query: string,
    category: string,
    forceFetch: boolean = false,
  ) => {
    // Only fetch suggestions for soft skills (aptitude, communication, logical_reasoning)
    const softSkillCategories = [
      "aptitude",
      "communication",
      "logical_reasoning",
    ];
    if (!softSkillCategories.includes(category)) {
      setShowAiSuggestions(false);
      setAiTopicSuggestions([]);
      setSuggestionsFetched(false);
      return;
    }

    // Allow fetching even with empty query when forceFetch is true (for onFocus)
    // Otherwise, require at least 2 characters
    const queryTrimmed = query ? query.trim() : "";

    if (!forceFetch && queryTrimmed.length < 2) {
      setShowAiSuggestions(false);
      setAiTopicSuggestions([]);
      setSuggestionsFetched(false);
      return;
    }

    // If forceFetch is true, reset the fetched flag
    if (forceFetch) {
      setSuggestionsFetched(false);
    }

    // Clear existing timer
    if (suggestionDebounceTimer) {
      clearTimeout(suggestionDebounceTimer);
    }

    // Set new debounced timer (500ms) - allows refetching when query changes
    // If forceFetch is true, use shorter delay (100ms) for immediate response on focus
    const delay = forceFetch ? 100 : 500;
    const timer = setTimeout(async () => {
      console.log("fetchAiTopicSuggestions: Starting fetch", {
        query,
        category,
        forceFetch,
        suggestionsFetched,
      }); // Debug

      // Always fetch if forceFetch is true, otherwise check if already fetched
      // Note: We check suggestionsFetched here but it's a closure - this is OK since we reset it above if forceFetch
      if (!forceFetch && suggestionsFetched) {
        console.log(
          "fetchAiTopicSuggestions: Skipping - already fetched and not forcing",
        ); // Debug
        return;
      }

      setLoadingAiSuggestions(true);
      setShowAiSuggestions(true); // Show loading state immediately
      try {
        console.log("fetchAiTopicSuggestions: Making API call", {
          category,
          query: queryTrimmed,
        }); // Debug
        const response = await suggestTopicsMutation.mutateAsync({
          category: category,
          query: queryTrimmed || "", // Allow empty query for general suggestions
        });

        console.log("fetchAiTopicSuggestions: API response", response.data); // Debug

        if (response?.success && response.data?.suggestions) {
          // Filter out technical topics on frontend using OpenAI (async, but we'll do it in parallel)
          const suggestions = response.data.suggestions;
          console.log("fetchAiTopicSuggestions: Raw suggestions", suggestions); // Debug

          // Check all suggestions in parallel for better performance (limit to first 10 for performance)
          const suggestionsToCheck = suggestions.slice(0, 10);
          const technicalChecks = await Promise.all(
            suggestionsToCheck.map((suggestion: string) =>
              checkIfTechnicalTopic(suggestion),
            ),
          );

          const filteredSuggestions = suggestionsToCheck.filter(
            (suggestion: string, index: number) => {
              return !technicalChecks[index]; // Keep only non-technical suggestions
            },
          );

          // Add remaining suggestions without checking (they're likely safe if backend filtered them)
          const remainingSuggestions = suggestions.slice(10);
          const allFiltered = [...filteredSuggestions, ...remainingSuggestions];

          console.log(
            "fetchAiTopicSuggestions: Filtered suggestions",
            allFiltered,
          ); // Debug

          setAiTopicSuggestions(allFiltered);
          setShowAiSuggestions(allFiltered.length > 0);
          setSuggestionsFetched(true); // Mark as fetched for this query
        } else {
          console.log("fetchAiTopicSuggestions: No suggestions in response"); // Debug
          setAiTopicSuggestions([]);
          setShowAiSuggestions(false);
          setSuggestionsFetched(true); // Mark as fetched even if empty
        }
      } catch (err: any) {
        console.error("Error fetching AI topic suggestions:", err);
        setAiTopicSuggestions([]);
        setShowAiSuggestions(false);
        setSuggestionsFetched(true); // Mark as fetched even on error
      } finally {
        setLoadingAiSuggestions(false);
      }
    }, delay);

    setSuggestionDebounceTimer(timer);
  };

  // Generate context summary for a topic
  const generateTopicContext = async (
    topicId: string,
    topicName: string,
    category: string,
  ) => {
    if (!topicName || topicName.trim().length === 0) return;

    try {
      const response = await generateTopicContextMutation.mutateAsync({
        topicName: topicName.trim(),
        category: category,
      });

      if (response?.success && response.data) {
        const { contextSummary, suggestedQuestionType } = response.data;

        setTopicsV2((prev) =>
          prev.map((t) => {
            if (t.id === topicId) {
              const updatedTopic = {
                ...t,
                contextSummary,
                suggestedQuestionType,
              };

              // Update first row's question type if suggested
              if (suggestedQuestionType && t.questionRows.length > 0) {
                updatedTopic.questionRows = t.questionRows.map((row, idx) => {
                  if (idx === 0) {
                    return { ...row, questionType: suggestedQuestionType };
                  }
                  return row;
                });
              }

              return updatedTopic;
            }
            return t;
          }),
        );
      }
    } catch (err: any) {
      console.error("Error generating context:", err);
    }
  };

  // Handle topic name input with suggestions
  const handleTopicNameChange = (topicId: string, value: string) => {
    // Update input value immediately
    setTopicInputValues((prev) => ({ ...prev, [topicId]: value }));
    handleUpdateTopicV2(topicId, "label", value);

    // Detect category if not set (async, don't await)
    const topic = topicsV2.find((t) => t.id === topicId);
    const specialCategories = [
      "aptitude",
      "communication",
      "logical_reasoning",
    ] as const;
    const isSpecialCategory =
      topic?.category && specialCategories.includes(topic.category as any);

    if (
      !topic?.category ||
      topic.category === "technical" ||
      !isSpecialCategory
    ) {
      detectTopicCategory(value).then(async (detectedCategory) => {
        if (specialCategories.includes(detectedCategory as any)) {
          handleUpdateTopicV2(topicId, "category", detectedCategory);

          // Clear any existing debounce timer for this topic
          if (categorySaveDebounceRef.current) {
            clearTimeout(categorySaveDebounceRef.current);
            categorySaveDebounceRef.current = null;
          }

          // Debounced auto-save to backend (2.5 seconds delay)
          categorySaveDebounceRef.current = setTimeout(async () => {
            if (!assessmentId) {
              console.warn("Cannot save category: assessmentId is missing");
              categorySaveDebounceRef.current = null;
              return;
            }

            try {
              // Get the latest topicsV2 state from ref (synced via useEffect)
              const currentTopics = topicsV2Ref.current;
              const updatedTopics = currentTopics.map((t) => {
                if (t.id === topicId) {
                  return { ...t, category: detectedCategory };
                }
                return t;
              });

              console.log(
                `💾 Saving category "${detectedCategory}" for topic: ${value}`,
              );

              const saveResponse = await updateDraftMutation.mutateAsync({
                assessmentId: assessmentId || undefined,
                topics_v2: updatedTopics,
              });

              if (saveResponse?.success) {
                console.log(
                  `✅ Category "${detectedCategory}" saved successfully for topic: ${value}`,
                );
              } else {
                console.warn(
                  "Category save response indicates failure:",
                  saveResponse,
                );
                setError(
                  `Failed to save category update. Please try saving the assessment manually.`,
                );
              }

              categorySaveDebounceRef.current = null;
            } catch (err: any) {
              console.error("❌ Error saving category update:", err);
              setError(
                `Failed to save category update: ${err.response?.data?.message || err.message || "Unknown error"}. The category is updated locally but not saved to the database. Please try saving the assessment manually.`,
              );
              categorySaveDebounceRef.current = null;
            }
          }, 2500); // 2.5 seconds debounce

          // Fetch suggestions for non-technical categories
          if (value.length >= 2) {
            setShowingSuggestionsFor(topicId);
            fetchTopicSuggestions(value, detectedCategory);
          }
        }
      });
    } else if (isSpecialCategory && value.length >= 2) {
      // Show suggestions for aptitude/communication/logical_reasoning
      setShowingSuggestionsFor(topicId);
      fetchTopicSuggestions(value, topic.category);
    } else {
      setShowingSuggestionsFor(null);
      setTopicSuggestions([]);
    }
  };

  // Sync topicsV2 state to ref for use in debounced callbacks
  useEffect(() => {
    topicsV2Ref.current = topicsV2;
  }, [topicsV2]);

  // REMOVED: Debounced context summary generation useEffect
  // Context is now generated ONLY when user clicks "Add Topic" button
  // This prevents multiple API calls while typing

  // Cleanup suggestion debounce timer on unmount
  useEffect(() => {
    return () => {
      if (suggestionDebounceTimer) {
        clearTimeout(suggestionDebounceTimer);
      }
    };
  }, [suggestionDebounceTimer]);

  // Handle clicks outside suggestions container to auto-close dropdown
  useEffect(() => {
    if (!showAiSuggestions) return; // Early return if suggestions not visible

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        suggestionsContainerRef.current &&
        target &&
        !suggestionsContainerRef.current.contains(target)
      ) {
        setShowAiSuggestions(false);
      }
    };

    // Use mousedown instead of click to catch before blur event
    document.addEventListener("mousedown", handleClickOutside);

    // Cleanup
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAiSuggestions]);

  const handleUpdateTopicV2 = (
    topicId: string,
    field: keyof TopicV2,
    value: any,
  ) => {
    setTopicsV2((prev) =>
      prev.map((t) => {
        if (t.id === topicId) {
          return { ...t, [field]: value };
        }
        return t;
      }),
    );
  };

  const handleAddQuestionRow = async (topicId: string) => {
    if (!assessmentId) {
      setError("Assessment ID is required");
      return;
    }

    const topic = topicsV2.find((t) => t.id === topicId);
    if (!topic) {
      setError("Topic not found");
      return;
    }

    if (topic.locked) {
      setError("Cannot add question row - topic is locked");
      return;
    }

    // CRITICAL: For newly added custom topics, ensure they're saved to the database first
    // This prevents 404 errors when the backend can't find the topic
    try {
      console.log("Ensuring topic is saved before adding question row...", {
        topicId,
        assessmentId,
      });

      // First, ensure the topic exists in the draft by saving it
      const saveResponse = await updateDraftMutation.mutateAsync({
        assessmentId: assessmentId || undefined,
        topics_v2: topicsV2,
      });

      if (!saveResponse?.success) {
        console.warn("Draft save response indicates failure:", saveResponse);
      }

      // Small delay to ensure database write completes
      await new Promise((resolve) => setTimeout(resolve, 200));

      console.log("Draft saved, now adding question row...");
    } catch (err: any) {
      console.error("Error saving draft before adding question row:", err);
      setError("Failed to save topic. Please try again.");
      return; // Don't proceed if we can't save the topic
    }

    try {
      console.log("Calling add-question-row endpoint...", {
        assessmentId,
        topicId,
      });

      const response = await addQuestionRowMutation.mutateAsync({
        assessmentId: assessmentId || "",
        topicId: topicId,
      });

      console.log("Add question row response:", response.data);

      if (response?.success) {
        const updatedTopic = response.data?.topic;
        const updatedRow = response.data?.row;

        // Update state with the new row
        setTopicsV2((prev) =>
          prev.map((t) => {
            if (t.id === topicId) {
              // If topic was "generated" and we're adding a new row, mark as "pending" so it will regenerate
              const newStatus =
                t.status === "generated"
                  ? ("pending" as const)
                  : t.status || "pending";
              return {
                ...t,
                status: newStatus,
                questionRows: [...t.questionRows, updatedRow],
              };
            }
            return t;
          }),
        );

        // Update draft with the new row using the server's authoritative topic
        const updatedTopics = topicsV2.map((t) =>
          t.id === topicId ? updatedTopic : t,
        );

        updateDraftMutation.mutate(
          {
            assessmentId: assessmentId || undefined,
            topics_v2: updatedTopics,
          },
          {
            onError: (err) => {
              console.error(
                "Error updating draft after adding question row:",
                err,
              );
            },
          },
        );
      } else {
        setError(response.data?.message || "Failed to add question row");
      }
    } catch (err: any) {
      console.error("Error adding question row:", err);
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        err.message ||
        "Failed to add question row";
      setError(errorMessage);

      // If it's a 404, provide more helpful error message
      if (err.response?.status === 404) {
        setError(
          `Topic not found in database. Please refresh the page and try again. Error: ${errorMessage}`,
        );
      }
    }
  };

  // Handler to update question timer
  const handleUpdateQuestionTimer = async (
    topicId: string,
    rowId: string,
    questionIndex: number,
    newTimer: number,
  ) => {
    if (!assessmentId || newTimer < 1) return;

    try {
      // Update state immediately for instant UI update
      setTopicsV2((prev) =>
        prev.map((t) => {
          if (t.id === topicId) {
            return {
              ...t,
              questionRows: t.questionRows.map((r) => {
                if (
                  r.rowId === rowId &&
                  r.questions &&
                  r.questions[questionIndex]
                ) {
                  const updatedQuestions = [...r.questions];
                  updatedQuestions[questionIndex] = {
                    ...updatedQuestions[questionIndex],
                    timer: newTimer,
                  };
                  return {
                    ...r,
                    questions: updatedQuestions,
                  };
                }
                return r;
              }),
            };
          }
          return t;
        }),
      );

      // Update draft
      const updatedTopics = topicsV2.map((t) => {
        if (t.id === topicId) {
          return {
            ...t,
            questionRows: t.questionRows.map((r) => {
              if (
                r.rowId === rowId &&
                r.questions &&
                r.questions[questionIndex]
              ) {
                const updatedQuestions = [...r.questions];
                updatedQuestions[questionIndex] = {
                  ...updatedQuestions[questionIndex],
                  timer: newTimer,
                };
                return {
                  ...r,
                  questions: updatedQuestions,
                };
              }
              return r;
            }),
          };
        }
        return t;
      });

      await updateDraftMutation.mutateAsync({
        assessmentId: assessmentId || undefined,
        topics_v2: updatedTopics,
      });
    } catch (err: any) {
      console.error("Error updating question timer:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to update question timer",
      );
    }
  };

  // Handler to regenerate a single question
  const handleRegenerateQuestion = async () => {
    if (!assessmentId || !regeneratingQuestionId) return;

    try {
      // Find the question data
      let qData: any = null;
      for (const topic of topicsV2) {
        for (const row of topic.questionRows) {
          if (row.questions && row.questions.length > 0) {
            for (let i = 0; i < row.questions.length; i++) {
              const id = `${topic.id}_${row.rowId}_${i}`;
              if (id === regeneratingQuestionId) {
                qData = {
                  question: row.questions[i],
                  questionType: row.questionType,
                  difficulty: row.difficulty,
                  topicId: topic.id,
                  rowId: row.rowId,
                  questionIndex: i,
                  topicLabel: topic.label,
                  additionalRequirements: row.additionalRequirements,
                };
                break;
              }
            }
          }
        }
      }

      if (!qData) {
        setError("Question not found");
        return;
      }

      // Get old question text
      const oldQuestionText = getQuestionText(
        qData.question,
        qData.questionType,
      );

      // Call API to regenerate question
      const response = await regenerateQuestionMutation.mutateAsync({
        assessmentId,
        topicId: qData.topicId,
        rowId: qData.rowId,
        questionIndex: qData.questionIndex,
        oldQuestion: oldQuestionText,
        questionType: qData.questionType,
        difficulty: qData.difficulty,
        experienceMode,
        experienceMin,
        experienceMax,
        additionalRequirements: qData.additionalRequirements || undefined,
        feedback: regenerateQuestionFeedback || undefined,
      });

      if (response?.success) {
        const updatedQuestion = response.data?.question;

        // Update state - preserve timer and score
        setTopicsV2((prev) =>
          prev.map((t) => {
            if (t.id === qData.topicId) {
              return {
                ...t,
                questionRows: t.questionRows.map((r) => {
                  if (
                    r.rowId === qData.rowId &&
                    r.questions &&
                    r.questions[qData.questionIndex]
                  ) {
                    const updatedQuestions = [...r.questions];
                    const oldQuestion = updatedQuestions[qData.questionIndex];

                    // Preserve timer and score, update question content
                    updatedQuestions[qData.questionIndex] = {
                      ...updatedQuestion,
                      timer:
                        oldQuestion.timer ||
                        (() => {
                          const baseTime = getBaseTimePerQuestion(
                            qData.questionType,
                          );
                          const multiplier = getDifficultyMultiplier(
                            qData.difficulty,
                          );
                          let questionTime = baseTime * multiplier;
                          if (
                            qData.questionType === "MCQ" &&
                            questionTime > 40
                          ) {
                            questionTime = 40;
                          }
                          return Math.max(1, Math.ceil(questionTime / 60));
                        })(),
                      // Preserve oldVersions and add current question to history
                      oldVersions: [
                        ...(oldQuestion.oldVersions || []),
                        {
                          question: oldQuestion,
                          timestamp: new Date().toISOString(),
                        },
                      ],
                      status: "regenerated",
                    };

                    return {
                      ...r,
                      questions: updatedQuestions,
                    };
                  }
                  return r;
                }),
              };
            }
            return t;
          }),
        );

        // Update draft
        const updatedTopics = topicsV2.map((t) => {
          if (t.id === qData.topicId) {
            return {
              ...t,
              questionRows: t.questionRows.map((r) => {
                if (
                  r.rowId === qData.rowId &&
                  r.questions &&
                  r.questions[qData.questionIndex]
                ) {
                  const updatedQuestions = [...r.questions];
                  const oldQuestion = updatedQuestions[qData.questionIndex];
                  updatedQuestions[qData.questionIndex] = {
                    ...updatedQuestion,
                    timer: oldQuestion.timer,
                    oldVersions: [
                      ...(oldQuestion.oldVersions || []),
                      {
                        question: oldQuestion,
                        timestamp: new Date().toISOString(),
                      },
                    ],
                    status: "regenerated",
                  };
                  return {
                    ...r,
                    questions: updatedQuestions,
                  };
                }
                return r;
              }),
            };
          }
          return t;
        });

        await updateDraftMutation.mutateAsync({
          assessmentId,
          topics_v2: updatedTopics,
        });

        // Close modal
        setRegeneratingQuestionId(null);
        setRegenerateQuestionFeedback("");
      }
    } catch (err: any) {
      console.error("Error regenerating question:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to regenerate question",
      );
    }
  };

  // Handler to remove a question from Review Questions page
  const handleRemoveQuestionInReview = async (
    topicId: string,
    rowId: string,
    questionIndex: number,
  ) => {
    if (!assessmentId) return;

    try {
      const topic = topicsV2.find((t) => t.id === topicId);
      if (!topic) return;

      const row = topic.questionRows.find((r) => r.rowId === rowId);
      if (!row || !row.questions) return;

      // Remove the question from the array
      const updatedQuestions = row.questions.filter(
        (_, idx) => idx !== questionIndex,
      );

      // Update state
      setTopicsV2((prev) =>
        prev.map((t) => {
          if (t.id === topicId) {
            return {
              ...t,
              questionRows: t.questionRows.map((r) => {
                if (r.rowId === rowId) {
                  return {
                    ...r,
                    questions: updatedQuestions,
                  };
                }
                return r;
              }),
            };
          }
          return t;
        }),
      );

      // Update draft
      const updatedTopics = topicsV2.map((t) => {
        if (t.id === topicId) {
          return {
            ...t,
            questionRows: t.questionRows.map((r) => {
              if (r.rowId === rowId) {
                return {
                  ...r,
                  questions: updatedQuestions,
                };
              }
              return r;
            }),
          };
        }
        return t;
      });

      await updateDraftMutation.mutateAsync({
        assessmentId: assessmentId || undefined,
        topics_v2: updatedTopics,
      });
    } catch (err: any) {
      console.error("Error removing question:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to remove question",
      );
    }
  };

  const handleRemoveQuestionRow = async (topicId: string, rowId: string) => {
    if (!assessmentId) return;

    const topic = topicsV2.find((t) => t.id === topicId);
    if (!topic) return;

    const row = topic.questionRows.find((r) => r.rowId === rowId);
    if (!row || row.locked) return;

    if (topic.questionRows.length <= 1) {
      setError("Cannot remove the last question row");
      return;
    }

    try {
      const response = await removeQuestionRowMutation.mutateAsync({
        assessmentId: assessmentId || "",
        topicId: topicId,
        rowId: rowId,
      });

      if (response?.success) {
        const updatedTopic = response.data?.topic;
        setTopicsV2((prev) =>
          prev.map((t) => (t.id === topicId ? updatedTopic : t)),
        );
      }
    } catch (err: any) {
      console.error("Error removing question row:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to remove question row",
      );
    }
  };

  const handleUpdateRow = (
    topicId: string,
    rowId: string,
    field: keyof QuestionRow,
    value: any,
  ) => {
    setTopicsV2((prev) =>
      prev.map((t) => {
        if (t.id === topicId) {
          const topic = t;
          const row = topic.questionRows.find((r) => r.rowId === rowId);
          const hasGeneratedQuestions =
            row?.questions &&
            row.questions.length > 0 &&
            row.status === "generated";

          const updatedRows = t.questionRows.map((r) => {
            if (r.rowId === rowId) {
              const updated = { ...r, [field]: value };
              // Ensure canUseJudge0 is only true for Coding
              if (field === "questionType") {
                if (value === "Coding") {
                  // Only allow Coding if canUseJudge0 is true
                  if (!updated.canUseJudge0) {
                    return r; // Revert
                  }
                } else {
                  updated.canUseJudge0 = false;
                }
              }

              // If questionType or difficulty changes AFTER questions have been generated,
              // mark row as pending and topic as pending so questions will regenerate
              if (
                hasGeneratedQuestions &&
                (field === "questionType" || field === "difficulty")
              ) {
                updated.status = "pending";
                updated.questions = []; // Clear existing questions
                updated.locked = false; // ✅ FIX 1: Unlock to allow regeneration
              }

              // ✅ FIX 2: Also update difficulty in existing questions if they exist
              // This ensures the difficulty is reflected in the UI immediately
              if (
                field === "difficulty" &&
                updated.questions &&
                updated.questions.length > 0
              ) {
                updated.questions = updated.questions.map((q: any) => ({
                  ...q,
                  difficulty: value, // Update difficulty in each question object
                }));
              }

              return updated;
            }
            return r;
          });

          // If any row was modified and had generated questions, set topic status to "pending"
          const shouldMarkTopicPending =
            row &&
            hasGeneratedQuestions &&
            (field === "questionType" || field === "difficulty");

          return {
            ...t,
            questionRows: updatedRows,
            status: shouldMarkTopicPending
              ? ("pending" as const)
              : t.status || "pending",
          };
        }
        return t;
      }),
    );

    // ✅ FIX 3: Auto-save to draft immediately after difficulty change
    if (assessmentId && field === "difficulty") {
      // Clear any existing debounce timeout
      if (difficultySaveDebounceRef.current) {
        clearTimeout(difficultySaveDebounceRef.current);
      }

      // Debounce the save to avoid too many API calls
      difficultySaveDebounceRef.current = setTimeout(async () => {
        try {
          // Get the latest topics state (state was already updated above)
          // Use functional update to get current state without triggering another update
          setTopicsV2((currentTopics) => {
            // State is already updated, just save it to draft
            updateDraftMutation.mutate(
              {
                assessmentId,
                topics_v2: currentTopics,
              },
              {
                onError: (err: any) => {
                  console.error("Error auto-saving difficulty change:", err);
                },
              },
            );

            // Return unchanged to avoid double state update
            return currentTopics;
          });
        } catch (err: any) {
          console.error("Error auto-saving difficulty change:", err);
        }
      }, 500); // 500ms debounce
    }
  };

  const handleQuestionTypeChangeFromDropdown = async (
    topicId: string,
    rowId: string,
    newQuestionType:
      | "MCQ"
      | "Subjective"
      | "PseudoCode"
      | "Coding"
      | "SQL"
      | "AIML",
  ) => {
    if (!assessmentId) return;

    try {
      // Find the current row to preserve difficulty
      const topic = topicsV2.find((t) => t.id === topicId);
      const row = topic?.questionRows.find((r) => r.rowId === rowId);
      const currentDifficulty = row?.difficulty || "Medium";

      // Determine canUseJudge0 based on question type
      const canUseJudge0 = newQuestionType === "Coding";

      // Call backend API to update question type
      const response = await updateQuestionTypeMutation.mutateAsync({
        assessmentId: assessmentId || "",
        topicId: topicId,
        rowId: rowId,
        questionType: newQuestionType,
        difficulty: currentDifficulty, // Keep existing difficulty
        canUseJudge0: canUseJudge0,
      });

      if (response?.success) {
        // Update local state to reflect the change
        setTopicsV2((prev) =>
          prev.map((t) => {
            if (t.id === topicId) {
              return {
                ...t,
                questionRows: t.questionRows.map((r) => {
                  if (r.rowId === rowId) {
                    return {
                      ...r,
                      questionType: newQuestionType,
                      difficulty: currentDifficulty, // Preserve existing difficulty
                      canUseJudge0: canUseJudge0,
                      status: "pending" as const,
                      questions: [],
                      locked: false, // Unlock row to allow regeneration
                    };
                  }
                  return r;
                }),
                locked: false, // Unlock topic to allow regeneration
              };
            }
            return t;
          }),
        );

        // Log for debugging
        console.log(
          `✅ Question type updated: ${topic?.label} → ${newQuestionType}`,
        );
      }
    } catch (err: any) {
      console.error("Error updating question type:", err);
      setError(err.response?.data?.message || "Failed to update question type");
    }
  };

  const handleAddQuestionType = (topicIndex: number) => {
    const updated = [...topicConfigs];
    const topic = updated[topicIndex];
    const isAptitude = topic.isAptitude || false;

    // Get available question types
    let availableTypes = QUESTION_TYPES;
    if (isAptitude && topic.subTopic && topic.aptitudeStructure) {
      availableTypes = topic.aptitudeStructure.subTopics[topic.subTopic] || [];
    }

    // Find a question type that's not already used
    const usedTypes = topic.questionTypeConfigs.map((qtc) => qtc.questionType);
    const newType =
      availableTypes.find((type) => !usedTypes.includes(type)) ||
      availableTypes[0] ||
      "MCQ";

    // Create new question type config
    const newConfig: QuestionTypeConfig = {
      questionType: newType,
      difficulty: "Medium",
      numQuestions: 1,
    };

    // Auto-set language if coding
    if (newType === "coding") {
      newConfig.language = getLanguageFromTopic(topic.topic);
      newConfig.judge0_enabled = true;
    }

    topic.questionTypeConfigs.push(newConfig);
    setTopicConfigs(updated);
  };

  const handleRemoveQuestionType = (
    topicIndex: number,
    configIndex: number,
  ) => {
    const updated = [...topicConfigs];
    const topic = updated[topicIndex];

    // Don't allow removing the last question type
    if (topic.questionTypeConfigs.length <= 1) {
      setError("Each topic must have at least one question type");
      return;
    }

    topic.questionTypeConfigs.splice(configIndex, 1);
    setTopicConfigs(updated);
  };

  const handleUpdateQuestionTypeConfig = (
    topicIndex: number,
    configIndex: number,
    field: keyof QuestionTypeConfig,
    value: any,
  ) => {
    const updated = [...topicConfigs];
    const topic = updated[topicIndex];
    const config = topic.questionTypeConfigs[configIndex];

    // Update the field
    (config as any)[field] = value;

    // Auto-set language when question type changes to "coding"
    if (field === "questionType") {
      if (value === "coding") {
        // Only allow "coding" if topic supports coding
        const topicObj = topicConfigs[topicIndex];
        if (topicObj && topicObj.coding_supported === false) {
          // Topic doesn't support coding, revert to previous value or use a safe default
          const previousValue = config.questionType;
          (config as any).questionType = previousValue || "Subjective";
          return; // Don't update if coding is not supported
        }
        config.language = getLanguageFromTopic(topic.topic);
        config.judge0_enabled = true;
      } else {
        config.language = undefined;
        config.judge0_enabled = undefined;
      }
    }

    setTopicConfigs(updated);
  };

  const handleUpdateTopicConfig = (
    index: number,
    field: keyof Topic,
    value: any,
  ) => {
    const updated = [...topicConfigs];
    updated[index] = { ...updated[index], [field]: value };

    // For aptitude topics: when sub-topic changes, update available question types
    if (
      field === "subTopic" &&
      updated[index].isAptitude &&
      updated[index].aptitudeStructure
    ) {
      const subTopic = value;
      const questionTypes =
        updated[index].aptitudeStructure?.subTopics[subTopic] || [];
      // Update all question type configs to use available types
      if (questionTypes.length > 0) {
        updated[index].questionTypeConfigs.forEach((qtc, idx) => {
          if (!questionTypes.includes(qtc.questionType)) {
            qtc.questionType = questionTypes[0];
          }
        });
      }
    }

    // When topic name changes, update language for coding questions
    if (field === "topic") {
      updated[index].questionTypeConfigs.forEach((qtc) => {
        if (qtc.questionType === "coding" && !qtc.language) {
          qtc.language = getLanguageFromTopic(value);
          qtc.judge0_enabled = true;
        }
      });
    }

    setTopicConfigs(updated);
  };

  // Helper function to get question types for a given aptitude topic and sub-topic
  const getAptitudeQuestionTypes = (config: Topic): string[] => {
    if (!config.isAptitude || !config.aptitudeStructure || !config.subTopic) {
      return availableQuestionTypes;
    }
    return config.aptitudeStructure.subTopics[config.subTopic] || [];
  };

  // Auto-detect language from topic/skill name
  const getLanguageFromTopic = (topic: string): string => {
    if (!topic) return "71"; // Default to Python

    const topicLower = topic.toLowerCase();

    // Language-specific keywords
    const languageMap: { [key: string]: string } = {
      // Python
      python: "71",
      django: "71",
      flask: "71",
      pandas: "71",
      numpy: "71",
      tensorflow: "71",
      pytorch: "71",
      scikit: "71",
      jupyter: "71",

      // JavaScript/TypeScript
      javascript: "63",
      js: "63",
      node: "63",
      nodejs: "63",
      react: "63",
      vue: "63",
      angular: "63",
      express: "63",
      typescript: "74",
      ts: "74",
      next: "63",
      nextjs: "63",

      // Java
      java: "62",
      spring: "62",
      hibernate: "62",
      maven: "62",
      gradle: "62",

      // C/C++
      "c++": "54",
      cpp: "54",
      cplusplus: "54",
      c: "50",

      // C#
      "c#": "51",
      csharp: "51",
      ".net": "51",
      dotnet: "51",
      "asp.net": "51",

      // Go
      go: "60",
      golang: "60",

      // Rust
      rust: "73",

      // Kotlin
      kotlin: "78",
      android: "78",

      // PHP
      php: "68",
      laravel: "68",
      symfony: "68",

      // Ruby
      ruby: "72",
      rails: "72",
      "ruby on rails": "72",

      // Swift
      swift: "83",
      ios: "83",

      // SQL
      sql: "82",
      mysql: "82",
      postgresql: "82",
      mongodb: "82",
      database: "82",
    };

    // Check for exact matches first
    for (const [keyword, langId] of Object.entries(languageMap)) {
      if (topicLower.includes(keyword)) {
        return langId;
      }
    }

    // Default to Python for general programming topics
    return "71";
  };

  const handleRemoveTopic = async (index: number) => {
    const topicToRemove = topicConfigs[index];
    if (!topicToRemove) return;

    // Remove from local state first
    const updatedConfigs = topicConfigs.filter((_, i) => i !== index);
    setTopicConfigs(updatedConfigs);

    // If assessmentId exists, also remove from database
    if (assessmentId && topicToRemove.topic) {
      try {
        await removeTopicMutation.mutateAsync({
          assessmentId: assessmentId || "",
          topicId: topicToRemove.topic, // topicId should be the topic ID, not the topic name
        });
        // Also update topics list
        setTopics(topics.filter((t) => t !== topicToRemove.topic));
      } catch (err: any) {
        console.error("Error removing topic from database:", err);
        // Revert local state change if database update fails
        setTopicConfigs(topicConfigs);
        setError(
          err.response?.data?.message || "Failed to remove topic from database",
        );
      }
    } else {
      // If no assessmentId, just update local topics list
      setTopics(topics.filter((t) => t !== topicToRemove.topic));
    }
  };

  const handleAddCustomTopic = async () => {
    if (!customTopicInput.trim()) {
      setError("Please enter a topic name");
      return;
    }

    const topicName = customTopicInput.trim();

    // Check if topic already exists
    if (
      topicConfigs.some(
        (t) => t.topic.toLowerCase() === topicName.toLowerCase(),
      )
    ) {
      setError("Topic already exists");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      // Regenerate topic details from backend
      const response = await regenerateTopicMutation.mutateAsync({
        topic: topicName,
        assessmentId: assessmentId || undefined,
      });

      if (response?.success) {
        const data = response.data;
        const questionType = data?.questionType || "MCQ";
        const isCoding = questionType === "coding";
        const autoLanguage = isCoding
          ? getLanguageFromTopic(topicName)
          : undefined;

        const newTopic: Topic = {
          topic: topicName,
          questionTypeConfigs: [
            {
              questionType: questionType,
              difficulty: "Medium",
              numQuestions: 1,
              language: autoLanguage,
              judge0_enabled: isCoding ? true : undefined,
            },
          ],
          isAptitude: false,
          coding_supported:
            data.coding_supported !== undefined
              ? data.coding_supported
              : isCoding
                ? true
                : undefined,
        };

        setTopicConfigs([...topicConfigs, newTopic]);
        setCustomTopicInput("");

        // Clear questions so that questions will regenerate with the new topic
        setQuestions([]);
        console.log(
          `[Add Custom Topic] Cleared preview questions - will regenerate on next preview click to include new topic: ${topicName}`,
        );
      } else {
        setError("Failed to add custom topic");
      }
    } catch (err: any) {
      console.error("Error adding custom topic:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to add custom topic",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResetTopics = () => {
    if (originalTopicConfigsRef.current.length > 0) {
      setTopicConfigs(
        JSON.parse(JSON.stringify(originalTopicConfigsRef.current)),
      );
      setError(null);
    }
  };

  const handleRegenerateAllTopics = async () => {
    if (!assessmentId) {
      setError("Assessment ID not found. Please generate topics first.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First, ensure we have skills - fetch from assessment if not in state
      let skillsToUse = selectedSkills;
      if (!skillsToUse || skillsToUse.length === 0) {
        try {
          // Use React Query hook to fetch assessment data
          await refetchQuestions();
          const assessment = assessmentData || (questionsData as any);
          if (assessment) {
            if (
              assessment.selectedSkills &&
              assessment.selectedSkills.length > 0
            ) {
              skillsToUse = assessment.selectedSkills;
              setSelectedSkills(assessment.selectedSkills); // Update state for future use
            }
          }
        } catch (err) {
          console.error("Error fetching assessment skills:", err);
        }
      }

      if (!skillsToUse || skillsToUse.length === 0) {
        setError(
          "No skills found in assessment. Please go back to Station 1 and select skills first.",
        );
        setLoading(false);
        return;
      }

      // First, delete all questions from all topics
      await deleteTopicQuestionsMutation.mutateAsync({
        assessmentId: assessmentId || "",
        // No topic specified = delete all
      });

      // Clear questions state immediately
      setQuestions([]);

      // Clear topic configs immediately to show loading state
      setTopicConfigs([]);
      setTopics([]);

      console.log(
        `[Regenerate Topics] Starting regeneration for assessment ${assessmentId}`,
      );

      // Then regenerate topics - this will update the existing assessment
      // The handleGenerateTopics function will handle updating the existing assessment
      // by calling create-from-job-designation which will replace all topics
      await handleGenerateTopics();

      console.log(
        `[Regenerate Topics] Regeneration completed for assessment ${assessmentId}`,
      );
    } catch (err: any) {
      console.error("Error regenerating topics:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to regenerate topics",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateSingleTopic = async (topicIndex: number) => {
    const topic = topicConfigs[topicIndex];
    if (!topic || topic.isAptitude) {
      return; // Don't regenerate aptitude topics
    }

    if (!assessmentId) {
      setError("Assessment ID not found. Please generate topics first.");
      return;
    }

    setRegeneratingTopicIndex(topicIndex);
    setError(null);

    try {
      // First, ensure we have skills - always fetch from assessment to ensure we have the latest
      let skillsToUse = selectedSkills;

      // Always try to fetch from assessment to ensure we have the latest skills
      try {
        await refetchQuestions();
        const assessment = assessmentData || (questionsData as any);
        if (assessment) {
          if (
            assessment.selectedSkills &&
            assessment.selectedSkills.length > 0
          ) {
            skillsToUse = assessment.selectedSkills;
            setSelectedSkills(assessment.selectedSkills); // Update state for future use
          }
        }
      } catch (err) {
        console.error("Error fetching assessment skills:", err);
        // If fetch fails, try to use skills from state
        if (!skillsToUse || skillsToUse.length === 0) {
          setError(
            "Failed to fetch skills from assessment. Please go back to Station 1 and ensure skills are selected.",
          );
          setRegeneratingTopicIndex(null);
          return;
        }
      }

      if (!skillsToUse || skillsToUse.length === 0) {
        setError(
          "No skills found in assessment. Please go back to Station 1 and select skills first.",
        );
        setRegeneratingTopicIndex(null);
        return;
      }

      console.log("Using skills for topic regeneration:", skillsToUse);

      // First, delete questions for this specific topic
      await deleteTopicQuestionsMutation.mutateAsync({
        assessmentId: assessmentId || "",
        topic:
          (topic as any).topic || (topic as any).label || (topic as any).name,
      });

      // Preview questions removed - no longer clearing preview state

      // Then regenerate the topic (get new question type and coding support)
      const response = await regenerateTopicMutation.mutateAsync({
        topic:
          (topic as any).topic || (topic as any).label || (topic as any).name,
        assessmentId: assessmentId || undefined,
      });

      if (response?.success) {
        const data = response.data;
        const newTopicName = data?.topic || topic.topic; // Use new topic name if provided
        const questionType = data.questionType || "MCQ";
        const isCoding = questionType === "coding";
        const autoLanguage = isCoding
          ? getLanguageFromTopic(newTopicName)
          : undefined; // Use new topic name for language detection

        const updated = [...topicConfigs];
        updated[topicIndex] = {
          ...updated[topicIndex],
          topic: newTopicName, // Update topic name
          coding_supported:
            data.coding_supported !== undefined
              ? data.coding_supported
              : isCoding
                ? true
                : undefined,
        };

        // Update the first question type config
        if (updated[topicIndex].questionTypeConfigs.length > 0) {
          updated[topicIndex].questionTypeConfigs[0] = {
            ...updated[topicIndex].questionTypeConfigs[0],
            questionType: questionType,
            language: autoLanguage,
            judge0_enabled: isCoding ? true : undefined,
          };
        } else {
          updated[topicIndex].questionTypeConfigs = [
            {
              questionType: questionType,
              difficulty: "Medium",
              numQuestions: 1,
              language: autoLanguage,
              judge0_enabled: isCoding ? true : undefined,
            },
          ];
        }

        setTopicConfigs(updated);

        // CRITICAL: Reset regenerating state immediately after topic regeneration succeeds
        // Question generation will happen in background but button should show normal state
        setRegeneratingTopicIndex(null);

        // Generate questions only for this regenerated topic (in background)
        const topicConfig = updated[topicIndex];

        // Ensure we have valid question type configs
        if (
          !topicConfig.questionTypeConfigs ||
          topicConfig.questionTypeConfigs.length === 0
        ) {
          setError("No question type configuration found for this topic");
          return;
        }

        const flattenedTopic = topicConfig.questionTypeConfigs
          .filter((qtc) => qtc.numQuestions > 0) // Only include configs with questions
          .map((qtc) => ({
            topic: topicConfig.topic,
            questionType: qtc.questionType || "MCQ",
            difficulty: qtc.difficulty || "Medium",
            numQuestions: qtc.numQuestions || 1,
            isAptitude: topicConfig.isAptitude || false,
            subTopic: topicConfig.subTopic || undefined,
            language: qtc.language || undefined,
            judge0_enabled:
              qtc.judge0_enabled !== undefined ? qtc.judge0_enabled : undefined,
          }));

        // Only generate if we have valid topics with questions
        if (flattenedTopic.length === 0) {
          setError("No valid question configurations found for this topic");
          return;
        }

        // Use the skills we already fetched at the beginning
        // skillsToUse is already set from the beginning of the function

        // Generate questions for this topic only (async, don't block UI)
        try {
          const generateResponse =
            await generateQuestionsFromConfigMutation.mutateAsync({
              assessmentId,
              skill: skillsToUse.join(", "),
              topics: flattenedTopic,
            });

          if (generateResponse?.success) {
            // Update questions state - remove old questions for this topic and add new ones
            const newQuestions: any[] = [];

            // Collect all questions from all topics in the response
            if (
              generateResponse.data?.topics &&
              Array.isArray(generateResponse.data.topics)
            ) {
              generateResponse.data.topics.forEach((t: any) => {
                if (
                  t.questions &&
                  Array.isArray(t.questions) &&
                  t.questions.length > 0
                ) {
                  // Ensure each question has the correct topic name (use newTopicName in case it changed)
                  const questionsWithTopic = t.questions.map((q: any) => ({
                    ...q,
                    topic: newTopicName, // Ensure all questions have the new topic name
                  }));
                  newQuestions.push(...questionsWithTopic);
                }
              });
            }

            console.log(
              `[Topic Regeneration] Backend returned ${newQuestions.length} new questions for topic '${newTopicName}'`,
            );
            console.log(`[Topic Regeneration] Response structure:`, {
              hasData: !!generateResponse.data,
              hasTopics: !!generateResponse.data?.topics,
              topicsCount: generateResponse.data?.topics?.length || 0,
              totalQuestions: generateResponse.data?.totalQuestions || 0,
            });
            console.log(
              `[Topic Regeneration] New questions breakdown:`,
              newQuestions.map((q: any, idx: number) => ({
                index: idx,
                topic: q.topic,
                type: q.type,
                questionPreview:
                  q.questionText?.substring(0, 30) ||
                  q.question?.substring(0, 30) ||
                  "N/A",
              })),
            );

            if (newQuestions.length === 0) {
              console.warn(
                `[Topic Regeneration] No questions were generated for topic '${newTopicName}'. Check backend response.`,
              );
              setError("No questions were generated. Please try again.");
              return;
            }

            // Filter out old questions for both old and new topic names (in case topic name changed)
            const updatedQuestions = questions.filter(
              (q: any) => q.topic !== topic.topic && q.topic !== newTopicName,
            );
            setQuestions([...updatedQuestions, ...newQuestions]);

            // Preview questions removed - no longer updating preview state

            console.log(
              `[Topic Regeneration] Successfully updated: Generated ${newQuestions.length} new questions for topic '${newTopicName}'. Removed old questions for '${topic.topic}'.`,
            );
          } else {
            console.error(
              `[Topic Regeneration] Backend response was not successful:`,
              generateResponse.data,
            );
            setError("Failed to generate questions. Please try again.");
          }
        } catch (genErr: any) {
          // Log error but don't block - topic regeneration already succeeded
          console.error(
            "Error generating questions after topic regeneration:",
            genErr,
          );
          setError(
            "Topic regenerated successfully, but failed to generate questions. You can generate questions later.",
          );
        }
      } else {
        setError("Failed to regenerate topic");
      }
    } catch (err: any) {
      console.error("Error regenerating topic:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to regenerate topic",
      );
    } finally {
      setRegeneratingTopicIndex(null);
    }
  };

  const handleNextToStation2 = async () => {
    // Validate required fields
    if (!jobDesignation.trim()) {
      setError("Job Designation / Domain is required");
      return;
    }

    // If topics haven't been generated yet, generate them first
    if (topics.length === 0) {
      if (selectedSkills.length === 0) {
        setError("Please select at least one skill to assess");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const response = await createFromJobDesignationMutation.mutateAsync({
          jobDesignation: jobDesignation.trim(),
          selectedSkills: selectedSkills,
          experienceMin: experienceMin.toString(),
          experienceMax: experienceMax.toString(),
          experienceMode: experienceMode,
        });

        if (response?.success) {
          const data = response.data;
          const isAptitude = data?.assessment?.isAptitudeAssessment || false;
          setTopics(data.assessment.topics.map((t: any) => t.topic));
          setAvailableQuestionTypes(data.questionTypes || QUESTION_TYPES);
          const newAssessmentId = data.assessment._id || data.assessment.id;
          setAssessmentId(newAssessmentId);

          // Note: Draft will be saved automatically when navigating away (browser back or Back to Dashboard button)

          const newTopicConfigs = data.assessment.topics.map((t: any) => {
            // Check if this specific topic is an aptitude topic
            const isTopicAptitude =
              t.isAptitude === true ||
              (isAptitude && t.category === "aptitude");

            if (isTopicAptitude) {
              // Handle aptitude topic
              const availableSubTopics =
                t.availableSubTopics || t.subTopics || [];
              const defaultSubTopic =
                availableSubTopics.length > 0
                  ? availableSubTopics[0]
                  : undefined;
              const selectedSubTopic = t.subTopic || defaultSubTopic;

              // Get question type based on selected sub-topic
              let defaultQuestionType = "MCQ"; // Default for aptitude
              if (
                selectedSubTopic &&
                t.aptitudeStructure?.subTopics?.[selectedSubTopic]
              ) {
                const questionTypes =
                  t.aptitudeStructure.subTopics[selectedSubTopic];
                defaultQuestionType =
                  questionTypes.length > 0 ? questionTypes[0] : "MCQ";
              }

              return {
                topic: t.topic,
                questionTypeConfigs: [
                  {
                    questionType: defaultQuestionType,
                    difficulty: t.difficulty || "Medium",
                    numQuestions: 1,
                  },
                ],
                isAptitude: true,
                subTopic: selectedSubTopic,
                aptitudeStructure: t.aptitudeStructure || undefined,
                availableSubTopics: availableSubTopics,
              };
            } else {
              // Handle technical topic - use topic-specific question type from backend
              // The backend now determines question type based on topic context
              const questionType = t.questionTypes?.[0] || "MCQ";
              const isCoding = questionType === "coding";
              const autoLanguage = isCoding
                ? getLanguageFromTopic(t.topic)
                : undefined;

              return {
                topic: t.topic,
                questionTypeConfigs: [
                  {
                    questionType: questionType,
                    difficulty: t.difficulty || "Medium",
                    numQuestions: 1,
                    language: autoLanguage,
                    judge0_enabled: isCoding ? true : undefined,
                  },
                ],
                isAptitude: false,
                coding_supported:
                  t.coding_supported !== undefined
                    ? t.coding_supported
                    : isCoding
                      ? true
                      : undefined,
              };
            }
          });
          setTopicConfigs(newTopicConfigs);
          // After generating topics, navigate to Station 2
          setError(null);
          setHasVisitedConfigureStation(true);
          if (!hasVisitedReviewStation) {
            originalTopicConfigsRef.current = JSON.parse(
              JSON.stringify(newTopicConfigs),
            );
          }
          setCurrentStation(3); // Skip Station 2
        } else {
          setError("Failed to generate topics");
        }
      } catch (err: any) {
        console.error("Error generating topics:", err);
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to generate topics",
        );
      } finally {
        setLoading(false);
      }
    } else {
      // Topics already generated, just navigate
      setError(null);
      setHasVisitedConfigureStation(true);
      if (!hasVisitedReviewStation) {
        originalTopicConfigsRef.current = JSON.parse(
          JSON.stringify(topicConfigs),
        );
      }
      setCurrentStation(3); // Skip Station 2
    }
  };

  const handleNextToStation3 = async () => {
    if (topicConfigs.length === 0) {
      setError("Please configure at least one topic");
      return;
    }

    // Filter out topics with empty names
    const validConfigs = topicConfigs.filter((tc) => tc.topic.trim() !== "");
    if (validConfigs.length === 0) {
      setError("Please enter at least one topic name");
      return;
    }

    // Validate configurations - for aptitude topics, sub-topic is required
    // Each topic must have at least one valid question type config
    const invalidConfigs = validConfigs.filter((tc) => {
      // Check if topic has at least one question type config
      if (!tc.questionTypeConfigs || tc.questionTypeConfigs.length === 0) {
        return true;
      }

      // Check if all question type configs are valid
      const invalidConfigs = tc.questionTypeConfigs.filter(
        (qtc) => !qtc.questionType || !qtc.difficulty || qtc.numQuestions < 1,
      );
      if (invalidConfigs.length > 0) {
        return true;
      }

      // For aptitude topics, sub-topic is required
      const aptitudeInvalid = tc.isAptitude && !tc.subTopic;
      return aptitudeInvalid;
    });
    if (invalidConfigs.length > 0) {
      setError(
        "Please complete all configurations for all topics. Each topic must have at least one question type with valid difficulty and number of questions. Aptitude topics require a sub-topic selection.",
      );
      return;
    }

    // Update topicConfigs to only include valid topics
    setTopicConfigs(validConfigs);

    // Transform topics to flat structure for API (one entry per question type config)
    const flattenedTopics = validConfigs.flatMap((tc) => {
      return tc.questionTypeConfigs.map((qtc) => ({
        topic: tc.topic,
        questionType: qtc.questionType,
        difficulty: qtc.difficulty,
        numQuestions: qtc.numQuestions,
        isAptitude: tc.isAptitude,
        subTopic: tc.subTopic,
        language: qtc.language,
        judge0_enabled: qtc.judge0_enabled,
      }));
    });

    // Check if we need to regenerate questions
    // Only regenerate if:
    // 1. User has visited Review station (came back from Review)
    // 2. Edit mode was active
    // 3. Changes were made (compare with original configs)
    const shouldRegenerate =
      hasVisitedReviewStation &&
      JSON.stringify(validConfigs) !==
        JSON.stringify(originalTopicConfigsRef.current);

    if (shouldRegenerate) {
      setGenerating(true);
      setError(null);

      try {
        const response = await generateQuestionsFromConfigMutation.mutateAsync({
          assessmentId: assessmentId || "",
          skill: selectedSkills.join(", "),
          topics: flattenedTopics,
        });

        if (response?.success) {
          const allQuestions: any[] = [];
          response.data?.topics?.forEach((topic: any) => {
            if (topic.questions && topic.questions.length > 0) {
              allQuestions.push(...topic.questions);
            }
          });
          setQuestions(allQuestions);
          // Update original configs after regeneration
          originalTopicConfigsRef.current = JSON.parse(
            JSON.stringify(validConfigs),
          );
          setHasVisitedReviewStation(false);
          setCurrentStation(3);
        } else {
          setError("Failed to generate questions");
        }
      } catch (err: any) {
        console.error("Error generating questions:", err);
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to generate questions",
        );
      } finally {
        setGenerating(false);
      }
    } else {
      // No regeneration needed
      if (!hasVisitedReviewStation) {
        // First time generating, save original configs
        originalTopicConfigsRef.current = JSON.parse(
          JSON.stringify(validConfigs),
        );
        setGenerating(true);
        setError(null);

        try {
          const response =
            await generateQuestionsFromConfigMutation.mutateAsync({
              assessmentId: assessmentId || "",
              skill: selectedSkills.join(", "),
              topics: flattenedTopics,
            });

          if (response?.success) {
            const allQuestions: any[] = [];
            response.data?.topics?.forEach((topic: any) => {
              if (topic.questions && topic.questions.length > 0) {
                allQuestions.push(...topic.questions);
              }
            });
            setQuestions(allQuestions);
            setCurrentStation(3);
          } else {
            setError("Failed to generate questions");
          }
        } catch (err: any) {
          console.error("Error generating questions:", err);
          setError(
            err.response?.data?.message ||
              err.message ||
              "Failed to generate questions",
          );
        } finally {
          setGenerating(false);
        }
      } else {
        // Returning from Review without changes, just proceed
        setCurrentStation(3);
      }
    }
  };

  // handlePreviewQuestions removed - preview functionality removed

  // generateSingleQuestion removed - was only used for preview functionality

  const handleRemoveQuestion = (questionIndex: number) => {
    setQuestions(questions.filter((_, idx) => idx !== questionIndex));
  };

  // Preview-related functions removed: handleEditQuestion, handleSaveEditedQuestion, handleRegenerateQuestion

  // Email validation function
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddCandidate = async () => {
    // Validate email format
    const email = candidateEmail.trim().toLowerCase();
    const name = candidateName.trim();

    if (!name) {
      setEmailValidationError("Name is required");
      return;
    }

    if (!email) {
      setEmailValidationError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setEmailValidationError("Invalid email format");
      return;
    }

    // Check if email already exists (case insensitive)
    if (candidates.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
      setEmailValidationError("This candidate already exists in the list.");
      return;
    }

    setEmailValidationError(null);

    const newCandidate = {
      email,
      name,
      invited: false,
      status: "pending",
    };

    const updatedCandidates = [...candidates, newCandidate];
    setCandidates(updatedCandidates);
    setCandidateEmail("");
    setCandidateName("");
    setError(null);

    // Autosave to draft
    if (assessmentId) {
      try {
        await updateDraftMutation.mutateAsync({
          assessmentId,
          candidates: updatedCandidates,
          accessMode: accessMode,
        });
      } catch (err: any) {
        console.error("Error autosaving candidate:", err);
      }
    }
  };

  const handleRemoveCandidate = async (email: string) => {
    const updatedCandidates = candidates.filter(
      (c) => c.email.toLowerCase() !== email.toLowerCase(),
    );
    setCandidates(updatedCandidates);

    // Autosave to draft
    if (assessmentId) {
      try {
        await updateDraftMutation.mutateAsync({
          assessmentId,
          candidates: updatedCandidates,
          accessMode: accessMode,
        });
      } catch (err: any) {
        console.error("Error autosaving after remove:", err);
      }
    }
  };

  const handleCsvUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith(".csv")) {
      setError("Please upload a CSV file");
      return;
    }

    setUploadingCsv(true);
    setError(null);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((line) => line.trim());

      if (lines.length === 0) {
        setError("CSV file is empty");
        setUploadingCsv(false);
        return;
      }

      // Parse header row
      const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const nameIndex = header.findIndex((h) => h === "name");
      const emailIndex = header.findIndex((h) => h === "email");

      if (nameIndex === -1 || emailIndex === -1) {
        setError("CSV must contain 'name' and 'email' columns");
        setUploadingCsv(false);
        return;
      }

      // Parse data rows
      const newCandidates: Array<{ email: string; name: string }> = [];
      const existingEmails = new Set(
        candidates.map((c) => c.email.toLowerCase()),
      );
      const duplicateEmails: string[] = [];
      const invalidRows: number[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(",").map((cell) => cell.trim());
        const email = row[emailIndex]?.trim();
        const name = row[nameIndex]?.trim();

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !name || !emailRegex.test(email)) {
          invalidRows.push(i + 1);
          continue;
        }

        // Check for duplicates in CSV
        if (
          newCandidates.some(
            (c) => c.email.toLowerCase() === email.toLowerCase(),
          )
        ) {
          duplicateEmails.push(email);
          continue;
        }

        // Check for duplicates with existing candidates
        if (existingEmails.has(email.toLowerCase())) {
          duplicateEmails.push(email);
          continue;
        }

        newCandidates.push({ email, name });
        existingEmails.add(email.toLowerCase());
      }

      if (newCandidates.length === 0) {
        let errorMsg = "No valid candidates found in CSV. ";
        if (invalidRows.length > 0) {
          errorMsg += `Invalid rows: ${invalidRows.slice(0, 5).join(", ")}${invalidRows.length > 5 ? "..." : ""}. `;
        }
        if (duplicateEmails.length > 0) {
          errorMsg += `Duplicate emails: ${duplicateEmails.slice(0, 5).join(", ")}${duplicateEmails.length > 5 ? "..." : ""}.`;
        }
        setError(errorMsg);
        setUploadingCsv(false);
        return;
      }

      // Add new candidates
      setCandidates([...candidates, ...newCandidates]);

      // Show success message with warnings if any
      if (invalidRows.length > 0 || duplicateEmails.length > 0) {
        let warningMsg = `Successfully added ${newCandidates.length} candidate(s). `;
        if (invalidRows.length > 0) {
          warningMsg += `Skipped ${invalidRows.length} invalid row(s). `;
        }
        if (duplicateEmails.length > 0) {
          warningMsg += `Skipped ${duplicateEmails.length} duplicate email(s).`;
        }
        setError(warningMsg);
      } else {
        setError(null);
      }
    } catch (err: any) {
      console.error("Error parsing CSV:", err);
      setError("Error reading CSV file. Please check the file format.");
    } finally {
      setUploadingCsv(false);
      // Reset file input
      event.target.value = "";
    }
  };

  const handleBackToDashboard = async () => {
    if (!assessmentId) {
      // If no assessment ID, just navigate to dashboard
      router.push("/dashboard");
      return;
    }

    try {
      // Ensure we have a title - use job designation as fallback
      const titleToSave =
        finalTitle ||
        (jobDesignation.trim()
          ? `Assessment for ${jobDesignation.trim()}`
          : "Untitled Assessment");

      // Save all current state to draft before navigating
      const draftData: any = {
        assessmentId: assessmentId || undefined,
        title: titleToSave,
        description: finalDescription || "",
        jobDesignation: jobDesignation.trim(),
        selectedSkills: selectedSkills,
        experienceMin: experienceMin,
        experienceMax: experienceMax,
      };

      // Add topics if configured
      if (topicConfigs.length > 0) {
        draftData.topics = topicConfigs;
      }

      // Add questions if available (from Station 3)
      if (questions.length > 0) {
        draftData.questions = questions;
        draftData.passPercentage = passPercentage;
      }

      // Add schedule if available (from Station 4)
      if (startTime && endTime) {
        // Normalize datetime strings to ISO format
        const normalizeDateTime = (dt: string): string => {
          if (!dt) return dt;
          if (dt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
            const dtWithSeconds = dt + ":00";
            const istDate = new Date(dtWithSeconds + "+05:30");
            if (!isNaN(istDate.getTime())) {
              return istDate.toISOString();
            } else {
              return dt + ":00Z";
            }
          }
          if (dt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
            return dt + "Z";
          }
          return dt;
        };

        draftData.schedule = {
          startTime: normalizeDateTime(startTime),
          endTime: normalizeDateTime(endTime),
        };
      }

      // Add candidates if available (from Station 5)
      if (candidates.length > 0) {
        draftData.candidates = candidates;
      }

      if (assessmentUrl) {
        draftData.assessmentUrl = assessmentUrl;
      }

      // Save draft
      await updateDraftMutation.mutateAsync(draftData);

      // Navigate to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Error saving draft before navigating:", err);
      // Still navigate to dashboard even if save fails
      router.push("/dashboard");
    }
  };

  const handleGenerateUrl = async () => {
    if (!assessmentId) {
      setError("Assessment ID not found");
      return;
    }

    // Generate unique URL - using assessment ID and a random token
    const token =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const url = `${window.location.origin}/assessment/${assessmentId}/${token}`;
    setAssessmentUrl(url);

    // Save schedule and candidates to backend
    try {
      // Normalize datetime strings to ISO format with seconds and timezone
      // datetime-local input gives format: YYYY-MM-DDTHH:MM (no seconds, no timezone)
      // We need to convert IST (UTC+5:30) to UTC and add seconds
      const normalizeDateTime = (dt: string): string => {
        if (!dt) return dt;

        // If format is YYYY-MM-DDTHH:MM (missing seconds), add :00
        if (dt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
          // Parse as IST (UTC+5:30) and convert to UTC ISO string
          // datetime-local input is in local timezone, but we treat it as IST
          // Create a date object assuming IST timezone
          const dtWithSeconds = dt + ":00";
          // Create date assuming IST (UTC+5:30)
          const istDate = new Date(dtWithSeconds + "+05:30");

          if (!isNaN(istDate.getTime())) {
            // Convert to ISO string (UTC)
            return istDate.toISOString();
          } else {
            // Fallback: just add seconds and Z
            return dt + ":00Z";
          }
        }

        // If already has seconds but no timezone, add Z
        if (dt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
          return dt + "Z";
        }

        return dt;
      };

      // Prepare schedule data based on exam mode
      // Backend exam modes:
      // - "strict": All candidates start at exact startTime
      // - "flexible": Candidates can start anytime between startTime and endTime
      
      console.log("=== SCHEDULE DATA PREPARATION START ===");
      console.log("Current examMode:", examMode);
      console.log("Current startTime:", startTime);
      console.log("Current endTime:", endTime);
      console.log("Current duration:", duration);
      
      const scheduleData: any = {
        examMode,
        duration: parseInt(duration || "0"),
      };

      // Validate required fields based on exam mode
      if (examMode === "strict") {
        console.log("📋 STRICT MODE - Validating required fields...");
        // Strict mode requires: startTime and duration
        if (!startTime) {
          console.error("❌ ERROR: Start time is required for strict mode");
          throw new Error("Start time is required for this mode");
        }
        if (!duration || parseInt(duration) <= 0) {
          console.error("❌ ERROR: Duration is required");
          throw new Error("Duration is required");
        }
        scheduleData.startTime = normalizeDateTime(startTime);
        console.log("✅ Strict mode validation passed");
        console.log("   - startTime (normalized):", scheduleData.startTime);
        console.log("   - duration:", scheduleData.duration);
      } else if (examMode === "flexible") {
        console.log("📋 FLEXIBLE MODE - Validating required fields...");
        // Flexible mode requires: startTime, endTime, and duration
        if (!startTime) {
          console.error("❌ ERROR: Start time is required");
          throw new Error("Start time is required");
        }
        if (!endTime) {
          console.error("❌ ERROR: End time is required for flexible mode");
          throw new Error("End time is required for flexible mode");
        }
        if (!duration || parseInt(duration) <= 0) {
          console.error("❌ ERROR: Duration is required");
          throw new Error("Duration is required");
        }
        scheduleData.startTime = normalizeDateTime(startTime);
        scheduleData.endTime = normalizeDateTime(endTime);
        console.log("✅ Flexible mode validation passed");
        console.log("   - startTime (normalized):", scheduleData.startTime);
        console.log("   - endTime (normalized):", scheduleData.endTime);
        console.log("   - duration:", scheduleData.duration);
      }

      console.log("📦 Final scheduleData object:", JSON.stringify(scheduleData, null, 2));

      // Include section timers if enabled
      if (enablePerSectionTimers) {
        scheduleData.enablePerSectionTimers = true;
        scheduleData.sectionTimers = sectionTimers;
        console.log("⏱️  Section timers enabled:", sectionTimers);
      }

      console.log("🚀 Calling updateScheduleAndCandidatesMutation with payload:");
      const payload = {
        assessmentId,
        ...scheduleData,
        candidates: accessMode === "private" ? candidates : [],
        assessmentUrl: url,
        token,
        accessMode: accessMode,
        invitationTemplate:
          accessMode === "private" ? invitationTemplate : undefined,
      };
      console.log(JSON.stringify(payload, null, 2));

      await updateScheduleAndCandidatesMutation.mutateAsync(payload);
      
      console.log("✅ updateScheduleAndCandidatesMutation completed successfully");
      console.log("=== SCHEDULE DATA PREPARATION END ===");
    } catch (err: any) {
      console.error("Error saving schedule and candidates:", err);
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        err.message ||
        "Failed to save schedule and candidates";
      setError(errorMessage);
      throw err; // Re-throw to show error in UI
    }
  };


  const handleFinalize = async () => {
    setLoading(true);
    setError(null);

    try {
      // First, update all questions in the assessment
      // Group questions by topic
      const questionsByTopic: { [key: string]: any[] } = {};
      questions.forEach((q) => {
        const topic = q.topic || "Unknown";
        if (!questionsByTopic[topic]) {
          questionsByTopic[topic] = [];
        }
        questionsByTopic[topic].push(q);
      });

      // Update questions for each topic
      for (const [topic, topicQuestions] of Object.entries(questionsByTopic)) {
        try {
          await updateQuestionsMutation.mutateAsync({
            assessmentId: assessmentId || "",
            topic,
            questions: topicQuestions as any[],
            updatedQuestions: topicQuestions,
          });
        } catch (err) {
          console.error(`Error updating questions for topic ${topic}:`, err);
        }
      }

      // Then finalize with passPercentage
      // Fetch the assessment to get the title and description from Station 1
      let assessmentTitle = "";
      let assessmentDescription = "";
      try {
        await refetchAssessment();
        if (assessmentData) {
          assessmentTitle = assessmentData.title || "";
          assessmentDescription = assessmentData.description || "";
        }
      } catch (err) {
        console.error("Error fetching assessment for title:", err);
      }

      console.log("=".repeat(80));
      console.log("[FRONTEND] FINALIZING ASSESSMENT");
      console.log("[FRONTEND] assessmentId:", assessmentId);
      console.log(
        "[FRONTEND] title:",
        assessmentTitle.trim() || "Untitled Assessment",
      );
      console.log("[FRONTEND] scoringRules:", scoringRules);
      console.log("[FRONTEND] passPercentage:", passPercentage);
      console.log("[FRONTEND] enablePerSectionTimers:", enablePerSectionTimers);
      console.log(
        "[FRONTEND] sectionTimers:",
        enablePerSectionTimers ? sectionTimers : undefined,
      );
      console.log("[FRONTEND] ScoringRules keys:", Object.keys(scoringRules));
      console.log(
        "[FRONTEND] ScoringRules values:",
        Object.values(scoringRules),
      );
      console.log("=".repeat(80));

      const response = await finalizeAssessmentMutation.mutateAsync({
        assessmentId: assessmentId || "",
        title: assessmentTitle.trim() || "Untitled Assessment",
        description: assessmentDescription.trim() || undefined,
        passPercentage: passPercentage,
        scoringRules: scoringRules,
        enablePerSectionTimers: enablePerSectionTimers,
        sectionTimers: enablePerSectionTimers ? sectionTimers : undefined,
      });

      console.log("[FRONTEND] Finalize response:", response.data);

      if (response?.success) {
        // SINGLE DRAFT: No need to clear localStorage - backend maintains single draft
        setCurrentStation(4);
      } else {
        setError("Failed to finalize assessment");
      }
    } catch (err: any) {
      console.error("Error finalizing assessment:", err);
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to finalize assessment",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Loading Skeleton Overlay */}
      <QuestionGenerationSkeleton
        progress={generationProgress}
        show={showGenerationSkeleton}
      />

      <div className="create-new-assessment-page">
        <div className="create-new-container">
          <div className="create-new-card card">
            {/* Sticky header – glass, pill buttons, progress */}
            <div className="create-new-sticky-header">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.25rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
                  <button
                    type="button"
                    className="create-new-btn-back"
                    onClick={() => {
                      if (currentStation > 1) {
                        // Skip station 2 when going back
                        if (currentStation === 3) {
                          setCurrentStation(1);
                        } else if (currentStation === 4.5) {
                          setCurrentStation(4);
                        } else if (currentStation === 5) {
                          setCurrentStation(4.5);
                        } else {
                          setCurrentStation(currentStation - 1);
                        }
                      } else {
                        handleBackToDashboard();
                      }
                    }}
                  >
                    <ArrowLeft size={20} strokeWidth={2.5} /> Back
                  </button>
                  {currentStation < 6 && (
                    <button
                      type="button"
                      className="create-new-btn-skip"
                      onClick={() => {
                        // Skip station 2 when going forward
                        if (currentStation === 1) {
                          setCurrentStation(3);
                        } else if (currentStation === 4) {
                          setCurrentStation(4.5);
                        } else if (currentStation === 4.5) {
                          setCurrentStation(5);
                        } else {
                          setCurrentStation(currentStation + 1);
                        }
                      }}
                    >
                      Skip <FastForward size={18} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className="create-new-btn-save-draft"
                  onClick={async () => {
                    if (assessmentId) {
                      try {
                        const titleToSave =
                          finalTitle ||
                          (jobDesignation.trim()
                            ? `Assessment for ${jobDesignation.trim()}`
                            : "Untitled Assessment");
                        await updateDraftMutation.mutateAsync({
                          assessmentId,
                          title: titleToSave,
                          description: finalDescription || "",
                          jobDesignation: jobDesignation.trim(),
                          selectedSkills: selectedSkills,
                          experienceMin: experienceMin,
                          experienceMax: experienceMax,
                          experienceMode: experienceMode,
                          topics_v2: topicsV2,
                        });
                        alert("Draft saved successfully");
                      } catch (err) {
                        console.error("Failed to save draft", err);
                      }
                    }
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  Save Draft
                </button>
              </div>
              <div className="create-new-progress-track">
                <div
                  className="create-new-progress-fill"
                  style={{ 
                    width: `${(() => {
                      // Map station numbers to step positions (1-6)
                      const stationToStep: Record<number, number> = { 1: 1, 3: 2, 4: 3, 4.5: 4, 5: 5, 6: 6 };
                      const currentStep = stationToStep[currentStation] || 1;
                      return (currentStep / 6) * 100;
                    })()}%` 
                  }}
                />
              </div>
              <div className="create-new-step-dots" aria-label="Progress">
                {[1, 3, 4, 4.5, 5, 6].map((step) => (
                  <span
                    key={step}
                    className={`create-new-step-dot ${currentStation === step ? "active" : currentStation > step ? "done" : ""}`}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div
                className="alert alert-error"
                style={{ marginBottom: "1.5rem" }}
              >
                {error}
              </div>
            )}

            {loadingDraft && (
              <div
                className="alert"
                style={{
                  marginBottom: "1.5rem",
                  backgroundColor: "#f0f9ff",
                  border: "1px solid #3b82f6",
                }}
              >
                Loading draft assessment...
              </div>
            )}

            {/* Station 1: Topics */}
            {currentStation === 1 && (
              <div
                style={{
                  maxWidth: "800px",
                  margin: "0 auto",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                <div className="create-new-step-badge">Step 1 of 6</div>
                <h1 className="create-new-step-title">What&apos;s the job role?</h1>
                <p className="create-new-step-subtitle" style={{ marginBottom: "1.5rem" }}>We&apos;ll tailor topics and questions to this role.</p>

                {/* Job Designation Input */}
                <div style={{ marginBottom: "0.5rem" }}>
                  <input
                    type="text"
                    className="create-new-input"
                    value={jobDesignation}
                    onChange={(e) => setJobDesignation(e.target.value)}
                    placeholder="e.g. Frontend Developer, Full Stack Engineer"
                  />
                </div>
                <p className="create-new-hint" style={{ marginBottom: "1.5rem" }}>Be specific for better AI-generated questions.</p>

                {/* Manual Skills Input */}
                <div style={{ marginBottom: "1.5rem" }}>
                  <label className="create-new-label" style={{ display: "block", marginBottom: "0.5rem", fontSize: "0.875rem", fontWeight: "500", color: "#374151" }}>
                    Skills (Optional)
                    <span style={{ fontSize: "0.875rem", fontWeight: "normal", color: "#6B7280", marginLeft: "0.5rem" }}>
                      - Press Enter to add
                    </span>
                  </label>
                  <input
                    type="text"
                    className="create-new-input"
                    value={manualSkillInput}
                    onChange={(e) => setManualSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const skills = manualSkillInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
                        if (skills.length > 0) {
                          setSelectedSkills(prev => [...new Set([...prev, ...skills])]);
                          setManualSkillInput('');
                        }
                      }
                    }}
                    placeholder="Type a skill and press Enter (e.g. Java, React, Docker)"
                  />
                  <p className="create-new-hint" style={{ marginTop: "0.5rem", marginBottom: "0" }}>Add specific skills to include in the assessment.</p>
                </div>

                {/* Selected Skills Display */}
                {selectedSkills.length > 0 && (
                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.75rem", fontSize: "0.875rem", fontWeight: "600", color: "#1e293b" }}>
                      Selected Skills
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {selectedSkills.map((skill) => (
                        <div
                          key={skill}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            padding: "0.5rem 0.75rem",
                            backgroundColor: "#ecfdf5",
                            border: "1px solid #10b981",
                            borderRadius: "2rem",
                            fontSize: "0.875rem",
                            fontWeight: "500",
                            color: "#047857",
                          }}
                        >
                          <span>{skill}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedSkills(prev => prev.filter(s => s !== skill))}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "0",
                              display: "flex",
                              alignItems: "center",
                              color: "#047857",
                              fontSize: "1rem",
                              lineHeight: "1",
                            }}
                            aria-label={`Remove ${skill}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* HIDDEN LOGIC PRESERVED: 
      The actual skills display (topicCards) is usually shown here. 
      Based on the prompt, this should appear after clicking the button.
    */}
                {topicCards.length > 0 && (
                  <div
                    style={{
                      marginBottom: "3rem",
                      animation: "fadeIn 0.5s ease-in",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        marginBottom: "1rem",
                        fontWeight: 600,
                        color: "#1e293b",
                      }}
                    >
                      AI-Suggested Skills (Click to add)
                    </label>
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.75rem",
                      }}
                    >
                      {topicCards
                        .filter((card) => {
                          // Preserving existing filter logic
                          const cardLower = card.toLowerCase().trim();
                          const unsupportedFrameworks = [
                            "django",
                            "flask",
                            "fastapi",
                            "react",
                            "angular",
                            "vue",
                            "next",
                            "nextjs",
                            "express",
                            "spring",
                            "hibernate",
                            "laravel",
                            "symfony",
                            "rails",
                            "ruby on rails",
                            "asp.net",
                            "dotnet",
                            ".net",
                            "tensorflow",
                            "pytorch",
                            "keras",
                            "scikit-learn",
                            "scikit",
                            "pandas",
                            "numpy",
                            "matplotlib",
                            "seaborn",
                            "jupyter",
                            "jupyter notebook",
                            "selenium",
                            "cypress",
                            "jest",
                            "mocha",
                            "junit",
                            "pytest",
                            "unittest",
                            "maven",
                            "gradle",
                            "npm",
                            "yarn",
                            "webpack",
                            "babel",
                            "gulp",
                            "grunt",
                          ];
                          for (const framework of unsupportedFrameworks) {
                            if (
                              cardLower === framework ||
                              cardLower.startsWith(framework + " ")
                            )
                              return false;
                          }
                          return true;
                        })
                        .map((card) => (
                          <button
                            key={card}
                            type="button"
                            onClick={() => handleCardClick(card)}
                            style={{
                              padding: "0.5rem 1rem",
                              border: `1px solid ${selectedSkills.includes(card) ? "#10b981" : "#e2e8f0"}`,
                              borderRadius: "2rem", // Pill shape
                              backgroundColor: selectedSkills.includes(card)
                                ? "#ecfdf5"
                                : "#ffffff",
                              color: selectedSkills.includes(card)
                                ? "#047857"
                                : "#4b5563",
                              cursor: "pointer",
                              fontSize: "0.875rem",
                              fontWeight: selectedSkills.includes(card)
                                ? 600
                                : 400,
                              transition: "all 0.2s",
                            }}
                          >
                            {card} {selectedSkills.includes(card) && "✓"}
                          </button>
                        ))}
                    </div>
                  </div>
                )}

                {/* Continue – primary CTA */}
                <div style={{ marginTop: "1.5rem" }}>
                  <button
                    type="button"
                    className="create-new-btn-primary"
                    onClick={handleGenerateTopicsUnified}
                    disabled={loading || selectedSkills.length === 0}
                  >
                    {loading ? "Generating…" : (
                      <>Continue <ArrowRight size={18} /></>
                    )}
                  </button>
                  <p className="create-new-hint" style={{ marginTop: "0.75rem", marginBottom: 0 }}>Press Enter ↵</p>
                </div>
              </div>
            )}

            {/* Station 3: Review Questions */}

            {currentStation === 3 && (
              <div style={{ maxWidth: "800px", margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
                <div className="create-new-step-badge">Step 2 of 6</div>
                <h1 className="create-new-step-title">What experience level are you looking for?</h1>
                <p className="create-new-step-subtitle" style={{ marginBottom: "1.5rem" }}>This helps us tailor difficulty and question depth.</p>

                <div className="create-new-step-section" style={{ marginBottom: "1.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
                    {[
                      { label: "Junior", years: "0-2 yrs" },
                      { label: "Mid-Level", years: "3-5 yrs" },
                      { label: "Senior", years: "6-10 yrs" },
                      { label: "Lead", years: "10+ yrs" },
                    ].map((item, idx) => (
                      <div key={idx} style={{ textAlign: "center", flex: 1 }}>
                        <div style={{ fontWeight: 700, color: "#334155", fontSize: "1rem" }}>{item.label}</div>
                        <div style={{ color: "#64748b", fontSize: "0.875rem", fontWeight: 500 }}>{item.years}</div>
                      </div>
                    ))}
                  </div>

                  {/* Experience Slider Container */}
                  <div
                    style={{
                      position: "relative",
                      padding: "0 12.5%",
                      marginBottom: "3rem",
                    }}
                  >
                    <div style={{ height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", width: "100%", position: "relative" }}>
                      <div
                        style={{
                          position: "absolute", left: "0%",
                          width: experienceMin <= 2 ? "0%" : experienceMin <= 5 ? "33.33%" : experienceMin <= 10 ? "66.66%" : "100%",
                          height: "100%", backgroundColor: "#0f766e", borderRadius: "3px", transition: "width 0.3s ease",
                        }}
                      />
                      {[0, 1, 2, 3].map((point) => (
                        <div
                          key={point}
                          style={{
                            position: "absolute", left: `${point * 33.33}%`, top: "50%", transform: "translate(-50%, -50%)",
                            width: "10px", height: "10px",
                            backgroundColor: (point === 0 && experienceMin <= 2) || (point === 1 && experienceMin >= 3 && experienceMin <= 5) || (point === 2 && experienceMin >= 6 && experienceMin <= 10) || (point === 3 && experienceMin > 10) ? "#0f766e" : "#cbd5e1",
                            borderRadius: "50%", zIndex: 1,
                          }}
                        />
                      ))}
                      <div
                        style={{
                          position: "absolute",
                          left: experienceMin <= 2 ? "0%" : experienceMin <= 5 ? "33.33%" : experienceMin <= 10 ? "66.66%" : "100%",
                          top: "50%", transform: "translate(-50%, -50%)",
                          width: "24px", height: "24px", backgroundColor: "#0f766e", borderRadius: "50%",
                          border: "4px solid #ffffff", boxShadow: "0 2px 8px rgba(15, 118, 110, 0.25)", cursor: "pointer", transition: "left 0.3s ease", zIndex: 2,
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
                    {[
                      { label: "Junior", years: "0-2 yrs", min: 0, max: 2, key: "junior" },
                      { label: "Mid-Level", years: "3-5 yrs", min: 3, max: 5, key: "mid" },
                      { label: "Senior", years: "6-10 yrs", min: 6, max: 10, key: "senior" },
                      { label: "Lead", years: "10+ yrs", min: 11, max: 20, key: "lead" },
                    ].map((level) => {
                      const isSelected = experienceMin === level.min;
                      return (
                        <div
                          key={level.key}
                          onClick={() => { setExperienceMin(level.min); setExperienceMax(level.max); setError(null); }}
                          style={{
                            padding: "1.25rem 1rem",
                            borderRadius: "0.75rem",
                            border: isSelected ? "2px solid #0f766e" : "1px solid #e2e8f0",
                            backgroundColor: isSelected ? "#f0fdfa" : "#ffffff",
                            textAlign: "center",
                            cursor: "pointer",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <div style={{ fontWeight: 700, color: "#334155", fontSize: "1rem", marginBottom: "0.25rem" }}>{level.label}</div>
                          <div style={{ color: "#64748b", fontSize: "0.875rem", fontWeight: 500 }}>{level.years}</div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="create-new-hint" style={{ padding: "0.75rem 1rem", backgroundColor: "#f8fafc", borderRadius: "0.5rem" }}>
                    Selected: <span style={{ fontWeight: 600, color: "#334155" }}>
                      {experienceMin === 0 ? "Junior (0-2 years)" : experienceMin === 3 ? "Mid-Level (3-5 years)" : experienceMin === 6 ? "Senior (6-10 years)" : "Lead (10+ years)"}
                    </span>
                  </div>
                </div>

                {/* Continue Button */}
                <div style={{ marginTop: "3rem" }}>
                  <button
                    type="button"
                    className="create-new-btn-primary"
                    onClick={() => setCurrentStation(4)}
                  >
                    Continue <ArrowRight size={18} />
                  </button>
                  <p className="create-new-hint" style={{ marginTop: "0.75rem", marginBottom: 0 }}>Press Enter ↵</p>
                </div>
              </div>
            )}

            {/* Station 4: Configure topics and question types */}
            {currentStation === 4 && (
  <div style={{ maxWidth: "800px", margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
    <div className="create-new-step-badge">Step 3 of 6</div>
    <h1 className="create-new-step-title">Configure topics and question types</h1>
    <p className="create-new-step-subtitle" style={{ marginBottom: "1.5rem" }}>Review and edit question counts, types, and difficulty per topic.</p>

    <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
      <p className="create-new-hint" style={{ flex: 1, margin: 0 }}>✨ AI generated these topics based on your skills</p>
      <button
        type="button"
        className="create-new-btn-secondary"
        onClick={() => setShowCustomTopicModal(true)}
      >
        + Add Custom Topic
      </button>
    </div>

    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "3rem" }}>
      {topicsV2.map((topic) => {
        const totalQs = topic.questionRows.reduce(
          (sum, row) => sum + (typeof row.questionsCount === 'number' ? row.questionsCount : parseInt(String(row.questionsCount)) || 0),
          0,
        );
        return (
          <div key={topic.id} className="create-new-step-section">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                <span style={{ fontSize: "1.25rem" }}>⚡</span>
                <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#334155" }}>{topic.label}</h3>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                >
                  ⋮
                </button>
                <button
                  onClick={() => handleRemoveTopicV2(topic.id)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "1.25rem",
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "1rem" }}>
              <p className="create-new-hint" style={{ marginBottom: "0.75rem", color: "#475569", fontWeight: 600 }}>Select question types:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                {["MCQ", "Coding", "Subjective", "Pseudo Code"].map((type) => {
                  const rowType = type === "Pseudo Code" ? "PseudoCode" : type;
                  const row = topic.questionRows.find((r) => r.questionType === rowType);
                  const isSelected = !!row;
                  return (
                    <label
                      key={type}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: "0.6rem",
                        padding: "0.6rem 1rem",
                        border: `1.5px solid ${isSelected ? "#0f766e" : "#e2e8f0"}`,
                        borderRadius: "0.75rem",
                        backgroundColor: isSelected ? "#f0fdfa" : "#ffffff",
                        cursor: "pointer", transition: "all 0.2s ease", lineHeight: 1,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleQuestionType(topic.id, rowType)}
                        style={{ width: "16px", height: "16px", margin: 0, accentColor: "#0f766e" }}
                      />
                      <span style={{ fontSize: "0.875rem", fontWeight: 600, color: isSelected ? "#334155" : "#64748b", userSelect: "none" }}>{type}</span>
                      {isSelected && (
                        <div style={{ marginLeft: "6px", backgroundColor: "#e2e8f0", borderRadius: "6px", display: "flex", alignItems: "center", justifyContent: "center", height: "28px", width: "40px" }}>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={row.questionsCount}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              handleUpdateRow(topic.id, row.rowId, "questionsCount", parseInt(val) || 0);
                            }}
                            className="create-new-input"
                            style={{ width: "100%", border: "none", textAlign: "center", fontWeight: 700, outline: "none", backgroundColor: "transparent", fontSize: "0.85rem", padding: "0.25rem" }}
                          />
                        </div>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                paddingTop: "1.25rem",
                borderTop: "1px solid #f1f5f9",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.6rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.875rem",
                    color: "#64748b",
                    fontWeight: 500,
                  }}
                >
                  Difficulty:
                </span>
                <select
                  value={topic.questionRows[0]?.difficulty || "Medium"}
                  onChange={(e) =>
                    handleUpdateRow(
                      topic.id,
                      topic.questionRows[0]?.rowId,
                      "difficulty",
                      e.target.value
                    )
                  }
                  style={{
                    padding: "0.4rem 0.6rem",
                    borderRadius: "0.5rem",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#fff",
                    fontWeight: 600,
                    color: "#1e293b",
                    outline: "none",
                  }}
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              <div
                style={{
                  fontWeight: 800,
                  color: "#064e3b",
                  fontSize: "0.95rem",
                }}
              >
                Total: {totalQs} questions
              </div>
            </div>
          </div>
        );
      })}
    </div>

    {/* Summary Bar */}
    {(() => {
      const totalQuestions = topicsV2.reduce(
        (acc, t) =>
          acc +
          t.questionRows.reduce(
            (sum, r) => sum + (typeof r.questionsCount === 'number' ? r.questionsCount : parseInt(String(r.questionsCount)) || 0),
            0,
          ),
        0,
      );

      const totalSeconds = topicsV2.reduce((acc, topic) => {
        return (
          acc +
          topic.questionRows.reduce((rowAcc, row) => {
            const count = (row.questionsCount) || 0;
            const baseTime = getBaseTimePerQuestion(row.questionType);
            const multiplier = getDifficultyMultiplier(row.difficulty);
            return rowAcc + count * baseTime * multiplier;
          }, 0)
        );
      }, 0);

      const totalMinutes = Math.ceil(totalSeconds / 60);

      return (
        <div className="create-new-step-section" style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          <span style={{ fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: "0.5rem" }}><BookOpen size={18} strokeWidth={2.5} /> {topicsV2.length} topics</span>
          <span className="create-new-hint" style={{ margin: 0 }}>•</span>
          <span style={{ fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: "0.5rem" }}><FileText size={18} strokeWidth={2.5} /> {totalQuestions} questions</span>
          <span className="create-new-hint" style={{ margin: 0 }}>•</span>
          <span style={{ fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: "0.5rem" }}><Clock size={18} strokeWidth={2.5} /> ~{formatTime(totalMinutes)}</span>
        </div>
      );
    })()}

    <button type="button" className="create-new-btn-primary" onClick={handleNextToReviewQuestions} disabled={generatingAllQuestions} style={{ width: "220px", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
      {generatingAllQuestions ? "Generating..." : "Continue"} <ArrowRight size={20} strokeWidth={2.5} />
    </button>
  </div>
)}

            {/* --- ADD THIS MODAL COMPONENT HERE --- */}
            {showCustomTopicModal && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 1000,
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    padding: "2rem",
                    borderRadius: "1.5rem",
                    width: "100%",
                    maxWidth: "450px",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  <h2
                    style={{
                      color: "#064e3b",
                      marginBottom: "1.5rem",
                      fontWeight: 800,
                    }}
                  >
                    Add Custom Topic
                  </h2>

                  <div style={{ marginBottom: "1.5rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem" }}>Topic name</label>
                    <input type="text" value={customTopicInput} onChange={(e) => setCustomTopicInput(e.target.value)} placeholder="e.g. Advanced System Design" className="create-new-input" />
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: "1rem",
                      justifyContent: "flex-end",
                    }}
                  >
                    <button type="button" className="create-new-btn-secondary" onClick={() => setShowCustomTopicModal(false)}>Cancel</button>
                    <button type="button" className="create-new-btn-primary" onClick={() => { handleAddCustomTopicV2(true); setShowCustomTopicModal(false); }} style={{ maxWidth: "none" }}>
                      Add topic
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Station 4.5: Review Generated Questions */}
            {currentStation === 4.5 && (
              <div style={{ maxWidth: "900px", margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
                <div className="create-new-step-badge">Step 4 of 6</div>
                <h1 className="create-new-step-title">Review Generated Questions</h1>
                <p className="create-new-step-subtitle" style={{ marginBottom: "1.5rem" }}>Review the AI-generated questions for each topic. You can regenerate individual questions if needed.</p>

                {/* Summary */}
                {(() => {
                  const totalQuestions = topicsV2.reduce(
                    (acc, t) =>
                      acc +
                      t.questionRows.reduce(
                        (sum, r) => sum + (r.questions?.length || 0),
                        0,
                      ),
                    0,
                  );

                  return (
                    <div className="create-new-step-section" style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: "0.5rem" }}><BookOpen size={18} strokeWidth={2.5} /> {topicsV2.length} topics</span>
                      <span className="create-new-hint" style={{ margin: 0 }}>•</span>
                      <span style={{ fontWeight: 600, color: "#475569", display: "flex", alignItems: "center", gap: "0.5rem" }}><FileText size={18} strokeWidth={2.5} /> {totalQuestions} questions generated</span>
                    </div>
                  );
                })()}

                {/* Topics with Questions */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>
                  {topicsV2.map((topic) => {
                    const totalQs = topic.questionRows.reduce(
                      (sum, row) => sum + (row.questions?.length || 0),
                      0,
                    );
                    
                    return (
                      <div key={topic.id} className="create-new-step-section">
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <span style={{ fontSize: "1.25rem" }}>⚡</span>
                            <h3 style={{ margin: 0, fontSize: "1.125rem", fontWeight: 700, color: "#334155" }}>{topic.label}</h3>
                            <span className="create-new-hint" style={{ margin: 0 }}>({totalQs} questions)</span>
                          </div>
                        </div>

                        {/* Question Rows */}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          {topic.questionRows.map((row) => {
                            const rowKey = `${topic.id}_${row.rowId}`;
                            const isExpanded = expandedQuestionRows[rowKey];
                            
                            return (
                              <div key={row.rowId}>
                                {/* Row Header */}
                                <div
                                  style={{
                                    padding: "1rem",
                                    backgroundColor: "#f8fafc",
                                    borderRadius: "0.5rem",
                                    border: "1px solid #e2e8f0",
                                    cursor: "pointer",
                                  }}
                                  onClick={() => {
                                    setExpandedQuestionRows(prev => ({
                                      ...prev,
                                      [rowKey]: !prev[rowKey]
                                    }));
                                  }}
                                >
                                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                      <span style={{ fontWeight: 600, color: "#334155" }}>{row.questionType}</span>
                                      <span className="create-new-hint" style={{ margin: 0 }}>•</span>
                                      <span className="create-new-hint" style={{ margin: 0 }}>{row.difficulty}</span>
                                      <span className="create-new-hint" style={{ margin: 0 }}>•</span>
                                      <span className="create-new-hint" style={{ margin: 0 }}>{row.questions?.length || 0} questions</span>
                                    </div>
                                    <ChevronDown 
                                      size={20} 
                                      style={{ 
                                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                                        transition: "transform 0.2s ease",
                                        color: "#64748b"
                                      }} 
                                    />
                                  </div>
                                </div>

                                {/* Expanded Questions */}
                                {isExpanded && row.questions && row.questions.length > 0 && (
                                  <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "1rem", paddingLeft: "1rem" }}>
                                    {row.questions.map((question, qIndex) => {
                                      const questionId = `${topic.id}_${row.rowId}_${qIndex}`;
                                      const isRegenerating = regeneratingQuestionId === questionId;
                                      
                                      return (
                                        <div
                                          key={qIndex}
                                          style={{
                                            padding: "1.5rem",
                                            backgroundColor: "#ffffff",
                                            borderRadius: "0.5rem",
                                            border: "1px solid #e2e8f0",
                                            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                                          }}
                                        >
                                          {/* Question Header */}
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                                            <span style={{ fontWeight: 600, color: "#64748b", fontSize: "0.875rem" }}>
                                              Question {qIndex + 1}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setRegeneratingQuestionId(questionId);
                                                setRegenerateQuestionFeedback("");
                                              }}
                                              disabled={isRegenerating}
                                              style={{
                                                padding: "0.5rem 1rem",
                                                backgroundColor: isRegenerating ? "#e2e8f0" : "#ffffff",
                                                border: "1px solid #e2e8f0",
                                                borderRadius: "0.375rem",
                                                fontSize: "0.875rem",
                                                fontWeight: 600,
                                                color: isRegenerating ? "#94a3b8" : "#0f766e",
                                                cursor: isRegenerating ? "not-allowed" : "pointer",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.5rem",
                                              }}
                                            >
                                              <RefreshCw size={16} />
                                              {isRegenerating ? "Regenerating..." : "Regenerate"}
                                            </button>
                                          </div>

                                          {/* Question Content */}
                                          <div>
                                            {row.questionType === "MCQ" && renderMCQQuestion(question, false)}
                                            {row.questionType === "Coding" && renderCodingQuestion(question, false)}
                                            {row.questionType === "Subjective" && renderSubjectiveQuestion(question, false)}
                                            {row.questionType === "PseudoCode" && renderPseudoCodeQuestion(question, false)}
                                            {row.questionType === "SQL" && renderSqlQuestion(question, false)}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Continue Button */}
                <button 
                  type="button" 
                  className="create-new-btn-primary" 
                  onClick={() => {
                    console.log("📍 Navigating from Station 4.5 to Station 5 (Schedule)");
                    setCurrentStation(5);
                  }} 
                  style={{ width: "220px", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
                >
                  Continue to Schedule <ArrowRight size={20} strokeWidth={2.5} />
                </button>
              </div>
            )}

            {/* Regenerate Question Modal */}
            {regeneratingQuestionId && (
              <div
                style={{
                  position: "fixed",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  backgroundColor: "rgba(0, 0, 0, 0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 9999,
                }}
                onClick={() => {
                  setRegeneratingQuestionId(null);
                  setRegenerateQuestionFeedback("");
                }}
              >
                <div
                  style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "0.75rem",
                    padding: "2rem",
                    maxWidth: "500px",
                    width: "90%",
                    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 style={{ margin: 0, marginBottom: "1rem", fontSize: "1.25rem", fontWeight: 700, color: "#1e293b" }}>
                    Regenerate Question
                  </h3>
                  <p style={{ margin: 0, marginBottom: "1.5rem", color: "#64748b", fontSize: "0.875rem" }}>
                    Provide feedback to improve the regenerated question (optional)
                  </p>
                  <textarea
                    value={regenerateQuestionFeedback}
                    onChange={(e) => setRegenerateQuestionFeedback(e.target.value)}
                    placeholder="e.g., Make it more challenging, focus on practical scenarios..."
                    style={{
                      width: "100%",
                      minHeight: "100px",
                      padding: "0.75rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      marginBottom: "1.5rem",
                      fontFamily: "Inter, sans-serif",
                    }}
                  />
                  <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() => {
                        setRegeneratingQuestionId(null);
                        setRegenerateQuestionFeedback("");
                      }}
                      style={{
                        padding: "0.625rem 1.25rem",
                        backgroundColor: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#64748b",
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleRegenerateQuestion}
                      disabled={regenerateQuestionMutation.isPending}
                      style={{
                        padding: "0.625rem 1.25rem",
                        backgroundColor: regenerateQuestionMutation.isPending ? "#94a3b8" : "#0f766e",
                        border: "none",
                        borderRadius: "0.5rem",
                        fontSize: "0.875rem",
                        fontWeight: 600,
                        color: "#ffffff",
                        cursor: regenerateQuestionMutation.isPending ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                      }}
                    >
                      <RefreshCw size={16} />
                      {regenerateQuestionMutation.isPending ? "Regenerating..." : "Regenerate"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Station 5: Schedule */}
            {currentStation === 5 && (
              <div style={{ maxWidth: "800px", margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
                {(() => {
                  console.log("🏁 STATION 5 (Schedule) - Current State:");
                  console.log("  - examMode:", examMode);
                  console.log("  - startTime:", startTime);
                  console.log("  - endTime:", endTime);
                  console.log("  - duration:", duration);
                  console.log("  - assessmentId:", assessmentId);
                  return null;
                })()}
                <div className="create-new-step-badge">Step 5 of 6</div>
                <h1 className="create-new-step-title">Schedule assessment availability</h1>
                <p className="create-new-step-subtitle" style={{ marginBottom: "1.5rem" }}>Choose when candidates can take this assessment.</p>

                <div className="create-new-step-section">
                  <h2>Assessment Availability</h2>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "1rem",
                    }}
                  >
                    {[
                      {
                        id: "strict",
                        label: "Available Immediately (Default)",
                        sub: "All candidates start at the scheduled time and have the specified duration to complete",
                      },
                      {
                        id: "flexible",
                        label: "Schedule Specific Window",
                        sub: "Set start and end dates - candidates can start anytime within the window",
                      },
                      ].map((mode) => (
                      <label
                        key={mode.id}
                        style={{
                          display: "flex", alignItems: "flex-start", gap: "1rem", padding: "1rem",
                          backgroundColor: examMode === mode.id ? "#f8fafc" : "#ffffff",
                          border: `1.5px solid ${examMode === mode.id ? "#0f766e" : "#e2e8f0"}`,
                          borderRadius: "0.75rem", cursor: "pointer", transition: "0.2s ease",
                        }}
                      >
                        <input type="radio" name="examMode" value={mode.id} checked={examMode === mode.id} onChange={(e) => setExamMode(e.target.value as any)} style={{ marginTop: "4px", accentColor: "#0f766e", width: "18px", height: "18px" }} />
                        <div>
                          <div style={{ fontWeight: 600, color: "#334155" }}>{mode.label}</div>
                          <div className="create-new-hint" style={{ marginTop: "0.25rem", marginBottom: 0 }}>{mode.sub}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="create-new-step-section">
                  <h2>Assessment Window</h2>
                  <div style={{ display: "grid", gap: "1rem" }}>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.5rem" }}>Start Date & Time</label>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
                          <Calendar size={18} style={{ position: "absolute", left: "12px", color: "#64748b", pointerEvents: "none" }} />
                          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="create-new-input" style={{ paddingLeft: "2.5rem" }} />
                        </div>
                        <div className="create-new-hint" style={{ padding: "0.75rem 1rem", margin: 0, alignSelf: "center", display: "flex", alignItems: "center", gap: "0.375rem" }}><Globe size={16} /> IST +05:30</div>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.5rem" }}>End Date & Time</label>
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center" }}>
                          <Calendar size={18} style={{ position: "absolute", left: "12px", color: "#64748b", pointerEvents: "none" }} />
                          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} disabled={examMode === "strict"} className="create-new-input" style={{ paddingLeft: "2.5rem", opacity: examMode === "strict" ? 0.6 : 1 }} />
                        </div>
                        <div className="create-new-hint" style={{ padding: "0.75rem 1rem", margin: 0, alignSelf: "center", display: "flex", alignItems: "center", gap: "0.375rem" }}><Globe size={16} /> IST +05:30</div>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#334155" }}>Assessment Duration</label>
                      <p className="create-new-hint" style={{ marginTop: "0.25rem", marginBottom: "0.75rem" }}>How long candidates have to complete the assessment once they start</p>
                      <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        <Clock size={18} style={{ position: "absolute", left: "12px", color: "#64748b", pointerEvents: "none" }} />
                        <input 
                          type="number" 
                          value={duration} 
                          onChange={(e) => setDuration(e.target.value)} 
                          placeholder="60" 
                          min="1"
                          className="create-new-input" 
                          style={{ paddingLeft: "2.5rem", paddingRight: "5rem" }} 
                        />
                        <span style={{ position: "absolute", right: "12px", color: "#64748b", fontWeight: 600, fontSize: "0.875rem" }}>minutes</span>
                      </div>
                      <p className="create-new-hint" style={{ marginTop: "0.5rem", marginBottom: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <Info size={16} /> 
                        {examMode === "strict" 
                          ? "All candidates must start at the scheduled time and complete within this duration" 
                          : "Candidates can start anytime before the end date and will have this duration to complete"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="create-new-step-section">
                  <h2>Time zone</h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem", border: "1.5px solid #e2e8f0", borderRadius: "0.75rem", cursor: "pointer" }}>
                      <input type="radio" name="tz" style={{ accentColor: "#0f766e", width: "18px", height: "18px" }} />
                      <span style={{ fontWeight: 600, color: "#334155" }}>Organization timezone (IST +05:30)</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem", border: "1.5px solid #0f766e", backgroundColor: "#f0fdfa", borderRadius: "0.75rem", cursor: "pointer" }}>
                      <input type="radio" name="tz" defaultChecked style={{ accentColor: "#0f766e", width: "18px", height: "18px" }} />
                      <span style={{ fontWeight: 600, color: "#334155" }}>Candidate&apos;s local timezone (auto-detect)</span>
                    </label>
                  </div>
                  <p className="create-new-hint" style={{ marginTop: "0.75rem", marginBottom: 0, display: "flex", alignItems: "center", gap: "0.5rem" }}><Info size={16} /> Candidates will see times in their local timezone.</p>
                </div>

                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <button type="button" className="create-new-btn-secondary" onClick={() => setCurrentStation(4)}>Back</button>
                  <button type="button" className="create-new-btn-primary" onClick={() => {
                    console.log("📍 Navigating from Station 5 to Station 6 (Add Candidates)");
                    console.log("  - Current examMode:", examMode);
                    console.log("  - Current startTime:", startTime);
                    console.log("  - Current endTime:", endTime);
                    console.log("  - Current duration:", duration);
                    setCurrentStation(6);
                  }} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                    Continue to Add Candidates <ArrowRight size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            )}

            {/* Station 6: Add Candidates */}
            {currentStation === 6 && (
  <div style={{ maxWidth: "800px", margin: "0 auto", fontFamily: "Inter, sans-serif" }}>
    {!isCrafting && !showFinalReview && (
      <>
        <div className="create-new-step-badge">Step 6 of 6 · Final step</div>
        <h1 className="create-new-step-title">Add candidates</h1>
        <p className="create-new-step-subtitle" style={{ marginBottom: "1.5rem" }}>Choose how you want to add candidates.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div
            onClick={() => setActiveCandidateTab("individual")}
            className="create-new-step-section"
            style={{ cursor: "pointer", borderColor: activeCandidateTab === "individual" ? "#0f766e" : undefined, backgroundColor: activeCandidateTab === "individual" ? "#f0fdfa" : undefined }}
          >
            <div style={{ width: "40px", height: "40px", backgroundColor: "#e2e8f0", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.75rem" }}><User size={20} color="#475569" /></div>
            <div style={{ fontWeight: 600, color: "#334155", fontSize: "1rem" }}>Add individual</div>
            {activeCandidateTab === "individual" && <p className="create-new-hint" style={{ margin: "0.25rem 0 0", marginBottom: 0 }}>Selected</p>}
          </div>
          <div
            onClick={() => setActiveCandidateTab("bulk")}
            className="create-new-step-section"
            style={{ cursor: "pointer", borderColor: activeCandidateTab === "bulk" ? "#0f766e" : undefined, backgroundColor: activeCandidateTab === "bulk" ? "#f0fdfa" : undefined }}
          >
            <div style={{ width: "40px", height: "40px", backgroundColor: "#e2e8f0", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "0.75rem" }}><FileText size={20} color="#475569" /></div>
            <div style={{ fontWeight: 600, color: "#334155", fontSize: "1rem" }}>Bulk upload</div>
            {activeCandidateTab === "bulk" && <p className="create-new-hint" style={{ margin: "0.25rem 0 0", marginBottom: 0 }}>Selected</p>}
          </div>
        </div>

        {activeCandidateTab === "individual" ? (
          <div className="create-new-step-section" style={{ marginBottom: "1.5rem" }}>
            <h2>Candidate information</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem" }}>Name</label>
                <input type="text" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="John Doe" className="create-new-input" />
              </div>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem" }}>Email</label>
                <input type="email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} placeholder="john.doe@example.com" className="create-new-input" />
              </div>
              <button 
                type="button" 
                className="create-new-btn-primary" 
                onClick={handleAddCandidate} 
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}
              >
                <Plus size={18} /> Add Candidate
              </button>
            </div>
          </div>
        ) : (
          <div className="create-new-step-section" style={{ marginBottom: "1.5rem", textAlign: "center", borderStyle: "dashed" }}>
            <FileType size={40} color="#64748b" style={{ marginBottom: "1rem" }} />
            <h2 style={{ marginBottom: "0.5rem" }}>Drag & drop CSV or Excel</h2>
            <p className="create-new-hint" style={{ marginBottom: "1rem" }}>or click to browse</p>
            <button type="button" className="create-new-btn-primary" onClick={() => document.getElementById("csv-upload-input")?.click()} style={{ maxWidth: "none" }}>Browse files</button>
            <input type="file" id="csv-upload-input" accept=".csv, .xlsx, .xls" onChange={handleCsvUpload} style={{ display: "none" }} />
          </div>
        )}

        <div className="create-new-step-section" style={{ marginBottom: "1.5rem" }}>
          <h2>Added candidates ({candidates.length})</h2>
          {candidates.length === 0 ? (
            <div style={{ padding: "2rem", border: "1px dashed #e2e8f0", borderRadius: "0.75rem", backgroundColor: "#f8fafc", textAlign: "center" }}>
              <Sparkles size={32} color="#94a3b8" style={{ marginBottom: "0.75rem" }} />
              <p className="create-new-hint" style={{ margin: 0 }}>No candidates added yet</p>
            </div>
          ) : (
            <div style={{ display: "grid", gap: "0.5rem" }}>
              {candidates.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.75rem 1rem", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}>
                  <div style={{ width: "36px", height: "36px", backgroundColor: "#e2e8f0", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, color: "#475569", fontSize: "0.875rem" }}>{c.name.charAt(0).toUpperCase()}</div>
                  <div style={{ flex: 1 }}><div style={{ fontWeight: 600, color: "#334155" }}>{c.name}</div><div className="create-new-hint" style={{ margin: 0, fontSize: "0.8125rem" }}>{c.email}</div></div>
                  <button type="button" onClick={() => handleRemoveCandidate(c.email)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "0.25rem" }} aria-label="Remove"><X size={18} /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        <button 
          type="button" 
          className="create-new-btn-primary" 
          onClick={handleStartCrafting} 
          disabled={candidates.length === 0}
          style={{ 
            width: "100%", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            gap: "0.5rem",
            opacity: candidates.length === 0 ? 0.5 : 1,
            cursor: candidates.length === 0 ? "not-allowed" : "pointer"
          }}
        >
          Review Assessment <ChevronRight size={24} />
        </button>
        {candidates.length === 0 && (
          <p style={{ color: "#ef4444", fontSize: "0.875rem", marginTop: "0.5rem", textAlign: "center" }}>
            Please add at least one candidate before reviewing
          </p>
        )}
      </>
    )}

    {/* PHASE 2: AI Crafting Overlay */}
    {isCrafting && (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#EBFAFD", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
        <div style={{ width: "140px", height: "140px", backgroundColor: "#C9F4D4", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "3rem", fontSize: "4rem", boxShadow: "0 0 50px rgba(201, 244, 212, 0.6)" }}>✨</div>
        <h1 style={{ color: "#1E5A3B", fontSize: "2.8rem", fontWeight: 800, marginBottom: "2.5rem" }}>AI is Crafting Your Assessment</h1>
        <div style={{ width: "400px", height: "12px", backgroundColor: "#ffffff", borderRadius: "6px", marginBottom: "1.5rem", overflow: "hidden", border: "1px solid #C9F4D4" }}>
          <div style={{ width: `${craftingProgress}%`, height: "100%", backgroundColor: "#10b981", transition: "width 0.3s ease-out" }} />
        </div>
        <div style={{ color: "#1E5A3B", fontWeight: 800, fontSize: "2rem", marginBottom: "3rem" }}>{craftingProgress}%</div>
        
        <div style={{ display: 'grid', gap: '1rem', textAlign: 'left' }}>
          {[
            { label: 'Analyzing job requirements', done: craftingProgress > 25 },
            { label: 'Generating MCQ questions', done: craftingProgress > 50 },
            { label: 'Creating coding challenges', done: craftingProgress > 75 },
            { label: 'Finalizing assessment', done: craftingProgress > 90 }
          ].map((step, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: step.done ? '#1E5A3B' : '#4A9A6A', opacity: step.done ? 1 : 0.6 }}>
              <CheckCircle2 size={20} color={step.done ? "#10b981" : "#cbd5e1"} />
              <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* PHASE 3: Final Review Card */}
    {showFinalReview && (() => {
    
    const totalQuestionsCount = topicsV2.reduce(
        (acc, t) => acc + t.questionRows.reduce(
            (sum, r) => sum + (typeof r.questionsCount === 'number' ? r.questionsCount : parseInt(String(r.questionsCount)) || 0),
            0,
        ),
        0,
    );

    const totalSeconds = topicsV2.reduce((acc, topic) => {
        return (
            acc +
            topic.questionRows.reduce((rowAcc, row) => {
                const count = (typeof row.questionsCount === 'number' ? row.questionsCount : parseInt(String(row.questionsCount)) || 0);
                
                // Uses the same helper functions defined in your component for Station 4
                const baseTime = getBaseTimePerQuestion(row.questionType);
                const multiplier = getDifficultyMultiplier(row.difficulty);
                
                return rowAcc + count * baseTime * multiplier;
            }, 0)
        );
    }, 0);

    const calculatedMinutes = Math.ceil(totalSeconds / 60);

    const displayUrl = assessmentUrl && !assessmentUrl.includes('/null/') 
        ? assessmentUrl 
        : "Generating secure link...";

    // Normalize datetime strings to ISO format with timezone
    const normalizeDateTime = (dt: string): string => {
        if (!dt) return dt;
        if (dt.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)) {
            return dt + ':00+05:30';
        }
        return dt;
    };

    return (
        <div style={{ paddingBottom: '5rem' }}>
            <div style={{ textAlign: "center", marginBottom: "3.5rem" }}>
                <div style={{ width: '80px', height: '80px', backgroundColor: '#ecfdf5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                    <Sparkles size={40} color="#10b981" />
                </div>
                <h1 style={{ fontSize: "2.8rem", fontWeight: 800, color: "#1E5A3B", marginBottom: "0.5rem" }}>Almost There!</h1>
                <p style={{ color: "#2D7A52", fontSize: "1.125rem", fontWeight: 500 }}>Review your assessment before we generate questions</p>
            </div>

            {/* Dynamic Summary Card */}
            <div style={{ padding: "3rem", backgroundColor: "#ffffff", border: "1.5px solid #C9F4D4", borderRadius: "2rem", marginBottom: "2rem", boxShadow: "0 20px 40px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "2.5rem" }}>
                    <FileText size={32} color="#10b981" />
                    <h2 style={{ fontSize: "1.85rem", fontWeight: 800, color: "#1E5A3B", margin: 0 }}>{finalTitle || jobDesignation || "Assessment Summary"}</h2>
                </div>
                
                <div style={{ display: "grid", gap: "1.5rem", color: "#1E5A3B", fontSize: "1.05rem" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                        <span style={{ width: "150px", fontWeight: 700 }}>Skills:</span>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            {selectedSkills.map(s => <span key={s} style={{ padding: "0.3rem 0.9rem", border: "1px solid #C9F4D4", borderRadius: "100px", fontSize: "0.85rem", fontWeight: 700 }}>{s}</span>)}
                        </div>
                    </div>
                    <p style={{ margin: 0 }}><strong>Experience:</strong> <span style={{ color: "#2D7A52" }}>{"Junior (0-2 years)"}</span></p>
                    <div style={{ display: "flex", alignItems: "flex-start" }}>
                        <span style={{ width: "150px", fontWeight: 700 }}>Topics:</span>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", flex: 1 }}>
                            {topicsV2.map(t => <span key={t.id} style={{ padding: "0.4rem 0.9rem", backgroundColor: "#EBFAFD", border: '1px solid #C9F4D4', borderRadius: "8px", fontSize: "0.85rem", fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>📝 {t.label}</span>)}
                        </div>
                    </div>
                    
                    {/* Synchronized Totals */}
                    <p style={{ margin: 0 }}><strong>Total Questions:</strong> <span style={{ fontWeight: 800 }}>{totalQuestionsCount}</span></p>
                    
                    {/* FIXED: Uses formatTime helper to show identical format as Station 4 */}
                    <p style={{ margin: 0 }}><strong>Estimated Duration:</strong> <span style={{ color: "#2D7A52", fontWeight: 700 }}>~{formatTime(calculatedMinutes)}</span></p>

                    {/* Link Field */}
                    <div style={{ marginTop: "1rem", padding: "1.5rem", backgroundColor: "#EBFAFD", borderRadius: "1rem", border: "1.5px solid #C9F4D4" }}>
                        <label style={{ display: "block", fontSize: "0.875rem", fontWeight: 800, marginBottom: "0.75rem", color: '#1E5A3B' }}>Assessment Link</label>
                        <div style={{ display: "flex", gap: "0.5rem" }}>
                            <input readOnly value={displayUrl} style={{ flex: 1, padding: "0.75rem", border: "1.5px solid #C9F4D4", borderRadius: "0.6rem", fontSize: "0.95rem", outline: 'none', backgroundColor: '#ffffff', color: displayUrl.includes('Generating') ? '#94a3b8' : '#1E5A3B' }} />
                           <button 
    onClick={handleCopyUrl} 
    disabled={displayUrl.includes('Generating')} 
    style={{ 
        padding: "0.75rem 1.5rem", 
        // 🟢 Dynamic background color: Green if copied, Dark Green if original
        backgroundColor: isUrlCopied ? "#10b981" : "#1E5A3B", 
        color: "#ffffff", 
        border: "none", 
        borderRadius: "0.6rem", 
        cursor: "pointer", 
        fontWeight: 700, 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px', 
        opacity: displayUrl.includes('Generating') ? 0.5 : 1,
        transition: "all 0.3s ease" // Smooth transition between states
    }}
>
    {isUrlCopied ? (
        <>
            <Check size={16} /> Copied
        </>
    ) : (
        <>
            <Copy size={16} /> Copy
        </>
    )}
</button>
                        </div>
                    </div>

                    <button onClick={() => setCurrentStation(4)} style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '1rem', padding: '0.6rem 1.2rem', border: '1.5px solid #C9F4D4', borderRadius: '10px', backgroundColor: '#ffffff', color: '#10b981', fontWeight: 800, cursor: 'pointer' }}>
                        <Edit3 size={16} /> Edit
                    </button>
                </div>
            </div>


{/* --- Candidate Details Section --- */}
{candidates.length > 0 && (
    <div style={{ marginBottom: "2rem" }}>
        <h3 style={{ fontSize: "1.25rem", fontWeight: 800, color: "#1E5A3B", marginBottom: "1rem", display: 'flex', alignItems: 'center', gap: '8px' }}>
            <User size={24} color="#10b981" /> Added Candidates ({candidates.length})
        </h3>
        <div style={{ 
            display: "grid", 
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", 
            gap: "1rem",
            maxHeight: "300px", 
            overflowY: "auto",
            padding: "0.5rem"
        }}>
            {candidates.map((c, i) => (
                <div key={i} style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "1rem", 
                    padding: "1rem", 
                    backgroundColor: "#ffffff", 
                    border: "1.5px solid #C9F4D4", 
                    borderRadius: "1rem",
                    boxShadow: "0 4px 6px rgba(0,0,0,0.02)"
                }}>
                    <div style={{ 
                        width: "45px", 
                        height: "45px", 
                        backgroundColor: "#C9F4D4", 
                        borderRadius: "50%", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        fontWeight: 800, 
                        color: "#1E5A3B",
                        fontSize: "1.1rem"
                    }}>
                        {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontWeight: 800, color: "#1E5A3B", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.name}
                        </div>
                        <div style={{ fontSize: "0.85rem", color: "#4A9A6A", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {c.email}
                        </div>
                    </div>
                    {/* Status Badge to match theme */}
                    <div style={{ 
                        padding: "4px 8px", 
                        backgroundColor: "#EBFAFD", 
                        borderRadius: "6px", 
                        fontSize: "0.7rem", 
                        fontWeight: 700, 
                        color: "#10b981",
                        border: "1px solid #C9F4D4"
                    }}>
                        READY
                    </div>
                </div>
            ))}
        </div>
    </div>
)}

            {/* Navigation Buttons */}
            <div style={{ display: "flex", gap: "1.5rem", justifyContent: 'center', marginTop: "2rem" }}>
                <button 
                    onClick={() => setShowFinalReview(false)} 
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: "1rem 2rem", 
                        border: "1.5px solid #E2E8F0", 
                        borderRadius: "1rem", 
                        backgroundColor: "#ffffff", 
                        color: "#64748b", 
                        fontWeight: 600,
                        cursor: "pointer"
                    }}
                >
                    <ArrowLeft size={20} /> Back to Edit
                </button>
                <button 
                    onClick={async () => {
                        setLoading(true);
                        try {
                            if (assessmentId) {
                                await updateScheduleAndCandidatesMutation.mutateAsync({ 
                                    assessmentId, 
                                    examMode, 
                                    duration: calculatedMinutes, 
                                    startTime: startTime ? normalizeDateTime(startTime) : undefined, 
                                    endTime: endTime ? normalizeDateTime(endTime) : undefined, 
                                    candidates: accessMode === "private" ? candidates : [], 
                                    complete: true, 
                                    accessMode 
                                });
                                // Redirect to assessments dashboard
                                router.push("/assessments");
                            }
                        } catch (error) {
                            console.error("Error finalizing assessment:", error);
                            setError("Failed to finalize assessment. Please try again.");
                        } finally {
                            setLoading(false);
                        }
                    }}
                    disabled={loading}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: "1rem 2.5rem", 
                        backgroundColor: loading ? "#94a3b8" : "#10b981", 
                        color: "#ffffff", 
                        fontSize: "1.1rem", 
                        fontWeight: 900, 
                        border: "none", 
                        borderRadius: "1rem", 
                        cursor: loading ? "not-allowed" : "pointer", 
                        boxShadow: "0 10px 20px rgba(16, 185, 129, 0.2)" 
                    }}
                >
                    {loading ? "Finalizing..." : "Finish"} <CheckCircle2 size={20} />
                </button>
            </div>
        </div>
    );
})()}
  </div>
)}
          </div>
        </div>

        {/* Preview modals removed - preview functionality removed */}

        {/* Add CSS for spinner animation */}
        <style jsx>{`
          @keyframes spin {
            0% {
              transform: rotate(0deg);
            }
            100% {
              transform: rotate(360deg);
            }
          }
        `}</style>

        {/* AI Crafting Overlay */}
        {isCrafting && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "#EBFAFD", // Mint 50
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              fontFamily: "-apple-system, sans-serif",
            }}
          >
            {/* Central Brand Badge */}
            <div
              style={{
                width: "120px",
                height: "120px",
                backgroundColor: "#C9F4D4", // Mint 100
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "2rem",
                fontSize: "3rem",
              }}
            >
              ✨
            </div>

            <h1
              style={{
                color: "#1E5A3B",
                fontSize: "2.5rem",
                fontWeight: 800,
                marginBottom: "2rem",
              }}
            >
              AI is Crafting Your Assessment
            </h1>

            {/* Animated Progress Bar */}
            <div
              style={{
                width: "300px",
                height: "8px",
                backgroundColor: "#ffffff",
                borderRadius: "4px",
                marginBottom: "1rem",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${craftingProgress}%`,
                  height: "100%",
                  backgroundColor: "#10b981",
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <div
              style={{
                color: "#1E5A3B",
                fontWeight: 700,
                fontSize: "1.5rem",
                marginBottom: "3rem",
              }}
            >
              {craftingProgress}%
            </div>

            {/* Task Checklist */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "1rem",
                textAlign: "left",
                width: "fit-content",
              }}
            >
              {[
                {
                  label: "Analyzing job requirements",
                  done: craftingProgress > 20,
                },
                {
                  label: "Generating MCQ questions",
                  done: craftingProgress > 45,
                },
                {
                  label: "Creating coding challenges",
                  done: craftingProgress > 75,
                },
                { label: "Finalizing assessment", done: craftingProgress > 90 },
              ].map((item, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", alignItems: "center", gap: "1rem" }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: "50%",
                      border: `2px solid ${item.done ? "#10b981" : "#fcd34d"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: item.done ? "#10b981" : "#fcd34d",
                    }}
                  >
                    {item.done ? "✓" : "○"}
                  </div>
                  <span
                    style={{
                      color: item.done ? "#1E5A3B" : "#2D7A52", // Text colors from Brand Book
                      fontWeight: item.done ? 700 : 500,
                    }}
                  >
                    {item.label}
                  </span>
                </div>
              ))}
            </div>

            <p
              style={{
                marginTop: "4rem",
                color: "#2D7A52",
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              This usually takes 30-60 seconds...
            </p>
          </div>
        )}
      </div>
    </>
  );
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth;
