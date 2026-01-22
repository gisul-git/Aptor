import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../lib/auth";
import { customMCQApi } from "../../lib/custom-mcq/api";
import { CustomMCQAssessment, MCQQuestion, Candidate } from "../../types/custom-mcq";
import {
  Station1AssessmentInfo,
  Station2UploadCSV,
  Station3ReviewEdit,
  Station4AddCandidates,
  Station5Schedule,
} from "../../components/custom-mcq";

interface CreateCustomMCQPageProps {
  session: any;
}

export default function CreateCustomMCQPage({ session }: CreateCustomMCQPageProps) {
  const router = useRouter();
  const [currentStation, setCurrentStation] = useState(1);
  const [assessmentData, setAssessmentData] = useState<Partial<CustomMCQAssessment>>({
    title: "",
    description: "",
    questions: [],
    candidates: [],
    accessMode: "private",
    examMode: "strict",
    passPercentage: 50,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [createdAssessmentUrl, setCreatedAssessmentUrl] = useState<string | null>(null);
  const [assessmentToken, setAssessmentToken] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = useRef(true);
  const [initialLoadDone, setInitialLoadDone] = useState(false); // Prevent auto-save from overwriting during initial load
  const isCreatingDraftRef = useRef(false); // Prevent multiple drafts from being created
  const assessmentIdRef = useRef<string | null>(null); // Avoid stale closures during route changes/unload
  const [isEditingExisting, setIsEditingExisting] = useState(false); // Track if we're editing an existing assessment (loaded from URL)

  useEffect(() => {
    assessmentIdRef.current = assessmentId;
  }, [assessmentId]);

  const stations = [
    { id: 1, name: "Assessment Information", icon: "📋" },
    { id: 2, name: "Upload CSV", icon: "📤" },
    { id: 3, name: "Review & Edit", icon: "✏️" },
    { id: 4, name: "Add Candidates", icon: "👥" },
    { id: 5, name: "Schedule", icon: "📅" },
  ];

  // Track if we've already determined edit vs create mode (to prevent re-running when URL updates after draft creation)
  const hasDeterminedEditModeRef = useRef(false);
  
  // Load draft from backend if assessmentId is in URL
  useEffect(() => {
    const loadDraft = async () => {
      try {
        const { id, testId } = router.query;
        const assessmentIdParam = (id || testId) as string;
        
        // If we already have assessmentId and it matches the URL param, we just created a draft
        // Don't reload - we're still in create mode
        if (assessmentId && assessmentIdParam && assessmentId === assessmentIdParam && hasDeterminedEditModeRef.current) {
          // URL was updated after draft creation, but we're still creating, not editing
          return;
        }
        
        setInitialLoadDone(false); // Reset initial load flag - prevent auto-save during load
        
        if (assessmentIdParam) {
          // If we already have this assessmentId loaded, skip (we created it)
          if (assessmentId === assessmentIdParam) {
            hasDeterminedEditModeRef.current = true;
            isInitialLoadRef.current = false;
            setInitialLoadDone(true);
            return;
          }
          
          // Load existing draft from backend - this is edit mode
          try {
            const assessment = await customMCQApi.getAssessment(assessmentIdParam);
            setAssessmentId(assessmentIdParam);
            setIsEditingExisting(true); // Mark as editing existing assessment
            hasDeterminedEditModeRef.current = true;
            // Extract schedule data if it exists
            const schedule = (assessment as any).schedule || {};
            
            setAssessmentData({
              title: assessment.title || "",
              description: assessment.description || "",
              questions: assessment.questions || [],
              candidates: assessment.candidates || [],
              accessMode: assessment.accessMode || "private",
              examMode: assessment.examMode || "strict",
              startTime: schedule.startTime || assessment.startTime,
              endTime: schedule.endTime || assessment.endTime,
              duration: schedule.duration || assessment.duration,
              passPercentage: assessment.passPercentage || 50,
              schedule: schedule, // Include full schedule object
              proctoringSettings: (assessment as any).proctoringSettings || undefined,
              enablePerSectionTimers: (assessment as any).enablePerSectionTimers || false,
              sectionTimers: (assessment as any).sectionTimers || undefined,
              showResultToCandidate: (assessment as any).showResultToCandidate !== undefined ? (assessment as any).showResultToCandidate : true,
            } as any);
            
            // Set current station from backend or default to 1
            const station = (assessment as any).currentStation || 1;
            setCurrentStation(station);
            // If we loaded an existing assessment, we already have a draft, so mark as created
            isCreatingDraftRef.current = true;
            console.log(`[Custom MCQ] Loaded draft assessment ${assessmentIdParam}, resuming at station ${station}`);
          } catch (err) {
            console.error("Error loading draft from backend:", err);
            // If assessment not found, continue with new assessment
            isCreatingDraftRef.current = false; // Allow creation if load fails
            setIsEditingExisting(false);
            hasDeterminedEditModeRef.current = true;
          }
        } else {
          // No ID in URL - new assessment
          isCreatingDraftRef.current = false; // Allow creation for new assessment
          setIsEditingExisting(false);
          hasDeterminedEditModeRef.current = true;
          console.log("[Custom MCQ] Starting new assessment");
        }
      } catch (err) {
        console.error("Error loading draft:", err);
      } finally {
        isInitialLoadRef.current = false;
        // Mark initial load as complete AFTER all states are populated
        setInitialLoadDone(true);
        console.log("[Custom MCQ] Initial load complete - auto-save now enabled");
      }
    };

    if (router.isReady) {
      loadDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.id, router.query.testId, assessmentId]);

  // Track if assessment was just created/activated to prevent auto-save from overwriting
  const isActivatedRef = useRef(false);

  // Ensure we create EXACTLY ONE draft as soon as the user has meaningful input.
  // This prevents race conditions where other effects (route change/unload/cleanup) also try to create.
  useEffect(() => {
    if (!initialLoadDone) return;
    if (assessmentIdRef.current) return;
    if (isActivatedRef.current) return;
    if (isCreatingDraftRef.current) return;

    const hasMeaningfulInput =
      !!assessmentData.title ||
      !!(assessmentData.questions && assessmentData.questions.length > 0);

    if (!hasMeaningfulInput) return;

    const createDraft = async () => {
      isCreatingDraftRef.current = true;
      try {
        const draftData: any = {
          title: assessmentData.title || "",
          description: assessmentData.description || "",
          questions: assessmentData.questions || [],
          candidates: assessmentData.candidates || [],
          accessMode: assessmentData.accessMode || "private",
          examMode: assessmentData.examMode || "strict",
          startTime: assessmentData.startTime,
          endTime: assessmentData.endTime,
          duration: assessmentData.duration,
          passPercentage: assessmentData.passPercentage || 50,
          status: "draft",
          currentStation: currentStation,
          proctoringSettings: (assessmentData as any).proctoringSettings,
        };

        const result = await customMCQApi.createAssessment(draftData as any);
        setAssessmentId(result.assessmentId);
        // Update URL to include the new ID for consistency (shallow to avoid a full reload)
        router.replace(`/custom-mcq/create?id=${result.assessmentId}`, undefined, { shallow: true });
      } catch (err) {
        // Allow retry if creation fails
        isCreatingDraftRef.current = false;
        throw err;
      }
    };

    createDraft().catch((err) => console.error("Error creating draft:", err));
  }, [initialLoadDone, assessmentData, currentStation, router]);

  // Auto-save draft to backend on every change (debounced)
  // Only auto-save if initial load is complete AND assessment is not active
  useEffect(() => {
    if (!initialLoadDone) return; // Don't auto-save until initial load from edit mode is complete
    if (isActivatedRef.current) return; // Don't auto-save if assessment was just activated (prevents overwriting active status)

    // Debounce draft saves to avoid too many API calls
    const timeoutId = setTimeout(async () => {
      try {
        setIsSaving(true);
        
        const draftData: any = {
          title: assessmentData.title || "",
          description: assessmentData.description || "",
          questions: assessmentData.questions || [],
          candidates: assessmentData.candidates || [],
          accessMode: assessmentData.accessMode || "private",
          examMode: assessmentData.examMode || "strict",
          startTime: assessmentData.startTime,
          endTime: assessmentData.endTime,
          duration: assessmentData.duration,
          passPercentage: assessmentData.passPercentage || 50,
          status: "draft", // Always save as draft during editing
          currentStation: currentStation,
          proctoringSettings: (assessmentData as any).proctoringSettings,
          schedule: (assessmentData as any).schedule, // Include schedule object with timing
        };

        if (assessmentId) {
          // Only update if we're sure it's still a draft (check current status from backend first)
          // For safety, we'll update anyway - the backend should preserve active status if we don't send status
          // But to be safe, let's not auto-save if assessment is active
          try {
            const current = await customMCQApi.getAssessment(assessmentId);
            if (current && current.status === 'active') {
              // Don't overwrite active status - assessment is already published
              return;
            }
          } catch (e) {
            // If we can't check, proceed with update (better than not saving)
          }
          
          // Update existing draft (same ID - keeps it as draft)
          await customMCQApi.updateAssessment(assessmentId, draftData);
        } else {
          // Draft creation is handled by the dedicated "ensure draft exists" effect above.
          // We intentionally do NOT create drafts here to avoid duplicate inserts.
        }
      } catch (err) {
        console.error("Error auto-saving draft:", err);
        // Don't show error to user for auto-save failures
      } finally {
        setIsSaving(false);
      }
    }, 2000); // 2 second debounce (same as assessments)

    return () => clearTimeout(timeoutId);
  }, [
    initialLoadDone,
    assessmentData,
    currentStation,
    assessmentId,
    router
  ]);

  // Save draft before page unload or navigation
  useEffect(() => {
    const saveBeforeUnload = async () => {
      // Clear any pending debounced saves
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }

      // Immediate save before leaving
      if (!initialLoadDone) return; // Don't save during initial load
      if (isActivatedRef.current) return; // Don't save if assessment was just activated
      
      try {
        // Never create a NEW draft during unload/navigation/cleanup (this is what caused duplicates).
        // If we don't have an ID yet, we simply skip and rely on the normal creation flow.
        const idToSave = assessmentIdRef.current;
        if (!idToSave) return;

        // Check if assessment is already active - don't overwrite
        if (idToSave) {
          try {
            const current = await customMCQApi.getAssessment(idToSave);
            if (current && current.status === 'active') {
              // Don't overwrite active status
              return;
            }
          } catch (e) {
            // If we can't check, proceed with save
          }
        }
        
        const draftData: any = {
          title: assessmentData.title || "",
          description: assessmentData.description || "",
          questions: assessmentData.questions || [],
          candidates: assessmentData.candidates || [],
          accessMode: assessmentData.accessMode || "private",
          examMode: assessmentData.examMode || "strict",
          startTime: assessmentData.startTime,
          endTime: assessmentData.endTime,
          duration: assessmentData.duration,
          passPercentage: assessmentData.passPercentage || 50,
          status: "draft",
          currentStation: currentStation,
          proctoringSettings: (assessmentData as any).proctoringSettings,
        };

        if (idToSave) {
          // Update existing draft immediately
          await customMCQApi.updateAssessment(idToSave, draftData);
        }
      } catch (err) {
        console.error("Error saving draft before unload:", err);
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Use synchronous save (fire-and-forget, but try to complete)
      if (initialLoadDone && (assessmentId || assessmentData.title || (assessmentData.questions && assessmentData.questions.length > 0))) {
        // Try to save, but don't block navigation
        saveBeforeUnload().catch(err => console.error("Failed to save before unload:", err));
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [assessmentData, currentStation, assessmentId, initialLoadDone, router]);

  const updateAssessmentData = useCallback((updates: Partial<CustomMCQAssessment>) => {
    setAssessmentData((prev) => ({ ...prev, ...updates }));
    setError(null);
  }, []);

  const handleNext = () => {
    if (currentStation < 5) {
      setCurrentStation(currentStation + 1);
      setError(null);
    }
  };

  const handlePrevious = () => {
    if (currentStation > 1) {
      setCurrentStation(currentStation - 1);
      setError(null);
    }
  };

  const handleCreateAssessment = async () => {
    try {
      setLoading(true);
      setError(null);

      // Validate required fields
      if (!assessmentData.title?.trim()) {
        setError("Title is required");
        setLoading(false);
        return;
      }

      if (!assessmentData.questions || assessmentData.questions.length === 0) {
        setError("At least one question is required");
        setLoading(false);
        return;
      }

      // Validate schedule based on exam mode - NEW IMPLEMENTATION
      // Check duration in schedule.duration first (for per-section timers), then assessmentData.duration
      const durationToValidate = (assessmentData as any).schedule?.duration || assessmentData.duration;
      
      if (assessmentData.examMode === "strict") {
        if (!assessmentData.startTime) {
          setError("Start time is required for strict window mode");
          setLoading(false);
          return;
        }
        if (!durationToValidate || parseInt(String(durationToValidate), 10) <= 0) {
          setError("Duration is required and must be greater than 0 for strict window mode");
          setLoading(false);
          return;
        }
        // endTime is calculated from startTime + duration, not required
      } else if (assessmentData.examMode === "flexible") {
        if (!assessmentData.startTime) {
          setError("Schedule start time is required for flexible window mode");
          setLoading(false);
          return;
        }
        if (!assessmentData.endTime) {
          setError("Schedule end time is required for flexible window mode");
          setLoading(false);
          return;
        }
        if (!durationToValidate || parseInt(String(durationToValidate), 10) <= 0) {
          setError("Duration is required and must be greater than 0 for flexible window mode");
          setLoading(false);
          return;
        }
      }

      // Prepare data for API - change status from draft to scheduled/active
      // Ensure duration is a number (handle per-section timer auto-calculation)
      const durationValue = (assessmentData as any).schedule?.duration || assessmentData.duration;
      const finalDuration = durationValue ? parseInt(String(durationValue), 10) : undefined;
      
      const createData: any = {
        title: assessmentData.title!,
        description: assessmentData.description || "",
        questions: assessmentData.questions!,
        candidates: assessmentData.candidates || [],
        accessMode: assessmentData.accessMode || "private",
        examMode: assessmentData.examMode || "strict",
        startTime: assessmentData.startTime,
        endTime: assessmentData.endTime,
        duration: finalDuration,
        showResultToCandidate: (assessmentData as any).showResultToCandidate !== false, // Default to true if not specified
        passPercentage: assessmentData.passPercentage || 50,
        enablePerSectionTimers: (assessmentData as any).enablePerSectionTimers || false,
        sectionTimers: (assessmentData as any).sectionTimers || undefined,
        status: "scheduled", // Create as scheduled/active (not paused)
        currentStation: currentStation,
        proctoringSettings: (assessmentData as any).proctoringSettings,
        schedule: (assessmentData as any).schedule, // Include schedule with candidateRequirements
      };

      // Mark as published to prevent auto-save from overwriting
      isActivatedRef.current = true;
      
      let result: any;
      if (assessmentId) {
        // Update existing draft to scheduled
        const updateResponse = await customMCQApi.updateAssessment(assessmentId, createData);
        result = await customMCQApi.getAssessment(assessmentId);
        // Get the token and URL from the update response if available
        if (updateResponse && (updateResponse as any).assessmentToken) {
          result.assessmentToken = (updateResponse as any).assessmentToken;
          result.assessmentUrl = (updateResponse as any).assessmentUrl;
        }
      } else {
        // Create new as scheduled
        result = await customMCQApi.createAssessment(createData);
        setAssessmentId(result.assessmentId);
      }

      // Clear localStorage draft
      localStorage.removeItem("custom_mcq_draft");
      
      // Store the assessment URL for display - always construct full URL
      const token = result.assessmentToken || (result as any).assessmentToken;
      const id = result.assessmentId || assessmentId;
      let assessmentUrl = result.assessmentUrl || `/custom-mcq/entry/${id}?token=${token}`;
      
      // If URL doesn't start with http, prepend the origin
      if (!assessmentUrl.startsWith('http://') && !assessmentUrl.startsWith('https://')) {
        assessmentUrl = `${window.location.origin}${assessmentUrl.startsWith('/') ? '' : '/'}${assessmentUrl}`;
      }
      
      setCreatedAssessmentUrl(assessmentUrl);
      setAssessmentToken(result.assessmentToken || (result as any).assessmentToken);
      setAssessmentId(result.assessmentId || assessmentId);
      
      // Scroll to the URL section
      setTimeout(() => {
        const urlSection = document.getElementById('assessment-url-section');
        if (urlSection) {
          urlSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    } catch (err: any) {
      console.error("Error creating assessment:", err);
      setError(err.message || "Failed to create assessment");
    } finally {
      setLoading(false);
    }
  };

  const canProceedToNext = () => {
    switch (currentStation) {
      case 1:
        return !!(assessmentData.title?.trim());
      case 2:
        return !!(assessmentData.questions && assessmentData.questions.length > 0);
      case 3:
        return !!(assessmentData.questions && assessmentData.questions.length > 0);
      case 4:
        // Always allow proceeding - candidates are optional (public mode doesn't need candidates)
        return true;
      case 5:
        return true; // Can always proceed from schedule to create
      default:
        return false;
    }
  };

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh", padding: "2rem" }}>
      <div className="container" style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1 style={{ margin: 0, color: "#1E5A3B" }}>
            {isEditingExisting ? "Edit Custom MCQ/Subjective Assessment" : "Create Custom MCQ/Subjective Assessment"}
          </h1>
          {isSaving && (
            <span style={{ fontSize: "0.875rem", color: "#2D7A52", fontStyle: "italic" }}>
              💾 Saving draft...
            </span>
          )}
        </div>

        {/* Metro Station Navigation */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "3rem",
            padding: "1.5rem",
            backgroundColor: "#E8FAF0",
            borderRadius: "0.75rem",
            border: "1px solid #A8E8BC",
            position: "relative",
          }}
        >
          {/* Connection Line */}
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "5%",
              right: "5%",
              height: "3px",
              backgroundColor: currentStation > 1 ? "#2D7A52" : "#A8E8BC",
              zIndex: 0,
            }}
          />

          {stations.map((station, idx) => {
            const isActive = currentStation === station.id;
            const isCompleted = currentStation > station.id;
            const isAccessible = currentStation >= station.id || isCompleted;

            return (
              <div
                key={station.id}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  position: "relative",
                  zIndex: 1,
                  cursor: isAccessible ? "pointer" : "not-allowed",
                  flex: 1,
                }}
                onClick={() => {
                  if (isAccessible) {
                    setCurrentStation(station.id);
                  }
                }}
              >
                <div
                  style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "50%",
                    backgroundColor: isActive
                      ? "#2D7A52"
                      : isCompleted
                      ? "#10b981"
                      : "#A8E8BC",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.5rem",
                    color: "#ffffff",
                    marginBottom: "0.5rem",
                    border: "3px solid #ffffff",
                    boxShadow: isActive ? "0 0 0 3px #C9F4D4" : "none",
                    transition: "all 0.3s ease",
                  }}
                >
                  {isCompleted && !isActive ? "✓" : station.icon}
                </div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#1E5A3B" : isCompleted ? "#2D7A52" : "#4A9A6A",
                    textAlign: "center",
                  }}
                >
                  {station.name}
                </div>
                {isActive && (
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#2D7A52",
                      marginTop: "0.25rem",
                      fontWeight: 500,
                    }}
                  >
                    Current
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "#fee2e2",
              border: "1px solid #ef4444",
              borderRadius: "0.5rem",
              color: "#991b1b",
              marginBottom: "1.5rem",
            }}
          >
            {error}
          </div>
        )}

        {/* Station Content */}
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #A8E8BC",
            borderRadius: "0.75rem",
            padding: "2rem",
            marginBottom: "2rem",
            minHeight: "400px",
          }}
        >
          {currentStation === 1 && (
            <Station1AssessmentInfo
              assessmentData={assessmentData}
              updateAssessmentData={updateAssessmentData}
            />
          )}
          {currentStation === 2 && (
            <Station2UploadCSV
              assessmentData={assessmentData}
              updateAssessmentData={updateAssessmentData}
            />
          )}
          {currentStation === 3 && (
            <Station3ReviewEdit
              assessmentData={assessmentData}
              updateAssessmentData={updateAssessmentData}
            />
          )}
          {currentStation === 4 && (
            <Station4AddCandidates
              assessmentData={assessmentData}
              updateAssessmentData={updateAssessmentData}
            />
          )}
          {currentStation === 5 && (
            <Station5Schedule
              assessmentData={assessmentData}
              updateAssessmentData={updateAssessmentData}
              onCreateAssessment={handleCreateAssessment}
              loading={loading}
              createdAssessmentUrl={createdAssessmentUrl}
              assessmentId={isEditingExisting ? assessmentId : null}
              router={router}
            />
          )}
        </div>

        {/* Navigation Buttons */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "center" }}>
          <button
            type="button"
            onClick={handlePrevious}
            disabled={currentStation === 1}
            className="btn-secondary"
            style={{
              padding: "0.75rem 1.5rem",
              opacity: currentStation === 1 ? 0.5 : 1,
              cursor: currentStation === 1 ? "not-allowed" : "pointer",
            }}
          >
            ← Previous
          </button>

          {/* Back to Dashboard Button - Always Visible */}
          {currentStation !== 5 && (
          <button
            type="button"
            onClick={async () => {
              // Don't save draft if assessment was just activated
              if (isActivatedRef.current) {
                router.push("/dashboard?refresh=true");
                return;
              }

              // Check if assessment is already active - don't overwrite
              if (assessmentId) {
                try {
                  const current = await customMCQApi.getAssessment(assessmentId);
                  if (current && current.status === 'active') {
                    // Assessment is already active, don't save as draft
                    router.push("/dashboard?refresh=true");
                    return;
                  }
                } catch (e) {
                  // If we can't check, proceed with save
                }
              }

              // Save draft before navigating away
              if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
              }
              try {
                const draftData: any = {
                  title: assessmentData.title || "",
                  description: assessmentData.description || "",
                  questions: assessmentData.questions || [],
                  candidates: assessmentData.candidates || [],
                  accessMode: assessmentData.accessMode || "private",
                  examMode: assessmentData.examMode || "strict",
                  startTime: assessmentData.startTime,
                  endTime: assessmentData.endTime,
                  duration: assessmentData.duration,
                  passPercentage: assessmentData.passPercentage || 50,
                  status: "draft",
                  currentStation: currentStation,
                  proctoringSettings: (assessmentData as any).proctoringSettings,
                  schedule: (assessmentData as any).schedule, // Include schedule with candidateRequirements
                };

                if (assessmentId) {
                  await customMCQApi.updateAssessment(assessmentId, draftData);
                } else if (assessmentData.title || (assessmentData.questions && assessmentData.questions.length > 0)) {
                  const result = await customMCQApi.createAssessment(draftData);
                  setAssessmentId(result.assessmentId);
                }
              } catch (err) {
                console.error("Error saving draft before navigation:", err);
              }
              router.push("/dashboard?refresh=true");
            }}
            className="btn-secondary"
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#ffffff",
              color: "#2D7A52",
              border: "1px solid #A8E8BC",
            }}
          >
            ← Back to Dashboard
          </button>
          )}

          {currentStation < 5 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceedToNext()}
              className="btn-primary"
              style={{
                padding: "0.75rem 1.5rem",
                opacity: canProceedToNext() ? 1 : 0.5,
                cursor: canProceedToNext() ? "pointer" : "not-allowed",
              }}
            >
              Next →
            </button>
          ) : (
            <div />
          )}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;