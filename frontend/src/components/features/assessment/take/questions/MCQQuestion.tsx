import React from 'react';

<<<<<<< HEAD
interface MCQQuestionProps {
  question: {
    _id?: string;
    id?: string;
    questionText?: string;
    title?: string;
    options?: string[];
    score?: number;
  };
  answer: string | null | undefined;
  onAnswerChange: (answer: string) => void;
  disabled?: boolean;
}

export function MCQQuestion({ question, answer, onAnswerChange, disabled = false }: MCQQuestionProps) {
  const questionId = question._id || question.id || '';
  const questionText = question.questionText || question.title || '';
  const options = question.options || [];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{questionText}</p>
      </div>
      <div>
        {options.map((opt, idx) => (
          <label key={idx} style={{ display: 'block', marginBottom: 8, cursor: disabled ? 'not-allowed' : 'pointer' }}>
            <input
              type="radio"
              name={questionId}
              value={opt}
              disabled={disabled}
              checked={answer === opt}
              onChange={() => !disabled && onAnswerChange(opt)}
              style={{ marginRight: 8 }}
            />
            {opt}
          </label>
        ))}
      </div>
    </div>
  );
}
=======
type MCQOption = string | { label: string; value?: string };

interface MCQQuestionProps {
  question: {
    id?: string;
    title?: string;
    questionText: string;
    options: MCQOption[];
    score?: number;
    difficulty?: string;
  };
  answer?: string;
  onAnswerChange?: (value: string) => void;
  disabled?: boolean;
}

export const MCQQuestion: React.FC<MCQQuestionProps> = ({
  question,
  answer,
  onAnswerChange,
  disabled = false,
}) => {
  const { id, title, questionText, options, score, difficulty } = question;

  const handleChange = (value: string) => {
    if (disabled) return;
    onAnswerChange?.(value);
  };

  return (
    <div
      style={{
        borderRadius: '0.75rem',
        border: '1px solid #e5e7eb',
        padding: '1.5rem',
        backgroundColor: disabled ? '#f9fafb' : '#ffffff',
      }}
    >
      {/* Meta */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
          gap: '0.75rem',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {title && (
            <h3
              style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 600,
                color: '#111827',
              }}
            >
              {title}
            </h3>
          )}
          <p
            style={{
              margin: 0,
              fontSize: '0.95rem',
              color: '#374151',
              whiteSpace: 'pre-wrap',
            }}
          >
            {questionText}
          </p>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: '0.25rem',
            fontSize: '0.75rem',
          }}
        >
          {typeof score === 'number' && (
            <span
              style={{
                padding: '0.1rem 0.5rem',
                borderRadius: '999px',
                backgroundColor: '#ecfdf5',
                color: '#047857',
                fontWeight: 500,
              }}
            >
              {score} pts
            </span>
          )}
          {difficulty && (
            <span
              style={{
                padding: '0.1rem 0.5rem',
                borderRadius: '999px',
                backgroundColor: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 500,
                textTransform: 'capitalize',
              }}
            >
              {difficulty}
            </span>
          )}
        </div>
      </div>

      {/* Options */}
      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {options.map((opt, index) => {
          const label = typeof opt === 'string' ? opt : opt.label;
          const value = typeof opt === 'string' ? opt : opt.value ?? opt.label;
          const optionId = `${id || 'mcq'}-option-${index}`;

          const checked = answer === value;

          return (
            <label
              key={optionId}
              htmlFor={optionId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.6rem 0.75rem',
                borderRadius: '0.5rem',
                border: checked ? '1px solid #4ade80' : '1px solid #e5e7eb',
                backgroundColor: checked ? '#f0fdf4' : '#ffffff',
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'background-color 0.15s ease, border-color 0.15s ease',
              }}
            >
              <input
                id={optionId}
                type="radio"
                name={id || 'mcq'}
                value={value}
                disabled={disabled}
                checked={checked}
                onChange={() => handleChange(value)}
                style={{ margin: 0 }}
              />
              <span style={{ fontSize: '0.95rem', color: '#111827' }}>{label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};


>>>>>>> dev
