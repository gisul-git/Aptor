import { useState, useRef } from "react";
import { CustomMCQAssessment } from "../../types/custom-mcq";
import { customMCQApi } from "../../lib/custom-mcq/api";
import { 
  UploadCloud, 
  FileDown, 
  CheckCircle2, 
  AlertCircle, 
  Code2, 
  MessageSquare, 
  ListChecks,
  FileSpreadsheet,
  ArrowRight,
  Check
} from "lucide-react";

interface Station2Props {
  assessmentData: Partial<CustomMCQAssessment>;
  updateAssessmentData: (updates: Partial<CustomMCQAssessment>) => void;
}

const REQUIRED_COLUMNS: Record<"mcq" | "subjective" | "coding", string[]> = {
  mcq:        ["section", "question", "optiona", "optionb", "optionc", "optiond", "correctan", "answertype", "marks"],
  subjective: ["question", "marks"],
  coding:     ["section", "question", "marks"],
};

const MCQ_EXCLUSIVE_COLUMNS = ["optiona", "optionb", "optionc", "optiond", "correctan", "answertype"];

type QuestionType = "mcq" | "subjective" | "coding";

// Per-type state shape
interface TypeState {
  uploadedFile: File | null;
  questions: any[];
  success: string | null;
  error: string | null;
}

const defaultTypeState = (): TypeState => ({
  uploadedFile: null,
  questions: [],
  success: null,
  error: null,
});

