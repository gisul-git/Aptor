import { useState, useEffect, useMemo } from "react";
import {
  CustomMCQAssessment,
  MCQQuestion,
  SubjectiveQuestion,
  Question,
} from "../../types/custom-mcq";
import {
  Edit3,
  Trash2,
  Plus,
  Clock,
  HelpCircle,
  CheckCircle2,
  FileText,
  X,
  Save,
  Layers,
  ChevronRight,
  AlertCircle,
} from "lucide-react";

interface Station3Props {
  assessmentData: Partial<CustomMCQAssessment>;
  updateAssessmentData: (updates: Partial<CustomMCQAssessment>) => void;
}

export default function Station3ReviewEdit({
  assessmentData,
  updateAssessmentData,
}: Station3Props) {
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<
    number | null
  >(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newQuestionType, setNewQuestionType] = useState<"mcq" | "subjective" | "coding">("mcq");
  const [newQuestion, setNewQuestion] = useState<
    Partial<MCQQuestion | SubjectiveQuestion>
  >({
    questionType: "mcq",
    section: "",
    question: "",
    options: [
      { label: "A", text: "" },
      { label: "B", text: "" },
      { label: "C", text: "" },
      { label: "D", text: "" },
    ],
    correctAn: "",
    answerType: "single",
    marks: 1,
  });

  const questions = assessmentData.questions || [];

  const questionsWithIds = useMemo(() => {
    return questions.map((q, idx) => ({
      ...q,
      id:
        q.id ||
        `q_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 9)}`,
      questionType:
        (q as any).questionType ||
        ("options" in q && "correctAn" in q ? "mcq" : "subjective"),
    }));
  }, [questions]);

  useEffect(() => {
    const needsUpdate = questions.some((q, idx) => !q.id);
    if (needsUpdate && questions.length > 0) {
      updateAssessmentData({ questions: questionsWithIds });
    }
  }, []);

  const addOption = (question: Partial<MCQQuestion>) => {
    const options = question.options || [];
    const nextLabel = String.fromCharCode(65 + options.length);
    setNewQuestion({
      ...question,
      options: [...options, { label: nextLabel, text: "" }],
    } as any);
  };

  const removeOption = (question: Partial<MCQQuestion>, index: number) => {
    const options = question.options || [];
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setNewQuestion({
        ...question,
        options: newOptions,
      } as any);
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
      if (mcqQuestion.options.some((opt) => !opt.text.trim())) {
        alert("All options must have text");
        return;
      }
    }

    const currentQuestions = questionsWithIds;

    let questionToSave: Question;
    if (newQuestionType === "mcq") {
      const mcqQuestion = newQuestion as Partial<MCQQuestion>;
      questionToSave = {
        id:
          editingQuestion?.id ||
          `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
        id:
          editingQuestion?.id ||
          `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        questionType: "subjective",
        section: newQuestion.section || "General",
        question: newQuestion.question!,
        marks: newQuestion.marks || 1,
      } as SubjectiveQuestion;
    }

    let updatedQuestions: Question[];
    if (editingQuestion !== null && editingQuestionIndex !== null) {
      updatedQuestions = currentQuestions.map((q, idx) =>
        idx === editingQuestionIndex ? questionToSave : q,
      );
    } else {
      updatedQuestions = [...currentQuestions, questionToSave];
    }

    updateAssessmentData({ questions: updatedQuestions });
    setEditingQuestion(null);
    setEditingQuestionIndex(null);
    setShowAddForm(false);
    resetForm("mcq");
  };

  const handleEdit = (question: Question, index: number) => {
    const questionToEdit = questionsWithIds[index];
    setEditingQuestion(questionToEdit);
    setEditingQuestionIndex(index);
    setNewQuestionType(
  (questionToEdit.questionType as "mcq" | "subjective" | "coding") ||
    ("options" in questionToEdit && "correctAn" in questionToEdit ? "mcq" : "subjective")
);

    if (
      questionToEdit.questionType === "mcq" ||
      ("options" in questionToEdit && "correctAn" in questionToEdit)
    ) {
      const mcqQ = questionToEdit as MCQQuestion;
      setNewQuestion({
        ...mcqQ,
        options: mcqQ.options?.map((opt) => ({ ...opt })) || [],
      });
    } else {
      setNewQuestion({ ...questionToEdit });
    }
    setShowAddForm(true);
  };

  const handleDelete = (questionId: string) => {
    if (confirm("Are you sure you want to delete this question?")) {
      const updatedQuestions = questionsWithIds.filter(
        (q) => q.id !== questionId,
      );
      updateAssessmentData({ questions: updatedQuestions });
    }
  };

  const resetForm = (questionType: "mcq" | "subjective" | "coding" = "mcq") => {
    setNewQuestionType(questionType);
    if (questionType === "mcq") {
      setNewQuestion({
        questionType: "mcq",
        question: "",
        options: [
          { label: "A", text: "" },
          { label: "B", text: "" },
          { label: "C", text: "" },
          { label: "D", text: "" },
        ],
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

  const mcqCount = questionsWithIds.filter(
  (q) => q.questionType === "mcq" || ("options" in q && "correctAn" in q),
).length;

const codingCount = questionsWithIds.filter(
  (q) => q.questionType === "coding",
).length;

const subjectiveCount = questionsWithIds.filter(
  (q) => q.questionType === "subjective",
).length;

  const enablePerSectionTimers =
    (assessmentData as any).enablePerSectionTimers || false;
  const sectionTimers = (assessmentData as any).sectionTimers || {
    MCQ: 20,
    Subjective: 30,
    Coding: 30,
  };

  const handleEnablePerSectionTimersChange = (enabled: boolean) => {
    updateAssessmentData({
      enablePerSectionTimers: enabled,
      sectionTimers: enabled ? sectionTimers : undefined,
    } as any);
  };

  const handleSectionTimerChange = (
    section: "MCQ" | "Subjective" | "Coding",
    value: string,
  ) => {
    const numValue = parseInt(value) || 1;
    const newSectionTimers = { ...sectionTimers, [section]: numValue };
    const totalDuration =
      (newSectionTimers.MCQ || 0) +
      (newSectionTimers.Subjective || 0) +
      (newSectionTimers.Coding || 0);
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
    <div className="w-full max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-2 px-1">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#C9F4D4] rounded-xl text-[#1E5A3B] shadow-sm">
            <Edit3 size={24} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
            Review & Edit Questions
          </h2>
        </div>
        <p className="text-gray-600 text-sm sm:text-base font-medium max-w-2xl leading-relaxed">
          Review, edit, or add questions. All questions from your CSV are shown
          below.
        </p>
      </div>

      <div className="bg-white border-2 border-[#A8E8BC]/30 rounded-[2rem] p-6 sm:p-8 shadow-sm transition-all hover:shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <label className="flex items-center gap-4 cursor-pointer group">
            <div
              className={`p-4 rounded-2xl transition-all duration-300 ${enablePerSectionTimers ? "bg-[#C9F4D4]" : "bg-gray-100 group-hover:bg-gray-200"}`}
            >
              <Clock
                className={
                  enablePerSectionTimers ? "text-[#1E5A3B]" : "text-gray-400"
                }
                size={24}
              />
            </div>
            <div className="pr-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={enablePerSectionTimers}
                  onChange={(e) =>
                    handleEnablePerSectionTimersChange(e.target.checked)
                  }
                  className="w-5 h-5 rounded border-gray-300 text-[#1E5A3B] focus:ring-[#1E5A3B] cursor-pointer"
                />
                <span className="font-bold text-gray-900 text-lg">
                  Enable Per-Section Timer
                </span>
              </div>
              <p className="text-gray-500 text-sm mt-1 leading-snug">
                Each section (MCQ/Subjective/Coding) will have its own timer.
                Sections will be locked when their timer expires.
              </p>
            </div>
          </label>
        </div>

        {enablePerSectionTimers && (
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in slide-in-from-top-2">
            {[
              {
                id: "MCQ",
                label: "MCQ Timer (minutes):",
                count: mcqCount,
                text: "in MCQ section",
              },
              {
                id: "Subjective",
                label: "Subjective Timer (minutes):",
                count: subjectiveCount,
                text: "in Subjective section",
              },
              {
                id: "Coding",
                label: "Coding Timer (minutes):",
                count: codingCount,
                text: "in Coding section",
              },
            ].map(
              (section) =>
                section.count > 0 && (
                  <div
                    key={section.id}
                    className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3"
                  >
                    <label className="block text-xs font-black text-[#1E5A3B] uppercase tracking-wider">
                      {section.label}
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="1"
                        value={(sectionTimers as any)[section.id]}
                        onChange={(e) =>
                          handleSectionTimerChange(
                            section.id as any,
                            e.target.value,
                          )
                        }
                        className="w-24 px-3 py-2 rounded-lg border-2 border-emerald-100 focus:border-[#10b981] outline-none font-bold text-[#1E5A3B]"
                      />
                      <span className="text-[11px] text-[#4A9A6A] font-bold leading-tight">
                        {section.count} question{section.count !== 1 ? "s" : ""}{" "}
                        {section.text}
                      </span>
                    </div>
                  </div>
                ),
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center bg-white rounded-[2rem] p-6 text-gray-900 shadow-[0_10px_40px_rgba(0,0,0,0.04)] gap-4 sticky top-4 z-40 border-2 border-[#C9F4D4]/40 backdrop-blur-md bg-white/90">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-[#C9F4D4] rounded-2xl text-[#1E5A3B] shadow-sm">
            <Layers size={22} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 leading-none mb-1.5">
              Assessment Data
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xl font-extrabold text-[#1E5A3B] tracking-tight">
                Total Questions: {questionsWithIds.length}
              </span>
              <span className="text-[10px] font-black text-[#1E5A3B] bg-[#C9F4D4] px-2.5 py-1 rounded-lg uppercase tracking-tighter">
                MCQ: {mcqCount} | Sub: {subjectiveCount} | Code: {codingCount}
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowAddForm(true);
            setEditingQuestion(null);
            resetForm("mcq");
          }}
          className="w-full sm:w-auto px-8 py-3.5 bg-[#C9F4D4] text-[#1E5A3B] rounded-2xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-2 transition-all hover:opacity-90 active:scale-95 shadow-md shadow-[#C9F4D4]/20"
        >
          <Plus size={20} strokeWidth={3} /> Add Question
        </button>
      </div>

      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl border border-white/20 animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden max-h-[90vh]">
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center shrink-0 bg-white">
              <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                <div className="w-2 h-6 bg-[#10b981] rounded-full" />
                {editingQuestion ? "Edit Question" : "Add New Question"}
              </h3>
              <button
                onClick={() => setShowAddForm(false)}
                className="p-2 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto grow space-y-6 custom-scrollbar">
              {!editingQuestion && (
                <div className="space-y-3">
                  <label className="text-xs font-black text-[#0A5F38] uppercase tracking-widest px-1">
                    Question Type
                  </label>
                  <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
  <button
    onClick={() => resetForm("mcq")}
    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${newQuestionType === "mcq" ? "bg-[#C9F4D4] text-[#1E5A3B] shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
  >
    MCQ
  </button>
  <button
    onClick={() => resetForm("subjective")}
    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${newQuestionType === "subjective" ? "bg-[#C9F4D4] text-[#1E5A3B] shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
  >
    Subjective
  </button>
  <button
    onClick={() => resetForm("coding")}
    className={`flex-1 py-2.5 rounded-lg font-bold text-sm transition-all ${newQuestionType === "coding" ? "bg-[#C9F4D4] text-[#1E5A3B] shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
  >
    Coding
  </button>
</div>
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-black text-[#0A5F38] uppercase tracking-widest px-1">
                    Question <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={newQuestion.question || ""}
                    onChange={(e) =>
                      setNewQuestion({
                        ...newQuestion,
                        question: e.target.value,
                      })
                    }
                    className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-[#10b981] focus:bg-white outline-none transition-all resize-none font-medium text-gray-800"
                    rows={3}
                    placeholder="Enter your question"
                  />
                </div>

                {newQuestionType === "mcq" && (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-[#0A5F38] uppercase tracking-widest px-1">
                        Answer Type <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={
                          (newQuestion as Partial<MCQQuestion>).answerType ||
                          "single"
                        }
                        onChange={(e) =>
                          setNewQuestion((prev) => ({
                            ...(prev as any),
                            answerType: e.target.value,
                          }))
                        }
                        className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none font-bold text-gray-700"
                      >
                        <option value="single">Single Choice</option>
                        <option value="multiple_all">
                          Multiple Choice (All Required)
                        </option>
                        <option value="multiple_any">
                          Multiple Choice (Any One)
                        </option>
                      </select>
                    </div>

                    <div className="space-y-4">
                      <label className="text-xs font-black text-[#0A5F38] uppercase tracking-widest px-1">
                        Options
                      </label>
                      {(
                        (newQuestion as Partial<MCQQuestion>).options || []
                      ).map((option, idx) => (
                        <div key={idx} className="flex gap-3 group">
                          <div className="w-12 h-12 bg-[#C9F4D4] flex items-center justify-center font-black text-[#1E5A3B] rounded-xl shrink-0 border-2 border-transparent transition-all">
                            {option.label}
                          </div>
                          <input
                            type="text"
                            value={option.text}
                            onChange={(e) => {
                              const options = [
                                ...((newQuestion as Partial<MCQQuestion>)
                                  .options || []),
                              ];
                              options[idx].text = e.target.value;
                              setNewQuestion({
                                ...newQuestion,
                                options,
                              } as any);
                            }}
                            className="flex-1 px-4 border-2 border-gray-100 rounded-xl outline-none focus:border-[#10b981] font-medium"
                            placeholder={`Option ${option.label}`}
                          />
                          {((newQuestion as Partial<MCQQuestion>).options || [])
                            .length > 2 && (
                            <button
                              onClick={() =>
                                removeOption(
                                  newQuestion as Partial<MCQQuestion>,
                                  idx,
                                )
                              }
                              className="p-3 bg-[#C9F4D4] text-red-500 rounded-xl transition-all shadow-sm"
                            >
                              <Trash2 size={20} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        onClick={() =>
                          addOption(newQuestion as Partial<MCQQuestion>)
                        }
                        className="flex items-center justify-center gap-2 bg-[#C9F4D4] text-[#1E5A3B] px-6 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-all"
                      >
                        <Plus size={18} strokeWidth={3} /> Add Option
                      </button>
                    </div>

                    <div className="p-5 bg-amber-50 rounded-[1.5rem] border border-amber-100 space-y-3">
                      <label className="flex items-center gap-2 text-xs font-black text-amber-700 uppercase tracking-widest">
                        <AlertCircle size={14} /> Correct Answer(s)
                      </label>
                      <input
                        type="text"
                        value={
                          (newQuestion as Partial<MCQQuestion>).correctAn || ""
                        }
                        onChange={(e) =>
                          setNewQuestion((prev) => ({
                            ...(prev as any),
                            correctAn: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="A or A,B"
                        className="w-full px-4 py-3 bg-white border-2 border-amber-200 rounded-xl outline-none font-black text-amber-900 placeholder:text-amber-200"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-black text-[#0A5F38] uppercase tracking-widest px-1">
                    Marks
                  </label>
                  <input
                    type="number"
                    value={newQuestion.marks || 1}
                    onChange={(e) =>
                      setNewQuestion({
                        ...newQuestion,
                        marks: parseInt(e.target.value) || 1,
                      })
                    }
                    min={1}
                    className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-xl outline-none focus:border-[#10b981] font-bold"
                  />
                </div>
              </div>
            </div>

            <div className="p-8 bg-gray-50 border-t flex gap-3 shrink-0">
              <button
                onClick={handleSaveQuestion}
                className="flex-1 bg-[#C9F4D4] text-[#1E5A3B] py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-lg active:scale-95"
              >
                <Save size={20} />{" "}
                {editingQuestion ? "Save Changes" : "Add Question"}
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingQuestion(null);
                  resetForm("mcq");
                }}
                className="px-8 bg-[#C9F4D4] text-[#1E5A3B] py-4 rounded-2xl font-bold hover:opacity-90 transition-all uppercase text-xs tracking-widest shadow-md"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {questionsWithIds.map((question, idx) => {
          const isMCQ =
            question.questionType === "mcq" ||
            ("options" in question && "correctAn" in question);
          const isCoding = question.questionType === "coding";
          return (
            <div
              key={question.id || idx}
              className="group bg-white border border-slate-200 rounded-[1.5rem] p-6 transition-all hover:border-[#10b981] hover:shadow-xl relative overflow-hidden"
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-6">
                <div className="flex-1 space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#0A5F38] text-white text-xs font-black">
                      Q{idx + 1}
                    </span>
                    {question.section &&
                      question.section.toLowerCase() !==
                        question.questionType?.toLowerCase() && (
                        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                          <FileText size={12} className="text-slate-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            [{question.section}]
                          </span>
                        </div>
                      )}
                    <span
                      className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${
                        isMCQ
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          : isCoding
                            ? "bg-blue-50 text-blue-700 border border-blue-100"
                            : "bg-orange-50 text-orange-700 border border-orange-100"
                      }`}
                    >
                      {isMCQ ? "MCQ" : isCoding ? "Coding" : "Subjective"}
                    </span>
                    <span className="text-[10px] font-bold text-[#1E5A3B] bg-[#C9F4D4]/30 px-2 py-1 rounded-lg border border-[#C9F4D4]/50">
                      {question.marks} marks
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-900 leading-snug">
                    {question.question}
                  </p>
                  {isMCQ && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      {(question as MCQQuestion).options?.map((opt, optIdx) => {
                        const isCorrect = (question as MCQQuestion).correctAn
                          ?.split(",")
                          .includes(opt.label);
                        return (
                          <div
                            key={optIdx}
                            className={`flex items-center gap-3 p-3 rounded-xl border ${isCorrect ? "bg-emerald-50/50 border-emerald-200" : "bg-slate-50 border-transparent"}`}
                          >
                            <span
                              className={`w-6 h-6 flex items-center justify-center rounded-md font-black text-[10px] ${isCorrect ? "bg-[#10b981] text-white" : "bg-white text-slate-400 border border-slate-200"}`}
                            >
                              {opt.label}
                            </span>
                            <span
                              className={`text-sm font-semibold ${isCorrect ? "text-emerald-900" : "text-slate-600"}`}
                            >
                              {opt.text}
                            </span>
                            {isCorrect && (
                              <CheckCircle2
                                size={14}
                                className="ml-auto text-[#10b981]"
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <div className="flex md:flex-col gap-2 shrink-0 md:opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(question, idx)}
                    className="p-3 bg-[#C9F4D4] text-[#1E5A3B] rounded-xl transition-all border border-transparent shadow-sm"
                  >
                    <Edit3 size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(question.id!)}
                    className="p-3 bg-[#C9F4D4] text-red-500 rounded-xl transition-all border border-transparent shadow-sm"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {questionsWithIds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200 text-center space-y-4 font-sans">
            <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-300">
              <FileText size={32} />
            </div>
            <p className="font-bold text-slate-500">
              No questions yet. Add questions or upload a CSV file.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
