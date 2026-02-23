from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


QUESTION_TYPES = {"MCQ", "Subjective", "Pseudo Code", "Descriptive", "Aptitude", "Reasoning", "coding"}
DIFFICULTY_LEVELS = {"Easy", "Medium", "Hard"}
STATUS_VALUES = {"draft", "ready", "scheduled", "active", "paused", "completed"}


class QuestionConfig(BaseModel):
    questionNumber: int = Field(..., ge=1)
    type: str = Field(...)
    difficulty: str = Field(default="Medium")

    def model_post_init(self, __context: dict[str, object]) -> None:
        if self.type not in QUESTION_TYPES:
            raise ValueError("Invalid question type")
        if self.difficulty not in DIFFICULTY_LEVELS:
            raise ValueError("Invalid difficulty level")


class Question(BaseModel):
    questionText: str
    type: str
    difficulty: str
    options: Optional[List[str]] = None
    correctAnswer: Optional[str] = None
    idealAnswer: Optional[str] = None
    expectedLogic: Optional[str] = None
    time: Optional[int] = None  # Time in minutes
    score: Optional[int] = None  # Score in points
    judge0_enabled: Optional[bool] = None  # For coding questions: whether Judge0 is enabled
    language: Optional[str] = None  # For coding questions: selected language ID (e.g., "50" for C)
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None


class TopicUpdate(BaseModel):
    topic: str
    numQuestions: Optional[int] = None
    questionTypes: Optional[List[str]] = None
    difficulty: Optional[str] = None
    questions: Optional[List[Question]] = None
    questionConfigs: Optional[List[QuestionConfig]] = None


class AptitudeCategoryConfig(BaseModel):
    enabled: bool = False
    difficulty: str = Field(default="Medium")
    numQuestions: int = Field(default=0, ge=0)

    def model_post_init(self, __context: dict[str, object]) -> None:
        if self.difficulty not in DIFFICULTY_LEVELS:
            raise ValueError("Invalid difficulty level")


class AptitudeConfig(BaseModel):
    quantitative: Optional[AptitudeCategoryConfig] = None
    logicalReasoning: Optional[AptitudeCategoryConfig] = None
    verbalAbility: Optional[AptitudeCategoryConfig] = None
    numericalReasoning: Optional[AptitudeCategoryConfig] = None


class GenerateTopicsRequestOld(BaseModel):
    """Old GenerateTopicsRequest - kept for backward compatibility."""
    assessmentType: List[str] = Field(..., min_length=1)  # ["aptitude"], ["technical"], or ["aptitude", "technical"]
    # Technical fields (required only if "technical" is in assessmentType)
    jobRole: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[List[str]] = None
    numTopics: Optional[int] = Field(default=None, gt=0)  # Number of topics to generate for technical assessment
    # Aptitude fields (required only if "aptitude" is in assessmentType)
    aptitudeConfig: Optional[AptitudeConfig] = None


class UpdateTopicSettingsRequest(BaseModel):
    assessmentId: str
    updatedTopics: List[TopicUpdate]


class AddCustomTopicsRequest(BaseModel):
    assessmentId: str
    newTopics: List[TopicUpdate | str]


class RemoveCustomTopicsRequest(BaseModel):
    assessmentId: str
    topicsToRemove: List[str]


class GenerateQuestionsRequest(BaseModel):
    assessmentId: str


class UpdateQuestionsRequest(BaseModel):
    assessmentId: str
    topic: str
    questions: List[Question]


class CreateAssessmentRequest(BaseModel):
    title: str
    description: Optional[str] = None
    assessmentType: List[str] = Field(..., min_length=1)
    jobRole: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[List[str]] = None
    numTopics: Optional[int] = None
    aptitudeConfig: Optional[AptitudeConfig] = None
    duration: Optional[int] = None  # Duration in minutes
    passingScore: Optional[int] = None  # Passing score percentage
    instructions: Optional[str] = None


class UpdateAssessmentRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assessmentType: Optional[List[str]] = None
    jobRole: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[List[str]] = None
    numTopics: Optional[int] = None
    aptitudeConfig: Optional[AptitudeConfig] = None
    duration: Optional[int] = None
    passingScore: Optional[int] = None
    instructions: Optional[str] = None


class QuestionRowModel(BaseModel):
    """Model for a single question type row within a topic."""
    rowId: str = Field(..., description="Unique row identifier")
    # Include SQL/AIML to support execution-environment question types in v2 topic flows
    questionType: str = Field(..., pattern=r"^(MCQ|Subjective|PseudoCode|Coding|SQL|AIML)$")
    difficulty: str = Field(..., pattern=r"^(Easy|Medium|Hard)$")
    questionsCount: int = Field(..., ge=1, le=20)
    questions: List[Dict[str, Any]] = Field(default_factory=list, description="Generated questions for this row")
    status: str = Field(default="pending", pattern=r"^(pending|generated)$", description="Question generation status")
    locked: bool = Field(default=False, description="Whether this row is locked from regeneration")
    canUseJudge0: bool = Field(default=False, description="Whether Judge0 can be used for coding questions")
    additionalRequirements: Optional[str] = Field(default=None, description="Additional requirements for question generation")


class TopicModel(BaseModel):
    """Strict topic data model with multiple question rows - MUST follow exact structure."""
    id: str = Field(..., description="Unique topic identifier")
    label: str = Field(..., description="Topic name/label")
    locked: bool = Field(default=False, description="Whether topic is locked from regeneration")
    questionRows: List[QuestionRowModel] = Field(..., min_length=1, description="Array of question type rows")
    status: str = Field(default="pending", pattern=r"^(pending|generated|completed|regenerated)$", description="Topic generation status: pending=needs generation, generated=has questions, completed=same as generated, regenerated=needs regeneration")
    source: Optional[str] = Field(default=None, pattern=r"^(ai|manual|csv|role)$", description="Source of the topic")
    regenerated: bool = Field(default=False, description="Whether topic has been improved/regenerated")
    previousVersion: List[str] = Field(default_factory=list, description="History of previous topic labels")


class CombinedSkill(BaseModel):
    """Unified skill representation from any source."""
    skill_name: str = Field(..., min_length=1)
    source: str = Field(..., pattern=r"^(role|manual|csv)$")
    description: Optional[str] = None
    importance_level: Optional[str] = Field(default=None, pattern=r"^(Low|Medium|High)$")


class GenerateTopicsRequest(BaseModel):
    """Request to generate topics based on assessment context - unified for all skill sources."""
    assessmentId: Optional[str] = None
    assessmentTitle: Optional[str] = None
    jobDesignation: Optional[str] = None  # Optional for manual/CSV methods
    combinedSkills: List[CombinedSkill] = Field(..., min_length=1)
    experienceMin: int = Field(default=0, ge=0, le=20)
    experienceMax: int = Field(default=10, ge=0, le=20)
    experienceMode: str = Field(default="corporate", pattern=r"^(corporate|student)$")


class RegenerateTopicRequest(BaseModel):
    """Request to regenerate a single topic - OLD, DEPRECATED. Use ImproveTopicRequest instead."""
    assessmentId: str
    topicId: str
    assessmentTitle: Optional[str] = None
    jobDesignation: str
    selectedSkills: List[str]
    experienceMin: int
    experienceMax: int
    experienceMode: str


class ImproveTopicRequest(BaseModel):
    """Request to improve a single topic (not regenerate from scratch)."""
    assessmentId: str
    topicId: str
    previousTopicLabel: str = Field(..., min_length=1, description="The current topic label to improve")
    experienceMode: str = Field(..., pattern=r"^(corporate|student)$")
    experienceMin: int = Field(..., ge=0, le=20)
    experienceMax: int = Field(..., ge=0, le=20)
    source: str = Field(..., pattern=r"^(role|manual|csv)$", description="Source of the original topic")
    skillMetadataProvided: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional skill metadata (description, importance_level) if available from source"
    )


