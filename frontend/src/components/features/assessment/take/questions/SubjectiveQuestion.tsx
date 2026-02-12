/**
 * SubjectiveQuestion Component
 * 
 * Renders a Subjective/Text Answer Question
 */

import React from 'react';

interface SubjectiveQuestionProps {
  question: {
    _id?: string;
    id?: string;
    questionText?: string;
    title?: string;
    score?: number;
    difficulty?: string;
  };
  answer: string;
  onAnswerChange: (answer: string) => void;
  disabled?: boolean;
  isPseudocode?: boolean;
}

export function SubjectiveQuestion({ 
  question, 
  answer, 
  onAnswerChange, 
  disabled = false,
  isPseudocode = false,
}: SubjectiveQuestionProps) {
  const questionId = question._id || question.id || '';
  const questionText = question.questionText || question.title || '';

  return (
    <div>
      {/* Question Header */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
        {question.score && (
          <span style={{
            padding: "0.25rem 0.75rem",
            backgroundColor: "#10b981",
            color: "#ffffff",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}>
            {question.score} pts
          </span>
        )}
        {question.difficulty && (
          <span style={{
            padding: "0.25rem 0.75rem",
            backgroundColor: "#e0e7ff",
            color: "#4338ca",
            borderRadius: "9999px",
            fontSize: "0.75rem",
            fontWeight: 600,
          }}>
            {question.difficulty}
          </span>
        )}
      </div>

      {/* Question Text */}
      <div style={{ 
        padding: "1.5rem",
        backgroundColor: "#f8fafc",
        borderRadius: "0.5rem",
        border: "1px solid #e2e8f0",
        marginBottom: "1rem",
      }}>
        <p style={{ color: "#1a1625", fontSize: "1rem", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
          {questionText}
        </p>
      </div>

      {/* Answer Input */}
      <div style={{ marginBottom: "1.5rem" }}>
        <textarea
          value={answer}
          disabled={disabled}
          onChange={(e) => !disabled && onAnswerChange(e.target.value)}
          placeholder="Enter your answer here..."
          style={{
            width: "100%",
            minHeight: "200px",
            padding: "1rem",
            border: "1px solid #e2e8f0",
            borderRadius: "0.5rem",
            fontSize: "0.875rem",
            fontFamily: isPseudocode ? "monospace" : "inherit",
            resize: "vertical",
            opacity: disabled ? 0.6 : 1,
            cursor: disabled ? "not-allowed" : "text",
            backgroundColor: disabled ? "#f3f4f6" : "#ffffff",
          }}
        />
      </div>
    </div>
  );
}


