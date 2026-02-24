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

export default function Station2UploadCSV({ assessmentData, updateAssessmentData }: Station2Props) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [questionType, setQuestionType] = useState<"mcq" | "subjective" | "coding">("mcq");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadSample = async () => {
    try {
      const blob = await customMCQApi.downloadSampleCSV(questionType);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      let filename = `sample_${questionType}.csv`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || "Failed to download sample CSV");
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      setError(null);
      setSuccess(null);
      const result = await customMCQApi.uploadCSV(file, questionType);
      const existingQuestions = assessmentData.questions || [];
      updateAssessmentData({ questions: [...existingQuestions, ...result.questions] });
      setSuccess(`Successfully uploaded! Found ${result.totalQuestions} valid ${questionType} questions.`);
      setUploadedFile(file);
    } catch (err: any) {
      setError(err.message || "Failed to upload CSV");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleValidate = async () => {
    if (!assessmentData.questions || assessmentData.questions.length === 0) {
      setError("Please upload a CSV file first");
      return;
    }
    setSuccess(`CSV validated! ${assessmentData.questions.length} questions are ready.`);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#C9F4D4] rounded-2xl text-emerald-900 shadow-sm">
            <UploadCloud size={28} strokeWidth={2.5} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight leading-[1.2]">Upload CSV</h2>
        </div>
        <p className="text-gray-600 text-sm sm:text-base leading-normal max-w-2xl font-normal">
          Upload your questions in CSV format. Download the sample file to see the expected format.
        </p>
      </div>

      {/* Notifications Area */}
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-xl text-red-800 animate-in zoom-in-95 duration-300">
            <AlertCircle size={20} className="shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-3 p-4 bg-[#C9F4D4]/30 border border-[#C9F4D4] rounded-xl text-emerald-900 animate-in zoom-in-95 duration-300">
            <CheckCircle2 size={20} className="shrink-0" />
            <p className="text-sm font-medium">{success}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Step 1: Question Type Selector */}
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
                onClick={() => setQuestionType(type.id as any)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all duration-300 border-2 ${
                  questionType === type.id
                    ? "bg-[#C9F4D4] border-[#C9F4D4] text-emerald-900 shadow-md scale-105"
                    : "bg-white border-gray-100 text-gray-600 hover:bg-[#C9F4D4]/20"
                }`}
              >
                {type.icon}
                {type.label}
              </button>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Step 2: Sample Download Card */}
          <section className="bg-gray-50/50 p-6 rounded-2xl border border-gray-200 flex flex-col justify-between group">
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-emerald-700" />
                <h3 className="text-lg font-semibold text-gray-900">Sample CSV File</h3>
              </div>
              <p className="text-sm text-gray-500 font-normal leading-relaxed">
                {questionType === "subjective" 
                  ? "Download the sample CSV file for subjective questions with columns: question, marks"
                  : questionType === "coding"
                  ? "Download the sample CSV file for coding questions with columns: section, question, marks"
                  : "Download the sample CSV file for MCQ questions with columns: section, question, optionA, optionB, optionC, optionD, correctAn, answerType, marks"}
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

          {/* Step 3: File Input Card */}
          <section className="bg-white p-6 rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#C9F4D4] transition-all flex flex-col items-center justify-center text-center space-y-4">
            <div className={`p-4 rounded-full transition-all duration-300 ${uploadedFile ? 'bg-[#C9F4D4]' : 'bg-gray-50 text-gray-400'}`}>
              <UploadCloud size={32} className={uploading ? "animate-bounce text-emerald-900" : ""} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-gray-900 tracking-tight">Upload Your CSV File</h3>
              <p className="text-xs text-gray-400 font-medium">Auto-validation will run upon select</p>
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
              {uploading ? "Uploading..." : "Select File"}
            </button>
            
            {uploadedFile && (
              <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs bg-[#C9F4D4]/50 px-4 py-1.5 rounded-full animate-in slide-in-from-top-1">
                <Check size={14} strokeWidth={3} />
                {uploadedFile.name}
              </div>
            )}
          </section>
        </div>

        {/* Step 4: Final Validation Bar */}
        <div className="pt-4 space-y-4">
          <button
            type="button"
            onClick={handleValidate}
            disabled={validating || !assessmentData.questions || assessmentData.questions.length === 0}
            className={`w-full py-5 rounded-2xl font-bold text-xl tracking-tight transition-all duration-300 flex items-center justify-center gap-3 shadow-xl ${
              assessmentData.questions && assessmentData.questions.length > 0
                ? "bg-[#C9F4D4] text-emerald-900 hover:-translate-y-1 active:translate-y-0"
                : "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200 shadow-none"
            }`}
          >
            {validating ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-emerald-900/30 border-t-emerald-900 rounded-full animate-spin" />
                Validating CSV Content...
              </div>
            ) : (
              <>
                <Check size={24} strokeWidth={3} />
                Validate CSV File
                <ArrowRight size={20} className="ml-2 opacity-50" />
              </>
            )}
          </button>
          
          {assessmentData.questions && assessmentData.questions.length > 0 && (
            <div className="flex items-center justify-center gap-2 text-emerald-900 font-bold bg-[#C9F4D4] py-3 rounded-full w-fit mx-auto px-10 border-2 border-emerald-200 shadow-sm animate-in fade-in zoom-in duration-500">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-600"></span>
              </span>
              {assessmentData.questions.length} questions loaded and validated
            </div>
          )}
        </div>
      </div>
    </div>
  );
}