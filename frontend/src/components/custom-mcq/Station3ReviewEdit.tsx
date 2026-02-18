import { useState, useEffect, useMemo } from "react";
import { CustomMCQAssessment, MCQQuestion, SubjectiveQuestion, Question } from "../../types/custom-mcq";

interface Station3Props {
  assessmentData: Partial<CustomMCQAssessment>;
  updateAssessmentData: (updates: Partial<CustomMCQAssessment>) => void;
}

export default function Station3ReviewEdit({ assessmentData, updateAssessmentData }: Station3Props) {
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestionType, setNewQuestionType] = useState<"mcq" | "subjective">("mcq");
  const [newQuestion, setNewQuestion] = useState<Partial<MCQQuestion | SubjectiveQuestion>>({
    questionType: "mcq",
    section: "",
    question: "",
    options: [{ label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" }],
    correctAn: "",
    answerType: "single",
    marks: 1,
  });

  const questions = assessmentData.questions || [];
  
  // Ensure all questions have unique IDs - use useMemo to avoid recalculating unnecessarily
  const questionsWithIds = useMemo(() => {
    return questions.map((q, idx) => ({
      ...q,
      id: q.id || `q_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`,
      questionType: (q as any).questionType || (("options" in q && "correctAn" in q) ? "mcq" : "subjective"),
    }));
  }, [questions]);
  
  // Update assessment data if IDs were missing (only once when component mounts or questions change)
  useEffect(() => {
    const needsUpdate = questions.some((q, idx) => !q.id);
    if (needsUpdate && questions.length > 0) {
      updateAssessmentData({ questions: questionsWithIds });
    }
  }, []); // Only run once on mount

  const addOption = (question: Partial<MCQQuestion>) => {
    const options = (question as MCQQuestion).options || [];
    const nextLabel = String.fromCharCode(65 + options.length); // A, B, C, D, E, ...
    setNewQuestion({
      ...question,
      options: [...options, { label: nextLabel, text: "" }],
    });
  };

  const removeOption = (question: Partial<MCQQuestion>, index: number) => {
    const options = (question as MCQQuestion).options || [];
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setNewQuestion({
        ...question,
        options: newOptions,
      });
    }
  };

  const handleSaveQuestion = () => {
    if (!newQuestion.question) {
      alert("Please fill in all required fields");
      return;
    }

    if (newQuestionType === "mcq") {
      const mcqQuestion = newQuestion as Partial<MCQQuestion>;
      if (!mcqQuestion.correctAn) {
        alert("Please specify the correct answer");
        return;
      }
      if (!mcqQuestion.options || mcqQuestion.options.length < 2) {
        alert("At least 2 options are required for MCQ questions");
        return;
      }
      if (mcqQuestion.options.some(opt => !opt.text.trim())) {
        alert("All options must have text");
        return;
      }
    }

    // Use current questions with IDs, not the original array
    const currentQuestions = questionsWithIds;
    
    let questionToSave: Question;
    if (newQuestionType === "mcq") {
      const mcqQuestion = newQuestion as Partial<MCQQuestion>;
      questionToSave = {
        id: editingQuestion?.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        questionType: "mcq",
        section: newQuestion.section || "General",
        question: newQuestion.question!,
        options: mcqQuestion.options!,
        correctAn: mcqQuestion.correctAn!.toUpperCase(),
        answerType: mcqQuestion.answerType || "single",
        marks: newQuestion.marks || 1,
      } as MCQQuestion;
    } else {
      questionToSave = {
        id: editingQuestion?.id || `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        questionType: "subjective",
        section: newQuestion.section || "General",
        question: newQuestion.question!,
        marks: newQuestion.marks || 1,
      } as SubjectiveQuestion;
    }

    let updatedQuestions: Question[];
    if (editingQuestion !== null && editingQuestionIndex !== null) {
      // Update by index to ensure we only update the exact question being edited
      updatedQuestions = currentQuestions.map((q, idx) => 
        idx === editingQuestionIndex ? questionToSave : q
      );
    } else {
      // Add new question
      updatedQuestions = [...currentQuestions, questionToSave];
    }

    updateAssessmentData({ questions: updatedQuestions });
    setEditingQuestion(null);
    setEditingQuestionIndex(null);
    setShowAddForm(false);
    resetForm("mcq");
  };

  const handleEdit = (question: Question, index: number) => {
    // Use questions with IDs to get the correct question
    const questionToEdit = questionsWithIds[index];
    setEditingQuestion(questionToEdit);
    setEditingQuestionIndex(index);
    setNewQuestionType(questionToEdit.questionType || (("options" in questionToEdit && "correctAn" in questionToEdit) ? "mcq" : "subjective"));
    
    // Deep copy the question to avoid mutating the original
    if (questionToEdit.questionType === "mcq" || ("options" in questionToEdit && "correctAn" in questionToEdit)) {
      const mcqQ = questionToEdit as MCQQuestion;
      setNewQuestion({ 
        ...mcqQ,
        options: mcqQ.options?.map(opt => ({ ...opt })) || []
      });
    } else {
      setNewQuestion({ ...questionToEdit });
    }
    setShowAddForm(true);
  };

  const handleDelete = (questionId: string) => {
    if (confirm("Are you sure you want to delete this question?")) {
      const updatedQuestions = questionsWithIds.filter((q) => q.id !== questionId);
      updateAssessmentData({ questions: updatedQuestions });
    }
  };

  const resetForm = (questionType: "mcq" | "subjective" = "mcq") => {
    setNewQuestionType(questionType);
    if (questionType === "mcq") {
      setNewQuestion({
        questionType: "mcq",
        question: "",
        options: [{ label: "A", text: "" }, { label: "B", text: "" }, { label: "C", text: "" }, { label: "D", text: "" }],
        correctAn: "",
        answerType: "single",
        marks: 1,
      });
    } else {
      setNewQuestion({
        questionType: "subjective",
        question: "",
        marks: 1,
      });
    }
  };

  const mcqCount = questionsWithIds.filter(q => q.questionType === "mcq" || ("options" in q && "correctAn" in q)).length;
  const subjectiveCount = questionsWithIds.filter(q => q.questionType === "subjective" || !("options" in q && "correctAn" in q)).length;
  const codingCount = questionsWithIds.filter(q => {
    const qType = q.questionType;
    const section = q.section?.toLowerCase() || "";
    return qType === "coding" || qType?.toLowerCase() === "coding" || 
           (section === "coding" && !("options" in q && "correctAn" in q));
  }).length;

  // Per-section timer state
  const enablePerSectionTimers = (assessmentData as any).enablePerSectionTimers || false;
  const sectionTimers = (assessmentData as any).sectionTimers || { MCQ: 20, Subjective: 30, Coding: 30 };

  const handleEnablePerSectionTimersChange = (enabled: boolean) => {
    updateAssessmentData({
      enablePerSectionTimers: enabled,
      sectionTimers: enabled ? sectionTimers : undefined,
    } as any);
  };

  const handleSectionTimerChange = (section: "MCQ" | "Subjective" | "Coding", value: string) => {
    const numValue = parseInt(value) || 1;
    const newSectionTimers = {
      ...sectionTimers,
      [section]: numValue,
    };
    
    // Calculate total duration from section timers
    const totalDuration = (newSectionTimers.MCQ || 0) + (newSectionTimers.Subjective || 0) + (newSectionTimers.Coding || 0);
    
    updateAssessmentData({
      sectionTimers: newSectionTimers,
      duration: totalDuration > 0 ? totalDuration : undefined,
      schedule: {
        ...(assessmentData as any)?.schedule,
        duration: totalDuration > 0 ? totalDuration : undefined,
      },
    } as any);
  };

  return (
    <div>
      <h2 style={{ marginBottom: "1.5rem", color: "#1E5A3B" }}>✏️ Review & Edit Questions</h2>
      <p style={{ marginBottom: "2rem", color: "#2D7A52" }}>
        Review, edit, or add questions. All questions from your CSV are shown below.
      </p>

      {/* Per-Section Timer Settings */}
      <div style={{ 
        marginBottom: "2rem", 
        padding: "1.5rem", 
        backgroundColor: "#f8fafc", 
        borderRadius: "0.75rem", 
        border: "2px solid #e2e8f0" 
      }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer", marginBottom: enablePerSectionTimers ? "1rem" : "0" }}>
          <input
            type="checkbox"
            checked={enablePerSectionTimers}
            onChange={(e) => handleEnablePerSectionTimersChange(e.target.checked)}
            style={{ width: "20px", height: "20px", cursor: "pointer" }}
          />
          <div>
            <div style={{ fontWeight: 600, color: "#1e293b", fontSize: "1rem" }}>
              Enable Per-Section Timer
            </div>
            <div style={{ fontSize: "0.875rem", color: "#64748b", marginTop: "0.25rem" }}>
              Each section (MCQ/Subjective/Coding) will have its own timer. Sections will be locked when their timer expires.
            </div>
          </div>
        </label>

        {enablePerSectionTimers && (
          <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
            {mcqCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <label style={{ display: "block", minWidth: "120px", fontWeight: 600, color: "#1E5A3B" }}>
                  MCQ Timer (minutes):
                </label>
                <input
                  type="number"
                  min="1"
                  value={sectionTimers.MCQ || 20}
                  onChange={(e) => handleSectionTimerChange("MCQ", e.target.value)}
                  style={{ 
                    width: "150px", 
                    padding: "0.75rem", 
                    border: "1px solid #A8E8BC", 
                    borderRadius: "0.5rem" 
                  }}
                />
                <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                  {mcqCount} question{mcqCount !== 1 ? 's' : ''} in MCQ section
                </span>
              </div>
            )}
            {subjectiveCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <label style={{ display: "block", minWidth: "120px", fontWeight: 600, color: "#1E5A3B" }}>
                  Subjective Timer (minutes):
                </label>
                <input
                  type="number"
                  min="1"
                  value={sectionTimers.Subjective || 30}
                  onChange={(e) => handleSectionTimerChange("Subjective", e.target.value)}
                  style={{ 
                    width: "150px", 
                    padding: "0.75rem", 
                    border: "1px solid #A8E8BC", 
                    borderRadius: "0.5rem" 
                  }}
                />
                <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                  {subjectiveCount} question{subjectiveCount !== 1 ? 's' : ''} in Subjective section
                </span>
              </div>
            )}
            {codingCount > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <label style={{ display: "block", minWidth: "120px", fontWeight: 600, color: "#1E5A3B" }}>
                  Coding Timer (minutes):
                </label>
                <input
                  type="number"
                  min="1"
                  value={sectionTimers.Coding || 30}
                  onChange={(e) => handleSectionTimerChange("Coding", e.target.value)}
                  style={{ 
                    width: "150px", 
                    padding: "0.75rem", 
                    border: "1px solid #A8E8BC", 
                    borderRadius: "0.5rem" 
                  }}
                />
                <span style={{ fontSize: "0.875rem", color: "#64748b" }}>
                  {codingCount} question{codingCount !== 1 ? 's' : ''} in Coding section
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <strong style={{ color: "#1E5A3B" }}>Total Questions: {questionsWithIds.length}</strong>
          <span style={{ color: "#4A9A6A", marginLeft: "1rem" }}>
            (MCQ: {mcqCount}, Subjective: {subjectiveCount}{codingCount > 0 ? `, Coding: ${codingCount}` : ''})
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAddForm(true);
            setEditingQuestion(null);
            resetForm("mcq");
          }}
          className="btn-primary"
        >
          + Add Question
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAddForm && (
        <div
          style={{
            padding: "1.5rem",
            border: "2px solid #A8E8BC",
            borderRadius: "0.5rem",
            marginBottom: "2rem",
            backgroundColor: "#E8FAF0",
          }}
        >
          <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>
            {editingQuestion ? "Edit Question" : "Add New Question"}
          </h3>

          {!editingQuestion && (
            <div style={{ marginBottom: "1rem" }}>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                Question Type <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: "1rem" }}>
                <button
                  type="button"
                  onClick={() => {
                    resetForm("mcq");
                  }}
                  style={{
                    padding: "0.75rem 1.5rem",
                    border: newQuestionType === "mcq" ? "2px solid #2D7A52" : "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    backgroundColor: newQuestionType === "mcq" ? "#E8FAF0" : "#ffffff",
                    color: newQuestionType === "mcq" ? "#1E5A3B" : "#2D7A52",
                    fontWeight: newQuestionType === "mcq" ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  MCQ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm("subjective");
                  }}
                  style={{
                    padding: "0.75rem 1.5rem",
                    border: newQuestionType === "subjective" ? "2px solid #2D7A52" : "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    backgroundColor: newQuestionType === "subjective" ? "#E8FAF0" : "#ffffff",
                    color: newQuestionType === "subjective" ? "#1E5A3B" : "#2D7A52",
                    fontWeight: newQuestionType === "subjective" ? 600 : 400,
                    cursor: "pointer",
                  }}
                >
                  Subjective
                </button>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                Question <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <textarea
                value={newQuestion.question || ""}
                onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                placeholder="Enter your question"
                rows={3}
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem" }}
              />
            </div>

            {newQuestionType === "mcq" && (
              <>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                    Answer Type <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <select
                    value={(newQuestion as Partial<MCQQuestion>).answerType || "single"}
                    onChange={(e) =>
                      setNewQuestion((prev) => {
                        // Type-safe: only MCQ questions have answerType
                        if (newQuestionType !== "mcq") return prev;
                        return {
                          ...(prev as Partial<MCQQuestion>),
                          answerType: e.target.value as any,
                        };
                      })
                    }
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem" }}
                  >
                    <option value="single">Single Choice</option>
                    <option value="multiple_all">Multiple Choice (All Required)</option>
                    <option value="multiple_any">Multiple Choice (Any One)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                    Options <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  {((newQuestion as Partial<MCQQuestion>).options || []).map((option, idx) => (
                    <div key={idx} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <input
                        type="text"
                        value={option.label}
                        disabled
                        style={{ width: "50px", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem", backgroundColor: "#f0f0f0" }}
                      />
                      <input
                        type="text"
                        value={option.text}
                        onChange={(e) => {
                          const newOptions = [...((newQuestion as Partial<MCQQuestion>).options || [])];
                          newOptions[idx].text = e.target.value;
                          setNewQuestion((prev) => {
                            // Type-safe: only MCQ questions have options
                            if (newQuestionType !== "mcq") return prev;
                            return {
                              ...(prev as Partial<MCQQuestion>),
                              options: newOptions,
                            };
                          });
                        }}
                        placeholder={`Option ${option.label}`}
                        style={{ flex: 1, padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem" }}
                      />
                      {((newQuestion as Partial<MCQQuestion>).options || []).length > 2 && (
                        <button
                          type="button"
                          onClick={() => removeOption(newQuestion as Partial<MCQQuestion>, idx)}
                          style={{ padding: "0.5rem 1rem", backgroundColor: "#ef4444", color: "#fff", border: "none", borderRadius: "0.25rem", cursor: "pointer" }}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addOption(newQuestion as Partial<MCQQuestion>)}
                    className="btn-secondary"
                    style={{ width: "fit-content" }}
                  >
                    + Add Option
                  </button>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                    Correct Answer(s) <span style={{ color: "#ef4444" }}>*</span>
                    <span style={{ fontSize: "0.875rem", fontWeight: 400, color: "#2D7A52" }}>
                      {" "}(e.g., A or A,B for multiple)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={(newQuestion as Partial<MCQQuestion>).correctAn || ""}
                    onChange={(e) =>
                      setNewQuestion((prev) => {
                        // Type-safe: only MCQ questions have correctAn
                        if (newQuestionType !== "mcq") return prev;
                        return {
                          ...(prev as Partial<MCQQuestion>),
                          correctAn: e.target.value.toUpperCase(),
                        };
                      })
                    }
                    placeholder="A or A,B"
                    style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem" }}
                  />
                </div>
              </>
            )}

            <div>
              <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                Marks <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <input
                type="number"
                value={newQuestion.marks || 1}
                onChange={(e) => setNewQuestion({ ...newQuestion, marks: parseInt(e.target.value) || 1 })}
                min={1}
                style={{ width: "100%", padding: "0.5rem", border: "1px solid #A8E8BC", borderRadius: "0.25rem" }}
              />
            </div>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button type="button" onClick={handleSaveQuestion} className="btn-primary">
                {editingQuestion ? "Save Changes" : "Add Question"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingQuestion(null);
                  resetForm("mcq");
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Questions List */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {questionsWithIds.map((question, idx) => {
          const isMCQ = question.questionType === "mcq" || ("options" in question && "correctAn" in question);
          return (
            <div
              key={question.id || idx}
              style={{
                padding: "1.5rem",
                border: "1px solid #A8E8BC",
                borderRadius: "0.5rem",
                backgroundColor: "#ffffff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "1rem" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem" }}>
                    <span style={{ fontWeight: 600, color: "#2D7A52" }}>Q{idx + 1}</span>
                    <span style={{ color: "#4A9A6A" }}>[{question.section}]</span>
                    <span style={{ 
                      padding: "0.25rem 0.5rem", 
                      backgroundColor: isMCQ ? "#E8FAF0" : "#FFF4E6", 
                      color: isMCQ ? "#1E5A3B" : "#B45309",
                      borderRadius: "0.25rem",
                      fontSize: "0.875rem",
                      fontWeight: 600
                    }}>
                      {isMCQ ? "MCQ" : "Subjective"}
                    </span>
                    {isMCQ && (question as MCQQuestion).answerType && (
                      <span style={{ color: "#4A9A6A" }}>{(question as MCQQuestion).answerType}</span>
                    )}
                    <span style={{ color: "#4A9A6A" }}>{question.marks} marks</span>
                  </div>
                  <p style={{ marginBottom: "1rem", fontWeight: 600, color: "#1E5A3B" }}>{question.question}</p>
                  {isMCQ && (question as MCQQuestion).options && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {(question as MCQQuestion).options.map((opt, optIdx) => (
                        <div key={optIdx} style={{ paddingLeft: "1rem", color: "#2D7A52" }}>
                          <strong>{opt.label}:</strong> {opt.text}
                        </div>
                      ))}
                    </div>
                  )}
                  {isMCQ && (question as MCQQuestion).correctAn && (
                    <div style={{ marginTop: "0.5rem", color: "#10b981", fontWeight: 600 }}>
                      Correct: {(question as MCQQuestion).correctAn}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    type="button"
                    onClick={() => handleEdit(question, idx)}
                    className="btn-secondary"
                    style={{ padding: "0.5rem 1rem", fontSize: "0.875rem" }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(question.id!)}
                    style={{
                      padding: "0.5rem 1rem",
                      fontSize: "0.875rem",
                      backgroundColor: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: "0.25rem",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {questionsWithIds.length === 0 && (
          <div style={{ textAlign: "center", padding: "3rem", color: "#4A9A6A" }}>
            No questions yet. Add questions or upload a CSV file.
          </div>
        )}
      </div>
    </div>
  );
}