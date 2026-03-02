import { useState, useRef } from "react";
import { CustomMCQAssessment, Candidate } from "../../types/custom-mcq";
import { 
  UserPlus, 
  UploadCloud, 
  FileDown, 
  Trash2, 
  Users, 
  Mail, 
  User, 
  ShieldCheck, 
  Info,
  CheckCircle2
} from "lucide-react";

interface Station4Props {
  assessmentData: Partial<CustomMCQAssessment>;
  updateAssessmentData: (updates: Partial<CustomMCQAssessment>) => void;
}

export default function Station4AddCandidates({ assessmentData, updateAssessmentData }: Station4Props) {
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const candidates = assessmentData.candidates || [];
  const accessMode = assessmentData.accessMode || "private";

  const handleAddCandidate = () => {
    if (!manualName.trim() || !manualEmail.trim()) {
      alert("Please enter both name and email");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(manualEmail)) {
      alert("Please enter a valid email address");
      return;
    }
    if (candidates.some((c) => c.email.toLowerCase() === manualEmail.toLowerCase())) {
      alert("A candidate with this email already exists");
      return;
    }
    const newCandidates = [...candidates, { name: manualName.trim(), email: manualEmail.trim().toLowerCase() }];
    updateAssessmentData({ candidates: newCandidates });
    setManualName("");
    setManualEmail("");
  };

  const handleRemoveCandidate = (email: string) => {
    const newCandidates = candidates.filter((c) => c.email !== email);
    updateAssessmentData({ candidates: newCandidates });
  };

  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true);
      let text = await file.text();
      if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
      const lines = text.split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) {
        alert("CSV file must have at least a header and one data row");
        return;
      }
      const rawHeaders = parseCSVLine(lines[0]);
      const headers = rawHeaders.map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase().replace(/\s+/g, ' '));
      const nameIndex = headers.findIndex((h) => h === "name" || h === "candidate name" || h === "full name" || h === "student name");
      const emailIndex = headers.findIndex((h) => h === "email" || h === "email address" || h === "e-mail" || h === "email id");

      if (nameIndex === -1 || emailIndex === -1) {
        alert(`CSV must have 'name' and 'email' columns.\n\nFound columns: ${headers.join(', ')}`);
        return;
      }
      const newCandidates: Candidate[] = [];
      const existingEmails = new Set(candidates.map((c) => c.email.toLowerCase()));
      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]).map((v) => v.replace(/^"|"$/g, '').trim());
        const name = values[nameIndex];
        const email = values[emailIndex]?.toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (name && email && emailRegex.test(email) && !existingEmails.has(email)) {
          newCandidates.push({ name, email });
          existingEmails.add(email);
        }
      }
      if (newCandidates.length === 0) {
        alert("No valid candidates found in CSV file");
        return;
      }
      updateAssessmentData({ candidates: [...candidates, ...newCandidates] });
      alert(`Successfully added ${newCandidates.length} candidates`);
    } catch (err: any) {
      alert(err.message || "Failed to upload CSV file");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handleDownloadSampleCSV = () => {
    const sampleData = [["name", "email"], ["John Doe", "john.doe@example.com"], ["Jane Smith", "jane.smith@example.com"]];
    const csvContent = sampleData.map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sample_candidates.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (accessMode === "public") {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#C9F4D4] rounded-2xl text-[#1E5A3B] shadow-sm">
              <Users size={28} strokeWidth={2.5} />
            </div>
            <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight"> Add Candidates</h2>
          </div>
          <p className="text-gray-600 text-lg font-medium leading-relaxed">
            Since you selected <strong>Public</strong> access mode, anyone with the assessment link can take the test. You can skip adding candidates manually, or add them for reference.
          </p>
        </div>

        <div className="p-8 bg-[#E8FAF0] rounded-[2rem] border-2 border-[#A8E8BC]/30 flex items-start gap-4">
          <div className="p-2 bg-white rounded-full text-[#2D7A52] shrink-0">
            <ShieldCheck size={24} />
          </div>
          <p className="text-[#2D7A52] text-lg font-semibold leading-relaxed m-0">
            <strong>Note:</strong> In public mode, candidates are not restricted. You can still add candidates below for your reference.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-[#C9F4D4] rounded-2xl text-[#1E5A3B] shadow-sm">
            <Users size={28} strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight"> Add Candidates</h2>
        </div>
        <p className="text-gray-600 text-lg font-medium leading-relaxed">
          Add candidates who can take this assessment. You can add them manually or upload a CSV file.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Manual Entry Section */}
        <section className="bg-white p-8 rounded-[2rem] border-2 border-slate-100 shadow-sm transition-all hover:shadow-md">
          <div className="flex items-center gap-2 mb-6">
            <UserPlus size={20} className="text-[#1E5A3B]" />
            <h3 className="text-xl font-bold text-gray-800  uppercase  tracking-widest opacity-60">Add Candidate Manually</h3>
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1 group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1E5A3B] transition-colors" size={18} />
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Candidate Name"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-transparent focus:border-[#10b981] focus:bg-white rounded-xl outline-none transition-all font-semibold"
                onKeyPress={(e) => e.key === "Enter" && handleAddCandidate()}
              />
            </div>
            <div className="relative flex-1 group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#1E5A3B] transition-colors" size={18} />
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="Candidate Email"
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-transparent focus:border-[#10b981] focus:bg-white rounded-xl outline-none transition-all font-semibold"
                onKeyPress={(e) => e.key === "Enter" && handleAddCandidate()}
              />
            </div>
            <button 
              type="button" 
              onClick={handleAddCandidate} 
              className="px-8 py-3.5 bg-[#C9F4D4] text-[#1E5A3B] rounded-xl font-black text-sm uppercase tracking-wider transition-all hover:opacity-90 active:scale-95 shadow-lg shadow-[#C9F4D4]/20"
            >
              Add Candidate
            </button>
          </div>
        </section>

        {/* Bulk Upload Section */}
        <section className="bg-slate-50 p-8 rounded-[2rem] border-2 border-dashed border-slate-200 group transition-all hover:border-[#10b981]">
          <div className="flex items-center gap-2 mb-2">
            <UploadCloud size={20} className="text-[#1E5A3B]" />
            <h3 className="text-xl font-bold text-gray-800 tracking-tight uppercase  opacity-60">Bulk Upload from CSV</h3>
          </div>
          <p className="mb-6 text-slate-500 text-sm font-medium leading-relaxed">
            Upload a CSV file with columns: <strong className="text-slate-800">name, email</strong>
            <br/>
            <span className="text-xs opacity-70 italic flex items-center gap-1 mt-1">
              <Info size={12} /> Note: If you have an Excel file, please export it as CSV format first (File → Save As → CSV)
            </span>
          </p>
          <div className="flex flex-wrap gap-4 items-center">
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 px-8 py-3.5 bg-[#C9F4D4] text-[#1E5A3B] border-2 border-transparent rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:opacity-90 active:scale-95 shadow-md"
            >
              {uploading ? "Uploading..." : <><UploadCloud size={18} />  Upload CSV File</>}
            </button>
            <button
              type="button"
              onClick={handleDownloadSampleCSV}
              className="flex items-center gap-2 px-8 py-3.5 bg-[#C9F4D4] text-[#1E5A3B] border-2 border-transparent rounded-xl font-black text-xs uppercase tracking-widest transition-all hover:opacity-90 active:scale-95 shadow-md"
            >
              <FileDown size={18} />  Download Sample CSV
            </button>
          </div>
        </section>

        {/* Candidates List Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-xl font-black text-gray-900 tracking-tight">
              Candidates <span className="ml-2 text-sm font-bold bg-[#C9F4D4] text-[#1E5A3B] px-3 py-1 rounded-full">{candidates.length}</span>
            </h3>
          </div>

          {candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 bg-white rounded-[2rem] border-2 border-dashed border-slate-100 text-center space-y-3">
              <Users size={48} className="text-slate-200" />
              <p className="font-bold text-slate-400 max-w-xs">No candidates added yet. Add candidates manually or upload a CSV file.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {candidates.map((candidate, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-5 bg-white border-2 border-slate-50 rounded-2xl hover:border-[#C9F4D4] hover:shadow-lg transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 group-hover:bg-[#C9F4D4] group-hover:text-[#1E5A3B] transition-colors">
                      {candidate.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-black text-slate-800 leading-none mb-1">{candidate.name}</h4>
                      <p className="text-xs font-bold text-slate-400">{candidate.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCandidate(candidate.email)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    title="Remove candidate"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}