class ImproveAllTopicsRequest(BaseModel):
    """Request to improve all topics (not regenerate from scratch)."""
    assessmentId: str
    experienceMode: str = Field(..., pattern=r"^(corporate|student)$")
    experienceMin: int = Field(..., ge=0, le=20)
    experienceMax: int = Field(..., ge=0, le=20)
    previousTopics: List[Dict[str, Any]] = Field(
        ...,
        min_length=1,
        description="List of previous topics with topicId, previousTopicLabel, source, relatedSkill"
    )
    combinedSkills: Optional[List[CombinedSkill]] = Field(
        default=None,
        description="Combined skills from all sources (for context)"
    )


class GenerateQuestionRequest(BaseModel):
    """Request to generate questions for a single question row."""
    assessmentId: str
    topicId: str
    rowId: str = Field(..., description="ID of the question row to generate questions for")
    topicLabel: str
    # Include SQL/AIML to support execution-environment question types
    questionType: str = Field(..., pattern=r"^(MCQ|Subjective|PseudoCode|Coding|SQL|AIML)$")
    difficulty: str = Field(..., pattern=r"^(Easy|Medium|Hard)$")
    questionsCount: int = Field(..., ge=1, le=20)
    canUseJudge0: bool = Field(default=False)
    codingLanguage: Optional[str] = Field(default="python")
    additionalRequirements: Optional[str] = Field(default=None, description="Additional requirements for question generation")
    experienceMode: Optional[str] = Field(default="corporate", pattern=r"^(corporate|student|college)$")
    experienceMin: Optional[int] = Field(default=0, ge=0, le=20)
    experienceMax: Optional[int] = Field(default=10, ge=0, le=20)


class TopicToGenerate(BaseModel):
    """Model for a topic that needs question generation."""
    topicId: str
    topicLabel: str
    questionRows: List[Dict[str, Any]] = Field(..., description="Question rows that need generation")
    experienceMode: str = Field(..., pattern=r"^(corporate|student|college)$")
    experienceMin: int = Field(..., ge=0, le=20)
    experienceMax: int = Field(..., ge=0, le=20)


class GenerateQuestionsForTopicsRequest(BaseModel):
    """Request to generate questions for multiple topics (only pending/regenerated topics)."""
    assessmentId: str
    topicsToGenerate: List[TopicToGenerate] = Field(..., min_length=1, description="Only topics with status 'pending' or 'regenerated'")


class UpdateAssessmentDraftRequest(BaseModel):
    """Request to update assessment draft data."""
    assessmentId: Optional[str] = None
    # Optional fields that can be updated directly
    title: Optional[str] = None
    description: Optional[str] = None
    jobDesignation: Optional[str] = None
    selectedSkills: Optional[List[str]] = None
    experienceMin: Optional[int] = None
    experienceMax: Optional[int] = None
    experienceMode: Optional[str] = None
    topics: Optional[List[Dict[str, Any]]] = None
    topics_v2: Optional[List[Dict[str, Any]]] = None
    questions: Optional[List[Dict[str, Any]]] = None
    questionTypeTimes: Optional[Dict[str, int]] = None
    enablePerSectionTimers: Optional[bool] = None
    sectionTimers: Optional[Dict[str, int]] = None
    scoringRules: Optional[Dict[str, int]] = None
    passPercentage: Optional[int] = None
    schedule: Optional[Dict[str, Any]] = None
    candidates: Optional[List[Dict[str, Any]]] = None
    assessmentUrl: Optional[str] = None
    accessMode: Optional[str] = None
    invitationTemplate: Optional[str] = None
    additionalRequirements: Optional[str] = None
    companyContext: Optional[str] = None  # New: free text or URL input
    contextSummary: Optional[Dict[str, Any]] = None  # New: processed context (from URL or text)
    # Also support a draft wrapper for backward compatibility
    draft: Optional[Dict[str, Any]] = Field(default=None, description="Optional draft data wrapper (for backward compatibility)")


