import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { getGateContext } from "@/lib/gateContext";
 
/**
 * Default candidate requirements when assessment data is not available
 * For custom MCQ, defaults are all false - only show what admin checked
 */
const DEFAULT_REQUIREMENTS = {
  requireEmail: false,
  requireName: false,
  requirePhone: false,
  requireResume: false,
  requireLinkedIn: false,
  requireGithub: false,
};
 
export default function CandidateRequirementsPage() {
  const router = useRouter();
  const { id, token } = router.query;
 
  const [email, setEmail] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [linkedInUrl, setLinkedInUrl] = useState<string>("");
  const [githubUrl, setGithubUrl] = useState<string>("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeFileName, setResumeFileName] = useState<string>("");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fetchingAssessment, setFetchingAssessment] = useState(true);
  const [assessmentInfo, setAssessmentInfo] = useState<any>(null);
  const [customFields, setCustomFields] = useState<Array<{ label: string; required: boolean }>>([]);
  const [candidateRequirements, setCandidateRequirements] = useState<{
    requireEmail: boolean;
    requireName: boolean;
    requirePhone: boolean;
    requireResume: boolean;
    requireLinkedIn?: boolean;
    requireGithub?: boolean;
  }>(DEFAULT_REQUIREMENTS);

  // Guard to prevent multiple navigations
  const hasNavigatedRef = useRef(false);

  // Determine flow type (accessible in render)
  const ctx = getGateContext(id as string);
  const isAIFlow = !ctx || ctx?.flowType === "ai";
  const isCustomMCQFlow = ctx?.flowType === "custom-mcq";
  const isAIMLFlow = ctx?.flowType === "aiml";
  const isDSAFlow = ctx?.flowType === "dsa";
  
  console.log("[CANDIDATE-REQUIREMENTS DEBUG] Flow type detection:", {
    ctx,
    flowType: ctx?.flowType,
    isAIFlow,
    isCustomMCQFlow,
    isAIMLFlow,
    isDSAFlow,
    id,
    token
  });

  useEffect(() => {
    console.log("[CANDIDATE-REQUIREMENTS DEBUG] useEffect triggered - checking flow and loading requirements");
    const storedEmail = sessionStorage.getItem("candidateEmail");
    const storedName = sessionStorage.getItem("candidateName");
   
    // Don't auto-fill - let user enter manually
    // if (storedEmail) setEmail(storedEmail);
    // if (storedName) setName(storedName);
   
    if (!storedEmail || !storedName) {
      if (id && token) {
        const ctx = getGateContext(id as string);
        router.replace(ctx?.entryUrl || `/assessment/${id}/${token}`);
      }
      return;
    }
   
    // Check precheck completion
    const precheckCompleted = sessionStorage.getItem(`precheckCompleted_${id}`);
    if (!precheckCompleted && id && token) {
      router.replace(`/precheck/${id}/${token}`);
      return;
    }
   
    // Check instructions acknowledgment
    const instructionsAcknowledged = sessionStorage.getItem(`instructionsAcknowledged_${id}`);
    console.log("[CANDIDATE-REQUIREMENTS] Instructions acknowledgment check", {
      instructionsAcknowledged: !!instructionsAcknowledged,
      id,
      token,
      timestamp: new Date().toISOString()
    });
    if (!instructionsAcknowledged && id && token) {
      const targetUrl = `/assessment/${id}/${token}/instructions-new`;
      console.log("[CANDIDATE-REQUIREMENTS] 🔄 Instructions not acknowledged, navigating to instructions-new", {
        targetUrl,
        id,
        token
      });
      router.replace(targetUrl).catch((err) => {
        console.error("[CANDIDATE-REQUIREMENTS] ❌ Navigation error:", {
          error: err,
          name: err?.name,
          message: err?.message,
          stack: err?.stack
        });
      });
      return;
    }
   
    // For DSA flow, fetch requirements from DSA test
    if (isDSAFlow && id && token) {
      const fetchDSATest = async () => {
        try {
          setFetchingAssessment(true);
          setError(null);

          // Fetch DSA test using verify-link endpoint (public, no auth required)
          const response = await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:80"}/api/v1/dsa/tests/${id}/verify-link`,
            {
              params: { token }
            }
          );

          const test = response.data;
          console.log("DSA Test API response:", test);
          
          if (!test || typeof test !== "object" || !test.valid) {
            console.warn("No DSA test found or invalid token, using default requirements");
            setAssessmentInfo(null);
            setCandidateRequirements(DEFAULT_REQUIREMENTS);
            setFetchingAssessment(false);
            return;
          }

          setAssessmentInfo(test);

          // Get candidate requirements from schedule
          const schedule = test?.schedule || {};
          console.log("[DSA] Full test object:", JSON.stringify(test, null, 2));
          console.log("[DSA] Schedule from DSA test:", JSON.stringify(schedule, null, 2));
          console.log("[DSA] Schedule type:", typeof schedule, "Is object?", schedule && typeof schedule === "object");
          
          const candidateReqs = schedule?.candidateRequirements || {};
          console.log("[DSA] Candidate requirements from schedule:", JSON.stringify(candidateReqs, null, 2));
          console.log("[DSA] Candidate requirements type:", typeof candidateReqs);
          console.log("[DSA] Raw values - requirePhone:", candidateReqs?.requirePhone, "type:", typeof candidateReqs?.requirePhone);
          console.log("[DSA] Raw values - requireResume:", candidateReqs?.requireResume, "type:", typeof candidateReqs?.requireResume);
          console.log("[DSA] Raw values - requireLinkedIn:", candidateReqs?.requireLinkedIn, "type:", typeof candidateReqs?.requireLinkedIn);
          console.log("[DSA] Raw values - requireGithub:", candidateReqs?.requireGithub, "type:", typeof candidateReqs?.requireGithub);

          // More robust normalization - handle both boolean and string "true"/"false"
          const normalizeBool = (val: any): boolean => {
            if (val === true || val === "true" || val === 1 || val === "1") return true;
            if (val === false || val === "false" || val === 0 || val === "0" || val === null || val === undefined) return false;
            return Boolean(val);
          };

          const normalizedRequirements = {
            requireEmail: false, // Email is always collected in entry page
            requireName: false, // Name is always collected in entry page
            requirePhone: normalizeBool(candidateReqs?.requirePhone),
            requireResume: normalizeBool(candidateReqs?.requireResume),
            requireLinkedIn: normalizeBool(candidateReqs?.requireLinkedIn),
            requireGithub: normalizeBool(candidateReqs?.requireGithub),
          };

          console.log("[DSA] Normalized candidate requirements:", JSON.stringify(normalizedRequirements, null, 2));
          setCandidateRequirements(normalizedRequirements);
          
          // Check if any requirements are enabled
          const hasAnyRequirement =
            normalizedRequirements.requirePhone ||
            normalizedRequirements.requireResume ||
            normalizedRequirements.requireLinkedIn ||
            normalizedRequirements.requireGithub;

          console.log("[DSA] Has any requirement?", hasAnyRequirement);

          // If no requirements are enabled, skip this page (but add a small delay to prevent race conditions)
          if (!hasAnyRequirement && id && token && !hasNavigatedRef.current) {
            console.log("[DSA] No candidate requirements enabled, will skip to identity verification after short delay");
            // Set flag BEFORE navigating to prevent redirect loop
            hasNavigatedRef.current = true;
            sessionStorage.setItem(`candidateRequirementsCompleted_${id}`, "true");
            // Use setTimeout to prevent immediate navigation that might cause abort errors
            setTimeout(() => {
              router.replace(`/assessment/${id}/${token}/identity-verify`).catch((err) => {
                // Ignore abort errors during navigation
                if (err.name !== "AbortError" && err.message !== "Abort fetching component") {
                  console.error("[DSA] Navigation error:", err);
                }
              });
            }, 100);
          }
          
          setFetchingAssessment(false);
        } catch (err: any) {
          console.error("Error fetching DSA test:", err);
          setError(err.response?.data?.detail || "Failed to fetch test information");
          setCandidateRequirements(DEFAULT_REQUIREMENTS);
          setFetchingAssessment(false);
        }
      };

      fetchDSATest();
      return;
    }

    // For AIML flow, fetch requirements from AIML test
    // Only fetch if explicitly AIML flow (not DSA)
    if (isAIMLFlow && !isDSAFlow && id && token) {
      console.log("[CANDIDATE-REQUIREMENTS DEBUG] Using AIML flow - fetching AIML test");
      const fetchAIMLTest = async () => {
        try {
          console.log("[AIML DEBUG] Starting fetchAIMLTest");
          setFetchingAssessment(true);
          setError(null);

          // Fetch AIML test using verify-link endpoint (public, no auth required)
          const response = await axios.get(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:80"}/api/v1/aiml/tests/${id}/verify-link`,
            {
              params: { token }
            }
          );

          const test = response.data;
          console.log("AIML Test API response:", test);
          
          if (!test || typeof test !== "object" || !test.valid) {
            console.warn("No AIML test found or invalid token, using default requirements");
            setAssessmentInfo(null);
            setCandidateRequirements(DEFAULT_REQUIREMENTS);
            setFetchingAssessment(false);
            return;
          }

          setAssessmentInfo(test);

          // Get candidate requirements from schedule
          const schedule = test?.schedule || {};
          console.log("Schedule from AIML test:", schedule);
          
          const candidateReqs = schedule?.candidateRequirements || {};
          console.log("Candidate requirements from schedule:", candidateReqs);

          // More robust normalization - handle both boolean and string "true"/"false"
          const normalizeBool = (val: any): boolean => {
            if (val === true || val === "true" || val === 1 || val === "1") return true;
            if (val === false || val === "false" || val === 0 || val === "0" || val === null || val === undefined) return false;
            return Boolean(val);
          };

          const normalizedRequirements = {
            requireEmail: false, // Email is always collected in entry page
            requireName: false, // Name is always collected in entry page
            requirePhone: normalizeBool(candidateReqs?.requirePhone),
            requireResume: normalizeBool(candidateReqs?.requireResume),
            requireLinkedIn: normalizeBool(candidateReqs?.requireLinkedIn),
            requireGithub: normalizeBool(candidateReqs?.requireGithub),
          };

          // Handle custom fields
          const customFieldsData = candidateReqs?.customFields || [];
          console.log("[AIML DEBUG] Custom fields from schedule:", customFieldsData);
          console.log("[AIML DEBUG] Custom fields length:", customFieldsData.length);
          setCustomFields(customFieldsData);

          console.log("[AIML DEBUG] Normalized candidate requirements for AIML:", normalizedRequirements);
          setCandidateRequirements(normalizedRequirements);

          const hasAnyRequirement =
            normalizedRequirements.requireEmail ||
            normalizedRequirements.requireName ||
            normalizedRequirements.requirePhone ||
            normalizedRequirements.requireResume ||
            normalizedRequirements.requireLinkedIn ||
            normalizedRequirements.requireGithub ||
            (customFieldsData.length > 0);

          console.log("[AIML DEBUG] hasAnyRequirement check breakdown:", {
            requireEmail: normalizedRequirements.requireEmail,
            requireName: normalizedRequirements.requireName,
            requirePhone: normalizedRequirements.requirePhone,
            requireResume: normalizedRequirements.requireResume,
            requireLinkedIn: normalizedRequirements.requireLinkedIn,
            requireGithub: normalizedRequirements.requireGithub,
            customFieldsLength: customFieldsData.length,
            hasAnyRequirement: hasAnyRequirement,
            hasNavigatedRef: hasNavigatedRef.current,
            id: id,
            token: token
          });

          // If no requirements are enabled, skip this page
          if (!hasAnyRequirement && id && token && !hasNavigatedRef.current) {
            console.log("[AIML DEBUG] ⚠️ No candidate requirements enabled for AIML, skipping to identity verification");
            // Set flag BEFORE navigating to prevent redirect loop
            sessionStorage.setItem(`candidateRequirementsCompleted_${id}`, "true");
            hasNavigatedRef.current = true;
            // Use replace instead of push to avoid history stack issues
            router.replace(`/assessment/${id}/${token}/identity-verify`).catch((err) => {
              // Ignore abort errors during navigation
              if (err.name !== "AbortError" && err.message !== "Abort fetching component") {
                console.error("Navigation error:", err);
              }
            });
          } else {
            console.log("[AIML DEBUG] ✅ Requirements ARE enabled or navigation guard active - staying on candidate requirements page");
            console.log("[AIML DEBUG] Navigation blocked because:", {
              hasAnyRequirement: hasAnyRequirement,
              hasNavigatedRef: hasNavigatedRef.current,
              hasId: !!id,
              hasToken: !!token
            });
          }

          setError(null);
        } catch (error: any) {
          console.error("Error fetching AIML test:", {
            message: error?.message,
            response: error?.response?.data,
            status: error?.response?.status,
          });

          setError("Failed to load test settings. Using default requirements.");
          setCandidateRequirements(DEFAULT_REQUIREMENTS);
        } finally {
          setFetchingAssessment(false);
        }
      };

      fetchAIMLTest();
      return;
    }

    // For custom-mcq flow, fetch requirements from custom MCQ assessment
    if (isCustomMCQFlow && id && token) {
      const fetchCustomMCQAssessment = async () => {
        try {
          setFetchingAssessment(true);
          setError(null);

          // Fetch custom MCQ assessment
          const response = await axios.get(
            `/api/custom-mcq/take/${id}`,
            {
              params: { token }
            }
          );

          const data = response.data;
          console.log("Custom MCQ API response:", data);
          
          // Handle different response structures
          const assessment = data?.data || data?.assessment || data;

          if (!assessment || typeof assessment !== "object") {
            console.warn("No custom MCQ assessment found, using default requirements");
            setAssessmentInfo(null);
            setCandidateRequirements(DEFAULT_REQUIREMENTS);
            setFetchingAssessment(false);
            return;
          }

          setAssessmentInfo(assessment);

          // Get candidate requirements from schedule
          const schedule = assessment?.schedule || {};
          console.log("Schedule from assessment:", schedule);
          
          const candidateReqs = schedule?.candidateRequirements || {};
          console.log("Candidate requirements from schedule:", candidateReqs);

          // More robust normalization - handle both boolean and string "true"/"false"
          const normalizeBool = (val: any): boolean => {
            if (val === true || val === "true" || val === 1 || val === "1") return true;
            if (val === false || val === "false" || val === 0 || val === "0" || val === null || val === undefined) return false;
            return Boolean(val);
          };

          const normalizedRequirements = {
            requireEmail: false, // Email is always collected in entry page
            requireName: false, // Name is always collected in entry page
            requirePhone: normalizeBool(candidateReqs?.requirePhone),
            requireResume: normalizeBool(candidateReqs?.requireResume),
            requireLinkedIn: normalizeBool(candidateReqs?.requireLinkedIn),
            requireGithub: normalizeBool(candidateReqs?.requireGithub),
          };

          console.log("Normalized candidate requirements for custom MCQ:", normalizedRequirements);
          setCandidateRequirements(normalizedRequirements);

          const hasAnyRequirement =
            normalizedRequirements.requirePhone ||
            normalizedRequirements.requireResume ||
            normalizedRequirements.requireLinkedIn ||
            normalizedRequirements.requireGithub;

          // If no requirements are enabled, skip this page
          if (!hasAnyRequirement && id && token && !hasNavigatedRef.current) {
            console.log("No candidate requirements enabled for custom MCQ, skipping to identity verification");
            // Set flag BEFORE navigating to prevent redirect loop
            sessionStorage.setItem(`candidateRequirementsCompleted_${id}`, "true");
            hasNavigatedRef.current = true;
            // Use replace instead of push to avoid history stack issues
            router.replace(`/assessment/${id}/${token}/identity-verify`).catch((err) => {
              // Ignore abort errors during navigation
              if (err.name !== "AbortError" && err.message !== "Abort fetching component") {
                console.error("Navigation error:", err);
              }
            });
          }

          setError(null);
        } catch (error: any) {
          console.error("Error fetching custom MCQ assessment:", {
            message: error?.message,
            response: error?.response?.data,
            status: error?.response?.status,
          });

          setError("Failed to load assessment settings. Using default requirements.");
          setCandidateRequirements(DEFAULT_REQUIREMENTS);
        } finally {
          setFetchingAssessment(false);
        }
      };

      fetchCustomMCQAssessment();
      return;
    }

    // Non-AI flows (other than custom-mcq and dsa): skip AI-only backend calls entirely and proceed
    // DSA and AIML flows are handled above with their own fetch logic
    if (!isAIFlow && !isCustomMCQFlow && !isDSAFlow && !isAIMLFlow && id && token) {
      sessionStorage.setItem(`candidateRequirementsCompleted_${id}`, "true");
          router.replace(`/assessment/${id}/${token}/identity-verify`).catch((err) => {
            if (err.name !== "AbortError" && err.message !== "Abort fetching component") {
              console.error("Navigation error:", err);
            }
          });
      setFetchingAssessment(false);
      return;
    }

    // AI: Fetch assessment info to get candidate requirements settings
    const fetchAssessment = async () => {
      const tokenStr = Array.isArray(token) ? token[0] : token;
      console.log("[candidate-requirements] 🚀 fetchAssessment called:", {
        id,
        hasToken: !!tokenStr,
        tokenPreview: tokenStr ? tokenStr.substring(0, 20) + '...' : 'no token',
        timestamp: new Date().toISOString(),
      });
      
      if (!id || !tokenStr) {
        console.error("[candidate-requirements] ❌ Missing id or token:", { id, hasToken: !!tokenStr });
        setFetchingAssessment(false);
        return;
      }

      try {
        setFetchingAssessment(true);
        setError(null);
        
        const apiUrl = `/api/assessment/get-assessment-full?assessmentId=${id}&token=${tokenStr}`;
        console.log("[candidate-requirements] 🔵 Calling Next.js API route:", {
          url: apiUrl,
          fullUrl: `${window.location.origin}${apiUrl}`,
        });
 
        const response = await axios.get(apiUrl);

        console.log("[candidate-requirements] ✅ API response received:", {
          status: response.status,
          statusText: response.statusText,
          hasData: !!response.data,
          dataType: typeof response.data,
          dataKeys: response.data ? Object.keys(response.data) : [],
        });

        const data = response.data;
        console.log("[candidate-requirements] 📋 Raw response data:", {
          data,
          dataString: JSON.stringify(data).substring(0, 500),
        });
 
        // 🔑 Normalize all possible response formats
        const assessment =
          data?.data ||          // { success, data: {...} }
          data?.assessment ||    // { assessment: {...} }
          data?.message ||       // 🔥 Your case: { success, message: {...}, data: null }
          data;                  // Fallback to data itself
 
        // If we still don't have a usable object, fallback to defaults
        if (!assessment || typeof assessment !== "object") {
          console.warn("No assessment found in response, using default requirements");
          setAssessmentInfo(null);
          setCandidateRequirements(DEFAULT_REQUIREMENTS);
          setFetchingAssessment(false);
          return;
        }
 
        // We now have the assessment object
        setAssessmentInfo(assessment);
 
        // 🔧 FIX: Use optional chaining throughout and provide defaults
        const schedule = assessment?.schedule;
        const candidateReqs = schedule?.candidateRequirements;

        // Handle custom fields
        const customFieldsData = candidateReqs?.customFields || [];
        console.log("[AI DEBUG] Custom fields from schedule:", customFieldsData);
        console.log("[AI DEBUG] Custom fields length:", customFieldsData.length);
        setCustomFields(customFieldsData);

        // 🔧 FIX: If candidateRequirements doesn't exist, use defaults
        const normalizedRequirements = {
          requireEmail: candidateReqs?.requireEmail ?? DEFAULT_REQUIREMENTS.requireEmail,
          requireName: candidateReqs?.requireName ?? DEFAULT_REQUIREMENTS.requireName,
          requirePhone: candidateReqs?.requirePhone ?? DEFAULT_REQUIREMENTS.requirePhone,
          requireResume: candidateReqs?.requireResume ?? DEFAULT_REQUIREMENTS.requireResume,
          requireLinkedIn: candidateReqs?.requireLinkedIn ?? DEFAULT_REQUIREMENTS.requireLinkedIn,
          requireGithub: candidateReqs?.requireGithub ?? DEFAULT_REQUIREMENTS.requireGithub,
        };

        console.log("[AI DEBUG] Raw candidateReqs:", candidateReqs);
        console.log("[AI DEBUG] Normalized candidate requirements:", normalizedRequirements);
        setCandidateRequirements(normalizedRequirements);

        const hasAnyRequirement =
          normalizedRequirements.requireEmail ||
          normalizedRequirements.requireName ||
          normalizedRequirements.requirePhone ||
          normalizedRequirements.requireResume ||
          normalizedRequirements.requireLinkedIn ||
          normalizedRequirements.requireGithub ||
          (customFieldsData.length > 0);

        console.log("[AI DEBUG] hasAnyRequirement check breakdown:", {
          requireEmail: normalizedRequirements.requireEmail,
          requireName: normalizedRequirements.requireName,
          requirePhone: normalizedRequirements.requirePhone,
          requireResume: normalizedRequirements.requireResume,
          requireLinkedIn: normalizedRequirements.requireLinkedIn,
          requireGithub: normalizedRequirements.requireGithub,
          customFieldsLength: customFieldsData.length,
          hasAnyRequirement: hasAnyRequirement,
          hasNavigatedRef: hasNavigatedRef.current,
          id: id,
          token: token
        });
 
        // If no requirements are enabled, skip this page
        if (!hasAnyRequirement && id && token && !hasNavigatedRef.current) {
          console.log("[AI DEBUG] ⚠️ No candidate requirements enabled, skipping to identity verification");
          // Set flag BEFORE navigating to prevent redirect loop
          sessionStorage.setItem(`candidateRequirementsCompleted_${id}`, "true");
          hasNavigatedRef.current = true;
          // Use replace instead of push to avoid history stack issues
          router.replace(`/assessment/${id}/${token}/identity-verify`).catch((err) => {
            // Ignore abort errors during navigation
            if (err.name !== "AbortError" && err.message !== "Abort fetching component") {
              console.error("Navigation error:", err);
            }
          });
        } else {
          console.log("[AI DEBUG] ✅ Requirements ARE enabled or navigation guard active - staying on candidate requirements page");
          console.log("[AI DEBUG] Navigation blocked because:", {
            hasAnyRequirement: hasAnyRequirement,
            hasNavigatedRef: hasNavigatedRef.current,
            hasId: !!id,
            hasToken: !!token
          });
        }
       
        // Clear any previous errors since we successfully loaded the assessment
        setError(null);
      } catch (error: any) {
        console.error("Error fetching assessment:", {
          message: error?.message,
          response: error?.response?.data,
          status: error?.response?.status,
        });
 
        setError("Failed to load assessment settings. Using default requirements.");
        setCandidateRequirements(DEFAULT_REQUIREMENTS);
      } finally {
        setFetchingAssessment(false);
      }
    };
   
    if (id && token) {
      fetchAssessment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, token]);
 
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type (PDF, DOC, DOCX)
      const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
      if (!allowedTypes.includes(file.type)) {
        setError("Please upload a PDF, DOC, or DOCX file");
        return;
      }
     
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }
     
      setResumeFile(file);
      setResumeFileName(file.name);
      setError(null);
    }
  };
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Disable button immediately to prevent double-clicks
    if (loading) return;
    setLoading(true);
    setError(null);
    
    // Determine flow type
    const ctx = getGateContext(id as string);
    const isAIFlow = !ctx || ctx.flowType === "ai";
    const isDSAFlow = ctx?.flowType === "dsa";
    const isCustomMCQFlow = ctx?.flowType === "custom-mcq";
    const isAIMLFlow = ctx?.flowType === "aiml";
   
    // Validate only required fields
    if (candidateRequirements.requireEmail && !email.trim()) {
      setError("Email is required");
      setLoading(false);
      return;
    }
    
    if (candidateRequirements.requireName && !name.trim()) {
      setError("Full Name is required");
      setLoading(false);
      return;
    }
    
    if (candidateRequirements.requirePhone && !phone.trim()) {
      setError("Phone Number is required");
      setLoading(false);
      return;
    }
    
    if (candidateRequirements.requireResume && !resumeFile) {
      setError("Resume upload is required");
      setLoading(false);
      return;
    }
    
    if (candidateRequirements.requireLinkedIn && !linkedInUrl.trim()) {
      setError("LinkedIn URL is required");
      setLoading(false);
      return;
    }
    
    if (candidateRequirements.requireGithub && !githubUrl.trim()) {
      setError("GitHub URL is required");
      setLoading(false);
      return;
    }
    
    // Validate custom fields
    for (const field of customFields) {
      if (field.required && !customFieldValues[field.label]?.trim()) {
        setError(`${field.label} is required`);
        setLoading(false);
        return;
      }
    }
    
    // Validate email format if email is required
    if (candidateRequirements.requireEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError("Please enter a valid email address");
        setLoading(false);
        return;
      }
    }
    
    // Validate LinkedIn URL format if required
    if (candidateRequirements.requireLinkedIn && linkedInUrl.trim()) {
      const linkedInRegex = /^https?:\/\/(www\.)?linkedin\.com\/.+/i;
      if (!linkedInRegex.test(linkedInUrl.trim())) {
        setError("Please enter a valid LinkedIn URL (e.g., https://www.linkedin.com/in/yourprofile)");
        setLoading(false);
        return;
      }
    }
    
    // Validate GitHub URL format if required
    if (candidateRequirements.requireGithub && githubUrl.trim()) {
      const githubRegex = /^https?:\/\/(www\.)?github\.com\/.+/i;
      if (!githubRegex.test(githubUrl.trim())) {
        setError("Please enter a valid GitHub URL (e.g., https://github.com/yourusername)");
        setLoading(false);
        return;
      }
    }
   
    try {
      // Update sessionStorage with candidate info
      // For email/name: if required, use form value; if not required, preserve existing from sessionStorage
      const existingEmail = sessionStorage.getItem("candidateEmail") || "";
      const existingName = sessionStorage.getItem("candidateName") || "";
      
      if (candidateRequirements.requireEmail && email.trim()) {
        sessionStorage.setItem("candidateEmail", email.trim());
      } else if (!candidateRequirements.requireEmail && existingEmail) {
        // Preserve existing email if not required
        sessionStorage.setItem("candidateEmail", existingEmail);
      }
      
      if (candidateRequirements.requireName && name.trim()) {
        sessionStorage.setItem("candidateName", name.trim());
      } else if (!candidateRequirements.requireName && existingName) {
        // Preserve existing name if not required
        sessionStorage.setItem("candidateName", existingName);
      }
      
      if (phone.trim()) {
        sessionStorage.setItem("candidatePhone", phone.trim());
      }
      if (linkedInUrl.trim()) {
        sessionStorage.setItem("candidateLinkedIn", linkedInUrl.trim());
      }
      if (githubUrl.trim()) {
        sessionStorage.setItem("candidateGithub", githubUrl.trim());
      }
      
      // Store custom fields
      if (Object.keys(customFieldValues).length > 0) {
        sessionStorage.setItem("candidateCustomFields", JSON.stringify(customFieldValues));
      }
     
      // Get final email/name values (from form if required, or from sessionStorage if preserved)
      const finalEmail = (candidateRequirements.requireEmail && email.trim()) 
        ? email.trim() 
        : (sessionStorage.getItem("candidateEmail") || "");
      const finalName = (candidateRequirements.requireName && name.trim()) 
        ? name.trim() 
        : (sessionStorage.getItem("candidateName") || "");
     
      // Upload resume if provided - MUST complete before saving candidate info
      if (resumeFile) {
        const formData = new FormData();
        formData.append("resume", resumeFile);
        formData.append("assessmentId", id as string);
        formData.append("token", token as string);
        formData.append("email", finalEmail);
        formData.append("name", finalName);
       
        try {
          const uploadResponse = await axios.post("/api/assessment/upload-resume", formData, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });
          console.log("[Candidate Requirements] Resume upload successful:", uploadResponse.data);
        } catch (uploadError: any) {
          console.error("Resume upload failed:", uploadError);
          // Show error but don't block - backend will preserve existing resume if upload failed
          setError("Resume upload failed. Please try again or continue without resume.");
        }
      }
     
      // Small delay to ensure resume upload completes and is saved to DB
      if (resumeFile) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
     
      // Save candidate requirements to backend
      // For custom MCQ, data is stored in sessionStorage and sent with assessment submission
      if (isAIFlow) {
        try {
          // Prepare custom fields object
          const customFieldsObj: Record<string, string> = {};
          if (Object.keys(customFieldValues).length > 0) {
            customFields.forEach((field) => {
              if (customFieldValues[field.label]) {
                customFieldsObj[field.label] = customFieldValues[field.label];
              }
            });
          }
          
          await axios.post("/api/assessment/save-candidate-info", {
            assessmentId: id,
            token,
            email: finalEmail,
            name: finalName,
            phone: phone.trim() || null,
            hasResume: !!resumeFile,
            linkedIn: linkedInUrl.trim() || null,
            github: githubUrl.trim() || null,
            customFields: Object.keys(customFieldsObj).length > 0 ? customFieldsObj : null,
          });
        } catch (saveError: any) {
          console.warn("Failed to save candidate info (non-blocking):", saveError);
        }
      } else if (isDSAFlow) {
        // For DSA flow, use DSA-specific endpoint
        try {
          // Prepare custom fields object
          const customFieldsObj: Record<string, string> = {};
          if (Object.keys(customFieldValues).length > 0) {
            customFields.forEach((field) => {
              if (customFieldValues[field.label]) {
                customFieldsObj[field.label] = customFieldValues[field.label];
              }
            });
          }
          
          await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:80"}/api/v1/dsa/tests/${id}/save-candidate-info`,
            {
              email: finalEmail,
              name: finalName,
              phone: phone.trim() || null,
              hasResume: !!resumeFile,
              linkedIn: linkedInUrl.trim() || null,
              github: githubUrl.trim() || null,
              customFields: Object.keys(customFieldsObj).length > 0 ? customFieldsObj : null,
            }
          );
        } catch (saveError: any) {
          console.warn("Failed to save DSA candidate info (non-blocking):", saveError);
        }
      }
     
      // Mark this step as completed
      sessionStorage.setItem(`candidateRequirementsCompleted_${id}`, "true");
     
      // Show success message briefly, then navigate
      setSuccess(true);
      setError(null);
     
      // Keep loading state true during navigation to show "Redirecting..." in button
      // Navigate to identity verification page after a brief delay to show success message
      setTimeout(() => {
        router.push(`/assessment/${id}/${token}/identity-verify`).catch((err) => {
          // Ignore abort errors during navigation
          if (err.name !== "AbortError" && err.message !== "Abort fetching component") {
            console.error("Navigation error:", err);
            setError("Failed to navigate to next page. Please try again.");
            setLoading(false);
            setSuccess(false);
          }
        });
      }, 500);
      // Note: We don't set loading to false in finally block - let it stay true during navigation
      // The page will unmount when navigation completes, so loading state doesn't matter
    } catch (err: any) {
      console.error("Error submitting candidate requirements:", err);
      setError(err.response?.data?.message || "Failed to submit information. Please try again.");
      setSuccess(false);
      setLoading(false);
    }
  };
 
  // Show loading state while fetching assessment
  if (fetchingAssessment) {
    return (
      <div style={{
        minHeight: "100vh",
        backgroundColor: "#f7f3e8",
        padding: "1.5rem",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          border: "1px solid #e5e7eb",
          textAlign: "center"
        }}>
          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>
            Loading assessment requirements...
          </div>
        </div>
      </div>
    );
  }
 
  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#f7f3e8",
      padding: "1.5rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }}>
      <div style={{ maxWidth: "500px", width: "100%" }}>
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "0.75rem",
          padding: "1.5rem",
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          border: "1px solid #e5e7eb"
        }}>
          {/* Header */}
          <div style={{ marginBottom: "1.25rem" }}>
            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, color: "#1e293b", marginBottom: "0.25rem" }}>
              Candidate Requirements
            </h1>
            <p style={{ color: "#64748b", fontSize: "0.875rem", margin: 0 }}>
              Please provide the following information to proceed
            </p>
          </div>
         
          {/* Assessment fetch error (non-blocking) */}
          {error && (
            <div style={{
              padding: "0.625rem 0.75rem",
              backgroundColor: "#fef3c7",
              border: "1px solid #fde68a",
              borderRadius: "0.375rem",
              color: "#92400e",
              marginBottom: "1rem",
              fontSize: "0.8125rem"
            }}>
              ⚠️ {error}
            </div>
          )}
          
          {/* Show message if no fields are required */}
          {!fetchingAssessment && 
           !candidateRequirements.requireEmail && 
           !candidateRequirements.requireName && 
           !candidateRequirements.requirePhone && 
           !candidateRequirements.requireResume && 
           !candidateRequirements.requireLinkedIn && 
           !candidateRequirements.requireGithub && 
           customFields.length === 0 && (
            <div style={{
              padding: "1rem",
              backgroundColor: "#f0f9ff",
              border: "1px solid #bae6fd",
              borderRadius: "0.375rem",
              color: "#0369a1",
              marginBottom: "1rem",
              textAlign: "center"
            }}>
              No additional information is required. You can proceed directly.
            </div>
          )}
          
          {/* Warning if DSA flow but no requirements found */}
          {!fetchingAssessment && isDSAFlow && 
           !candidateRequirements.requirePhone && 
           !candidateRequirements.requireResume && 
           !candidateRequirements.requireLinkedIn && 
           !candidateRequirements.requireGithub && (
            <div style={{
              padding: "1rem",
              backgroundColor: "#fef3c7",
              border: "1px solid #fde68a",
              borderRadius: "0.375rem",
              color: "#92400e",
              marginBottom: "1rem",
              fontSize: "0.875rem"
            }}>
              ⚠️ <strong>No candidate requirements found for this test.</strong>
              <p style={{ margin: "0.5rem 0 0 0" }}>
                This page will automatically redirect you to the next step. If you expected to see input fields here:
              </p>
              <ul style={{ margin: "0.5rem 0 0 1.5rem", padding: 0 }}>
                <li><strong>Create a NEW test</strong> with the candidate requirements checkboxes enabled</li>
                <li>Old tests created before this feature was added won't have requirements saved</li>
                <li>Check the browser console for detailed logs about what was fetched</li>
                <li>Check the debug section below to see the schedule data</li>
              </ul>
            </div>
          )}
          
          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ display: "grid", gap: "1rem", marginBottom: "1.25rem" }}>
              {/* Email - Only show if required */}
              {candidateRequirements.requireEmail && (
                <div>
                  <label style={{
                    display: "block",
                    marginBottom: "0.375rem",
                    fontWeight: 500,
                    color: "#374151",
                    fontSize: "0.875rem"
                  }}>
                    Email <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#6953a3"}
                    onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                  />
                </div>
              )}
             
              {/* Name - Only show if required */}
              {candidateRequirements.requireName && (
                <div>
                  <label style={{
                    display: "block",
                    marginBottom: "0.375rem",
                    fontWeight: 500,
                    color: "#374151",
                    fontSize: "0.875rem"
                  }}>
                    Full Name <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#6953a3"}
                    onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                  />
                </div>
              )}
             
              {/* Phone - Only show if required */}
              {candidateRequirements.requirePhone && (
                <div>
                  <label style={{
                    display: "block",
                    marginBottom: "0.375rem",
                    fontWeight: 500,
                    color: "#374151",
                    fontSize: "0.875rem"
                  }}>
                    Phone Number <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#6953a3"}
                    onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                  />
                </div>
              )}
              
              {/* LinkedIn URL - Only show if required */}
              {candidateRequirements.requireLinkedIn && (
                <div>
                  <label style={{
                    display: "block",
                    marginBottom: "0.375rem",
                    fontWeight: 500,
                    color: "#374151",
                    fontSize: "0.875rem"
                  }}>
                    LinkedIn URL <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="url"
                    value={linkedInUrl}
                    onChange={(e) => setLinkedInUrl(e.target.value)}
                    placeholder="https://www.linkedin.com/in/yourprofile"
                    required
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#6953a3"}
                    onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                  />
                </div>
              )}
              
              {/* GitHub URL - Only show if required */}
              {candidateRequirements.requireGithub && (
                <div>
                  <label style={{
                    display: "block",
                    marginBottom: "0.375rem",
                    fontWeight: 500,
                    color: "#374151",
                    fontSize: "0.875rem"
                  }}>
                    GitHub URL <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/yourusername"
                    required
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#6953a3"}
                    onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                  />
                </div>
              )}
              
              {/* Custom Fields - Only show if configured */}
              {customFields.map((field, index) => (
                <div key={index}>
                  <label style={{
                    display: "block",
                    marginBottom: "0.375rem",
                    fontWeight: 500,
                    color: "#374151",
                    fontSize: "0.875rem"
                  }}>
                    {field.label} {field.required && <span style={{ color: "#ef4444" }}>*</span>}
                  </label>
                  <input
                    type="text"
                    value={customFieldValues[field.label] || ""}
                    onChange={(e) => setCustomFieldValues({ ...customFieldValues, [field.label]: e.target.value })}
                    required={field.required}
                    style={{
                      width: "100%",
                      padding: "0.625rem 0.75rem",
                      border: "1px solid #d1d5db",
                      borderRadius: "0.375rem",
                      fontSize: "0.875rem",
                      outline: "none",
                      transition: "border-color 0.2s",
                      boxSizing: "border-box"
                    }}
                    onFocus={(e) => e.target.style.borderColor = "#6953a3"}
                    onBlur={(e) => e.target.style.borderColor = "#d1d5db"}
                  />
                </div>
              ))}
              
              {/* Resume Upload - Only show if required */}
              {candidateRequirements.requireResume && (
                <div>
                  <label style={{
                    display: "block",
                    marginBottom: "0.375rem",
                    fontWeight: 500,
                    color: "#374151",
                    fontSize: "0.875rem"
                  }}>
                    Resume <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                <div style={{
                  border: "2px dashed #d1d5db",
                  borderRadius: "0.375rem",
                  padding: "1rem",
                  textAlign: "center",
                  backgroundColor: "#f9fafb",
                  transition: "border-color 0.2s",
                  cursor: "pointer",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#6953a3";
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderColor = "#d1d5db";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.style.borderColor = "#d1d5db";
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
                    if (allowedTypes.includes(file.type) && file.size <= 5 * 1024 * 1024) {
                      setResumeFile(file);
                      setResumeFileName(file.name);
                      setError(null);
                    } else {
                      setError("Please upload a PDF, DOC, or DOCX file (max 5MB)");
                    }
                  }
                }}
                >
                  <input
                    type="file"
                    id="resume-upload"
                    accept=".pdf,.doc,.docx"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                  />
                  <label
                    htmlFor="resume-upload"
                    style={{
                      cursor: "pointer",
                      display: "block",
                      color: "#6953a3",
                      fontWeight: 600,
                    }}
                  >
                    {resumeFileName ? (
                      <div>
                        <div style={{ marginBottom: "0.25rem", fontSize: "0.875rem" }}>✓ {resumeFileName}</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                          Click to change file
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ marginBottom: "0.375rem", fontSize: "1.25rem" }}>📄</div>
                        <div style={{ fontSize: "0.875rem" }}>Click to upload or drag and drop</div>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                          PDF, DOC, or DOCX (max 5MB)
                        </div>
                      </div>
                    )}
                  </label>
                </div>
                </div>
              )}
            </div>
           
            {/* Success Message */}
            {success && (
              <div style={{
                padding: "0.625rem 0.75rem",
                backgroundColor: "#d1fae5",
                border: "1px solid #86efac",
                borderRadius: "0.375rem",
                color: "#065f46",
                marginBottom: "1rem",
                fontSize: "0.8125rem"
              }}>
                ✓ Information saved successfully!
              </div>
            )}
            
            {/* Error Message */}
            {error && (
              <div style={{
                padding: "0.625rem 0.75rem",
                backgroundColor: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: "0.375rem",
                color: "#991b1b",
                marginBottom: "1rem",
                fontSize: "0.8125rem"
              }}>
                {error}
              </div>
            )}
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading ||
                (candidateRequirements.requireEmail && !email.trim()) ||
                (candidateRequirements.requireName && !name.trim()) ||
                (candidateRequirements.requirePhone && !phone.trim()) ||
                (candidateRequirements.requireResume && !resumeFile) ||
                (candidateRequirements.requireLinkedIn && !linkedInUrl.trim()) ||
                (candidateRequirements.requireGithub && !githubUrl.trim())}
              style={{
                width: "100%",
                padding: "0.75rem 1.5rem",
                backgroundColor: (loading ||
                  (candidateRequirements.requireEmail && !email.trim()) ||
                  (candidateRequirements.requireName && !name.trim()) ||
                  (candidateRequirements.requirePhone && !phone.trim()) ||
                  (candidateRequirements.requireResume && !resumeFile) ||
                  (candidateRequirements.requireLinkedIn && !linkedInUrl.trim()) ||
                  (candidateRequirements.requireGithub && !githubUrl.trim())) ? "#e2e8f0" : "#6953a3",
                color: (loading ||
                  (candidateRequirements.requireEmail && !email.trim()) ||
                  (candidateRequirements.requireName && !name.trim()) ||
                  (candidateRequirements.requirePhone && !phone.trim()) ||
                  (candidateRequirements.requireResume && !resumeFile) ||
                  (candidateRequirements.requireLinkedIn && !linkedInUrl.trim()) ||
                  (candidateRequirements.requireGithub && !githubUrl.trim())) ? "#94a3b8" : "#ffffff",
                border: "none",
                borderRadius: "0.375rem",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: (loading ||
                  (candidateRequirements.requireEmail && !email.trim()) ||
                  (candidateRequirements.requireName && !name.trim()) ||
                  (candidateRequirements.requirePhone && !phone.trim()) ||
                  (candidateRequirements.requireResume && !resumeFile) ||
                  (candidateRequirements.requireLinkedIn && !linkedInUrl.trim()) ||
                  (candidateRequirements.requireGithub && !githubUrl.trim())) ? "not-allowed" : "pointer",
                boxShadow: (loading ||
                  (candidateRequirements.requireEmail && !email.trim()) ||
                  (candidateRequirements.requireName && !name.trim()) ||
                  (candidateRequirements.requirePhone && !phone.trim()) ||
                  (candidateRequirements.requireResume && !resumeFile) ||
                  (candidateRequirements.requireLinkedIn && !linkedInUrl.trim()) ||
                  (candidateRequirements.requireGithub && !githubUrl.trim())) ? "none" : "0 2px 4px rgba(105, 83, 163, 0.2)",
                transition: "all 0.2s ease"
              }}
            >
              {loading ? (success ? "Redirecting..." : "Submitting...") : "Continue to Assessment →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
 