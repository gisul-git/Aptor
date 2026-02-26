import React from 'react';
import { WaitingScreen } from './status/WaitingScreen';
import { LoadingScreen } from './status/LoadingScreen';

// TypeScript interfaces
interface AssessmentLayoutProps {
  header?: React.ReactNode;
  sidebar?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  isFullscreen?: boolean;
}

interface AssessmentHeaderProps {
  title?: string;
  candidateName?: string | null;
  timeRemaining?: number;
  totalTime?: number;
  onSubmit?: () => void;
  isSubmitting?: boolean;
}

interface SectionSidebarProps {
  sections: any[];
  currentSectionId: string;
  currentQuestionId: string;
  onSectionChange?: (sectionId: string) => void;
  onQuestionChange?: (sectionId: string, questionId: string) => void;
  getSectionName?: (section: any) => string;
}

interface QuestionRendererProps {
  question: any;
  answer?: any;
  onChange?: (questionId: string, answer: any, ...args: any[]) => void;
  onRun?: (questionId: string, ...args: any[]) => void | Promise<any>;
  disabled?: boolean;
}

interface QuestionNavigationProps {
  currentQuestionNumber: number;
  totalQuestions: number;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  onPrevious: () => void;
  onNext: () => void;
  showSaveAndNext?: boolean;
  onSaveAndNext?: () => void;
  disabled?: boolean;
}

// Component implementations
export function AssessmentLayout({ header, sidebar, footer, children, isFullscreen }: AssessmentLayoutProps) {
  return (
    <div className={isFullscreen ? 'w-full h-full' : ''}>
      <div>{header}</div>
      <div style={{ display: 'flex', gap: 16 }}>
        <aside style={{ width: 260 }}>{sidebar}</aside>
        <main style={{ flex: 1 }}>{children}</main>
      </div>
      <div>{footer}</div>
    </div>
  );
}

export function AssessmentHeader({ title, candidateName, timeRemaining, totalTime, onSubmit, isSubmitting }: AssessmentHeaderProps) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <div style={{ fontSize: 12, color: '#6b7280' }}>{candidateName}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {typeof timeRemaining !== 'undefined' && <div style={{ fontSize: 12 }}>{timeRemaining} sec</div>}
        <button onClick={onSubmit} disabled={isSubmitting}>Submit</button>
      </div>
    </div>
  );
}

export function SectionSidebar({ sections, currentSectionId, currentQuestionId, onSectionChange, onQuestionChange, getSectionName }: SectionSidebarProps) {
  return (
    <div>
      {Array.isArray(sections) && sections.map((s: any) => (
        <div key={s.id || s._id} style={{ padding: 8 }}>
          <div onClick={() => onSectionChange && onSectionChange(s.id || s._id)} style={{ fontWeight: (s.id || s._id) === currentSectionId ? 'bold' : 'normal' }}>
            {getSectionName ? getSectionName(s) : s.title || s.name || 'Section'}
          </div>
        </div>
      ))}
    </div>
  );
}

export function QuestionRenderer({ question, answer, onChange, onRun, disabled }: QuestionRendererProps) {
  return (
    <div>
      <h3>{question?.title || question?.name || 'Question'}</h3>
      <div style={{ marginTop: 12 }}>{question?.description || question?.body}</div>
      {onRun && (
        <div style={{ marginTop: 12 }}>
          <button onClick={() => onRun(question?.id || question?._id)} disabled={disabled}>Run</button>
        </div>
      )}
    </div>
  );
}

export function QuestionNavigation({ currentQuestionNumber, totalQuestions, isFirstQuestion, isLastQuestion, onPrevious, onNext, showSaveAndNext, onSaveAndNext, disabled }: QuestionNavigationProps) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button onClick={onPrevious} disabled={isFirstQuestion || disabled}>Previous</button>
      {showSaveAndNext ? <button onClick={onSaveAndNext} disabled={disabled}>Save & Next</button> : null}
      <button onClick={onNext} disabled={isLastQuestion || disabled}>Next</button>
      <div style={{ marginLeft: 'auto' }}>{currentQuestionNumber} / {totalQuestions}</div>
    </div>
  );
}

export { WaitingScreen, LoadingScreen };

export default {};
