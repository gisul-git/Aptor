import { useState, useEffect } from "react";
import { CustomMCQAssessment } from "../../types/custom-mcq";
import { ClipboardCheck, AlignLeft, Info } from "lucide-react";

interface Station1Props {
  assessmentData: Partial<CustomMCQAssessment>;
  updateAssessmentData: (updates: Partial<CustomMCQAssessment>) => void;
}

export default function Station1AssessmentInfo({ assessmentData, updateAssessmentData }: Station1Props) {
  const [title, setTitle] = useState(assessmentData.title || "");
  const [description, setDescription] = useState(assessmentData.description || "");

  useEffect(() => {
    if (title !== assessmentData.title || description !== assessmentData.description) {
      updateAssessmentData({ title, description });
    }
  }, [title, description]);

  return (
    <div className="w-full h-full max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Step Header */}
      <div className="mb-8">
      
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600">
            <ClipboardCheck size={32} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight">
            Assessment Information
          </h1>
        </div>
        <p className="mt-3 text-slate-500 text-lg font-medium">
          Set the stage by providing a title and context for your evaluation.
        </p>
      </div>

      {/* Input Container - Maintaining requested width/height via responsive containers */}
      <div className="bg-white border-2 border-emerald-50 rounded-[2rem] shadow-sm overflow-hidden p-8 md:p-10 space-y-8">
        
        {/* Assessment Title Field */}
        <div className="group space-y-3">
          <label
            htmlFor="title"
            className="flex items-center gap-2 text-sm font-bold text-slate-700 group-focus-within:text-emerald-600 transition-colors"
          >
       
            Assessment Title 
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Senior React Developer Interview"
            className="w-full px-5 py-4 rounded-xl border-2 border-slate-100 bg-slate-50/30 focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-300 text-slate-700 font-semibold"
            required
          />
        </div>

        {/* Description Field */}
        <div className="group space-y-3">
          <label
            htmlFor="description"
            className="flex items-center gap-2 text-sm font-bold text-slate-700 group-focus-within:text-emerald-600 transition-colors"
          >
            <AlignLeft size={16} />
            Description
            <span className="text-slate-400 font-normal ml-auto text-[10px] uppercase tracking-tighter">Optional</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What should candidates know about this assessment?"
            rows={5}
            className="w-full px-5 py-4 rounded-xl border-2 border-slate-100 bg-slate-50/30 focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all placeholder:text-slate-300 text-slate-700 font-medium resize-none"
          />
        </div>

        {/* Visual Tip to fill space impressively */}
        <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl flex gap-3 items-start">
          <div className="mt-1 bg-amber-100 p-1 rounded-full">
            <Info size={14} className="text-amber-600" />
          </div>
          <p className="text-xs text-amber-700 leading-relaxed italic">
            Tip: A clear description helps candidates understand the expectations and time commitment required for this assessment.
          </p>
        </div>
      </div>
    </div>
  );
}