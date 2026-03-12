import React, { useState, useEffect, useRef, useMemo } from "react";
import { CustomMCQAssessment } from "../../types/custom-mcq";
import { customMCQApi } from "../../lib/custom-mcq/api";
import EmailInvitationModal from "./EmailInvitationModal";
import { 
  Calendar, 
  Lock, 
  Globe, 
  Zap, 
  Clock, 
  Target, 
  ShieldAlert, 
  UserCheck, 
  CheckCircle2, 
  Copy, 
  Mail, 
  LayoutDashboard,
  Eye,
  Settings2,
  Phone,
  Linkedin,
  Github
} from "lucide-react";

interface Station5Props {
  assessmentData: Partial<CustomMCQAssessment>;
  updateAssessmentData: (updates: Partial<CustomMCQAssessment>) => void;
  onCreateAssessment: () => void;
  loading: boolean;
  createdAssessmentUrl?: string | null;
  assessmentId?: string | null;
  router?: any;
}

function utcToLocalDatetimeLocal(utcIsoString: string): string {
  if (!utcIsoString) return "";
  const date = new Date(utcIsoString);
  if (isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function Station5Schedule({ assessmentData, updateAssessmentData, onCreateAssessment, loading, createdAssessmentUrl, assessmentId, router }: Station5Props) {
  const wasEditingRef = useRef<boolean>(!!assessmentId && !createdAssessmentUrl);
  const [accessMode, setAccessMode] = useState<"private" | "public">(assessmentData.accessMode || "private");
  const [examMode, setExamMode] = useState<"strict" | "flexible">(assessmentData.examMode || "strict");
  const scheduleStartTime = (assessmentData as any)?.schedule?.startTime || assessmentData.startTime;
  const scheduleEndTime = (assessmentData as any)?.schedule?.endTime || assessmentData.endTime;
  const scheduleDuration = (assessmentData as any)?.schedule?.duration || assessmentData.duration;
  
  const [startTime, setStartTime] = useState(scheduleStartTime ? utcToLocalDatetimeLocal(scheduleStartTime) : "");
  const [endTime, setEndTime] = useState(scheduleEndTime ? utcToLocalDatetimeLocal(scheduleEndTime) : "");
  const [duration, setDuration] = useState(scheduleDuration?.toString() || "");
  const [passPercentage, setPassPercentage] = useState(assessmentData.passPercentage?.toString() || "50");
  
  const enablePerSectionTimers = useMemo(() => (assessmentData as any)?.enablePerSectionTimers || false, [assessmentId]);
  const sectionTimers = useMemo(() => (assessmentData as any)?.sectionTimers || {}, [assessmentId]);
  
  const [aiProctoringEnabled, setAiProctoringEnabled] = useState((assessmentData as any)?.proctoringSettings?.aiProctoringEnabled ?? false);
  const [faceMismatchEnabled, setFaceMismatchEnabled] = useState((assessmentData as any)?.proctoringSettings?.faceMismatchEnabled ?? false);
  const [liveProctoringEnabled, setLiveProctoringEnabled] = useState((assessmentData as any)?.proctoringSettings?.liveProctoringEnabled ?? false);
  
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [invitationsSent, setInvitationsSent] = useState(false);
  const [candidateCountWhenSent, setCandidateCountWhenSent] = useState<number>(0);
  
  const [requirePhone, setRequirePhone] = useState((assessmentData as any)?.schedule?.candidateRequirements?.requirePhone ?? false);
  const [requireLinkedIn, setRequireLinkedIn] = useState((assessmentData as any)?.schedule?.candidateRequirements?.requireLinkedIn ?? false);
  const [requireGithub, setRequireGithub] = useState((assessmentData as any)?.schedule?.candidateRequirements?.requireGithub ?? false);

  const hasSyncedFromDataRef = useRef<string | null>(null);
  const isUpdatingFromParentRef = useRef(false);
  const prevAssessmentIdRef = useRef<string | null | undefined>(assessmentId);
  const scheduleRef = useRef<any>((assessmentData as any)?.schedule || {});

  useEffect(() => {
    if (!assessmentId || hasSyncedFromDataRef.current === assessmentId) {
      prevAssessmentIdRef.current = assessmentId;
      return;
    }
    if (prevAssessmentIdRef.current === assessmentId) return;
    isUpdatingFromParentRef.current = true;
    
    const schedule = (assessmentData as any)?.schedule || {};
    const proctoringSettings = (assessmentData as any)?.proctoringSettings;
    
    if (assessmentData.accessMode) setAccessMode(assessmentData.accessMode);
    if (assessmentData.examMode) setExamMode(assessmentData.examMode);
    
    const sStartTime = schedule.startTime || assessmentData.startTime;
    const sEndTime = schedule.endTime || assessmentData.endTime;
    const sDuration = schedule.duration || assessmentData.duration;
    
    if (sStartTime) setStartTime(utcToLocalDatetimeLocal(sStartTime));
    if (sEndTime) setEndTime(utcToLocalDatetimeLocal(sEndTime));
    
    const perSectionTimersEnabled = (assessmentData as any)?.enablePerSectionTimers || false;
    const sectionTimersData = (assessmentData as any)?.sectionTimers || {};
    if (perSectionTimersEnabled && sectionTimersData) {
      const totalMinutes = (sectionTimersData.MCQ || 0) + (sectionTimersData.Subjective || 0);
      if (totalMinutes > 0) setDuration(totalMinutes.toString());
    } else if (sDuration !== undefined) {
      setDuration(sDuration.toString());
    }
    
    if (assessmentData.passPercentage !== undefined) setPassPercentage(assessmentData.passPercentage.toString());
    
    if (proctoringSettings) {
      setAiProctoringEnabled(proctoringSettings.aiProctoringEnabled ?? false);
      setFaceMismatchEnabled(proctoringSettings.faceMismatchEnabled ?? false);
      setLiveProctoringEnabled(proctoringSettings.liveProctoringEnabled ?? false);
    }

    const candidateReqs = schedule.candidateRequirements || {};
    setRequirePhone(candidateReqs.requirePhone ?? false);
    setRequireLinkedIn(candidateReqs.requireLinkedIn ?? false);
    setRequireGithub(candidateReqs.requireGithub ?? false);
    
    hasSyncedFromDataRef.current = assessmentId;
    prevAssessmentIdRef.current = assessmentId;
    setTimeout(() => { isUpdatingFromParentRef.current = false; }, 0);
  }, [assessmentId]);

  useEffect(() => {
    if (enablePerSectionTimers && sectionTimers) {
      const totalMinutes = (sectionTimers.MCQ || 0) + (sectionTimers.Subjective || 0) + (sectionTimers.Coding || 0);
      if (totalMinutes > 0) setDuration(totalMinutes.toString());
    }
  }, [enablePerSectionTimers, sectionTimers]);

  useEffect(() => {
    const currentSchedule = (assessmentData as any)?.schedule;
    if (currentSchedule && Object.keys(currentSchedule).length > 0) {
      scheduleRef.current = currentSchedule;
    }
  }, [assessmentId]);

  useEffect(() => {
    if (isUpdatingFromParentRef.current) return;
    let finalDuration = duration ? parseInt(duration) : undefined;
    if (enablePerSectionTimers && sectionTimers) {
      const totalMinutes = (sectionTimers.MCQ || 0) + (sectionTimers.Subjective || 0) + (sectionTimers.Coding || 0);
      if (totalMinutes > 0) finalDuration = totalMinutes;
    }
    const existingSchedule = scheduleRef.current || {};

    updateAssessmentData({
      accessMode,
      examMode,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      endTime: endTime ? new Date(endTime).toISOString() : undefined,
      duration: finalDuration,
      passPercentage: passPercentage ? parseInt(passPercentage) : 50,
      proctoringSettings: {
        aiProctoringEnabled,
        faceMismatchEnabled: aiProctoringEnabled ? faceMismatchEnabled : false,
        liveProctoringEnabled,
      },
      schedule: {
        ...existingSchedule,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        duration: finalDuration,
        candidateRequirements: { requirePhone, requireLinkedIn, requireGithub },
      },
    } as any);

    scheduleRef.current = {
      ...existingSchedule,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      endTime: endTime ? new Date(endTime).toISOString() : undefined,
      duration: finalDuration,
      candidateRequirements: { requirePhone, requireLinkedIn, requireGithub },
    };
  }, [accessMode, examMode, startTime, endTime, duration, passPercentage, aiProctoringEnabled, faceMismatchEnabled, liveProctoringEnabled, requirePhone, requireLinkedIn, requireGithub]);

  const handleSendInvitations = async (template: any) => {
    if (!assessmentId || !createdAssessmentUrl) throw new Error("Assessment ID or URL is missing");
    const candidates = assessmentData.candidates || [];
    if (candidates.length === 0) throw new Error("No candidates found to send invitations to");
    setSendingEmails(true);
    try {
      await customMCQApi.sendInvitations(assessmentId, candidates, createdAssessmentUrl, template);
      setInvitationsSent(true);
      setCandidateCountWhenSent(candidates.length);
    } finally {
      setSendingEmails(false);
    }
  };

  const currentCandidateCount = (assessmentData.candidates || []).length;
  const hasNewCandidates = currentCandidateCount > candidateCountWhenSent;

  useEffect(() => {
    if (invitationsSent && hasNewCandidates) {
      setInvitationsSent(false);
      setCandidateCountWhenSent(0);
    }
  }, [currentCandidateCount, hasNewCandidates, invitationsSent]);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      {/* Header */}
      <div className="space-y-2 px-1">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#C9F4D4] rounded-xl text-[#0A5F38] shadow-sm">
            <Calendar size={28} strokeWidth={2.5} />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">Schedule Assessment</h2>
        </div>
        <p className="text-gray-600 text-lg font-medium leading-relaxed max-w-2xl">
          Configure access mode, exam timing, and pass percentage for your assessment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 space-y-8">
          {/* Access Mode */}
          <section className="bg-white rounded-[2rem] p-8 border-2 border-[#A8E8BC]/20 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
            <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Eye size={20} className="text-[#0A5F38]" /> Access Mode
            </h3>
            <p className="text-gray-500 text-sm mb-6">Choose who can access this assessment.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { id: 'private', label: 'Private', icon: <Lock size={18} />, desc: 'Only candidates you add can take the test' },
                { id: 'public', label: 'Public', icon: <Globe size={18} />, desc: 'Anyone with the link can take the test' }
              ].map((mode) => (
                <label key={mode.id} className={`relative flex flex-col p-5 rounded-2xl border-2 transition-all cursor-pointer ${accessMode === mode.id ? 'bg-[#E8FAF0] border-[#0A5F38] ring-4 ring-[#0A5F38]/5' : 'bg-white border-gray-100 hover:border-[#A8E8BC]'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className={`p-2 rounded-lg ${accessMode === mode.id ? 'bg-[#0A5F38] text-white' : 'bg-gray-100 text-gray-400'}`}>
                      {mode.icon}
                    </div>
                    <input type="radio" name="accessMode" value={mode.id} checked={accessMode === mode.id} onChange={(e) => setAccessMode(e.target.value as any)} className="w-5 h-5 text-[#0A5F38] border-gray-300 focus:ring-[#0A5F38]" />
                  </div>
                  <strong className="text-gray-900 text-base">{mode.label}</strong>
                  <p className="text-gray-500 text-xs mt-1 leading-relaxed">{mode.desc}</p>
                </label>
              ))}
            </div>
          </section>

          {/* Timing & Duration */}
          <section className="bg-white rounded-[2rem] p-8 border-2 border-[#A8E8BC]/20 shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
            <h3 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Clock size={20} className="text-[#0A5F38]" /> Exam Mode
            </h3>
            <p className="text-gray-500 text-sm mb-6">Choose how the exam timing works.</p>

            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { id: 'strict', label: 'Strict Window', desc: 'Starts at fixed time, ends after duration.' },
                  { id: 'flexible', label: 'Flexible Window', desc: 'Start anytime within window, full duration given.' }
                ].map((mode) => (
                  <button key={mode.id} type="button" onClick={() => setExamMode(mode.id as any)} className={`text-left p-4 rounded-2xl border-2 transition-all ${examMode === mode.id ? 'bg-[#E8FAF0] border-[#0A5F38]' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
                    <div className="font-bold text-gray-900 text-sm mb-1">{mode.label}</div>
                    <div className="text-[11px] text-gray-500 leading-tight">{mode.desc}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-gray-50">
                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">
                    {examMode === 'strict' ? 'Start Time' : 'Schedule Start Time'} <span className="text-red-500">*</span>
                  </label>
                  <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-[#0A5F38] outline-none font-bold text-gray-700 transition-all shadow-inner" />
                </div>

                {examMode === 'flexible' && (
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1">Schedule End Time <span className="text-red-500">*</span></label>
                    <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-[#0A5F38] outline-none font-bold text-gray-700 transition-all shadow-inner" />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 flex items-center justify-between">
                    Duration (minutes) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} disabled={enablePerSectionTimers} className={`w-full px-4 py-3 bg-gray-50 border-2 border-transparent rounded-xl focus:bg-white focus:border-[#0A5F38] outline-none font-bold text-gray-700 transition-all shadow-inner ${enablePerSectionTimers ? 'opacity-60 cursor-not-allowed' : ''}`} />
                    {enablePerSectionTimers && <Zap className="absolute right-3 top-1/2 -translate-y-1/2 text-[#0A5F38]" size={16}/>}
                  </div>
                  {enablePerSectionTimers && (
                    <p className="text-[10px] text-[#0A5F38] font-bold bg-[#C9F4D4] px-2 py-1 rounded-md inline-block">Auto-calculated from section timers</p>
                  )}
                </div>
              </div>
              
              {startTime && duration && examMode === "strict" && (
                <div className="p-4 bg-[#E8FAF0] rounded-2xl border border-[#A8E8BC]/30 flex items-center gap-3">
                  <Clock size={18} className="text-[#0A5F38]"/>
                  <p className="text-xs font-bold text-[#0A5F38]">Assessment will end at: <span className="underline">{new Date(new Date(startTime).getTime() + parseInt(duration || "0") * 60000).toLocaleString()}</span></p>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="lg:col-span-5 space-y-8">
          {/* Proctoring */}
          <section className="bg-[#C9F4D4] rounded-[2rem] p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group border border-[#A8E8BC]">
  {/* Thematic Background Icon */}
  <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform text-[#0A5F38]">
    <ShieldAlert size={120} />
  </div>

  <h3 className="text-xl font-bold mb-6 flex items-center gap-2 relative z-10 text-[#0A5F38]">
    <ShieldAlert size={20} /> Proctoring Settings
  </h3>
  
  <div className="space-y-4 relative z-10">
    {[
      { 
        checked: aiProctoringEnabled, 
        set: (v: boolean) => { setAiProctoringEnabled(v); if(!v) setFaceMismatchEnabled(false); }, 
        label: 'AI Proctoring', 
        desc: 'Camera-based tracking (gaze, multiple faces)' 
      },
      { 
        checked: liveProctoringEnabled, 
        set: setLiveProctoringEnabled, 
        label: 'Live Proctoring', 
        desc: 'Real-time webcam + screen streaming' 
      }
    ].map((item, idx) => (
      <label key={idx} className="flex items-start gap-4 cursor-pointer p-5 bg-[#6b8e7b]/20 rounded-2xl hover:bg-[#6b8e7b]/30 transition-all border border-[#0A5F38]/10 shadow-sm">
        <input 
          type="checkbox" 
          checked={item.checked} 
          onChange={(e) => item.set(e.target.checked)} 
          className="mt-1 w-5 h-5 rounded border-[#0A5F38]/20 bg-white text-[#0A5F38] focus:ring-0" 
        />
        <div>
          <div className="text-sm font-bold text-[#0A5F38]">{item.label}</div>
          <div className="text-[10px] text-[#0A5F38]/70 mt-0.5 font-bold leading-relaxed">{item.desc}</div>
        </div>
      </label>
    ))}

    {/* Aligned Face Mismatch Detection */}
    {aiProctoringEnabled && (
      <div className="animate-in slide-in-from-top-2 duration-300">
        <label className="flex items-start gap-4 cursor-pointer p-5 bg-[#6b8e7b]/20 rounded-2xl hover:bg-[#6b8e7b]/30 transition-all border border-[#0A5F38]/10 shadow-sm">
          <input 
            type="checkbox" 
            checked={faceMismatchEnabled} 
            onChange={(e) => setFaceMismatchEnabled(e.target.checked)} 
            className="mt-1 w-5 h-5 rounded border-[#0A5F38]/20 bg-white text-[#0A5F38] focus:ring-0" 
          />
          <div>
            <div className="text-sm font-bold text-[#0A5F38]">Face Mismatch Detection</div>
            <p className="text-[10px] text-[#0A5F38]/70 mt-0.5 font-bold leading-relaxed">Verify identity against reference photo.</p>
          </div>
        </label>
      </div>
    )}
  </div>
</section>

          {/* Pass Percentage & Requirements */}
          <section className="bg-white rounded-[2rem] p-8 border-2 border-[#A8E8BC]/20 shadow-sm space-y-8">
            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Target size={18} className="text-[#0A5F38]" /> Pass Percentage
              </h3>
              <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl">
                <input type="range" min="0" max="100" value={passPercentage} onChange={(e) => setPassPercentage(e.target.value)} className="flex-1 accent-[#0A5F38]" />
                <span className="text-2xl font-black text-[#0A5F38] w-16 text-right">{passPercentage}%</span>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <UserCheck size={18} className="text-[#0A5F38]" /> Candidate Requirements
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  { checked: requirePhone, set: setRequirePhone, label: 'Phone Number', icon: <Phone size={14}/> },
                  { checked: requireLinkedIn, set: setRequireLinkedIn, label: 'LinkedIn URL', icon: <Linkedin size={14}/> },
                  { checked: requireGithub, set: setRequireGithub, label: 'GitHub URL', icon: <Github size={14}/> }
                ].map((req, i) => (
                  <label key={i} className={`flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer ${req.checked ? 'bg-[#E8FAF0] border-[#0A5F38]' : 'bg-gray-50 border-transparent hover:bg-gray-100'}`}>
                    <span className="flex items-center gap-3 font-bold text-gray-700 text-xs">
                      {req.icon} {req.label}
                    </span>
                    <input type="checkbox" checked={req.checked} onChange={(e) => req.set(e.target.checked)} className="w-4 h-4 text-[#0A5F38] border-gray-300 rounded focus:ring-0" />
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Creation/Success Section */}
      <div className="pt-6">
        <div className={`p-8 rounded-[2.5rem] border-2 transition-all duration-500 ${createdAssessmentUrl ? 'bg-[#E8FAF0] border-[#0A5F38]' : 'bg-[#C9F4D4] border-[#0A5F38]/10 shadow-2xl shadow-[#C9F4D4]/40'}`}>
          {!createdAssessmentUrl ? (
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-1 text-center md:text-left">
                <h3 className="text-2xl font-black text-[#0A5F38] tracking-tight">
                  {assessmentId ? "Ready to Update Assessment" : "Ready to Create Assessment"}
                </h3>
                <p className="text-[#0A5F38]/70 font-semibold max-w-md">
                  {assessmentId ? "Review all settings above and click the button below to update your assessment." : "Review all settings above and click the button below to create your assessment. You'll receive a shareable link."}
                </p>
              </div>
              <button type="button" onClick={onCreateAssessment} disabled={loading} className="w-full md:w-auto px-12 py-5 bg-[#0A5F38] text-white rounded-3xl font-black text-lg uppercase tracking-wider shadow-xl hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {loading ? (
                   <span className="flex items-center gap-3">
                     <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"/>
                     {assessmentId ? "Updating..." : "Creating..."}
                   </span>
                ) : (
                  <>{assessmentId ? "Update Assessment" : "Create Assessment"}</>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-8 animate-in zoom-in-95">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#0A5F38] text-white rounded-2xl shadow-lg">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-[#0A5F38]">
                    {wasEditingRef.current ? "Assessment Updated Successfully!" : "Assessment Created Successfully!"}
                  </h3>
                  <p className="text-[#0A5F38]/70 font-bold">Your assessment is live and ready for candidates.</p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-black text-[#0A5F38] uppercase tracking-widest px-1 opacity-60">Assessment Shareable Link</label>
                <div className="flex gap-3 items-center bg-white p-2 rounded-[1.5rem] border-2 border-[#0A5F38]/20 shadow-inner">
                  <input type="text" value={createdAssessmentUrl} readOnly className="flex-1 bg-transparent px-4 py-2 font-bold text-gray-600 outline-none text-sm overflow-hidden text-ellipsis" />
                  <button onClick={() => { navigator.clipboard.writeText(createdAssessmentUrl); alert("URL copied to clipboard!"); }} className="p-3 bg-[#C9F4D4] text-[#0A5F38] rounded-xl hover:bg-[#0A5F38] hover:text-white transition-all shadow-sm">
                    <Copy size={20} strokeWidth={2.5}/>
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                {assessmentData.candidates && assessmentData.candidates.length > 0 && (
                  <button 
  type="button" 
  onClick={() => setIsEmailModalOpen(true)}
  disabled={sendingEmails || (invitationsSent && !hasNewCandidates)}
  className={`
    flex-1 flex items-center justify-center gap-3 py-5 rounded-[1.5rem] 
    font-black uppercase text-sm tracking-widest shadow-xl transition-all 
    active:scale-[0.98] border border-transparent
    ${invitationsSent && !hasNewCandidates 
      ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
      : 'bg-[#C9F4D4] text-[#0A5F38] hover:border-[#0A5F38] hover:bg-[#C9F4D4]' 
    }
  `}
>
  <Mail size={20}/> 
  {invitationsSent && !hasNewCandidates ? "Invitations Sent" : "Send Invitation Email"}
</button>
                )}
                {router && (
                  <button onClick={() => router.push("/dashboard?refresh=true")} className="px-10 py-5 bg-white border-2 border-gray-100 rounded-[1.5rem] font-black uppercase text-sm tracking-widest text-gray-500 hover:bg-gray-50 flex items-center justify-center gap-2 transition-all">
                    <LayoutDashboard size={20}/> Dashboard
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {isEmailModalOpen && assessmentId && createdAssessmentUrl && (
        <EmailInvitationModal
          isOpen={isEmailModalOpen}
          onClose={() => setIsEmailModalOpen(false)}
          candidates={assessmentData.candidates || []}
          assessmentTitle={assessmentData.title || "Assessment"}
          assessmentUrl={createdAssessmentUrl}
          onSend={handleSendInvitations}
          invitationsSent={invitationsSent}
          hasNewCandidates={hasNewCandidates}
        />
      )}
    </div>
  );
}