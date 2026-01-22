from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class MCQOption(BaseModel):
    """MCQ Option model"""
    label: str  # A, B, C, D, E, etc.
    text: str


class MCQQuestion(BaseModel):
    """MCQ Question model"""
    id: Optional[str] = None
    questionType: str = Field(default="mcq", pattern=r"^mcq$")
    section: str
    question: str
    options: List[MCQOption]  # Dynamic options (A, B, C, D, E, ...)
    correctAn: str  # Single: "A" or Multiple: "A,B" or "A,B,C"
    answerType: str = Field(default="single", pattern=r"^(single|multiple_all|multiple_any)$")
    marks: int = Field(default=1, ge=1)
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class SubjectiveQuestion(BaseModel):
    """Subjective Question model"""
    id: Optional[str] = None
    questionType: str = Field(default="subjective", pattern=r"^subjective$")
    section: str
    question: str
    marks: int = Field(default=1, ge=1)
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class Candidate(BaseModel):
    """Candidate model"""
    name: str
    email: str


class ProctoringSettings(BaseModel):
    aiProctoringEnabled: Optional[bool] = None
    faceMismatchEnabled: Optional[bool] = None
    liveProctoringEnabled: Optional[bool] = None


class CreateCustomMCQAssessmentRequest(BaseModel):
    """Request to create a custom MCQ assessment"""
    title: Optional[str] = None  # Optional for drafts
    description: Optional[str] = None
    questions: Optional[List[Any]] = None  # Can contain both MCQQuestion and SubjectiveQuestion
    candidates: Optional[List[Candidate]] = None
    accessMode: str = Field(default="private", pattern=r"^(private|public)$")
    examMode: str = Field(default="strict", pattern=r"^(strict|flexible)$")
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None  # For flexible mode only, calculated for strict mode
    duration: Optional[int] = None  # In minutes, required for both modes
    passPercentage: int = Field(default=50, ge=0, le=100)
    status: Optional[str] = Field(default="draft", pattern=r"^(draft|scheduled|active)$")  # Draft, scheduled, or active
    currentStation: Optional[int] = Field(default=1, ge=1, le=5)  # Track which station user is on
    enablePerSectionTimers: Optional[bool] = Field(default=False, description="Enable per-section timers")
    sectionTimers: Optional[Dict[str, int]] = Field(default=None, description="Timer durations in minutes for each section (MCQ, Subjective)")
    proctoringSettings: Optional[ProctoringSettings] = None
    showResultToCandidate: Optional[bool] = Field(default=True, description="Whether to show results to candidates after submission")


class UpdateCustomMCQAssessmentRequest(BaseModel):
    """Request to update a custom MCQ assessment"""
    title: Optional[str] = None
    description: Optional[str] = None
    questions: Optional[List[Any]] = None  # Can contain both MCQQuestion and SubjectiveQuestion
    candidates: Optional[List[Candidate]] = None
    accessMode: Optional[str] = Field(default=None, pattern=r"^(private|public)$")
    examMode: Optional[str] = Field(default=None, pattern=r"^(strict|flexible)$")
    startTime: Optional[datetime] = None
    endTime: Optional[datetime] = None  # For flexible mode only, calculated for strict mode
    duration: Optional[int] = None
    passPercentage: Optional[int] = Field(default=None, ge=0, le=100)
    status: Optional[str] = Field(default=None, pattern=r"^(draft|scheduled|active)$")  # Allow status updates
    currentStation: Optional[int] = Field(default=None, ge=1, le=5)  # Track which station user is on
    enablePerSectionTimers: Optional[bool] = Field(default=None, description="Enable per-section timers")
    sectionTimers: Optional[Dict[str, int]] = Field(default=None, description="Timer durations in minutes for each section (MCQ, Subjective)")
    proctoringSettings: Optional[ProctoringSettings] = None
    showResultToCandidate: Optional[bool] = Field(default=None, description="Whether to show results to candidates after submission")


class ValidateCSVRequest(BaseModel):
    """Request to validate CSV file"""
    csvData: List[Dict[str, Any]]


