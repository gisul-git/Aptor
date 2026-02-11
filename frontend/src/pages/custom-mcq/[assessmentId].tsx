import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../lib/auth";
import { customMCQApi } from "../../lib/custom-mcq/api";
import { CustomMCQAssessment, AssessmentSubmission } from "../../types/custom-mcq";
import ProctorSummaryCard from "../../components/admin/ProctorSummaryCard";
import ProctorLogsReview from "../../components/admin/ProctorLogsReview";
import { useSession } from "next-auth/react";
import { Eye, Video } from "lucide-react";
import axios from "axios";
import Link from "next/link";
import EmailInvitationModal from "../../components/custom-mcq/EmailInvitationModal";
// React Query hooks
import { 
  useCustomMCQAssessment, 
  useUpdateCustomMCQAssessment,
  useDeleteCustomMCQAssessment,
  useSendCustomMCQInvitations
} from "@/hooks/api/useCustomMCQ";

interface CustomMCQDetailsPageProps {
  session: any;
}

export default function CustomMCQDetailsPage({ session }: CustomMCQDetailsPageProps) {
  const router = useRouter();
  const { data: sessionData } = useSession();
  const { assessmentId } = router.query;
  
  // Use React Query hooks
  const { 
    data: assessment, 
    isLoading: loading, 
    error: assessmentError 
  } = useCustomMCQAssessment(
    typeof assessmentId === 'string' ? assessmentId : undefined
  );
  const updateAssessmentMutation = useUpdateCustomMCQAssessment();
  const deleteAssessmentMutation = useDeleteCustomMCQAssessment();
  const sendInvitationsMutation = useSendCustomMCQInvitations();
  
  const error = assessmentError?.message || null;
  const [proctorLogsByUser, setProctorLogsByUser] = useState<Record<string, any[]>>({});
  const [proctorLabelsByUser, setProctorLabelsByUser] = useState<Record<string, Record<string, string>>>({});
  const [proctorSummaryByUser, setProctorSummaryByUser] = useState<Record<string, { summary: Record<string, number>; totalViolations: number }>>({});
  const [loadingProctorForUser, setLoadingProctorForUser] = useState<Record<string, boolean>>({});
  const [expandedProctorUser, setExpandedProctorUser] = useState<string | null>(null);
  const [expandedAnswerLogsUser, setExpandedAnswerLogsUser] = useState<string | null>(null);
  const [expandedRequirementsUser, setExpandedRequirementsUser] = useState<string | null>(null);
  const [showCandidates, setShowCandidates] = useState(false);
  const [expandedCodingLogsUser, setExpandedCodingLogsUser] = useState<string | null>(null);
  const [expandedOverallFeedbackUser, setExpandedOverallFeedbackUser] = useState<string | null>(null);
  const [referencePhotos, setReferencePhotos] = useState<Record<string, string | null>>({});
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false);
  const [newCandidateName, setNewCandidateName] = useState("");
  const [newCandidateEmail, setNewCandidateEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [addingCandidate, setAddingCandidate] = useState(false);
  const [showEmailTemplateModal, setShowEmailTemplateModal] = useState(false);
  const [showSendEmailModal, setShowSendEmailModal] = useState(false);
  const [emailTemplate, setEmailTemplate] = useState({
    logoUrl: "",
    companyName: "",
    message: "You have been invited to take a Custom MCQ assessment. Please click the link below to start.",
    footer: "",
    sentBy: "AI Assessment Platform",
  });
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [sendingInvitations, setSendingInvitations] = useState(false);
  // Removed isLiveProctoringCooldown - no longer needed

  // Fetch reference photos for all submissions when assessment loads
  useEffect(() => {
    if (!assessment) return;
    const submissions = (assessment as any).submissionsList || [];
    if (submissions.length > 0) {
      submissions.forEach((submission: AssessmentSubmission) => {
        const candidateInfo = submission.candidateInfo || {};
        const userEmail = String(candidateInfo.email || "").trim();
        if (userEmail && !referencePhotos[userEmail]) {
          fetchReferencePhoto(userEmail);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessment]);

  // Handle Live Proctoring cooldown when dashboard closes
  // Removed 8-second cooldown - no longer needed as reconnection is handled properly

  // Removed loadAssessment - now using React Query hook

  const validateEmail = (email: string): boolean => {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailPattern.test(email);
  };

  const handleAddCandidate = async () => {
    if (!assessmentId || typeof assessmentId !== "string" || !assessment) return;

    // Validate email
    if (!validateEmail(newCandidateEmail.trim())) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    if (!newCandidateName.trim()) {
      setEmailError("Please enter a candidate name.");
      return;
    }

    setEmailError(null);
    setAddingCandidate(true);

    try {
      // Get existing candidates
      const existingCandidates = assessment.candidates || [];
      
      // Check if candidate already exists
      const emailLower = newCandidateEmail.trim().toLowerCase();
      if (existingCandidates.some((c: any) => c.email?.toLowerCase() === emailLower)) {
        setEmailError("A candidate with this email already exists.");
        setAddingCandidate(false);
        return;
      }

      // Add new candidate to the array
      const updatedCandidates = [
        ...existingCandidates,
        {
          name: newCandidateName.trim(),
          email: emailLower,
        },
      ];

      // Update assessment with new candidates array
      await updateAssessmentMutation.mutateAsync({
        assessmentId,
        updates: {
          candidates: updatedCandidates,
        },
      });

      // React Query will automatically refetch and update the UI

      // Close modal and reset form
      setShowAddCandidateModal(false);
      setNewCandidateName("");
      setNewCandidateEmail("");
      setEmailError(null);
      alert("Candidate added successfully!");
    } catch (err: any) {
      setEmailError(err.response?.data?.detail || err.response?.data?.message || err.message || "Failed to add candidate");
    } finally {
      setAddingCandidate(false);
    }
  };

  const handleSaveEmailTemplate = async () => {
    // For Custom MCQ, we'll just save to local state since there's no backend template storage
    // The template will be used when sending invitations
    setSavingTemplate(true);
    try {
      setShowEmailTemplateModal(false);
      alert("Email template saved! It will be used for sending invitations.");
    } catch (err: any) {
      alert(err.message || "Failed to save email template");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleSendInvitationsToAll = () => {
    if (!assessmentId || typeof assessmentId !== "string" || !assessment) return;

    const candidates = assessment.candidates || [];
    if (candidates.length === 0) {
      alert("No candidates to send invitations to.");
      return;
    }

    // Open the email customization modal instead of sending directly
    setShowSendEmailModal(true);
  };

  const handleSendEmailsWithTemplate = async (template: {
    subject: string;
    message: string;
    footer: string;
    sentBy: string;
  }) => {
    if (!assessmentId || typeof assessmentId !== "string" || !assessment) return;

    const candidates = assessment.candidates || [];
    if (candidates.length === 0) {
      alert("No candidates to send invitations to.");
      return;
    }

    setSendingInvitations(true);
    try {
      // Build assessment URL
      const assessmentToken = (assessment as any).assessmentToken || "";
      const assessmentUrl = `${window.location.origin}/custom-mcq/entry/${assessmentId}?token=${assessmentToken}`;

      // Prepare template with subject
      const emailTemplateData = {
        subject: template.subject,
        message: template.message,
        footer: template.footer,
        sentBy: template.sentBy,
      };

      const response = await sendInvitationsMutation.mutateAsync({
        assessmentId,
        candidates: candidates.map((c: any) => ({ name: c.name, email: c.email })),
        assessmentUrl,
        template: emailTemplateData,
      });

      // React Query will automatically refetch and update the UI
      const result = response.data;
      if (!result) {
        alert("Failed to send invitation emails: No response data");
        return;
      }
      if (result?.failedCount === 0) {
        alert(`Successfully sent invitation emails to all ${result.sentCount} candidates!`);
      } else {
        const skippedCount = (result as any)?.skippedCount || 0;
        alert(
          `Invitation emails sent:\n` +
            `✓ Success: ${result.sentCount}\n` +
            `✗ Failed: ${result.failedCount}\n` +
            `${skippedCount > 0 ? `⊘ Skipped: ${skippedCount}\n` : ""}\n` +
            `Check the console for details.`
        );
        console.error("Failed emails:", result.failedEmails);
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.message || err.message || "Failed to send invitation emails");
    } finally {
      setSendingInvitations(false);
    }
  };

  // Helper function to aggregate subjective feedback summary
  const getSubjectiveFeedbackSummary = (submissionEntries: any[]) => {
    const subjectiveSubmissions = submissionEntries.filter((s: any) => s.questionType === "subjective" && s.feedback && s.feedback !== "Evaluation in progress...");
    
    if (subjectiveSubmissions.length === 0) return "";
    
    const allStrengths: string[] = [];
    const allWeaknesses: string[] = [];
    const allSuggestions: string[] = [];
    let totalScore = 0;
    let totalMaxMarks = 0;
    
    subjectiveSubmissions.forEach((sub: any) => {
      totalScore += sub.marksAwarded || 0;
      totalMaxMarks += sub.maxMarks || 0;
      
      const feedback = sub.feedback;
      if (typeof feedback === "string") {
        if (feedback.toLowerCase().includes("good") || feedback.toLowerCase().includes("well") || feedback.toLowerCase().includes("correct")) {
          allStrengths.push("Demonstrated understanding in subjective responses");
        }
        if (feedback.toLowerCase().includes("improve") || feedback.toLowerCase().includes("lack") || feedback.toLowerCase().includes("missing")) {
          allWeaknesses.push("Areas for improvement identified");
        }
      } else if (feedback && typeof feedback === "object") {
        if (feedback.strengths && Array.isArray(feedback.strengths)) {
          allStrengths.push(...feedback.strengths);
        }
        if (feedback.weaknesses && Array.isArray(feedback.weaknesses)) {
          allWeaknesses.push(...feedback.weaknesses);
        }
        if (feedback.suggestions && Array.isArray(feedback.suggestions)) {
          allSuggestions.push(...feedback.suggestions);
        }
      }
      
      if (sub.detailedFeedback && typeof sub.detailedFeedback === "object") {
        if (sub.detailedFeedback.strengths && Array.isArray(sub.detailedFeedback.strengths)) {
          allStrengths.push(...sub.detailedFeedback.strengths);
        }
        if (sub.detailedFeedback.weaknesses && Array.isArray(sub.detailedFeedback.weaknesses)) {
          allWeaknesses.push(...sub.detailedFeedback.weaknesses);
        }
        if (sub.detailedFeedback.suggestions && Array.isArray(sub.detailedFeedback.suggestions)) {
          allSuggestions.push(...sub.detailedFeedback.suggestions);
        }
      }
    });
    
    const percentage = totalMaxMarks > 0 ? ((totalScore / totalMaxMarks) * 100).toFixed(1) : "0";
    const uniqueStrengths = Array.from(new Set(allStrengths)).slice(0, 5);
    const uniqueWeaknesses = Array.from(new Set(allWeaknesses)).slice(0, 5);
    const uniqueSuggestions = Array.from(new Set(allSuggestions)).slice(0, 5);
    
    return `Overall performance across ${subjectiveSubmissions.length} subjective question${subjectiveSubmissions.length > 1 ? 's' : ''}: ${totalScore}/${totalMaxMarks} (${percentage}%)`;
  };

  // Helper function to aggregate coding feedback
  const getCodingFeedbackSummary = (submissionEntries: any[]) => {
    const codingSubmissions = submissionEntries.filter((s: any) => s.questionType === "coding" && s.feedback && s.feedback !== "Evaluation in progress...");
    
    if (codingSubmissions.length === 0) return "";
    
    const allFeedbackTexts: string[] = [];
    const allStrengths: string[] = [];
    const allWeaknesses: string[] = [];
    const allIssues: string[] = [];
    const allSuggestions: string[] = [];
    let totalScore = 0;
    let totalMaxMarks = 0;
    
    codingSubmissions.forEach((sub: any) => {
      totalScore += sub.marksAwarded || 0;
      totalMaxMarks += sub.maxMarks || 0;
      
      const feedback = sub.feedback;
      const reasoning = sub.reasoning;
      
      if (typeof feedback === "string" && feedback.trim()) {
        allFeedbackTexts.push(feedback);
      } else if (feedback && typeof feedback === "object") {
        if (feedback.feedback && typeof feedback.feedback === "string") {
          allFeedbackTexts.push(feedback.feedback);
        }
        if (feedback.overall_feedback && typeof feedback.overall_feedback === "string") {
          allFeedbackTexts.push(feedback.overall_feedback);
        }
        if (feedback.strengths && Array.isArray(feedback.strengths)) {
          allStrengths.push(...feedback.strengths);
        }
        if (feedback.weaknesses && Array.isArray(feedback.weaknesses)) {
          allWeaknesses.push(...feedback.weaknesses);
        }
        if (feedback.issues && Array.isArray(feedback.issues)) {
          allIssues.push(...feedback.issues);
        }
        if (feedback.suggestions && Array.isArray(feedback.suggestions)) {
          allSuggestions.push(...feedback.suggestions);
        }
      }
      
      if (reasoning && typeof reasoning === "string" && reasoning.trim()) {
        allFeedbackTexts.push(reasoning);
      }
      
      if (sub.detailedFeedback && typeof sub.detailedFeedback === "object") {
        if (sub.detailedFeedback.feedback && typeof sub.detailedFeedback.feedback === "string") {
          allFeedbackTexts.push(sub.detailedFeedback.feedback);
        }
        if (sub.detailedFeedback.strengths && Array.isArray(sub.detailedFeedback.strengths)) {
          allStrengths.push(...sub.detailedFeedback.strengths);
        }
        if (sub.detailedFeedback.weaknesses && Array.isArray(sub.detailedFeedback.weaknesses)) {
          allWeaknesses.push(...sub.detailedFeedback.weaknesses);
        }
        if (sub.detailedFeedback.issues && Array.isArray(sub.detailedFeedback.issues)) {
          allIssues.push(...sub.detailedFeedback.issues);
        }
        if (sub.detailedFeedback.suggestions && Array.isArray(sub.detailedFeedback.suggestions)) {
          allSuggestions.push(...sub.detailedFeedback.suggestions);
        }
      }
    });
    
    const percentage = totalMaxMarks > 0 ? ((totalScore / totalMaxMarks) * 100).toFixed(1) : "0";
    const percentageNum = parseFloat(percentage);
    
    const uniqueIssues = Array.from(new Set(allIssues));
    const uniqueStrengths = Array.from(new Set(allStrengths));
    const uniqueWeaknesses = Array.from(new Set(allWeaknesses));
    const uniqueSuggestions = Array.from(new Set(allSuggestions));
    
    const parts: string[] = [];
    
    let codeAssessment = "";
    if (allFeedbackTexts.length > 0) {
      const mainFeedback = allFeedbackTexts.find(t => t.length > 50) || allFeedbackTexts[0];
      codeAssessment = mainFeedback;
    } else {
      if (percentageNum >= 80) {
        codeAssessment = "The code demonstrates excellent understanding and implementation with strong problem-solving skills.";
      } else if (percentageNum >= 70) {
        codeAssessment = "The code shows good understanding and implementation with solid coding practices.";
      } else if (percentageNum >= 50) {
        codeAssessment = "The code demonstrates moderate understanding but requires improvements in implementation and best practices.";
      } else {
        codeAssessment = "The code requires significant improvements in understanding, implementation, and coding practices.";
      }
    }
    parts.push(codeAssessment);
    
    if (uniqueIssues.length > 0) {
      const issuesText = uniqueIssues.length === 1 
        ? `The main issue identified is: ${uniqueIssues[0]}.`
        : `Several issues were identified, including: ${uniqueIssues.slice(0, 3).join(", ")}${uniqueIssues.length > 3 ? `, and ${uniqueIssues.length - 3} more` : ""}.`;
      parts.push(issuesText);
    }
    
    if (uniqueStrengths.length > 0) {
      const strengthsText = uniqueStrengths.length === 1
        ? `A notable strength is ${uniqueStrengths[0].toLowerCase()}.`
        : `Key strengths include: ${uniqueStrengths.slice(0, 3).join(", ")}${uniqueStrengths.length > 3 ? `, and ${uniqueStrengths.length - 3} more` : ""}.`;
      parts.push(strengthsText);
    }
    
    if (uniqueWeaknesses.length > 0) {
      const weaknessesText = uniqueWeaknesses.length === 1
        ? `A key weakness is ${uniqueWeaknesses[0].toLowerCase()}.`
        : `Areas of weakness include: ${uniqueWeaknesses.slice(0, 3).join(", ")}${uniqueWeaknesses.length > 3 ? `, and ${uniqueWeaknesses.length - 3} more` : ""}.`;
      parts.push(weaknessesText);
    }
    
    if (uniqueSuggestions.length > 0) {
      const suggestionsText = uniqueSuggestions.length === 1
        ? `To improve, focus on: ${uniqueSuggestions[0].toLowerCase()}.`
        : `Areas for improvement include: ${uniqueSuggestions.slice(0, 3).join(", ")}${uniqueSuggestions.length > 3 ? `, and ${uniqueSuggestions.length - 3} more` : ""}.`;
      parts.push(suggestionsText);
    }
    
    const performanceSummary = `Overall performance: ${totalScore}/${totalMaxMarks} (${percentage}%) across ${codingSubmissions.length} coding question${codingSubmissions.length > 1 ? 's' : ''}.`;
    parts.push(performanceSummary);
    
    return parts.join(" ");
  };

  // CSV Export function
  const handleExportResults = () => {
    if (!assessment) return;
    
    const allCandidates = assessment.candidates || [];
    const submissionsList = (assessment as any).submissionsList || [];
    
    // Create a map of submissions by email for quick lookup
    const submissionsByEmail = new Map<string, AssessmentSubmission>();
    submissionsList.forEach((sub: AssessmentSubmission) => {
      const email = String((sub.candidateInfo || {}).email || "").trim().toLowerCase();
      if (email) {
        submissionsByEmail.set(email, sub);
      }
    });
    
    // Prepare CSV data
    const csvRows: string[] = [];
    
    // CSV Headers
    csvRows.push("Student Name,Email,Score,Percentage,Subjective Overall Feedback,Coding Overall Feedback,Pass/Fail Status");
    
    // Process all candidates
    allCandidates.forEach((candidate: any) => {
      const candidateEmail = String(candidate.email || "").trim().toLowerCase();
      const submission = submissionsByEmail.get(candidateEmail);
      
      const name = candidate.name || "";
      const email = candidate.email || "";
      
      let score = "0";
      let percentage = "0";
      let subjectiveFeedback = "";
      let codingFeedback = "";
      let passFailStatus = "Not Submitted";
      
      if (submission) {
        // Get score and percentage
        score = String(submission.score || 0);
        percentage = submission.percentage ? submission.percentage.toFixed(2) : "0";
        
        // Get pass/fail status
        passFailStatus = submission.passed ? "PASSED" : "FAILED";
        
        // Get feedback summaries
        const submissionEntries = (submission as any).submissions || [];
        subjectiveFeedback = getSubjectiveFeedbackSummary(submissionEntries);
        codingFeedback = getCodingFeedbackSummary(submissionEntries);
      }
      
      // Escape CSV values (handle commas, quotes, newlines)
      const escapeCsvValue = (value: string) => {
        if (!value) return "";
        // If value contains comma, quote, or newline, wrap in quotes and escape quotes
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      };
      
      // Build CSV row
      csvRows.push([
        escapeCsvValue(name),
        escapeCsvValue(email),
        escapeCsvValue(score),
        escapeCsvValue(percentage),
        escapeCsvValue(subjectiveFeedback),
        escapeCsvValue(codingFeedback),
        escapeCsvValue(passFailStatus)
      ].join(","));
    });
    
    // Create CSV content
    const csvContent = csvRows.join("\n");
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `assessment_results_${assessmentId}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleResendInvitation = async (email: string, name: string) => {
    if (!assessmentId || typeof assessmentId !== "string" || !assessment) return;

    if (!confirm(`Resend invitation email to ${name} (${email})?`)) {
      return;
    }

    try {
      // Build assessment URL
      const assessmentToken = (assessment as any).assessmentToken || "";
      const assessmentUrl = `${window.location.origin}/custom-mcq/entry/${assessmentId}?token=${assessmentToken}`;

      // Prepare template
      const template = {
        message: emailTemplate.message,
        footer: emailTemplate.footer,
        sentBy: emailTemplate.sentBy,
      };

      await sendInvitationsMutation.mutateAsync({
        assessmentId,
        candidates: [{ name, email }],
        assessmentUrl,
        template,
      });

      // React Query will automatically refetch and update the UI
      alert("Invitation sent successfully!");
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.message || err.message || "Failed to resend invitation");
    }
  };

  const fetchProctorForUser = async (userEmail: string) => {
    if (!assessmentId || typeof assessmentId !== "string") return;
    if (!userEmail) return;

    setLoadingProctorForUser((prev) => ({ ...prev, [userEmail]: true }));
    try {
      // CRITICAL FIX: Use the same userId format as when recording violations
      // Violations are stored with "email:userEmail" format (from resolveUserIdForProctoring)
      // So we must query with the same format to find the logs
      const userIdForQuery = `email:${userEmail.trim()}`;
      console.log('[Custom MCQ Analytics] Fetching proctor logs with userId:', userIdForQuery, 'for email:', userEmail);

      // Logs (includes eventTypeLabels)
      const logsResp = await fetch(
        `/api/proctor/logs?assessmentId=${encodeURIComponent(assessmentId)}&userId=${encodeURIComponent(userIdForQuery)}`
      );
      const logsJson = await logsResp.json();
      if (logsJson?.success && logsJson?.data) {
        setProctorLogsByUser((prev) => ({ ...prev, [userEmail]: logsJson.data.logs || [] }));
        setProctorLabelsByUser((prev) => ({ ...prev, [userEmail]: logsJson.data.eventTypeLabels || {} }));
        console.log('[Custom MCQ Analytics] Fetched', logsJson.data.logs?.length || 0, 'proctor logs for', userEmail);
      } else {
        console.warn('[Custom MCQ Analytics] No logs found or API error:', logsJson);
        setProctorLogsByUser((prev) => ({ ...prev, [userEmail]: [] }));
        setProctorLabelsByUser((prev) => ({ ...prev, [userEmail]: {} }));
      }

      // Summary (for counts)
      const summaryResp = await fetch(
        `/api/proctor/summary?assessmentId=${encodeURIComponent(assessmentId)}&userId=${encodeURIComponent(userIdForQuery)}`
      );
      const summaryJson = await summaryResp.json();
      if (summaryJson?.success && summaryJson?.data) {
        setProctorSummaryByUser((prev) => ({
          ...prev,
          [userEmail]: {
            summary: summaryJson.data.summary || {},
            totalViolations: summaryJson.data.totalViolations || 0,
          },
        }));
      } else {
        setProctorSummaryByUser((prev) => ({
          ...prev,
          [userEmail]: {
            summary: {},
            totalViolations: 0,
          },
        }));
      }
    } catch (e) {
      console.error("Failed to fetch proctor logs for user:", userEmail, e);
      // Set empty state on error
      setProctorLogsByUser((prev) => ({ ...prev, [userEmail]: [] }));
      setProctorLabelsByUser((prev) => ({ ...prev, [userEmail]: {} }));
      setProctorSummaryByUser((prev) => ({
        ...prev,
        [userEmail]: {
          summary: {},
          totalViolations: 0,
        },
      }));
    } finally {
      setLoadingProctorForUser((prev) => ({ ...prev, [userEmail]: false }));
    }
  };

  const fetchReferencePhoto = async (candidateEmail: string) => {
    if (!assessmentId || typeof assessmentId !== "string" || !candidateEmail) {
      setReferencePhotos((prev) => ({ ...prev, [candidateEmail]: null }));
      return;
    }

    try {
      const response = await axios.get(`/api/v1/candidate/get-reference-photo`, {
        params: {
          assessmentId,
          candidateEmail,
        },
      });

      if (response.data?.success && response.data?.data?.referenceImage) {
        setReferencePhotos((prev) => ({ ...prev, [candidateEmail]: response.data.data.referenceImage }));
      } else {
        setReferencePhotos((prev) => ({ ...prev, [candidateEmail]: null }));
      }
    } catch (error) {
      console.warn('[Custom MCQ] Failed to fetch reference photo:', error);
      setReferencePhotos((prev) => ({ ...prev, [candidateEmail]: null }));
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this assessment? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteAssessmentMutation.mutateAsync(assessmentId as string);
      // React Query will automatically update the cache
      router.push("/dashboard?refresh=true");
    } catch (err: any) {
      alert(err.message || "Failed to delete assessment");
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div>Loading...</div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ textAlign: "center" }}>
          <h1>Error</h1>
          <p>{error || "Assessment not found"}</p>
        </div>
      </div>
    );
  }

  const submissions = (assessment as any).submissionsList || [];
  const assessmentUrl = `${window.location.origin}/custom-mcq/entry/${assessmentId}?token=${(assessment as any).assessmentToken}`;
  
  // Calculate attempted and not attempted questions for each submission
  const totalQuestions = assessment.totalQuestions || assessment.questions?.length || 0;
  
  // Calculate overall attempted/not attempted stats
  const calculateAttemptedStats = () => {
    if (submissions.length === 0) {
      return { 
        totalAttempted: 0, 
        totalNotAttempted: 0,
        avgAttempted: 0, 
        avgNotAttempted: 0 
      };
    }
    
    let totalAttempted = 0;
    let totalNotAttempted = 0;
    
    submissions.forEach((submission: any) => {
      const submissionEntries = submission.submissions || [];
      const attemptedCount = submissionEntries.length;
      const notAttemptedCount = Math.max(0, totalQuestions - attemptedCount);
      totalAttempted += attemptedCount;
      totalNotAttempted += notAttemptedCount;
    });
    
    const avgAttempted = Math.round((totalAttempted / submissions.length) * 10) / 10;
    const avgNotAttempted = Math.round((totalNotAttempted / submissions.length) * 10) / 10;
    
    return { 
      totalAttempted, 
      totalNotAttempted,
      avgAttempted, 
      avgNotAttempted 
    };
  };
  
  const overallStats = calculateAttemptedStats();

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#ffffff", padding: "2rem" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ marginBottom: "0.5rem", color: "#1E5A3B" }}>{assessment.title}</h1>
            {assessment.description && (
              <p style={{ color: "#2D7A52", margin: 0 }}>{assessment.description}</p>
            )}
          </div>
          <button type="button" onClick={() => router.push("/dashboard")} className="btn-secondary">
            ← Back to Dashboard
          </button>
        </div>

        {/* Live Proctoring Section */}
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "0.75rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Eye style={{ width: "20px", height: "20px", color: "#3b82f6" }} />
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>Live Proctoring</h2>
            </div>
            <Link
              href={`/custom-mcq/${assessmentId}/live-dashboard`}
              className="btn-primary"
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                backgroundColor: "#3b82f6",
                color: "#ffffff",
                textDecoration: "none",
                borderRadius: "0.5rem",
                fontWeight: 600,
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#2563eb";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#3b82f6";
              }}
            >
              <Video className="h-4 w-4" />
              Live Proctoring Dashboard
            </Link>
          </div>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b", margin: 0 }}>
            Monitor candidates in real-time via webcam and screen sharing
          </p>
        </div>

        {/* Assessment Info */}
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "#E8FAF0",
            border: "1px solid #A8E8BC",
            borderRadius: "0.75rem",
            marginBottom: "2rem",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ margin: 0, color: "#1E5A3B" }}>Assessment Details</h2>
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
              {assessment.candidates && assessment.candidates.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleExportResults}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: "#ffffff",
                      color: "#2D7A52",
                      border: "1px solid #2D7A52",
                      borderRadius: "0.5rem",
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    📥 Export Results (CSV)
                  </button>
                  <button
                    type="button"
                    onClick={handleSendInvitationsToAll}
                    disabled={sendingInvitations}
                    style={{
                      padding: "0.5rem 1rem",
                      backgroundColor: sendingInvitations ? "#94a3b8" : "#ffffff",
                      color: sendingInvitations ? "#ffffff" : "#2D7A52",
                      border: "1px solid #2D7A52",
                      borderRadius: "0.5rem",
                      cursor: sendingInvitations ? "not-allowed" : "pointer",
                      fontWeight: 600,
                      fontSize: "0.875rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                      opacity: sendingInvitations ? 0.6 : 1,
                    }}
                  >
                    {sendingInvitations ? "Sending..." : "📧 Send Email to All"}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => setShowAddCandidateModal(true)}
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#2D7A52",
                  color: "#ffffff",
                  border: "1px solid #2D7A52",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                ➕ Add Candidate
              </button>
              {assessment.candidates && assessment.candidates.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCandidates(!showCandidates)}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: showCandidates ? "#2D7A52" : "#ffffff",
                    color: showCandidates ? "#ffffff" : "#2D7A52",
                    border: "1px solid #2D7A52",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                  }}
                >
                  {showCandidates ? "Hide" : "View"} Added Candidates ({assessment.candidates.length})
                </button>
              )}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
            <div>
              <strong style={{ color: "#2D7A52" }}>Total Questions:</strong> {assessment.totalQuestions || 0}
            </div>
            <div>
              <strong style={{ color: "#2D7A52" }}>Total Marks:</strong> {assessment.totalMarks || 0}
            </div>
            <div>
              <strong style={{ color: "#2D7A52" }}>Access Mode:</strong> {assessment.accessMode}
            </div>
            <div>
              <strong style={{ color: "#2D7A52" }}>Exam Mode:</strong> {assessment.examMode}
            </div>
            <div>
              <strong style={{ color: "#2D7A52" }}>Pass Percentage:</strong> {assessment.passPercentage}%
            </div>
            <div>
              <strong style={{ color: "#2D7A52" }}>Submissions:</strong> {submissions.length}
            </div>
            {submissions.length > 0 && (
              <div>
                <strong style={{ color: "#2D7A52" }}>Total Attempted Questions:</strong>{" "}
                <span style={{ color: "#059669", fontWeight: 600, fontSize: "1.1rem" }}>
                  {overallStats.totalAttempted}
                </span>
              </div>
            )}
          </div>

          {/* Added Candidates Section */}
          {showCandidates && assessment.candidates && assessment.candidates.length > 0 && (
            <div
              style={{
                marginTop: "1.5rem",
                padding: "1.5rem",
                backgroundColor: "#ffffff",
                border: "1px solid #A8E8BC",
                borderRadius: "0.5rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <h3 style={{ margin: 0, color: "#1E5A3B", fontSize: "1.125rem" }}>
                  Added Candidates for this Assessment
                </h3>
                <button
                  type="button"
                  onClick={() => setShowEmailTemplateModal(true)}
                  style={{
                    padding: "0.5rem 1rem",
                    backgroundColor: "#ffffff",
                    color: "#2D7A52",
                    border: "1px solid #2D7A52",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.875rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  ✏️ Edit Email Template
                </button>
              </div>
              <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1rem" }}>
                {emailTemplate.message !== "You have been invited to take a Custom MCQ assessment. Please click the link below to start." ? (
                  <span style={{ color: "#10b981" }}>✓ Custom email template is configured</span>
                ) : (
                  <span>Using default email template</span>
                )}
              </div>
              <div style={{ width: "100%", overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                    border: "1px solid #A8E8BC",
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: "#E8FAF0" }}>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.85rem", color: "#1E5A3B" }}>
                        Name
                      </th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.85rem", color: "#1E5A3B" }}>
                        Email
                      </th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.85rem", color: "#1E5A3B" }}>
                        Invited
                      </th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.85rem", color: "#1E5A3B" }}>
                        Invite Sent At
                      </th>
                      <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.85rem", color: "#1E5A3B" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {assessment.candidates.map((candidate: any, idx: number) => (
                      <tr
                        key={idx}
                        style={{
                          borderTop: "1px solid #A8E8BC",
                          backgroundColor: idx % 2 === 0 ? "#ffffff" : "#F9FFFB",
                        }}
                      >
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem", color: "#1E5A3B" }}>
                          {candidate.name || "N/A"}
                        </td>
                        <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "#2D7A52" }}>
                          {candidate.email || "N/A"}
                        </td>
                        <td style={{ padding: "0.75rem", fontSize: "0.85rem" }}>
                          {candidate.invited ? (
                            <span
                              style={{
                                padding: "0.2rem 0.45rem",
                                borderRadius: "0.25rem",
                                backgroundColor: "#dcfce7",
                                color: "#166534",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                              }}
                            >
                              ✓ Yes
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: "0.2rem 0.45rem",
                                borderRadius: "0.25rem",
                                backgroundColor: "#fee2e2",
                                color: "#991b1b",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                              }}
                            >
                              No
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem", fontSize: "0.85rem", color: "#1E5A3B" }}>
                          {candidate.inviteSentAt
                            ? new Date(candidate.inviteSentAt).toLocaleString()
                            : "Not sent"}
                        </td>
                        <td style={{ padding: "0.75rem" }}>
                          <button
                            type="button"
                            onClick={() => handleResendInvitation(candidate.email, candidate.name)}
                            style={{
                              padding: "0.25rem 0.75rem",
                              fontSize: "0.75rem",
                              backgroundColor: "#10b981",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: "pointer",
                            }}
                          >
                            Resend Invitation
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Assessment URL */}
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "#ffffff",
            border: "2px solid #2D7A52",
            borderRadius: "0.75rem",
            marginBottom: "2rem",
          }}
        >
          <h3 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>Assessment URL</h3>
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="text"
              value={assessmentUrl}
              readOnly
              style={{
                flex: 1,
                minWidth: "300px",
                padding: "0.75rem",
                border: "1px solid #A8E8BC",
                borderRadius: "0.5rem",
                backgroundColor: "#f9fafb",
              }}
            />
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(assessmentUrl);
                alert("URL copied to clipboard!");
              }}
              className="btn-primary"
            >
              Copy URL
            </button>
          </div>
        </div>

        {/* Submissions */}
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "#ffffff",
            border: "1px solid #A8E8BC",
            borderRadius: "0.75rem",
          }}
        >
          <h2 style={{ marginBottom: "1rem", color: "#1E5A3B" }}>Student Submissions</h2>
          {submissions.length === 0 ? (
            <div style={{ padding: "3rem", textAlign: "center", color: "#4A9A6A" }}>
              No submissions yet.
            </div>
          ) : (
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "separate",
                  borderSpacing: 0,
                  borderRadius: "0.5rem",
                  overflow: "hidden",
                  border: "1px solid #A8E8BC",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#E8FAF0" }}>
                    <th style={{ padding: "0.75rem 0.75rem", textAlign: "left", fontSize: "0.85rem", color: "#1E5A3B" }}>
                      Name
                    </th>
                    <th style={{ padding: "0.75rem 0.75rem", textAlign: "left", fontSize: "0.85rem", color: "#1E5A3B" }}>
                      Email
                    </th>
                    <th style={{ padding: "0.75rem 0.75rem", textAlign: "left", fontSize: "0.85rem", color: "#1E5A3B" }}>
                      Status
                    </th>
                    <th style={{ padding: "0.75rem 0.75rem", textAlign: "left", fontSize: "0.85rem", color: "#1E5A3B" }}>
                      Score / Percentage
                    </th>
                    <th style={{ padding: "0.75rem 0.75rem", textAlign: "left", fontSize: "0.85rem", color: "#1E5A3B" }}>
                      Questions Attempted
                    </th>
                    <th style={{ padding: "0.75rem 0.75rem", textAlign: "center", fontSize: "0.85rem", color: "#1E5A3B" }}>
                      View Proctoring Logs
                    </th>
                    <th style={{ padding: "0.75rem 0.75rem", textAlign: "center", fontSize: "0.85rem", color: "#1E5A3B" }}>
                      View Answer Logs
                    </th>
                    <th style={{ padding: "0.75rem 0.75rem", textAlign: "center", fontSize: "0.85rem", color: "#1E5A3B" }}>
                      Candidate Requirements
                    </th>
                    <th style={{ padding: "0.75rem 0.75rem", textAlign: "center", fontSize: "0.85rem", color: "#1E5A3B" }}>
                      Coding Logs
                    </th>
                    <th style={{ padding: "0.75rem 0.75rem", textAlign: "center", fontSize: "0.85rem", color: "#1E5A3B" }}>
                      Overall Feedback
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission: AssessmentSubmission & { candidateKey: string }, idx: number) => {
                    const candidateInfo = submission.candidateInfo || {};
                    const userEmail = String(candidateInfo.email || "").trim();
                    const isProctorExpanded = expandedProctorUser === userEmail && !!userEmail;
                    const isAnswerExpanded = expandedAnswerLogsUser === userEmail && !!userEmail;
                    const isRequirementsExpanded = expandedRequirementsUser === userEmail && !!userEmail;
                    const proctorLogs = (userEmail && proctorLogsByUser[userEmail]) ? proctorLogsByUser[userEmail] : [];
                    const proctorLabels = (userEmail && proctorLabelsByUser[userEmail]) ? proctorLabelsByUser[userEmail] : {};
                    const proctorSummary = (userEmail && proctorSummaryByUser[userEmail]) ? proctorSummaryByUser[userEmail] : null;
                    const isLoadingProctor = !!(userEmail && loadingProctorForUser[userEmail]);
                    const hasAnswerLogs = (submission as any).answerLogs && Object.keys((submission as any).answerLogs).length > 0;
                    const candidateRequirements = (submission as any).candidateRequirements || {};
                    const hasRequirements = candidateRequirements && Object.keys(candidateRequirements).length > 0;
                    // Check if there are coding submissions
                    const submissionEntries = (submission as any).submissions || [];
                    const hasCodingSubmissions = submissionEntries.some((s: any) => s.questionType === "coding" && s.codeAnswer);
                    const isCodingLogsExpanded = expandedCodingLogsUser === userEmail && !!userEmail;
                    
                    // Debug: Log candidate requirements to console
                    if (idx === 0) {
                      console.log("Submission data:", submission);
                      console.log("Candidate requirements:", candidateRequirements);
                      console.log("Has requirements:", hasRequirements);
                      console.log("Candidate info:", candidateInfo);
                    }
                    
                    // Calculate attempted and not attempted questions for this submission
                    const attemptedCount = submissionEntries.length;
                    const notAttemptedCount = Math.max(0, totalQuestions - attemptedCount);

                    return (
                      <>
                        <tr
                          key={idx}
                          style={{
                            borderTop: "1px solid #A8E8BC",
                            backgroundColor: idx % 2 === 0 ? "#ffffff" : "#F9FFFB",
                          }}
                        >
                          <td style={{ padding: "0.75rem 0.75rem", fontSize: "0.9rem", color: "#1E5A3B" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                              {referencePhotos[userEmail] && (
                                <img
                                  src={referencePhotos[userEmail]!}
                                  alt="Reference Photo"
                                  style={{
                                    width: "40px",
                                    height: "40px",
                                    borderRadius: "0.5rem",
                                    objectFit: "cover",
                                    border: "2px solid #A8E8BC"
                                  }}
                                  onError={() => setReferencePhotos((prev) => ({ ...prev, [userEmail]: null }))}
                                />
                              )}
                              <span>{candidateInfo.name || "Unknown"}</span>
                            </div>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", fontSize: "0.85rem", color: "#2D7A52" }}>
                            {candidateInfo.email || "N/A"}
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", fontSize: "0.85rem" }}>
                            <span
                              style={{
                                padding: "0.2rem 0.45rem",
                                borderRadius: "0.25rem",
                                backgroundColor: submission.passed ? "#dcfce7" : "#fee2e2",
                                color: submission.passed ? "#166534" : "#991b1b",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                              }}
                            >
                              {submission.passed ? "PASSED" : "FAILED"}
                            </span>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", fontSize: "0.85rem", color: "#1E5A3B" }}>
                            <div>
                              <strong style={{ color: "#2D7A52" }}>Score:</strong> {submission.score || 0} /{" "}
                              {submission.totalMarks || 0}
                            </div>
                            <div>
                              <strong style={{ color: "#2D7A52" }}>Percentage:</strong>{" "}
                              {submission.percentage?.toFixed(2) || 0}%
                            </div>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", fontSize: "0.85rem", color: "#1E5A3B" }}>
                            <div>
                              <strong style={{ color: "#059669" }}>Attempted:</strong>{" "}
                              <span style={{ fontWeight: 600 }}>{attemptedCount}</span>
                            </div>
                            <div>
                              <strong style={{ color: "#dc2626" }}>Not Attempted:</strong>{" "}
                              <span style={{ fontWeight: 600 }}>{notAttemptedCount}</span>
                            </div>
                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                              ({attemptedCount} / {totalQuestions})
                            </div>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", textAlign: "center" }}>
                            <button
                              type="button"
                              disabled={!userEmail}
                              onClick={async () => {
                                if (!userEmail) return;
                                const nextExpanded = isProctorExpanded ? null : userEmail;
                                setExpandedProctorUser(nextExpanded);
                                if (!isProctorExpanded) {
                                  await fetchProctorForUser(userEmail);
                                }
                              }}
                              style={{
                                padding: "0.45rem 0.75rem",
                                borderRadius: "0.5rem",
                                border: "1px solid #2D7A52",
                                backgroundColor: isProctorExpanded ? "#ffffff" : "#E8FAF0",
                                color: "#1E5A3B",
                                cursor: userEmail ? "pointer" : "not-allowed",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                              }}
                            >
                              {isProctorExpanded ? "Hide Logs" : "View Logs"}
                            </button>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", textAlign: "center" }}>
                            <button
                              type="button"
                              disabled={!hasAnswerLogs}
                              onClick={() => {
                                if (!hasAnswerLogs) return;
                                const nextExpanded = isAnswerExpanded ? null : userEmail;
                                setExpandedAnswerLogsUser(nextExpanded);
                              }}
                              style={{
                                padding: "0.45rem 0.75rem",
                                borderRadius: "0.5rem",
                                border: "1px solid #F59E0B",
                                backgroundColor: isAnswerExpanded ? "#FFF7ED" : "#FFFBEB",
                                color: hasAnswerLogs ? "#92400E" : "#D1D5DB",
                                cursor: hasAnswerLogs ? "pointer" : "not-allowed",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                              }}
                            >
                              {isAnswerExpanded ? "Hide Logs" : "View Logs"}
                            </button>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => {
                                const nextExpanded = isRequirementsExpanded ? null : userEmail;
                                setExpandedRequirementsUser(nextExpanded);
                              }}
                              style={{
                                padding: "0.45rem 0.75rem",
                                borderRadius: "0.5rem",
                                border: "1px solid #6953a3",
                                backgroundColor: isRequirementsExpanded ? "#f3f4f6" : "#f9fafb",
                                color: "#6953a3",
                                cursor: "pointer",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                              }}
                            >
                              {isRequirementsExpanded ? "Hide" : "View"}
                            </button>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", textAlign: "center" }}>
                            <button
                              type="button"
                              disabled={!hasCodingSubmissions}
                              onClick={() => {
                                if (!hasCodingSubmissions) return;
                                const nextExpanded = isCodingLogsExpanded ? null : userEmail;
                                setExpandedCodingLogsUser(nextExpanded);
                              }}
                              style={{
                                padding: "0.45rem 0.75rem",
                                borderRadius: "0.5rem",
                                border: "1px solid #1E5A3B",
                                backgroundColor: isCodingLogsExpanded ? "#ffffff" : "#E8FAF0",
                                color: hasCodingSubmissions ? "#1E5A3B" : "#D1D5DB",
                                cursor: hasCodingSubmissions ? "pointer" : "not-allowed",
                                fontWeight: 600,
                                fontSize: "0.8rem",
                              }}
                            >
                              {isCodingLogsExpanded ? "Hide Logs" : "View Logs"}
                            </button>
                          </td>
                          <td style={{ padding: "0.75rem 0.75rem", textAlign: "center" }}>
                            {(() => {
                              const submissionEntries = (submission as any).submissions || [];
                              const hasSubjectiveSubmissions = submissionEntries.some((s: any) => s.questionType === "subjective" && s.feedback);
                              const hasCodingSubmissionsForFeedback = submissionEntries.some((s: any) => s.questionType === "coding" && s.feedback && s.feedback !== "Evaluation in progress...");
                              const hasOverallFeedback = hasSubjectiveSubmissions || hasCodingSubmissionsForFeedback;
                              const isOverallFeedbackExpanded = expandedOverallFeedbackUser === userEmail && !!userEmail;
                              
                              return (
                                <button
                                  type="button"
                                  disabled={!hasOverallFeedback}
                                  onClick={() => {
                                    if (!hasOverallFeedback) return;
                                    const nextExpanded = isOverallFeedbackExpanded ? null : userEmail;
                                    setExpandedOverallFeedbackUser(nextExpanded);
                                  }}
                                  style={{
                                    padding: "0.45rem 0.75rem",
                                    borderRadius: "0.5rem",
                                    border: "1px solid #7C3AED",
                                    backgroundColor: isOverallFeedbackExpanded ? "#ffffff" : "#F3E8FF",
                                    color: hasOverallFeedback ? "#7C3AED" : "#D1D5DB",
                                    cursor: hasOverallFeedback ? "pointer" : "not-allowed",
                                    fontWeight: 600,
                                    fontSize: "0.8rem",
                                  }}
                                >
                                  {isOverallFeedbackExpanded ? "Hide Feedback" : "View Feedback"}
                                </button>
                              );
                            })()}
                          </td>
                        </tr>

                        {(isProctorExpanded || isAnswerExpanded || isRequirementsExpanded || isCodingLogsExpanded || expandedOverallFeedbackUser === userEmail) && (
                          <tr
                            style={{
                              backgroundColor: "#F9FFFB",
                              borderTop: "1px solid #E5E7EB",
                            }}
                          >
                            <td colSpan={10} style={{ padding: "0.75rem 1rem" }}>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "0.75rem",
                                }}
                              >
                                {/* Times + breakdown line */}
                                <div
                                  style={{
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: "1.5rem",
                                    fontSize: "0.8rem",
                                    color: "#4A9A6A",
                                  }}
                                >
                                  {submission.startedAt && (
                                    <div>
                                      <strong>Started:</strong>{" "}
                                      {new Date(submission.startedAt).toLocaleString()}
                                    </div>
                                  )}
                                  {submission.submittedAt && (
                                    <div>
                                      <strong>Submitted:</strong>{" "}
                                      {new Date(submission.submittedAt).toLocaleString()}
                                    </div>
                                  )}

                                  {(submission.mcqTotal && submission.mcqTotal > 0) ||
                                  (submission.subjectiveTotal && submission.subjectiveTotal > 0) ||
                                  (submission.codingTotal && submission.codingTotal > 0) ? (
                                    <div>
                                      {submission.mcqTotal && submission.mcqTotal > 0 && (
                                        <>
                                          <strong style={{ color: "#2D7A52" }}>MCQ:</strong>{" "}
                                          {submission.mcqScore || 0} / {submission.mcqTotal || 0}{" "}
                                          <span style={{ marginLeft: "0.5rem", color: "#4A9A6A" }}>
                                            (
                                            {submission.mcqTotal
                                              ? (((submission.mcqScore || 0) / submission.mcqTotal) * 100).toFixed(1)
                                              : 0}
                                            %)
                                          </span>
                                          {"  |  "}
                                        </>
                                      )}
                                      {submission.subjectiveTotal && submission.subjectiveTotal > 0 && (
                                        <>
                                          <strong style={{ color: "#2D7A52", marginLeft: "0.5rem" }}>
                                            Subjective:
                                          </strong>{" "}
                                          {submission.subjectiveScore || 0} / {submission.subjectiveTotal || 0}{" "}
                                          <span style={{ marginLeft: "0.5rem", color: "#4A9A6A" }}>
                                            (
                                            {submission.subjectiveTotal
                                              ? (
                                                  ((submission.subjectiveScore || 0) /
                                                    submission.subjectiveTotal) *
                                                  100
                                                ).toFixed(1)
                                              : 0}
                                            %)
                                          </span>
                                          {"  |  "}
                                        </>
                                      )}
                                      {submission.codingTotal && submission.codingTotal > 0 && (
                                        <>
                                          <strong style={{ color: "#2D7A52", marginLeft: "0.5rem" }}>
                                            Coding:
                                          </strong>{" "}
                                          {submission.codingScore || 0} / {submission.codingTotal || 0}{" "}
                                          <span style={{ marginLeft: "0.5rem", color: "#4A9A6A" }}>
                                            (
                                            {submission.codingTotal
                                              ? (
                                                  ((submission.codingScore || 0) /
                                                    submission.codingTotal) *
                                                  100
                                                ).toFixed(1)
                                              : 0}
                                            %)
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  ) : null}
                                </div>

                                {/* Answer Logs */}
                                {isAnswerExpanded && hasAnswerLogs && (
                                  <div
                                    style={{
                                      padding: "0.75rem",
                                      backgroundColor: "#FFF4E6",
                                      borderRadius: "0.5rem",
                                      border: "1px solid #FCD34D",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "0.85rem",
                                        color: "#B45309",
                                        marginBottom: "0.5rem",
                                        fontWeight: 600,
                                      }}
                                    >
                                      Answer Change Logs (Subjective Questions)
                                    </div>
                                    {Object.entries((submission as any).answerLogs).map(
                                      ([questionId, logs]: [string, any]) => {
                                        const question = assessment.questions?.find(
                                          (q) => q.id === questionId
                                        );
                                        const questionText =
                                          question?.question || `Question ${questionId}`;
                                        
                                        // Find the graded submission for this question to get AI evaluated marks
                                        const gradedSubmission = (submission as any).submissions?.find(
                                          (s: any) => s.questionId === questionId
                                        );
                                        const marksAwarded = gradedSubmission?.marksAwarded;
                                        const maxMarks = gradedSubmission?.maxMarks;
                                        
                                        return (
                                          <div
                                            key={questionId}
                                            style={{
                                              marginBottom: "0.75rem",
                                              paddingBottom: "0.75rem",
                                              borderBottom: "1px solid #FCD34D",
                                            }}
                                          >
                                            <div
                                              style={{
                                                fontWeight: 600,
                                                color: "#92400E",
                                                marginBottom: "0.4rem",
                                              }}
                                            >
                                              {questionText}
                                            </div>
                                            {/* AI Evaluated Marks */}
                                            {marksAwarded !== undefined && maxMarks !== undefined && (
                                              <div
                                                style={{
                                                  marginBottom: "0.5rem",
                                                  padding: "0.5rem",
                                                  backgroundColor: "#f0fdf4",
                                                  borderRadius: "0.25rem",
                                                  border: "1px solid #86efac",
                                                }}
                                              >
                                                <div
                                                  style={{
                                                    fontSize: "0.85rem",
                                                    color: "#166534",
                                                    fontWeight: 600,
                                                  }}
                                                >
                                                  AI Evaluated Marks:{" "}
                                                  <span style={{ color: "#059669" }}>
                                                    {marksAwarded} / {maxMarks}
                                                  </span>
                                                </div>
                                              </div>
                                            )}
                                            <div
                                              style={{
                                                display: "flex",
                                                flexDirection: "column",
                                                gap: "0.4rem",
                                              }}
                                            >
                                              {Array.isArray(logs) &&
                                                logs.map((log: any, logIdx: number) => (
                                                  <div
                                                    key={logIdx}
                                                    style={{
                                                      padding: "0.45rem",
                                                      backgroundColor: "#ffffff",
                                                      borderRadius: "0.25rem",
                                                      border: "1px solid #FCD34D",
                                                    }}
                                                  >
                                                    <div
                                                      style={{
                                                        fontSize: "0.83rem",
                                                        color: "#92400E",
                                                        marginBottom: "0.2rem",
                                                      }}
                                                    >
                                                      <strong>Answer {logIdx + 1}:</strong>{" "}
                                                      {log.answer || ""}
                                                    </div>
                                                    {log.timestamp && (
                                                      <div
                                                        style={{
                                                          fontSize: "0.75rem",
                                                          color: "#B45309",
                                                        }}
                                                      >
                                                        {new Date(
                                                          log.timestamp
                                                        ).toLocaleString()}
                                                      </div>
                                                    )}
                                                  </div>
                                                ))}
                                            </div>
                                          </div>
                                        );
                                      }
                                    )}
                                  </div>
                                )}

                                {/* Proctoring Logs */}
                                {isProctorExpanded && (
                                  <div
                                    style={{
                                      padding: "1rem",
                                      backgroundColor: "#ffffff",
                                      borderRadius: "0.5rem",
                                      border: "1px solid #e2e8f0",
                                    }}
                                  >
                                    {isLoadingProctor ? (
                                      <div
                                        style={{
                                          textAlign: "center",
                                          padding: "2rem",
                                          color: "#64748b",
                                        }}
                                      >
                                        Loading proctoring logs...
                                      </div>
                                    ) : proctorLogs.length === 0 ? (
                                      <div
                                        style={{
                                          textAlign: "center",
                                          padding: "2rem",
                                          color: "#64748b",
                                          backgroundColor: "#f8fafc",
                                          borderRadius: "0.5rem",
                                        }}
                                      >
                                        No proctoring violations detected
                                      </div>
                                    ) : (
                                      <ProctorLogsReview
                                        logs={proctorLogs}
                                        candidateName={candidateInfo?.name || candidateInfo?.email}
                                      />
                                    )}
                                  </div>
                                )}

                                {/* Candidate Requirements */}
                                {isRequirementsExpanded && (
                                  <div
                                    style={{
                                      padding: "0.75rem",
                                      backgroundColor: "#f3f4f6",
                                      borderRadius: "0.5rem",
                                      border: "1px solid #6953a3",
                                      marginTop: "0.75rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "0.85rem",
                                        color: "#6953a3",
                                        marginBottom: "0.75rem",
                                        fontWeight: 600,
                                      }}
                                    >
                                      Candidate Requirements
                                    </div>
                                    {hasRequirements || candidateInfo.name || candidateInfo.email ? (
                                      <div
                                        style={{
                                          display: "grid",
                                          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                                          gap: "0.75rem",
                                        }}
                                      >
                                        {candidateInfo.name && (
                                          <div
                                            style={{
                                              padding: "0.625rem",
                                              backgroundColor: "#ffffff",
                                              borderRadius: "0.375rem",
                                              border: "1px solid #e5e7eb",
                                            }}
                                          >
                                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                                              Name
                                            </div>
                                            <div style={{ fontSize: "0.875rem", color: "#1e293b", fontWeight: 500 }}>
                                              {candidateInfo.name}
                                            </div>
                                          </div>
                                        )}
                                        {candidateInfo.email && (
                                          <div
                                            style={{
                                              padding: "0.625rem",
                                              backgroundColor: "#ffffff",
                                              borderRadius: "0.375rem",
                                              border: "1px solid #e5e7eb",
                                            }}
                                          >
                                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                                              Email
                                            </div>
                                            <div style={{ fontSize: "0.875rem", color: "#1e293b", fontWeight: 500 }}>
                                              {candidateInfo.email}
                                            </div>
                                          </div>
                                        )}
                                        {(candidateRequirements.phone || (candidateInfo as any).phone) && (
                                          <div
                                            style={{
                                              padding: "0.625rem",
                                              backgroundColor: "#ffffff",
                                              borderRadius: "0.375rem",
                                              border: "1px solid #e5e7eb",
                                            }}
                                          >
                                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                                              Phone
                                            </div>
                                            <div style={{ fontSize: "0.875rem", color: "#1e293b", fontWeight: 500 }}>
                                              {candidateRequirements.phone || (candidateInfo as any).phone}
                                            </div>
                                          </div>
                                        )}
                                        {(candidateRequirements.linkedIn || (candidateInfo as any).linkedIn) && (
                                          <div
                                            style={{
                                              padding: "0.625rem",
                                              backgroundColor: "#ffffff",
                                              borderRadius: "0.375rem",
                                              border: "1px solid #e5e7eb",
                                            }}
                                          >
                                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                                              LinkedIn
                                            </div>
                                            <div style={{ fontSize: "0.875rem", color: "#1e293b" }}>
                                              <a
                                                href={candidateRequirements.linkedIn || (candidateInfo as any).linkedIn}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                  color: "#6953a3",
                                                  textDecoration: "none",
                                                  wordBreak: "break-all",
                                                }}
                                              >
                                                {candidateRequirements.linkedIn || (candidateInfo as any).linkedIn}
                                              </a>
                                            </div>
                                          </div>
                                        )}
                                        {(candidateRequirements.github || (candidateInfo as any).github) && (
                                          <div
                                            style={{
                                              padding: "0.625rem",
                                              backgroundColor: "#ffffff",
                                              borderRadius: "0.375rem",
                                              border: "1px solid #e5e7eb",
                                            }}
                                          >
                                            <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>
                                              GitHub
                                            </div>
                                            <div style={{ fontSize: "0.875rem", color: "#1e293b" }}>
                                              <a
                                                href={candidateRequirements.github || (candidateInfo as any).github}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                  color: "#6953a3",
                                                  textDecoration: "none",
                                                  wordBreak: "break-all",
                                                }}
                                              >
                                                {candidateRequirements.github || (candidateInfo as any).github}
                                              </a>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div
                                        style={{
                                          padding: "0.75rem",
                                          backgroundColor: "#ffffff",
                                          borderRadius: "0.375rem",
                                          border: "1px solid #e5e7eb",
                                          color: "#64748b",
                                          fontSize: "0.875rem",
                                          fontStyle: "italic",
                                        }}
                                      >
                                        No candidate requirements were provided for this submission.
                                      </div>
                                    )}
                                  </div>
                                )}
                                
                                {/* Coding Logs View */}
                                {isCodingLogsExpanded && (() => {
                                  const submissionEntries = (submission as any).submissions || [];
                                  const questions = assessment?.questions || [];
                                  const codingSubmissions = submissionEntries.filter((s: any) => s.questionType === "coding" && s.codeAnswer);
                                  
                                  if (codingSubmissions.length === 0) {
                                    return (
                                      <div
                                        style={{
                                          padding: "0.75rem",
                                          backgroundColor: "#ffffff",
                                          borderRadius: "0.375rem",
                                          border: "1px solid #e5e7eb",
                                          color: "#64748b",
                                          fontSize: "0.875rem",
                                          fontStyle: "italic",
                                        }}
                                      >
                                        No coding submissions found for this candidate.
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <div
                                      style={{
                                        padding: "1rem",
                                        backgroundColor: "#ffffff",
                                        borderRadius: "0.5rem",
                                        border: "1px solid #1E5A3B",
                                      }}
                                    >
                                      <h4 style={{ fontSize: "1rem", fontWeight: 600, color: "#1E5A3B", marginBottom: "1rem" }}>
                                        Coding Logs
                                      </h4>
                                      <div style={{ display: "grid", gap: "1rem" }}>
                                        {codingSubmissions.map((submissionEntry: any, idx: number) => {
                                          const question = questions.find((q: any) => (q.id || q._id) === submissionEntry.questionId);
                                          const questionText = question?.question || "No question text";
                                          
                                          return (
                                            <div
                                              key={submissionEntry.questionId || idx}
                                              style={{
                                                padding: "1rem",
                                                backgroundColor: "#f9fafb",
                                                border: "1px solid #e5e7eb",
                                                borderRadius: "0.5rem",
                                              }}
                                            >
                                              <div style={{ marginBottom: "0.75rem" }}>
                                                <strong style={{ color: "#1E5A3B" }}>Question {idx + 1}:</strong> {questionText}
                                              </div>
                                              <div style={{ marginBottom: "0.5rem", fontSize: "0.875rem", color: "#2D7A52" }}>
                                                <strong>Score:</strong> {submissionEntry.marksAwarded || 0} / {submissionEntry.maxMarks || 0}
                                              </div>
                                              {submissionEntry.codeAnswer && (
                                                <div style={{ marginBottom: "0.75rem" }}>
                                                  <strong style={{ color: "#1E5A3B", display: "block", marginBottom: "0.5rem" }}>Submitted Code:</strong>
                                                  <pre
                                                    style={{
                                                      padding: "0.75rem",
                                                      backgroundColor: "#1e293b",
                                                      color: "#e2e8f0",
                                                      borderRadius: "0.375rem",
                                                      overflow: "auto",
                                                      fontSize: "0.875rem",
                                                      fontFamily: "monospace",
                                                      whiteSpace: "pre-wrap",
                                                      wordBreak: "break-word",
                                                    }}
                                                  >
                                                    {submissionEntry.codeAnswer}
                                                  </pre>
                                                </div>
                                              )}
                                              {submissionEntry.feedback && (
                                                <div style={{ marginBottom: "0.5rem" }}>
                                                  <strong style={{ color: "#1E5A3B", display: "block", marginBottom: "0.25rem" }}>AI Feedback:</strong>
                                                  <div style={{ fontSize: "0.875rem", color: "#374151" }}>
                                                    {typeof submissionEntry.feedback === "string" 
                                                      ? submissionEntry.feedback 
                                                      : submissionEntry.feedback?.summary || "No feedback available"}
                                                  </div>
                                                </div>
                                              )}
                                              {submissionEntry.reasoning && (
                                                <div>
                                                  <strong style={{ color: "#1E5A3B", display: "block", marginBottom: "0.25rem" }}>Reasoning:</strong>
                                                  <div style={{ fontSize: "0.875rem", color: "#374151" }}>
                                                    {submissionEntry.reasoning}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })()}
                                
                                {/* Overall Feedback View */}
                                {expandedOverallFeedbackUser === userEmail && (() => {
                                  const submissionEntries = (submission as any).submissions || [];
                                  const subjectiveSubmissions = submissionEntries.filter((s: any) => s.questionType === "subjective" && s.feedback && s.feedback !== "Evaluation in progress...");
                                  const codingSubmissions = submissionEntries.filter((s: any) => s.questionType === "coding" && s.feedback && s.feedback !== "Evaluation in progress...");
                                  
                                  // Aggregate overall feedback for subjective questions
                                  const aggregateSubjectiveFeedback = () => {
                                    if (subjectiveSubmissions.length === 0) return null;
                                    
                                    const allStrengths: string[] = [];
                                    const allWeaknesses: string[] = [];
                                    const allSuggestions: string[] = [];
                                    let totalScore = 0;
                                    let totalMaxMarks = 0;
                                    
                                    subjectiveSubmissions.forEach((sub: any) => {
                                      totalScore += sub.marksAwarded || 0;
                                      totalMaxMarks += sub.maxMarks || 0;
                                      
                                      const feedback = sub.feedback;
                                      if (typeof feedback === "string") {
                                        // Simple string feedback - extract key points
                                        if (feedback.toLowerCase().includes("good") || feedback.toLowerCase().includes("well") || feedback.toLowerCase().includes("correct")) {
                                          allStrengths.push("Demonstrated understanding in subjective responses");
                                        }
                                        if (feedback.toLowerCase().includes("improve") || feedback.toLowerCase().includes("lack") || feedback.toLowerCase().includes("missing")) {
                                          allWeaknesses.push("Areas for improvement identified");
                                        }
                                      } else if (feedback && typeof feedback === "object") {
                                        // Structured feedback object
                                        if (feedback.strengths && Array.isArray(feedback.strengths)) {
                                          allStrengths.push(...feedback.strengths);
                                        }
                                        if (feedback.weaknesses && Array.isArray(feedback.weaknesses)) {
                                          allWeaknesses.push(...feedback.weaknesses);
                                        }
                                        if (feedback.suggestions && Array.isArray(feedback.suggestions)) {
                                          allSuggestions.push(...feedback.suggestions);
                                        }
                                      }
                                      
                                      // Check detailedFeedback if available
                                      if (sub.detailedFeedback && typeof sub.detailedFeedback === "object") {
                                        if (sub.detailedFeedback.strengths && Array.isArray(sub.detailedFeedback.strengths)) {
                                          allStrengths.push(...sub.detailedFeedback.strengths);
                                        }
                                        if (sub.detailedFeedback.weaknesses && Array.isArray(sub.detailedFeedback.weaknesses)) {
                                          allWeaknesses.push(...sub.detailedFeedback.weaknesses);
                                        }
                                        if (sub.detailedFeedback.suggestions && Array.isArray(sub.detailedFeedback.suggestions)) {
                                          allSuggestions.push(...sub.detailedFeedback.suggestions);
                                        }
                                      }
                                    });
                                    
                                    const percentage = totalMaxMarks > 0 ? ((totalScore / totalMaxMarks) * 100).toFixed(1) : "0";
                                    const uniqueStrengths = Array.from(new Set(allStrengths)).slice(0, 5);
                                    const uniqueWeaknesses = Array.from(new Set(allWeaknesses)).slice(0, 5);
                                    const uniqueSuggestions = Array.from(new Set(allSuggestions)).slice(0, 5);
                                    
                                    return {
                                      score: totalScore,
                                      maxMarks: totalMaxMarks,
                                      percentage,
                                      strengths: uniqueStrengths,
                                      weaknesses: uniqueWeaknesses,
                                      suggestions: uniqueSuggestions,
                                      summary: subjectiveSubmissions.length > 0 ? `Overall performance across ${subjectiveSubmissions.length} subjective question${subjectiveSubmissions.length > 1 ? 's' : ''}: ${totalScore}/${totalMaxMarks} (${percentage}%)` : null
                                    };
                                  };
                                  
                                  // Aggregate overall feedback for coding questions
                                  const aggregateCodingFeedback = () => {
                                    if (codingSubmissions.length === 0) return null;
                                    
                                    const allFeedbackTexts: string[] = [];
                                    const allStrengths: string[] = [];
                                    const allWeaknesses: string[] = [];
                                    const allIssues: string[] = [];
                                    const allSuggestions: string[] = [];
                                    let totalScore = 0;
                                    let totalMaxMarks = 0;
                                    
                                    codingSubmissions.forEach((sub: any) => {
                                      totalScore += sub.marksAwarded || 0;
                                      totalMaxMarks += sub.maxMarks || 0;
                                      
                                      const feedback = sub.feedback;
                                      const reasoning = sub.reasoning;
                                      
                                      // Collect all feedback text
                                      if (typeof feedback === "string" && feedback.trim()) {
                                        allFeedbackTexts.push(feedback);
                                      } else if (feedback && typeof feedback === "object") {
                                        // If feedback is an object, try to extract text
                                        if (feedback.feedback && typeof feedback.feedback === "string") {
                                          allFeedbackTexts.push(feedback.feedback);
                                        }
                                        if (feedback.overall_feedback && typeof feedback.overall_feedback === "string") {
                                          allFeedbackTexts.push(feedback.overall_feedback);
                                        }
                                        // Extract structured data
                                        if (feedback.strengths && Array.isArray(feedback.strengths)) {
                                          allStrengths.push(...feedback.strengths);
                                        }
                                        if (feedback.weaknesses && Array.isArray(feedback.weaknesses)) {
                                          allWeaknesses.push(...feedback.weaknesses);
                                        }
                                        if (feedback.issues && Array.isArray(feedback.issues)) {
                                          allIssues.push(...feedback.issues);
                                        }
                                        if (feedback.suggestions && Array.isArray(feedback.suggestions)) {
                                          allSuggestions.push(...feedback.suggestions);
                                        }
                                      }
                                      
                                      // Collect reasoning text
                                      if (reasoning && typeof reasoning === "string" && reasoning.trim()) {
                                        allFeedbackTexts.push(reasoning);
                                      }
                                      
                                      // Check detailedFeedback if available
                                      if (sub.detailedFeedback && typeof sub.detailedFeedback === "object") {
                                        if (sub.detailedFeedback.feedback && typeof sub.detailedFeedback.feedback === "string") {
                                          allFeedbackTexts.push(sub.detailedFeedback.feedback);
                                        }
                                        if (sub.detailedFeedback.strengths && Array.isArray(sub.detailedFeedback.strengths)) {
                                          allStrengths.push(...sub.detailedFeedback.strengths);
                                        }
                                        if (sub.detailedFeedback.weaknesses && Array.isArray(sub.detailedFeedback.weaknesses)) {
                                          allWeaknesses.push(...sub.detailedFeedback.weaknesses);
                                        }
                                        if (sub.detailedFeedback.issues && Array.isArray(sub.detailedFeedback.issues)) {
                                          allIssues.push(...sub.detailedFeedback.issues);
                                        }
                                        if (sub.detailedFeedback.suggestions && Array.isArray(sub.detailedFeedback.suggestions)) {
                                          allSuggestions.push(...sub.detailedFeedback.suggestions);
                                        }
                                      }
                                    });
                                    
                                    const percentage = totalMaxMarks > 0 ? ((totalScore / totalMaxMarks) * 100).toFixed(1) : "0";
                                    const percentageNum = parseFloat(percentage);
                                    
                                    // Get unique values
                                    const uniqueIssues = Array.from(new Set(allIssues));
                                    const uniqueStrengths = Array.from(new Set(allStrengths));
                                    const uniqueWeaknesses = Array.from(new Set(allWeaknesses));
                                    const uniqueSuggestions = Array.from(new Set(allSuggestions));
                                    
                                    // Build comprehensive feedback as a single narrative
                                    const parts: string[] = [];
                                    
                                    // Start with overall code assessment
                                    let codeAssessment = "";
                                    if (allFeedbackTexts.length > 0) {
                                      // Use the first substantial feedback text as the base assessment
                                      const mainFeedback = allFeedbackTexts.find(t => t.length > 50) || allFeedbackTexts[0];
                                      codeAssessment = mainFeedback;
                                    } else {
                                      // Generate assessment based on performance
                                      if (percentageNum >= 80) {
                                        codeAssessment = "The code demonstrates excellent understanding and implementation with strong problem-solving skills.";
                                      } else if (percentageNum >= 70) {
                                        codeAssessment = "The code shows good understanding and implementation with solid coding practices.";
                                      } else if (percentageNum >= 50) {
                                        codeAssessment = "The code demonstrates moderate understanding but requires improvements in implementation and best practices.";
                                      } else {
                                        codeAssessment = "The code requires significant improvements in understanding, implementation, and coding practices.";
                                      }
                                    }
                                    parts.push(codeAssessment);
                                    
                                    // Add issues found
                                    if (uniqueIssues.length > 0) {
                                      const issuesText = uniqueIssues.length === 1 
                                        ? `The main issue identified is: ${uniqueIssues[0]}.`
                                        : `Several issues were identified, including: ${uniqueIssues.slice(0, 3).join(", ")}${uniqueIssues.length > 3 ? `, and ${uniqueIssues.length - 3} more` : ""}.`;
                                      parts.push(issuesText);
                                    }
                                    
                                    // Add strengths
                                    if (uniqueStrengths.length > 0) {
                                      const strengthsText = uniqueStrengths.length === 1
                                        ? `A notable strength is ${uniqueStrengths[0].toLowerCase()}.`
                                        : `Key strengths include: ${uniqueStrengths.slice(0, 3).join(", ")}${uniqueStrengths.length > 3 ? `, and ${uniqueStrengths.length - 3} more` : ""}.`;
                                      parts.push(strengthsText);
                                    }
                                    
                                    // Add weaknesses
                                    if (uniqueWeaknesses.length > 0) {
                                      const weaknessesText = uniqueWeaknesses.length === 1
                                        ? `A key weakness is ${uniqueWeaknesses[0].toLowerCase()}.`
                                        : `Areas of weakness include: ${uniqueWeaknesses.slice(0, 3).join(", ")}${uniqueWeaknesses.length > 3 ? `, and ${uniqueWeaknesses.length - 3} more` : ""}.`;
                                      parts.push(weaknessesText);
                                    }
                                    
                                    // Add improvement areas
                                    if (uniqueSuggestions.length > 0) {
                                      const suggestionsText = uniqueSuggestions.length === 1
                                        ? `To improve, focus on: ${uniqueSuggestions[0].toLowerCase()}.`
                                        : `Areas for improvement include: ${uniqueSuggestions.slice(0, 3).join(", ")}${uniqueSuggestions.length > 3 ? `, and ${uniqueSuggestions.length - 3} more` : ""}.`;
                                      parts.push(suggestionsText);
                                    }
                                    
                                    // Add performance summary at the end
                                    const performanceSummary = `Overall performance: ${totalScore}/${totalMaxMarks} (${percentage}%) across ${codingSubmissions.length} coding question${codingSubmissions.length > 1 ? 's' : ''}.`;
                                    parts.push(performanceSummary);
                                    
                                    // Combine all parts into a single cohesive feedback
                                    const finalFeedback = parts.join(" ");
                                    
                                    return {
                                      score: totalScore,
                                      maxMarks: totalMaxMarks,
                                      percentage,
                                      comprehensiveFeedback: finalFeedback
                                    };
                                  };
                                  
                                  const subjectiveFeedback = aggregateSubjectiveFeedback();
                                  const codingFeedback = aggregateCodingFeedback();
                                  
                                  if (!subjectiveFeedback && !codingFeedback) {
                                    return (
                                      <div
                                        style={{
                                          padding: "0.75rem",
                                          backgroundColor: "#ffffff",
                                          borderRadius: "0.375rem",
                                          border: "1px solid #e5e7eb",
                                          color: "#64748b",
                                          fontSize: "0.875rem",
                                          fontStyle: "italic",
                                        }}
                                      >
                                        No overall feedback available. Feedback will be generated after AI evaluation completes.
                                      </div>
                                    );
                                  }
                                  
                                  return (
                                    <div
                                      style={{
                                        padding: "1rem",
                                        backgroundColor: "#ffffff",
                                        borderRadius: "0.5rem",
                                        border: "1px solid #7C3AED",
                                      }}
                                    >
                                      <h4 style={{ fontSize: "1rem", fontWeight: 600, color: "#7C3AED", marginBottom: "1rem" }}>
                                        Overall Feedback
                                      </h4>
                                      <div style={{ display: "grid", gap: "1.5rem" }}>
                                        {/* Subjective Overall Feedback */}
                                        {subjectiveFeedback && (
                                          <div
                                            style={{
                                              padding: "1rem",
                                              backgroundColor: "#F9FAFB",
                                              border: "1px solid #E5E7EB",
                                              borderRadius: "0.5rem",
                                            }}
                                          >
                                            <h5 style={{ fontSize: "0.9rem", fontWeight: 600, color: "#1E5A3B", marginBottom: "0.75rem" }}>
                                              Subjective Questions Overall Feedback
                                            </h5>
                                            {subjectiveFeedback.summary && (
                                              <div style={{ marginBottom: "0.75rem", fontSize: "0.875rem", color: "#374151" }}>
                                                <strong>Performance Summary:</strong> {subjectiveFeedback.summary}
                                              </div>
                                            )}
                                            {subjectiveFeedback.strengths && subjectiveFeedback.strengths.length > 0 && (
                                              <div style={{ marginBottom: "0.75rem" }}>
                                                <strong style={{ color: "#1E5A3B", display: "block", marginBottom: "0.5rem" }}>Strengths:</strong>
                                                <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "#374151" }}>
                                                  {subjectiveFeedback.strengths.map((strength: string, idx: number) => (
                                                    <li key={idx} style={{ marginBottom: "0.25rem" }}>{strength}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                            {subjectiveFeedback.weaknesses && subjectiveFeedback.weaknesses.length > 0 && (
                                              <div style={{ marginBottom: "0.75rem" }}>
                                                <strong style={{ color: "#1E5A3B", display: "block", marginBottom: "0.5rem" }}>Areas for Improvement:</strong>
                                                <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "#374151" }}>
                                                  {subjectiveFeedback.weaknesses.map((weakness: string, idx: number) => (
                                                    <li key={idx} style={{ marginBottom: "0.25rem" }}>{weakness}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                            {subjectiveFeedback.suggestions && subjectiveFeedback.suggestions.length > 0 && (
                                              <div>
                                                <strong style={{ color: "#1E5A3B", display: "block", marginBottom: "0.5rem" }}>Suggestions:</strong>
                                                <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "#374151" }}>
                                                  {subjectiveFeedback.suggestions.map((suggestion: string, idx: number) => (
                                                    <li key={idx} style={{ marginBottom: "0.25rem" }}>{suggestion}</li>
                                                  ))}
                                                </ul>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                        
                                        {/* Coding Overall Feedback */}
                                        {codingFeedback && (
                                          <div
                                            style={{
                                              padding: "1rem",
                                              backgroundColor: "#F9FAFB",
                                              border: "1px solid #E5E7EB",
                                              borderRadius: "0.5rem",
                                            }}
                                          >
                                            <h5 style={{ fontSize: "0.9rem", fontWeight: 600, color: "#1E5A3B", marginBottom: "0.75rem" }}>
                                              Coding Questions Overall Feedback
                                            </h5>
                                            {codingFeedback.comprehensiveFeedback && (
                                              <div 
                                                style={{ 
                                                  fontSize: "0.875rem", 
                                                  color: "#374151",
                                                  lineHeight: "1.6",
                                                  whiteSpace: "pre-wrap",
                                                  wordBreak: "break-word"
                                                }}
                                              >
                                                {codingFeedback.comprehensiveFeedback}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "1rem", marginTop: "2rem" }}>
          <button type="button" onClick={() => router.push("/dashboard")} className="btn-secondary">
            ← Back to Dashboard
          </button>
          <button
            type="button"
            onClick={handleDelete}
            style={{
              padding: "0.75rem 1.5rem",
              backgroundColor: "#ef4444",
              color: "#ffffff",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer",
            }}
          >
            Delete Assessment
          </button>
        </div>
      </div>

      {/* Add Candidate Modal */}
      {showAddCandidateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => {
            if (!addingCandidate) {
              setShowAddCandidateModal(false);
              setNewCandidateName("");
              setNewCandidateEmail("");
              setEmailError(null);
            }
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              padding: "2rem",
              width: "90%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                marginBottom: "1.5rem",
                color: "#2D7A52",
              }}
            >
              Add Candidate
            </h2>

            {/* Manual Add Section */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Full Name <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={newCandidateName}
                  onChange={(e) => {
                    setNewCandidateName(e.target.value);
                    setEmailError(null);
                  }}
                  placeholder="Enter candidate's full name"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                  }}
                  disabled={addingCandidate}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Email Address <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="email"
                  value={newCandidateEmail}
                  onChange={(e) => {
                    setNewCandidateEmail(e.target.value);
                    setEmailError(null);
                  }}
                  placeholder="Enter candidate's email address"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: emailError ? "1px solid #ef4444" : "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                  }}
                  disabled={addingCandidate}
                />
                {emailError && (
                  <p style={{ color: "#ef4444", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                    {emailError}
                  </p>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: "flex-end",
                  marginTop: "1rem",
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddCandidateModal(false);
                    setNewCandidateName("");
                    setNewCandidateEmail("");
                    setEmailError(null);
                  }}
                  disabled={addingCandidate}
                  style={{ marginTop: 0 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAddCandidate}
                  disabled={addingCandidate}
                  style={{ marginTop: 0 }}
                >
                  {addingCandidate ? "Adding..." : "Add Candidate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Template Edit Modal */}
      {showEmailTemplateModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => {
            if (!savingTemplate) {
              setShowEmailTemplateModal(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: "#ffffff",
              borderRadius: "0.75rem",
              padding: "2rem",
              width: "90%",
              maxWidth: "700px",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 600,
                marginBottom: "1.5rem",
                color: "#2D7A52",
              }}
            >
              Edit Email Template
            </h2>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Logo URL (optional)
                </label>
                <input
                  type="text"
                  value={emailTemplate.logoUrl}
                  onChange={(e) => setEmailTemplate({ ...emailTemplate, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                  }}
                  disabled={savingTemplate}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Company Name (optional)
                </label>
                <input
                  type="text"
                  value={emailTemplate.companyName}
                  onChange={(e) => setEmailTemplate({ ...emailTemplate, companyName: e.target.value })}
                  placeholder="Your Company Name"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                  }}
                  disabled={savingTemplate}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Message <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  value={emailTemplate.message}
                  onChange={(e) => setEmailTemplate({ ...emailTemplate, message: e.target.value })}
                  placeholder="You have been invited to take a Custom MCQ assessment. Please click the link below to start."
                  rows={6}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                  }}
                  disabled={savingTemplate}
                />
                <p style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                  Available placeholders: {"{{candidate_name}}"}, {"{{candidate_email}}"}, {"{{exam_url}}"}, {"{{assessment_url}}"}, {"{{company_name}}"}
                </p>
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Footer (optional)
                </label>
                <textarea
                  value={emailTemplate.footer}
                  onChange={(e) => setEmailTemplate({ ...emailTemplate, footer: e.target.value })}
                  placeholder="Additional footer text"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                    fontFamily: "inherit",
                  }}
                  disabled={savingTemplate}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "#1e293b",
                  }}
                >
                  Sent By (optional)
                </label>
                <input
                  type="text"
                  value={emailTemplate.sentBy}
                  onChange={(e) => setEmailTemplate({ ...emailTemplate, sentBy: e.target.value })}
                  placeholder="AI Assessment Platform"
                  style={{
                    width: "100%",
                    padding: "0.75rem",
                    border: "1px solid #A8E8BC",
                    borderRadius: "0.5rem",
                    fontSize: "1rem",
                  }}
                  disabled={savingTemplate}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  justifyContent: "flex-end",
                  marginTop: "1rem",
                }}
              >
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowEmailTemplateModal(false);
                  }}
                  disabled={savingTemplate}
                  style={{ marginTop: 0 }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleSaveEmailTemplate}
                  disabled={savingTemplate || !emailTemplate.message.trim()}
                  style={{ marginTop: 0 }}
                >
                  {savingTemplate ? "Saving..." : "Save Template"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Send Email to All Modal */}
      {showSendEmailModal && assessment && (
        <EmailInvitationModal
          isOpen={showSendEmailModal}
          onClose={() => setShowSendEmailModal(false)}
          candidates={(assessment.candidates || []).map((c: any) => ({ name: c.name, email: c.email }))}
          assessmentTitle={assessment.title || "Custom MCQ Assessment"}
          assessmentUrl={`${window.location.origin}/custom-mcq/entry/${assessmentId}?token=${(assessment as any).assessmentToken || ""}`}
          onSend={handleSendEmailsWithTemplate}
          invitationsSent={false}
          hasNewCandidates={true}
        />
      )}

      <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;

