import React, { useState, useEffect, useRef, useMemo } from "react";
import { CustomMCQAssessment } from "../../types/custom-mcq";
import { customMCQApi } from "../../lib/custom-mcq/api";
import EmailInvitationModal from "./EmailInvitationModal";

interface Station5Props {
  assessmentData: Partial<CustomMCQAssessment>;
  updateAssessmentData: (updates: Partial<CustomMCQAssessment>) => void;
  onCreateAssessment: () => void;
  loading: boolean;
  createdAssessmentUrl?: string | null;
  assessmentId?: string | null;
  router?: any;
}

// Helper function to convert UTC ISO string to local datetime-local format (YYYY-MM-DDTHH:mm)
function utcToLocalDatetimeLocal(utcIsoString: string): string {
  if (!utcIsoString) return "";
  const date = new Date(utcIsoString);
  if (isNaN(date.getTime())) return "";
  
  // Get local date/time components
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function Station5Schedule({ assessmentData, updateAssessmentData, onCreateAssessment, loading, createdAssessmentUrl, assessmentId, router }: Station5Props) {
  // Track if we're editing: if assessmentId exists when component first mounts and URL doesn't exist yet, we're editing
  const wasEditingRef = useRef<boolean>(!!assessmentId && !createdAssessmentUrl);
  const [accessMode, setAccessMode] = useState<"private" | "public">(assessmentData.accessMode || "private");
  const [examMode, setExamMode] = useState<"strict" | "flexible">(assessmentData.examMode || "strict");
  // Initialize from schedule object if available, otherwise from root level
  const scheduleStartTime = (assessmentData as any)?.schedule?.startTime || assessmentData.startTime;
  const scheduleEndTime = (assessmentData as any)?.schedule?.endTime || assessmentData.endTime;
  const scheduleDuration = (assessmentData as any)?.schedule?.duration || assessmentData.duration;
  const [startTime, setStartTime] = useState(
    scheduleStartTime ? utcToLocalDatetimeLocal(scheduleStartTime) : ""
  );
  const [endTime, setEndTime] = useState(
    scheduleEndTime ? utcToLocalDatetimeLocal(scheduleEndTime) : ""
  );
  const [duration, setDuration] = useState(scheduleDuration?.toString() || "");
  const [passPercentage, setPassPercentage] = useState(assessmentData.passPercentage?.toString() || "50");
  
  // Get per-section timer settings (memoized with assessmentId to avoid re-calculation on every assessmentData change)
  const enablePerSectionTimers = useMemo(() => (assessmentData as any)?.enablePerSectionTimers || false, [assessmentId]);
  const sectionTimers = useMemo(() => (assessmentData as any)?.sectionTimers || {}, [assessmentId]);
  const [aiProctoringEnabled, setAiProctoringEnabled] = useState(
    (assessmentData as any)?.proctoringSettings?.aiProctoringEnabled ?? false
  );
  const [faceMismatchEnabled, setFaceMismatchEnabled] = useState(
    (assessmentData as any)?.proctoringSettings?.faceMismatchEnabled ?? false
  );
  const [showResultToCandidate, setShowResultToCandidate] = useState(
    (assessmentData as any)?.showResultToCandidate ?? true
  );
  const [liveProctoringEnabled, setLiveProctoringEnabled] = useState(
    (assessmentData as any)?.proctoringSettings?.liveProctoringEnabled ?? false
  );
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [invitationsSent, setInvitationsSent] = useState(false);
  const [candidateCountWhenSent, setCandidateCountWhenSent] = useState<number>(0);
  
  // Candidate Requirements
  const [requirePhone, setRequirePhone] = useState(
    (assessmentData as any)?.schedule?.candidateRequirements?.requirePhone ?? false
  );
  const [requireResume, setRequireResume] = useState(
    (assessmentData as any)?.schedule?.candidateRequirements?.requireResume ?? false
  );
  const [requireLinkedIn, setRequireLinkedIn] = useState(
    (assessmentData as any)?.schedule?.candidateRequirements?.requireLinkedIn ?? false
  );
  const [requireGithub, setRequireGithub] = useState(
    (assessmentData as any)?.schedule?.candidateRequirements?.requireGithub ?? false
  );

  // Sync state from assessmentData when editing (only once when assessmentId is set and data is loaded)
  const hasSyncedFromDataRef = useRef<string | null>(null);
  // Use ref to track if we're currently syncing from parent to avoid infinite loop
  const isUpdatingFromParentRef = useRef(false);
  // Store previous assessmentId to detect changes
  const prevAssessmentIdRef = useRef<string | null | undefined>(assessmentId);
  
  useEffect(() => {
    // Only sync when assessmentId changes (new assessment loaded), not when assessmentData changes
    // This prevents infinite loops when updateAssessmentData updates the parent state
    if (!assessmentId || hasSyncedFromDataRef.current === assessmentId) {
      prevAssessmentIdRef.current = assessmentId;
      return;
    }
    
    // Check if assessmentId actually changed
    if (prevAssessmentIdRef.current === assessmentId) {
      return;
    }
    
    // Set flag to prevent the update effect from running while we sync
    isUpdatingFromParentRef.current = true;
    
    const schedule = (assessmentData as any)?.schedule || {};
    const proctoringSettings = (assessmentData as any)?.proctoringSettings;
    
    // Sync accessMode and examMode
    if (assessmentData.accessMode) {
      setAccessMode(assessmentData.accessMode);
    }
    if (assessmentData.examMode) {
      setExamMode(assessmentData.examMode);
    }
    
    // Sync timing from schedule object
    const scheduleStartTime = schedule.startTime || assessmentData.startTime;
    const scheduleEndTime = schedule.endTime || assessmentData.endTime;
    const scheduleDuration = schedule.duration || assessmentData.duration;
    
    if (scheduleStartTime) {
      setStartTime(utcToLocalDatetimeLocal(scheduleStartTime));
    }
    if (scheduleEndTime) {
      setEndTime(utcToLocalDatetimeLocal(scheduleEndTime));
    }
    
    // Auto-calculate duration from section timers if per-section timers are enabled
    const perSectionTimersEnabled = (assessmentData as any)?.enablePerSectionTimers || false;
    const sectionTimersData = (assessmentData as any)?.sectionTimers || {};
    if (perSectionTimersEnabled && sectionTimersData) {
      const totalMinutes = (sectionTimersData.MCQ || 0) + (sectionTimersData.Subjective || 0);
      if (totalMinutes > 0) {
        setDuration(totalMinutes.toString());
      }
    } else if (scheduleDuration !== undefined) {
      setDuration(scheduleDuration.toString());
    }
    
    // Sync other settings
    if (assessmentData.passPercentage !== undefined) {
      setPassPercentage(assessmentData.passPercentage.toString());
    }
    
    // Sync proctoring settings
    if (proctoringSettings) {
      if (proctoringSettings.aiProctoringEnabled !== undefined) {
        setAiProctoringEnabled(proctoringSettings.aiProctoringEnabled);
      }
      if (proctoringSettings.faceMismatchEnabled !== undefined) {
        setFaceMismatchEnabled(proctoringSettings.faceMismatchEnabled);
      }
      if (proctoringSettings.liveProctoringEnabled !== undefined) {
        setLiveProctoringEnabled(proctoringSettings.liveProctoringEnabled);
      }
    }
    
    // Sync showResultToCandidate
    if ((assessmentData as any).showResultToCandidate !== undefined) {
      setShowResultToCandidate((assessmentData as any).showResultToCandidate);
    }
    
    // Sync candidate requirements
    const candidateReqs = schedule.candidateRequirements || {};
    if (candidateReqs.requirePhone !== undefined) {
      setRequirePhone(candidateReqs.requirePhone);
    }
    if (candidateReqs.requireResume !== undefined) {
      setRequireResume(candidateReqs.requireResume);
    }
    if (candidateReqs.requireLinkedIn !== undefined) {
      setRequireLinkedIn(candidateReqs.requireLinkedIn);
    }
    if (candidateReqs.requireGithub !== undefined) {
      setRequireGithub(candidateReqs.requireGithub);
    }
    
    hasSyncedFromDataRef.current = assessmentId;
    prevAssessmentIdRef.current = assessmentId;
    
    // Reset flag after a short delay to allow state updates to complete
    setTimeout(() => {
      isUpdatingFromParentRef.current = false;
    }, 0);
    // Only depend on assessmentId, not assessmentData - this prevents infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId]);

  // Auto-calculate duration from section timers when per-section timers are enabled
  useEffect(() => {
    if (enablePerSectionTimers && sectionTimers) {
      const totalMinutes = (sectionTimers.MCQ || 0) + (sectionTimers.Subjective || 0);
      if (totalMinutes > 0) {
        setDuration(totalMinutes.toString());
      }
    }
  }, [enablePerSectionTimers, sectionTimers]);

  // Use ref to preserve existing schedule fields that we're not updating in this effect
  const scheduleRef = useRef<any>((assessmentData as any)?.schedule || {});
  
  // Update ref when assessmentData changes from external source (initial load, etc.)
  useEffect(() => {
    const currentSchedule = (assessmentData as any)?.schedule;
    if (currentSchedule && Object.keys(currentSchedule).length > 0) {
      scheduleRef.current = currentSchedule;
    }
  }, [assessmentId]); // Only update ref when assessmentId changes (new assessment loaded)
  
  useEffect(() => {
    // Skip if we're currently syncing from parent data
    if (isUpdatingFromParentRef.current) {
      return;
    }
    
    // Calculate duration - use auto-calculated if per-section timers enabled, otherwise use manual input
    let finalDuration = duration ? parseInt(duration) : undefined;
    if (enablePerSectionTimers && sectionTimers) {
      const totalMinutes = (sectionTimers.MCQ || 0) + (sectionTimers.Subjective || 0);
      if (totalMinutes > 0) {
        finalDuration = totalMinutes;
      }
    }
    
    // Preserve existing schedule data that we're not updating here
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
        faceMismatchEnabled: aiProctoringEnabled ? faceMismatchEnabled : false, // Only enabled if AI Proctoring is enabled
        liveProctoringEnabled,
      } as CustomMCQAssessment["proctoringSettings"],
      showResultToCandidate,
      schedule: {
        ...existingSchedule,
        startTime: startTime ? new Date(startTime).toISOString() : undefined,
        endTime: endTime ? new Date(endTime).toISOString() : undefined,
        duration: finalDuration,
        candidateRequirements: {
          requirePhone,
          requireResume,
          requireLinkedIn,
          requireGithub,
        },
      },
    } as any);
    
    // Update ref with the schedule we just set (excluding candidateRequirements since we set those explicitly)
    scheduleRef.current = {
      ...existingSchedule,
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      endTime: endTime ? new Date(endTime).toISOString() : undefined,
      duration: finalDuration,
      candidateRequirements: {
        requirePhone,
        requireResume,
        requireLinkedIn,
        requireGithub,
      },
    };
  }, [
    accessMode,
    examMode,
    startTime,
    endTime,
    duration,
    passPercentage,
    aiProctoringEnabled,
    faceMismatchEnabled,
    liveProctoringEnabled,
    showResultToCandidate,
    requirePhone,
    requireResume,
    requireLinkedIn,
    requireGithub,
    // Removed enablePerSectionTimers and sectionTimers - they're only used for calculation, not as triggers
    // Removed updateAssessmentData - it's stable (useCallback with empty deps)
  ]);

  const handleSendInvitations = async (template: {
    subject: string;
    message: string;
    footer: string;
    sentBy: string;
  }) => {
    if (!assessmentId || !createdAssessmentUrl) {
      throw new Error("Assessment ID or URL is missing");
    }

    const candidates = assessmentData.candidates || [];
    if (candidates.length === 0) {
      throw new Error("No candidates found to send invitations to");
    }

    setSendingEmails(true);
    try {
      await customMCQApi.sendInvitations(assessmentId, candidates, createdAssessmentUrl, template);
      // Mark invitations as sent and store the candidate count
      setInvitationsSent(true);
      setCandidateCountWhenSent(candidates.length);
    } finally {
      setSendingEmails(false);
    }
  };

  // Check if new candidates were added after invitations were sent
  const currentCandidateCount = (assessmentData.candidates || []).length;
  const hasNewCandidates = currentCandidateCount > candidateCountWhenSent;
  
  // Re-enable button if new candidates were added
  useEffect(() => {
    if (invitationsSent && hasNewCandidates) {
      setInvitationsSent(false);
      setCandidateCountWhenSent(0);
    }
  }, [currentCandidateCount, hasNewCandidates, invitationsSent]);

  return (
    <div>
      <h2 style={{ marginBottom: "1.5rem", color: "#1E5A3B" }}>📅 Schedule Assessment</h2>
      <p style={{ marginBottom: "2rem", color: "#2D7A52" }}>
        Configure access mode, exam timing, and pass percentage for your assessment.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        {/* Access Mode */}
        <div style={{ padding: "1.5rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}>
          <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>Access Mode</h3>
          <p style={{ marginBottom: "1rem", color: "#2D7A52", fontSize: "0.875rem" }}>
            Choose who can access this assessment.
          </p>
          <div style={{ display: "flex", gap: "1rem" }}>
            <label
              style={{
                flex: 1,
                padding: "1rem",
                border: accessMode === "private" ? "2px solid #2D7A52" : "1px solid #A8E8BC",
                borderRadius: "0.5rem",
                cursor: "pointer",
                backgroundColor: accessMode === "private" ? "#E8FAF0" : "#ffffff",
              }}
            >
              <input
                type="radio"
                name="accessMode"
                value="private"
                checked={accessMode === "private"}
                onChange={(e) => setAccessMode(e.target.value as "private" | "public")}
                style={{ marginRight: "0.5rem" }}
              />
              <strong style={{ color: "#1E5A3B" }}>Private</strong>
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem", color: "#2D7A52" }}>
                Only candidates you add can take the test
              </p>
            </label>
            <label
              style={{
                flex: 1,
                padding: "1rem",
                border: accessMode === "public" ? "2px solid #2D7A52" : "1px solid #A8E8BC",
                borderRadius: "0.5rem",
                cursor: "pointer",
                backgroundColor: accessMode === "public" ? "#E8FAF0" : "#ffffff",
              }}
            >
              <input
                type="radio"
                name="accessMode"
                value="public"
                checked={accessMode === "public"}
                onChange={(e) => setAccessMode(e.target.value as "private" | "public")}
                style={{ marginRight: "0.5rem" }}
              />
              <strong style={{ color: "#1E5A3B" }}>Public</strong>
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem", color: "#2D7A52" }}>
                Anyone with the assessment link can take the test
              </p>
            </label>
          </div>
        </div>

        {/* Exam Mode */}
        <div style={{ padding: "1.5rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}>
          <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>Exam Mode</h3>
          <p style={{ marginBottom: "1rem", color: "#2D7A52", fontSize: "0.875rem" }}>
            Choose how the exam timing works.
          </p>
          <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
            <label
              style={{
                flex: 1,
                padding: "1rem",
                border: examMode === "strict" ? "2px solid #2D7A52" : "1px solid #A8E8BC",
                borderRadius: "0.5rem",
                cursor: "pointer",
                backgroundColor: examMode === "strict" ? "#E8FAF0" : "#ffffff",
              }}
            >
              <input
                type="radio"
                name="examMode"
                value="strict"
                checked={examMode === "strict"}
                onChange={(e) => setExamMode(e.target.value as "strict" | "flexible")}
                style={{ marginRight: "0.5rem" }}
              />
              <strong style={{ color: "#1E5A3B" }}>Strict Window</strong>
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem", color: "#2D7A52" }}>
                Assessment starts at a fixed time and ends after the specified duration.
              </p>
            </label>
            <label
              style={{
                flex: 1,
                padding: "1rem",
                border: examMode === "flexible" ? "2px solid #2D7A52" : "1px solid #A8E8BC",
                borderRadius: "0.5rem",
                cursor: "pointer",
                backgroundColor: examMode === "flexible" ? "#E8FAF0" : "#ffffff",
              }}
            >
              <input
                type="radio"
                name="examMode"
                value="flexible"
                checked={examMode === "flexible"}
                onChange={(e) => setExamMode(e.target.value as "strict" | "flexible")}
                style={{ marginRight: "0.5rem" }}
              />
              <strong style={{ color: "#1E5A3B" }}>Flexible Window</strong>
              <p style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem", color: "#2D7A52" }}>
                Candidates can start anytime within the schedule window. Each candidate gets the full duration from when they start.
              </p>
            </label>
          </div>

          {/* Schedule Times - NEW IMPLEMENTATION */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginTop: "1.5rem" }}>
            {examMode === "strict" ? (
              <>
                {/* Strict Mode: Start Time + Duration */}
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                      Start Time <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                      style={{ width: "100%", padding: "0.75rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                      Duration (minutes) <span style={{ color: "#ef4444" }}>*</span>
                      {enablePerSectionTimers && (
                        <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#64748b", marginLeft: "0.5rem" }}>
                          (Auto-calculated from section timers)
                        </span>
                      )}
                    </label>
                    <input
                      type="number"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      placeholder="e.g., 80"
                      min={1}
                      required
                      disabled={enablePerSectionTimers}
                      style={{ 
                        width: "100%", 
                        padding: "0.75rem", 
                        border: "1px solid #A8E8BC", 
                        borderRadius: "0.5rem",
                        backgroundColor: enablePerSectionTimers ? "#f3f4f6" : "#ffffff",
                        cursor: enablePerSectionTimers ? "not-allowed" : "text",
                        opacity: enablePerSectionTimers ? 0.7 : 1,
                      }}
                    />
                    {enablePerSectionTimers && (
                      <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#2D7A52" }}>
                        Duration is automatically calculated from the sum of MCQ and Subjective section timers set in Review & Edit Questions.
                      </p>
                    )}
                  </div>
                </div>
                {startTime && duration && (
                  <div style={{ padding: "0.75rem", backgroundColor: "#E8FAF0", borderRadius: "0.5rem", fontSize: "0.875rem", color: "#2D7A52" }}>
                    <strong>Assessment will end at:</strong> {
                      new Date(new Date(startTime).getTime() + parseInt(duration || "0") * 60000).toLocaleString()
                    }
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Flexible Mode: Start Time + End Time + Duration */}
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                      Schedule Start Time <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      required
                      style={{ width: "100%", padding: "0.75rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: "200px" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                      Schedule End Time <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      required
                      style={{ width: "100%", padding: "0.75rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}
                    />
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: "200px" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1E5A3B" }}>
                    Duration (minutes) <span style={{ color: "#ef4444" }}>*</span>
                    {enablePerSectionTimers && (
                      <span style={{ fontSize: "0.75rem", fontWeight: 400, color: "#64748b", marginLeft: "0.5rem" }}>
                        (Auto-calculated from section timers)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="e.g., 70"
                    min={1}
                    required
                    disabled={enablePerSectionTimers}
                    style={{ 
                      width: "100%", 
                      maxWidth: "300px", 
                      padding: "0.75rem", 
                      border: "1px solid #A8E8BC", 
                      borderRadius: "0.5rem",
                      backgroundColor: enablePerSectionTimers ? "#f3f4f6" : "#ffffff",
                      cursor: enablePerSectionTimers ? "not-allowed" : "text",
                      opacity: enablePerSectionTimers ? 0.7 : 1,
                    }}
                  />
                  <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#2D7A52" }}>
                    {enablePerSectionTimers 
                      ? "Duration is automatically calculated from the sum of MCQ and Subjective section timers set in Review & Edit Questions."
                      : "Candidates can start the assessment anytime between the schedule start and end times. Once started, they have this duration to complete the assessment."
                    }
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Pass Percentage */}
        <div style={{ padding: "1.5rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}>
          <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>Pass Percentage</h3>
          <p style={{ marginBottom: "1rem", color: "#2D7A52", fontSize: "0.875rem" }}>
            Set the minimum percentage required to pass the assessment.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <input
              type="number"
              value={passPercentage}
              onChange={(e) => setPassPercentage(e.target.value)}
              min={0}
              max={100}
              style={{ width: "150px", padding: "0.75rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem" }}
            />
            <span style={{ fontSize: "1.25rem", color: "#1E5A3B" }}>%</span>
          </div>
        </div>

        {/* Proctoring Settings */}
        <div style={{ padding: "1.5rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem", backgroundColor: "#F3FFF8" }}>
          <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>Proctoring Settings</h3>
          
          {/* AI Proctoring Checkbox */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={aiProctoringEnabled}
              onChange={(e) => {
                const checked = e.target.checked;
                setAiProctoringEnabled(checked);
                if (!checked) {
                  setFaceMismatchEnabled(false); // Disable face mismatch if AI Proctoring is disabled
                }
              }}
              style={{ marginTop: "0.25rem" }}
            />
            <span>
              <div style={{ fontWeight: 600, color: "#1E5A3B" }}>
                Enable AI Proctoring (camera-based: no face, multiple faces, gaze away)
              </div>
              <div style={{ fontSize: "0.875rem", color: "#2D7A52", marginTop: "0.25rem" }}>
                Photo capture + fullscreen + screen share gate remain required regardless.
              </div>
            </span>
          </label>

          {/* Face Mismatch Detection Sub-checkbox (only visible when AI Proctoring is enabled) */}
          {aiProctoringEnabled && (
            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", marginTop: "0.75rem", marginLeft: "2rem" }}>
              <input
                type="checkbox"
                checked={faceMismatchEnabled}
                onChange={(e) => setFaceMismatchEnabled(e.target.checked)}
                style={{ marginTop: "0.25rem" }}
              />
              <span>
                <div style={{ fontWeight: 600, color: "#1E5A3B" }}>
                  Enable Face Mismatch Detection
                </div>
                <div style={{ fontSize: "0.875rem", color: "#2D7A52", marginTop: "0.25rem" }}>
                  Detects if the candidate's face changes during the assessment (requires reference photo during identity verification).
                </div>
              </span>
            </label>
          )}

          {/* Live Proctoring Checkbox */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer", marginTop: "1rem" }}>
            <input
              type="checkbox"
              checked={liveProctoringEnabled}
              onChange={(e) => setLiveProctoringEnabled(e.target.checked)}
              style={{ marginTop: "0.25rem" }}
            />
            <span>
              <div style={{ fontWeight: 600, color: "#1E5A3B" }}>
                Enable Live Proctoring (webcam + screen streaming)
              </div>
              <div style={{ fontSize: "0.875rem", color: "#2D7A52", marginTop: "0.25rem" }}>
                Real-time monitoring via admin dashboard. Works independently of AI Proctoring.
              </div>
            </span>
          </label>
        </div>

        {/* Candidate Requirements */}
        <div style={{ padding: "1.5rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem", backgroundColor: "#F3FFF8" }}>
          <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>Candidate Requirements</h3>
          <p style={{ marginBottom: "1rem", color: "#2D7A52", fontSize: "0.875rem" }}>
            Select which information candidates must provide before taking the assessment.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={requirePhone}
                onChange={(e) => setRequirePhone(e.target.checked)}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <span style={{ fontWeight: 600, color: "#1E5A3B" }}>Phone Number</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={requireResume}
                onChange={(e) => setRequireResume(e.target.checked)}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <span style={{ fontWeight: 600, color: "#1E5A3B" }}>Resume (File Upload)</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={requireLinkedIn}
                onChange={(e) => setRequireLinkedIn(e.target.checked)}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <span style={{ fontWeight: 600, color: "#1E5A3B" }}>LinkedIn URL</span>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={requireGithub}
                onChange={(e) => setRequireGithub(e.target.checked)}
                style={{ width: "18px", height: "18px", cursor: "pointer" }}
              />
              <span style={{ fontWeight: 600, color: "#1E5A3B" }}>GitHub URL</span>
            </label>
          </div>
        </div>

        {/* Result Visibility Settings */}
        <div style={{ padding: "1.5rem", border: "1px solid #A8E8BC", borderRadius: "0.5rem", backgroundColor: "#F3FFF8" }}>
          <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>Result Visibility</h3>
          <label style={{ display: "flex", alignItems: "flex-start", gap: "0.75rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={showResultToCandidate}
              onChange={(e) => setShowResultToCandidate(e.target.checked)}
              style={{ marginTop: "0.25rem" }}
            />
            <span>
              <div style={{ fontWeight: 600, color: "#1E5A3B" }}>
                Show result to candidate
              </div>
              <div style={{ fontSize: "0.875rem", color: "#2D7A52", marginTop: "0.25rem" }}>
                If checked, candidates will see their results after submission. If unchecked, candidates will only see an "Assessment submitted" message.
              </div>
            </span>
          </label>
        </div>

        {/* Create/Update Button */}
        <div style={{ padding: "1.5rem", border: "2px solid #2D7A52", borderRadius: "0.5rem", backgroundColor: "#E8FAF0" }}>
          <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>
            {assessmentId ? "Ready to Update Assessment" : "Ready to Create Assessment"}
          </h3>
          <p style={{ marginBottom: "1.5rem", color: "#2D7A52", fontSize: "0.875rem" }}>
            {assessmentId
              ? "Review all settings above and click the button below to update your assessment."
              : "Review all settings above and click the button below to create your assessment. You'll receive a shareable link."}
          </p>
          <button
            type="button"
            onClick={onCreateAssessment}
            disabled={loading}
            className="btn-primary"
            style={{ width: "100%", padding: "1rem", fontSize: "1.125rem", fontWeight: 600 }}
          >
            {loading
              ? assessmentId
                ? "Updating Assessment..."
                : "Creating Assessment..."
              : assessmentId
              ? "✓ Update Assessment"
              : "✓ Create Assessment"}
          </button>
        </div>
        
        {/* Assessment URL Display - Passed from parent */}
        {createdAssessmentUrl && (
          <div id="assessment-url-section" style={{ marginTop: "2rem", padding: "1.5rem", backgroundColor: "#dcfce7", border: "2px solid #10b981", borderRadius: "0.75rem" }}>
            <h3 style={{ marginBottom: "1rem", color: "#166534" }}>
              ✓ {wasEditingRef.current ? "Assessment Updated Successfully!" : "Assessment Created Successfully!"}
            </h3>
            <p style={{ marginBottom: "1rem", color: "#166534", fontSize: "0.875rem", fontWeight: 600 }}>
              Share this URL with your candidates:
            </p>
            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <input
                type="text"
                value={createdAssessmentUrl}
                readOnly
                style={{
                  flex: 1,
                  minWidth: "300px",
                  padding: "0.75rem",
                  border: "1px solid #10b981",
                  borderRadius: "0.5rem",
                  backgroundColor: "#ffffff",
                  fontSize: "0.875rem",
                }}
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(createdAssessmentUrl);
                  alert("URL copied to clipboard!");
                }}
                className="btn-primary"
                style={{
                  padding: "0.75rem 1.5rem",
                  backgroundColor: "#10b981",
                  whiteSpace: "nowrap",
                }}
              >
                📋 Copy URL
              </button>
            </div>
            {/* Send Invitation Email Button */}
            {assessmentData.candidates && assessmentData.candidates.length > 0 && (
              <button
                type="button"
                onClick={() => setIsEmailModalOpen(true)}
                className="btn-primary"
                style={{
                  marginTop: "1rem",
                  width: "100%",
                  padding: "0.75rem",
                  backgroundColor: invitationsSent ? "#94a3b8" : "#2D7A52",
                  opacity: invitationsSent && !hasNewCandidates ? 0.6 : 1,
                  cursor: invitationsSent && !hasNewCandidates ? "not-allowed" : "pointer",
                }}
                disabled={sendingEmails || (invitationsSent && !hasNewCandidates)}
                title={invitationsSent && !hasNewCandidates ? "Invitations already sent. Add new candidates to enable." : ""}
              >
                {invitationsSent && !hasNewCandidates ? "✓ Invitations Sent" : "📧 Send Invitation Email"}
              </button>
            )}
            {router && (
              <button
                type="button"
                onClick={() => router.push("/dashboard?refresh=true")}
                className="btn-secondary"
                style={{
                  marginTop: "1rem",
                  width: "100%",
                  padding: "0.75rem",
                }}
              >
                Go to Dashboard
              </button>
            )}
          </div>
        )}
        
        {/* Email Invitation Modal */}
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
    </div>
  );
}