class AssessmentResponse(BaseModel):
    """Response model for assessment data."""
    id: str
    title: str
    description: Optional[str] = None
    assessmentType: List[str]
    jobRole: Optional[str] = None
    experience: Optional[str] = None
    skills: Optional[List[str]] = None
    numTopics: Optional[int] = None
    aptitudeConfig: Optional[AptitudeConfig] = None
    duration: Optional[int] = None
    passingScore: Optional[int] = None
    instructions: Optional[str] = None
    status: str
    createdAt: Optional[datetime] = None
    updatedAt: Optional[datetime] = None
    topics: List[TopicModel]
    draft: Optional[Dict[str, Any]] = None


class GenerateTopicsResponse(BaseModel):
    """Response for topic generation."""
    topics: List[TopicModel]
    message: str = "Topics generated successfully"


class ImproveTopicResponse(BaseModel):
    """Response for topic improvement."""
    updatedTopicLabel: str
    updatedContextSummary: Optional[str] = None


class ImproveAllTopicsResponse(BaseModel):
    """Response for improving all topics."""
    updatedTopics: List[TopicModel]
    message: str = "All topics improved successfully"


class AITopicSuggestionRequest(BaseModel):
    """Request for AI topic validation and suggestions."""
    category: str = Field(..., pattern=r"^(aptitude|communication|logical)$")
    input: str = Field(..., min_length=1)


class AddCustomTopicRequest(BaseModel):
    """Request to add a single custom topic."""
    category: str = Field(..., pattern=r"^(aptitude|communication|logical|technical)$")
    topicName: str = Field(..., min_length=1)


class GenerateQuestionResponse(BaseModel):
    """Response for question generation."""
    questions: List[Dict[str, Any]]
    message: str = "Questions generated successfully"


class GenerateQuestionsForTopicsResponse(BaseModel):
    """Response for generating questions for multiple topics."""
    generatedTopics: List[str] = Field(..., description="List of topic IDs that had questions generated")
    skippedTopics: List[str] = Field(default_factory=list, description="List of topic IDs that were skipped (already generated)")
    message: str = "Question generation completed"


# Additional request schemas for various endpoints
class SuggestTopicsRequest(BaseModel):
    """Request for AI-powered topic suggestions."""
    category: str = Field(..., description="Topic category")
    query: str = Field(..., description="Partial query string for suggestions")


class ClassifyTechnicalTopicRequest(BaseModel):
    """Request to classify a technical topic."""
    topic: str = Field(..., min_length=1, description="Topic name to classify")


class AddNewQuestionRequest(BaseModel):
    """Request to add a new question."""
    assessmentId: str
    topic: str
    question: Question


class CreateAssessmentFromJobDesignationRequest(BaseModel):
    """Request to create assessment from job designation."""
    jobDesignation: str
    experience: Optional[str] = None
    skills: Optional[List[str]] = None


class DeleteQuestionRequest(BaseModel):
    """Request to delete a question."""
    assessmentId: str
    topic: str
    questionIndex: int


class DeleteTopicQuestionsRequest(BaseModel):
    """Request to delete all questions for a topic."""
    assessmentId: str
    topicId: str


class FinalizeAssessmentRequest(BaseModel):
    """Request to finalize an assessment."""
    assessmentId: str
    title: Optional[str] = None
    description: Optional[str] = None
    questionTypeTimes: Optional[Dict[str, int]] = None
    enablePerSectionTimers: Optional[bool] = None
    sectionTimers: Optional[Dict[str, int]] = None
    scoringRules: Optional[Dict[str, int]] = None
    passPercentage: Optional[int] = None


class AddQuestionRowRequest(BaseModel):
    """Request to add a new question row to a topic."""
    assessmentId: str
    topicId: str


class GenerateAllQuestionsRequest(BaseModel):
    """Request to generate questions for all topics."""
    assessmentId: str
    topics: List[TopicModel] = Field(..., description="List of topics to generate questions for")