class CandidateSubmission(BaseModel):
    """Candidate submission model"""
    questionId: str
    selectedAnswers: Optional[List[str]] = None  # For MCQ questions: List of selected option labels (e.g., ["A", "B"])
    textAnswer: Optional[str] = None  # For subjective questions: Text answer


class SubmitCustomMCQRequest(BaseModel):
    """Request to submit custom MCQ answers"""
    assessmentId: str
    token: str
    email: str
    name: str
    submissions: List[CandidateSubmission]
    startedAt: Optional[datetime] = None
    submittedAt: Optional[datetime] = None


class SaveAnswerLogRequest(BaseModel):
    """Request to save answer change log for subjective questions"""
    assessmentId: str
    token: str
    email: str
    name: str
    questionId: str
    answer: str
    timestamp: Optional[datetime] = None


class VerifyCustomMCQCandidateRequest(BaseModel):
    """Request to verify candidate access to custom MCQ"""
    assessmentId: str
    token: str
    email: str
    name: str


class SendCustomMCQInvitationRequest(BaseModel):
    """Request to send invitation emails for custom MCQ assessment"""
    assessmentId: str
    candidates: List[Candidate]
    assessmentUrl: str
    template: Optional[Dict[str, Any]] = None


# =====================================================================
# Frontend-compatible schemas for Custom MCQ Assessment API
# =====================================================================

class MCQOption(BaseModel):
    """MCQ option with label and text."""
    label: str = Field(..., description="Option label (A, B, C, D, etc.)")
    text: str = Field(..., description="Option text")


class FrontendMCQQuestion(BaseModel):
    """Frontend MCQ question format."""
    id: Optional[str] = Field(None, description="Question ID")
    questionType: str = Field("mcq", description="Question type: 'mcq'")
    section: str = Field(..., description="Section name")
    question: str = Field(..., description="Question text")
    options: List[MCQOption] = Field(..., description="List of options")
    correctAn: str = Field(..., description="Correct answer(s) - single: 'A' or multiple: 'A,B'")
    answerType: str = Field("single", description="Answer type: 'single', 'multiple_all', or 'multiple_any'")
    marks: int = Field(..., gt=0, description="Marks for this question")
    createdAt: Optional[str] = Field(None, description="Creation timestamp")
    updatedAt: Optional[str] = Field(None, description="Update timestamp")


class FrontendSubjectiveQuestion(BaseModel):
    """Frontend Subjective question format."""
    id: Optional[str] = Field(None, description="Question ID")
    questionType: str = Field("subjective", description="Question type: 'subjective'")
    section: str = Field(..., description="Section name")
    question: str = Field(..., description="Question text")
    marks: int = Field(..., gt=0, description="Marks for this question")
    createdAt: Optional[str] = Field(None, description="Creation timestamp")
    updatedAt: Optional[str] = Field(None, description="Update timestamp")


class Candidate(BaseModel):
    """Candidate information for frontend format."""
    name: str = Field(..., description="Candidate name")
    email: str = Field(..., description="Candidate email")


class CreateCustomMCQAssessmentRequest(BaseModel):
    """Request to create a custom MCQ assessment (frontend format)."""
    title: str = Field(..., description="Assessment title")
    description: Optional[str] = Field(None, description="Assessment description")
    questions: List[Any] = Field(default_factory=list, description="List of questions (MCQ or Subjective)")
    candidates: Optional[List[Candidate]] = Field(None, description="List of candidates")
    accessMode: str = Field("private", description="'private' or 'public'")
    examMode: str = Field("strict", description="'strict' or 'flexible'")
    startTime: Optional[datetime] = Field(None, description="Start time (required for both modes)")
    endTime: Optional[datetime] = Field(None, description="End time (for flexible mode only, calculated for strict mode)")
    duration: Optional[int] = Field(None, description="Duration in minutes (required for both modes)")
    passPercentage: float = Field(50.0, ge=0, le=100, description="Passing percentage")
    status: Optional[str] = Field("draft", description="Assessment status")
    currentStation: Optional[int] = Field(1, description="Current station/step")
    enablePerSectionTimers: Optional[bool] = Field(default=False, description="Enable per-section timers")
    sectionTimers: Optional[Dict[str, int]] = Field(default=None, description="Timer durations in minutes for each section (MCQ, Subjective)")
    proctoringSettings: Optional[ProctoringSettings] = None
    showResultToCandidate: Optional[bool] = Field(default=True, description="Whether to show results to candidates after submission")