export default function Station2UploadCSV({ assessmentData, updateAssessmentData }: Station2Props) {
  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);

  // Each type maintains its own history
  const [typeStates, setTypeStates] = useState<Record<QuestionType, TypeState>>({
    mcq:        defaultTypeState(),
    subjective: defaultTypeState(),
    coding:     defaultTypeState(),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentState = typeStates[questionType];

  const setCurrentTypeState = (updates: Partial<TypeState>) => {
    setTypeStates(prev => ({
      ...prev,
      [questionType]: { ...prev[questionType], ...updates },
    }));
  };

  // Merge all type questions into assessmentData whenever any type's questions change
  const mergeAndUpdate = (type: QuestionType, questions: any[]) => {
    setTypeStates(prev => {
      const updated = {
        ...prev,
        [type]: { ...prev[type], questions },
      };
      // Merge all types into one flat array for assessmentData
      const allQuestions = [
        ...updated.mcq.questions,
        ...updated.subjective.questions,
        ...updated.coding.questions,
      ];
      updateAssessmentData({ questions: allQuestions });
      return updated;
    });
  };

  const handleQuestionTypeChange = (type: QuestionType) => {
    if (type === questionType) return;
    setQuestionType(type);
    // Reset file input so same file can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const validateCSVColumns = (file: File): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (!text) return reject(new Error("Could not read file."));

        const headerLine = text.split("\n").find((line) => line.trim() !== "");
        if (!headerLine) return reject(new Error("The CSV file appears to be empty."));

        const actualColumns = headerLine
          .split(",")
          .map((col) => col.trim().toLowerCase().replace(/[^a-z0-9]/g, ""));

        const required = REQUIRED_COLUMNS[questionType];
        const missing = required.filter((col) => !actualColumns.includes(col));

        if (missing.length > 0) {
          return reject(new Error(
            `Invalid CSV format for ${questionType.toUpperCase()} questions. ` +
            `Missing columns: ${missing.join(", ")}. ` +
            `Expected columns: ${required.join(", ")}.`
          ));
        }

        // Reject MCQ files for non-MCQ types
        if (questionType !== "mcq") {
          const foundMCQCols = MCQ_EXCLUSIVE_COLUMNS.filter(col => actualColumns.includes(col));
          if (foundMCQCols.length > 0) {
            return reject(new Error(
              `This looks like an MCQ CSV file, not ${questionType.toUpperCase()}. ` +
              `Please upload the correct format. Expected columns: ${required.join(", ")}.`
            ));
          }
        }

        // Reject coding files for subjective type
        // Coding CSVs always have a "section" column, subjective CSVs must NOT have it
        if (questionType === "subjective" && actualColumns.includes("section")) {
          return reject(new Error(
            `This looks like a CODING CSV file, not SUBJECTIVE. ` +
            `Subjective questions must not have a "section" column. ` +
            `Expected columns: question, marks only.`
          ));
        }

        // Reject subjective files for coding type
        // Coding CSVs require "section" column
        if (questionType === "coding" && !actualColumns.includes("section")) {
          return reject(new Error(
            `This looks like a SUBJECTIVE CSV file, not CODING. ` +
            `Coding questions require a "section" column. ` +
            `Expected columns: section, question, marks.`
          ));
        }

        resolve();
      };
      reader.onerror = () => reject(new Error("Failed to read the file."));
      reader.readAsText(file);
    });
  };

  const handleDownloadSample = async () => {
    try {
      const blob = await customMCQApi.downloadSampleCSV(questionType);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sample_${questionType}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setCurrentTypeState({ error: err.message || "Failed to download sample CSV" });
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      setCurrentTypeState({ error: null, success: null });

      await validateCSVColumns(file);

      const result = await customMCQApi.uploadCSV(file, questionType);

      setCurrentTypeState({
        uploadedFile: file,
        questions: result.questions,
        success: `Successfully uploaded! Found ${result.totalQuestions} valid ${questionType} questions.`,
        error: null,
      });

      mergeAndUpdate(questionType, result.questions);
    } catch (err: any) {
      setCurrentTypeState({
        error: err.message || "Failed to upload CSV",
        uploadedFile: null,
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleValidate = () => {
    const allQuestions = [
      ...typeStates.mcq.questions,
      ...typeStates.subjective.questions,
      ...typeStates.coding.questions,
    ];
    if (allQuestions.length === 0) {
      setCurrentTypeState({ error: "Please upload a CSV file first" });
      return;
    }
    setCurrentTypeState({ success: `CSV validated! ${allQuestions.length} total questions are ready.` });
  };

  const sampleColumnHint = {
    subjective: "Columns: question, marks",
    coding: "Columns: section, question, marks",
    mcq: "Columns: section, question, optionA, optionB, optionC, optionD, correctAn, answerType, marks",
  }[questionType];

  const totalQuestions = [
    ...typeStates.mcq.questions,
    ...typeStates.subjective.questions,
    ...typeStates.coding.questions,
  ].length;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#C9F4D4] rounded-2xl text-emerald-900 shadow-sm">
            <UploadCloud size={28} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight leading-[1.2]">Upload CSV</h2>
        </div>
        <p className="text-gray-600 text-sm sm:text-base leading-normal max-w-2xl font-normal">
          Upload your questions in CSV format. You can upload different types independently.
        </p>
      </div>

      {/* Per-type uploaded summary pills */}
      <div className="flex flex-wrap gap-2">
        {(["mcq", "subjective", "coding"] as QuestionType[]).map(type => (
          typeStates[type].questions.length > 0 && (
            <div key={type} className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-[#C9F4D4]/50 px-4 py-1.5 rounded-full border border-emerald-200">
              <Check size={13} strokeWidth={3} />
              {type.toUpperCase()}: {typeStates[type].questions.length} questions
            </div>
          )
        ))}
      </div>

      <div className="space-y-4">
        {currentState.error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-800 animate-in zoom-in-95 duration-300">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-medium">{currentState.error}</p>
          </div>
        )}
        {currentState.success && (
          <div className="flex items-center gap-3 p-4 bg-[#C9F4D4]/30 border border-[#C9F4D4] rounded-xl text-emerald-900 animate-in zoom-in-95 duration-300">
            <CheckCircle2 size={20} className="shrink-0" />
            <p className="text-sm font-medium">{currentState.success}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Question Type Selector */}
        <section className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <ListChecks size={18} className="text-gray-400" />
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Question Type</h3>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { id: "mcq", label: "MCQ Questions", icon: <ListChecks size={18} /> },
              { id: "subjective", label: "Subjective Questions", icon: <MessageSquare size={18} /> },
              { id: "coding", label: "Coding Questions", icon: <Code2 size={18} /> },
            ].map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => handleQuestionTypeChange(type.id as QuestionType)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 border-2 ${
                  questionType === type.id
                    ? "bg-[#C9F4D4] border-[#C9F4D4] text-emerald-900 shadow-md scale-105"
                    : "bg-white border-gray-100 text-gray-600 hover:bg-[#C9F4D4]/20"
                }`}
              >
                {type.icon}
                {type.label}
                {typeStates[type.id as QuestionType].questions.length > 0 && (
                  <span className="ml-1 bg-emerald-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {typeStates[type.id as QuestionType].questions.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sample Download */}
          <section className="bg-gray-50/50 p-6 rounded-2xl border border-gray-200 flex flex-col justify-between">
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-emerald-700" />
                <h3 className="text-lg font-semibold text-gray-900">Sample CSV File</h3>
              </div>
              <p className="text-sm text-gray-500 font-normal leading-relaxed">
                Download the sample CSV file for {questionType} questions with {sampleColumnHint}.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDownloadSample}
              className="w-full flex items-center justify-center gap-2 py-3 bg-[#C9F4D4] text-emerald-900 rounded-xl font-bold hover:opacity-90 transition-all shadow-sm active:scale-[0.98]"
            >
              <FileDown size={18} strokeWidth={2.5} />
              Download {questionType.toUpperCase()} Sample
            </button>
          </section>

          {/* File Upload */}
          <section className="bg-white p-6 rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#C9F4D4] transition-all flex flex-col items-center justify-center text-center space-y-4">
            <div className={`p-4 rounded-full transition-all duration-300 ${currentState.uploadedFile ? 'bg-[#C9F4D4]' : 'bg-gray-50 text-gray-400'}`}>
              <UploadCloud size={32} className={uploading ? "animate-bounce text-emerald-900" : ""} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">Upload Your CSV File</h3>
              <p className="text-xs text-gray-400 font-medium">
                {currentState.uploadedFile ? `Uploaded: ${currentState.uploadedFile.name}` : "Auto-validation will run upon select"}
              </p>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-8 py-3 bg-[#C9F4D4] text-emerald-900 rounded-xl font-bold hover:opacity-90 transition-all shadow-md active:scale-95 disabled:bg-gray-200 disabled:text-gray-400"
            >
              {uploading ? "Uploading..." : currentState.uploadedFile ? "Re-upload" : "Select File"}
            </button>

            {currentState.uploadedFile && (
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-[#C9F4D4]/50 px-4 py-1.5 rounded-full animate-in slide-in-from-top-1">
                <Check size={14} strokeWidth={3} />
                {currentState.uploadedFile.name}
              </div>
            )}
          </section>
        </div>

        {/* Validate Button */}
        <div className="pt-4 space-y-4">
          {totalQuestions > 0 && (
            <div className="flex items-center justify-center gap-2 text-emerald-900 font-bold bg-[#C9F4D4] py-3 rounded-full w-fit mx-auto px-10 border-2 border-emerald-200 shadow-sm animate-in fade-in zoom-in duration-500">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
              </span>
              {totalQuestions} questions loaded and validated
            </div>
          )}
        </div>
      </div>
    </div>
  );
}