class GenerateQuestionsFromConfigRequest(BaseModel):
    """Request to generate questions from configuration."""
    assessmentId: str
    topicConfigs: List[Dict[str, Any]]


class RegenerateSingleQuestionRequest(BaseModel):
    """Request to regenerate a single question."""
    assessmentId: str
    topic: str
    questionIndex: int


class RemoveQuestionRowRequest(BaseModel):
    """Request to remove a question row from a topic."""
    assessmentId: str
    topicId: str
    rowId: str


class GenerateTopicCardsRequest(BaseModel):
    """Request to generate topic cards from job designation."""
    jobDesignation: str = Field(..., description="Job designation/role")
    assessmentTitle: Optional[str] = Field(default=None, description="Optional assessment title")
    experienceMin: Optional[int] = Field(default=0, ge=0, le=20, description="Minimum experience in years")
    experienceMax: Optional[int] = Field(default=10, ge=0, le=20, description="Maximum experience in years")
    experienceMode: Optional[str] = Field(default="corporate", pattern=r"^(corporate|student)$", description="Experience mode")


class GenerateTopicsFromSkillRequest(BaseModel):
    """Request to generate topics from a skill."""
    skill: str
    experienceMode: str = Field(default="corporate", pattern=r"^(corporate|student)$")
    experienceMin: int = Field(default=0, ge=0, le=20)
    experienceMax: int = Field(default=10, ge=0, le=20)


class GenerateTopicsFromRequirementsRequest(BaseModel):
    """Request to generate topics from CSV requirements."""
    experienceMode: str = Field(..., pattern=r"^(corporate|student)$")
    experienceMin: int = Field(..., ge=0, le=20)
    experienceMax: int = Field(..., ge=0, le=20)
    requirements: List[Dict[str, Any]] = Field(..., description="List of skill requirements with skill_name, skill_description, importance_level")


class RegenerateSingleTopicRequest(BaseModel):
    """Request to regenerate a single topic."""
    assessmentId: str
    topicId: str
    assessmentTitle: Optional[str] = None
    jobDesignation: str
    selectedSkills: List[str]
    experienceMin: int
    experienceMax: int
    experienceMode: str


class ScheduleUpdateRequest(BaseModel):
    """Request to update assessment schedule."""
    assessmentId: str
    schedule: Dict[str, Any]


class TopicConfigRow(BaseModel):
    """Configuration for a topic row."""
    questionType: str
    difficulty: str
    numQuestions: int
    language: Optional[str] = None
    judge0_enabled: Optional[bool] = None


class UpdateSingleQuestionRequest(BaseModel):
    """Request to update a single question."""
    assessmentId: str
    topic: str
    questionIndex: int
    question: Question


class UpdateSingleQuestionRequestV2(BaseModel):
    """Request to update a single question (v2 format)."""
    assessmentId: str
    topicId: str
    rowId: str
    questionIndex: int
    question: Dict[str, Any]


class ValidateQuestionTypeRequest(BaseModel):
    """Request to validate a question type."""
    questionType: str
    topic: Optional[str] = None


class RegenerateQuestionRequest(BaseModel):
    """Request to regenerate a single question."""
    assessmentId: str
    topicId: str
    rowId: str
    questionIndex: int
    oldQuestion: str = Field(..., description="The current question text")
    questionType: str = Field(..., description="Type of question (MCQ, Subjective, PseudoCode, Coding, SQL, AIML)")
    difficulty: str = Field(..., description="Difficulty level (Easy, Medium, Hard)")
    experienceMode: Optional[str] = Field(default="corporate", pattern=r"^(corporate|student|college)$")
    experienceMin: Optional[int] = Field(default=0, ge=0, le=20)
    experienceMax: Optional[int] = Field(default=10, ge=0, le=20)
    additionalRequirements: Optional[str] = Field(default=None, description="Additional requirements from topic configuration")
    feedback: Optional[str] = Field(default=None, description="Optional user feedback for improvement")
