'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import { GetServerSideProps } from 'next'
import { requireAuth } from '../../../../lib/auth'
import Link from 'next/link'
import axios from 'axios'
import apiClient from '@/services/api/client'
import { ArrowLeft, Lightbulb, CheckCircle2, TrendingUp, AlertTriangle, Eye, Clock, Video, Loader2, Download } from 'lucide-react'
import ProctorLogsReview from '../../../../components/admin/ProctorLogsReview'
import { LiveProctoringDashboard } from '../../../../components/proctor'
import { useDSATest, useDSACandidates, useDSACandidateAnalytics, useAddDSACandidate, useRemoveDSACandidate, useSendDSAInvitation, useSendDSAInvitationsToAll, useDSACandidateResume, useSendDSAFeedback, useBulkAddDSACandidates, useUpdateDSATest, type CandidateAnalytics, type QuestionAnalytics } from '@/hooks/api/useDSA'
import { useEmployees, type Employee } from '@/hooks/api/useEmployees'
import { isSQLQuestion } from '@/hooks/api/useSQL'
import SQLAnalyticsView from '@/components/dsa/analytics/SQLAnalyticsView'

interface AIFeedback {
  overall_score?: number
  feedback_summary?: string
  one_liner?: string
  code_quality?: {
    score?: number
    comments?: string
  }
  efficiency?: {
    time_complexity?: string
    space_complexity?: string
    comments?: string
  }
  correctness?: {
    score?: number
    comments?: string
  }
  suggestions?: string[]
  strengths?: string[]
  areas_for_improvement?: string[]
  deduction_reasons?: string[]
  improvement_suggestions?: string[]
  test_breakdown?: {
    public_passed?: number
    public_total?: number
    hidden_passed?: number
    hidden_total?: number
    total_passed?: number
    total_tests?: number
  }
  scoring_basis?: {
    base_score?: number
    correctness_score?: number
    pass_rate?: string
    efficiency_bonus?: number
    code_quality_score?: number
    code_quality_adjustment?: number
    time_complexity?: string
    space_complexity?: string
    final_score?: number
    points_deducted?: number
    explanation?: string
  }
}

// QuestionAnalytics and CandidateAnalytics are now imported from '@/hooks/api/useDSA'

interface Candidate {
  user_id: string
  name: string
  email: string
  has_submitted?: boolean
  submission_score?: number
  created_at?: string
  submitted_at?: string
  status?: string // 'pending' | 'invited' | 'started' | 'completed'
}

