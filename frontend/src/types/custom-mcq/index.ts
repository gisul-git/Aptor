export interface MCQOption {
  label: string; // A, B, C, D, etc.
  text: string;
}

export interface MCQQuestion {
  id?: string;
  questionType: "mcq";
  section: string;
  question: string;
  options: MCQOption[];
  correctAn: string; // Single: "A" or Multiple: "A,B" or "A,B,C"
  answerType: "single" | "multiple_all" | "multiple_any";
  marks: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SubjectiveQuestion {
  id?: string;
  questionType: "subjective";
  section: string;
  question: string;
  marks: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CodingQuestion {
  id?: string;
  questionType: "coding";
  section: string;
  question: string;
  marks: number;
  createdAt?: string;
  updatedAt?: string;
}

export type Question = MCQQuestion | SubjectiveQuestion | CodingQuestion;

export interface Candidate {
  name: string;
  email: string;
}

export interface CustomMCQAssessment {
  id?: string;
  title: string;
  description?: string;
  questions: Question[];
  candidates?: Candidate[];
  accessMode: "private" | "public";
  examMode: "strict" | "flexible";
  startTime?: string;
  endTime?: string;
  duration?: number; // In minutes, required for both modes
  passPercentage: number;
  status?: string;
  totalQuestions?: number;
  totalMarks?: number;
  submissionsCount?: number;
  createdAt?: string;
  updatedAt?: string;
  schedule?: {
    startTime?: string;
    endTime?: string;
    duration?: number;
    candidateRequirements?: {
      requirePhone?: boolean;
      requireResume?: boolean;
      requireLinkedIn?: boolean;
      requireGithub?: boolean;
    };
  };
  enablePerSectionTimers?: boolean;
  sectionTimers?: {
    MCQ?: number; // Duration in minutes
    Subjective?: number; // Duration in minutes
    Coding?: number; // Duration in minutes
  };
  proctoringSettings?: {
    aiProctoringEnabled?: boolean;
  };
  showResultToCandidate?: boolean;
  accessControl?: {
    canAccess: boolean;
    canStart: boolean;
    waitingForStart: boolean;
    examStarted: boolean;
    timeRemaining: number | null;
    errorMessage: string | null;
  };
}

export interface AssessmentSubmission {
  candidateInfo: {
    name: string;
    email: string;
  };
  score: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  status: string;
  startedAt?: string;
  submittedAt?: string;
  gradingStatus?: "pending" | "grading" | "completed" | "error";
  mcqScore?: number;
  mcqTotal?: number;
  subjectiveScore?: number;
  subjectiveTotal?: number;
  codingScore?: number;
  codingTotal?: number;
}