class UpdateCustomMCQAssessmentRequest(BaseModel):
    """Request to update a custom MCQ assessment (frontend format)."""
    title: Optional[str] = Field(None, description="Assessment title")
    description: Optional[str] = Field(None, description="Assessment description")
    questions: Optional[List[Any]] = Field(None, description="List of questions (MCQ or Subjective)")
    candidates: Optional[List[Candidate]] = Field(None, description="List of candidates")
    accessMode: Optional[str] = Field(None, description="'private' or 'public'")
    examMode: Optional[str] = Field(None, description="'strict' or 'flexible'")
    startTime: Optional[datetime] = Field(None, description="Start time (required for both modes)")
    endTime: Optional[datetime] = Field(None, description="End time (for flexible mode only, calculated for strict mode)")
    duration: Optional[int] = Field(None, description="Duration in minutes (required for both modes)")
    passPercentage: Optional[float] = Field(None, ge=0, le=100, description="Passing percentage")
    status: Optional[str] = Field(None, description="Assessment status")
    currentStation: Optional[int] = Field(None, description="Current station/step")
    enablePerSectionTimers: Optional[bool] = Field(default=None, description="Enable per-section timers")
    sectionTimers: Optional[Dict[str, int]] = Field(default=None, description="Timer durations in minutes for each section (MCQ, Subjective)")
    proctoringSettings: Optional[ProctoringSettings] = None
    showResultToCandidate: Optional[bool] = Field(default=None, description="Whether to show results to candidates after submission")


class ValidateCSVRequest(BaseModel):
    """Request to validate CSV data."""
    csvData: List[Dict[str, Any]] = Field(..., description="CSV data as list of dictionaries")


class CandidateSubmission(BaseModel):
    """Candidate submission for a question."""
    questionId: str = Field(..., description="Question ID")
    selectedAnswers: Optional[List[str]] = Field(None, description="Selected answer(s) for MCQ questions")
    textAnswer: Optional[str] = Field(None, description="Text answer for subjective questions")


class SubmitCustomMCQRequest(BaseModel):
    """Request to submit custom MCQ answers."""
    assessmentId: str = Field(..., description="Assessment ID")
    token: str = Field(..., description="Assessment token")
    email: str = Field(..., description="Candidate email")
    name: str = Field(..., description="Candidate name")
    submissions: List[CandidateSubmission] = Field(..., description="List of question submissions")
    startedAt: Optional[datetime] = Field(None, description="Start time")
    submittedAt: Optional[datetime] = Field(None, description="Submit time")
    candidateRequirements: Optional[Dict[str, Any]] = Field(None, description="Candidate requirements details (phone, linkedIn, github, etc.)")


class VerifyCustomMCQCandidateRequest(BaseModel):
    """Request to verify candidate access."""
    assessmentId: str = Field(..., description="Assessment ID")
    token: str = Field(..., description="Assessment token")
    email: str = Field(..., description="Candidate email")
    name: str = Field(..., description="Candidate name")


class InvitationTemplate(BaseModel):
    """Email invitation template."""
    subject: Optional[str] = Field(None, description="Email subject template")
    message: Optional[str] = Field(None, description="Email message template")
    footer: Optional[str] = Field(None, description="Email footer")
    sentBy: Optional[str] = Field(None, description="Sender name")


class SendCustomMCQInvitationRequest(BaseModel):
    """Request to send invitation emails."""
    assessmentId: str = Field(..., description="Assessment ID")
    candidates: List[Candidate] = Field(..., description="List of candidates to invite")
    template: Optional[InvitationTemplate] = Field(None, description="Email template")