export default function AnalyticsPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const { id: testIdParam, candidate: candidateUserId } = router.query
  const testId = typeof testIdParam === 'string' ? testIdParam : undefined
  
  // React Query hooks
  const { data: testInfoData, isLoading: loadingTestInfo } = useDSATest(testId)
  const { data: candidatesData, isLoading: loadingCandidates, refetch: refetchCandidates } = useDSACandidates(testId)
  const selectedCandidateUserId = typeof candidateUserId === 'string' ? candidateUserId : undefined
  const { data: analyticsData, isLoading: loadingAnalytics, refetch: refetchAnalytics, error: analyticsError } = useDSACandidateAnalytics(testId, selectedCandidateUserId)
  
  // Mutations
  const addCandidateMutation = useAddDSACandidate()
  const removeCandidateMutation = useRemoveDSACandidate()
  const sendInvitationMutation = useSendDSAInvitation()
  const sendInvitationsToAllMutation = useSendDSAInvitationsToAll()
  const sendFeedbackMutation = useSendDSAFeedback()
  const bulkAddCandidatesMutation = useBulkAddDSACandidates()
  const updateTestMutation = useUpdateDSATest()
  
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<CandidateAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [proctorLogs, setProctorLogs] = useState<any[]>([])
  const [eventTypeLabels, setEventTypeLabels] = useState<Record<string, string>>({})
  const [loadingProctorLogs, setLoadingProctorLogs] = useState(false)
  const [showProctorLogs, setShowProctorLogs] = useState(false)
  const [showAddCandidateModal, setShowAddCandidateModal] = useState(false)
  const [newCandidateName, setNewCandidateName] = useState("")
  const [newCandidateEmail, setNewCandidateEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [addingCandidate, setAddingCandidate] = useState(false)
  const [testInfo, setTestInfo] = useState<any>(null)
  const [employeeSearch, setEmployeeSearch] = useState("")
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null) 
  const [selectedEmployees, setSelectedEmployees] = useState<Employee[]>([]) // Multi-select support

  // Org-admin employees list, filtered by search (scoped by org on backend)
  const { data: employeesData, isLoading: employeesLoading } = useEmployees({
    page: 1,
    limit: 20,
    search: employeeSearch || undefined,
  })
  
  // Update local state from React Query data
  useEffect(() => {
    if (testInfoData) {
      setTestInfo(testInfoData)
      const testData = testInfoData as any
      if (testData.invitationTemplate) {
        setEmailTemplate(testData.invitationTemplate)
      } else {
        setEmailTemplate({
          logoUrl: "",
          companyName: "",
          message: "You have been invited to take a DSA test. Please click the link below to start.",
          footer: "",
          sentBy: "AI Assessment Platform"
        })
      }
    }
  }, [testInfoData])
  
  useEffect(() => {
    if (candidatesData) {
      setCandidates(candidatesData)
    }
  }, [candidatesData])
  
  useEffect(() => {
    if (analyticsData) {
      setAnalytics(analyticsData)
    }
  }, [analyticsData])
  
  useEffect(() => {
    setLoading(loadingTestInfo || loadingCandidates)
  }, [loadingTestInfo, loadingCandidates])
  const [showEmailTemplateModal, setShowEmailTemplateModal] = useState(false)
  const [emailTemplate, setEmailTemplate] = useState({
    logoUrl: "",
    companyName: "",
    message: "You have been invited to take a DSA test. Please click the link below to start.",
    footer: "",
    sentBy: "AI Assessment Platform"
  })
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [sendingInvitations, setSendingInvitations] = useState(false)
  const [sendingFeedback, setSendingFeedback] = useState<string | null>(null)
  const [showLiveProctoring, setShowLiveProctoring] = useState(false)
  const [isLiveProctoringCooldown, setIsLiveProctoringCooldown] = useState(false)
  const [referencePhoto, setReferencePhoto] = useState<string | null>(null)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [resumeUrl, setResumeUrl] = useState<string | null>(null)
  const [loadingResume, setLoadingResume] = useState(false)
  
  // Memoize proctorAssessmentId to prevent infinite loops
  const proctorAssessmentId = useMemo(() => (testId as string) || "", [testId])
  const proctorAdminId = useMemo(() => (session as any)?.user?.id || (session as any)?.user?.email || 'admin', [session])
  

  // Analytics are now fetched via useDSACandidateAnalytics hook
  // This function is kept for backward compatibility
  const fetchAnalytics = async (userId: string, showLoading: boolean = true) => {
    if (!testId || !userId) return false
    
    // Data is automatically fetched via useDSACandidateAnalytics hook
    // Check if any AI feedback is still being processed
    if (analyticsData) {
      const hasPendingFeedback = analyticsData?.question_analytics?.some(
        (qa: QuestionAnalytics) => {
          if (!qa.ai_feedback) return true // No feedback yet
          const feedback = qa.ai_feedback as any
          // If it has an error, it's done (even if failed)
          if (feedback.error) return false
          // If it has overall_score, it's done
          if (feedback.overall_score !== undefined && feedback.overall_score !== null) return false
          // Otherwise, it's still pending
          return true
        }
      )
      return hasPendingFeedback || false
    }
    
    return false
  }

  const fetchProctorLogs = async (userId: string) => {
    if (!testId || typeof testId !== 'string' || !userId) return
    
    setLoadingProctorLogs(true)
    try {
      console.log('[Analytics] Fetching proctor logs with userId:', userId)
      
      const response = await fetch(`/api/proctor/logs?assessmentId=${encodeURIComponent(testId)}&userId=${encodeURIComponent(userId)}`)
      const data = await response.json()
      
      if (data.success && data.data && data.data.logs) {
        setProctorLogs(data.data.logs)
        setEventTypeLabels(data.data.eventTypeLabels || {})
      } else {
        setProctorLogs([])
        setEventTypeLabels({})
      }
    } catch (error) {
      console.error('Error fetching proctor logs:', error)
      setProctorLogs([])
      setEventTypeLabels({})
    } finally {
      setLoadingProctorLogs(false)
    }
  }

  // Removed 8-second cooldown - no longer needed as reconnection is handled properly

  useEffect(() => {
    if (!testId || typeof testId !== 'string') return

    // Test info and candidates are already fetched via React Query hooks
    // and synced in useEffect hooks above
    
    // If candidate query param is set, load that candidate's analytics
    if (candidateUserId && typeof candidateUserId === 'string') {
      const candidate = candidatesData?.find((c: any) => c.user_id === candidateUserId)
      if (candidate) {
        setSelectedCandidate(candidateUserId)
        fetchAnalytics(candidateUserId)
        fetchProctorLogs(candidateUserId)
        // Try to fetch reference photo if candidate email is available
        console.log('[DSA Analytics] 🔍 Initial candidate load for reference photo:', {
          candidateUserId,
          candidateFound: !!candidate,
          candidateEmail: candidate?.email
        })
        if (candidate?.email) {
          console.log('[DSA Analytics] 📞 Calling fetchReferencePhoto with email:', candidate.email)
          fetchReferencePhoto(candidate.email)
        } else {
          console.warn('[DSA Analytics] ⚠️ Candidate email not found in initial load')
        }
      }
    }
  }, [testId, candidateUserId, candidatesData])

  // Polling for AI feedback updates
  useEffect(() => {
    if (!selectedCandidate || !testId || typeof testId !== 'string') return
    
    // Check if analytics has pending AI feedback
    const hasPendingFeedback = analytics?.question_analytics?.some(
      (qa: QuestionAnalytics) => {
        if (!qa.ai_feedback) return true // No feedback yet
        const feedback = qa.ai_feedback as any
        // If it has an error, it's done (even if failed)
        if (feedback.error) return false
        // If it has overall_score, it's done
        if (feedback.overall_score !== undefined && feedback.overall_score !== null) return false
        // Otherwise, it's still pending
        return true
      }
    )
    
    if (!hasPendingFeedback) return // No pending feedback, stop polling
    
    // Poll every 5 seconds for AI feedback updates
    const pollInterval = setInterval(async () => {
      const stillPending = await fetchAnalytics(selectedCandidate, false)
      if (!stillPending) {
        clearInterval(pollInterval)
      }
    }, 5000)
    
    return () => clearInterval(pollInterval)
  }, [selectedCandidate, testId, analytics])

  const fetchReferencePhoto = async (candidateEmail: string) => {
    console.log('[DSA Analytics] 🔍 fetchReferencePhoto called:', { testId, candidateEmail })
    
    if (!testId || typeof testId !== 'string' || !candidateEmail) {
      console.warn('[DSA Analytics] ⚠️ Missing required params:', { testId, candidateEmail })
      setReferencePhoto(null)
      return
    }

    try {
      console.log('[DSA Analytics] 📡 Fetching reference photo from API...', {
        assessmentId: testId,
        candidateEmail,
        endpoint: '/api/v1/candidate/get-reference-photo'
      })
      
      // For DSA/AIML tests, identity verification uses testId as assessmentId
      const response = await axios.get(`/api/v1/candidate/get-reference-photo`, {
        params: {
          assessmentId: testId,
          candidateEmail,
        },
      })

      console.log('[DSA Analytics] 📥 API Response:', {
        success: response.data?.success,
        hasReferenceImage: !!response.data?.data?.referenceImage,
        dataKeys: response.data?.data ? Object.keys(response.data.data) : [],
        message: response.data?.message,
        fullResponse: response.data
      })
      
      // Log the assessmentId mismatch if photo not found
      if (!response.data?.data?.referenceImage && response.data?.message === 'No reference photo found') {
        console.warn('[DSA Analytics] ⚠️ Reference photo not found. Check if assessmentId matches:', {
          testIdUsed: testId,
          candidateEmail,
          note: 'Photo might have been saved with a different assessmentId. Check candidate side logs for the actual assessmentId used when saving.'
        })
      }

      if (response.data?.success && response.data?.data?.referenceImage) {
        console.log('[DSA Analytics] ✅ Reference photo fetched successfully')
        setReferencePhoto(response.data.data.referenceImage)
      } else {
        console.warn('[DSA Analytics] ⚠️ No reference image in response:', response.data)
        setReferencePhoto(null)
      }
    } catch (error: any) {
      console.error('[DSA Analytics] ❌ Error fetching reference photo:', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        fullError: error
      })
      setReferencePhoto(null)
    }
  }

  const fetchResume = async (candidateEmail: string) => {
    if (!testId || typeof testId !== 'string' || !candidateEmail) {
      return
    }

    setLoadingResume(true)
    try {
      const response = await apiClient.get(`/api/v1/dsa/tests/${testId}/candidates/${selectedCandidate}/resume`, {
        params: {
          email: candidateEmail,
        },
        responseType: 'json',
      })

      if (response.data?.resume) {
        // Resume is returned as base64 data URL
        setResumeUrl(response.data.resume)
        setShowResumeModal(true)
      } else {
        alert('Resume not found')
      }
    } catch (error: any) {
      console.error('Error fetching resume:', error)
      alert(error.response?.data?.detail || 'Failed to load resume')
    } finally {
      setLoadingResume(false)
    }
  }

  const handleCandidateSelect = (userId: string) => {
    const candidate = candidates.find(c => c.user_id === userId)
    console.log('[DSA Analytics] 👤 Candidate selected:', {
      userId: userId,
      userIdType: typeof userId,
      candidateData: candidate,
      candidateEmail: candidate?.email,
      allCandidates: candidates.map(c => ({ user_id: c.user_id, email: c.email }))
    })
    setSelectedCandidate(userId)
    // Update router query params to trigger useDSACandidateAnalytics hook
    router.push({
      pathname: router.pathname,
      query: { ...router.query, candidate: userId }
    }, undefined, { shallow: true })
    // Manually refetch analytics to ensure data loads immediately
    setTimeout(() => {
      refetchAnalytics()
    }, 100)
    fetchAnalytics(userId)
    // Fetch proctor logs using candidate.user_id (MongoDB ObjectId)
    fetchProctorLogs(userId)
    // Try to fetch reference photo if candidate email is available
    console.log('[DSA Analytics] 👤 Candidate selected for reference photo:', {
      userId,
      candidateFound: !!candidate,
      candidateEmail: candidate?.email,
      allCandidates: candidates.map(c => ({ user_id: c.user_id, email: c.email }))
    })
    if (candidate?.email) {
      console.log('[DSA Analytics] 📞 Calling fetchReferencePhoto with email:', candidate.email)
      fetchReferencePhoto(candidate.email)
    } else {
      console.warn('[DSA Analytics] ⚠️ Candidate email not found, cannot fetch reference photo')
    }
    // Auto-show logs when candidate is selected (same expectation as AI assessment analytics)
    setShowProctorLogs(true)
    // Scroll to top of analytics content when candidate is selected
    setTimeout(() => {
      const analyticsContent = document.querySelector('[data-analytics-content]')
      if (analyticsContent) {
        analyticsContent.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 100)
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }
    return date.toLocaleString('en-US', options)
  }

  const validateEmail = (email: string): boolean => {
    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailPattern.test(email)
  }

  const handleAddCandidate = async () => {
    if (!testId || typeof testId !== 'string') return
    
    // Support both single and multi-select
    const employeesToAdd = selectedEmployees.length > 0 ? selectedEmployees : (selectedEmployee ? [selectedEmployee] : [])
    
    if (employeesToAdd.length === 0) {
      setEmailError("Please select at least one employee from your organization.")
      return
    }
    
    setEmailError(null)
    setAddingCandidate(true)
    
    try {
      let successCount = 0
      let errorCount = 0
      const errors: string[] = []
      
      // Add all selected employees
      for (const emp of employeesToAdd) {
        const candidateName = emp.name?.trim()
        const candidateEmail = emp.email?.trim()
        const candidateAaptorId = emp.aaptorId

        if (!candidateEmail) {
          errors.push(`${emp.name || emp.email}: No email configured`)
          errorCount++
          continue
        }
        
        try {
          await addCandidateMutation.mutateAsync({
            testId,
            data: {
              name: candidateName || emp.email,
              email: candidateEmail,
              aaptorId: candidateAaptorId,
            }
          })
          successCount++
        } catch (err: any) {
          const errorMsg = err.response?.data?.detail || err.response?.data?.message || err.message || "Failed to add candidate"
          errors.push(`${emp.name || emp.email}: ${errorMsg}`)
          errorCount++
        }
      }
      
      // Refresh candidates list
      await refetchCandidates()
      
      // Close modal and reset form
      setShowAddCandidateModal(false)
      setNewCandidateName("")
      setNewCandidateEmail("")
      setSelectedEmployee(null)
      setSelectedEmployees([])
      setEmployeeSearch("")
      setEmailError(null)
      
      // Show results
      if (errorCount === 0) {
        alert(`Successfully added ${successCount} candidate(s)!`)
      } else {
        alert(
          `Added ${successCount} candidate(s) successfully.\n` +
          `Failed to add ${errorCount} candidate(s):\n${errors.join('\n')}`
        )
      }
    } catch (err: any) {
      setEmailError(err.response?.data?.detail || err.response?.data?.message || err.message || "Failed to add candidates")
    } finally {
      setAddingCandidate(false)
    }
  }
  
  const handleEmployeeToggle = (emp: Employee) => {
    setSelectedEmployees(prev => {
      const isSelected = prev.some(e => e.aaptorId === emp.aaptorId)
      if (isSelected) {
        // Remove from selection
        return prev.filter(e => e.aaptorId !== emp.aaptorId)
      } else {
        // Add to selection
        return [...prev, emp]
      }
    })
    // Also update single select for backward compatibility
    setSelectedEmployee(emp)
    setNewCandidateName(emp.name || "")
    setNewCandidateEmail(emp.email || "")
    setEmailError(null)
  }

  const handleResendInvitation = async (email: string) => {
    if (!testId || typeof testId !== 'string') return
    
    try {
      await sendInvitationMutation.mutateAsync({ testId: testId!, email })
      alert("Invitation sent successfully!")
      await refetchCandidates()
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.message || "Failed to resend invitation")
    }
  }

  const handleRemoveCandidate = async (userId: string) => {
    if (!testId || typeof testId !== 'string') return
    const candidate = candidates.find(c => c.user_id === userId)
    if (!candidate) return
    if (!confirm(`Are you sure you want to remove ${candidate.name} (${candidate.email}) from this test?`)) return
    
    try {
      await removeCandidateMutation.mutateAsync({ testId: testId!, userId })
      // Refresh candidates list
      await refetchCandidates()
      // Clear selection if removed candidate was selected
      if (selectedCandidate === userId) {
        setSelectedCandidate(null)
        setAnalytics(null)
        // Clear candidate query param
        const { candidate, ...restQuery } = router.query
        router.push({
          pathname: router.pathname,
          query: restQuery
        }, undefined, { shallow: true })
      }
      alert("Candidate removed successfully!")
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.message || "Failed to remove candidate")
    }
  }

  const handleSaveEmailTemplate = async () => {
    if (!testId || typeof testId !== 'string') return
    
    setSavingTemplate(true)
    try {
      // Update test with email template
      await updateTestMutation.mutateAsync({
        testId,
        data: {
          invitationTemplate: emailTemplate
        } as any
      })
      
      // Update local test info
      setTestInfo((prev: any) => ({
        ...prev,
        invitationTemplate: emailTemplate
      }))
      
      setShowEmailTemplateModal(false)
      alert("Email template saved successfully!")
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.message || "Failed to save email template")
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleSendInvitationsToAll = async () => {
    if (!testId || typeof testId !== 'string') return
    
    if (candidates.length === 0) {
      alert("No candidates to send invitations to.")
      return
    }
    
    if (!confirm(`Send invitation emails to all ${candidates.length} candidates?`)) {
      return
    }
    
    setSendingInvitations(true)
    try {
      const response = await sendInvitationsToAllMutation.mutateAsync(testId!)
      
      if (response.data) {
        const successCount = response.data.success_count || 0
        const failedCount = response.data.failed_count || 0
        
        // Refresh candidates list to show updated statuses
        await refetchCandidates()
        
        if (failedCount === 0) {
          alert(`Successfully sent invitation emails to all ${successCount} candidates!`)
        } else {
          alert(
            `Invitation emails sent:\n` +
            `✓ Success: ${successCount}\n` +
            `✗ Failed: ${failedCount}\n\n` +
            `Check the console for details.`
          )
          console.error("Failed emails:", response.data.failed)
        }
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.message || "Failed to send invitation emails")
    } finally {
      setSendingInvitations(false)
    }
  }

  const handleSendFeedback = async (userId: string) => {
    if (!testId || typeof testId !== 'string') return
    
    const candidate = candidates.find(c => c.user_id === userId)
    if (!candidate) return
    
    if (!confirm(`Send AI feedback email to ${candidate.name} (${candidate.email})?`)) {
      return
    }
    
    setSendingFeedback(userId)
    try {
      await sendFeedbackMutation.mutateAsync({ testId: testId!, userId })
      alert("Feedback email sent successfully!")
    } catch (err: any) {
      alert(err.response?.data?.detail || err.response?.data?.message || "Failed to send feedback email")
    } finally {
      setSendingFeedback(null)
    }
  }

  const handleExportResults = async () => {
    if (!testId || typeof testId !== 'string' || candidates.length === 0) {
      alert('No candidates to export')
      return
    }

    try {
      // Fetch analytics for all candidates
      const exportData = []
      
      for (const candidate of candidates) {
        try {
          const response = await apiClient.get(`/api/v1/dsa/tests/${testId}/candidates/${candidate.user_id}/analytics`)
          const analytics = response.data
          
          // Get aaptor ID from candidateInfo, customFields, or employee data
          let aaptorId = ''
          if (analytics.candidateInfo?.aaptorId) {
            aaptorId = analytics.candidateInfo.aaptorId
          } else if (analytics.candidateInfo?.customFields?.aaptorId) {
            aaptorId = analytics.candidateInfo.customFields.aaptorId
          } else {
            // Try to find in employees list
            const employee = employeesData?.employees?.find((emp: Employee) => emp.email === candidate.email)
            if (employee?.aaptorId) {
              aaptorId = employee.aaptorId
            }
          }
          
          // Collect all feedbacks
          const feedbacks: string[] = []
          if (analytics.question_analytics && analytics.question_analytics.length > 0) {
            analytics.question_analytics.forEach((qa: QuestionAnalytics) => {
              if (qa.ai_feedback) {
                const feedback = qa.ai_feedback
                const feedbackParts: string[] = []
                
                if (feedback.feedback_summary) {
                  feedbackParts.push(`Summary: ${feedback.feedback_summary}`)
                }
                if (feedback.one_liner) {
                  feedbackParts.push(`One-liner: ${feedback.one_liner}`)
                }
                if (feedback.code_quality?.comments) {
                  feedbackParts.push(`Code Quality: ${feedback.code_quality.comments}`)
                }
                if (feedback.correctness?.comments) {
                  feedbackParts.push(`Correctness: ${feedback.correctness.comments}`)
                }
                if (feedback.efficiency?.comments) {
                  feedbackParts.push(`Efficiency: ${feedback.efficiency.comments}`)
                }
                if (feedback.suggestions && feedback.suggestions.length > 0) {
                  feedbackParts.push(`Suggestions: ${feedback.suggestions.join('; ')}`)
                }
                if (feedback.strengths && feedback.strengths.length > 0) {
                  feedbackParts.push(`Strengths: ${feedback.strengths.join('; ')}`)
                }
                if (feedback.areas_for_improvement && feedback.areas_for_improvement.length > 0) {
                  feedbackParts.push(`Areas for Improvement: ${feedback.areas_for_improvement.join('; ')}`)
                }
                
                if (feedbackParts.length > 0) {
                  feedbacks.push(`Question: ${qa.question_title || 'Unknown'} - ${feedbackParts.join(' | ')}`)
                }
              }
            })
          }
          
          exportData.push({
            name: analytics.candidate?.name || candidate.name || '',
            email: analytics.candidate?.email || candidate.email || '',
            aaptorId: aaptorId || 'N/A',
            score: analytics.submission?.score || candidate.submission_score || 0,
            feedbacks: feedbacks.join('\n\n') || 'No feedback available'
          })
        } catch (err: any) {
          // If analytics fetch fails, still include candidate with available data
          let aaptorId = ''
          // Try to find in employees list
          const employee = employeesData?.employees?.find((emp: Employee) => emp.email === candidate.email)
          if (employee?.aaptorId) {
            aaptorId = employee.aaptorId
          }
          
          exportData.push({
            name: candidate.name || '',
            email: candidate.email || '',
            aaptorId: aaptorId || 'N/A',
            score: candidate.submission_score || 0,
            feedbacks: 'Analytics not available'
          })
        }
      }
      
      // Convert to CSV
      const headers = ['Name', 'Email', 'Aaptor ID', 'Score', 'Feedbacks']
      const csvRows = [
        headers.join(','),
        ...exportData.map(row => {
          // Escape commas and quotes in CSV
          const escapeCSV = (str: string) => {
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`
            }
            return str
          }
          
          return [
            escapeCSV(row.name),
            escapeCSV(row.email),
            escapeCSV(row.aaptorId),
            row.score,
            escapeCSV(row.feedbacks)
          ].join(',')
        })
      ]
      
      const csvContent = csvRows.join('\n')
      
      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `test_results_${testId}_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      alert(`Exported ${exportData.length} candidate results successfully!`)
    } catch (err: any) {
      console.error('Error exporting results:', err)
      alert('Failed to export results: ' + (err.response?.data?.detail || err.message))
    }
  }

  // Check if test has ended
  const isTestEnded = useMemo(() => {
    if (!testInfo?.schedule?.endTime) return false
    try {
      const endTime = new Date(testInfo.schedule.endTime)
      const now = new Date()
      return now >= endTime
    } catch {
      return false
    }
  }, [testInfo])

  if (loading) {
    return (
      <div className="container">
        <div className="card">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    )
  }

  // Calculate overall statistics
  const submittedCandidates = candidates.filter(c => c.has_submitted)
  const totalCandidates = candidates.length
  const submittedCount = submittedCandidates.length
  const avgScore = submittedCount > 0
    ? submittedCandidates.reduce((sum, c) => sum + (c.submission_score || 0), 0) / submittedCount
    : 0
  const passedCount = submittedCandidates.filter(c => (c.submission_score || 0) >= 60).length
  const failedCount = submittedCandidates.filter(c => (c.submission_score || 0) < 60).length

  return (
    <div className="container">
      <div className="card">
        {/* Back Button */}
        <div style={{ marginBottom: "1.5rem" }}>
          <Link
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 1rem",
              fontSize: "0.875rem",
              backgroundColor: "#f1f5f9",
              color: "#475569",
              border: "1px solid #e2e8f0",
              borderRadius: "0.5rem",
              textDecoration: "none",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#e2e8f0";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#f1f5f9";
            }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>

        <div
          style={{
            marginBottom: "2rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div>
          <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
            Test Analytics
          </h1>
          <p style={{ color: "#64748b", margin: 0 }}>
            {testInfo?.title || 'DSA Test'} - View detailed analytics and AI feedback
          </p>
          </div>

          {/* Admin preview - Try This Test button */}
          {testId && (
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                window.open(`/test/${testId}/take?preview=true&admin=true`, "_blank");
              }}
              style={{
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                backgroundColor: "#3b82f6",
                color: "white",
                border: "none",
                borderRadius: "0.5rem",
                cursor: "pointer",
                fontWeight: 500,
                whiteSpace: "nowrap",
              }}
            >
              🧪 Test This Test
            </button>
          )}
        </div>

        {/* Test Access & Email Template Section */}
        {testInfo && (
          <div style={{ 
            marginBottom: "2rem", 
            padding: "1.5rem", 
            backgroundColor: "#f8fafc", 
            borderRadius: "0.75rem", 
            border: "1px solid #e2e8f0" 
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: 0 }}>
                Test Access & Email Settings
              </h2>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowEmailTemplateModal(true)}
                style={{ 
                  padding: "0.5rem 1rem", 
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem"
                }}
              >
                ✏️ Edit Email Template
              </button>
              </div>
            </div>
            <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "1rem" }}>
              {testInfo.invitationTemplate ? (
                <span style={{ color: "#10b981" }}>✓ Custom email template is configured</span>
              ) : (
                <span>Using system default email template</span>
              )}
            </div>
            
            {/* Test URL */}
            {testInfo.test_token && testId && (
              <div style={{ marginTop: "1.5rem" }}>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                  Test URL
                </label>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <input
                    type="text"
                    value={`${typeof window !== 'undefined' ? window.location.origin : ''}/test/${testId}?token=${testInfo.test_token}`}
                    readOnly
                    style={{
                      flex: 1,
                      padding: "0.75rem",
                      border: "1px solid #A8E8BC",
                      borderRadius: "0.5rem",
                      fontSize: "1rem",
                      backgroundColor: "#ffffff",
                    }}
                  />
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      const testUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/test/${testId}?token=${testInfo.test_token}`;
                      navigator.clipboard.writeText(testUrl);
                      alert("Test URL copied to clipboard!");
                    }}
                    style={{ marginTop: 0, whiteSpace: "nowrap", padding: "0.75rem 1.5rem" }}
                  >
                    Copy URL
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Candidates Management Section */}
        <div style={{ 
          marginBottom: "2rem", 
          padding: "1.5rem", 
          backgroundColor: "#ffffff", 
          borderRadius: "0.75rem", 
          border: "1px solid #e2e8f0" 
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Candidates</h2>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              {candidates.length > 0 && (
                <>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleExportResults}
                    style={{ 
                      padding: "0.5rem 1rem", 
                      fontSize: "0.875rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem"
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Export Results (CSV)
                  </button>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={handleSendInvitationsToAll}
                    disabled={sendingInvitations}
                    style={{ 
                      padding: "0.5rem 1rem", 
                      fontSize: "0.875rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem"
                    }}
                  >
                    {sendingInvitations ? "Sending..." : "📧 Send Email to All"}
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn-primary"
                onClick={() => setShowAddCandidateModal(true)}
                style={{ 
                  padding: "0.5rem 1rem", 
                  fontSize: "0.875rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem"
                }}
              >
                ➕ Add Candidate
              </button>
            </div>
          </div>
          
                {candidates.length === 0 ? (
            <p style={{ color: "#64748b", fontSize: "0.875rem" }}>No candidates added yet.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Email</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Name</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Status</th>
                    <th style={{ padding: "0.75rem", textAlign: "left", fontSize: "0.875rem", fontWeight: 600, color: "#1e293b" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((candidate) => (
                    <tr key={candidate.user_id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>{candidate.email}</td>
                      <td style={{ padding: "0.75rem", fontSize: "0.875rem" }}>{candidate.name}</td>
                      <td style={{ padding: "0.75rem" }}>
                        <span style={{
                          padding: "0.25rem 0.75rem",
                          borderRadius: "9999px",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          backgroundColor: 
                            candidate.status === "completed" ? "#d1fae5" :
                            candidate.status === "started" ? "#dbeafe" :
                            candidate.status === "invited" ? "#fef3c7" :
                            "#f3f4f6",
                          color: 
                            candidate.status === "completed" ? "#065f46" :
                            candidate.status === "started" ? "#1e40af" :
                            candidate.status === "invited" ? "#92400e" :
                            "#374151",
                        }}>
                          {candidate.status || (candidate.has_submitted ? "completed" : "pending")}
                        </span>
                      </td>
                      <td style={{ padding: "0.75rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={() => handleResendInvitation(candidate.email)}
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
                        {isTestEnded && candidate.status === "completed" && (
                          <button
                            type="button"
                            onClick={() => handleSendFeedback(candidate.user_id)}
                            disabled={sendingFeedback === candidate.user_id}
                            style={{
                              padding: "0.25rem 0.75rem",
                              fontSize: "0.75rem",
                              backgroundColor: sendingFeedback === candidate.user_id ? "#94a3b8" : "#3b82f6",
                              color: "#ffffff",
                              border: "none",
                              borderRadius: "0.375rem",
                              cursor: sendingFeedback === candidate.user_id ? "not-allowed" : "pointer",
                              opacity: sendingFeedback === candidate.user_id ? 0.6 : 1,
                            }}
                          >
                            {sendingFeedback === candidate.user_id ? "Sending..." : "📧 Send Feedback"}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveCandidate(candidate.user_id)}
                          style={{
                            padding: "0.25rem 0.75rem",
                            fontSize: "0.75rem",
                            backgroundColor: "#ef4444",
                            color: "#ffffff",
                            border: "none",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                          }}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "1.5rem" }}>
          {/* Candidate List Sidebar */}
          <div>
            <div style={{
              border: "1px solid #e2e8f0",
              borderRadius: "0.75rem",
              padding: "1rem",
              backgroundColor: "#ffffff",
            }}>
              <h2 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>Candidates</h2>
              <button
                onClick={() => {
                  setSelectedCandidate(null)
                  setAnalytics(null)
                  setProctorLogs([])
                  // Clear candidate query param to trigger hook update
                  const { candidate, ...restQuery } = router.query
                  router.push({
                    pathname: router.pathname,
                    query: restQuery
                  }, undefined, { shallow: true })
                }}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: selectedCandidate === null
                    ? "2px solid #3b82f6"
                    : "1px solid #e2e8f0",
                  backgroundColor: selectedCandidate === null
                    ? "#eff6ff"
                    : "#ffffff",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  marginBottom: "0.5rem",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                }}
                onMouseEnter={(e) => {
                  if (selectedCandidate !== null) {
                    e.currentTarget.style.backgroundColor = "#f8fafc"
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedCandidate !== null) {
                    e.currentTarget.style.backgroundColor = "#ffffff"
                  }
                }}
              >
                📊 Overall Analytics
              </button>
              {candidates.length === 0 ? (
                <p style={{ fontSize: "0.875rem", color: "#64748b" }}>
                    No candidates found
                  </p>
                ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {candidates.map((candidate) => (
                      <button
                        key={candidate.user_id}
                        onClick={() => handleCandidateSelect(candidate.user_id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                        border: selectedCandidate === candidate.user_id
                          ? "2px solid #3b82f6"
                          : "1px solid #e2e8f0",
                        backgroundColor: selectedCandidate === candidate.user_id
                          ? "#eff6ff"
                          : "#ffffff",
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedCandidate !== candidate.user_id) {
                          e.currentTarget.style.backgroundColor = "#f8fafc"
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedCandidate !== candidate.user_id) {
                          e.currentTarget.style.backgroundColor = "#ffffff"
                        }
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: "0.875rem" }}>{candidate.name}</div>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: "0.25rem" }}>
                          {candidate.email}
                        </div>
                        {candidate.has_submitted && (
                        <div style={{ fontSize: "0.75rem", color: "#10b981", marginTop: "0.25rem", fontWeight: 600 }}>
                          Score: {candidate.submission_score || 0}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
            </div>
          </div>

          {/* Analytics Content */}
          <div data-analytics-content>
            {loadingAnalytics ? (
              <div style={{
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                padding: "3rem",
                textAlign: "center",
                backgroundColor: "#ffffff",
              }}>
                  <div>Loading analytics...</div>
              </div>
            ) : !selectedCandidate ? (
              // Overall Analytics View
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

                <div style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  backgroundColor: "#ffffff",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
                      Overall Test Performance
                    </h2>
                    <Link
                      href={`/dsa/tests/${testId}/live-dashboard`}
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Total Candidates</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{totalCandidates}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Submitted</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                        {submittedCount} / {totalCandidates}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Average Score</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                        {avgScore.toFixed(1)}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Passed</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>{passedCount}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginTop: "1rem" }}>
                    <div style={{
                      padding: "1rem",
                      backgroundColor: "#d1fae5",
                      borderRadius: "0.5rem",
                      border: "1px solid #10b981",
                    }}>
                      <div style={{ fontSize: "0.875rem", color: "#065f46", marginBottom: "0.25rem", fontWeight: 600 }}>Passed</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669" }}>{passedCount}</div>
                    </div>
                    <div style={{
                      padding: "1rem",
                      backgroundColor: "#fee2e2",
                      borderRadius: "0.5rem",
                      border: "1px solid #ef4444",
                    }}>
                      <div style={{ fontSize: "0.875rem", color: "#991b1b", marginBottom: "0.25rem", fontWeight: 600 }}>Failed</div>
                      <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#dc2626" }}>{failedCount}</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : analyticsError ? (
              <div style={{
                border: "1px solid #ef4444",
                borderRadius: "0.75rem",
                padding: "3rem",
                textAlign: "center",
                backgroundColor: "#fee2e2",
              }}>
                <p style={{ color: "#991b1b", fontWeight: 600, marginBottom: "0.5rem" }}>Error loading analytics</p>
                <p style={{ color: "#dc2626", fontSize: "0.875rem" }}>
                  {analyticsError instanceof Error ? analyticsError.message : 'Failed to fetch analytics data'}
                </p>
                <button
                  onClick={() => refetchAnalytics()}
                  style={{
                    marginTop: "1rem",
                    padding: "0.5rem 1rem",
                    backgroundColor: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  Retry
                </button>
              </div>
            ) : !analytics ? (
              <div style={{
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                padding: "3rem",
                textAlign: "center",
                backgroundColor: "#ffffff",
              }}>
                <p style={{ color: "#64748b" }}>Select a candidate to view their analytics</p>
              </div>
            ) : !analytics.submission ? (
              <div style={{
                border: "1px solid #e2e8f0",
                borderRadius: "0.75rem",
                padding: "3rem",
                textAlign: "center",
                backgroundColor: "#ffffff",
              }}>
                <p style={{ color: "#64748b" }}>
                    {analytics.candidate.name} has not submitted the test yet.
                  </p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                {/* Candidate Information */}
                <div style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  backgroundColor: "#ffffff",
                }}>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
                    Candidate Information
                  </h2>
                  <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                    {/* Reference Photo */}
                    {referencePhoto && (
                      <div style={{ 
                        flexShrink: 0,
                        width: "150px",
                        height: "150px",
                        borderRadius: "0.5rem",
                        overflow: "hidden",
                        border: "2px solid #e2e8f0",
                        backgroundColor: "#ffffff"
                      }}>
                        <img 
                          src={referencePhoto} 
                          alt="Reference Photo" 
                          style={{ 
                            width: "100%", 
                            height: "100%", 
                            objectFit: "cover" 
                          }} 
                        />
                      </div>
                    )}
                    {/* Candidate Details */}
                    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", minWidth: "300px" }}>
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Name</div>
                        <div style={{ fontSize: "1rem", fontWeight: 600 }}>{analytics.candidate.name}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Email</div>
                        <div style={{ fontSize: "1rem", fontWeight: 600 }}>{analytics.candidate.email}</div>
                      </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Total Score</div>
                      <div style={{ fontSize: "1.5rem", fontWeight: 700 }}>
                        {analytics.submission.score}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Started</div>
                      <div style={{ fontSize: "1rem" }}>{formatDate(analytics.submission.started_at)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Submitted</div>
                      <div style={{ fontSize: "1rem" }}>{formatDate(analytics.submission.submitted_at)}</div>
                    </div>
                    </div>
                  </div>
                </div>

                {/* Candidate Requirements Section */}
                {analytics.candidateInfo && (
                  <div style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                    backgroundColor: "#ffffff",
                  }}>
                    <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
                      Candidate Requirements
                    </h2>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem" }}>
                      {analytics.candidateInfo.phone && (
                        <div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Phone</div>
                          <div style={{ fontSize: "1rem", fontWeight: 600 }}>{analytics.candidateInfo.phone}</div>
                        </div>
                      )}
                      {analytics.candidateInfo.linkedIn && (
                        <div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>LinkedIn</div>
                          <a 
                            href={analytics.candidateInfo.linkedIn} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ fontSize: "1rem", fontWeight: 600, color: "#3b82f6", textDecoration: "none" }}
                          >
                            {analytics.candidateInfo.linkedIn}
                          </a>
                        </div>
                      )}
                      {analytics.candidateInfo.github && (
                        <div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>GitHub</div>
                          <a 
                            href={analytics.candidateInfo.github} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{ fontSize: "1rem", fontWeight: 600, color: "#3b82f6", textDecoration: "none" }}
                          >
                            {analytics.candidateInfo.github}
                          </a>
                        </div>
                      )}
                      {analytics.candidateInfo.hasResume !== undefined && (
                        <div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Resume</div>
                          {analytics.candidateInfo.hasResume ? (
                            <button
                              type="button"
                              onClick={() => fetchResume(analytics.candidate.email)}
                              disabled={loadingResume}
                              style={{
                                fontSize: "1rem",
                                fontWeight: 600,
                                color: "#3b82f6",
                                background: "none",
                                border: "none",
                                cursor: loadingResume ? "not-allowed" : "pointer",
                                textDecoration: "underline",
                                padding: 0,
                                opacity: loadingResume ? 0.6 : 1,
                              }}
                            >
                              {loadingResume ? "Loading..." : "View Resume"}
                            </button>
                          ) : (
                            <div style={{ fontSize: "1rem", fontWeight: 600 }}>Not Provided</div>
                          )}
                        </div>
                      )}
                      {analytics.candidateInfo?.customFields && Object.keys(analytics.candidateInfo.customFields).map(key => (
                        <div key={key}>
                          <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>{key}</div>
                          <div style={{ fontSize: "1rem", fontWeight: 600 }}>{analytics.candidateInfo?.customFields?.[key]}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Overall Performance Summary */}
                <div style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  backgroundColor: "#ffffff",
                }}>
                  <h2 style={{ fontSize: "1.25rem", fontWeight: 600, marginBottom: "1rem" }}>
                      {analytics.candidate.name} - Overall Performance
                    </h2>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
                      <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Total Score</div>
                      <div style={{ fontSize: "2rem", fontWeight: 700 }}>{analytics.submission.score} / 100</div>
                      </div>
                      <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Started</div>
                      <div style={{ fontSize: "1rem" }}>{formatDate(analytics.submission.started_at)}</div>
                      </div>
                      <div>
                      <div style={{ fontSize: "0.875rem", color: "#64748b", marginBottom: "0.25rem" }}>Submitted</div>
                      <div style={{ fontSize: "1rem" }}>{formatDate(analytics.submission.submitted_at)}</div>
                      </div>
                    </div>

                    {/* Overall Score Deduction Reasons */}
                    {(() => {
                      // Score is already normalized to 100 in backend, so max is always 100
                      const maxPossibleScore = 100
                      const actualScore = analytics.submission.score
                      const scoreDifference = maxPossibleScore - actualScore
                      
                      const allDeductionReasons: string[] = []
                      const allImprovementSuggestions: string[] = []
                      
                      analytics.question_analytics.forEach((qa, index) => {
                        if (qa.ai_feedback?.overall_score !== undefined && qa.ai_feedback.overall_score < 100) {
                          const questionDeduction = 100 - qa.ai_feedback.overall_score
                          
                          if (qa.ai_feedback.deduction_reasons && qa.ai_feedback.deduction_reasons.length > 0) {
                            qa.ai_feedback.deduction_reasons.forEach((reason: string) => {
                              allDeductionReasons.push(`Question ${index + 1}: ${reason} (-${questionDeduction} points)`)
                            })
                          } else if (qa.ai_feedback.scoring_basis) {
                            const basis = qa.ai_feedback.scoring_basis
                            const reasons: string[] = []
                            
                            if (basis.base_score && basis.base_score < 100) {
                              reasons.push(`Base score reduced to ${basis.base_score}/100 due to test pass rate: ${basis.pass_rate || 'N/A'}`)
                            }
                            
                            if (basis.efficiency_bonus && basis.efficiency_bonus < 0) {
                              reasons.push(`Efficiency penalty: ${basis.efficiency_bonus} points (Time: ${basis.time_complexity}, Space: ${basis.space_complexity})`)
                            }
                            
                            if (basis.code_quality_adjustment && basis.code_quality_adjustment < 0) {
                              reasons.push(`Code quality adjustment: ${basis.code_quality_adjustment} points`)
                            }
                            
                            if (reasons.length > 0) {
                              reasons.forEach(reason => {
                                allDeductionReasons.push(`Question ${index + 1}: ${reason} (-${questionDeduction} points)`)
                              })
                            } else {
                              const effBonus = basis.efficiency_bonus || 0
                              const codeQualAdj = basis.code_quality_adjustment || 0
                              allDeductionReasons.push(
                                `Question ${index + 1}: Score ${qa.ai_feedback.overall_score}/100 calculated as Base (${basis.base_score || 'N/A'}) + Efficiency (${effBonus >= 0 ? '+' : ''}${effBonus}) + Code Quality (${codeQualAdj >= 0 ? '+' : ''}${codeQualAdj}) = ${qa.ai_feedback.overall_score} (-${questionDeduction} points)`
                              )
                            }
                          } else {
                            allDeductionReasons.push(`Question ${index + 1}: Score ${qa.ai_feedback.overall_score}/100 (-${questionDeduction} points)`)
                          }
                          
                          if (qa.ai_feedback.improvement_suggestions && qa.ai_feedback.improvement_suggestions.length > 0) {
                            qa.ai_feedback.improvement_suggestions.forEach((suggestion: string) => {
                              allImprovementSuggestions.push(`Question ${index + 1}: ${suggestion}`)
                            })
                          }
                        }
                      })

                      if (scoreDifference > 0) {
                        return (
                        <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                          <div style={{ backgroundColor: "#fee2e2", border: "2px solid #ef4444", borderRadius: "0.5rem", padding: "1rem" }}>
                            <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#991b1b", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <AlertTriangle style={{ width: "20px", height: "20px" }} />
                                Overall Score Deduction ({scoreDifference} points deducted)
                              </h4>
                            <div style={{ fontSize: "0.875rem", fontWeight: 600, color: "#991b1b", marginBottom: "0.75rem", backgroundColor: "#fecaca", padding: "0.5rem 0.75rem", borderRadius: "0.375rem" }}>
                                Total Score: {actualScore}/{maxPossibleScore}
                              </div>
                              {allDeductionReasons.length > 0 ? (
                              <ul style={{ fontSize: "0.875rem", color: "#991b1b", listStyle: "disc", paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem", fontWeight: 500 }}>
                                  {allDeductionReasons.map((reason, idx) => (
                                  <li key={idx} style={{ lineHeight: "1.5" }}>{reason}</li>
                                  ))}
                                </ul>
                              ) : (
                              <div style={{ fontSize: "0.875rem", color: "#991b1b" }}>
                                <p style={{ fontWeight: 500, marginBottom: "0.5rem" }}>Score breakdown by question:</p>
                                <ul style={{ listStyle: "disc", paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                                    {analytics.question_analytics.map((qa, idx) => {
                                      if (qa.ai_feedback?.overall_score !== undefined && qa.ai_feedback.overall_score < 100) {
                                        const deduction = 100 - qa.ai_feedback.overall_score
                                        return (
                                          <li key={idx}>
                                            Question {idx + 1}: {qa.ai_feedback.overall_score}/100 (-{deduction} points)
                                          </li>
                                        )
                                      }
                                      return null
                                    })}
                                  </ul>
                                </div>
                              )}
                            </div>

                            {allImprovementSuggestions.length > 0 && (
                            <div style={{ backgroundColor: "#fef3c7", border: "2px solid #fbbf24", borderRadius: "0.5rem", padding: "1rem" }}>
                              <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#92400e", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Lightbulb style={{ width: "20px", height: "20px" }} />
                                  Overall Improvement Suggestions
                                </h4>
                              <ul style={{ fontSize: "0.875rem", color: "#92400e", listStyle: "disc", paddingLeft: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem", fontWeight: 500 }}>
                                  {allImprovementSuggestions.map((suggestion, idx) => (
                                  <li key={idx} style={{ lineHeight: "1.5" }}>{suggestion}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )
                      }
                      return null
                    })()}
                </div>

                {/* Proctoring Logs Section */}
                <div style={{
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.75rem",
                  padding: "1.5rem",
                  backgroundColor: "#ffffff",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <AlertTriangle style={{ width: "20px", height: "20px", color: "#f59e0b" }} />
                      <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Proctoring Logs</h2>
                        {proctorLogs.length > 0 && (
                        <span style={{ padding: "0.25rem 0.75rem", fontSize: "0.75rem", fontWeight: 600, backgroundColor: "#fee2e2", color: "#991b1b", borderRadius: "9999px" }}>
                            {proctorLogs.length} {proctorLogs.length === 1 ? 'violation' : 'violations'}
                          </span>
                        )}
                      </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <button
                        type="button"
                        className="btn-secondary"
                          onClick={() => setShowProctorLogs(!showProctorLogs)}
                          disabled={loadingProctorLogs}
                        style={{ marginTop: 0 }}
                        >
                          {loadingProctorLogs ? 'Loading...' : showProctorLogs ? 'Hide Logs' : 'Show Logs'}
                      </button>
                      </div>
                    </div>

                    {loadingProctorLogs ? (
                    <div style={{ textAlign: "center", padding: "1rem", color: "#64748b" }}>
                        Loading proctoring logs...
                      </div>
                    ) : proctorLogs.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "1rem", color: "#64748b" }}>
                        No proctoring violations detected
                      </div>
                    ) : showProctorLogs ? (
                      <ProctorLogsReview 
                        logs={proctorLogs}
                        candidateName={analytics.candidate?.name || analytics.candidate?.email}
                      />
                    ) : null}
                </div>

                {/* Question Analytics */}
                {analytics.question_analytics.map((qa, index) => {
                  // Check if this is a SQL question
                  const isSQL = isSQLQuestion(qa.language);
                  
                  // Use SQL-specific component for SQL questions
                  if (isSQL) {
                    return (
                      <SQLAnalyticsView
                        key={qa.question_id}
                        questionTitle={`Question ${index + 1}: ${qa.question_title}`}
                        status={qa.status || ''}
                        passedTestcases={qa.passed_testcases}
                        totalTestcases={qa.total_testcases}
                        code={qa.code || ''}
                        aiFeedback={qa.ai_feedback}
                        testResults={qa.test_results}
                        executionTime={qa.execution_time}
                        memoryUsed={qa.memory_used}
                      />
                    )
                  }
                  
                  // Non-SQL questions use the full analytics view
                  return (
                  <div key={qa.question_id} style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    padding: "1.5rem",
                    backgroundColor: "#ffffff",
                  }}>
                    <h3 style={{ fontSize: "1.125rem", fontWeight: 600, marginBottom: "1rem" }}>
                        Question {index + 1}: {qa.question_title}
                      </h3>
                      
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "1rem", marginBottom: "1rem" }}>
                        <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Status</div>
                        <div style={{ fontSize: "0.875rem", fontWeight: 500, color: qa.status === 'accepted' ? "#059669" : "#dc2626" }}>
                            {qa.status}
                          </div>
                        </div>
                        <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Test Cases</div>
                        <div style={{ fontSize: "0.875rem" }}>
                            {qa.passed_testcases} / {qa.total_testcases} passed
                          </div>
                        </div>
                        <div>
                        <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Language</div>
                        <div style={{ fontSize: "0.875rem" }}>{qa.language}</div>
                        </div>
                        {qa.execution_time && (
                          <div>
                          <div style={{ fontSize: "0.875rem", color: "#64748b" }}>Execution Time</div>
                          <div style={{ fontSize: "0.875rem" }}>{qa.execution_time}ms</div>
                          </div>
                        )}
                      </div>

                      {/* AI Feedback */}
                      {qa.ai_feedback && (
                      <div style={{ marginTop: "1.5rem", border: "1px solid #3b82f6", borderRadius: "0.5rem", backgroundColor: "#eff6ff", overflow: "hidden" }}>
                        <div style={{ padding: "0.75rem 1rem", backgroundColor: "#dbeafe", borderBottom: "1px solid #3b82f6" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <Lightbulb style={{ width: "20px", height: "20px", color: "#3b82f6" }} />
                            <span style={{ fontWeight: 600, color: "#1e40af" }}>AI Feedback</span>
                              {qa.ai_feedback.overall_score !== undefined && (
                              <span style={{ fontSize: "1.125rem", fontWeight: 700, color: qa.ai_feedback.overall_score >= 80 ? "#059669" : qa.ai_feedback.overall_score >= 60 ? "#f59e0b" : "#dc2626" }}>
                                  Score: {qa.ai_feedback.overall_score}/100
                                </span>
                              )}
                            </div>
                          </div>
                          
                        <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
                            {/* Test Case Breakdown - Simplified for SQL */}
                            {isSQL ? (
                              // SQL: Show only single test case result
                              qa.ai_feedback.test_breakdown && (
                                <div style={{ backgroundColor: "#1e293b", borderRadius: "0.5rem", padding: "0.75rem", border: "1px solid #3b82f6" }}>
                                  <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <CheckCircle2 style={{ width: "12px", height: "12px" }} />
                                    Test Case Results
                                  </h4>
                                  <div style={{ backgroundColor: "#0f172a", borderRadius: "0.375rem", padding: "0.5rem" }}>
                                    <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>Test Cases</div>
                                    <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "#60a5fa" }}>
                                      {qa.passed_testcases} / {qa.total_testcases} passed
                                    </div>
                                  </div>
                                </div>
                              )
                            ) : (
                              // Non-SQL: Show full breakdown with public/hidden
                              qa.ai_feedback.test_breakdown && (
                                <div style={{ backgroundColor: "#1e293b", borderRadius: "0.5rem", padding: "0.75rem", border: "1px solid #3b82f6" }}>
                                  <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <CheckCircle2 style={{ width: "12px", height: "12px" }} />
                                    Test Case Results
                                  </h4>
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem", fontSize: "0.875rem" }}>
                                    <div style={{ backgroundColor: "#0f172a", borderRadius: "0.375rem", padding: "0.5rem" }}>
                                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>Public Test Cases</div>
                                      <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "#60a5fa" }}>
                                        {qa.ai_feedback.test_breakdown?.public_passed ?? 0}/{qa.ai_feedback.test_breakdown?.public_total ?? 0}
                                      </div>
                                    </div>
                                    <div style={{ backgroundColor: "#0f172a", borderRadius: "0.375rem", padding: "0.5rem" }}>
                                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>Hidden Test Cases</div>
                                      <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "#a78bfa" }}>
                                        {qa.ai_feedback.test_breakdown?.hidden_passed ?? 0}/{qa.ai_feedback.test_breakdown?.hidden_total ?? 0}
                                      </div>
                                    </div>
                                    <div style={{ gridColumn: "span 2", backgroundColor: "#0f172a", borderRadius: "0.375rem", padding: "0.5rem" }}>
                                      <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginBottom: "0.25rem" }}>Total</div>
                                      <div style={{ fontSize: "1.125rem", fontWeight: 600, color: "#34d399" }}>
                                        {(qa.ai_feedback.test_breakdown?.public_passed ?? 0) + (qa.ai_feedback.test_breakdown?.hidden_passed ?? 0)}/
                                        {(qa.ai_feedback.test_breakdown?.public_total ?? 0) + (qa.ai_feedback.test_breakdown?.hidden_total ?? 0)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )
                            )}

                            {/* Complexity - Hide for SQL */}
                            {!isSQL && qa.ai_feedback.efficiency && (
                            <div style={{ backgroundColor: "#1e293b", borderRadius: "0.5rem", padding: "0.75rem" }}>
                              <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <TrendingUp style={{ width: "12px", height: "12px" }} />
                                Complexity
                              </h4>
                              <div style={{ display: "flex", alignItems: "center", gap: "1rem", fontSize: "0.875rem" }}>
                                <div>
                                  <span style={{ color: "#94a3b8" }}>Time: </span>
                                  <span style={{ fontWeight: 600, color: "#60a5fa" }}>
                                    {qa.ai_feedback.efficiency.time_complexity || 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span style={{ color: "#94a3b8" }}>Space: </span>
                                  <span style={{ fontWeight: 600, color: "#a78bfa" }}>
                                    {qa.ai_feedback.efficiency.space_complexity || 'N/A'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            )}

                            {/* AI Feedback - Simplified for SQL, Full for others */}
                            {isSQL ? (
                              // SQL: Show only feedback summary
                              qa.ai_feedback.feedback_summary && (
                                <div style={{ backgroundColor: "#1e293b", borderRadius: "0.5rem", padding: "0.75rem" }}>
                                  <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                    <Lightbulb style={{ width: "12px", height: "12px" }} />
                                    AI Feedback
                                  </h4>
                                  <p style={{ fontSize: "0.875rem", color: "#cbd5e1", lineHeight: "1.6" }}>
                                    {qa.ai_feedback.feedback_summary}
                                  </p>
                                </div>
                              )
                            ) : (
                              // Non-SQL: Show all feedback sections
                              <>
                                {/* AI Feedback Summary */}
                                {qa.ai_feedback.feedback_summary && (
                                  <div style={{ backgroundColor: "#1e293b", borderRadius: "0.5rem", padding: "0.75rem" }}>
                                    <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                      <Lightbulb style={{ width: "12px", height: "12px" }} />
                                      AI Feedback
                                    </h4>
                                    <p style={{ fontSize: "0.875rem", color: "#cbd5e1", lineHeight: "1.6" }}>
                                      {qa.ai_feedback.feedback_summary}
                                    </p>
                                  </div>
                                )}

                                {/* Code Quality */}
                                {qa.ai_feedback.code_quality && qa.ai_feedback.code_quality.comments && (
                                  <div style={{ backgroundColor: "#1e293b", borderRadius: "0.5rem", padding: "0.75rem" }}>
                                    <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem" }}>
                                      Code Quality {qa.ai_feedback.code_quality.score !== undefined && `(${qa.ai_feedback.code_quality.score}/100)`}
                                    </h4>
                                    <p style={{ fontSize: "0.875rem", color: "#cbd5e1", lineHeight: "1.6" }}>
                                      {qa.ai_feedback.code_quality.comments}
                                    </p>
                                  </div>
                                )}

                                {/* Efficiency Comments */}
                                {qa.ai_feedback.efficiency && qa.ai_feedback.efficiency.comments && (
                                  <div style={{ backgroundColor: "#1e293b", borderRadius: "0.5rem", padding: "0.75rem" }}>
                                    <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem" }}>
                                      Efficiency Analysis
                                    </h4>
                                    <p style={{ fontSize: "0.875rem", color: "#cbd5e1", lineHeight: "1.6" }}>
                                      {qa.ai_feedback.efficiency.comments}
                                    </p>
                                  </div>
                                )}

                                {/* Correctness Comments */}
                                {qa.ai_feedback.correctness && qa.ai_feedback.correctness.comments && (
                                  <div style={{ backgroundColor: "#1e293b", borderRadius: "0.5rem", padding: "0.75rem" }}>
                                    <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem" }}>
                                      Correctness {qa.ai_feedback.correctness.score !== undefined && `(${qa.ai_feedback.correctness.score}/100)`}
                                    </h4>
                                    <p style={{ fontSize: "0.875rem", color: "#cbd5e1", lineHeight: "1.6" }}>
                                      {qa.ai_feedback.correctness.comments}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}

                            {/* Strengths */}
                            {qa.ai_feedback.strengths && qa.ai_feedback.strengths.length > 0 && (
                            <div style={{ backgroundColor: "#064e3b", borderRadius: "0.5rem", padding: "0.75rem", border: "1px solid #10b981" }}>
                              <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#6ee7b7", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <CheckCircle2 style={{ width: "12px", height: "12px" }} />
                                  Strengths
                                </h4>
                              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "#a7f3d0", lineHeight: "1.8" }}>
                                  {qa.ai_feedback.strengths.map((strength: string, idx: number) => (
                                    <li key={idx} style={{ marginBottom: "0.5rem" }}>{strength}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Areas for Improvement */}
                            {qa.ai_feedback.areas_for_improvement && qa.ai_feedback.areas_for_improvement.length > 0 && (
                            <div style={{ backgroundColor: "#7c2d12", borderRadius: "0.5rem", padding: "0.75rem", border: "1px solid #f97316" }}>
                              <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#fdba74", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <AlertTriangle style={{ width: "12px", height: "12px" }} />
                                  Areas for Improvement
                                </h4>
                              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "#fed7aa", lineHeight: "1.8" }}>
                                  {qa.ai_feedback.areas_for_improvement.map((area: string, idx: number) => (
                                    <li key={idx} style={{ marginBottom: "0.5rem" }}>{area}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Improvement Suggestions */}
                            {qa.ai_feedback.improvement_suggestions && qa.ai_feedback.improvement_suggestions.length > 0 && (
                            <div style={{ backgroundColor: "#1e3a8a", borderRadius: "0.5rem", padding: "0.75rem", border: "1px solid #3b82f6" }}>
                              <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#93c5fd", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Lightbulb style={{ width: "12px", height: "12px" }} />
                                  Improvement Suggestions
                                </h4>
                              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "#bfdbfe", lineHeight: "1.8" }}>
                                  {qa.ai_feedback.improvement_suggestions.map((suggestion: string, idx: number) => (
                                    <li key={idx} style={{ marginBottom: "0.5rem" }}>{suggestion}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Suggestions (if different from improvement_suggestions) */}
                            {qa.ai_feedback.suggestions && qa.ai_feedback.suggestions.length > 0 && (
                            <div style={{ backgroundColor: "#1e3a8a", borderRadius: "0.5rem", padding: "0.75rem", border: "1px solid #3b82f6" }}>
                              <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#93c5fd", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <Lightbulb style={{ width: "12px", height: "12px" }} />
                                  Suggestions
                                </h4>
                              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "#bfdbfe", lineHeight: "1.8" }}>
                                  {qa.ai_feedback.suggestions.map((suggestion: string, idx: number) => (
                                    <li key={idx} style={{ marginBottom: "0.5rem" }}>{suggestion}</li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Deduction Reasons */}
                            {qa.ai_feedback.deduction_reasons && qa.ai_feedback.deduction_reasons.length > 0 && (
                            <div style={{ backgroundColor: "#7f1d1d", borderRadius: "0.5rem", padding: "0.75rem", border: "1px solid #ef4444" }}>
                              <h4 style={{ fontSize: "0.75rem", fontWeight: 600, color: "#fca5a5", marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <AlertTriangle style={{ width: "12px", height: "12px" }} />
                                  Deduction Reasons
                                </h4>
                              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "#fecaca", lineHeight: "1.8" }}>
                                  {qa.ai_feedback.deduction_reasons.map((reason: string, idx: number) => (
                                    <li key={idx} style={{ marginBottom: "0.5rem" }}>{reason}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Code Display */}
                    <details style={{ marginTop: "1rem" }}>
                      <summary style={{ cursor: "pointer", fontSize: "0.875rem", fontWeight: 500, color: "#64748b" }}>
                          View {isSQL ? 'Query' : 'Code'}
                        </summary>
                      <pre style={{ marginTop: "0.5rem", padding: "1rem", backgroundColor: "#1e293b", borderRadius: "0.5rem", overflowX: "auto", fontSize: "0.75rem", color: "#e2e8f0" }}>
                          <code>{qa.code}</code>
                        </pre>
                      </details>
                  </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Candidate Modal */}
      {showAddCandidateModal && (
        <div style={{
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
            setShowAddCandidateModal(false)
            setNewCandidateName("")
            setNewCandidateEmail("")
            setSelectedEmployee(null)
            setSelectedEmployees([])
            setEmployeeSearch("")
            setEmailError(null)
          }
        }}
        >
          <div style={{
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
            <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1.5rem", color: "#2D7A52" }}>
              Add Candidate
            </h2>
            
            {/* Bulk Upload Section */}
            <div style={{ 
              marginBottom: "1.5rem", 
              padding: "1rem", 
              border: "1px solid #A8E8BC", 
              borderRadius: "0.5rem",
              backgroundColor: "#f8f9fa"
            }}>
              <h4 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: "0.5rem", color: "#1a1625" }}>
                Bulk Upload (CSV)
              </h4>
              <p style={{ fontSize: "0.75rem", color: "#6b7280", marginBottom: "0.75rem" }}>
                Upload a CSV file with 'name' and 'email' columns
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  
                  if (!testId || typeof testId !== 'string') return
                  
                  const formData = new FormData()
                  formData.append('file', file)
                  
                  try {
                    const response = await bulkAddCandidatesMutation.mutateAsync({
                      testId: testId!,
                      formData,
                    })
                    
                    const responseData = response.data
                    alert(
                      `Bulk upload completed!\n` +
                      `Success: ${responseData?.success_count || 0}\n` +
                      `Failed: ${responseData?.failed_count || 0}\n` +
                      `Duplicates: ${responseData?.duplicate_count || 0}`
                    )
                    
                    // Refresh candidates list
                    await refetchCandidates()
                    
                    // Reset file input
                    e.target.value = ''
                    
                    // Close modal if successful
                    if (response.data.success_count > 0) {
                      setShowAddCandidateModal(false)
                    }
                  } catch (error: any) {
                    alert(error.response?.data?.detail || error.response?.data?.message || 'Failed to upload CSV')
                    e.target.value = ''
                  }
                }}
                style={{
                  width: "100%",
                  padding: "0.5rem",
                  border: "1px solid #A8E8BC",
                  borderRadius: "0.375rem",
                  backgroundColor: "#ffffff",
                  cursor: "pointer",
                  fontSize: "0.875rem"
                }}
              />
            </div>
            
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "0.5rem", 
              marginBottom: "1rem",
              padding: "0.5rem 0"
            }}>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}></div>
              <span style={{ fontSize: "0.75rem", color: "#64748b" }}>OR</span>
              <div style={{ flex: 1, height: "1px", backgroundColor: "#e2e8f0" }}></div>
            </div>
            
            {/* Manual Add Section - now driven by Employee search/selection */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                  Search employees in your organization <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="text"
                  value={employeeSearch}
                  onChange={(e) => {
                    setEmployeeSearch(e.target.value)
                    setEmailError(null)
                  }}
                  placeholder="Search by name or email"
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
              
              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  border: "1px solid #e2e8f0",
                  borderRadius: "0.5rem",
                  padding: "0.5rem",
                  backgroundColor: "#f8fafc",
                }}
              >
                {employeesLoading && (
                  <p style={{ fontSize: "0.875rem", color: "#64748b", padding: "0.5rem" }}>
                    Loading employees...
                  </p>
                )}
                {!employeesLoading && (!employeesData?.employees || employeesData.employees.length === 0) && (
                  <p style={{ fontSize: "0.875rem", color: "#64748b", padding: "0.5rem" }}>
                    No employees found. Try a different search.
                  </p>
                )}
                {!employeesLoading && employeesData?.employees && employeesData.employees.length > 0 && (
                  <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                    {employeesData.employees.map((emp) => {
                      const isSelected = selectedEmployees.some(e => e.aaptorId === emp.aaptorId)
                      return (
                        <li
                          key={emp.aaptorId}
                          onClick={() => handleEmployeeToggle(emp)}
                          style={{
                            padding: "0.5rem 0.75rem",
                            marginBottom: "0.25rem",
                            borderRadius: "0.375rem",
                            cursor: "pointer",
                            backgroundColor: isSelected ? "#dcfce7" : "transparent",
                            border: isSelected ? "1px solid #22c55e" : "1px solid transparent",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.75rem",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleEmployeeToggle(emp)}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: "1.125rem",
                              height: "1.125rem",
                              cursor: "pointer",
                              accentColor: "#22c55e",
                            }}
                          />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "#0f172a" }}>
                              {emp.name || emp.email}
                            </div>
                            <div style={{ fontSize: "0.8rem", color: "#64748b" }}>
                              {emp.email} &nbsp;•&nbsp; Aaptor ID: {emp.aaptorId}
                            </div>
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              {selectedEmployees.length > 0 && (
                <div style={{ fontSize: "0.875rem", color: "#334155", marginTop: "0.5rem", padding: "0.75rem", backgroundColor: "#f0fdf4", borderRadius: "0.5rem", border: "1px solid #22c55e" }}>
                  <strong>Selected ({selectedEmployees.length}):</strong>
                  <ul style={{ margin: "0.5rem 0 0 0", paddingLeft: "1.25rem", listStyle: "disc" }}>
                    {selectedEmployees.map((emp) => (
                      <li key={emp.aaptorId} style={{ marginBottom: "0.25rem" }}>
                        <strong>{emp.name || emp.email}</strong> ({emp.email}) &nbsp;•&nbsp; Aaptor ID: {emp.aaptorId}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

                {emailError && (
                  <p style={{ color: "#ef4444", fontSize: "0.875rem", marginTop: "0.25rem" }}>
                    {emailError}
                  </p>
                )}
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowAddCandidateModal(false)
                    setNewCandidateName("")
                    setNewCandidateEmail("")
                    setSelectedEmployee(null)
                    setSelectedEmployees([])
                    setEmployeeSearch("")
                    setEmailError(null)
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
                  disabled={addingCandidate || (selectedEmployees.length === 0 && !selectedEmployee)}
                  style={{ marginTop: 0 }}
                >
                  {addingCandidate 
                    ? `Adding... (${selectedEmployees.length > 0 ? selectedEmployees.length : 1})` 
                    : selectedEmployees.length > 0 
                      ? `Add ${selectedEmployees.length} Candidate${selectedEmployees.length > 1 ? 's' : ''}`
                      : "Add Candidate"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Template Edit Modal */}
      {showEmailTemplateModal && (
        <div style={{
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
            setShowEmailTemplateModal(false)
          }
        }}
        >
          <div style={{
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
            <h2 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1.5rem", color: "#2D7A52" }}>
              Edit Email Template
            </h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
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
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
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
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
                  Message <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <textarea
                  value={emailTemplate.message}
                  onChange={(e) => setEmailTemplate({ ...emailTemplate, message: e.target.value })}
                  placeholder="You have been invited to take a DSA test. Please click the link below to start."
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
                  Available placeholders: {"{{candidate_name}}"}, {"{{candidate_email}}"}, {"{{exam_url}}"}, {"{{company_name}}"}
                </p>
              </div>
              
              <div>
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
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
                <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#1e293b" }}>
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
              
              <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1rem" }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowEmailTemplateModal(false)
                    // Reset to saved template
                    if (testInfo?.invitationTemplate) {
                      setEmailTemplate(testInfo.invitationTemplate)
                    }
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

      {/* Live Proctoring Dashboard */}
      {showLiveProctoring && testId && typeof testId === 'string' && session?.user && (
        <LiveProctoringDashboard
          isOpen={showLiveProctoring}
          onClose={() => setShowLiveProctoring(false)}
          assessmentId={testId}
          adminId={session.user.email || session.user.id || 'admin'}
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
  )
}

// Server-side authentication check
export const getServerSideProps: GetServerSideProps = requireAuth
