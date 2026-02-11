import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../lib/auth";
import Link from "next/link";
import { QuestionGenerationSkeleton } from "@/components/QuestionGenerationSkeleton";
// React Query hookss
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

// ============================================
// QUESTION RENDERING COMPONENTS
// ============================================

const renderMCQQuestion = (question: any, isEditing: boolean, onEditChange?: (value: string) => void) => {
  // Handle both 'question' and 'questionText' field names for backward compatibility
  const questionText = question.question || question.questionText || "";
  
  if (isEditing && onEditChange) {
    return (
      <div>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
          Question:
        </label>
        <textarea
          value={questionText}
          onChange={(e) => onEditChange(JSON.stringify({ ...question, question: e.target.value, questionText: e.target.value }, null, 2))}
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
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
          Options:
        </label>
        {(question.options || []).map((option: string, idx: number) => (
          <div key={idx} style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontWeight: 600, color: "#64748b", minWidth: "24px" }}>{String.fromCharCode(65 + idx)}.</span>
            <input
              type="text"
              value={option}
              onChange={(e) => {
                const newOptions = [...(question.options || [])];
                newOptions[idx] = e.target.value;
                onEditChange(JSON.stringify({ ...question, options: newOptions }, null, 2));
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
        <label style={{ display: "block", marginTop: "1rem", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
          Correct Answer:
        </label>
        <input
          type="text"
          value={question.correctAnswer || ""}
          onChange={(e) => onEditChange(JSON.stringify({ ...question, correctAnswer: e.target.value }, null, 2))}
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
        <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1e293b", marginBottom: "1rem" }}>
          {question.question || "Question"}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
                <span style={{
                  fontWeight: 700,
                  color: isCorrect ? "#065f46" : "#64748b",
                  minWidth: "32px",
                  fontSize: "0.875rem",
                }}>
                  {String.fromCharCode(65 + idx)}.
                </span>
                <span style={{ flex: 1, color: "#1e293b" }}>{option}</span>
                {isCorrect && (
                  <span style={{
                    padding: "0.25rem 0.75rem",
                    backgroundColor: "#10b981",
                    color: "#ffffff",
                    borderRadius: "0.375rem",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}>
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

const renderSubjectiveQuestion = (question: any, isEditing: boolean, onEditChange?: (value: string) => void) => {
  // Handle both 'question' and 'questionText' field names for backward compatibility
  const questionText = question.question || question.questionText || "";
  
  if (isEditing && onEditChange) {
    return (
      <div>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
          Question:
        </label>
        <textarea
          value={questionText}
          onChange={(e) => onEditChange(JSON.stringify({ ...question, question: e.target.value, questionText: e.target.value }, null, 2))}
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
          <div style={{
            padding: "1.25rem",
            backgroundColor: "#ffffff",
            borderRadius: "0.5rem",
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          }}>
            <div style={{ fontSize: "1rem", color: "#1e293b", whiteSpace: "pre-wrap", lineHeight: "1.6" }}>
              {questionText}
            </div>
          </div>
        ) : (
          <div style={{ padding: "1rem", backgroundColor: "#fef3c7", borderRadius: "0.5rem", color: "#92400e" }}>
            No question text available. Please regenerate this question.
          </div>
        )}
      </div>
    </div>
  );
};

const renderPseudoCodeQuestion = (question: any, isEditing: boolean, onEditChange?: (value: string) => void) => {
  // Handle both 'question' and 'questionText' field names for backward compatibility
  // Also handle 'expectedLogic' (old) and 'expectedAnswer' (new) field names
  const questionText = question.question || question.questionText || "";
  const expectedAnswer = question.expectedAnswer || question.expectedLogic || "";
  const explanation = question.explanation || "";
  
  if (isEditing && onEditChange) {
    return (
      <div>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
          Question:
        </label>
        <textarea
          value={questionText}
          onChange={(e) => onEditChange(JSON.stringify({ ...question, question: e.target.value, questionText: e.target.value }, null, 2))}
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
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
              Explanation:
            </label>
            <textarea
              value={explanation}
              onChange={(e) => onEditChange(JSON.stringify({ ...question, explanation: e.target.value }, null, 2))}
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
          <h3 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#1e293b", marginBottom: "1rem" }}>
            {questionText}
          </h3>
        ) : (
          <div style={{ padding: "1rem", backgroundColor: "#fef3c7", borderRadius: "0.5rem", color: "#92400e" }}>
            No question text available. Please regenerate this question.
          </div>
        )}
        {/* ⭐ REMOVED: Expected Answer/Output - User doesn't want this displayed */}
        {explanation && (
          <div style={{ marginTop: "1rem" }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
              Explanation:
            </div>
            <div style={{
              padding: "1rem",
              backgroundColor: "#f8fafc",
              borderRadius: "0.5rem",
              fontSize: "0.875rem",
              color: "#1e293b",
              lineHeight: "1.6",
            }}>
              {explanation}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const renderCodingQuestion = (question: any, isEditing: boolean, onEditChange?: (value: string) => void) => {
  // ⭐ CRITICAL FIX: Support multiple formats for problem statement
  // Priority: questionText > description > question > problemStatement > title + description/problemStatement
  // Backend generates questionText from title + description + examples, but also preserves description separately
  const questionText = question.questionText || question.description || question.question || question.problemStatement || (question.title ? `${question.title}\n\n${question.description || question.problemStatement || ""}` : "");
  
  // Debug logging to trace problem statement issue
  if (!questionText || !questionText.trim()) {
    console.warn("⚠️ Coding question missing problem statement:", {
      hasQuestionText: !!question.questionText,
      questionTextValue: question.questionText ? question.questionText.substring(0, 100) : null,
      hasDescription: !!question.description,
      descriptionValue: question.description ? question.description.substring(0, 100) : null,
      hasQuestion: !!question.question,
      hasProblemStatement: !!question.problemStatement,
      hasTitle: !!question.title,
      titleValue: question.title,
      questionKeys: Object.keys(question),
      fullQuestion: question, // Log full question for debugging
    });
  } else {
    console.log("✅ Coding question has problem statement:", {
      questionTextLength: questionText.length,
      source: question.questionText ? "questionText" : question.description ? "description" : question.question ? "question" : question.problemStatement ? "problemStatement" : "title",
    });
  }
  const starterCode = question.starterCode || "";
  const visibleTestCases = question.visibleTestCases || (question.visibleTestCases ? [] : []);
  const hiddenTestCases = question.hiddenTestCases || [];
  const constraints = question.constraints || "";
  const functionSignature = question.functionSignature || "";
  const explanation = question.explanation || "";
  
  if (isEditing && onEditChange) {
    return (
      <div>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
          Title:
        </label>
        <input
          type="text"
          value={question.title || ""}
          onChange={(e) => onEditChange(JSON.stringify({ ...question, title: e.target.value }, null, 2))}
          style={{
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}
        />
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
          Problem Statement:
        </label>
        <textarea
          value={question.questionText || question.problemStatement || question.description || question.question || ""}
          onChange={(e) => onEditChange(JSON.stringify({ ...question, questionText: e.target.value, problemStatement: e.target.value }, null, 2))}
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
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
          Function Signature:
        </label>
        <textarea
          value={question.functionSignatureString || (typeof question.functionSignature === 'string' ? question.functionSignature : (typeof question.functionSignature === 'object' && question.functionSignature ? `${question.functionSignature.name || 'function'}(${question.functionSignature.parameters?.map((p: any) => `${p.name}: ${p.type}`).join(', ') || ''}): ${question.functionSignature.return_type || ''}` : ""))}
          onChange={(e) => onEditChange(JSON.stringify({ ...question, functionSignature: e.target.value, functionSignatureString: e.target.value }, null, 2))}
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
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
              Input Format:
            </label>
            <textarea
              value={question.inputFormat || ""}
              onChange={(e) => onEditChange(JSON.stringify({ ...question, inputFormat: e.target.value }, null, 2))}
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
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
              Output Format:
            </label>
            <textarea
              value={question.outputFormat || ""}
              onChange={(e) => onEditChange(JSON.stringify({ ...question, outputFormat: e.target.value }, null, 2))}
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
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
          Constraints:
        </label>
        <textarea
          value={question.constraints || ""}
          onChange={(e) => onEditChange(JSON.stringify({ ...question, constraints: e.target.value }, null, 2))}
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
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
              Sample Input:
            </label>
            <textarea
              value={question.sampleInput || ""}
              onChange={(e) => onEditChange(JSON.stringify({ ...question, sampleInput: e.target.value }, null, 2))}
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
            <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
              Sample Output:
            </label>
            <textarea
              value={question.sampleOutput || ""}
              onChange={(e) => onEditChange(JSON.stringify({ ...question, sampleOutput: e.target.value }, null, 2))}
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <label style={{ fontWeight: 600, color: "#1e293b" }}>
              Visible Test Cases ({visibleTestCases.length || 0}):
            </label>
            <button
              type="button"
              onClick={() => {
                const newTestCases = [...(visibleTestCases || []), { input: "", output: "", expected_output: "" }];
                onEditChange(JSON.stringify({ ...question, visibleTestCases: newTestCases }, null, 2));
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
            <div key={idx} style={{
              padding: "1rem",
              backgroundColor: "#f8fafc",
              borderRadius: "0.5rem",
              border: "1px solid #e2e8f0",
              marginBottom: "0.75rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b" }}>
                  Test Case {idx + 1}:
                </div>
                {(visibleTestCases || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newTestCases = (visibleTestCases || []).filter((_: any, i: number) => i !== idx);
                      onEditChange(JSON.stringify({ ...question, visibleTestCases: newTestCases }, null, 2));
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>
                    Input:
                  </label>
                  <textarea
                    value={testCase.input || ""}
                    onChange={(e) => {
                      const newTestCases = [...(visibleTestCases || [])];
                      newTestCases[idx] = { ...newTestCases[idx], input: e.target.value };
                      onEditChange(JSON.stringify({ ...question, visibleTestCases: newTestCases }, null, 2));
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
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>
                    Expected Output:
                  </label>
                  <textarea
                    value={testCase.output || testCase.expected_output || ""}
                    onChange={(e) => {
                      const newTestCases = [...(visibleTestCases || [])];
                      newTestCases[idx] = { ...newTestCases[idx], output: e.target.value, expected_output: e.target.value };
                      onEditChange(JSON.stringify({ ...question, visibleTestCases: newTestCases }, null, 2));
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <label style={{ fontWeight: 600, color: "#1e293b" }}>
              Hidden Test Cases ({hiddenTestCases.length || 0}):
            </label>
            <button
              type="button"
              onClick={() => {
                const newTestCases = [...(hiddenTestCases || []), { input: "", output: "", expected_output: "" }];
                onEditChange(JSON.stringify({ ...question, hiddenTestCases: newTestCases }, null, 2));
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
            <div key={idx} style={{
              padding: "1rem",
              backgroundColor: "#fef3c7",
              borderRadius: "0.5rem",
              border: "1px solid #fbbf24",
              marginBottom: "0.75rem",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b" }}>
                  Hidden Test Case {idx + 1}:
                </div>
                {(hiddenTestCases || []).length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const newTestCases = (hiddenTestCases || []).filter((_: any, i: number) => i !== idx);
                      onEditChange(JSON.stringify({ ...question, hiddenTestCases: newTestCases }, null, 2));
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>
                    Input:
                  </label>
                  <textarea
                    value={testCase.input || ""}
                    onChange={(e) => {
                      const newTestCases = [...(hiddenTestCases || [])];
                      newTestCases[idx] = { ...newTestCases[idx], input: e.target.value };
                      onEditChange(JSON.stringify({ ...question, hiddenTestCases: newTestCases }, null, 2));
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
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>
                    Expected Output:
                  </label>
                  <textarea
                    value={testCase.output || testCase.expected_output || ""}
                    onChange={(e) => {
                      const newTestCases = [...(hiddenTestCases || [])];
                      newTestCases[idx] = { ...newTestCases[idx], output: e.target.value, expected_output: e.target.value };
                      onEditChange(JSON.stringify({ ...question, hiddenTestCases: newTestCases }, null, 2));
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

  // ⭐ CRITICAL FIX: questionText exists (confirmed by console logs showing 402+ chars)
  // Use questionText directly since we know it exists from the logs
  const problemStatementText = question.questionText || questionText || question.description || question.problemStatement || question.question || question.title || "";
  
  // Force render - we know questionText exists from logs
  const shouldShowProblemStatement = !!(problemStatementText && problemStatementText.trim());
  
  console.log("🎯 Final render check:", {
    questionQuestionText: question.questionText?.substring(0, 50),
    questionTextVar: questionText?.substring(0, 50),
    problemStatementText: problemStatementText?.substring(0, 50),
    shouldShow: shouldShowProblemStatement,
  });
  
  return (
    <div>
      {/* Problem Statement - Force render since we know questionText exists */}
      {shouldShowProblemStatement ? (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
            Problem Statement:
          </div>
          <div style={{ 
            color: "#1e293b", 
            whiteSpace: "pre-wrap", 
            lineHeight: "1.7",
            padding: "1.25rem",
            backgroundColor: "#ffffff",
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
            fontSize: "1rem",
            minHeight: "50px",
          }}>
            {problemStatementText}
          </div>
        </div>
      ) : (
        <div style={{ 
          marginBottom: "1.5rem", 
          padding: "1rem", 
          backgroundColor: "#fee2e2", 
          borderRadius: "0.5rem", 
          border: "1px solid #ef4444",
          color: "#991b1b"
        }}>
          ⚠️ DEBUG: Problem statement not showing. question.questionText: {question.questionText ? `YES (${question.questionText.length} chars)` : "NO"}, questionText var: {questionText ? `YES (${questionText.length} chars)` : "NO"}
        </div>
      )}
      
      {/* Debug: Show warning if problem statement is still empty */}
      {!questionText && !question.description && !question.problemStatement && !question.question && !question.title && (
        <div style={{ 
          marginBottom: "1.5rem", 
          padding: "1rem", 
          backgroundColor: "#fef3c7", 
          borderRadius: "0.5rem", 
          border: "1px solid #fbbf24",
          color: "#92400e"
        }}>
          ⚠️ Problem statement is empty. Check browser console for details. Available fields: {Object.keys(question).join(", ")}
        </div>
      )}
      
      {/* Debug: Show warning if problem statement is still empty */}
      {!questionText && !question.description && !question.problemStatement && !question.question && !question.title && (
        <div style={{ 
          marginBottom: "1.5rem", 
          padding: "1rem", 
          backgroundColor: "#fef3c7", 
          borderRadius: "0.5rem", 
          border: "1px solid #fbbf24",
          color: "#92400e"
        }}>
          ⚠️ Problem statement is empty. Available fields: {JSON.stringify(Object.keys(question))}
        </div>
      )}
      
      {/* Starter Code (Readonly) */}
      {starterCode && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
            Starter Code (Readonly):
          </div>
          <div style={{
            padding: "1rem",
            backgroundColor: "#1e293b",
            color: "#f1f5f9",
            borderRadius: "0.5rem",
            fontFamily: "monospace",
            fontSize: "0.875rem",
            whiteSpace: "pre-wrap",
            border: "2px solid #3b82f6",
            position: "relative",
          }}>
            <div style={{
              position: "absolute",
              top: "0.5rem",
              right: "0.5rem",
              fontSize: "0.75rem",
              color: "#94a3b8",
              backgroundColor: "#1e293b",
              padding: "0.25rem 0.5rem",
              borderRadius: "0.25rem",
            }}>
              Readonly
            </div>
            {starterCode}
          </div>
          <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.5rem", fontStyle: "italic" }}>
            This starter code cannot be modified. Only the editable region can be changed.
          </p>
        </div>
      )}
      
      {/* Function Signature */}
      {functionSignature && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
            Function Signature:
          </div>
          <div style={{
            padding: "0.75rem",
            backgroundColor: "#1e293b",
            color: "#f1f5f9",
            borderRadius: "0.5rem",
            fontFamily: "monospace",
            fontSize: "0.875rem",
            whiteSpace: "pre-wrap",
          }}>
            {typeof functionSignature === 'object' 
              ? `${functionSignature.name || 'function'}(${functionSignature.parameters?.map((p: any) => `${p.name}: ${p.type}`).join(', ') || ''}): ${functionSignature.return_type || ''}`
              : functionSignature}
          </div>
        </div>
      )}
      
      {/* Problem Statement - Always show if available */}
      {questionText && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
            Problem Statement:
          </div>
          <div style={{
            padding: "1.25rem",
            backgroundColor: "#ffffff",
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
            color: "#1e293b",
            whiteSpace: "pre-wrap",
            lineHeight: "1.7",
            fontSize: "1rem",
          }}>
            {questionText}
          </div>
        </div>
      )}
      
      {/* Fallback: Show title if questionText is empty */}
      {!questionText && question.title && (
        <div style={{ marginBottom: "1.5rem" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b", marginBottom: "1rem" }}>
            {question.title}
          </h2>
        </div>
      )}
      {/* Constraints */}
      {constraints && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
            Constraints:
          </div>
          <div style={{
            padding: "1rem",
            backgroundColor: "#fef3c7",
            borderRadius: "0.5rem",
            border: "1px solid #fbbf24",
          }}>
            {typeof constraints === 'string' && constraints.includes('\n') ? (
              <ul style={{
                paddingLeft: "1.5rem",
                color: "#1e293b",
                lineHeight: "1.8",
                margin: 0,
              }}>
                {constraints.split('\n').filter((c: string) => c.trim()).map((constraint: string, idx: number) => (
                  <li key={idx} style={{ marginBottom: "0.25rem" }}>{constraint.trim()}</li>
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
      {visibleTestCases && Array.isArray(visibleTestCases) && visibleTestCases.length > 0 && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.75rem" }}>
            Visible Test Cases ({visibleTestCases.length}):
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {visibleTestCases.map((testCase: any, idx: number) => (
              <div key={idx} style={{
                padding: "1rem",
                backgroundColor: "#f8fafc",
                borderRadius: "0.5rem",
                border: "1px solid #e2e8f0",
              }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
                  Test Case {idx + 1}:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>
                      Input:
                    </div>
                    <div style={{
                      padding: "0.75rem",
                      backgroundColor: "#1e293b",
                      color: "#f1f5f9",
                      borderRadius: "0.375rem",
                      fontFamily: "monospace",
                      fontSize: "0.875rem",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}>
                      {testCase.input || ""}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748b", marginBottom: "0.25rem" }}>
                      Expected Output:
                    </div>
                    <div style={{
                      padding: "0.75rem",
                      backgroundColor: "#10b981",
                      color: "#ffffff",
                      borderRadius: "0.375rem",
                      fontFamily: "monospace",
                      fontSize: "0.875rem",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}>
                      {testCase.output || testCase.expected_output || ""}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.5rem", fontStyle: "italic" }}>
            These test cases are visible to candidates. Hidden test cases ({hiddenTestCases.length || 0}) are used for evaluation only.
          </p>
        </div>
      )}
      
      {/* Legacy support for old format test cases - only show if no visibleTestCases AND legacy fields have actual content */}
      {(!visibleTestCases || visibleTestCases.length === 0) && 
       (question.sampleInput?.trim() || question.sampleOutput?.trim()) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
              Sample Input:
            </div>
            <div style={{
              padding: "0.75rem",
              backgroundColor: "#1e293b",
              color: "#f1f5f9",
              borderRadius: "0.5rem",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              whiteSpace: "pre-wrap",
            }}>
              {question.sampleInput}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
              Sample Output:
            </div>
            <div style={{
              padding: "0.75rem",
              backgroundColor: "#1e293b",
              color: "#f1f5f9",
              borderRadius: "0.5rem",
              fontFamily: "monospace",
              fontSize: "0.875rem",
              whiteSpace: "pre-wrap",
            }}>
              {question.sampleOutput}
            </div>
          </div>
        </div>
      )}
      
      {/* Legacy support for old format input/output format */}
      {question.inputFormat && question.outputFormat && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
              Input Format:
            </div>
            <div style={{
              padding: "0.75rem",
              backgroundColor: "#f8fafc",
              borderRadius: "0.5rem",
              border: "1px solid #e2e8f0",
              fontSize: "0.875rem",
              whiteSpace: "pre-wrap",
            }}>
              {question.inputFormat}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
              Output Format:
            </div>
            <div style={{
              padding: "0.75rem",
              backgroundColor: "#f8fafc",
              borderRadius: "0.5rem",
              border: "1px solid #e2e8f0",
              fontSize: "0.875rem",
              whiteSpace: "pre-wrap",
            }}>
              {question.outputFormat}
            </div>
          </div>
        </div>
      )}
      
      {/* Explanation */}
      {explanation && (
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
            Explanation:
          </div>
          <div style={{ 
            color: "#1e293b", 
            whiteSpace: "pre-wrap", 
            lineHeight: "1.6",
            padding: "0.75rem",
            backgroundColor: "#f0f9ff",
            borderRadius: "0.5rem",
            border: "1px solid #bae6fd",
          }}>
            {explanation}
          </div>
        </div>
      )}
    </div>
  );
};

// SQL Question Renderer - pretty UI using schema + sample data when available
const renderSqlQuestion = (question: any, isEditing: boolean, onEditChange?: (value: string) => void) => {
  // When editing, fall back to simple subjective-style text editing for now
  if (isEditing && onEditChange) {
    const questionText = question.question || question.questionText || "";
    return (
      <div>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
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
                2
              )
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
    sqlData.description || question.question || question.questionText || "SQL question description not available.";
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
        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "#0f172a" }}>{title}</div>
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>🗄️</span>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#1e40af" }}>Database Information</div>
              <div style={{ fontSize: "0.875rem", color: "#3b82f6", marginTop: "0.25rem" }}>
                {Object.keys(allSchemas).length} table{Object.keys(allSchemas).length !== 1 ? "s" : ""} available
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.875rem", color: "#1e40af" }}>
            {hasSchema && (
              <span>
                <strong>{Object.keys(allSchemas).length}</strong> schema{Object.keys(allSchemas).length !== 1 ? "s" : ""}
              </span>
            )}
            {hasSampleData && (
              <span>
                <strong>{Object.keys(allSampleData).length}</strong> table{Object.keys(allSampleData).length !== 1 ? "s" : ""} with data
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
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
          Problem Description
        </div>
        <div style={{ fontSize: "1rem", color: "#111827", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
          {description}
        </div>
      </div>

      {/* Layout: schema + data side by side on large screens */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: hasSchema && hasSampleData ? "minmax(0, 1.1fr) minmax(0, 1.1fr)" : "minmax(0, 1fr)",
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
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
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a" }}>Database Schema</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
                      <span style={{ fontSize: "0.7rem", color: "#6b7280" }}>Schema</span>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
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
                          {Object.entries<any>(columns).map(([colName, colType]) => (
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
                          ))}
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
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
              <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a" }}>Sample Data</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
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
                    <div style={{ overflowX: "auto", maxHeight: "400px", overflowY: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                        <thead>
                          <tr style={{ backgroundColor: "#f9fafb", position: "sticky", top: 0, zIndex: 10 }}>
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
                              : columnNames.map((col) => (row && typeof row === "object" ? row[col] : ""));
                            return (
                              <tr key={idx}>
                                {cells.map((cell, cellIdx) => (
                                  <td
                                    key={cellIdx}
                                    style={{
                                      padding: "0.4rem 0.6rem",
                                      borderTop: "1px solid #f3f4f6",
                                      fontFamily: "monospace",
                                      color: cell === null || cell === undefined ? "#9ca3af" : "#111827",
                                    }}
                                  >
                                    {cell === null || cell === undefined || cell === "" ? "NULL" : String(cell)}
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
          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#075985", marginBottom: "0.5rem" }}>
            Requirements
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "#0f172a", lineHeight: 1.6 }}>
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
          <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#93c5fd", marginBottom: "0.5rem" }}>
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
          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#92400e", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span>💡</span>
            <span>Hints</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "#78350f", lineHeight: 1.6 }}>
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
              <span style={{ fontWeight: 600, color: "#6b7280" }}>Engine: </span>
              <span style={{ color: "#111827", fontFamily: "monospace" }}>{evaluation.engine}</span>
            </div>
          )}
          {evaluation.comparison && (
            <div>
              <span style={{ fontWeight: 600, color: "#6b7280" }}>Comparison: </span>
              <span style={{ color: "#111827" }}>{evaluation.comparison}</span>
            </div>
          )}
          {evaluation.order_sensitive !== undefined && (
            <div>
              <span style={{ fontWeight: 600, color: "#6b7280" }}>Order Sensitive: </span>
              <span style={{ color: "#111827" }}>{evaluation.order_sensitive ? "Yes" : "No"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// AIML Question Renderer - pretty UI using dataset when available
const renderAimlQuestion = (question: any, isEditing: boolean, onEditChange?: (value: string) => void) => {
  // When editing, fall back to simple subjective-style text editing for now
  if (isEditing && onEditChange) {
    const questionText = question.question || question.questionText || "";
    return (
      <div>
        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
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
                2
              )
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
  const description = aimlData.description || question.question || question.questionText || "AIML question description not available.";
  const tasks: string[] = aimlData.tasks || [];
  const constraints: string[] = aimlData.constraints || [];
  const libraries: string[] = aimlData.libraries || [];
  // ⭐ ENHANCED: Check multiple possible dataset locations
  const dataset = aimlData.dataset || aimlData.data || null;
  const schema = dataset?.schema || dataset?.columns || aimlData.schema || [];
  const rows: any[] = dataset?.rows || dataset?.data || aimlData.rows || [];
  const executionEnv: string = aimlData.execution_environment || aimlData.environment || "jupyter_notebook";
  const requiresDataset: boolean = aimlData.requires_dataset || false;
  
  // ⭐ ENHANCED: Additional dataset metadata
  const datasetName = dataset?.name || aimlData.dataset_name || "Dataset";
  const datasetDescription = dataset?.description || aimlData.dataset_description || null;

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
        <span>Environment: {executionEnv === "jupyter_notebook" ? "Jupyter Notebook" : executionEnv}</span>
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
        <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#64748b", marginBottom: "0.5rem" }}>
          Problem Description
        </div>
        <div style={{ fontSize: "1rem", color: "#111827", lineHeight: "1.7", whiteSpace: "pre-wrap" }}>
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
          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#166534", marginBottom: "0.5rem" }}>
            Tasks
          </div>
          <ol style={{ margin: 0, paddingLeft: "1.5rem", fontSize: "0.875rem", color: "#0f172a", lineHeight: 1.8 }}>
            {tasks.map((task, idx) => (
              <li key={idx} style={{ marginBottom: "0.25rem" }}>{task}</li>
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
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "1.5rem" }}>📊</span>
            <div>
              <div style={{ fontSize: "1rem", fontWeight: 700, color: "#166534" }}>{datasetName}</div>
              {datasetDescription && (
                <div style={{ fontSize: "0.875rem", color: "#15803d", marginTop: "0.25rem" }}>
                  {datasetDescription}
                </div>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: "1.5rem", fontSize: "0.875rem", color: "#166534" }}>
            {schema.length > 0 && (
              <span>
                <strong>{schema.length}</strong> column{schema.length > 1 ? "s" : ""}
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
            gridTemplateColumns: schema.length > 0 ? "minmax(0, 1fr) minmax(0, 2fr)" : "minmax(0, 1fr)",
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
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
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
                <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a" }}>Dataset Schema</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
                  <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "#0f172a" }}>
                    Complete Dataset
                  </div>
                </div>
                <div style={{ display: "flex", gap: "1rem", fontSize: "0.75rem", color: "#6b7280" }}>
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
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f9fafb", position: "sticky", top: 0, zIndex: 10 }}>
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
                        const cells: any[] = Array.isArray(row) ? row : schema.map((col: any) => (row && typeof row === "object" ? row[col.name] : ""));
                        return (
                          <tr key={rowIdx} style={{ backgroundColor: rowIdx % 2 === 0 ? "#ffffff" : "#f9fafb" }}>
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
                                  color: cell === null || cell === undefined || cell === "" ? "#9ca3af" : "#111827",
                                  fontSize: "0.8rem",
                                }}
                              >
                                {cell === null || cell === undefined || cell === "" ? (
                                  <span style={{ fontStyle: "italic", color: "#9ca3af" }}>NULL</span>
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
          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#075985", marginBottom: "0.5rem" }}>
            Constraints
          </div>
          <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "#0f172a", lineHeight: 1.6 }}>
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
          <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#92400e", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
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

const renderQuestionByType = (question: any, questionType: string, isEditing: boolean, onEditChange?: (value: string) => void) => {
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
        <div style={{ padding: "1rem", backgroundColor: "#fef3c7", borderRadius: "0.5rem", color: "#92400e" }}>
          Unknown question type: {questionType}
        </div>
      );
  }
};

const QUESTION_TYPES = ["MCQ", "Subjective", "Pseudo Code", "Descriptive", "coding"];
const DIFFICULTY_LEVELS = ["Easy", "Medium", "Hard"];

// Helper function to get student level from slider value
function getStudentLevel(value: number): string {
  if (value < 1.5) return "Beginner";
  if (value < 3) return "Intermediate";
  return "Advanced";
}

// Helper function to truncate text to ~80 words
function truncateText(text: string, maxWords: number = 80): { truncated: string; isTruncated: boolean } {
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
  const baseScores: { [key: string]: { Easy: number; Medium: number; Hard: number } } = {
    MCQ: { Easy: 1, Medium: 2, Hard: 3 },
    Subjective: { Easy: 4, Medium: 6, Hard: 8 },
    PseudoCode: { Easy: 6, Medium: 8, Hard: 10 },
    Coding: { Easy: 10, Medium: 15, Hard: 20 },
    // SQL/AIML are execution-oriented environments, typically heavier than Subjective
    SQL: { Easy: 8, Medium: 10, Hard: 12 },
    AIML: { Easy: 10, Medium: 12, Hard: 15 },
  };
  
  const typeScores = baseScores[questionType] || { Easy: 1, Medium: 2, Hard: 3 };
  return typeScores[difficulty as "Easy" | "Medium" | "Hard"] || typeScores.Easy;
}

// Helper function to calculate section timer (in seconds, convert to minutes for display)
function calculateSectionTimer(
  questions: Array<{ questionType: string; difficulty: string }>
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
    "write sql", "write query", "sql query", "implement query",
    "optimize query", "query optimization", "recursive query",
    "stored procedure", "sql procedure", "create procedure",
    "sql to", "query to", "using sql", "sql with",
  ];
  
  // SQL indicator keywords (database/SQL concepts)
  const sqlIndicators = [
    "sql", "mysql", "postgresql", "sqlite", "database query",
    "sql query", "sql queries", "query", "joins", "subquery",
    "stored procedure", "trigger", "sql injection", "sql optimization",
  ];
  
  // Theory/comparison keywords (NOT execution - don't show SQL option for these)
  const sqlTheoryKeywords = [
    " vs ", " versus ", "compare", "comparison", "difference",
    "advantages", "disadvantages", "explained", "explanation",
    "concepts", "principles", "overview", "strategies", "design",
    "vulnerabilities", "security", "prevention",
  ];
  
  // If has theory keywords, it's NOT SQL execution (use Subjective instead)
  if (sqlTheoryKeywords.some(kw => label.includes(kw))) {
    return false;
  }
  
  // Check for execution keywords or SQL indicators
  return sqlExecutionKeywords.some(kw => label.includes(kw)) ||
         sqlIndicators.some(ind => {
           // Use word boundaries to avoid false positives (e.g., "overview" contains "view")
           const regex = new RegExp(`\\b${ind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
           return regex.test(label);
         });
}

// Helper function to detect if a topic is AIML-related (for showing AIML option in dropdown)
function isTopicAimlRelated(topicLabel: string): boolean {
  const label = topicLabel.toLowerCase();
  
  // AIML execution keywords (indicates ML code writing)
  const aimlExecutionKeywords = [
    "implement", "implementation", "build model", "train model",
    "using pandas", "using numpy", "using sklearn", "using tensorflow",
    "using pytorch", "ml implementation", "ml task", "data preprocessing code",
    "model training", "notebook", "jupyter", "colab",
  ];
  
  // AIML indicator keywords
  const aimlIndicators = [
    "machine learning", "deep learning", "neural network", "ml model",
    "pandas", "numpy", "sklearn", "tensorflow", "pytorch", "keras",
    "data preprocessing", "feature engineering", "model training",
    "random forest", "decision tree", "regression", "classification",
    "clustering", "supervised learning", "unsupervised learning",
  ];
  
  // Theory/comparison keywords (NOT execution - don't show AIML option for these)
  const aimlTheoryKeywords = [
    " vs ", " versus ", "compare", "comparison", "difference",
    "advantages", "disadvantages", "explained", "explanation",
    "concepts", "principles", "theory", "overview",
    "architecture", "design", "workflow",
  ];
  
  // If has theory keywords, it's NOT AIML execution (use Subjective instead)
  if (aimlTheoryKeywords.some(kw => label.includes(kw))) {
    return false;
  }
  
  // Check for execution keywords or AIML indicators
  return aimlExecutionKeywords.some(kw => label.includes(kw)) ||
         aimlIndicators.some(ind => {
           const regex = new RegExp(`\\b${ind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
           return regex.test(label);
         });
}

// Helper function to detect if a topic is web-related (for excluding Coding option)
function isTopicWebRelated(topicLabel: string): boolean {
  const label = topicLabel.toLowerCase();
  
  // Web technology keywords (platform doesn't support browser/web execution)
  const webKeywords = [
    // Frontend frameworks
    "react", "angular", "vue", "svelte", "nextjs", "next.js", "nuxt", "gatsby", "ember",
    // Web technologies
    "html", "css", "scss", "sass", "less", "tailwind", "bootstrap", "material ui", "chakra ui", "ant design",
    // Browser/DOM
    "dom", "browser", "document", "window", "event listener", "fetch api", "localstorage", "sessionstorage",
    "cookie", "webstorage",
    // Web frameworks (backend)
    "express", "koa", "fastify", "nest", "nestjs", "meteor",
    // Frontend build tools
    "webpack", "vite", "rollup", "parcel", "babel",
    // UI libraries
    "jquery", "d3", "chart.js", "three.js", "gsap", "anime.js",
    // Web concepts
    "frontend", "web development", "responsive design", "web page", "website", "web app", "web application",
    "spa", "single page", "ssr", "server side rendering", "csr", "client side rendering",
    "node server", "express server", "api endpoint", "http server", "rest api in node",
  ];
  
  // Check if any web keyword appears in the topic label (using word boundaries to avoid false positives)
  return webKeywords.some(keyword => {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(label);
  });
}

// Helper function to detect if a topic supports Judge0-compatible Coding (DSA/algorithmic in supported languages)
function isTopicCodingSupported(topicLabel: string): boolean {
  const label = topicLabel.toLowerCase();
  
  // Judge0 supported languages (must mention one of these)
  const supportedLanguages = [
    "javascript", "typescript", "java", "python", "c++", "cpp", "c#", "csharp",
    "c", "go", "golang", "rust", "kotlin",
  ];
  
  // DSA/algorithmic keywords
  const dsaKeywords = [
    "algorithm", "algorithms", "data structure", "data structures", "dsa", "problem solving",
    "sorting", "searching", "binary search", "merge sort", "quick sort", "quicksort",
    "two sum", "array", "arrays", "string", "strings", "hash", "hash table", "hashtable",
    "stack", "queue", "linked list", "tree", "binary tree", "bst", "heap", "trie",
    "graph", "bfs", "dfs", "dijkstra", "dynamic programming", "dp", "recursion",
  ];
  
  // Must mention at least one supported language AND one DSA keyword
  const hasSupportedLanguage = supportedLanguages.some(lang => {
    const regex = new RegExp(`\\b${lang.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(label);
  });
  
  const hasDsaKeyword = dsaKeywords.some(keyword => {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
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
  const isEditMode = !!(id && typeof id === 'string'); // True if we have an ID (editing draft)
  
  // Initialize React Query hooks
  const assessmentIdFromQuery = typeof id === 'string' ? id : undefined;
  const { data: assessmentData, refetch: refetchAssessment } = useAssessment(assessmentIdFromQuery);
  const { data: questionsData, refetch: refetchQuestions } = useAssessmentQuestions(assessmentIdFromQuery);
  
  // Mutations
  const updateDraftMutation = useUpdateDraft();
  const generateTopicCardsMutation = useGenerateTopicCards();
  const fetchAndSummarizeUrlMutation = useFetchAndSummarizeUrl();
  const generateTopicsV2Mutation = useGenerateTopicsV2();
  const generateTopicsFromRequirementsMutation = useGenerateTopicsFromRequirements();
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
  const [experienceMode, setExperienceMode] = useState<"corporate" | "student">("corporate");
  const [availableQuestionTypes, setAvailableQuestionTypes] = useState<string[]>(QUESTION_TYPES);
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
  const [candidates, setCandidates] = useState<Array<{ email: string; name: string; invited?: boolean; inviteSentAt?: string; status?: string }>>([]);
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidateName, setCandidateName] = useState("");
  const [assessmentUrl, setAssessmentUrl] = useState<string | null>(null);
  const [accessMode, setAccessMode] = useState<"public" | "private">("private");
  const [emailValidationError, setEmailValidationError] = useState<string | null>(null);
  const [invitationTemplate, setInvitationTemplate] = useState({
    logoUrl: "",
    companyName: "",
    message: "You have been invited to take an assessment. Please click the link below to start.",
    footer: "",
    sentBy: "AI Assessment Platform"
  });
  const [showEmailTemplate, setShowEmailTemplate] = useState(false);
  const [hasVisitedConfigureStation, setHasVisitedConfigureStation] = useState(false);
  const [hasVisitedReviewStation, setHasVisitedReviewStation] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false); // Track if assessment is finalized
  // Edit mode is always enabled - removed isConfigureEditMode state
  
  // Requirements free text field
  const [requirementsText, setRequirementsText] = useState<string>("");
  const [requirementsUrl, setRequirementsUrl] = useState<string | null>(null);
  const [requirementsSummary, setRequirementsSummary] = useState<string | null>(null);
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
  const [activeMethod, setActiveMethod] = useState<"role" | "manual" | "csv">("role");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<Array<{skill_name: string; skill_description: string; importance_level: string}>>([]);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvExperienceMode, setCsvExperienceMode] = useState<"corporate" | "student">("corporate");
  const [csvExperienceMin, setCsvExperienceMin] = useState(0);
  const [csvExperienceMax, setCsvExperienceMax] = useState(10);
  const [generatingFromCsv, setGeneratingFromCsv] = useState(false);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [regeneratingQuestionIndex, setRegeneratingQuestionIndex] = useState<number | null>(null);
  const [customTopicInput, setCustomTopicInput] = useState("");
  const [regeneratingTopicIndex, setRegeneratingTopicIndex] = useState<number | null>(null);
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false); // Prevent auto-save from overwriting during initial load
  
  // ============================================
  // NEW MULTI-ROW TOPIC V2 STATE (STRICT MODEL)
  // ============================================
  interface QuestionRow {
    rowId: string;
    questionType: "MCQ" | "Subjective" | "PseudoCode" | "Coding" | "SQL" | "AIML";
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
    currentTopic: '',
    currentQuestionType: '',
    estimatedTimeRemaining: 0,
  });
  const [showGenerationSkeleton, setShowGenerationSkeleton] = useState(false);
  const [customTopicInputV2, setCustomTopicInputV2] = useState("");
  
  // Topic suggestion states
  const [topicSuggestions, setTopicSuggestions] = useState<Array<{label: string; value: string}>>([]);
  const [showingSuggestionsFor, setShowingSuggestionsFor] = useState<string | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [topicInputValues, setTopicInputValues] = useState<{[topicId: string]: string}>({});
  
  // AI-powered topic suggestions for custom topic input
  const [aiTopicSuggestions, setAiTopicSuggestions] = useState<string[]>([]);
  const [suggestionsFetched, setSuggestionsFetched] = useState(false); // Track if suggestions have been fetched
  const [loadingAiSuggestions, setLoadingAiSuggestions] = useState(false);
  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [suggestionDebounceTimer, setSuggestionDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Topic validation states
  const [validatingTopic, setValidatingTopic] = useState(false);
  const [topicValidationError, setTopicValidationError] = useState<string | null>(null);
  const [topicValidationTimer, setTopicValidationTimer] = useState<NodeJS.Timeout | null>(null);
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
  const [enablePerSectionTimers, setEnablePerSectionTimers] = useState<boolean>(false);
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
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null);
  const [editingReviewQuestion, setEditingReviewQuestion] = useState<any | null>(null);
  // Regenerate question modal state
  const [regeneratingQuestionId, setRegeneratingQuestionId] = useState<string | null>(null);
  const [regenerateQuestionFeedback, setRegenerateQuestionFeedback] = useState<string>("");
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
        clampedMax = Math.max(clampedMin + 1, Math.min(experienceMax, maxValue));
        
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
        clampedMax = Math.max(clampedMin + 1, Math.min(experienceMax, maxValue));
      }
      
      const minPercent = Math.max(0, Math.min(100, (clampedMin / maxValue) * 100));
      const maxPercent = Math.max(0, Math.min(100, (clampedMax / maxValue) * 100));
      minHandleRef.current.style.left = `${minPercent}%`;
      maxHandleRef.current.style.left = `${maxPercent}%`;
    }
  }, [experienceMin, experienceMax, experienceMode]);

  // Handle experience range slider
  useEffect(() => {
    // Only initialize slider when on Station 1
    if (currentStation !== 1) return;
    if (!sliderRef.current || !minHandleRef.current || !maxHandleRef.current) return;

    const slider = sliderRef.current;
    const minHandle = minHandleRef.current;
    const maxHandle = maxHandleRef.current;

    const getValueFromPosition = (x: number) => {
      const rect = slider.getBoundingClientRect();
      const percentage = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100));
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
        const minPercent = Math.max(0, Math.min(100, (newMin / maxValue) * 100));
        minHandle.style.left = `${minPercent}%`;
        setExperienceMin(newMin);
      } else if (dragTargetRef.current === "max") {
        const newMax = Math.max(currentMin + 1, Math.min(value, maxValue));
        experienceRef.current.max = newMax;
        const maxPercent = Math.max(0, Math.min(100, (newMax / maxValue) * 100));
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
    const clampedMax = Math.max(clampedMin + 1, Math.min(experienceMax, maxValue));
    
    if (clampedMin !== experienceMin) {
      setExperienceMin(clampedMin);
    }
    if (clampedMax !== experienceMax) {
      setExperienceMax(clampedMax);
    }
    
    const minPercent = Math.max(0, Math.min(100, (clampedMin / maxValue) * 100));
    const maxPercent = Math.max(0, Math.min(100, (clampedMax / maxValue) * 100));
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
        const isGeneratedOrCompleted = rowStatus === "generated" || rowStatus === "completed";
        if (row.questions && row.questions.length > 0 && isGeneratedOrCompleted) {
          const questionType = row.questionType;
          if (questionsByType[questionType]) {
            row.questions.forEach(() => {
              questionsByType[questionType].push({ difficulty: row.difficulty });
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
      
      (["MCQ", "Subjective", "PseudoCode", "Coding", "SQL", "AIML"] as const).forEach((questionType) => {
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
    
    const totalSectionTime = Object.values(sectionTimers).reduce((sum, time) => sum + time, 0);
    if (totalSectionTime > 0) {
      setDuration(totalSectionTime.toString());
    }
  }, [sectionTimers, enablePerSectionTimers]);

  // Auto-calculate section timers from questions when enabled
  useEffect(() => {
    if (currentStation !== 3 || !enablePerSectionTimers || !topicsV2 || topicsV2.length === 0) return;
    
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
        const isGeneratedOrCompleted = rowStatus === "generated" || rowStatus === "completed";
        if (row.questions && row.questions.length > 0 && isGeneratedOrCompleted) {
          const questionType = row.questionType as keyof typeof questionsByType;
          if (questionsByType[questionType]) {
            row.questions.forEach((question) => {
              questionsByType[questionType].push({ difficulty: row.difficulty });
            });
          }
        }
      });
    });
    
    // Calculate section timers as sum of question times (in minutes)
    const calculateSectionTime = (questions: Array<{ difficulty: string }>, questionType: string): number => {
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
      Subjective: calculateSectionTime(questionsByType.Subjective, "Subjective"),
      PseudoCode: calculateSectionTime(questionsByType.PseudoCode, "PseudoCode"),
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
      console.log("[FRONTEND] sectionTimers:", enablePerSectionTimers ? sectionTimers : undefined);
      console.log("=".repeat(80));
      
      updateDraftMutation.mutate({
        assessmentId,
        scoringRules,
        passPercentage,
        enablePerSectionTimers,
        sectionTimers: enablePerSectionTimers ? sectionTimers : undefined,
      }, {
        onSuccess: (response) => {
          console.log("[FRONTEND] ✓ Draft saved successfully", response.data);
        },
        onError: (err) => {
          console.error("[FRONTEND] ❌ Error saving review settings to draft:", err);
        },
      });
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [currentStation, assessmentId, scoringRules, passPercentage, enablePerSectionTimers, sectionTimers]);

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
    if (isEditMode && id && typeof id === 'string') {
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
        const titleToSave = finalTitle || (jobDesignation.trim() ? `Assessment for ${jobDesignation.trim()}` : "Untitled Assessment");
        
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
  }, [finalTitle, jobDesignation, experienceMin, experienceMax, experienceMode, isEditMode, hasVisitedConfigureStation]);

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
        if (assessment.selectedSkills && Array.isArray(assessment.selectedSkills)) {
          // Only set if not already set to prevent duplicates when navigating back
          setSelectedSkills(prev => {
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
            const startLocal = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16);
            setStartTime(startLocal);
          }
          if (schedule.endTime) {
            const endDate = new Date(schedule.endTime);
            const endLocal = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000)
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
            const topicCardsResponse = await generateTopicCardsMutation.mutateAsync({
              jobDesignation: assessment.jobDesignation.trim(),
              experienceMin: assessment.experienceMin !== undefined ? assessment.experienceMin : 0,
              experienceMax: assessment.experienceMax !== undefined ? assessment.experienceMax : 10,
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
        const topicsV2ToLoad = assessment.topics_v2 || responseDataAny?.topics_v2 || response.data?.data?.topics_v2 || null;
        
        console.log("🔍 Checking for topics_v2:", {
          fromAssessment: !!assessment.topics_v2,
          fromResponseData: !!responseDataAny?.topics_v2,
          fromResponseDataData: !!response.data?.data?.topics_v2,
          topicsV2ToLoad: topicsV2ToLoad ? (Array.isArray(topicsV2ToLoad) ? topicsV2ToLoad.length : "not array") : null,
        });
        
        if (topicsV2ToLoad && Array.isArray(topicsV2ToLoad) && topicsV2ToLoad.length > 0) {
          console.log(`✅ Found topics_v2 to load: ${topicsV2ToLoad.length} topics`);
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
              const hasGeneratedQuestions = topic.questionRows.some((row: any) => 
                row.questions && row.questions.length > 0 && row.status === "generated"
              );
              topic.status = hasGeneratedQuestions ? "generated" : "pending";
            }
            
            // Ensure each questionRow has all required fields with defaults
            topic.questionRows.forEach((row: any) => {
              // Ensure status defaults to "pending" if not set
              if (!row.status) {
                row.status = row.questions && row.questions.length > 0 ? "generated" : "pending";
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
              if (row.status === "pending" || !row.questions || row.questions.length === 0) {
                row.locked = false;
              } else if (row.locked === undefined) {
                // Only set locked to true if status is "generated" AND questions exist
                row.locked = row.status === "generated" && row.questions && row.questions.length > 0;
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
            sampleTopic: restoredTopicsV2[0] ? {
              id: restoredTopicsV2[0].id,
              label: restoredTopicsV2[0].label,
              questionRows: restoredTopicsV2[0].questionRows?.map((r: any) => ({
                rowId: r.rowId,
                questionType: r.questionType,
                difficulty: r.difficulty,
                questionsCount: r.questionsCount,
              })) || [],
            } : null,
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
          const initialTopicInputValues: {[topicId: string]: string} = {};
          restoredTopicsV2.forEach((topic: any) => {
            if (topic.id && topic.label) {
              initialTopicInputValues[topic.id] = topic.label;
            }
          });
          
          // 🔍 DEBUG: Log initialized topicInputValues
          console.log("🔍 DEBUG: initialTopicInputValues:", initialTopicInputValues);
          console.log("🔍 DEBUG: Sample topic input value:", {
            firstTopicId: restoredTopicsV2[0]?.id,
            firstTopicLabel: restoredTopicsV2[0]?.label,
            inputValue: initialTopicInputValues[restoredTopicsV2[0]?.id],
          });
          
          setTopicInputValues(initialTopicInputValues);
          
          // Auto-navigate to Station 2 if topics exist
          if (restoredTopicsV2.length > 0) {
            setCurrentStation(2);
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
            fullTopicRegenLocked: assessment.fullTopicRegenLocked || responseData.fullTopicRegenLocked || false,
            allQuestionsGenerated: assessment.allQuestionsGenerated || responseData.allQuestionsGenerated || false,
            navigatedToStation2: true,
          });
        } else {
          console.warn("⚠️ No topics_v2 found in assessment. Available keys:", {
            assessmentKeys: assessment ? Object.keys(assessment) : [],
            assessmentDataKeys: assessmentData ? Object.keys(assessmentData) : [],
            responseDataKeys: response.data?.data ? Object.keys(response.data.data) : [],
            topicsV2ToLoad: topicsV2ToLoad,
          });
        }
        
        // Check both assessment.topics and assessmentData.topics (backend might return topics separately)
        // Only load old format if topics_v2 is not available
        const topicsToLoad = (!assessment.topics_v2 || assessment.topics_v2.length === 0) 
          ? (assessment.topics || (assessmentData as any)?.topics || [])
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
            const isTopicAptitude = t.isAptitude === true || (isAptitude && t.category === "aptitude");
            
            // Load question type configs from questionConfigs if available
            let questionTypeConfigs: QuestionTypeConfig[] = [];
            
            if (t.questionConfigs && t.questionConfigs.length > 0) {
              // Group by question type and difficulty
              const configMap: { [key: string]: QuestionTypeConfig } = {};
              for (const qc of t.questionConfigs) {
                // Handle both plain objects and MongoDB documents
                const qcType = (typeof qc === 'object' && qc !== null) ? (qc.type || (qc as any).get?.("type")) : null;
                const qcDifficulty = (typeof qc === 'object' && qc !== null) ? (qc.difficulty || (qc as any).get?.("difficulty")) : null;
                const qcLanguage = (typeof qc === 'object' && qc !== null) ? (qc.language || (qc as any).get?.("language")) : undefined;
                const qcJudge0 = (typeof qc === 'object' && qc !== null) ? 
                  (qc.judge0_enabled !== undefined ? qc.judge0_enabled : ((qc as any).get?.("judge0_enabled") !== undefined ? (qc as any).get("judge0_enabled") : undefined)) : 
                  undefined;
                
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
                numQuestions: Math.floor((t.numQuestions || 1) / t.questionTypes.length) || 1,
                language: qt === "coding" ? (t.language || getLanguageFromTopic(t.topic)) : undefined,
                judge0_enabled: qt === "coding" ? (t.judge0_enabled !== undefined ? t.judge0_enabled : true) : undefined,
              }));
            } else {
              // Default: single question type
              const questionType = availableQuestionTypes[0] || QUESTION_TYPES[0];
              questionTypeConfigs = [{
                questionType: questionType,
                difficulty: t.difficulty || "Medium",
                numQuestions: t.numQuestions || 1,
                language: questionType === "coding" ? (t.language || getLanguageFromTopic(t.topic)) : undefined,
                judge0_enabled: questionType === "coding" ? (t.judge0_enabled !== undefined ? t.judge0_enabled : true) : undefined,
              }];
            }
            
            if (isTopicAptitude) {
              const availableSubTopics = t.availableSubTopics || t.subTopics || [];
              const defaultSubTopic = availableSubTopics.length > 0 ? availableSubTopics[0] : undefined;
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
                coding_supported: t.coding_supported !== undefined ? t.coding_supported : undefined,
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
              assessmentDataKeys: assessmentData ? Object.keys(assessmentData) : [],
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
            const startLocal = new Date(startDate.getTime() - startDate.getTimezoneOffset() * 60000)
              .toISOString()
              .slice(0, 16);
            setStartTime(startLocal);
          }
          if (schedule.endTime) {
            const endDate = new Date(schedule.endTime);
            const endLocal = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000)
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
        if (assessment.questions && Array.isArray(assessment.questions) && assessment.questions.length > 0) {
          setQuestions(assessment.questions);
        }
        
        // SINGLE DRAFT: No need to store in localStorage - backend maintains single draft
        
        // Check if assessment is finalized (active or completed)
        const assessmentStatus = assessment.status || "draft";
        const finalized = assessmentStatus === "ready" || assessmentStatus === "active" || assessmentStatus === "completed" || assessmentStatus === "scheduled";
        setIsFinalized(finalized);
        
        // If finalized (active or completed), redirect to Analytics page - NO EDIT ALLOWED
        if (finalized) {
          router.push(`/assessments/${assessmentId}/analytics`);
          return;
        }
        
        // Determine which station to show based on what's been completed
        // PRIORITY: Check topics_v2 first (new format)
        // Also respect saved currentStation if available
        if (assessment.currentStation !== undefined && assessment.currentStation > 0) {
          setCurrentStation(assessment.currentStation);
          console.log(`✅ Restored currentStation from draft: ${assessment.currentStation}`);
        } else if (assessment.status === "ready" || assessment.status === "scheduled") {
          setCurrentStation(5); // Show candidates station if finalized
        } else if (assessment.candidates && assessment.candidates.length > 0) {
          setCurrentStation(5);
        } else if (assessment.schedule) {
          setCurrentStation(4);
        } else if ((assessmentData as any)?.questions && (assessmentData as any).questions.length > 0) {
          setCurrentStation(3);
        } else if ((assessment.topics_v2 && assessment.topics_v2.length > 0) || (assessment.topics && assessment.topics.length > 0)) {
          // Navigate to Station 2 if topics exist (either format)
          setCurrentStation(2);
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
        setError(err.response?.data?.message || err.message || "Failed to load draft assessment");
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
      console.log('🔵 [Component] handleGenerateTopicCards - Starting request:', {
        jobDesignation: jobDesignation.trim(),
        experienceMin,
        experienceMax,
        experienceMode,
        assessmentTitle: finalTitle.trim() || undefined,
      });

      const response = await generateTopicCardsMutation.mutateAsync({
        jobDesignation: jobDesignation.trim(),
        experienceMin: experienceMin,
        experienceMax: experienceMax,
        experienceMode: experienceMode,
        assessmentTitle: finalTitle.trim() || undefined,
      });

      console.log('🟢 [Component] handleGenerateTopicCards - Response received:', {
        response,
        responseType: typeof response,
        responseKeys: response ? Object.keys(response) : null,
        hasData: 'data' in (response || {}),
        responseData: response?.data,
        dataType: typeof response?.data,
        dataKeys: response?.data ? Object.keys(response?.data) : null,
        hasSuccess: response?.data ? 'success' in response.data : false,
        successValue: response?.data?.success,
        hasDataData: response?.data ? 'data' in response.data : false,
        dataData: response?.data?.data,
        hasCards: response?.data?.data ? 'cards' in response.data.data : false,
        cards: response?.data?.data?.cards,
        cardsType: typeof response?.data?.data?.cards,
        cardsIsArray: Array.isArray(response?.data?.data?.cards),
        cardsLength: Array.isArray(response?.data?.data?.cards) ? response.data.data.cards.length : null,
      });

      if (response?.success) {
        console.log('✅ [Component] handleGenerateTopicCards - Success path, setting cards:', response.data?.cards);
        setTopicCards(response.data?.cards || []);
      } else {
        console.warn('⚠️ [Component] handleGenerateTopicCards - Success check failed:', {
          hasResponse: !!response,
          successValue: response?.success,
          fullResponse: response,
        });
        setError("Failed to generate topic cards");
      }
    } catch (err: any) {
      console.error("🔴 [Component] handleGenerateTopicCards - Error caught:", {
        error: err,
        message: err?.message,
        response: err?.response,
        responseStatus: err?.response?.status,
        responseData: err?.response?.data,
        responseDataKeys: err?.response?.data ? Object.keys(err.response.data) : null,
        stack: err?.stack,
      });
      setError(err.response?.data?.message || err.message || "Failed to generate topic cards");
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
    if (manualSkillInput.trim() && !selectedSkills.includes(manualSkillInput.trim())) {
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
  const parseCsvFile = (file: File): Promise<Array<{skill_name: string; skill_description: string; importance_level: string}>> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const lines = text.split("\n").filter(line => line.trim());
          if (lines.length < 2) {
            reject(new Error("CSV must have at least a header row and one data row"));
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
              } else if (char === ',' && !inQuotes) {
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
          const header = parseCsvLine(lines[0]).map(h => h.toLowerCase().replace(/^"|"$/g, "").trim());
          
          // STRICT VALIDATION: Must have exactly 3 columns
          if (header.length !== 3) {
            reject(new Error("Invalid CSV: Only three columns allowed — skill_name, skill_description, importance_level."));
            return;
          }
          
          const skillNameIdx = header.indexOf("skill_name");
          const skillDescIdx = header.indexOf("skill_description");
          const importanceIdx = header.indexOf("importance_level");
          
          if (skillNameIdx === -1 || skillDescIdx === -1 || importanceIdx === -1) {
            reject(new Error("CSV must have columns: skill_name, skill_description, importance_level"));
            return;
          }
          
          // Parse data rows
          const data: Array<{skill_name: string; skill_description: string; importance_level: string}> = [];
          for (let i = 1; i < lines.length; i++) {
            const values = parseCsvLine(lines[i]).map(v => {
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
              reject(new Error(`Row ${i + 1}: Invalid CSV format. Each row must have exactly 3 columns (found ${values.length}).`));
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
              reject(new Error(`Row ${i + 1}: importance_level must be Low, Medium, or High (found: "${importance}")`));
              return;
            }
            
            data.push({
              skill_name: skillName,
              skill_description: skillDesc, // Can contain semicolons - that's allowed
              importance_level: importance
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
  const handleSkillRequirementsCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
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
    setCsvData(prevData => prevData.filter((_, idx) => idx !== index));
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
        setRequirementsText(prev => {
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
        throw new Error(response.data?.message || "Failed to fetch and summarize URL");
      }
    } catch (err: any) {
      console.error("Error fetching URL:", err);
      setUrlError(err.response?.data?.message || err.message || "Failed to fetch and summarize website. Please check the URL and try again.");
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
    if (!requirementsText.trim() || processingUrl || isProcessingUrlRef.current) {
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
        if (!isProcessingUrlRef.current && url !== lastProcessedUrlRef.current) {
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
    return topics.filter(topic => {
      // Check if topic has any coding question rows
      const hasCodingQuestions = topic.questionRows.some(
        row => row.questionType === "Coding"
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
  const filterUnsupportedSkills = <T extends {skill_name: string}>(skills: T[]): T[] => {
    return skills.filter(skill => isJudge0Supported(skill.skill_name));
  };

  const handleGenerateTopicsUnified = async () => {
    // Validation: Must have at least one source of requirements (text, URL summary, or skills)
    if (!requirementsText.trim() && !requirementsSummary && selectedSkills.length === 0 && csvData.length === 0) {
      setError("Please provide at least one of the following: requirements text/URL, selected skills, or CSV upload");
      return;
    }

    // Collect skills from all sources (optional - can be used to supplement requirements)
    
    // Method A (Role-based): Skills from topic cards (auto-generated from job designation)
    const roleBasedSkills = selectedSkills
      .filter((skill) => topicCards.includes(skill))
      .map(skill => ({
        skill_name: skill.trim(),
        source: "role" as const,
        description: null,
        importance_level: null
      }));

    // Method B (Manual): Skills manually entered that are NOT in topic cards
    const manualSkills = selectedSkills
      .filter((skill) => !topicCards.includes(skill))
      .map(skill => ({
        skill_name: skill.trim(),
        source: "manual" as const,
        description: null,
        importance_level: null
      }));

    // Method C (CSV): Skills from CSV upload
    const csvSkills = csvData.map(row => ({
      skill_name: row.skill_name.trim(),
      source: "csv" as const,
      description: row.skill_description || null,
      importance_level: row.importance_level || null
    }));

    // Merge all skills from all methods that have data
    const allSkills = [...roleBasedSkills, ...manualSkills, ...csvSkills];

    // Deduplicate by skill_name (case-insensitive) - keep first occurrence
    const seen = new Set<string>();
    let combinedSkills: Array<{skill_name: string; source: "role" | "manual" | "csv"; description: string | null; importance_level: string | null}> = allSkills.filter(skill => {
      const normalized = skill.skill_name.toLowerCase().trim();
      if (seen.has(normalized)) {
        return false; // Skip duplicates
      }
      seen.add(normalized);
      return true;
    });

    // Filter out unsupported frameworks from skills (since coding questions might be generated)
    // This ensures that topics with coding questions will only use Judge0-supported technologies
    combinedSkills = filterUnsupportedSkills(combinedSkills) as typeof combinedSkills;

    // Log for debugging (can be removed in production)
    console.log("Generating topics with requirements and combined skills:", {
      requirementsText: requirementsText.trim() ? requirementsText.trim().substring(0, 100) + "..." : "(empty)",
      requirementsUrl: requirementsUrl || "(none)",
      requirementsSummary: requirementsSummary ? requirementsSummary.substring(0, 100) + "..." : "(none)",
      roleBased: roleBasedSkills.length,
      manual: manualSkills.length,
      csv: csvSkills.length,
      total: combinedSkills.length,
      skills: combinedSkills.map(s => `${s.skill_name} (${s.source})`)
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
          status: "pending" as const // Newly generated topics are always "pending"
        }));
        setTopicsV2(topicsWithStatus);
        
        // ⭐ CRITICAL FIX: Initialize topicInputValues with topic labels
        const initialTopicInputValues: {[topicId: string]: string} = {};
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
        setCurrentStation(2);
      } else {
        setError("Failed to generate topics");
      }
    } catch (err: any) {
      console.error("Error generating topics:", err);
      setError(err.response?.data?.message || err.message || "Failed to generate topics");
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
      const response = await generateTopicsFromRequirementsMutation.mutateAsync({
        experienceMode: experienceMode,
        experienceMin: experienceMin,
        experienceMax: experienceMax,
        requirements: csvData
      });
      
      if (response?.success) {
        const generatedTopics = response.data?.topics || [];
        
        // Update topics_v2 with CSV-generated topics
        setTopicsV2(generatedTopics);
        
        // If editing, update the assessment draft
        if (isEditMode && assessmentId) {
          await updateDraftMutation.mutateAsync({
            assessmentId: assessmentId || undefined,
            topics_v2: generatedTopics
          });
        } else if (!assessmentId) {
          // Create new assessment draft with CSV-generated topics
          const createResponse = await generateTopicsMutation.mutateAsync({
            assessmentTitle: finalTitle.trim() || undefined,
            jobDesignation: "CSV Requirements",
            selectedSkills: csvData.map(r => r.skill_name),
            experienceMin: experienceMin,
            experienceMax: experienceMax,
            experienceMode: experienceMode
          });
          
          if (createResponse?.success) {
            setAssessmentId(createResponse.data?.assessmentId);
            // Override with CSV-generated topics
            setTopicsV2(generatedTopics);
            await updateDraftMutation.mutateAsync({
              assessmentId: createResponse.data?.assessmentId,
              topics_v2: generatedTopics
            });
          }
        }
        
        // Show success message
        setError(null);
        setCsvError(null);
        // Navigate to Station 2 after successful generation
        setCurrentStation(2);
      } else {
        setCsvError("Failed to generate topics from requirements");
      }
    } catch (err: any) {
      console.error("Error generating topics from CSV:", err);
      setCsvError(err.response?.data?.message || err.message || "Failed to generate topics from requirements");
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
          
          console.log(`[Regenerate Topics] Updated topics from response:`, updatedAssessment.topics?.map((t: any) => t.topic));
          console.log(`[Regenerate Topics] Total topics: ${updatedAssessment.topics?.length || 0}`);
          
          // Update state immediately with new topics
          setTopics(updatedAssessment.topics.map((t: any) => t.topic));
          setAvailableQuestionTypes(data.questionTypes || QUESTION_TYPES);
          
          setTopicConfigs(
            updatedAssessment.topics.map((t: any) => {
              const isTopicAptitude = t.isAptitude === true || (isAptitude && t.category === "aptitude");
              
              if (isTopicAptitude) {
                const availableSubTopics = t.availableSubTopics || t.subTopics || [];
                const defaultSubTopic = availableSubTopics.length > 0 ? availableSubTopics[0] : undefined;
                const selectedSubTopic = t.subTopic || defaultSubTopic;
                
                let defaultQuestionType = "MCQ";
                if (selectedSubTopic && t.aptitudeStructure?.subTopics?.[selectedSubTopic]) {
                  const questionTypes = t.aptitudeStructure.subTopics[selectedSubTopic];
                  defaultQuestionType = questionTypes.length > 0 ? questionTypes[0] : "MCQ";
                }
                
                return {
                  topic: t.topic,
                  questionTypeConfigs: [{
                    questionType: defaultQuestionType,
                    difficulty: t.difficulty || "Medium",
                    numQuestions: 1,
                  }],
                  isAptitude: true,
                  subTopic: selectedSubTopic,
                  aptitudeStructure: t.aptitudeStructure || undefined,
                  availableSubTopics: availableSubTopics,
                };
              } else {
                // Handle technical topic
                const questionType = t.questionTypes?.[0] || data.questionTypes?.[0] || QUESTION_TYPES[0];
                const isCoding = questionType === "coding";
                // Auto-detect language for coding questions
                const autoLanguage = isCoding ? getLanguageFromTopic(t.topic) : undefined;
                
                return {
                  topic: t.topic,
                  questionTypeConfigs: [{
                    questionType: questionType,
                    difficulty: t.difficulty || "Medium",
                    numQuestions: 1,
                    language: autoLanguage,
                    judge0_enabled: isCoding ? true : undefined,
                  }],
                  isAptitude: false,
                  coding_supported: t.coding_supported !== undefined ? t.coding_supported : (isCoding ? true : undefined),
                };
              }
            })
          );
        }
        setLoading(false);
        // After generating topics in edit mode, navigate to Station 2
        setCurrentStation(2);
        return;
      }
      
      // CREATE NEW: Do NOT pass assessmentId - backend will create a brand new draft
      // Only pass assessmentId if we're explicitly in edit mode
      
      // Convert selectedSkills (string[]) to combinedSkills (CombinedSkill[])
      const roleBasedSkills = selectedSkills
        .filter((skill) => topicCards.includes(skill))
        .map(skill => ({
          skill_name: skill.trim(),
          source: "role" as const,
          description: null,
          importance_level: null
        }));

      const manualSkills = selectedSkills
        .filter((skill) => !topicCards.includes(skill))
        .map(skill => ({
          skill_name: skill.trim(),
          source: "manual" as const,
          description: null,
          importance_level: null
        }));

      const combinedSkills = [...roleBasedSkills, ...manualSkills];
      
      const topicsResponse = await generateTopicsV2Mutation.mutateAsync({
        // Only pass assessmentId if in edit mode - for new assessments, always omit it
        assessmentId: (isEditMode && assessmentId) ? assessmentId : undefined,
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
          const initialTopicInputValues: {[topicId: string]: string} = {};
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
          const fetchedAssessment = assessmentData || (questionsData as any)?.assessment;
          if (fetchedAssessment) {
            const isAptitude = fetchedAssessment?.isAptitudeAssessment || false;
            
            // Update old topics structure if needed (for backward compatibility)
            if (fetchedAssessment?.topics && fetchedAssessment.topics.length > 0) {
              setTopics(fetchedAssessment.topics.map((t: any) => t.topic));
              setAvailableQuestionTypes(fetchedAssessment.availableQuestionTypes || QUESTION_TYPES);
            }
          }
        }
        
        // Navigate to Station 2 after successful topic generation
        setHasVisitedConfigureStation(true);
        setCurrentStation(2);
      } else {
        setError("Failed to generate topics");
      }
    } catch (err: any) {
      console.error("Error generating topics:", err);
      setError(err.response?.data?.message || err.message || "Failed to generate topics");
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // NEW TOPIC V2 HANDLERS
  // ============================================
  
  const handleGenerateTopicsV2 = async () => {
    if (!assessmentId || selectedSkills.length === 0 || !jobDesignation.trim()) {
      setError("Please complete Station 1 first");
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Convert selectedSkills (string[]) to combinedSkills (CombinedSkill[])
      const roleBasedSkills = selectedSkills
        .filter((skill) => topicCards.includes(skill))
        .map(skill => ({
          skill_name: skill.trim(),
          source: "role" as const,
          description: null,
          importance_level: null
        }));

      const manualSkills = selectedSkills
        .filter((skill) => !topicCards.includes(skill))
        .map(skill => ({
          skill_name: skill.trim(),
          source: "manual" as const,
          description: null,
          importance_level: null
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
        setCurrentStation(2);
      } else {
        setError("Failed to generate topics");
      }
    } catch (err: any) {
      console.error("Error generating topics:", err);
      setError(err.response?.data?.message || err.message || "Failed to generate topics");
    } finally {
      setLoading(false);
    }
  };
  
  const handleRegenerateTopicV2 = async (topicId: string) => {
    if (!assessmentId || fullTopicRegenLocked) {
      setError("Topic improvement is locked");
      return;
    }
    
    const topic = topicsV2.find(t => t.id === topicId);
    if (!topic || topic.locked) {
      setError("Topic is locked and cannot be improved");
      return;
    }
    
    // Disable regenerate for custom topics once they have generated questions
    // Custom topics are identified by having only one questionRow with questionsCount: 1
    const isCustomTopic = topic.questionRows.length === 1 && 
                          topic.questionRows[0].questionsCount === 1 &&
                          topic.questionRows.some(row => row.questions && row.questions.length > 0 && row.status === "generated");
    
    if (isCustomTopic) {
      setError("Custom topics cannot be improved. Use the Preview button on the question row to regenerate individual questions.");
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
      const topicSource = (rawSource === "ai" || !["role", "manual", "csv"].includes(rawSource)) 
        ? "manual" 
        : (rawSource as "role" | "manual" | "csv");
      
      // Reconstruct skill metadata based on source
      let skillMetadataProvided: any = undefined;
      
      if (topicSource === "csv") {
        // Try to find skill from CSV data
        const csvSkill = csvData.find(row => 
          row.skill_name.toLowerCase().trim() === previousTopicLabel.toLowerCase().trim() ||
          previousTopicLabel.toLowerCase().includes(row.skill_name.toLowerCase().trim())
        );
        if (csvSkill) {
          skillMetadataProvided = {
            skill_name: csvSkill.skill_name,
            description: csvSkill.skill_description,
            importance_level: csvSkill.importance_level
          };
        }
      } else if (topicSource === "role") {
        // For role-based, try to find in selectedSkills
        const matchingSkill = selectedSkills.find(skill => 
          skill.toLowerCase().trim() === previousTopicLabel.toLowerCase().trim() ||
          previousTopicLabel.toLowerCase().includes(skill.toLowerCase().trim())
        );
        if (matchingSkill) {
          skillMetadataProvided = {
            skill_name: matchingSkill
          };
        }
      }
      
      // Check if topic has coding questions - if so, verify it's supported by Judge0
      const hasCodingQuestions = topic.questionRows.some(
        row => row.questionType === "Coding"
      );
      
      if (hasCodingQuestions && !isJudge0Supported(previousTopicLabel)) {
        setError(`Cannot regenerate topic "${previousTopicLabel}" - it contains coding questions but is not supported by Judge0. Please use a different topic or change the question type.`);
        setGeneratingRowId(null);
        return;
      }
      
      // Filter skill metadata if it contains unsupported frameworks and topic has coding questions
      if (hasCodingQuestions && skillMetadataProvided && !isJudge0Supported(skillMetadataProvided.skill_name)) {
        setError(`Cannot regenerate topic "${previousTopicLabel}" - the related skill "${skillMetadataProvided.skill_name}" is not supported by Judge0 for coding questions.`);
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
        const updatedTopicLabel = responseData?.updatedTopicLabel || responseData?.topic?.label;
        
        // Check if the updated topic has coding questions and is supported by Judge0
        if (updatedTopicLabel) {
          const updatedTopic = topicsV2.find(t => t.id === topicId);
          const hasCodingQuestions = updatedTopic?.questionRows.some(
            row => row.questionType === "Coding"
          ) || false;
          
          // If topic has coding questions, verify the updated label is supported
          if (hasCodingQuestions && !isJudge0Supported(updatedTopicLabel)) {
            setError(`Cannot update topic to "${updatedTopicLabel}" - it contains coding questions but is not supported by Judge0.`);
            setGeneratingRowId(null);
            return;
          }
        }
        
        if (updatedTopicLabel) {
          // Update only the label, preserve everything else
          setTopicsV2(prev => prev.map(t => {
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
                status: "regenerated" as const // Set status to "regenerated" so questions will be regenerated
              };
            }
            return t;
          }));
          
          // Also update topicInputValues to reflect the new label in the input field
          setTopicInputValues(prev => ({
            ...prev,
            [topicId]: updatedTopicLabel
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
      setError(err.response?.data?.message || err.message || "Failed to improve topic");
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
    
    const topic = topicsV2.find(t => t.id === topicId);
    if (!topic) {
      setError("Topic not found");
      return;
    }
    
    const row = topic.questionRows.find(r => r.rowId === rowId);
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
      const updatedTopics = topicsV2.map(t => {
        if (t.id === topicId) {
          return {
            ...t,
            status: "regenerated" as const, // Set topic status to "regenerated"
            questionRows: t.questionRows.map(r => {
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
        const finalTopics = updatedTopics.map(t => {
          if (t.id === topicId) {
            const updatedRows = t.questionRows.map(r => {
              if (r.rowId === rowId) {
                return {
                  ...updatedRow,
                  status: "generated" as const, // Mark as generated after regeneration
                };
              }
              return r;
            });
            
            // Check if all rows have generated questions
            const allRowsGenerated = updatedRows.every(r => 
              r.status === "generated" && r.questions && r.questions.length > 0
            );
            
            return {
              ...t,
              questionRows: updatedRows,
              status: allRowsGenerated ? "generated" as const : (t.status || "pending"), // Update topic status
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
      setError(err.response?.data?.message || err.message || "Failed to regenerate question");
    } finally {
      setGeneratingRowId(null);
    }
  };
  
  // Auto-generate all pending questions when moving to Review Questions
  // ONLY generates for topics with status "pending" or "regenerated"
  // NEVER regenerates topics with status "generated" or "completed"
  const handleNextToReviewQuestions = async () => {
    if (!assessmentId) {
      setError("Assessment ID is required");
      return;
    }

    if (!topicsV2 || topicsV2.length === 0) {
      setError("Please configure at least one topic");
      return;
    }

    // Find topics that need question generation (ONLY pending or regenerated)
    const topicsToGenerate: Array<{
      topic: TopicV2;
      rows: Array<{ rowId: string; row: QuestionRow }>;
    }> = [];

    topicsV2.forEach(topic => {
      const topicStatus = topic.status || "pending";
      
      // ONLY generate for topics with status "pending" or "regenerated"
      // SKIP topics with status "generated" or "completed"
      if (topicStatus === "pending" || topicStatus === "regenerated") {
        const rowsToGenerate: Array<{ rowId: string; row: QuestionRow }> = [];
        
        topic.questionRows.forEach(row => {
          // Only generate for rows that don't have questions or are pending
          const needsGeneration = 
            row.status === "pending" || 
            !row.questions || 
            row.questions.length === 0;
          
          if (needsGeneration && !row.locked) {
            rowsToGenerate.push({
              rowId: row.rowId,
              row
            });
          }
        });

        if (rowsToGenerate.length > 0) {
          topicsToGenerate.push({
            topic,
            rows: rowsToGenerate
          });
        }
      }
    });

    if (topicsToGenerate.length === 0) {
      // All topics already have questions generated, just move to next station
      setCurrentStation(3);
      return;
    }

    // Generate questions for all pending/regenerated topics
    setGeneratingAllQuestions(true);
    setError(null);

    // ✅ SPEED OPTIMIZATION: Calculate total tasks for progress tracking
    const totalTasks = topicsToGenerate.reduce((sum, { rows }) => sum + rows.length, 0);
    setGenerationProgress({
      total: totalTasks,
      completed: 0,
      failed: 0,
      currentTopic: '',
      currentQuestionType: '',
      estimatedTimeRemaining: totalTasks * 3, // ~3 seconds per question initial estimate
    });
    setShowGenerationSkeleton(true);

    const startTime = Date.now();

    try {
      // ✅ SPEED OPTIMIZATION: Parallel generation with concurrency limit (5)
      const CONCURRENCY_LIMIT = 5;
      
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
              let retries = 0;
              const maxRetries = 3;
              const baseDelay = 1000; // 1 second

              while (retries <= maxRetries) {
                try {
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
                    additionalRequirements: row.additionalRequirements || undefined,
                  });

                  if (response?.success) {
                    return { success: true, topic, rowId, row, response: response };
                  } else {
                    throw new Error(`Failed to generate questions for topic ${topic.label}, row ${rowId}`);
                  }
                } catch (err: any) {
                  // ✅ SPEED OPTIMIZATION: Automatic backoff for rate limiting
                  if (err.response?.status === 429 || err.response?.status === 503) {
                    // Rate limit hit - exponential backoff
                    if (retries < maxRetries) {
                      const delay = baseDelay * Math.pow(2, retries);
                      console.warn(`Rate limit hit for ${topic.label}/${rowId}, retrying in ${delay}ms...`);
                      await new Promise(resolve => setTimeout(resolve, delay));
                      retries++;
                      continue;
                    }
                  }
                  
                  // Other errors or max retries reached
                  if (retries < maxRetries) {
                    const delay = baseDelay * Math.pow(2, retries);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    retries++;
                  } else {
                    throw err;
                  }
                }
              }
              
              return { success: false, topic, rowId, row, error: "Max retries reached" };
            }
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
              setGenerationProgress(prev => ({
                ...prev,
                currentTopic: taskData.topic.label,
                currentQuestionType: taskData.row.questionType,
              }));

              const result = await taskData.task();
              
              // Calculate time-based progress
              const elapsed = (Date.now() - startTime) / 1000;
              const processed = completedCount + failedCount + 1;
              const avgTimePerQuestion = processed > 0 ? elapsed / processed : 3;
              const remaining = totalTasks - processed;
              
              if (result.success) {
                completedCount++;
                const { topic, rowId, row, response } = result;
                const updatedRow = response.data.row;
                
                // Add timer to each question if not present
                if (updatedRow.questions && Array.isArray(updatedRow.questions)) {
                  updatedRow.questions = updatedRow.questions.map((q: any) => {
                    if (!q.timer) {
                      // Calculate timer based on question type and difficulty
                      const baseTime = getBaseTimePerQuestion(row.questionType);
                      const multiplier = getDifficultyMultiplier(row.difficulty);
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
                setTopicsV2(prev => prev.map(t => 
                  t.id === topic.id 
                    ? {
                        ...t,
                        questionRows: t.questionRows.map(r => 
                          r.rowId === rowId ? updatedRow : r
                        ),
                        // Update topic status to "generated" after successful generation
                        status: "generated" as const
                      }
                    : t
                ));
              } else {
                failedCount++;
                console.warn(`Failed to generate questions for topic ${result.topic.label}, row ${result.rowId}`);
              }
              
              // Update progress with all metrics
              setGenerationProgress(prev => ({
                ...prev,
                completed: completedCount,
                failed: failedCount,
                estimatedTimeRemaining: Math.max(0, Math.ceil(avgTimePerQuestion * remaining)),
              }));
              
              return result;
            } catch (err) {
              failedCount++;
              const elapsed = (Date.now() - startTime) / 1000;
              const processed = completedCount + failedCount;
              const avgTimePerQuestion = processed > 0 ? elapsed / processed : 3;
              const remaining = totalTasks - processed;
              
              setGenerationProgress(prev => ({
                ...prev,
                completed: completedCount,
                failed: failedCount,
                estimatedTimeRemaining: Math.max(0, Math.ceil(avgTimePerQuestion * remaining)),
              }));
              
              console.error(`Error generating questions for topic ${taskData.topic.label}, row ${taskData.rowId}:`, err);
              return { success: false, topic: taskData.topic, rowId: taskData.rowId, error: err };
            }
          })
        );
      };

      // Process tasks in batches with concurrency limit
      for (let i = 0; i < allTasks.length; i += CONCURRENCY_LIMIT) {
        const batch = allTasks.slice(i, i + CONCURRENCY_LIMIT);
        await processBatch(batch);
      }

      // Save draft after generation with updated statuses
      if (assessmentId) {
        // Reconstruct combinedSkills from current state (same logic as handleGenerateTopicsUnified)
        const roleBasedSkills = selectedSkills
          .filter((skill) => topicCards.includes(skill))
          .map(skill => ({
            skill_name: skill.trim(),
            source: "role" as const,
            description: null,
            importance_level: null
          }));
        
        const manualSkills = selectedSkills
          .filter((skill) => !topicCards.includes(skill))
          .map(skill => ({
            skill_name: skill.trim(),
            source: "manual" as const,
            description: null,
            importance_level: null
          }));
        
        const csvSkills = csvData.map(row => ({
          skill_name: row.skill_name.trim(),
          source: "csv" as const,
          description: row.skill_description || null,
          importance_level: row.importance_level || null
        }));
        
        const allSkills = [...roleBasedSkills, ...manualSkills, ...csvSkills];
        const seen = new Set<string>();
        const combinedSkills = allSkills.filter(skill => {
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
            topics_v2: topicsV2.map(t => {
              const topicToGen = topicsToGenerate.find(tg => tg.topic.id === t.id);
              if (topicToGen) {
                return {
                  ...t,
                  status: "generated" as const,
                  questionRows: t.questionRows.map(r => {
                    const rowUpdate = topicToGen.rows.find(ru => ru.rowId === r.rowId);
                    return rowUpdate ? { ...r, status: "generated" as const } : r;
                  })
                };
              }
              return t;
            }),
            combinedSkills: combinedSkills,
            experienceMode: experienceMode,
            experienceMin: experienceMin,
            experienceMax: experienceMax,
          }
        });
      }

      // Hide skeleton and move to Review Questions station
      setShowGenerationSkeleton(false);
      setCurrentStation(3);
    } catch (err: any) {
      console.error("Error generating questions:", err);
      setError(err.response?.data?.message || err.message || "Failed to generate some questions. Please try again.");
      setShowGenerationSkeleton(false);
    } finally {
      setGeneratingAllQuestions(false);
    }
  };

  const handleRegenerateAllTopicsV2 = async () => {
    // Check if any topics have generated questions - if so, disable regenerate all
    const hasGeneratedQuestions = topicsV2.some(topic => 
      topic.status === "generated" || topic.status === "completed" ||
      topic.questionRows.some(row => 
        row.questions && row.questions.length > 0 && row.status === "generated"
      )
    );
    
    if (!assessmentId || fullTopicRegenLocked || allQuestionsGenerated || hasGeneratedQuestions) {
      setError("Topic improvement is locked after questions have been generated. Use 'Regenerate Topic' for individual topics.");
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
      const roleBasedSkills = topicCards.map(skill => ({
        skill_name: skill.trim(),
        source: "role" as const,
        description: null,
        importance_level: null
      }));
      
      const manualSkills = selectedSkills
        .filter((skill) => !topicCards.includes(skill))
        .map(skill => ({
          skill_name: skill.trim(),
          source: "manual" as const,
          description: null,
          importance_level: null
        }));
      
      const csvSkills = csvData.map(row => ({
        skill_name: row.skill_name.trim(),
        source: "csv" as const,
        description: row.skill_description || null,
        importance_level: row.importance_level || null
      }));
      
      const allSkills = [...roleBasedSkills, ...manualSkills, ...csvSkills];
      const seen = new Set<string>();
      let combinedSkills = allSkills.filter(skill => {
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
        .filter(topic => !topic.locked) // Skip locked topics
        .filter(topic => {
          // If topic has coding questions, check if it's supported by Judge0
          const hasCodingQuestions = topic.questionRows.some(
            row => row.questionType === "Coding"
          );
          if (hasCodingQuestions) {
            return isJudge0Supported(topic.label);
          }
          return true; // Keep topics without coding questions
        })
        .map(topic => {
          // Try to find related skill
          let relatedSkill: string | undefined = undefined;
          const rawSource = topic.source || "manual";
          const topicSource = (rawSource === "ai" || !["role", "manual", "csv"].includes(rawSource)) 
            ? "manual" 
            : (rawSource as "role" | "manual" | "csv");
          
          if (topicSource === "csv") {
            const csvSkill = csvData.find(row => 
              row.skill_name.toLowerCase().trim() === topic.label.toLowerCase().trim() ||
              topic.label.toLowerCase().includes(row.skill_name.toLowerCase().trim())
            );
            relatedSkill = csvSkill?.skill_name;
          } else if (topicSource === "role") {
            const matchingSkill = selectedSkills.find(skill => 
              skill.toLowerCase().trim() === topic.label.toLowerCase().trim() ||
              topic.label.toLowerCase().includes(skill.toLowerCase().trim())
            );
            relatedSkill = matchingSkill;
          } else {
            // For manual, try to find in selectedSkills
            const matchingSkill = selectedSkills.find(skill => 
              skill.toLowerCase().trim() === topic.label.toLowerCase().trim() ||
              topic.label.toLowerCase().includes(skill.toLowerCase().trim())
            );
            relatedSkill = matchingSkill;
          }
          
          return {
            topicId: topic.id,
            previousTopicLabel: topic.label,
            source: topicSource,
            relatedSkill: relatedSkill
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
        setTopicsV2(prev => prev.map(topic => {
          const updated = updatedTopics.find((ut: any) => ut.id === topic.id);
          if (updated) {
            return {
              ...topic,
              label: updated.label,
              regenerated: true,
              previousVersion: updated.previousVersion || []
            };
          }
          return topic;
        }));
      } else {
        setError("Failed to improve topics");
      }
    } catch (err: any) {
      console.error("Error improving topics:", err);
      setError(err.response?.data?.message || err.message || "Failed to improve topics");
    } finally {
      setLoading(false);
    }
  };
  
  // OLD: Keep for backward compatibility with existing UI
  const [selectedCategoryForNewTopic, setSelectedCategoryForNewTopic] = useState<"aptitude" | "communication" | "logical_reasoning" | null>(null);
  const [showTechnicalInput, setShowTechnicalInput] = useState(false);
  
  // NEW: Redesigned Add Custom Topic states (for future use)
  const [selectedCategory, setSelectedCategory] = useState<"aptitude" | "communication" | "logical" | "technical" | null>(null);
  const [topicInput, setTopicInput] = useState("");
  const [isAddingTopicNew, setIsAddingTopicNew] = useState(false);
  const [aiValidationResult, setAiValidationResult] = useState<{
    isValid: boolean;
    reason: string;
    suggestions: string[];
  } | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [validationDebounceTimerNew, setValidationDebounceTimerNew] = useState<NodeJS.Timeout | null>(null);

  // Helper function to determine default question type based on category and topic name
  const getDefaultQuestionType = async (
    topicName: string,
    category: "aptitude" | "communication" | "logical_reasoning"
  ): Promise<"MCQ" | "Subjective"> => {
    // For communication, default to Subjective
    if (category === "communication") {
      return "Subjective";
    }
    
    // For aptitude and logical reasoning, try to determine based on semantic meaning
    try {
      const response = await generateTopicContextMutation.mutateAsync({
        topicName: topicName.trim(),
        category: category
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
      const numericKeywords = ["percentage", "ratio", "profit", "loss", "interest", "average", "mixture", "number"];
      const isNumeric = numericKeywords.some(keyword => topicName.toLowerCase().includes(keyword));
      return isNumeric ? "MCQ" : "Subjective";
    }
    
    if (category === "logical_reasoning") {
      // Check if topic suggests puzzles/patterns
      const puzzleKeywords = ["puzzle", "pattern", "sequence", "arrangement", "coding", "decoding"];
      const isPuzzle = puzzleKeywords.some(keyword => topicName.toLowerCase().includes(keyword));
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
    console.log("Suggestion clicked:", suggestion, "Category:", selectedCategoryForNewTopic); // Debug log
    
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
          setTopicValidationError(validationResult.error || "The entered topic does not match the selected category. Please enter a valid topic.");
        }
      } else {
        setIsTopicValid(false);
        setTopicValidationError("Unable to validate topic. Please try again.");
      }
    } catch (err: any) {
      console.error("Error validating topic category:", err);
      setIsTopicValid(false);
      setTopicValidationError(err.response?.data?.data?.error || "Unable to validate topic. Please try again.");
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
        topic: topic.trim()
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
    const topicExists = topicsV2.some(t => t.label.toLowerCase() === topicName.toLowerCase());
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
        const errorMsg = "Invalid topic for selected category. Please enter only aptitude/communication/logical reasoning topics. Technical topics are not allowed.";
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
        const validationResponse = await validateTopicCategoryMutation.mutateAsync({
          topic: topicName.trim(),
          category: finalCategory,
        });
        
        if (validationResponse?.success && validationResponse.data) {
          const validationResult = validationResponse.data;
          if (!validationResult.valid) {
            const errorMsg = validationResult.error || "Invalid topic for selected category. Please enter only aptitude/communication/logical reasoning topics.";
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
        const errorMsg = err.response?.data?.data?.error || err.response?.data?.message || "Invalid topic for selected category. Please enter only aptitude/communication/logical reasoning topics.";
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
        category: finalCategory
      });
      
      if (response?.success && response.data) {
        contextData = response.data;
        defaultQuestionType = contextData.suggestedQuestionType || "MCQ";
        contextSummary = contextData.contextSummary;
      }
    } catch (err: any) {
      console.error("Error getting topic context:", err);
        // If context generation fails, check if it's a validation error
        const errorMsg = err.response?.data?.data?.error || err.response?.data?.message;
        if (errorMsg && (errorMsg.toLowerCase().includes("invalid") || errorMsg.toLowerCase().includes("not match"))) {
          resetUIOnValidationFailure(errorMsg);
          return;
        }
        // Fallback to defaults - don't block topic creation for other errors
      defaultQuestionType = finalCategory === "communication" ? "Subjective" : "MCQ";
    }
      
      // Double-check for duplicate before adding (race condition protection)
      const topicExistsNow = topicsV2.some(t => t.label.toLowerCase() === topicName.toLowerCase());
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
      questionRows: [{
        rowId: generateId(),
        questionType: defaultQuestionType,
        difficulty: contextData.difficulty || "Medium",
        questionsCount: 1,
        canUseJudge0: false, // Soft skills never use Judge0
        status: "pending",
        locked: false,
        questions: []
      }],
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
    setTopicInputValues(prev => ({ ...prev, [newTopic.id]: topicName }));
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
      const errorMsg = err.response?.data?.data?.error || err.response?.data?.message || "Failed to add topic. Please try again.";
      
      // Check if it's a validation error
      if (errorMsg.toLowerCase().includes("invalid") || errorMsg.toLowerCase().includes("not match") || errorMsg.toLowerCase().includes("technical")) {
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
    if (!selectedCategory || selectedCategory === "technical" || value.trim().length < 2) {
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
          input: value.trim()
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
        const reason = aiValidationResult?.reason || "Topic is not valid for this category";
        setToastMessage(`This topic is not relevant to ${selectedCategory}. Reason: ${reason}`);
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
        topicName: topicName
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
      const errorMsg = err.response?.data?.message || "Failed to add topic. Please try again.";
      setToastMessage(errorMsg);
      setTimeout(() => setToastMessage(null), 5000);
    } finally {
      setIsAddingTopicNew(false);
    }
  };

  const handleAddCustomTopicV2 = async (isTechnical: boolean = false, topicNameOverride?: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault(); // REQUIRED: Prevent form refresh
      event.stopPropagation(); // Prevent event bubbling
    }
    
    // For soft skills, use the dedicated handler
    if (!isTechnical && selectedCategoryForNewTopic) {
      return handleAddSoftSkillTopic(event);
    }
    
    // Prevent multiple simultaneous additions
    if (addingTopic) {
      return;
    }
    
    const topicName = (topicNameOverride || customTopicInputV2.trim());
    if (!topicName) return;
    
    // Check for duplicate topic names (case-insensitive)
    const topicExists = topicsV2.some(t => t.label.toLowerCase() === topicName.toLowerCase());
    if (topicExists) {
      setToastMessage("Topic already added.");
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    
    // Set loading state
    setAddingTopic(true);
    
    let finalCategory: "aptitude" | "communication" | "logical_reasoning" | "technical";
    let defaultQuestionType: "MCQ" | "Subjective" | "PseudoCode" | "Coding" | "SQL" | "AIML" = "MCQ";
    let canUseJudge0 = false;
    let contextSummary: string | undefined = undefined;
    let codingSupported = false; // Track coding support from classification
    let isSqlRelated = false; // Track if topic is SQL-related
    let isAimlRelated = false; // Track if topic is AIML-related
    
    try {
    if (isTechnical) {
      finalCategory = "technical";
      
      // Classify technical topic using AI
      try {
        setLoading(true);
        const response = await classifyTechnicalTopicMutation.mutateAsync({
          topic: topicName
        });
        
        if (response?.success && response.data) {
          const classification = response.data;
          defaultQuestionType = classification.questionType as "MCQ" | "Subjective" | "PseudoCode" | "Coding" | "SQL" | "AIML";
          canUseJudge0 = classification.canUseJudge0 || false;
          codingSupported = classification.coding_supported || false; // Get coding_supported from classification
          contextSummary = classification.contextExplanation;
          
          // Detect if classification returned SQL or AIML, or if topic is SQL/AIML-related
          const classifiedType = classification.questionType?.toUpperCase();
          if (classifiedType === "SQL") {
            isSqlRelated = true;
          } else if (classifiedType === "AIML") {
            isAimlRelated = true;
          } else {
            // Fallback: use frontend detection as backup
            isSqlRelated = isTopicSqlRelated(topicName);
            isAimlRelated = isTopicAimlRelated(topicName);
          }
          
          // Ensure canUseJudge0 is false if question type is not Coding
          if (defaultQuestionType !== "Coding") {
            canUseJudge0 = false;
          }
        } else {
          // If classification fails, use frontend detection as fallback
          isSqlRelated = isTopicSqlRelated(topicName);
          isAimlRelated = isTopicAimlRelated(topicName);
        }
      } catch (err: any) {
        console.error("Error classifying technical topic:", err);
        // On error, use frontend detection as fallback
        isSqlRelated = isTopicSqlRelated(topicName);
        isAimlRelated = isTopicAimlRelated(topicName);
        
        const errorMsg = err.response?.data?.message || err.response?.data?.data?.error || "Failed to classify topic. Please try again.";
        setToastMessage(errorMsg);
        setTimeout(() => setToastMessage(null), 5000);
        setLoading(false);
        // Exit early - the outer finally block will reset addingTopic
        // The finally block executes even when returning from try block
        return;
      } finally {
        setLoading(false);
      }
    } else {
      // This should not happen for soft skills (handled by handleAddSoftSkillTopic)
        setAddingTopic(false);
      return;
    }
    
    // Determine allowed question types based on category, coding support, and SQL/AIML detection
    // At this point, finalCategory is guaranteed to be "technical" (soft skills return early above)
    
    // Build allowed question types dynamically based on classification results
    const baseTypes = ["MCQ", "Subjective", "PseudoCode"];
    
    // Check for web-related topics (don't show Coding for web topics)
    const isWebRelated = isTopicWebRelated(topicName);
    
    // Check if topic supports Judge0-compatible Coding (DSA/algorithmic in supported languages)
    const isCodingCompatible = isTopicCodingSupported(topicName);
    
    // Add Coding only if:
    // - codingSupported is true (from classification)
    // - NOT SQL-related
    // - NOT AIML-related
    // - NOT web-related
    // - Mentions Judge0-supported language and DSA concepts
    const shouldIncludeCoding = codingSupported && 
                                 !isSqlRelated && 
                                 !isAimlRelated && 
                                 !isWebRelated &&
                                 isCodingCompatible;
    
    const allowedQuestionTypes: string[] = [
      ...baseTypes,
      ...(isSqlRelated ? ["SQL"] : []),
      ...(isAimlRelated ? ["AIML"] : []),
      ...(shouldIncludeCoding ? ["Coding"] : [])
    ];
    
    // Check if questions have already been generated (any topic has generated questions)
    const hasGeneratedQuestions = topicsV2.some(topic => 
      topic.questionRows.some(row => 
        row.questions && row.questions.length > 0 && row.status === "generated"
      )
    );
    
    const newTopic: TopicV2 = {
      id: generateId(),
      label: topicName,
      locked: false,
      category: finalCategory,
      contextSummary: contextSummary,
      coding_supported: codingSupported, // NEW: Store coding_supported in topic
      allowedQuestionTypes: allowedQuestionTypes,
      status: "pending", // NEW: Always "pending" for newly added topics
      questionRows: [{
        rowId: generateId(),
        questionType: defaultQuestionType,
        difficulty: "Medium",
        questionsCount: 1,
        canUseJudge0: canUseJudge0,
        status: "pending", // Always pending for new custom topics
        locked: false,
        questions: [],
      }],
    };
    
    // If questions have already been generated, this is a custom topic added after generation
    // Mark it as pending and do NOT trigger auto-generation
    if (hasGeneratedQuestions) {
      console.log(`[Custom Topic] Added after questions generated - marking as pending, no auto-generation`);
    }
      
      // Double-check for duplicate before adding (race condition protection)
      const topicExistsNow = topicsV2.some(t => t.label.toLowerCase() === topicName.toLowerCase());
      if (topicExistsNow) {
        setToastMessage("Topic already added.");
        setTimeout(() => setToastMessage(null), 3000);
        // Don't return here - let the finally block handle resetting addingTopic
        return;
      }
    
    // CRITICAL: Use functional update to guarantee immediate UI update
    setTopicsV2((prev) => [...prev, newTopic]);
    
    // Save to database immediately (await to ensure it completes)
    if (assessmentId) {
      try {
        await updateDraftMutation.mutateAsync({
          assessmentId: assessmentId || undefined,
          topics_v2: [...topicsV2, newTopic], // Use updated topics array
        });
        console.log("Custom topic saved to database:", newTopic.id);
      } catch (err: any) {
        console.error("Error updating draft:", err);
          setToastMessage("Failed to save topic. Please try again.");
          setTimeout(() => setToastMessage(null), 3000);
        // Remove the topic from state if save failed
        setTopicsV2((prev) => prev.filter(t => t.id !== newTopic.id));
          // Don't return here - let the finally block handle resetting addingTopic
        return;
      }
    }
    
    setTopicInputValues(prev => ({ ...prev, [newTopic.id]: topicName }));
    setCustomTopicInputV2("");
    setShowTechnicalInput(false);
    setShowAiSuggestions(false);
    setAiTopicSuggestions([]);
      setSuggestionsFetched(false); // Reset fetched flag
    } catch (err: any) {
      console.error("Error adding technical topic:", err);
      setToastMessage("Failed to add topic. Please try again.");
      setTimeout(() => setToastMessage(null), 3000);
    } finally {
      setAddingTopic(false);
    }
  };
  
  const handleRemoveTopicV2 = (topicId: string) => {
    setTopicsV2(prev => prev.filter(t => t.id !== topicId));
  };
  
  // Detect category from topic name (semantic)
  const detectTopicCategory = async (topicName: string): Promise<"aptitude" | "communication" | "logical_reasoning" | "technical"> => {
    if (!topicName || topicName.trim().length < 2) return "technical";
    
    try {
      // Use OpenAI to detect category semantically
      const response = await detectTopicCategoryMutation.mutateAsync({
        topicName: topicName.trim()
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
  const fetchTopicSuggestions = async (partialInput: string, category: string) => {
    if (!partialInput || partialInput.length < 2) {
      setTopicSuggestions([]);
      return;
    }
    
    setLoadingSuggestions(true);
    try {
      const response = await suggestTopicContextsMutation.mutateAsync({
        partialInput: partialInput.trim(),
        category: category
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
  const fetchAiTopicSuggestions = async (query: string, category: string, forceFetch: boolean = false) => {
    // Only fetch suggestions for soft skills (aptitude, communication, logical_reasoning)
    const softSkillCategories = ["aptitude", "communication", "logical_reasoning"];
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
      console.log("fetchAiTopicSuggestions: Starting fetch", { query, category, forceFetch, suggestionsFetched }); // Debug
      
      // Always fetch if forceFetch is true, otherwise check if already fetched
      // Note: We check suggestionsFetched here but it's a closure - this is OK since we reset it above if forceFetch
      if (!forceFetch && suggestionsFetched) {
        console.log("fetchAiTopicSuggestions: Skipping - already fetched and not forcing"); // Debug
        return;
      }
      
      setLoadingAiSuggestions(true);
      setShowAiSuggestions(true); // Show loading state immediately
      try {
        console.log("fetchAiTopicSuggestions: Making API call", { category, query: queryTrimmed }); // Debug
        const response = await suggestTopicsMutation.mutateAsync({
          category: category,
          query: queryTrimmed || "" // Allow empty query for general suggestions
        });
        
        console.log("fetchAiTopicSuggestions: API response", response.data); // Debug
        
        if (response?.success && response.data?.suggestions) {
          // Filter out technical topics on frontend using OpenAI (async, but we'll do it in parallel)
          const suggestions = response.data.suggestions;
          console.log("fetchAiTopicSuggestions: Raw suggestions", suggestions); // Debug
          
          // Check all suggestions in parallel for better performance (limit to first 10 for performance)
          const suggestionsToCheck = suggestions.slice(0, 10);
          const technicalChecks = await Promise.all(
            suggestionsToCheck.map((suggestion: string) => checkIfTechnicalTopic(suggestion))
          );
          
          const filteredSuggestions = suggestionsToCheck.filter((suggestion: string, index: number) => {
            return !technicalChecks[index]; // Keep only non-technical suggestions
          });
          
          // Add remaining suggestions without checking (they're likely safe if backend filtered them)
          const remainingSuggestions = suggestions.slice(10);
          const allFiltered = [...filteredSuggestions, ...remainingSuggestions];
          
          console.log("fetchAiTopicSuggestions: Filtered suggestions", allFiltered); // Debug
          
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
  const generateTopicContext = async (topicId: string, topicName: string, category: string) => {
    if (!topicName || topicName.trim().length === 0) return;
    
    try {
      const response = await generateTopicContextMutation.mutateAsync({
        topicName: topicName.trim(),
        category: category
      });
      
      if (response?.success && response.data) {
        const { contextSummary, suggestedQuestionType } = response.data;
        
        setTopicsV2(prev => prev.map(t => {
          if (t.id === topicId) {
            const updatedTopic = { ...t, contextSummary, suggestedQuestionType };
            
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
        }));
      }
    } catch (err: any) {
      console.error("Error generating context:", err);
    }
  };

  // Handle topic name input with suggestions
  const handleTopicNameChange = (topicId: string, value: string) => {
    // Update input value immediately
    setTopicInputValues(prev => ({ ...prev, [topicId]: value }));
    handleUpdateTopicV2(topicId, "label", value);
    
    // Detect category if not set (async, don't await)
    const topic = topicsV2.find(t => t.id === topicId);
    const specialCategories = ["aptitude", "communication", "logical_reasoning"] as const;
    const isSpecialCategory = topic?.category && specialCategories.includes(topic.category as any);
    
    if (!topic?.category || (topic.category === "technical" || !isSpecialCategory)) {
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
              const updatedTopics = currentTopics.map(t => {
                if (t.id === topicId) {
                  return { ...t, category: detectedCategory };
                }
                return t;
              });
              
              console.log(`💾 Saving category "${detectedCategory}" for topic: ${value}`);
              
              const saveResponse = await updateDraftMutation.mutateAsync({
                assessmentId: assessmentId || undefined,
                topics_v2: updatedTopics,
              });
              
              if (saveResponse?.success) {
                console.log(`✅ Category "${detectedCategory}" saved successfully for topic: ${value}`);
              } else {
                console.warn("Category save response indicates failure:", saveResponse);
                setError(`Failed to save category update. Please try saving the assessment manually.`);
              }
              
              categorySaveDebounceRef.current = null;
            } catch (err: any) {
              console.error("❌ Error saving category update:", err);
              setError(`Failed to save category update: ${err.response?.data?.message || err.message || "Unknown error"}. The category is updated locally but not saved to the database. Please try saving the assessment manually.`);
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
    document.addEventListener('mousedown', handleClickOutside);

    // Cleanup
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAiSuggestions]);

  const handleUpdateTopicV2 = (topicId: string, field: keyof TopicV2, value: any) => {
    setTopicsV2(prev => prev.map(t => {
      if (t.id === topicId) {
        return { ...t, [field]: value };
      }
      return t;
    }));
  };
  
  const handleAddQuestionRow = async (topicId: string) => {
    if (!assessmentId) {
      setError("Assessment ID is required");
      return;
    }
    
    const topic = topicsV2.find(t => t.id === topicId);
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
      console.log("Ensuring topic is saved before adding question row...", { topicId, assessmentId });
      
      // First, ensure the topic exists in the draft by saving it
      const saveResponse = await updateDraftMutation.mutateAsync({
        assessmentId: assessmentId || undefined,
        topics_v2: topicsV2,
      });
      
      if (!saveResponse?.success) {
        console.warn("Draft save response indicates failure:", saveResponse);
      }
      
      // Small delay to ensure database write completes
      await new Promise(resolve => setTimeout(resolve, 200));
      
      console.log("Draft saved, now adding question row...");
    } catch (err: any) {
      console.error("Error saving draft before adding question row:", err);
      setError("Failed to save topic. Please try again.");
      return; // Don't proceed if we can't save the topic
    }
    
    try {
      console.log("Calling add-question-row endpoint...", { assessmentId, topicId });
      
      const response = await addQuestionRowMutation.mutateAsync({
        assessmentId: assessmentId || "",
        topicId: topicId,
      });
      
      console.log("Add question row response:", response.data);
      
      if (response?.success) {
        const updatedTopic = response.data?.topic;
        const updatedRow = response.data?.row;
        
        // Update state with the new row
        setTopicsV2(prev => prev.map(t => {
          if (t.id === topicId) {
            // If topic was "generated" and we're adding a new row, mark as "pending" so it will regenerate
            const newStatus = t.status === "generated" ? "pending" as const : (t.status || "pending");
            return {
              ...t,
              status: newStatus,
              questionRows: [...t.questionRows, updatedRow],
            };
          }
          return t;
        }));
        
        // Update draft with the new row using the server's authoritative topic
        const updatedTopics = topicsV2.map(t => t.id === topicId ? updatedTopic : t);
        
        updateDraftMutation.mutate({
          assessmentId: assessmentId || undefined,
          topics_v2: updatedTopics,
        }, {
          onError: (err) => {
            console.error("Error updating draft after adding question row:", err);
          },
        });
      } else {
        setError(response.data?.message || "Failed to add question row");
      }
    } catch (err: any) {
      console.error("Error adding question row:", err);
      const errorMessage = err.response?.data?.message || err.response?.data?.detail || err.message || "Failed to add question row";
      setError(errorMessage);
      
      // If it's a 404, provide more helpful error message
      if (err.response?.status === 404) {
        setError(`Topic not found in database. Please refresh the page and try again. Error: ${errorMessage}`);
      }
    }
  };
  
  // Handler to update question timer
  const handleUpdateQuestionTimer = async (topicId: string, rowId: string, questionIndex: number, newTimer: number) => {
    if (!assessmentId || newTimer < 1) return;
    
    try {
      // Update state immediately for instant UI update
      setTopicsV2(prev => prev.map(t => {
        if (t.id === topicId) {
          return {
            ...t,
            questionRows: t.questionRows.map(r => {
              if (r.rowId === rowId && r.questions && r.questions[questionIndex]) {
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
            })
          };
        }
        return t;
      }));
      
      // Update draft
      const updatedTopics = topicsV2.map(t => {
        if (t.id === topicId) {
          return {
            ...t,
            questionRows: t.questionRows.map(r => {
              if (r.rowId === rowId && r.questions && r.questions[questionIndex]) {
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
            })
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
      setError(err.response?.data?.message || err.message || "Failed to update question timer");
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
      const oldQuestionText = getQuestionText(qData.question, qData.questionType);
      
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
        setTopicsV2(prev => prev.map(t => {
          if (t.id === qData.topicId) {
            return {
              ...t,
              questionRows: t.questionRows.map(r => {
                if (r.rowId === qData.rowId && r.questions && r.questions[qData.questionIndex]) {
                  const updatedQuestions = [...r.questions];
                  const oldQuestion = updatedQuestions[qData.questionIndex];
                  
                  // Preserve timer and score, update question content
                  updatedQuestions[qData.questionIndex] = {
                    ...updatedQuestion,
                    timer: oldQuestion.timer || (() => {
                      const baseTime = getBaseTimePerQuestion(qData.questionType);
                      const multiplier = getDifficultyMultiplier(qData.difficulty);
                      let questionTime = baseTime * multiplier;
                      if (qData.questionType === "MCQ" && questionTime > 40) {
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
                      }
                    ],
                    status: "regenerated",
                  };
                  
                  return {
                    ...r,
                    questions: updatedQuestions,
                  };
                }
                return r;
              })
            };
          }
          return t;
        }));
        
        // Update draft
        const updatedTopics = topicsV2.map(t => {
          if (t.id === qData.topicId) {
            return {
              ...t,
              questionRows: t.questionRows.map(r => {
                if (r.rowId === qData.rowId && r.questions && r.questions[qData.questionIndex]) {
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
                      }
                    ],
                    status: "regenerated",
                  };
                  return {
                    ...r,
                    questions: updatedQuestions,
                  };
                }
                return r;
              })
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
      setError(err.response?.data?.message || err.message || "Failed to regenerate question");
    }
  };

  // Handler to remove a question from Review Questions page
  const handleRemoveQuestionInReview = async (topicId: string, rowId: string, questionIndex: number) => {
    if (!assessmentId) return;
    
    try {
      const topic = topicsV2.find(t => t.id === topicId);
      if (!topic) return;
      
      const row = topic.questionRows.find(r => r.rowId === rowId);
      if (!row || !row.questions) return;
      
      // Remove the question from the array
      const updatedQuestions = row.questions.filter((_, idx) => idx !== questionIndex);
      
      // Update state
      setTopicsV2(prev => prev.map(t => {
        if (t.id === topicId) {
          return {
            ...t,
            questionRows: t.questionRows.map(r => {
              if (r.rowId === rowId) {
                return {
                  ...r,
                  questions: updatedQuestions,
                };
              }
              return r;
            })
          };
        }
        return t;
      }));
      
      // Update draft
      const updatedTopics = topicsV2.map(t => {
        if (t.id === topicId) {
          return {
            ...t,
            questionRows: t.questionRows.map(r => {
              if (r.rowId === rowId) {
                return {
                  ...r,
                  questions: updatedQuestions,
                };
              }
              return r;
            })
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
      setError(err.response?.data?.message || err.message || "Failed to remove question");
    }
  };
  
  const handleRemoveQuestionRow = async (topicId: string, rowId: string) => {
    if (!assessmentId) return;
    
    const topic = topicsV2.find(t => t.id === topicId);
    if (!topic) return;
    
    const row = topic.questionRows.find(r => r.rowId === rowId);
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
        setTopicsV2(prev => prev.map(t => t.id === topicId ? updatedTopic : t));
      }
    } catch (err: any) {
      console.error("Error removing question row:", err);
      setError(err.response?.data?.message || err.message || "Failed to remove question row");
    }
  };
  
  const handleUpdateRow = (topicId: string, rowId: string, field: keyof QuestionRow, value: any) => {
    setTopicsV2(prev => prev.map(t => {
      if (t.id === topicId) {
        const topic = t;
        const row = topic.questionRows.find(r => r.rowId === rowId);
        const hasGeneratedQuestions = row?.questions && row.questions.length > 0 && row.status === "generated";
        
        const updatedRows = t.questionRows.map(r => {
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
            if (hasGeneratedQuestions && (field === "questionType" || field === "difficulty")) {
              updated.status = "pending";
              updated.questions = []; // Clear existing questions
              updated.locked = false; // ✅ FIX 1: Unlock to allow regeneration
            }
            
            // ✅ FIX 2: Also update difficulty in existing questions if they exist
            // This ensures the difficulty is reflected in the UI immediately
            if (field === "difficulty" && updated.questions && updated.questions.length > 0) {
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
        const shouldMarkTopicPending = row && hasGeneratedQuestions && (field === "questionType" || field === "difficulty");
        
        return { 
          ...t, 
          questionRows: updatedRows,
          status: shouldMarkTopicPending ? "pending" as const : (t.status || "pending")
        };
      }
      return t;
    }));
    
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
          setTopicsV2(currentTopics => {
            // State is already updated, just save it to draft
            updateDraftMutation.mutate({
              assessmentId,
              topics_v2: currentTopics,
            }, {
              onError: (err: any) => {
                console.error("Error auto-saving difficulty change:", err);
              },
            });
            
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
    newQuestionType: "MCQ" | "Subjective" | "PseudoCode" | "Coding" | "SQL" | "AIML"
  ) => {
    if (!assessmentId) return;
    
    try {
      // Find the current row to preserve difficulty
      const topic = topicsV2.find(t => t.id === topicId);
      const row = topic?.questionRows.find(r => r.rowId === rowId);
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
        setTopicsV2(prev => prev.map(t => {
          if (t.id === topicId) {
            return {
              ...t,
              questionRows: t.questionRows.map(r => {
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
        }));
        
        // Log for debugging
        console.log(`✅ Question type updated: ${topic?.label} → ${newQuestionType}`);
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
    const usedTypes = topic.questionTypeConfigs.map(qtc => qtc.questionType);
    const newType = availableTypes.find(type => !usedTypes.includes(type)) || availableTypes[0] || "MCQ";
    
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

  const handleRemoveQuestionType = (topicIndex: number, configIndex: number) => {
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
    value: any
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

  const handleUpdateTopicConfig = (index: number, field: keyof Topic, value: any) => {
    const updated = [...topicConfigs];
    updated[index] = { ...updated[index], [field]: value };
    
    // For aptitude topics: when sub-topic changes, update available question types
    if (field === "subTopic" && updated[index].isAptitude && updated[index].aptitudeStructure) {
      const subTopic = value;
      const questionTypes = updated[index].aptitudeStructure?.subTopics[subTopic] || [];
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
      updated[index].questionTypeConfigs.forEach(qtc => {
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
      "python": "71",
      "django": "71",
      "flask": "71",
      "pandas": "71",
      "numpy": "71",
      "tensorflow": "71",
      "pytorch": "71",
      "scikit": "71",
      "jupyter": "71",
      
      // JavaScript/TypeScript
      "javascript": "63",
      "js": "63",
      "node": "63",
      "nodejs": "63",
      "react": "63",
      "vue": "63",
      "angular": "63",
      "express": "63",
      "typescript": "74",
      "ts": "74",
      "next": "63",
      "nextjs": "63",
      
      // Java
      "java": "62",
      "spring": "62",
      "hibernate": "62",
      "maven": "62",
      "gradle": "62",
      
      // C/C++
      "c++": "54",
      "cpp": "54",
      "cplusplus": "54",
      "c": "50",
      
      // C#
      "c#": "51",
      "csharp": "51",
      ".net": "51",
      "dotnet": "51",
      "asp.net": "51",
      
      // Go
      "go": "60",
      "golang": "60",
      
      // Rust
      "rust": "73",
      
      // Kotlin
      "kotlin": "78",
      "android": "78",
      
      // PHP
      "php": "68",
      "laravel": "68",
      "symfony": "68",
      
      // Ruby
      "ruby": "72",
      "rails": "72",
      "ruby on rails": "72",
      
      // Swift
      "swift": "83",
      "ios": "83",
      
      // SQL
      "sql": "82",
      "mysql": "82",
      "postgresql": "82",
      "mongodb": "82",
      "database": "82",
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
        setTopics(topics.filter(t => t !== topicToRemove.topic));
      } catch (err: any) {
        console.error("Error removing topic from database:", err);
        // Revert local state change if database update fails
        setTopicConfigs(topicConfigs);
        setError(err.response?.data?.message || "Failed to remove topic from database");
      }
    } else {
      // If no assessmentId, just update local topics list
      setTopics(topics.filter(t => t !== topicToRemove.topic));
    }
  };

  const handleAddCustomTopic = async () => {
    if (!customTopicInput.trim()) {
      setError("Please enter a topic name");
      return;
    }

    const topicName = customTopicInput.trim();
    
    // Check if topic already exists
    if (topicConfigs.some(t => t.topic.toLowerCase() === topicName.toLowerCase())) {
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
        const autoLanguage = isCoding ? getLanguageFromTopic(topicName) : undefined;

        const newTopic: Topic = {
          topic: topicName,
          questionTypeConfigs: [{
            questionType: questionType,
            difficulty: "Medium",
            numQuestions: 1,
            language: autoLanguage,
            judge0_enabled: isCoding ? true : undefined,
          }],
          isAptitude: false,
          coding_supported: data.coding_supported !== undefined ? data.coding_supported : (isCoding ? true : undefined),
        };

        setTopicConfigs([...topicConfigs, newTopic]);
        setCustomTopicInput("");
        
        // Clear questions so that questions will regenerate with the new topic
        setQuestions([]);
        console.log(`[Add Custom Topic] Cleared preview questions - will regenerate on next preview click to include new topic: ${topicName}`);
      } else {
        setError("Failed to add custom topic");
      }
    } catch (err: any) {
      console.error("Error adding custom topic:", err);
      setError(err.response?.data?.message || err.message || "Failed to add custom topic");
    } finally {
      setLoading(false);
    }
  };

  const handleResetTopics = () => {
    if (originalTopicConfigsRef.current.length > 0) {
      setTopicConfigs(JSON.parse(JSON.stringify(originalTopicConfigsRef.current)));
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
            if (assessment.selectedSkills && assessment.selectedSkills.length > 0) {
              skillsToUse = assessment.selectedSkills;
              setSelectedSkills(assessment.selectedSkills); // Update state for future use
            }
          }
        } catch (err) {
          console.error("Error fetching assessment skills:", err);
        }
      }
      
      if (!skillsToUse || skillsToUse.length === 0) {
        setError("No skills found in assessment. Please go back to Station 1 and select skills first.");
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
      
      console.log(`[Regenerate Topics] Starting regeneration for assessment ${assessmentId}`);
      
      // Then regenerate topics - this will update the existing assessment
      // The handleGenerateTopics function will handle updating the existing assessment
      // by calling create-from-job-designation which will replace all topics
      await handleGenerateTopics();
      
      console.log(`[Regenerate Topics] Regeneration completed for assessment ${assessmentId}`);
    } catch (err: any) {
      console.error("Error regenerating topics:", err);
      setError(err.response?.data?.message || err.message || "Failed to regenerate topics");
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
          if (assessment.selectedSkills && assessment.selectedSkills.length > 0) {
            skillsToUse = assessment.selectedSkills;
            setSelectedSkills(assessment.selectedSkills); // Update state for future use
          }
        }
      } catch (err) {
        console.error("Error fetching assessment skills:", err);
        // If fetch fails, try to use skills from state
        if (!skillsToUse || skillsToUse.length === 0) {
          setError("Failed to fetch skills from assessment. Please go back to Station 1 and ensure skills are selected.");
          setRegeneratingTopicIndex(null);
          return;
        }
      }
      
      if (!skillsToUse || skillsToUse.length === 0) {
        setError("No skills found in assessment. Please go back to Station 1 and select skills first.");
        setRegeneratingTopicIndex(null);
        return;
      }
      
      console.log("Using skills for topic regeneration:", skillsToUse);

      // First, delete questions for this specific topic
      await deleteTopicQuestionsMutation.mutateAsync({
        assessmentId: assessmentId || "",
        topic: (topic as any).topic || (topic as any).label || (topic as any).name,
      });
      
      // Preview questions removed - no longer clearing preview state

      // Then regenerate the topic (get new question type and coding support)
      const response = await regenerateTopicMutation.mutateAsync({
        topic: (topic as any).topic || (topic as any).label || (topic as any).name,
        assessmentId: assessmentId || undefined,
      });

      if (response?.success) {
        const data = response.data;
        const newTopicName = data?.topic || topic.topic; // Use new topic name if provided
        const questionType = data.questionType || "MCQ";
        const isCoding = questionType === "coding";
        const autoLanguage = isCoding ? getLanguageFromTopic(newTopicName) : undefined; // Use new topic name for language detection

        const updated = [...topicConfigs];
        updated[topicIndex] = {
          ...updated[topicIndex],
          topic: newTopicName, // Update topic name
          coding_supported: data.coding_supported !== undefined ? data.coding_supported : (isCoding ? true : undefined),
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
          updated[topicIndex].questionTypeConfigs = [{
            questionType: questionType,
            difficulty: "Medium",
            numQuestions: 1,
            language: autoLanguage,
            judge0_enabled: isCoding ? true : undefined,
          }];
        }

        setTopicConfigs(updated);

        // CRITICAL: Reset regenerating state immediately after topic regeneration succeeds
        // Question generation will happen in background but button should show normal state
        setRegeneratingTopicIndex(null);

        // Generate questions only for this regenerated topic (in background)
        const topicConfig = updated[topicIndex];
        
        // Ensure we have valid question type configs
        if (!topicConfig.questionTypeConfigs || topicConfig.questionTypeConfigs.length === 0) {
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
            judge0_enabled: qtc.judge0_enabled !== undefined ? qtc.judge0_enabled : undefined,
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
          const generateResponse = await generateQuestionsFromConfigMutation.mutateAsync({
            assessmentId,
            skill: skillsToUse.join(", "),
            topics: flattenedTopic,
          });

          if (generateResponse?.success) {
            // Update questions state - remove old questions for this topic and add new ones
            const newQuestions: any[] = [];
            
            // Collect all questions from all topics in the response
            if (generateResponse.data?.topics && Array.isArray(generateResponse.data.topics)) {
              generateResponse.data.topics.forEach((t: any) => {
                if (t.questions && Array.isArray(t.questions) && t.questions.length > 0) {
                  // Ensure each question has the correct topic name (use newTopicName in case it changed)
                  const questionsWithTopic = t.questions.map((q: any) => ({
                    ...q,
                    topic: newTopicName, // Ensure all questions have the new topic name
                  }));
                  newQuestions.push(...questionsWithTopic);
                }
              });
            }

            console.log(`[Topic Regeneration] Backend returned ${newQuestions.length} new questions for topic '${newTopicName}'`);
            console.log(`[Topic Regeneration] Response structure:`, {
              hasData: !!generateResponse.data,
              hasTopics: !!generateResponse.data?.topics,
              topicsCount: generateResponse.data?.topics?.length || 0,
              totalQuestions: generateResponse.data?.totalQuestions || 0,
            });
            console.log(`[Topic Regeneration] New questions breakdown:`, newQuestions.map((q: any, idx: number) => ({
              index: idx,
              topic: q.topic,
              type: q.type,
              questionPreview: q.questionText?.substring(0, 30) || q.question?.substring(0, 30) || 'N/A'
            })));

            if (newQuestions.length === 0) {
              console.warn(`[Topic Regeneration] No questions were generated for topic '${newTopicName}'. Check backend response.`);
              setError("No questions were generated. Please try again.");
              return;
            }

            // Filter out old questions for both old and new topic names (in case topic name changed)
            const updatedQuestions = questions.filter((q: any) => q.topic !== topic.topic && q.topic !== newTopicName);
            setQuestions([...updatedQuestions, ...newQuestions]);
            
            // Preview questions removed - no longer updating preview state
            
            console.log(`[Topic Regeneration] Successfully updated: Generated ${newQuestions.length} new questions for topic '${newTopicName}'. Removed old questions for '${topic.topic}'.`);
          } else {
            console.error(`[Topic Regeneration] Backend response was not successful:`, generateResponse.data);
            setError("Failed to generate questions. Please try again.");
          }
        } catch (genErr: any) {
          // Log error but don't block - topic regeneration already succeeded
          console.error("Error generating questions after topic regeneration:", genErr);
          setError("Topic regenerated successfully, but failed to generate questions. You can generate questions later.");
        }
      } else {
        setError("Failed to regenerate topic");
      }
    } catch (err: any) {
      console.error("Error regenerating topic:", err);
      setError(err.response?.data?.message || err.message || "Failed to regenerate topic");
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
            const isTopicAptitude = t.isAptitude === true || (isAptitude && t.category === "aptitude");
            
            if (isTopicAptitude) {
              // Handle aptitude topic
              const availableSubTopics = t.availableSubTopics || t.subTopics || [];
              const defaultSubTopic = availableSubTopics.length > 0 ? availableSubTopics[0] : undefined;
              const selectedSubTopic = t.subTopic || defaultSubTopic;
              
              // Get question type based on selected sub-topic
              let defaultQuestionType = "MCQ"; // Default for aptitude
              if (selectedSubTopic && t.aptitudeStructure?.subTopics?.[selectedSubTopic]) {
                const questionTypes = t.aptitudeStructure.subTopics[selectedSubTopic];
                defaultQuestionType = questionTypes.length > 0 ? questionTypes[0] : "MCQ";
              }
              
              return {
                topic: t.topic,
                questionTypeConfigs: [{
                questionType: defaultQuestionType,
                difficulty: t.difficulty || "Medium",
                numQuestions: 1,
                }],
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
              const autoLanguage = isCoding ? getLanguageFromTopic(t.topic) : undefined;
              
              return {
                topic: t.topic,
                questionTypeConfigs: [{
                  questionType: questionType,
                difficulty: t.difficulty || "Medium",
                numQuestions: 1,
                  language: autoLanguage,
                  judge0_enabled: isCoding ? true : undefined,
                }],
                isAptitude: false,
                coding_supported: t.coding_supported !== undefined ? t.coding_supported : (isCoding ? true : undefined),
              };
            }
          });
          setTopicConfigs(newTopicConfigs);
          // After generating topics, navigate to Station 2
          setError(null);
          setHasVisitedConfigureStation(true);
          if (!hasVisitedReviewStation) {
            originalTopicConfigsRef.current = JSON.parse(JSON.stringify(newTopicConfigs));
          }
          setCurrentStation(2);
        } else {
          setError("Failed to generate topics");
        }
      } catch (err: any) {
        console.error("Error generating topics:", err);
        setError(err.response?.data?.message || err.message || "Failed to generate topics");
      } finally {
        setLoading(false);
      }
    } else {
      // Topics already generated, just navigate
      setError(null);
      setHasVisitedConfigureStation(true);
      if (!hasVisitedReviewStation) {
        originalTopicConfigsRef.current = JSON.parse(JSON.stringify(topicConfigs));
      }
      setCurrentStation(2);
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
    const invalidConfigs = validConfigs.filter(
      (tc) => {
        // Check if topic has at least one question type config
        if (!tc.questionTypeConfigs || tc.questionTypeConfigs.length === 0) {
          return true;
        }
        
        // Check if all question type configs are valid
        const invalidConfigs = tc.questionTypeConfigs.filter(
          (qtc) => !qtc.questionType || !qtc.difficulty || qtc.numQuestions < 1
        );
        if (invalidConfigs.length > 0) {
          return true;
        }
        
        // For aptitude topics, sub-topic is required
        const aptitudeInvalid = tc.isAptitude && !tc.subTopic;
        return aptitudeInvalid;
      }
    );
    if (invalidConfigs.length > 0) {
      setError("Please complete all configurations for all topics. Each topic must have at least one question type with valid difficulty and number of questions. Aptitude topics require a sub-topic selection.");
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
    const shouldRegenerate = hasVisitedReviewStation && 
      JSON.stringify(validConfigs) !== JSON.stringify(originalTopicConfigsRef.current);

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
          originalTopicConfigsRef.current = JSON.parse(JSON.stringify(validConfigs));
          setHasVisitedReviewStation(false);
          setCurrentStation(3);
        } else {
          setError("Failed to generate questions");
        }
      } catch (err: any) {
        console.error("Error generating questions:", err);
        setError(err.response?.data?.message || err.message || "Failed to generate questions");
      } finally {
        setGenerating(false);
      }
    } else {
      // No regeneration needed
      if (!hasVisitedReviewStation) {
        // First time generating, save original configs
        originalTopicConfigsRef.current = JSON.parse(JSON.stringify(validConfigs));
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
            setCurrentStation(3);
          } else {
            setError("Failed to generate questions");
          }
        } catch (err: any) {
          console.error("Error generating questions:", err);
          setError(err.response?.data?.message || err.message || "Failed to generate questions");
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
      status: "pending"
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
    const updatedCandidates = candidates.filter((c) => c.email.toLowerCase() !== email.toLowerCase());
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

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError("Please upload a CSV file");
      return;
    }

    setUploadingCsv(true);
    setError(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        setError("CSV file is empty");
        setUploadingCsv(false);
        return;
      }

      // Parse header row
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIndex = header.findIndex(h => h === 'name');
      const emailIndex = header.findIndex(h => h === 'email');

      if (nameIndex === -1 || emailIndex === -1) {
        setError("CSV must contain 'name' and 'email' columns");
        setUploadingCsv(false);
        return;
      }

      // Parse data rows
      const newCandidates: Array<{ email: string; name: string }> = [];
      const existingEmails = new Set(candidates.map(c => c.email.toLowerCase()));
      const duplicateEmails: string[] = [];
      const invalidRows: number[] = [];

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(cell => cell.trim());
        const email = row[emailIndex]?.trim();
        const name = row[nameIndex]?.trim();

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !name || !emailRegex.test(email)) {
          invalidRows.push(i + 1);
          continue;
        }

        // Check for duplicates in CSV
        if (newCandidates.some(c => c.email.toLowerCase() === email.toLowerCase())) {
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
          errorMsg += `Invalid rows: ${invalidRows.slice(0, 5).join(', ')}${invalidRows.length > 5 ? '...' : ''}. `;
        }
        if (duplicateEmails.length > 0) {
          errorMsg += `Duplicate emails: ${duplicateEmails.slice(0, 5).join(', ')}${duplicateEmails.length > 5 ? '...' : ''}.`;
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
      event.target.value = '';
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
      const titleToSave = finalTitle || (jobDesignation.trim() ? `Assessment for ${jobDesignation.trim()}` : "Untitled Assessment");
      
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
    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
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
      const scheduleData: any = {
        examMode,
        duration: parseInt(duration || "0"),
      };
      
      // Add startTime if provided (required for both modes)
      if (startTime) {
        scheduleData.startTime = normalizeDateTime(startTime);
      }
      
      // Only include endTime based on exam mode
      if (examMode === "flexible" && endTime) {
        scheduleData.endTime = normalizeDateTime(endTime);
      }
      
      // Include section timers if enabled
      if (enablePerSectionTimers) {
        scheduleData.enablePerSectionTimers = true;
        scheduleData.sectionTimers = sectionTimers;
      }

      await updateScheduleAndCandidatesMutation.mutateAsync({
        assessmentId,
        ...scheduleData,
        candidates: accessMode === "private" ? candidates : [],
        assessmentUrl: url,
        token,
        accessMode: accessMode,
        invitationTemplate: accessMode === "private" ? invitationTemplate : undefined,
      });
    } catch (err: any) {
      console.error("Error saving schedule and candidates:", err);
      const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || "Failed to save schedule and candidates";
      setError(errorMessage);
      throw err; // Re-throw to show error in UI
    }
  };

  const handleCopyUrl = () => {
    if (assessmentUrl) {
      navigator.clipboard.writeText(assessmentUrl);
      // You could show a toast notification here
      alert("URL copied to clipboard!");
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
      console.log("[FRONTEND] title:", assessmentTitle.trim() || "Untitled Assessment");
      console.log("[FRONTEND] scoringRules:", scoringRules);
      console.log("[FRONTEND] passPercentage:", passPercentage);
      console.log("[FRONTEND] enablePerSectionTimers:", enablePerSectionTimers);
      console.log("[FRONTEND] sectionTimers:", enablePerSectionTimers ? sectionTimers : undefined);
      console.log("[FRONTEND] ScoringRules keys:", Object.keys(scoringRules));
      console.log("[FRONTEND] ScoringRules values:", Object.values(scoringRules));
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
      setError(err.response?.data?.message || err.message || "Failed to finalize assessment");
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
      
      <div style={{ backgroundColor: "#f1dcba", minHeight: "100vh", padding: "2rem 0" }}>
        <div className="container">
          <div className="card">
          {/* Progress Line */}
          <div style={{ marginBottom: "3rem" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "relative",
                marginBottom: "1rem",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  right: 0,
                  height: "3px",
                  backgroundColor: "#e2e8f0",
                  zIndex: 0,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: 0,
                  width: currentStation >= 5 ? "100%" : currentStation >= 4 ? "75%" : currentStation >= 3 ? "50%" : currentStation >= 2 ? "25%" : "0%",
                  height: "3px",
                  backgroundColor: "#6953a3",
                  zIndex: 1,
                  transition: "width 0.3s ease",
                }}
              />
              {[1, 2, 3, 4, 5].map((station) => (
                <div
                  key={station}
                  style={{
                    position: "relative",
                    zIndex: 2,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    flex: 1,
                  }}
                >
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "50%",
                      backgroundColor: currentStation >= station ? "#6953a3" : "#e2e8f0",
                      color: currentStation >= station ? "#ffffff" : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "1.125rem",
                      transition: "all 0.3s ease",
                    }}
                  >
                    {station}
                  </div>
                  <span
                    style={{
                      marginTop: "0.5rem",
                      fontSize: "0.875rem",
                      color: currentStation >= station ? "#6953a3" : "#64748b",
                      fontWeight: currentStation >= station ? 600 : 400,
                    }}
                  >
                    {station === 1 ? "Topics" : station === 2 ? "Configure" : station === 3 ? "Review" : station === 4 ? "Schedule" : "Candidates"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <div className="alert alert-error" style={{ marginBottom: "1.5rem" }}>
              {error}
            </div>
          )}

          {loadingDraft && (
            <div className="alert" style={{ marginBottom: "1.5rem", backgroundColor: "#f0f9ff", border: "1px solid #3b82f6" }}>
              Loading draft assessment...
            </div>
          )}

          {/* Station 1: Topics */}
          {currentStation === 1 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ flex: 1 }}>
              <h1 style={{ marginBottom: "0.5rem", fontSize: "2rem", color: "#1a1625", fontWeight: 700 }}>
                {isEditMode ? "Edit Assessment" : "Create Assessment"}
              </h1>
              <p style={{ color: "#6b6678", marginBottom: "2rem", fontSize: "1rem" }}>
                {isEditMode ? "Edit your assessment details" : "Enter a job designation or domain to get started"}
              </p>
                </div>
                <button
                  type="button"
                  onClick={handleBackToDashboard}
                  className="btn-secondary"
                  style={{ 
                    marginLeft: "1rem",
                    whiteSpace: "nowrap",
                    padding: "0.75rem 1.5rem",
                    fontSize: "0.875rem"
                  }}
                >
                  Back to Dashboard
                </button>
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                  Assessment Title <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  value={finalTitle}
                  onChange={(e) => setFinalTitle(e.target.value)}
                  placeholder="Enter assessment title"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                  }}
                />
              </div>

              {/* Experience Mode and Range - Shared across all methods */}
              <div style={{ marginBottom: "2rem" }}>
                <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                  Experience Mode <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <div style={{ display: "flex", gap: "1rem" }}>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: (isEditMode || !hasVisitedConfigureStation) ? "pointer" : "default",
                      opacity: (isEditMode || !hasVisitedConfigureStation) ? 1 : 0.6,
                      pointerEvents: (isEditMode || !hasVisitedConfigureStation) ? "auto" : "none",
                    }}
                  >
                    <input
                      type="radio"
                      name="experienceMode"
                      value="corporate"
                      checked={experienceMode === "corporate"}
                      onChange={(e) => {
                        setExperienceMode(e.target.value as "corporate" | "student");
                        if (e.target.value === "corporate") {
                          setExperienceMin(0);
                          setExperienceMax(10);
                        } else {
                          setExperienceMin(0);
                          setExperienceMax(3);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "1rem", color: "#1e293b" }}>Corporate Experience</span>
                  </label>
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: (isEditMode || !hasVisitedConfigureStation) ? "pointer" : "default",
                      opacity: (isEditMode || !hasVisitedConfigureStation) ? 1 : 0.6,
                      pointerEvents: (isEditMode || !hasVisitedConfigureStation) ? "auto" : "none",
                    }}
                  >
                    <input
                      type="radio"
                      name="experienceMode"
                      value="student"
                      checked={experienceMode === "student"}
                      onChange={(e) => {
                        setExperienceMode(e.target.value as "corporate" | "student");
                        if (e.target.value === "student") {
                          setExperienceMin(0);
                          setExperienceMax(3);
                        } else {
                          setExperienceMin(0);
                          setExperienceMax(10);
                        }
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    <span style={{ fontSize: "1rem", color: "#1e293b" }}>College Student Experience</span>
                  </label>
                </div>
              </div>

              <div style={{ marginBottom: "2rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                  {experienceMode === "corporate" ? "Experience Range (Years)" : "Experience Level"}
                </label>
                <div
                  ref={sliderRef}
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "6px",
                    backgroundColor: "#e2e8f0",
                    borderRadius: "3px",
                    marginTop: "2rem",
                    marginBottom: "1rem",
                    cursor: (isEditMode || !hasVisitedConfigureStation) ? "pointer" : "default",
                    opacity: (isEditMode || !hasVisitedConfigureStation) ? 1 : 0.6,
                  }}
                >
                  <div
                    ref={minHandleRef}
                    style={{
                      position: "absolute",
                      width: "20px",
                      height: "20px",
                      backgroundColor: "#6953a3",
                      borderRadius: "50%",
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      cursor: (isEditMode || !hasVisitedConfigureStation) ? "grab" : "default",
                      zIndex: 3,
                      userSelect: "none",
                      touchAction: "none",
                      pointerEvents: (isEditMode || !hasVisitedConfigureStation) ? "auto" : "none",
                    }}
                  />
                  <div
                    ref={maxHandleRef}
                    style={{
                      position: "absolute",
                      width: "20px",
                      height: "20px",
                      backgroundColor: "#6953a3",
                      borderRadius: "50%",
                      top: "50%",
                      transform: "translate(-50%, -50%)",
                      cursor: (isEditMode || !hasVisitedConfigureStation) ? "grab" : "default",
                      zIndex: 3,
                      userSelect: "none",
                      touchAction: "none",
                      pointerEvents: (isEditMode || !hasVisitedConfigureStation) ? "auto" : "none",
                    }}
                  />
                </div>
                {experienceMode === "corporate" ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
                      <span>{experienceMin} years</span>
                      <span>{experienceMax} years</span>
                    </div>
                    <div style={{ textAlign: "center", fontSize: "0.875rem", color: "#6953a3", fontWeight: 600, marginTop: "0.25rem" }}>
                      {experienceMin}-{experienceMax} years
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
                      <span>{getStudentLevel(experienceMin)}</span>
                      <span>{getStudentLevel(experienceMax)}</span>
                    </div>
                    <div style={{ textAlign: "center", fontSize: "0.875rem", color: "#6953a3", fontWeight: 600, marginTop: "0.25rem" }}>
                      {(() => {
                        const minLevel = getStudentLevel(experienceMin);
                        const maxLevel = getStudentLevel(experienceMax);
                        return minLevel === maxLevel ? minLevel : `${minLevel} - ${maxLevel}`;
                      })()}
                    </div>
                  </>
                )}
              </div>

              {/* Unified Requirements Interface */}
              <div style={{ marginBottom: "2rem" }}>
                <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                  Define Skill Requirements
                </label>
                
                {/* Job Designation (Required) */}
                <div style={{ marginBottom: "2rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                    Job Designation / Domain
                    <span style={{ color: "#ef4444", marginLeft: "0.25rem" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={jobDesignation}
                    onChange={(e) => setJobDesignation(e.target.value)}
                    placeholder="e.g., Software Engineering, Data Scientist, Frontend Developer"
                    required
                    style={{
                      width: "100%",
                      padding: "0.75rem",
                      border: jobDesignation.trim() ? "1px solid #e2e8f0" : "1px solid #ef4444",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                    }}
                  />
                  <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
                    Enter a job designation to get AI-suggested skills and technologies
                  </p>
                  {!jobDesignation.trim() && (
                    <p style={{ fontSize: "0.875rem", color: "#ef4444", marginTop: "0.5rem" }}>
                      Job Designation is required
                    </p>
                  )}
                </div>

                {/* Topic Cards Display (if job designation is provided) */}
                {topicCards.length > 0 && jobDesignation.trim() && (isEditMode || !hasVisitedConfigureStation) && (
                  <div style={{ marginBottom: "2rem" }}>
                    <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                      Related Technologies & Skills
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                      {topicCards
                        .filter((card) => {
                          // Filter out frameworks that are not supported by Judge0
                          // Judge0 only supports pure programming languages, not frameworks
                          // that require additional setup (Django, Flask, React, Angular, Spring, etc.)
                          const cardLower = card.toLowerCase().trim();
                          
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
                          
                          // Check if the topic matches any unsupported framework
                          for (const framework of unsupportedFrameworks) {
                            if (cardLower === framework || cardLower.startsWith(framework + " ")) {
                              return false;
                            }
                          }
                          
                          return true;
                        })
                        .map((card) => (
                        <button
                          key={card}
                          type="button"
                          onClick={() => handleCardClick(card)}
                          disabled={!isEditMode && selectedSkills.includes(card)}
                          style={{
                            padding: "0.5rem 1rem",
                            border: `1px solid ${selectedSkills.includes(card) ? "#6953a3" : "#e2e8f0"}`,
                            borderRadius: "0.5rem",
                            backgroundColor: selectedSkills.includes(card) ? "#eff6ff" : "#ffffff",
                            color: selectedSkills.includes(card) ? "#1e40af" : "#475569",
                            cursor: (!isEditMode && selectedSkills.includes(card)) ? "default" : "pointer",
                            fontSize: "0.875rem",
                            fontWeight: selectedSkills.includes(card) ? 600 : 400,
                            opacity: (!isEditMode && selectedSkills.includes(card)) ? 0.7 : 1,
                          }}
                        >
                          {card} {selectedSkills.includes(card) && "✓"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual Skill Input (Optional) */}
                {(isEditMode || !hasVisitedConfigureStation) && (
                  <div style={{ marginBottom: "2rem" }}>
                    <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                      Add Specific Skills (Optional)
                    </label>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        value={manualSkillInput}
                        onChange={(e) => setManualSkillInput(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddManualSkill();
                          }
                        }}
                        placeholder="Enter technology name (e.g., Python, React, HTML)"
                        style={{
                          flex: 1,
                          padding: "0.75rem",
                          border: "1px solid #e2e8f0",
                          borderRadius: "0.5rem",
                          fontSize: "1rem",
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleAddManualSkill}
                        className="btn-secondary"
                        disabled={!manualSkillInput.trim()}
                        style={{ marginTop: 0, whiteSpace: "nowrap", padding: "0.75rem 1.5rem" }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}

                {/* Selected Skills Display */}
                {selectedSkills.length > 0 && (
                  <div style={{ marginBottom: "2rem" }}>
                    <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                      Selected Skills *
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                      {selectedSkills.map((skill) => (
                        <div
                          key={skill}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                            backgroundColor: "#eff6ff",
                            color: "#1e40af",
                            padding: "0.5rem 1rem",
                            borderRadius: "0.5rem",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                          }}
                        >
                          {skill}
                          {(isEditMode || !hasVisitedConfigureStation) && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSkill(skill)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "#1e40af",
                                cursor: "pointer",
                                padding: 0,
                                fontSize: "1.125rem",
                                lineHeight: 1,
                              }}
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* CSV Upload Section */}
                <div style={{ marginBottom: "2rem" }}>
                  <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                    Upload CSV Requirements (Optional)
                  </label>
                  
                  <div style={{ marginBottom: "1.5rem" }}>
                    <button
                      type="button"
                      onClick={downloadCsvTemplate}
                      className="btn-secondary"
                      style={{ marginBottom: "1rem" }}
                    >
                      Download CSV Template
                    </button>
                    <div style={{ 
                      marginTop: "0.75rem", 
                      padding: "0.75rem", 
                      backgroundColor: "#f0f9ff", 
                      border: "1px solid #bae6fd", 
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#0369a1"
                    }}>
                      <strong>CSV Format Instructions:</strong>
                      <ul style={{ margin: "0.5rem 0 0 1.5rem", padding: 0 }}>
                        <li>Only three columns allowed: <strong>skill_name</strong>, <strong>skill_description</strong>, <strong>importance_level</strong></li>
                        <li>If you have multiple descriptions for a skill, separate them using semicolons (;) within the same cell</li>
                        <li>Do NOT add extra columns. Keep exactly three columns</li>
                        <li>skill_description will be automatically wrapped in quotes in the template</li>
                        <li>importance_level must be: <strong>Low</strong>, <strong>Medium</strong>, or <strong>High</strong></li>
                      </ul>
                    </div>
                  </div>

                  <div style={{ marginBottom: "2rem" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                      Upload Requirements File (CSV)
                    </label>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={handleSkillRequirementsCsvUpload}
                      style={{
                        width: "100%",
                        padding: "0.75rem",
                        border: "1px solid #e2e8f0",
                        borderRadius: "0.5rem",
                        fontSize: "1rem",
                      }}
                    />
                    {csvError && (
                      <div style={{ marginTop: "0.5rem", color: "#dc2626", fontSize: "0.875rem" }}>
                        {csvError}
                      </div>
                    )}
                  </div>

                  {/* CSV Preview Table with Delete Functionality */}
                  {csvData.length > 0 && (
                    <div style={{ marginBottom: "2rem" }}>
                      <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                        Preview Requirements ({csvData.length} {csvData.length === 1 ? "skill" : "skills"})
                      </label>
                      <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ backgroundColor: "#f8fafc" }}>
                              <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                                Skill Name
                              </th>
                              <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                                Description
                              </th>
                              <th style={{ padding: "0.75rem", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                                Importance Level
                              </th>
                              <th style={{ padding: "0.75rem", textAlign: "center", borderBottom: "1px solid #e2e8f0", fontWeight: 600, color: "#1e293b", width: "80px" }}>
                                Action
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {csvData.map((row, idx) => (
                              <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f8fafc" }}>
                                <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>{row.skill_name}</td>
                                <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>{row.skill_description || "-"}</td>
                                <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0" }}>
                                  <span style={{
                                    padding: "0.25rem 0.5rem",
                                    borderRadius: "0.25rem",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    backgroundColor: row.importance_level === "High" ? "#fee2e2" : row.importance_level === "Medium" ? "#fef3c7" : "#d1fae5",
                                    color: row.importance_level === "High" ? "#991b1b" : row.importance_level === "Medium" ? "#92400e" : "#065f46"
                                  }}>
                                    {row.importance_level}
                                  </span>
                                </td>
                                <td style={{ padding: "0.75rem", borderBottom: "1px solid #e2e8f0", textAlign: "center" }}>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCsvRow(idx)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "#dc2626",
                                      cursor: "pointer",
                                      padding: "0.25rem 0.5rem",
                                      fontSize: "0.875rem",
                                      borderRadius: "0.25rem",
                                      transition: "background-color 0.2s"
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = "#fee2e2";
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = "transparent";
                                    }}
                                    title="Delete this row"
                                  >
                                    × Delete
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {csvData.length > 0 && (
                        <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
                          You can delete individual rows by clicking the "Delete" button. Changes will be saved when you generate topics.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Requirements Free Text Field */}
                <div style={{ marginBottom: "2rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                    Requirements
                    <span style={{ color: "#64748b", fontWeight: 400, fontSize: "0.875rem", marginLeft: "0.5rem" }}>(Optional)</span>
                  </label>
                  <textarea
                    value={requirementsText}
                    onChange={(e) => handleRequirementsChange(e.target.value)}
                    placeholder="Enter free text or website URL"
                    style={{
                      width: "100%",
                      minHeight: "200px",
                      padding: "0.75rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      fontFamily: "inherit",
                      lineHeight: "1.6",
                      resize: "vertical",
                    }}
                  />
                  
                  {/* URL Processing Status */}
                  {processingUrl && (
                    <div style={{ 
                      marginTop: "0.5rem", 
                      padding: "0.75rem", 
                      backgroundColor: "#f0f9ff", 
                      border: "1px solid #3b82f6", 
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#0369a1"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{
                          width: "16px",
                          height: "16px",
                          border: "2px solid #3b82f6",
                          borderTopColor: "transparent",
                          borderRadius: "50%",
                          animation: "spin 1s linear infinite"
                        }} />
                        <span>Fetching and summarizing website content...</span>
                      </div>
                    </div>
                  )}

                  {/* URL Error */}
                  {urlError && (
                    <div style={{ 
                      marginTop: "0.5rem", 
                      padding: "0.75rem", 
                      backgroundColor: "#fee2e2", 
                      border: "1px solid #fecaca", 
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#dc2626"
                    }}>
                      {urlError}
                    </div>
                  )}

                  {/* URL Success */}
                  {requirementsUrl && requirementsSummary && !processingUrl && (
                    <div style={{ 
                      marginTop: "0.5rem", 
                      padding: "0.75rem", 
                      backgroundColor: "#d1fae5", 
                      border: "1px solid #86efac", 
                      borderRadius: "0.5rem",
                      fontSize: "0.875rem",
                      color: "#065f46"
                    }}>
                      <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>✓ Website content fetched and summarized</div>
                      <div style={{ fontSize: "0.8125rem", opacity: 0.8 }}>
                        URL: <a href={requirementsUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#059669", textDecoration: "underline" }}>
                          {requirementsUrl}
                        </a>
                      </div>
                    </div>
                  )}

                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "2rem" }}>
                {/* Check if topics have been generated (either in edit mode or after generating topics) */}
                {(() => {
                  // If topicsV2 has any topics, it means topics have been generated
                  // This is simpler and more reliable than checking question status
                  const hasGeneratedTopics = topicsV2 && topicsV2.length > 0;
                  
                  return isEditMode || hasGeneratedTopics ? (
                    <>
                      {/* Show Next button if in edit mode or if topics have been generated */}
                      <button
                        type="button"
                        onClick={() => {
                          // Navigate to Station 2 (Configure Topics)
                          setCurrentStation(2);
                        }}
                        className="btn-primary"
                        style={{ minWidth: "200px" }}
                      >
                        Next
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={handleGenerateTopicsUnified}
                        className="btn-primary"
                        disabled={
                          loading || 
                          generatingFromCsv ||
                          // Must have at least one source: requirements text/URL, selected skills, or CSV
                          (!requirementsText.trim() && !requirementsSummary && selectedSkills.length === 0 && csvData.length === 0)
                        }
                        style={{ minWidth: "200px" }}
                      >
                        {(loading || generatingFromCsv) ? "Generating Topics..." : "Generate Topics"}
                      </button>
                      {!requirementsText.trim() && !requirementsSummary && selectedSkills.length === 0 && csvData.length === 0 && (
                        <div style={{ 
                          fontSize: "0.875rem", 
                          color: "#dc2626", 
                          marginTop: "0.5rem",
                          textAlign: "center",
                          width: "100%"
                        }}>
                          Please provide at least one of the following: requirements text/URL, selected skills, or CSV upload
                        </div>
                      )}
                      {(selectedSkills.length > 0 || csvData.length > 0) && (
                        <div style={{ 
                          fontSize: "0.875rem", 
                          color: "#64748b", 
                          marginTop: "0.5rem",
                          textAlign: "center",
                          width: "100%",
                          fontStyle: "italic"
                        }}>
                          {(() => {
                            const roleCount = selectedSkills.filter(s => topicCards.includes(s)).length;
                            const manualCount = selectedSkills.filter(s => !topicCards.includes(s)).length;
                            const csvCount = csvData.length;
                            const parts = [];
                            if (roleCount > 0) parts.push(`${roleCount} role-based`);
                            if (manualCount > 0) parts.push(`${manualCount} manual`);
                            if (csvCount > 0) parts.push(`${csvCount} CSV`);
                            return `Will generate topics for: ${parts.join(", ")} skill${parts.length > 1 ? "s" : ""}`;
                          })()}
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Station 2: Configure Topics (NEW V2 IMPLEMENTATION) */}
          {currentStation === 2 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <h1 style={{ marginBottom: "0.5rem", fontSize: "2rem", color: "#1a1625", fontWeight: 700 }}>
                    Configure Topics
                  </h1>
                  <p style={{ color: "#6b6678", marginBottom: "1rem", fontSize: "1rem" }}>
                    Configure question type, difficulty, and number of questions for each topic. You can also add your own topics.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleBackToDashboard}
                  className="btn-secondary"
                  style={{ 
                    marginLeft: "1rem",
                    whiteSpace: "nowrap",
                    padding: "0.75rem 1.5rem",
                    fontSize: "0.875rem"
                  }}
                >
                  Back to Dashboard
                </button>
              </div>

              {/* Error Display */}
              {error && (
                <div style={{
                  padding: "1rem",
                  backgroundColor: "#fee2e2",
                  border: "1px solid #fecaca",
                  borderRadius: "0.5rem",
                  color: "#dc2626",
                  marginBottom: "1.5rem"
                }}>
                  {error}
                </div>
              )}

              {/* Toast Message */}
              {toastMessage && (
                <div style={{
                  position: "fixed",
                  top: "2rem",
                  right: "2rem",
                  padding: "1rem 1.5rem",
                  backgroundColor: "#fef3c7",
                  border: "1px solid #fbbf24",
                  borderRadius: "0.5rem",
                  color: "#92400e",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  zIndex: 2000,
                  boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                  animation: "fadeIn 0.3s ease-in",
                }}>
                  {toastMessage}
                </div>
              )}




              {/* Topics Table (Multi-Row V2) */}
              <div style={{ overflowX: "auto", marginBottom: "1rem" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc" }}>
                      <th style={{ padding: "1rem", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                        Topic
                      </th>
                      <th style={{ padding: "1rem", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                        Question Type
                      </th>
                      <th style={{ padding: "1rem", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                        Difficulty
                      </th>
                      <th style={{ padding: "1rem", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                        Questions Count
                      </th>
                      <th style={{ padding: "1rem", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                        Additional Requirements
                      </th>
                      <th style={{ padding: "1rem", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // 🔍 DEBUG: Log before rendering
                      if (topicsV2 && topicsV2.length > 0) {
                        console.log("🔍 DEBUG: Rendering Configure Topics table:", {
                          topicsV2Count: topicsV2.length,
                          topicInputValues: topicInputValues,
                          topicInputValuesKeys: Object.keys(topicInputValues),
                          sampleTopic: topicsV2[0] ? {
                            id: topicsV2[0].id,
                            label: topicsV2[0].label,
                            hasQuestionRows: !!topicsV2[0].questionRows,
                            questionRowsCount: topicsV2[0].questionRows?.length || 0,
                            firstRow: topicsV2[0].questionRows?.[0] ? {
                              rowId: topicsV2[0].questionRows[0].rowId,
                              questionType: topicsV2[0].questionRows[0].questionType,
                              difficulty: topicsV2[0].questionRows[0].difficulty,
                            } : null,
                            inputValue: topicInputValues[topicsV2[0].id],
                            computedValue: topicInputValues[topicsV2[0].id] ?? topicsV2[0].label ?? "",
                          } : null,
                        });
                      }
                      return null;
                    })()}
                    {topicsV2 && topicsV2.length > 0 ? (
                      topicsV2.flatMap((topic) => {
                        // 🔍 DEBUG: Log each topic being rendered
                        const topicInputValue = topicInputValues[topic.id] ?? topic.label ?? "";
                        console.log(`🔍 DEBUG: Rendering topic ${topic.id}:`, {
                          topicId: topic.id,
                          topicLabel: topic.label,
                          topicInputValue: topicInputValue,
                          topicInputValuesKey: topicInputValues[topic.id],
                          questionRowsCount: topic.questionRows?.length || 0,
                        });
                        
                        const canRegenerate = !topic.locked && !fullTopicRegenLocked;
                        const canAddRow = !topic.locked && !allQuestionsGenerated;
                        
                        return topic.questionRows.map((row, rowIndex) => {
                          // 🔍 DEBUG: Log each row being rendered
                          console.log(`🔍 DEBUG: Rendering row ${row.rowId} for topic ${topic.id}:`, {
                            rowId: row.rowId,
                            questionType: row.questionType,
                            questionTypeValue: row.questionType || "MCQ",
                            difficulty: row.difficulty,
                            questionsCount: row.questionsCount,
                          });
                          const isFirstRow = rowIndex === 0;
                          const canPreview = !allQuestionsGenerated; // Allow preview even if locked (to view existing questions)
                          // Restrict question types for aptitude/communication/logical_reasoning
                          // Use allowedQuestionTypes if available (for soft skills), otherwise determine from category
                          const isSpecialCategory = topic.category && ["aptitude", "communication", "logical_reasoning"].includes(topic.category);
                          
                          // Determine available question types based on topic relevance
                          let questionTypes: string[];
                          if (topic.allowedQuestionTypes && topic.allowedQuestionTypes.length > 0) {
                            questionTypes = topic.allowedQuestionTypes; // Use allowedQuestionTypes if defined
                          } else if (isSpecialCategory) {
                            questionTypes = ["MCQ", "Subjective"]; // Soft skills only
                          } else {
                            // Base types available for all technical topics
                            const baseTypes = ["MCQ", "Subjective", "PseudoCode"];
                            
                            // Add SQL only if topic is SQL-related
                            const isSqlRelated = isTopicSqlRelated(topic.label);
                            
                            // Add AIML only if topic is AIML-related
                            const isAimlRelated = isTopicAimlRelated(topic.label);
                            
                            // Add Coding ONLY if ALL conditions are met:
                            // 1. Topic supports coding (coding_supported !== false)
                            // 2. Row can use Judge0 (canUseJudge0 === true)
                            // 3. Topic is NOT SQL-related (SQL topics use SQL type, not Coding)
                            // 4. Topic is NOT AIML-related (AIML topics use AIML type, not Coding)
                            // 5. Topic is NOT web-related (web topics don't support Judge0 execution)
                            // 6. Topic mentions a Judge0-supported language (JavaScript, TypeScript, Java, Python, C++, C#, C, Go, Rust, Kotlin)
                            // 7. Topic is DSA/algorithmic (sorting, searching, trees, graphs, etc.)
                            const isWebRelated = isTopicWebRelated(topic.label);
                            const isCodingCompatible = isTopicCodingSupported(topic.label);
                            const supportsCoding = 
                              topic.coding_supported !== false && 
                              row.canUseJudge0 &&
                              !isSqlRelated &&
                              !isAimlRelated &&
                              !isWebRelated &&
                              isCodingCompatible;
                            
                            questionTypes = [
                              ...baseTypes,
                              ...(isSqlRelated ? ["SQL"] : []),
                              ...(isAimlRelated ? ["AIML"] : []),
                              ...(supportsCoding ? ["Coding"] : [])
                            ];
                          }
                          
                          // ⭐ CRITICAL FIX: If row already has a questionType that's not in available options, add it
                          // This ensures the select dropdown can display the current value even if it's not normally available
                          // This is ESSENTIAL because the questionType from database might not match the calculated available options
                          if (row.questionType && !questionTypes.includes(row.questionType)) {
                            questionTypes = [...questionTypes, row.questionType];
                            console.log(`🔍 DEBUG: Added missing questionType "${row.questionType}" to available options for topic ${topic.id}, row ${row.rowId}`);
                          }
                          
                          // ⭐ CRITICAL FIX: Also check if questionType is undefined/null and set a default
                          // But ONLY if it's truly missing - don't override existing values
                          if (!row.questionType) {
                            // Don't set default here - let it be handled by the select value binding
                            // This ensures we preserve the actual questionType from database
                          }
                          
                          return [
                            <tr key={`${topic.id}-${row.rowId}-${topicInputValues[topic.id] || topic.label || ""}-${row.questionType || "MCQ"}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "1rem", verticalAlign: "top" }}>
                                {isFirstRow && (
                                  <>
                                    {(() => {
                                      // Check if this is a custom topic with generated questions
                                      const isCustomTopic = topic.questionRows.length === 1 && 
                                                            topic.questionRows[0].questionsCount === 1 &&
                                                            topic.questionRows.some(row => {
                                                              const rowStatus = row.status;
                                                              const isGeneratedOrCompleted = rowStatus === "generated" || rowStatus === "completed";
                                                              return row.questions && row.questions.length > 0 && isGeneratedOrCompleted;
                                                            });
                                      const isCustomTopicDisabled = isCustomTopic;
                                      
                                      return (
                                    <button
                                      type="button"
                                      onClick={() => handleRegenerateTopicV2(topic.id)}
                                          disabled={!canRegenerate || generatingRowId !== null || isCustomTopicDisabled}
                                          title={
                                            isCustomTopicDisabled 
                                              ? "Custom topics cannot be regenerated. Use Preview on the question row to regenerate." 
                                              : !canRegenerate 
                                                ? "Topic regeneration is locked" 
                                                : "Regenerate this topic"
                                          }
                                      style={{
                                        marginBottom: "0.5rem",
                                        padding: "0.375rem 0.75rem",
                                            background: (canRegenerate && !isCustomTopicDisabled) ? "#3b82f6" : "#94a3b8",
                                        border: "none",
                                        color: "#ffffff",
                                            cursor: (canRegenerate && !isCustomTopicDisabled && generatingRowId === null) ? "pointer" : "not-allowed",
                                        fontSize: "0.75rem",
                                        fontWeight: 500,
                                        borderRadius: "0.375rem",
                                            opacity: (canRegenerate && !isCustomTopicDisabled && generatingRowId === null) ? 1 : 0.6,
                                      }}
                                    >
                                      Regenerate Topic
                                    </button>
                                      );
                                    })()}
                                    <div style={{ position: "relative" }}>
                                      <label htmlFor={`topic-input-${topic.id}`} className="sr-only">
                                        Topic Name
                                      </label>
                                      <input
                                        id={`topic-input-${topic.id}`}
                                        name={`topic-input-${topic.id}`}
                                        type="text"
                                        value={(() => {
                                          const computedValue = topicInputValues[topic.id] ?? topic.label ?? "";
                                          // 🔍 DEBUG: Log the exact value being set in the input
                                          if (topic.id === topicsV2[0]?.id) {
                                            console.log(`🔍 DEBUG: Input field value for ${topic.id}:`, {
                                              topicId: topic.id,
                                              topicInputValuesKey: topicInputValues[topic.id],
                                              topicLabel: topic.label,
                                              computedValue: computedValue,
                                              valueType: typeof computedValue,
                                              valueLength: computedValue?.length,
                                            });
                                          }
                                          return computedValue;
                                        })()}
                                        onChange={(e) => handleTopicNameChange(topic.id, e.target.value)}
                                        onFocus={() => {
                                          const specialCategories = ["aptitude", "communication", "logical_reasoning"] as const;
                                          if (topic.category && specialCategories.includes(topic.category as any) && topic.label.length >= 2) {
                                            setShowingSuggestionsFor(topic.id);
                                            fetchTopicSuggestions(topic.label, topic.category);
                                          }
                                        }}
                                        onBlur={() => {
                                          // Delay hiding suggestions to allow clicking
                                          setTimeout(() => setShowingSuggestionsFor(null), 200);
                                        }}
                                        placeholder="Enter topic name"
                                        disabled={topic.locked}
                                        style={{
                                          width: "100%",
                                          padding: "0.5rem",
                                          border: "1px solid #e2e8f0",
                                          borderRadius: "0.5rem",
                                          fontSize: "0.875rem",
                                          color: "#1e293b", // ⭐ CRITICAL FIX: Explicit text color
                                          backgroundColor: topic.locked ? "#f1f5f9" : "#ffffff",
                                          cursor: topic.locked ? "not-allowed" : "text",
                                          opacity: topic.locked ? 0.6 : 1,
                                        }}
                                      />
                                      
                                      {/* Suggestions Dropdown */}
                                      {showingSuggestionsFor === topic.id && topicSuggestions.length > 0 && !topic.locked && (
                                        <div style={{
                                          position: "absolute",
                                          top: "100%",
                                          left: 0,
                                          right: 0,
                                          marginTop: "0.25rem",
                                          backgroundColor: "#ffffff",
                                          border: "1px solid #e2e8f0",
                                          borderRadius: "0.5rem",
                                          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                                          zIndex: 1000,
                                          maxHeight: "200px",
                                          overflowY: "auto",
                                        }}>
                                          {topicSuggestions.map((suggestion, idx) => (
                                            <div
                                              key={idx}
                                              onClick={() => {
                                                handleTopicNameChange(topic.id, suggestion.value);
                                                setShowingSuggestionsFor(null);
                                                setTopicSuggestions([]);
                                              }}
                                              style={{
                                                padding: "0.75rem",
                                                cursor: "pointer",
                                                borderBottom: idx < topicSuggestions.length - 1 ? "1px solid #f1f5f9" : "none",
                                                fontSize: "0.875rem",
                                                color: "#1e293b",
                                              }}
                                              onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = "#f8fafc";
                                              }}
                                              onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = "#ffffff";
                                              }}
                                            >
                                              {suggestion.label}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      
                                    </div>
                                  </>
                                )}
                              </td>
                              <td style={{ padding: "1rem" }}>
                                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                                  <label htmlFor={`question-type-${topic.id}-${row.rowId}`} className="sr-only">
                                    Question Type
                                  </label>
                                  <select
                                    id={`question-type-${topic.id}-${row.rowId}`}
                                    name={`question-type-${topic.id}-${row.rowId}`}
                                    value={(() => {
                                      const currentQuestionType = row.questionType || "MCQ";
                                      return String(currentQuestionType);
                                    })()}
                                    onChange={(e) => {
                                      const newType = e.target.value as "MCQ" | "Subjective" | "PseudoCode" | "Coding" | "SQL" | "AIML";
                                      handleQuestionTypeChangeFromDropdown(topic.id, row.rowId, newType);
                                    }}
                                    disabled={row.locked}
                                    style={{
                                      flex: 1,
                                      padding: "0.5rem",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: "0.5rem",
                                      fontSize: "0.875rem",
                                      color: "#1e293b",
                                      backgroundColor: row.locked ? "#f1f5f9" : "#ffffff",
                                      cursor: row.locked ? "not-allowed" : "pointer",
                                      opacity: row.locked ? 0.6 : 1,
                                    }}
                                  >
                                    {(() => {
                                      // Get relevant question types based on topic content
                                      const relevantTypes = getRelevantQuestionTypes(topic.label || "");
                                      
                                      return relevantTypes.map((type) => {
                                        // Additional check: disable Coding if topic doesn't support it
                                        const isCodingDisabled = type === "Coding" && 
                                          topic.category === "technical" && 
                                          topic.coding_supported === false;
                                        
                                        return (
                                          <option 
                                            key={type} 
                                            value={type}
                                            disabled={isCodingDisabled}
                                            style={{
                                              color: isCodingDisabled ? "#94a3b8" : "#1e293b",
                                            }}
                                          >
                                            {type}{isCodingDisabled ? " (Not supported)" : ""}
                                          </option>
                                        );
                                      });
                                    })()}
                                  </select>
                                  {canAddRow && isFirstRow && (
                                    <button
                                      type="button"
                                      onClick={() => handleAddQuestionRow(topic.id)}
                                      title="Add question type row"
                                      style={{
                                        padding: "0.5rem",
                                        background: "none",
                                        border: "1px solid #10b981",
                                        color: "#10b981",
                                        cursor: "pointer",
                                        fontSize: "1.25rem",
                                        fontWeight: 600,
                                        borderRadius: "0.25rem",
                                        width: "32px",
                                        height: "32px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                      }}
                                    >
                                      +
                                    </button>
                                  )}
                                  {topic.questionRows.length > 1 && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveQuestionRow(topic.id, row.rowId)}
                                      disabled={row.locked}
                                      title="Remove this question type row"
                                      style={{
                                        padding: "0.5rem",
                                        background: "none",
                                        border: "1px solid #ef4444",
                                        color: "#ef4444",
                                        cursor: row.locked ? "not-allowed" : "pointer",
                                        fontSize: "1.25rem",
                                        fontWeight: 600,
                                        borderRadius: "0.25rem",
                                        width: "32px",
                                        height: "32px",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        opacity: row.locked ? 0.5 : 1,
                                      }}
                                    >
                                      −
                                    </button>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: "1rem" }}>
                                <label htmlFor={`difficulty-${topic.id}-${row.rowId}`} className="sr-only">
                                  Difficulty Level
                                </label>
                                <select
                                  id={`difficulty-${topic.id}-${row.rowId}`}
                                  name={`difficulty-${topic.id}-${row.rowId}`}
                                  value={row.difficulty}
                                  onChange={(e) => handleUpdateRow(topic.id, row.rowId, "difficulty", e.target.value)}
                                  disabled={row.locked}
                                  style={{
                                    width: "100%",
                                    padding: "0.5rem",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "0.5rem",
                                    fontSize: "0.875rem",
                                    backgroundColor: row.locked ? "#f1f5f9" : "#ffffff",
                                    cursor: row.locked ? "not-allowed" : "pointer",
                                    opacity: row.locked ? 0.6 : 1,
                                  }}
                                >
                                  {["Easy", "Medium", "Hard"].map((level) => (
                                    <option key={level} value={level}>
                                      {level}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td style={{ padding: "1rem" }}>
                                <label htmlFor={`questions-count-${topic.id}-${row.rowId}`} className="sr-only">
                                  Questions Count
                                </label>
                                <input
                                  id={`questions-count-${topic.id}-${row.rowId}`}
                                  name={`questions-count-${topic.id}-${row.rowId}`}
                                  type="number"
                                  min="1"
                                  max="20"
                                  value={row.questionsCount}
                                  onChange={(e) => handleUpdateRow(topic.id, row.rowId, "questionsCount", parseInt(e.target.value) || 1)}
                                  disabled={row.locked}
                                  style={{
                                    width: "100%",
                                    padding: "0.5rem",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "0.5rem",
                                    fontSize: "0.875rem",
                                    backgroundColor: row.locked ? "#f1f5f9" : "#ffffff",
                                    cursor: row.locked ? "not-allowed" : "text",
                                    opacity: row.locked ? 0.6 : 1,
                                  }}
                                />
                              </td>
                              <td style={{ padding: "1rem", verticalAlign: "top" }}>
                                <label htmlFor={`additional-requirements-${topic.id}-${row.rowId}`} className="sr-only">
                                  Additional Requirements
                                </label>
                                <textarea
                                  id={`additional-requirements-${topic.id}-${row.rowId}`}
                                  name={`additional-requirements-${topic.id}-${row.rowId}`}
                                  value={row.additionalRequirements || ""}
                                  onChange={(e) => handleUpdateRow(topic.id, row.rowId, "additionalRequirements", e.target.value)}
                                  disabled={row.locked}
                                  placeholder="Optional: Add requirements..."
                                  style={{
                                    width: "100%",
                                    minHeight: "60px",
                                    padding: "0.5rem",
                                    border: "1px solid #e2e8f0",
                                    borderRadius: "0.5rem",
                                    fontSize: "0.875rem",
                                    fontFamily: "inherit",
                                    backgroundColor: row.locked ? "#f1f5f9" : "#ffffff",
                                    cursor: row.locked ? "not-allowed" : "text",
                                    opacity: row.locked ? 0.6 : 1,
                                    resize: "vertical",
                                  }}
                                />
                              </td>
                              <td style={{ padding: "1rem" }}>
                                <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                                  {/* Preview button removed */}
                                  {isFirstRow && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTopicV2(topic.id)}
                                      disabled={topic.locked}
                                      title="Remove topic"
                                      style={{
                                        padding: "0.5rem 1rem",
                                        background: "none",
                                        border: "1px solid #ef4444",
                                        color: "#ef4444",
                                        cursor: topic.locked ? "not-allowed" : "pointer",
                                        fontSize: "0.75rem",
                                        fontWeight: 500,
                                        borderRadius: "0.375rem",
                                        opacity: topic.locked ? 0.5 : 1,
                                      }}
                                    >
                                      Remove Topic
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ];
                        })
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} style={{ padding: "2rem", textAlign: "center", color: "#64748b" }}>
                          {loadingDraft ? (
                            "Loading topics..."
                          ) : isEditMode && assessmentId ? (
                            <div>
                              <p>Topics are being loaded...</p>
                              <p style={{ fontSize: "0.875rem", marginTop: "0.5rem", color: "#64748b" }}>
                                If topics don't appear, please refresh the page.
                              </p>
                            </div>
                          ) : (
                            "No topics configured yet. Please generate topics from Station 1 or add a custom topic below."
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Custom Topic Input (V2) with Category Selection */}
              <div style={{ marginTop: "2rem", padding: "1.5rem", backgroundColor: "#f8fafc", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
                <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                  Add Custom Topic
                </label>
                
                {/* Soft Skill Category Selection Tabs */}
                <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryForNewTopic("aptitude");
                      setShowTechnicalInput(false);
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      background: selectedCategoryForNewTopic === "aptitude" ? "#3b82f6" : "#ffffff",
                      border: `2px solid ${selectedCategoryForNewTopic === "aptitude" ? "#3b82f6" : "#e2e8f0"}`,
                      color: selectedCategoryForNewTopic === "aptitude" ? "#ffffff" : "#1e293b",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      borderRadius: "0.5rem",
                      transition: "all 0.2s",
                    }}
                  >
                    Aptitude
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryForNewTopic("communication");
                      setShowTechnicalInput(false);
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      background: selectedCategoryForNewTopic === "communication" ? "#3b82f6" : "#ffffff",
                      border: `2px solid ${selectedCategoryForNewTopic === "communication" ? "#3b82f6" : "#e2e8f0"}`,
                      color: selectedCategoryForNewTopic === "communication" ? "#ffffff" : "#1e293b",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      borderRadius: "0.5rem",
                      transition: "all 0.2s",
                    }}
                  >
                    Communication
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryForNewTopic("logical_reasoning");
                      setShowTechnicalInput(false);
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      background: selectedCategoryForNewTopic === "logical_reasoning" ? "#3b82f6" : "#ffffff",
                      border: `2px solid ${selectedCategoryForNewTopic === "logical_reasoning" ? "#3b82f6" : "#e2e8f0"}`,
                      color: selectedCategoryForNewTopic === "logical_reasoning" ? "#ffffff" : "#1e293b",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      borderRadius: "0.5rem",
                      transition: "all 0.2s",
                    }}
                  >
                    Logical Reasoning
                  </button>
                  
                  {/* Separate Technical Skill Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowTechnicalInput(true);
                      setSelectedCategoryForNewTopic(null);
                      setCustomTopicInputV2("");
                      setShowAiSuggestions(false);
                      setAiTopicSuggestions([]);
                      setSuggestionsFetched(false); // Reset fetched flag
                    }}
                    style={{
                      padding: "0.5rem 1rem",
                      background: showTechnicalInput ? "#10b981" : "#ffffff",
                      border: `2px solid ${showTechnicalInput ? "#10b981" : "#e2e8f0"}`,
                      color: showTechnicalInput ? "#ffffff" : "#1e293b",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      borderRadius: "0.5rem",
                      transition: "all 0.2s",
                      marginLeft: "auto",
                    }}
                  >
                    Add Technical Skill
                  </button>
                </div>
                
                {/* Soft Skill Input Area (shown when a soft skill tab is selected) */}
                {!showTechnicalInput && selectedCategoryForNewTopic && (
                  <div style={{ position: "relative", display: "flex", gap: "0.5rem" }}>
                    <div ref={suggestionsContainerRef} style={{ flex: 1, position: "relative" }}>
                      <input
                        ref={customTopicInputRef}
                        type="text"
                        value={customTopicInputV2}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCustomTopicInputV2(value);
                          
                          // Reset fetched flag when input is cleared or too short
                          if (!value.trim() || value.trim().length < 2) {
                            setSuggestionsFetched(false);
                            setShowAiSuggestions(false);
                            setAiTopicSuggestions([]);
                          } else {
                            // Reset fetched flag when input changes to allow refetching
                            setSuggestionsFetched(false);
                          }
                          
                          // Fetch AI-powered suggestions ONLY for soft skills (with debouncing)
                          if (selectedCategoryForNewTopic && value.trim().length >= 2) {
                            fetchAiTopicSuggestions(value, selectedCategoryForNewTopic, false);
                          }
                        }}
                        onFocus={() => {
                          // Show suggestions when field is focused - fetch even with empty input
                          console.log("onFocus triggered", { 
                            input: customTopicInputV2, 
                            category: selectedCategoryForNewTopic,
                            length: customTopicInputV2.trim().length 
                          }); // Debug
                          
                          if (selectedCategoryForNewTopic) {
                            console.log("onFocus: Calling fetchAiTopicSuggestions with forceFetch=true"); // Debug
                            setSuggestionsFetched(false); // Reset to allow fetching
                            // Use the input value, or empty string to get general suggestions for the category
                            const queryToUse = customTopicInputV2.trim() || "";
                            fetchAiTopicSuggestions(queryToUse, selectedCategoryForNewTopic, true);
                          } else {
                            console.log("onFocus: Not fetching - no category selected"); // Debug
                          }
                        }}
                        onBlur={(e) => {
                          // Don't handle blur here - let the outside click handler manage closing
                          // This prevents premature closing when clicking suggestions
                        }}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            handleAddCustomTopicV2(false);
                            setShowAiSuggestions(false);
                          }
                        }}
                        placeholder={
                          selectedCategoryForNewTopic === "aptitude" 
                            ? "Enter aptitude topic name…"
                            : selectedCategoryForNewTopic === "communication"
                            ? "Enter communication topic name…"
                            : "Enter logical reasoning topic name…"
                        }
                        disabled={loading}
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          border: "1px solid #e2e8f0",
                          borderRadius: "0.5rem",
                          fontSize: "0.875rem",
                          backgroundColor: "#ffffff",
                          cursor: "text",
                          opacity: loading ? 0.6 : 1,
                        }}
                      />
                      
                      {/* AI-Powered Suggestions Dropdown (ONLY for soft skills) */}
                      {showAiSuggestions && (aiTopicSuggestions.length > 0 || loadingAiSuggestions) && (
                        <div 
                          data-suggestions-dropdown
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            marginTop: "0.25rem",
                            backgroundColor: "#ffffff",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.5rem",
                            boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
                            zIndex: 1000,
                            maxHeight: "300px",
                            overflowY: "auto",
                          }}
                        >
                          {loadingAiSuggestions ? (
                            <div style={{ padding: "1rem", textAlign: "center", color: "#64748b", fontSize: "0.875rem" }}>
                              Generating suggestions...
                            </div>
                          ) : aiTopicSuggestions.length > 0 ? (
                            aiTopicSuggestions.map((suggestion, idx) => {
                              // Highlight matching text
                              const query = customTopicInputV2.toLowerCase();
                              const suggestionLower = suggestion.toLowerCase();
                              const matchIndex = suggestionLower.indexOf(query);
                              
                              return (
                                <div
                                  key={idx}
                                  onMouseDown={(e) => {
                                    // Prevent input blur when clicking suggestion
                                    e.preventDefault();
                                  }}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    console.log("Suggestion item clicked:", suggestion); // Debug
                                    handleSuggestionClick(suggestion);
                                  }}
                                  style={{
                                    padding: "0.75rem",
                                    cursor: "pointer",
                                    borderBottom: idx < aiTopicSuggestions.length - 1 ? "1px solid #f1f5f9" : "none",
                                    fontSize: "0.875rem",
                                    color: "#1e293b",
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = "#f8fafc";
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = "#ffffff";
                                  }}
                                >
                                  {matchIndex >= 0 && query.length > 0 ? (
                                    <>
                                      {suggestion.substring(0, matchIndex)}
                                      <strong style={{ color: "#3b82f6" }}>
                                        {suggestion.substring(matchIndex, matchIndex + query.length)}
                                      </strong>
                                      {suggestion.substring(matchIndex + query.length)}
                                    </>
                                  ) : (
                                    suggestion
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ padding: "1rem", textAlign: "center", color: "#64748b", fontSize: "0.875rem" }}>
                              No suggestions found
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={handleAddSoftSkillTopic}
                      disabled={loading || !customTopicInputV2.trim() || addingTopic || validatingTopic}
                      style={{
                        padding: "0.75rem 1.5rem",
                        background: loading || !customTopicInputV2.trim() || addingTopic || validatingTopic ? "#94a3b8" : "#10b981",
                        border: "none",
                        color: "#ffffff",
                        cursor: loading || !customTopicInputV2.trim() || addingTopic || validatingTopic ? "not-allowed" : "pointer",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        borderRadius: "0.5rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {addingTopic 
                        ? "Adding..."
                        : validatingTopic
                        ? "Validating..."
                        : selectedCategoryForNewTopic === "aptitude" 
                        ? "Add Aptitude Topic"
                        : selectedCategoryForNewTopic === "communication"
                        ? "Add Communication Topic"
                        : "Add Logical Reasoning Topic"}
                    </button>
                  </div>
                )}

                {/* Technical Input Area (shown when "Add Technical Skill" is clicked) */}
                {showTechnicalInput && (
                  <div style={{ display: "flex", gap: "0.5rem", flexDirection: "column" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <input
                        type="text"
                        value={customTopicInputV2}
                        onChange={(e) => {
                          setCustomTopicInputV2(e.target.value);
                          // NO AI suggestions for technical topics
                          setShowAiSuggestions(false);
                          setAiTopicSuggestions([]);
                        }}
                        onKeyPress={(e) => {
                          if (e.key === "Enter") {
                            handleAddCustomTopicV2(true);
                          }
                        }}
                        placeholder="Enter technical topic name…"
                        disabled={loading}
                        style={{
                          flex: 1,
                          padding: "0.75rem",
                          border: "1px solid #e2e8f0",
                          borderRadius: "0.5rem",
                          fontSize: "0.875rem",
                          backgroundColor: "#ffffff",
                          cursor: "text",
                          opacity: loading ? 0.6 : 1,
                        }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddCustomTopicV2(true, undefined, e);
                        }}
                        disabled={loading || !customTopicInputV2.trim() || addingTopic}
                        style={{
                          padding: "0.75rem 1.5rem",
                          background: loading || !customTopicInputV2.trim() || addingTopic ? "#94a3b8" : "#10b981",
                          border: "none",
                          color: "#ffffff",
                          cursor: loading || !customTopicInputV2.trim() || addingTopic ? "not-allowed" : "pointer",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          borderRadius: "0.5rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {addingTopic ? "Adding..." : "Add Technical Topic"}
                      </button>
                    </div>
                    <div style={{ fontSize: "0.8125rem", color: "#64748b", marginTop: "0.25rem" }}>
                      Add a specific technical topic. Technical topics do not show suggestions.
                    </div>
                  </div>
                )}

                {/* Message when no category is selected */}
                {!showTechnicalInput && !selectedCategoryForNewTopic && (
                  <div style={{ padding: "1rem", textAlign: "center", color: "#64748b", fontSize: "0.875rem", backgroundColor: "#f1f5f9", borderRadius: "0.5rem" }}>
                    Select a soft skill category above or click "Add Technical Skill" to add a topic.
                  </div>
                )}
                
              </div>

              {/* Regenerate All Topics Button (V2) */}
              <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
                <button
                  type="button"
                  onClick={handleRegenerateAllTopicsV2}
                  disabled={fullTopicRegenLocked || allQuestionsGenerated || loading || !assessmentId}
                  className="btn-secondary"
                  style={{ 
                    flex: 1, 
                    opacity: (fullTopicRegenLocked || allQuestionsGenerated || loading || !assessmentId) ? 0.5 : 1 
                  }}
                >
                  {loading ? "Regenerating..." : "Regenerate All Topics"}
                </button>
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
                    <button
                      type="button"
                  onClick={() => setCurrentStation(1)}
                      className="btn-secondary"
                      style={{ flex: 1 }}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleNextToReviewQuestions}
                      className="btn-primary"
                      style={{ 
                        flex: 1,
                        opacity: generatingAllQuestions ? 0.6 : 1,
                        cursor: generatingAllQuestions ? "not-allowed" : "pointer"
                      }}
                      disabled={generatingAllQuestions}
                      title={
                        generatingAllQuestions 
                          ? "Generating questions..." 
                          : "Generate questions and proceed to Review Questions"
                      }
                    >
                      {generatingAllQuestions ? "Generating Questions..." : "Next → Review Questions"}
                    </button>
              </div>
            </div>
          )}

          {/* Preview modals removed */}

          {/* Station 3: Review Questions */}
          {currentStation === 3 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ flex: 1 }}>
              <h1 style={{ marginBottom: "0.5rem", fontSize: "2rem", color: "#1a1625", fontWeight: 700 }}>
                Review Questions
              </h1>
              <p style={{ color: "#6b6678", marginBottom: "2rem", fontSize: "1rem" }}>
                Review questions grouped by type and set time for each question type
              </p>
                </div>
                <button
                  type="button"
                  onClick={handleBackToDashboard}
                  className="btn-secondary"
                  style={{ 
                    marginLeft: "1rem",
                    whiteSpace: "nowrap",
                    padding: "0.75rem 1.5rem",
                    fontSize: "0.875rem"
                  }}
                >
                  Back to Dashboard
                </button>
              </div>

              {/* Toggle for Per-Section Timers */}
              <div style={{ 
                marginBottom: "2rem", 
                padding: "1.5rem", 
                backgroundColor: "#f8fafc", 
                borderRadius: "0.75rem", 
                border: "2px solid #e2e8f0" 
              }}>
                <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={enablePerSectionTimers}
                    onChange={(e) => setEnablePerSectionTimers(e.target.checked)}
                    style={{ width: "20px", height: "20px", cursor: "pointer" }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "1rem" }}>
                      Enable Per-Section Timer
                  </div>
                    <div style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>
                      Each section will have its own timer. Sections will be locked when their timer expires.
                  </div>
                </div>
                </label>
              </div>

              {(() => {
                // Extract all questions from topicsV2
                const allReviewQuestions: Array<{
                  question: any;
                  questionType: string;
                  difficulty: string;
                  topicId: string;
                  rowId: string;
                  questionIndex: number;
                  topicLabel: string;
                  uniqueId: string;
                }> = [];
                
                // Aggregate questions from ALL topics including:
                // - System-generated topics
                // - Custom-added topics
                // - Topics previewed individually
                // - Topics that participated in preview-all
                topicsV2.forEach((topic) => {
                  topic.questionRows.forEach((row) => {
                    // Include questions if they exist and status is "generated" or "completed"
                    // "completed" status is used for custom topics generated via row preview
                    const rowStatus = row.status;
                    const isGeneratedOrCompleted = rowStatus === "generated" || rowStatus === "completed";
                    if (row.questions && row.questions.length > 0 && isGeneratedOrCompleted) {
                      row.questions.forEach((question, qIdx) => {
                        allReviewQuestions.push({
                          question,
                          questionType: row.questionType,
                          difficulty: row.difficulty,
                          topicId: topic.id,
                          rowId: row.rowId,
                          questionIndex: qIdx,
                          topicLabel: topic.label,
                          uniqueId: `${topic.id}_${row.rowId}_${qIdx}`,
                        });
                      });
                    }
                  });
                });
                
                if (allReviewQuestions.length === 0) {
                  return (
                    <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
                      <p>No questions generated yet.</p>
                      <p style={{ fontSize: "0.875rem", marginTop: "0.5rem" }}>
                        Generate questions from the Configure Topics page (Station 2).
                      </p>
                    </div>
                  );
                }
                
                // Group questions by type
                const questionsByType: {
                  MCQ: typeof allReviewQuestions;
                  Subjective: typeof allReviewQuestions;
                  PseudoCode: typeof allReviewQuestions;
                  Coding: typeof allReviewQuestions;
                  SQL: typeof allReviewQuestions;
                  AIML: typeof allReviewQuestions;
                } = {
                  MCQ: [],
                  Subjective: [],
                  PseudoCode: [],
                  Coding: [],
                  SQL: [],
                  AIML: [],
                };
                
                allReviewQuestions.forEach((q) => {
                  const type = q.questionType as keyof typeof questionsByType;
                  // Unknown types are ignored, but SQL/AIML must be supported to avoid dropping them.
                  questionsByType[type]?.push(q);
                });
                
                // Calculate AI estimated total time (sum of all question times)
                const totalAiEstimatedTime = allReviewQuestions.reduce((total, q) => {
                  const baseTime = getBaseTimePerQuestion(q.questionType);
                  const multiplier = getDifficultyMultiplier(q.difficulty);
                  let questionTime = baseTime * multiplier;
                  
                  // Cap MCQ questions at 40 seconds maximum
                  if (q.questionType === "MCQ" && questionTime > 40) {
                    questionTime = 40;
                  }
                  
                  return total + questionTime;
                }, 0);
                const totalAiEstimatedMinutes = Math.ceil(totalAiEstimatedTime / 60);
                
                return (
                  <div style={{ marginBottom: "2rem" }}>
                      <div style={{
                        marginBottom: "1.5rem",
                        padding: "1.5rem",
                        backgroundColor: "#f8fafc",
                        borderRadius: "0.75rem",
                        border: "1px solid #e2e8f0",
                      }}>
                        <div style={{ marginBottom: "1rem" }}>
                          <h3 style={{ margin: 0, marginBottom: "0.5rem", fontSize: "1.125rem", color: "#1a1625", fontWeight: 600 }}>
                            AI Estimated Total Time
                          </h3>
                          <p style={{ margin: 0, fontSize: "1.5rem", color: "#3b82f6", fontWeight: 700 }}>
                            {formatTime(totalAiEstimatedMinutes)}
                          </p>
                          <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem", color: "#64748b" }}>
                            Based on question types and difficulty levels
                          </p>
                        </div>
                            </div>
                    
                    {/* Question Type Sections */}
                    {(["MCQ", "Subjective", "PseudoCode", "Coding", "SQL", "AIML"] as const).map((questionType) => {
                      const typeQuestions = questionsByType[questionType] || [];
                      if (typeQuestions.length === 0) return null;
                      
                      const sectionTimer = sectionTimers[questionType];
                      
                      return (
                        <div key={questionType} style={{ marginBottom: "2rem" }}>
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center",
                            marginBottom: "1rem",
                            padding: "1rem",
                            backgroundColor: "#f8fafc",
                            borderRadius: "0.5rem",
                            border: "1px solid #e2e8f0"
                          }}>
                            <div>
                              <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#1a1625", fontWeight: 700 }}>
                                {questionType} Questions
                              </h3>
                              <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.875rem", color: "#64748b" }}>
                                {typeQuestions.length} question{typeQuestions.length !== 1 ? "s" : ""}
                                {enablePerSectionTimers && sectionTimer > 0 && ` • Timer: ${sectionTimer} minutes`}
                              </p>
                            </div>
                            {enablePerSectionTimers && (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem", color: "#1e293b", fontWeight: 600 }}>
                                  Timer (min):
                                  <input
                                    type="number"
                                    min="1"
                                    value={sectionTimer || 0}
                                    onChange={(e) => {
                                      const newValue = parseInt(e.target.value) || 0;
                                      setSectionTimers(prev => ({
                                        ...prev,
                                        [questionType]: newValue,
                                      }));
                                    }}
                                    style={{
                                      width: "80px",
                                      padding: "0.5rem",
                                      border: "1px solid #e2e8f0",
                                      borderRadius: "0.5rem",
                                      fontSize: "0.875rem",
                                    }}
                                  />
                                </label>
                              </div>
                            )}
                          </div>

                          {/* Questions Table for this type */}
                          <div style={{ overflowX: "auto", marginBottom: "1.5rem" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", backgroundColor: "#ffffff", borderRadius: "0.5rem", overflow: "hidden", border: "1px solid #e2e8f0" }}>
                              <thead>
                                <tr style={{ backgroundColor: "#f8fafc" }}>
                                  <th style={{ padding: "1rem", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                                    Question
                                  </th>
                                  <th style={{ padding: "1rem", textAlign: "left", borderBottom: "2px solid #e2e8f0", fontWeight: 600, color: "#1e293b", width: "100px" }}>
                                    Difficulty
                                  </th>
                                  <th style={{ padding: "1rem", textAlign: "center", borderBottom: "2px solid #e2e8f0", fontWeight: 600, color: "#1e293b", width: "100px" }}>
                                    Score
                                  </th>
                                  <th style={{ padding: "1rem", textAlign: "center", borderBottom: "2px solid #e2e8f0", fontWeight: 600, color: "#1e293b", width: "150px" }}>
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {typeQuestions.map((qData, idx) => {
                                  const questionText = getQuestionText(qData.question, questionType);
                                  const { truncated, isTruncated } = truncateText(questionText, 80);
                                  const questionId = qData.uniqueId;
                                  
                                  return (
                                    <tr key={questionId} style={{ borderBottom: "1px solid #e2e8f0" }}>
                                      <td style={{ padding: "1rem", maxWidth: "500px" }}>
                                        <div style={{ marginBottom: "0.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
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
                                            Q{idx + 1}
                                          </span>
                                        </div>
                                        <div style={{ fontSize: "0.875rem", color: "#1e293b", lineHeight: "1.6", marginBottom: "0.5rem" }}>
                                          {truncated}
                                          {isTruncated && (
                                            <button
                                              type="button"
                                              onClick={() => setExpandedQuestionId(questionId)}
                                              style={{
                                                marginLeft: "0.5rem",
                                                background: "none",
                                                border: "none",
                                                color: "#3b82f6",
                                                cursor: "pointer",
                                                textDecoration: "underline",
                                                fontSize: "0.875rem",
                                              }}
                                            >
                                              Read more
                                            </button>
                                          )}
                                        </div>
                                        <span style={{ fontSize: "0.75rem", color: "#64748b", display: "block" }}>
                                          Topic: {qData.topicLabel}
                                        </span>
                                      </td>
                                      <td style={{ padding: "1rem" }}>
                                        <span
                                          style={{
                                            backgroundColor: qData.difficulty === "Easy" ? "#d1fae5" : qData.difficulty === "Medium" ? "#fef3c7" : "#fee2e2",
                                            color: qData.difficulty === "Easy" ? "#065f46" : qData.difficulty === "Medium" ? "#92400e" : "#991b1b",
                                            padding: "0.25rem 0.75rem",
                                            borderRadius: "9999px",
                                            fontSize: "0.75rem",
                                            fontWeight: 500,
                                          }}
                                        >
                                          {qData.difficulty}
                                        </span>
                                      </td>
                                      <td style={{ padding: "1rem", textAlign: "center" }}>
                                        <span style={{ 
                                          fontSize: "1rem", 
                                          fontWeight: 600, 
                                          color: "#1e293b",
                                          display: "inline-block",
                                          padding: "0.25rem 0.75rem",
                                          backgroundColor: "#f1f5f9",
                                          borderRadius: "0.375rem",
                                        }}>
                                          {scoringRules[questionType as keyof typeof scoringRules] || 0} mark{scoringRules[questionType as keyof typeof scoringRules] !== 1 ? "s" : ""}
                                        </span>
                                      </td>
                                      <td style={{ padding: "1rem", textAlign: "center" }}>
                                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setExpandedQuestionId(questionId);
                                              setEditingReviewQuestion({ ...qData, questionType });
                                            }}
                                            style={{
                                              padding: "0.25rem 0.75rem",
                                              background: "#3b82f6",
                                              border: "none",
                                              color: "#ffffff",
                                              cursor: "pointer",
                                              fontSize: "0.75rem",
                                              borderRadius: "0.375rem",
                                            }}
                                            title="Edit question"
                                          >
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setRegeneratingQuestionId(questionId);
                                              setRegenerateQuestionFeedback("");
                                            }}
                                            style={{
                                              padding: "0.25rem 0.75rem",
                                              background: "#10b981",
                                              border: "none",
                                              color: "#ffffff",
                                              cursor: "pointer",
                                              fontSize: "0.75rem",
                                              borderRadius: "0.375rem",
                                            }}
                                            title="Regenerate question"
                                          >
                                            Regenerate
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              if (confirm("Are you sure you want to remove this question?")) {
                                                handleRemoveQuestionInReview(qData.topicId, qData.rowId, qData.questionIndex);
                                              }
                                            }}
                                            style={{
                                              padding: "0.25rem 0.75rem",
                                              background: "#ef4444",
                                              border: "none",
                                              color: "#ffffff",
                                              cursor: "pointer",
                                              fontSize: "0.75rem",
                                              borderRadius: "0.375rem",
                                            }}
                                            title="Remove question"
                                          >
                                            Remove
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Total Summary */}
                    <div style={{ 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      padding: "1rem 1.5rem",
                      backgroundColor: "#f8fafc",
                      borderRadius: "0.5rem",
                      border: "1px solid #e2e8f0",
                      marginTop: "1rem"
                    }}>
                      <div>
                        <span style={{ color: "#64748b", fontSize: "0.875rem", marginRight: "0.5rem" }}>Total Questions:</span>
                        <span style={{ color: "#1e293b", fontSize: "1.125rem", fontWeight: 700 }}>
                          {allReviewQuestions.length}
                        </span>
                      </div>
                      {enablePerSectionTimers && (() => {
                        const totalSectionTime = Object.values(sectionTimers).reduce((sum, time) => sum + time, 0);
                        return totalSectionTime > 0 ? (
                          <div>
                            <span style={{ color: "#64748b", fontSize: "0.875rem", marginRight: "0.5rem" }}>Total Time (All Sections):</span>
                            <span style={{ color: "#1e293b", fontSize: "1.125rem", fontWeight: 700 }}>
                              {totalSectionTime} minutes
                            </span>
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                );
              })()}
              
              {/* Read More / Edit Question Modal */}
              {expandedQuestionId && (() => {
                const qData = (() => {
                  for (const topic of topicsV2) {
                    for (const row of topic.questionRows) {
                      if (row.questions && row.questions.length > 0) {
                        for (let i = 0; i < row.questions.length; i++) {
                          const id = `${topic.id}_${row.rowId}_${i}`;
                          if (id === expandedQuestionId) {
                            return {
                              question: row.questions[i],
                              questionType: row.questionType,
                              difficulty: row.difficulty,
                              topicId: topic.id,
                              rowId: row.rowId,
                              questionIndex: i,
                              topicLabel: topic.label,
                            };
                          }
                        }
                      }
                    }
                  }
                  return null;
                })();
                
                if (!qData) return null;
                
                const isEditing = editingReviewQuestion && editingReviewQuestion.uniqueId === expandedQuestionId;
                
                return (
                  <div style={{
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
                    padding: "2rem",
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setExpandedQuestionId(null);
                      setEditingReviewQuestion(null);
                    }
                  }}
                  >
                    <div style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "0.75rem",
                      padding: "2rem",
                      maxWidth: "800px",
                      maxHeight: "90vh",
                      overflow: "auto",
                      width: "100%",
                      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
                        <h2 style={{ margin: 0, fontSize: "1.5rem", color: "#1a1625", fontWeight: 700 }}>
                          {qData.topicLabel} - {qData.questionType}
                        </h2>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedQuestionId(null);
                            setEditingReviewQuestion(null);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            fontSize: "1.5rem",
                            cursor: "pointer",
                            color: "#64748b",
                            padding: "0.25rem 0.5rem",
                          }}
                        >
                          ×
                        </button>
                      </div>
                      
                      <div style={{ marginBottom: "1.5rem" }}>
                        {renderQuestionByType(
                          isEditing ? editingReviewQuestion.question : qData.question,
                          qData.questionType,
                          isEditing,
                          isEditing ? (value: string) => {
                            try {
                              const parsed = JSON.parse(value);
                              setEditingReviewQuestion({ ...editingReviewQuestion, question: parsed });
                            } catch {}
                          } : undefined
                        )}
                      </div>
                      
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        {!isEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReviewQuestion({ ...qData, uniqueId: expandedQuestionId });
                            }}
                            style={{
                              padding: "0.5rem 1rem",
                              background: "#10b981",
                              border: "none",
                              color: "#ffffff",
                              cursor: "pointer",
                              borderRadius: "0.375rem",
                              fontSize: "0.875rem",
                            }}
                          >
                            Edit Question
                          </button>
                        )}
                        {isEditing && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingReviewQuestion(null);
                              }}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "#94a3b8",
                                border: "none",
                                color: "#ffffff",
                                cursor: "pointer",
                                borderRadius: "0.375rem",
                                fontSize: "0.875rem",
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (!assessmentId || !editingReviewQuestion) return;
                                try {
                                  const response = await updateSingleQuestionMutation.mutateAsync({
                                    assessmentId: assessmentId || "",
                                    questionId: (qData as any).questionId || (qData as any).uniqueId || "",
                                    topicId: qData.topicId,
                                    rowId: qData.rowId,
                                    questionIndex: qData.questionIndex,
                                    question: editingReviewQuestion.question,
                                  });
                                  if (response?.success) {
                                    const updatedRow = response.data?.row;
                                    setTopicsV2((prev) => prev.map(t => {
                                      if (t.id === qData.topicId) {
                                        return {
                                          ...t,
                                          questionRows: t.questionRows.map(r => r.rowId === qData.rowId ? updatedRow : r),
                                        };
                                      }
                                      return t;
                                    }));
                                    setEditingReviewQuestion(null);
                                  }
                                } catch (err: any) {
                                  console.error("Error updating question:", err);
                                  setError(err.response?.data?.message || err.message || "Failed to update question");
                                }
                              }}
                              style={{
                                padding: "0.5rem 1rem",
                                background: "#3b82f6",
                                border: "none",
                                color: "#ffffff",
                                cursor: "pointer",
                                borderRadius: "0.375rem",
                                fontSize: "0.875rem",
                              }}
                            >
                              Save
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedQuestionId(null);
                            setEditingReviewQuestion(null);
                          }}
                          style={{
                            padding: "0.5rem 1rem",
                            background: "#64748b",
                            border: "none",
                            color: "#ffffff",
                            cursor: "pointer",
                            borderRadius: "0.375rem",
                            fontSize: "0.875rem",
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Regenerate Question Modal */}
              {regeneratingQuestionId && (() => {
                const qData = (() => {
                  for (const topic of topicsV2) {
                    for (const row of topic.questionRows) {
                      if (row.questions && row.questions.length > 0) {
                        for (let i = 0; i < row.questions.length; i++) {
                          const id = `${topic.id}_${row.rowId}_${i}`;
                          if (id === regeneratingQuestionId) {
                            return {
                              question: row.questions[i],
                              questionType: row.questionType,
                              difficulty: row.difficulty,
                              topicId: topic.id,
                              rowId: row.rowId,
                              questionIndex: i,
                              topicLabel: topic.label,
                              additionalRequirements: row.additionalRequirements,
                            };
                          }
                        }
                      }
                    }
                  }
                  return null;
                })();
                
                if (!qData) return null;
                
                const questionText = getQuestionText(qData.question, qData.questionType);
                
                return (
                  <div style={{
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
                    padding: "2rem",
                  }}
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setRegeneratingQuestionId(null);
                      setRegenerateQuestionFeedback("");
                    }
                  }}
                  >
                    <div style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "0.75rem",
                      padding: "2rem",
                      maxWidth: "700px",
                      maxHeight: "90vh",
                      overflow: "auto",
                      width: "100%",
                      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
                    }}>
                      <div style={{ marginBottom: "1.5rem" }}>
                        <h2 style={{ margin: 0, fontSize: "1.5rem", color: "#1a1625", fontWeight: 700 }}>
                          Regenerate Question
                        </h2>
                        <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem", color: "#64748b" }}>
                          {qData.topicLabel} - {qData.questionType}
                        </p>
                      </div>
                      
                      <div style={{ marginBottom: "1.5rem" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b", fontSize: "0.875rem" }}>
                          Current Question (Read-only):
                        </label>
                        <div style={{
                          padding: "1rem",
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "0.5rem",
                          fontSize: "0.875rem",
                          color: "#1e293b",
                          maxHeight: "200px",
                          overflow: "auto",
                        }}>
                          {renderQuestionByType(qData.question, qData.questionType, false)}
                        </div>
                      </div>
                      
                      <div style={{ marginBottom: "1.5rem" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b", fontSize: "0.875rem" }}>
                          Provide feedback to improve this question (optional):
                        </label>
                        <textarea
                          value={regenerateQuestionFeedback}
                          onChange={(e) => setRegenerateQuestionFeedback(e.target.value)}
                          placeholder="E.g., Make it more scenario-based, add more context, increase difficulty..."
                          style={{
                            width: "100%",
                            minHeight: "100px",
                            padding: "0.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.5rem",
                            fontSize: "0.875rem",
                            fontFamily: "inherit",
                            resize: "vertical",
                          }}
                        />
                      </div>
                      
                      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setRegeneratingQuestionId(null);
                            setRegenerateQuestionFeedback("");
                          }}
                          style={{
                            padding: "0.5rem 1rem",
                            background: "#94a3b8",
                            border: "none",
                            color: "#ffffff",
                            cursor: "pointer",
                            borderRadius: "0.375rem",
                            fontSize: "0.875rem",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleRegenerateQuestion}
                          style={{
                            padding: "0.5rem 1rem",
                            background: "#10b981",
                            border: "none",
                            color: "#ffffff",
                            cursor: "pointer",
                            borderRadius: "0.375rem",
                            fontSize: "0.875rem",
                          }}
                        >
                          Regenerate
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Pass Percentage Setting */}
              <div style={{ 
                marginTop: "2rem", 
                padding: "1.5rem", 
                backgroundColor: "#f8fafc", 
                borderRadius: "0.75rem", 
                border: "2px solid #e2e8f0" 
              }}>
                <h3 style={{ marginBottom: "1rem", fontSize: "1.125rem", color: "#1a1625", fontWeight: 600 }}>
                  Pass Percentage
                </h3>
                <div style={{ marginBottom: "1rem" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b", fontSize: "0.875rem" }}>
                    Pass Percentage (%)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={passPercentage}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 60;
                      const clampedValue = Math.min(100, Math.max(1, value));
                      setPassPercentage(clampedValue);
                    }}
                    placeholder="Enter pass percentage (e.g., 60)"
                    style={{
                      width: "200px",
                      padding: "0.75rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                    }}
                  />
                  <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
                    Candidates need to score at least {passPercentage}% to pass the assessment.
                  </p>
                </div>
              </div>

              {/* Navigation Buttons */}
              <div style={{ marginTop: "2rem", paddingTop: "2rem", borderTop: "2px solid #e2e8f0", display: "flex", gap: "1rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    setHasVisitedReviewStation(true);
                    setCurrentStation(2);
                  }}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStation(4);
                  }}
                  className="btn-primary"
                  style={{ flex: 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Station 4: Schedule Exam */}
          {currentStation === 4 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ flex: 1 }}>
              <h1 style={{ marginBottom: "0.5rem", fontSize: "2rem", color: "#1a1625", fontWeight: 700 }}>
                Schedule Exam
              </h1>
              <p style={{ color: "#6b6678", marginBottom: "2rem", fontSize: "1rem" }}>
                Configure exam timing and duration settings
              </p>
                </div>
                <button
                  type="button"
                  onClick={handleBackToDashboard}
                  className="btn-secondary"
                  style={{ 
                    marginLeft: "1rem",
                    whiteSpace: "nowrap",
                    padding: "0.75rem 1.5rem",
                    fontSize: "0.875rem"
                  }}
                >
                  Back to Dashboard
                </button>
              </div>

              {/* Exam Mode Selection */}
              <div style={{ marginBottom: "2rem", padding: "1.5rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}>
                <h3 style={{ marginBottom: "1rem", color: "#1e293b", fontSize: "1.125rem", fontWeight: 600 }}>Exam Mode</h3>
                <p style={{ marginBottom: "1rem", color: "#64748b", fontSize: "0.875rem" }}>
                  Choose how the exam timing works.
                </p>
                <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
                  <label
                    style={{
                      flex: 1,
                      padding: "1rem",
                      border: examMode === "strict" ? "2px solid #10b981" : "1px solid #e2e8f0",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      backgroundColor: examMode === "strict" ? "#f0fdf4" : "#ffffff",
                    }}
                  >
                    <input
                      type="radio"
                      name="examMode"
                      value="strict"
                      checked={examMode === "strict"}
                      onChange={(e) => setExamMode(e.target.value as "strict" | "flexible")}
                      style={{ marginRight: "0.5rem" }}
                    />
                    <strong style={{ color: "#1e293b" }}>Strict Window</strong>
                    <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem", color: "#64748b" }}>
                      Assessment starts at a fixed time. Candidates can access before start time for pre-checks.
                    </p>
                  </label>
                  <label
                    style={{
                      flex: 1,
                      padding: "1rem",
                      border: examMode === "flexible" ? "2px solid #10b981" : "1px solid #e2e8f0",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      backgroundColor: examMode === "flexible" ? "#f0fdf4" : "#ffffff",
                    }}
                  >
                    <input
                      type="radio"
                      name="examMode"
                      value="flexible"
                      checked={examMode === "flexible"}
                      onChange={(e) => setExamMode(e.target.value as "strict" | "flexible")}
                      style={{ marginRight: "0.5rem" }}
                    />
                    <strong style={{ color: "#1e293b" }}>Flexible Window</strong>
                    <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem", color: "#64748b" }}>
                      Candidates can start anytime within the schedule window. Each candidate gets the full duration from when they start.
                    </p>
                  </label>
                </div>

                {/* Schedule Times */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
                  {examMode === "strict" ? (
                    <>
                      {/* Strict Mode: Start Time + Duration */}
                      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                            Start Time (IST) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  required
                            style={{ width: "100%", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}
                />
                <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
                  Indian Standard Time (IST) - UTC+5:30
                </p>
              </div>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                            Duration (minutes) <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          {enablePerSectionTimers ? (() => {
                            const totalSectionTime = Object.values(sectionTimers).reduce((sum, time) => sum + time, 0);
                            return (
                              <div>
                                <input
                                  type="number"
                                  value={totalSectionTime > 0 ? totalSectionTime : duration}
                                  readOnly
                                  disabled
                                  placeholder="Auto-calculated"
                                  min={1}
                                  required
                                  style={{ 
                                    width: "100%", 
                                    padding: "0.75rem", 
                                    border: "1px solid #e2e8f0", 
                                    borderRadius: "0.5rem",
                                    backgroundColor: "#f1f5f9",
                                    cursor: "not-allowed",
                                    color: "#64748b"
                                  }}
                                />
                                <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
                                  Auto-calculated from section timers in Review Questions. Total: {totalSectionTime} minutes
                                </p>
                              </div>
                            );
                          })() : (
                            <input
                              type="number"
                              value={duration}
                              onChange={(e) => setDuration(e.target.value)}
                              placeholder="e.g., 80"
                              min={1}
                              required
                              style={{ width: "100%", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}
                            />
                          )}
                        </div>
                      </div>
                      {startTime && duration && (
                        <div style={{ padding: "0.75rem", backgroundColor: "#f0fdf4", borderRadius: "0.5rem", fontSize: "0.875rem", color: "#059669" }}>
                          <strong>Assessment will end at:</strong> {
                            new Date(new Date(startTime).getTime() + parseInt(duration || "0") * 60000).toLocaleString()
                          }
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {/* Flexible Mode: Start Time + End Time + Duration */}
                      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                            Schedule Start Time (IST) <span style={{ color: "#ef4444" }}>*</span>
                          </label>
                          <input
                            type="datetime-local"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            required
                            style={{ width: "100%", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}
                          />
                          <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
                            Indian Standard Time (IST) - UTC+5:30
                          </p>
                        </div>
                        <div style={{ flex: 1, minWidth: "200px" }}>
                          <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                            Schedule End Time (IST) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  required
                            style={{ width: "100%", padding: "0.75rem", border: `1px solid ${startTime && endTime && new Date(endTime) <= new Date(startTime) ? "#ef4444" : "#e2e8f0"}`, borderRadius: "0.5rem" }}
                />
                <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
                  Indian Standard Time (IST) - UTC+5:30
                </p>
                {startTime && endTime && new Date(endTime) <= new Date(startTime) && (
                  <p style={{ fontSize: "0.875rem", color: "#dc2626", marginTop: "0.5rem", fontWeight: 600 }}>
                    ⚠️ Please choose an end time greater than the start time
                  </p>
                )}
              </div>
                  </div>
                      <div style={{ flex: 1, minWidth: "200px" }}>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                          Duration (minutes) <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        {enablePerSectionTimers ? (() => {
                          const totalSectionTime = Object.values(sectionTimers).reduce((sum, time) => sum + time, 0);
                          return (
                            <div>
                              <input
                                type="number"
                                value={totalSectionTime > 0 ? totalSectionTime : duration}
                                readOnly
                                disabled
                                placeholder="Auto-calculated"
                                min={1}
                                required
                                style={{ 
                                  width: "100%", 
                                  maxWidth: "300px", 
                                  padding: "0.75rem", 
                                  border: "1px solid #e2e8f0", 
                                  borderRadius: "0.5rem",
                                  backgroundColor: "#f1f5f9",
                                  cursor: "not-allowed",
                                  color: "#64748b"
                                }}
                              />
                              <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
                                Auto-calculated from section timers in Review Questions. Total: {totalSectionTime} minutes
                              </p>
                              <p style={{ marginTop: "0.25rem", fontSize: "0.875rem", color: "#64748b" }}>
                                Candidates can start the assessment anytime between the schedule start and end times. Once started, they have this duration to complete the assessment.
                              </p>
                            </div>
                          );
                        })() : (
                          <>
                            <input
                              type="number"
                              value={duration}
                              onChange={(e) => setDuration(e.target.value)}
                              placeholder="e.g., 70"
                              min={1}
                              required
                              style={{ width: "100%", maxWidth: "300px", padding: "0.75rem", border: "1px solid #e2e8f0", borderRadius: "0.5rem" }}
                            />
                            <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
                              Candidates can start the assessment anytime between the schedule start and end times. Once started, they have this duration to complete the assessment.
                            </p>
                          </>
                        )}
                    </div>
                    </>
                  )}
                    </div>
                      </div>

              {/* Validation Warning: Section Timers vs Duration */}
              {enablePerSectionTimers && duration && parseInt(duration) > 0 && (() => {
                const totalSectionTime = Object.values(sectionTimers).reduce((sum, time) => sum + time, 0);
                const examDuration = parseInt(duration);
                const exceedsDuration = totalSectionTime > examDuration;
                
                if (exceedsDuration) {
                return (
                  <div style={{ 
                      marginTop: "1.5rem",
                    padding: "1rem",
                      backgroundColor: "#fef2f2",
                      border: "2px solid #ef4444",
                    borderRadius: "0.5rem"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                        <span style={{ fontSize: "1.25rem" }}>⚠️</span>
                        <strong style={{ color: "#dc2626" }}>
                          Section Timers Exceed Exam Duration
                      </strong>
                    </div>
                    <div style={{ fontSize: "0.875rem", color: "#64748b", marginLeft: "1.75rem" }}>
                        <div>Total Section Time: <strong>{totalSectionTime} minutes</strong></div>
                        <div>Exam Duration: <strong>{examDuration} minutes</strong></div>
                        <div style={{ marginTop: "0.5rem", fontWeight: 600, color: "#dc2626" }}>
                          ⚠️ Total section timers ({totalSectionTime} minutes) exceed the exam duration ({examDuration} minutes). 
                          Please increase the exam duration or reduce section timers in Review Questions.
                      </div>
                    </div>
                  </div>
                );
                }
                return null;
              })()}

              {/* Proctoring Settings */}
              <div
                style={{
                  marginTop: "2rem",
                  padding: "1.5rem",
                  backgroundColor: "#f8fafc",
                  borderRadius: "0.75rem",
                  border: "2px solid #e2e8f0",
                }}
              >
                <h3
                  style={{
                    marginBottom: "1rem",
                    fontSize: "1.125rem",
                    color: "#1a1625",
                    fontWeight: 600,
                  }}
                >
                  Proctoring Settings
                </h3>

                {/* AI Proctoring Checkbox */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    color: "#1e293b",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={proctoringSettings.aiProctoringEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setProctoringSettings((prev) => ({
                        ...prev,
                        aiProctoringEnabled: checked,
                        faceMismatchEnabled: checked ? prev.faceMismatchEnabled : false, // Disable face mismatch if AI Proctoring is disabled
                      }));
                    }}
                    style={{ 
                      width: "18px", 
                      height: "18px", 
                      cursor: "pointer",
                    }}
                  />
                  <span>
                    Enable AI Proctoring (camera-based: no face, multiple faces, gaze
                    away)
                  </span>
                </label>

                {/* Face Mismatch Detection Sub-checkbox (only visible when AI Proctoring is enabled) */}
                {proctoringSettings.aiProctoringEnabled && (
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      cursor: "pointer",
                      fontSize: "0.875rem",
                      color: "#1e293b",
                      marginTop: "0.5rem",
                      marginLeft: "2rem",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={proctoringSettings.faceMismatchEnabled}
                      onChange={(e) => {
                        setProctoringSettings((prev) => ({
                          ...prev,
                          faceMismatchEnabled: e.target.checked,
                        }));
                      }}
                      style={{ 
                        width: "18px", 
                        height: "18px", 
                        cursor: "pointer",
                      }}
                    />
                    <span>
                      Enable Face Mismatch Detection (detects if candidate's face changes during assessment)
                    </span>
                  </label>
                )}

                {/* Live Proctoring Checkbox */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                    fontSize: "0.875rem",
                    color: "#1e293b",
                    marginTop: "1rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={proctoringSettings.liveProctoringEnabled}
                    onChange={(e) => {
                      setProctoringSettings((prev) => ({
                        ...prev,
                        liveProctoringEnabled: e.target.checked,
                      }));
                    }}
                    style={{ 
                      width: "18px", 
                      height: "18px", 
                      cursor: "pointer",
                    }}
                  />
                  <span>
                    Live Proctoring (webcam + screen streaming)
                  </span>
                </label>
              </div>

              {/* Candidate Requirements */}
              <div style={{ 
                marginTop: "2rem", 
                padding: "1.5rem", 
                backgroundColor: "#f8fafc", 
                borderRadius: "0.75rem", 
                border: "2px solid #e2e8f0" 
              }}>
                <h3 style={{ marginBottom: "1rem", fontSize: "1.125rem", color: "#1a1625", fontWeight: 600 }}>
                  Candidate Requirements
                </h3>

                <div>
                  <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b", fontSize: "0.875rem" }}>
                    Required Information
                  </label>
                  <div style={{ display: "grid", gap: "0.75rem" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={candidateRequirements.requireEmail}
                        onChange={(e) => setCandidateRequirements(prev => ({ ...prev, requireEmail: e.target.checked }))}
                        style={{ width: "18px", height: "18px", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "0.875rem", color: "#1e293b" }}>Require Email</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={candidateRequirements.requireName}
                        onChange={(e) => setCandidateRequirements(prev => ({ ...prev, requireName: e.target.checked }))}
                        style={{ width: "18px", height: "18px", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "0.875rem", color: "#1e293b" }}>Require Name</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={candidateRequirements.requirePhone}
                        onChange={(e) => setCandidateRequirements(prev => ({ ...prev, requirePhone: e.target.checked }))}
                        style={{ width: "18px", height: "18px", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "0.875rem", color: "#1e293b" }}>Require Phone Number</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={candidateRequirements.requireResume}
                        onChange={(e) => setCandidateRequirements(prev => ({ ...prev, requireResume: e.target.checked }))}
                        style={{ width: "18px", height: "18px", cursor: "pointer" }}
                      />
                      <span style={{ fontSize: "0.875rem", color: "#1e293b" }}>Require Resume Upload</span>
                    </label>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
                <button
                  type="button"
                  onClick={() => setCurrentStation(3)}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    // Validation based on exam mode
                    if (examMode === "strict") {
                      if (!startTime || !duration) {
                        setError("Please set start time and duration");
                        return;
                      }
                      if (parseInt(duration) < 1) {
                        setError("Duration must be at least 1 minute");
                        return;
                      }
                    } else {
                      // Flexible mode
                      if (!startTime || !endTime || !duration) {
                        setError("Please set start time, end time, and duration");
                      return;
                    }
                    if (new Date(startTime) >= new Date(endTime)) {
                      setError("End time must be after start time");
                      return;
                      }
                      if (parseInt(duration) < 1) {
                        setError("Duration must be at least 1 minute");
                        return;
                      }
                    }
                    
                    // Validate section timers if enabled
                    if (enablePerSectionTimers) {
                      const totalSectionTime = Object.values(sectionTimers).reduce((sum, time) => sum + time, 0);
                      const examDuration = parseInt(duration);
                      if (totalSectionTime > examDuration) {
                        setError(`Total section timers (${totalSectionTime} minutes) exceed the exam duration (${examDuration} minutes). Please increase the exam duration or reduce section timers.`);
                        return;
                      }
                    }
                    
                    // Save schedule to draft
                    try {
                          if (assessmentId) {
                        const scheduleData: any = {
                          startTime: examMode === "strict" ? startTime : startTime,
                          duration: parseInt(duration),
                          examMode,
                                visibilityMode,
                                candidateRequirements,
                                proctoringSettings,
                        };
                        
                        // Only include endTime for flexible mode
                        if (examMode === "flexible" && endTime) {
                          scheduleData.endTime = endTime;
                        }
                        
                        await updateDraftMutation.mutateAsync({
                          assessmentId,
                          schedule: scheduleData,
                            });
                          }
                    } catch (err: any) {
                      console.error("Error saving schedule:", err);
                      setError(err.response?.data?.message || "Failed to save schedule");
                      return;
                    }
                    
                    setError(null);
                    setCurrentStation(5);
                  }}
                  className="btn-primary"
                  style={{ flex: 1 }}
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Station 5: Add Candidates */}
          {currentStation === 5 && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div style={{ flex: 1 }}>
              <h1 style={{ marginBottom: "0.5rem", fontSize: "2rem", color: "#1a1625", fontWeight: 700 }}>
                Add Candidates
              </h1>
              <p style={{ color: "#6b6678", marginBottom: "2rem", fontSize: "1rem" }}>
                Configure exam access mode and add candidates who will take this assessment.
              </p>
                </div>
                <button
                  type="button"
                  onClick={handleBackToDashboard}
                  className="btn-secondary"
                  style={{ 
                    marginLeft: "1rem",
                    whiteSpace: "nowrap",
                    padding: "0.75rem 1.5rem",
                    fontSize: "0.875rem"
                  }}
                >
                  Back to Dashboard
                </button>
              </div>

              {/* Access Mode Selection */}
              <div style={{ marginBottom: "2rem", padding: "1.5rem", backgroundColor: "#f8fafc", borderRadius: "0.75rem", border: "2px solid #e2e8f0" }}>
                <label style={{ display: "block", marginBottom: "1rem", fontWeight: 600, color: "#1e293b", fontSize: "1.125rem" }}>
                  Exam Access Mode
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {(() => {
                    const currentAccessMode: "public" | "private" = accessMode;
                    const isPublic = currentAccessMode === "public";
                    return (
                      <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "1rem", backgroundColor: isPublic ? "#eff6ff" : "#ffffff", borderRadius: "0.5rem", border: `2px solid ${isPublic ? "#3b82f6" : "#e2e8f0"}` }}>
                        <input
                          type="radio"
                          name="accessMode"
                          value="public"
                          checked={isPublic}
                          onChange={(e) => {
                            setAccessMode("public");
                            if (assessmentId) {
                              updateDraftMutation.mutate({
                                assessmentId,
                                accessMode: "public",
                              }, {
                                onError: (err) => console.error("Error updating access mode:", err)
                              });
                            }
                          }}
                          style={{ width: "18px", height: "18px", cursor: "pointer" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: "0.25rem" }}>
                            Public Exam Link
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                            Anyone with the link can access. Candidate enters name + email when starting the exam.
                          </div>
                        </div>
                      </label>
                    );
                  })()}
                  {(() => {
                    const currentAccessMode: "public" | "private" = accessMode;
                    const isPrivate = currentAccessMode === "private";
                    return (
                      <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", padding: "1rem", backgroundColor: isPrivate ? "#eff6ff" : "#ffffff", borderRadius: "0.5rem", border: `2px solid ${isPrivate ? "#3b82f6" : "#e2e8f0"}` }}>
                        <input
                          type="radio"
                          name="accessMode"
                          value="private"
                          checked={isPrivate}
                          onChange={(e) => {
                            setAccessMode("private");
                            if (assessmentId) {
                              updateDraftMutation.mutate({
                                assessmentId,
                                accessMode: "private",
                              }, {
                                onError: (err) => console.error("Error updating access mode:", err)
                              });
                            }
                          }}
                          style={{ width: "18px", height: "18px", cursor: "pointer" }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: "0.25rem" }}>
                            Private Candidate Access
                          </div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
                            Only pre-added candidates may access. Exact name and email match required.
                          </div>
                        </div>
                      </label>
                    );
                  })()}
                </div>
              </div>

              {/* Private Mode: Candidate Management */}
              {(() => {
                const currentAccessMode: "public" | "private" = accessMode;
                return currentAccessMode === "private" ? (
                  <>
              <div style={{ marginBottom: "2rem" }}>
                <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                  Bulk Upload (CSV)
                </label>
                <div style={{ 
                  marginBottom: "1.5rem", 
                  padding: "1rem", 
                  backgroundColor: "#f8fafc", 
                  borderRadius: "0.5rem", 
                  border: "1px solid #e2e8f0" 
                }}>
                  <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.875rem", color: "#64748b" }}>
                    Upload a CSV file with columns: <strong>name</strong> and <strong>email</strong>
                  </p>
                  {(() => {
                    const currentAccessMode: "public" | "private" = accessMode;
                    const isPublicMode = currentAccessMode === "public";
                    return (
                      <>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                          disabled={uploadingCsv || isPublicMode}
                    style={{ display: "none" }}
                    id="csv-upload-input"
                  />
                  <label
                    htmlFor="csv-upload-input"
                    style={{
                      display: "inline-block",
                      padding: "0.75rem 1.5rem",
                            backgroundColor: (uploadingCsv || isPublicMode) ? "#94a3b8" : "#3b82f6",
                      color: "#ffffff",
                      borderRadius: "0.5rem",
                            cursor: (uploadingCsv || isPublicMode) ? "not-allowed" : "pointer",
                      fontSize: "0.875rem",
                      fontWeight: 600,
                      transition: "background-color 0.2s",
                            opacity: isPublicMode ? 0.6 : 1,
                    }}
                  >
                    {uploadingCsv ? "Uploading..." : "Choose CSV File"}
                  </label>
                      </>
                    );
                  })()}
                  {uploadingCsv && (
                    <span style={{ marginLeft: "0.75rem", fontSize: "0.875rem", color: "#64748b" }}>
                      Processing CSV file...
                    </span>
                  )}
                  {(() => {
                    const currentAccessMode: "public" | "private" = accessMode;
                    return currentAccessMode === "public" ? (
                      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b", fontStyle: "italic" }}>
                        Bulk upload is disabled in Public mode
                      </p>
                    ) : null;
                  })()}
                </div>
                </div>

                <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                  Add Candidate (Manual)
                </label>
                    {(() => {
                      const currentAccessMode: "public" | "private" = accessMode;
                      const isPublicMode = currentAccessMode === "public";
                    // Hide Add Candidate section after finalization
                    if (isFinalized) {
                      return null;
                    }
                      return (
                        <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "0.5rem", marginBottom: "1rem" }}>
                            <div>
                  <input
                                type="text"
                                value={candidateName}
                                onChange={(e) => {
                                  setCandidateName(e.target.value);
                                  setEmailValidationError(null);
                                }}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCandidate();
                      }
                    }}
                                placeholder="Full Name"
                                disabled={isPublicMode}
                    style={{
                                  width: "100%",
                      padding: "0.75rem",
                      border: "1px solid #e2e8f0",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                                  opacity: isPublicMode ? 0.6 : 1,
                                  cursor: isPublicMode ? "not-allowed" : "text",
                    }}
                  />
                            </div>
                            <div>
                  <input
                                type="email"
                                value={candidateEmail}
                                onChange={(e) => {
                                  setCandidateEmail(e.target.value);
                                  // Real-time email validation
                                  const email = e.target.value.trim();
                                  if (email && !validateEmail(email)) {
                                    setEmailValidationError("Invalid email format");
                                  } else {
                                    setEmailValidationError(null);
                                  }
                                }}
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddCandidate();
                      }
                    }}
                                placeholder="Email Address"
                                disabled={isPublicMode}
                    style={{
                                  width: "100%",
                      padding: "0.75rem",
                                  border: `1px solid ${emailValidationError ? "#ef4444" : "#e2e8f0"}`,
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                                  opacity: isPublicMode ? 0.6 : 1,
                                  cursor: isPublicMode ? "not-allowed" : "text",
                                }}
                              />
                              {emailValidationError && (
                                <p style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#ef4444" }}>
                                  {emailValidationError}
                                </p>
                              )}
                            </div>
                  <button
                    type="button"
                    onClick={handleAddCandidate}
                    className="btn-secondary"
                              disabled={isPublicMode || !candidateEmail.trim() || !candidateName.trim() || !!emailValidationError}
                              style={{ 
                                marginTop: 0, 
                                whiteSpace: "nowrap", 
                                padding: "0.75rem 1.5rem",
                                opacity: (isPublicMode || !candidateEmail.trim() || !candidateName.trim() || !!emailValidationError) ? 0.6 : 1,
                                cursor: (isPublicMode || !candidateEmail.trim() || !candidateName.trim() || !!emailValidationError) ? "not-allowed" : "pointer",
                              }}
                  >
                    Add
                  </button>
                </div>
                          {isPublicMode && (
                            <p style={{ fontSize: "0.875rem", color: "#64748b", fontStyle: "italic" }}>
                              Manual candidate addition is disabled in Public mode
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : null;
              })()}

              {/* Public Mode: Show public link info */}
              {(() => {
                const currentAccessMode: "public" | "private" = accessMode;
                return currentAccessMode === "public" ? (
                  <div style={{ marginBottom: "2rem", padding: "1.5rem", backgroundColor: "#f0fdf4", borderRadius: "0.75rem", border: "2px solid #10b981" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "1.25rem" }}>ℹ️</span>
                      <strong style={{ color: "#059669" }}>
                        Public Exam Mode
                      </strong>
              </div>
                    <div style={{ fontSize: "0.875rem", color: "#64748b", marginLeft: "1.75rem" }}>
                      <div>Anyone with the exam link can access the assessment.</div>
                      <div style={{ marginTop: "0.5rem" }}>
                        Candidates will enter their name and email when starting the exam. Email format will be validated.
                      </div>
                    </div>
                  </div>
                ) : null;
              })()}

              {candidates.length > 0 && (
                <div style={{ marginBottom: "2rem" }}>
                  <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                    Added Candidates ({candidates.length})
                  </label>
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: "0.75rem", overflow: "hidden" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#f8fafc" }}>
                          <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                            Email
                          </th>
                          <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                            Name
                          </th>
                          {accessMode === "private" && (
                            <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                              Status
                            </th>
                          )}
                          {accessMode === "private" && (
                          <th style={{ padding: "1rem", textAlign: "left", borderBottom: "1px solid #e2e8f0", fontWeight: 600, color: "#1e293b" }}>
                            Actions
                          </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {candidates.map((candidate, index) => (
                          <tr key={index} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "1rem" }}>{candidate.email}</td>
                            <td style={{ padding: "1rem" }}>{candidate.name}</td>
                            {accessMode === "private" && (
                            <td style={{ padding: "1rem" }}>
                                {candidate.invited ? (
                                  <span style={{ fontSize: "0.875rem", color: "#10b981", fontWeight: 600 }}>
                                    ✓ Invited
                                  </span>
                                ) : (
                                  <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                                    Pending
                                  </span>
                                )}
                              </td>
                            )}
                            {accessMode === "private" && (
                              <td style={{ padding: "1rem", display: "flex", gap: "0.5rem" }}>
                                {candidate.invited && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!assessmentId || !assessmentUrl) return;
                                      try {
                                        const response = await sendInvitationsMutation.mutateAsync({
                                          assessmentId: assessmentId || "",
                                          candidates: [{ email: candidate.email, name: candidate.name }],
                                          examUrl: assessmentUrl,
                                          template: invitationTemplate,
                                          forceResend: true, // Allow resending to already-invited candidates
                                        });
                                        if (response?.success) {
                                          // Update invite timestamp
                                          const updatedCandidates = candidates.map(c => 
                                            c.email.toLowerCase() === candidate.email.toLowerCase()
                                              ? { ...c, inviteSentAt: new Date().toISOString() }
                                              : c
                                          );
                                          setCandidates(updatedCandidates);
                                          alert("Invitation resent successfully");
                                        }
                                      } catch (err: any) {
                                        setError("Failed to resend invitation");
                                      }
                                    }}
                                    style={{
                                      background: "none",
                                      border: "1px solid #3b82f6",
                                      color: "#3b82f6",
                                      cursor: "pointer",
                                      fontSize: "0.875rem",
                                      padding: "0.25rem 0.75rem",
                                      borderRadius: "0.375rem",
                                    }}
                                  >
                                    Resend
                                  </button>
                                )}
                              <button
                                type="button"
                                onClick={() => handleRemoveCandidate(candidate.email)}
                                style={{
                                  background: "none",
                                  border: "none",
                                  color: "#ef4444",
                                  cursor: "pointer",
                                  fontSize: "0.875rem",
                                }}
                              >
                                Remove
                              </button>
                            </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Generate URL Section - Hide after finalization */}
              {!isFinalized && !assessmentUrl && (
                <div style={{ marginBottom: "2rem" }}>
                  <button
                    type="button"
                    onClick={handleGenerateUrl}
                    className="btn-primary"
                    disabled={accessMode === "private" && candidates.length === 0}
                    style={{ width: "100%" }}
                  >
                    Generate Assessment URL
                  </button>
                  {accessMode === "private" && candidates.length === 0 && (
                    <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b", textAlign: "center" }}>
                      Please add at least one candidate to generate the URL
                    </p>
                  )}
                </div>
              )}

              {/* Assessment URL Display - Hide after finalization */}
              {!isFinalized && assessmentUrl && (() => {
                const currentAccessMode: "public" | "private" = accessMode;
                const isPublic = currentAccessMode === "public";
                return (
                <div style={{ marginBottom: "2rem", padding: "1.5rem", backgroundColor: "#f8fafc", borderRadius: "0.75rem", border: "1px solid #e2e8f0" }}>
                  <label style={{ display: "block", marginBottom: "0.75rem", fontWeight: 600, color: "#1e293b" }}>
                      {isPublic ? "Public Exam Link" : "Assessment URL"}
                  </label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="text"
                      value={assessmentUrl}
                      readOnly
                      style={{
                        flex: 1,
                        padding: "0.75rem",
                        border: "1px solid #e2e8f0",
                        borderRadius: "0.5rem",
                        fontSize: "1rem",
                        backgroundColor: "#ffffff",
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="btn-secondary"
                      style={{ marginTop: 0, whiteSpace: "nowrap", padding: "0.75rem 1.5rem" }}
                    >
                      Copy URL
                    </button>
                  </div>
                  <p style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.5rem" }}>
                      {isPublic 
                        ? "Share this public link. Anyone with the link can access the assessment."
                        : "Share this URL with all candidates. They will use it to access the assessment."}
                    </p>
                  </div>
                );
              })()}

              {/* Email Invitation Template (Private Mode Only) */}
              {accessMode === "private" && assessmentUrl && candidates.length > 0 && (
                <div style={{ marginBottom: "2rem", padding: "1.5rem", backgroundColor: "#f8fafc", borderRadius: "0.75rem", border: "2px solid #e2e8f0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <label style={{ fontWeight: 600, color: "#1e293b", fontSize: "1.125rem" }}>
                      Email Invitation Template
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowEmailTemplate(!showEmailTemplate)}
                      className="btn-secondary"
                      style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                    >
                      {showEmailTemplate ? "Hide Template" : "Configure Template"}
                    </button>
                  </div>
                  
                  {showEmailTemplate && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                      <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b", fontSize: "0.875rem" }}>
                          Company Logo URL (optional)
                        </label>
                        <input
                          type="url"
                          value={invitationTemplate.logoUrl}
                          onChange={(e) => setInvitationTemplate({ ...invitationTemplate, logoUrl: e.target.value })}
                          placeholder="https://example.com/logo.png"
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.5rem",
                            fontSize: "1rem",
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b", fontSize: "0.875rem" }}>
                          Company Name (optional)
                        </label>
                        <input
                          type="text"
                          value={invitationTemplate.companyName}
                          onChange={(e) => setInvitationTemplate({ ...invitationTemplate, companyName: e.target.value })}
                          placeholder="Your Company Name"
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.5rem",
                            fontSize: "1rem",
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b", fontSize: "0.875rem" }}>
                          Custom Message
                        </label>
                        <textarea
                          value={invitationTemplate.message}
                          onChange={(e) => setInvitationTemplate({ ...invitationTemplate, message: e.target.value })}
                          placeholder="You have been invited to take an assessment..."
                          rows={4}
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.5rem",
                            fontSize: "1rem",
                            fontFamily: "inherit",
                          }}
                        />
                        <p style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#64748b" }}>
                          Available placeholders: {"{{candidate_name}}"}, {"{{candidate_email}}"}, {"{{exam_url}}"}, {"{{company_name}}"}
                        </p>
                      </div>
                      <div>
                        <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b", fontSize: "0.875rem" }}>
                          Footer Message (optional)
                        </label>
                        <input
                          type="text"
                          value={invitationTemplate.footer}
                          onChange={(e) => setInvitationTemplate({ ...invitationTemplate, footer: e.target.value })}
                          placeholder="Thank you for your participation"
                          style={{
                            width: "100%",
                            padding: "0.75rem",
                            border: "1px solid #e2e8f0",
                            borderRadius: "0.5rem",
                            fontSize: "1rem",
                          }}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          // Save template to draft
                          if (assessmentId) {
                            try {
                              await updateDraftMutation.mutateAsync({
                                assessmentId,
                                invitationTemplate: invitationTemplate,
                              });
                              setError(null);
                            } catch (err: any) {
                              setError("Failed to save template");
                            }
                          }
                        }}
                        className="btn-secondary"
                        style={{ alignSelf: "flex-start", padding: "0.75rem 1.5rem" }}
                      >
                        Save Template
                      </button>

                      {/* Send Invitations Button - Moved inside Email Invitation Template card */}
                  <button
                    type="button"
                    onClick={async () => {
                      if (!assessmentId || !assessmentUrl) {
                        setError("Assessment URL not generated");
                        return;
                      }
                      setError(null);
                      try {
                        // Only send to candidates who haven't been invited yet
                        const candidatesToInvite = candidates.filter(c => !c.invited);
                        
                        if (candidatesToInvite.length === 0) {
                          alert("All candidates have already been sent invitations.");
                          return;
                        }
                        
                        const response = await sendInvitationsMutation.mutateAsync({
                          assessmentId: assessmentId || "",
                          candidates: candidatesToInvite.map(c => ({ email: c.email, name: c.name })),
                          template: invitationTemplate,
                        });
                        if (response?.success) {
                          setError(null);
                          const data = response.data || {};
                          const sentCount = data.sentCount || 0;
                          const skippedCount = data.skippedCount || 0;
                          
                          // Update candidates with invite status (only for newly sent)
                          const sentEmails = new Set(
                            candidatesToInvite
                              .filter((_, idx) => idx < sentCount)
                              .map(c => c.email.toLowerCase())
                          );
                          
                          const updatedCandidates = candidates.map(c => {
                            if (sentEmails.has(c.email.toLowerCase())) {
                              return {
                                ...c,
                                invited: true,
                                inviteSentAt: new Date().toISOString(),
                              };
                            }
                            return c;
                          });
                          setCandidates(updatedCandidates);
                          
                          let message = `Invitations sent successfully to ${sentCount} candidate(s)`;
                          if (skippedCount > 0) {
                            message += `. ${skippedCount} candidate(s) already invited (skipped)`;
                          }
                          alert(message);
                        }
                      } catch (err: any) {
                        setError(err.response?.data?.message || "Failed to send invitations");
                      }
                    }}
                    className="btn-primary"
                        disabled={candidates.length === 0}
                        style={{ 
                          width: "100%", 
                          padding: "0.75rem 1.5rem", 
                          fontSize: "1rem",
                          marginTop: "0.5rem"
                        }}
                  >
                    Send Invitations via Email
                  </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
                <button
                  type="button"
                  onClick={() => setCurrentStation(4)}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!assessmentUrl) {
                      setError("Please generate the assessment URL first");
                      return;
                    }
                    // Only require candidates in private mode
                    if (accessMode === "private" && candidates.length === 0) {
                      setError("Please add at least one candidate for private access mode");
                      return;
                    }
                    setError(null);
                    setLoading(true);
                    try {
                      if (assessmentId) {
                        // Normalize datetime strings to ISO format with seconds and timezone
                        // Same normalization as in handleGenerateUrl
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

                        // Prepare schedule data with normalized times
                        const scheduleData: any = {
                          examMode,
                          duration: parseInt(duration || "0"),
                        };
                        
                        // Add startTime if provided (normalized to UTC)
                        if (startTime) {
                          scheduleData.startTime = normalizeDateTime(startTime);
                        }
                        
                        // Only include endTime based on exam mode (normalized to UTC)
                        if (examMode === "flexible" && endTime) {
                          scheduleData.endTime = normalizeDateTime(endTime);
                        }
                        
                        // Include section timers if enabled
                        if (enablePerSectionTimers) {
                          scheduleData.enablePerSectionTimers = true;
                          scheduleData.sectionTimers = sectionTimers;
                        }

                        // Save final state and mark as complete
                        await updateScheduleAndCandidatesMutation.mutateAsync({
                          assessmentId,
                          ...scheduleData,
                          candidates: accessMode === "private" ? candidates : [],
                          assessmentUrl: assessmentUrl,
                          token: assessmentUrl.split("/").pop() || "",
                          accessMode: accessMode,
                          invitationTemplate: accessMode === "private" ? invitationTemplate : undefined,
                          complete: true, // Mark as complete to set status = "active"
                        });
                        
                        // Auto-send invitations if not sent manually (private mode only)
                        if (accessMode === "private" && candidates.length > 0) {
                          const candidatesNotInvited = candidates.filter(c => !c.invited);
                          if (candidatesNotInvited.length > 0) {
                            try {
                              // Use default template if no custom template configured
                              const templateToUse = invitationTemplate.logoUrl || invitationTemplate.companyName || invitationTemplate.message || invitationTemplate.footer
                                ? invitationTemplate
                                : {
                                    logoUrl: "",
                                    companyName: "",
                                    message: "You have been invited to take an assessment. Please click the link below to start.",
                                    footer: "",
                                    sentBy: "AI Assessment Platform"
                                  };
                              
                              await sendInvitationsMutation.mutateAsync({
                                assessmentId: assessmentId || "",
                                candidates: candidatesNotInvited.map(c => ({ email: c.email, name: c.name })),
                                template: templateToUse,
                              });
                              
                              // Update local state
                              const updatedCandidates = candidates.map(c => {
                                if (candidatesNotInvited.some(ni => ni.email.toLowerCase() === c.email.toLowerCase())) {
                                  return {
                                    ...c,
                                    invited: true,
                                    inviteSentAt: new Date().toISOString(),
                                  };
                                }
                                return c;
                              });
                              setCandidates(updatedCandidates);
                            } catch (inviteErr: any) {
                              // Log error but don't block finalization
                              console.error("Error auto-sending invitations:", inviteErr);
                              // Continue with finalization even if invitations fail
                            }
                          }
                        }
                      }
                      // Force refresh dashboard by navigating with a timestamp query to bypass cache
                      router.push("/dashboard?refresh=" + Date.now());
                    } catch (err: any) {
                      setError("Failed to save. Please try again.");
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="btn-primary"
                  disabled={(() => {
                    const currentAccessMode: "public" | "private" = accessMode;
                    return !assessmentUrl || (currentAccessMode === "private" && candidates.length === 0) || loading;
                  })()}
                  style={{ flex: 1 }}
                >
                  {loading ? "Completing..." : "Complete Assessment"}
                </button>
              </div>
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
    </div>
    </>
  );
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth;


