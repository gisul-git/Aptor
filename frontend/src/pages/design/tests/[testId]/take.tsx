/**
 * Design Assessment - Candidate Take Page
 * Route: /design/tests/[testId]/take
 * 
 * Supports multiple questions with Next/Previous navigation
 * Matches AIML competency flow
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { PenpotEventTracker } from '../../../utils/penpotEventTracker';

export default function DesignAssessmentTakePage() {
  const router = useRouter();
  const { testId, email, name } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [workspaces, setWorkspaces] = useState<Record<string, any>>({});
  const [submittedQuestions, setSubmittedQuestions] = useState<Set<string>>(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [questionPanelCollapsed, setQuestionPanelCollapsed] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [timerStarted, setTimerStarted] = useState(false);
  const [questionTimers, setQuestionTimers] = useState<Record<string, number>>({});
  const [currentQuestionStartTime, setCurrentQuestionStartTime] = useState<Date | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design';

  // Event tracker ref
  const eventTrackerRef = useRef<PenpotEventTracker | null>(null);
  const penpotIframeRef = useRef<HTMLIFrameElement | null>(null);

  const currentQuestion = questions[currentQuestionIndex];
  const currentWorkspace = currentQuestion ? workspaces[currentQuestion._id || currentQuestion.id] : null;

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize event tracker when workspace is ready
  useEffect(() => {
    if (currentWorkspace?.session_id && penpotIframeRef.current && !eventTrackerRef.current) {
      console.log('🎯 Initializing advanced event tracker...');
      const tracker = new PenpotEventTracker(currentWorkspace.session_id, API_URL);
      tracker.init(penpotIframeRef.current);
      eventTrackerRef.current = tracker;
    }

    // Cleanup on unmount or workspace change
    return () => {
      if (eventTrackerRef.current) {
        console.log('🛑 Stopping event tracker...');
        eventTrackerRef.current.stop();
        eventTrackerRef.current = null;
      }
    };
  }, [currentWorkspace?.session_id]);

  // Cleanup event tracker on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (eventTrackerRef.current) {
        eventTrackerRef.current.stop();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Auto-start assessment on page load
  useEffect(() => {
    if (!testId) return;

    const startAssessment = async () => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Get test details with assigned questions
        const testResponse = await fetch(`${API_URL}/tests/${testId}`);
        if (!testResponse.ok) {
          throw new Error('Failed to load test details');
        }
        const testData = await testResponse.json();
        
        // Get ALL questions from the test
        const questionIds = testData.question_ids || [];
        if (questionIds.length === 0) {
          throw new Error('No questions assigned to this test');
        }
        
        // Step 2: Fetch ALL question details
        const questionPromises = questionIds.map((id: string) =>
          fetch(`${API_URL}/questions/${id}`).then(r => r.json())
        );
        const allQuestions = await Promise.all(questionPromises);
        setQuestions(allQuestions);

        // Set timer based on first question (per-question timer)
        if (allQuestions[0]?.time_limit_minutes) {
          const firstQuestionId = allQuestions[0]._id || allQuestions[0].id;
          const timeLimit = allQuestions[0].time_limit_minutes * 60;
          
          // Initialize question timers for all questions
          const initialTimers: Record<string, number> = {};
          allQuestions.forEach(q => {
            const qId = q._id || q.id;
            initialTimers[qId] = q.time_limit_minutes ? q.time_limit_minutes * 60 : 0;
          });
          setQuestionTimers(initialTimers);
          
          // Set current question timer
          setTimeLeft(timeLimit);
          setCurrentQuestionStartTime(new Date());
        }

        // Create workspace for first question
        await createWorkspaceForQuestion(allQuestions[0]);
        
        // Start timer for first question
        setTimerStarted(true);

      } catch (err: any) {
        console.error('Assessment start error:', err);
        setError(err.message || 'Failed to start assessment');
      } finally {
        setLoading(false);
      }
    };

    startAssessment();
  }, [testId]);

  // Create workspace for a specific question
  const createWorkspaceForQuestion = async (question: any) => {
    const questionId = question._id || question.id;
    
    // Check if workspace already exists
    if (workspaces[questionId]) {
      return workspaces[questionId];
    }

    try {
      const candidateEmail = (email as string) || 'candidate_' + Date.now();
      
      console.log(`Creating workspace for question ${questionId}...`);
      const startTime = Date.now();
      
      const wResponse = await fetch(`${API_URL}/workspace/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: candidateEmail,
          assessment_id: testId,
          question_id: questionId,
          test_id: testId
        })
      });

      if (!wResponse.ok) {
        throw new Error('Failed to create workspace');
      }
      
      const workspaceData = await wResponse.json();
      const elapsed = Date.now() - startTime;
      console.log(`✅ Workspace created in ${elapsed}ms`);
      
      setWorkspaces(prev => ({
        ...prev,
        [questionId]: workspaceData
      }));
      
      return workspaceData;
    } catch (err: any) {
      console.error('Workspace creation error:', err);
      throw err;
    }
  };
  
  // Pre-create workspace for next question in background
  useEffect(() => {
    if (questions.length > 0 && currentQuestionIndex < questions.length - 1) {
      const nextQuestion = questions[currentQuestionIndex + 1];
      const nextQuestionId = nextQuestion._id || nextQuestion.id;
      
      // Only pre-create if current question is submitted and next workspace doesn't exist
      if (submittedQuestions.has(currentQuestion?._id || currentQuestion?.id) && !workspaces[nextQuestionId]) {
        console.log('Pre-creating workspace for next question...');
        createWorkspaceForQuestion(nextQuestion).catch(err => {
          console.warn('Failed to pre-create workspace:', err);
        });
      }
    }
  }, [submittedQuestions, currentQuestionIndex, questions]);

  // Navigate to next question (only if current is submitted)
  const handleNextQuestion = async () => {
    const currentQuestionId = currentQuestion?._id || currentQuestion?.id;
    
    // Check if current question is submitted
    if (!submittedQuestions.has(currentQuestionId)) {
      alert('Please submit the current question before moving to the next one.');
      return;
    }
    
    if (currentQuestionIndex < questions.length - 1) {
      const nextIndex = currentQuestionIndex + 1;
      const nextQuestion = questions[nextIndex];
      const nextQuestionId = nextQuestion._id || nextQuestion.id;
      
      // Stop current timer
      setTimerStarted(false);
      
      // Create workspace for next question if it doesn't exist
      if (!workspaces[nextQuestionId]) {
        await createWorkspaceForQuestion(nextQuestion);
      }
      
      // Move to next question
      setCurrentQuestionIndex(nextIndex);
      
      // Reset timer for next question with fresh time
      if (nextQuestion?.time_limit_minutes) {
        const freshTimeLimit = nextQuestion.time_limit_minutes * 60;
        setTimeLeft(freshTimeLimit);
        setCurrentQuestionStartTime(new Date());
        
        // Start timer after state updates
        setTimeout(() => {
          setTimerStarted(true);
        }, 100);
      }
    }
  };

  // Navigate to previous question (disabled - view only)
  const handlePreviousQuestion = () => {
    // Disabled to enforce sequential flow
    alert('You cannot go back to previous questions.');
  };

  // Timer countdown (per-question timer with proper reset)
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (timerStarted && timeLeft > 0 && currentQuestionStartTime) {
      timer = setInterval(() => {
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - currentQuestionStartTime.getTime()) / 1000);
        const currentQuestionId = currentQuestion?._id || currentQuestion?.id;
        const originalTime = questionTimers[currentQuestionId] || 0;
        const remaining = Math.max(0, originalTime - elapsed);
        
        setTimeLeft(remaining);
        
        if (remaining <= 0) {
          // Auto-submit when time runs out
          handleSubmitQuestion();
          setTimerStarted(false);
        }
      }, 1000);
    }
    
    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [timerStarted, currentQuestionStartTime, currentQuestion, questionTimers]);

  // Reset timer when question changes
  useEffect(() => {
    if (currentQuestion?.time_limit_minutes && currentQuestionIndex >= 0) {
      const currentQuestionId = currentQuestion._id || currentQuestion.id;
      
      // Only reset if this is a new question (not already submitted)
      if (!submittedQuestions.has(currentQuestionId)) {
        // Stop any existing timer
        setTimerStarted(false);
        
        // Reset time for the new question
        const newTimeLimit = currentQuestion.time_limit_minutes * 60;
        setTimeLeft(newTimeLimit);
        setCurrentQuestionStartTime(new Date());
        
        // Start timer immediately
        setTimerStarted(true);
      }
    }
  }, [currentQuestionIndex, currentQuestion, submittedQuestions]);

  // Submit current question
  const handleSubmitQuestion = async () => {
    if (!currentQuestion || !currentWorkspace) return;

    const currentQuestionId = currentQuestion._id || currentQuestion.id;
    
    // Check if already submitted
    if (submittedQuestions.has(currentQuestionId)) {
      alert('This question has already been submitted.');
      return;
    }

    try {
      const candidateEmail = (email as string) || currentWorkspace?.user_id || 'candidate-' + Date.now();
      const response = await fetch(`${API_URL}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentWorkspace?.session_id,
          user_id: candidateEmail,
          question_id: currentQuestionId,
          file_id: currentWorkspace?.file_id,
          test_id: testId
        })
      });
      
      if (!response.ok) {
        throw new Error('Submission failed');
      }
      
      const result = await response.json();
      console.log('✅ Question submitted:', result);
      
      // Mark question as submitted
      setSubmittedQuestions(prev => new Set([...prev, currentQuestionId]));
      
      // Stop timer for current question
      setTimerStarted(false);
      
      // Check if all questions are completed
      if (currentQuestionIndex === questions.length - 1) {
        // Last question submitted - show success
        setShowSuccessModal(true);
      } else {
        // Auto-navigate to next question immediately
        const nextIndex = currentQuestionIndex + 1;
        const nextQuestion = questions[nextIndex];
        const nextQuestionId = nextQuestion._id || nextQuestion.id;
        
        // Create workspace for next question if it doesn't exist
        if (!workspaces[nextQuestionId]) {
          createWorkspaceForQuestion(nextQuestion).then(() => {
            // Move to next question after workspace is ready
            setCurrentQuestionIndex(nextIndex);
          });
        } else {
          // Move to next question immediately
          setCurrentQuestionIndex(nextIndex);
        }
      }
      
    } catch (error) {
      console.error('Submission error:', error);
      alert('Submission failed. Please try again.');
    }
  };

  // Submit entire test
  const handleSubmitTest = async () => {
    const currentQuestionId = currentQuestion?._id || currentQuestion?.id;
    
    // Submit current question if not already submitted
    if (currentQuestion && !submittedQuestions.has(currentQuestionId)) {
      await handleSubmitQuestion();
    } else {
      setShowSuccessModal(true);
    }
  };

  // LOADING STATE
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{
            marginTop: '16px',
            color: '#6b7280',
            fontSize: '16px'
          }}>
            Loading your design challenges...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ERROR STATE
  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f9fafb'
      }}>
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '8px',
          padding: '24px',
          maxWidth: '400px'
        }}>
          <h3 style={{
            color: '#991b1b',
            fontWeight: 600,
            marginBottom: '8px'
          }}>
            Error Loading Assessment
          </h3>
          <p style={{
            color: '#dc2626',
            marginBottom: '16px'
          }}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600
            }}
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  // SUCCESS PAGE
  if (showSuccessModal) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(to bottom right, #d1fae5, #a7f3d0)'
      }}>
        <div style={{
          textAlign: 'center',
          background: 'white',
          padding: '48px',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          maxWidth: '500px',
          width: '90%'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: '#d1fae5',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 24px'
          }}>
            <svg style={{ width: '40px', height: '40px', color: '#059669' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 style={{
            fontSize: '32px',
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '16px'
          }}>
            Test Submitted!
          </h1>
          <p style={{
            fontSize: '18px',
            color: '#6b7280',
            marginBottom: '16px'
          }}>
            Your designs have been recorded and are being evaluated.
          </p>
          <p style={{
            fontSize: '14px',
            color: '#9ca3af'
          }}>
            You may close this window now.
          </p>
        </div>
      </div>
    );
  }

  // MAIN TEST INTERFACE
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#f3f4f6'
    }}>
      {/* HEADER - Timer, Progress & Submit */}
      <div style={{
        background: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 24px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <h2 style={{
              fontSize: '20px',
              fontWeight: 'bold',
              color: '#111827',
              margin: 0
            }}>
              {currentQuestion?.title || 'Design Challenge'}
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              margin: '4px 0 0 0'
            }}>
              Question {currentQuestionIndex + 1} of {questions.length} • {currentQuestion?.role?.replace('_', ' ').toUpperCase()} • {currentQuestion?.difficulty?.toUpperCase()}
            </p>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px'
          }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                margin: 0
              }}>
                Time Remaining
              </p>
              <p style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: timeLeft < 300 ? '#dc2626' : '#111827',
                margin: 0
              }}>
                {formatTime(timeLeft)}
              </p>
            </div>
            <button
              onClick={handleSubmitTest}
              style={{
                padding: '8px 24px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#059669'}
              onMouseOut={(e) => e.currentTarget.style.background = '#10b981'}
            >
              Submit Test
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* QUESTION NAVIGATION SIDEBAR */}
        <div style={{
          width: '80px',
          background: 'white',
          borderRight: '1px solid #e5e7eb',
          padding: '16px 8px',
          overflowY: 'auto'
        }}>
          <p style={{
            fontSize: '11px',
            fontWeight: 600,
            color: '#6b7280',
            textAlign: 'center',
            marginBottom: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Questions
          </p>
          {questions.map((q, idx) => {
            const questionId = q._id || q.id;
            const isSubmitted = submittedQuestions.has(questionId);
            const isCurrent = idx === currentQuestionIndex;
            const isAccessible = idx === 0 || submittedQuestions.has(questions[idx - 1]._id || questions[idx - 1].id);
            
            return (
              <button
                key={questionId}
                onClick={() => {
                  if (!isAccessible) {
                    alert('Please complete previous questions first.');
                  } else {
                    setCurrentQuestionIndex(idx);
                  }
                }}
                disabled={!isAccessible}
                style={{
                  width: '100%',
                  padding: '12px 8px',
                  marginBottom: '8px',
                  background: isCurrent ? '#7C3AED' : isSubmitted ? '#10b981' : isAccessible ? '#F3F4F6' : '#E5E7EB',
                  color: isCurrent || isSubmitted ? 'white' : isAccessible ? '#6b7280' : '#9ca3af',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isAccessible ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  position: 'relative',
                  opacity: isAccessible ? 1 : 0.5
                }}
                onMouseEnter={(e) => {
                  if (!isCurrent && !isSubmitted && isAccessible) e.currentTarget.style.background = '#E5E7EB'
                }}
                onMouseLeave={(e) => {
                  if (!isCurrent && !isSubmitted && isAccessible) e.currentTarget.style.background = '#F3F4F6'
                }}
              >
                Q{idx + 1}
                {isSubmitted && (
                  <div style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '12px',
                    height: '12px',
                    background: 'white',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <svg width="8" height="8" fill="#10b981" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* QUESTION PANEL (Collapsible) */}
        <div style={{
          width: questionPanelCollapsed ? '48px' : '320px',
          background: 'white',
          borderRight: '1px solid #e5e7eb',
          padding: questionPanelCollapsed ? '0' : '24px',
          overflowY: 'auto',
          transition: 'width 0.3s ease, padding 0.3s ease'
        }}>
          {questionPanelCollapsed ? (
            <div style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setQuestionPanelCollapsed(false)}
                style={{
                  padding: '8px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280'
                }}
                title="Show Question Details"
              >
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px'
              }}>
                <h3 style={{
                  fontWeight: 'bold',
                  color: '#111827',
                  fontSize: '16px',
                  margin: 0
                }}>
                  Challenge
                </h3>
                <button
                  onClick={() => setQuestionPanelCollapsed(true)}
                  style={{
                    padding: '4px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280'
                  }}
                  title="Hide Question Details"
                >
                  <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
              
              <p style={{
                fontSize: '14px',
                color: '#374151',
                marginBottom: '16px',
                lineHeight: '1.5'
              }}>
                {currentQuestion?.description}
              </p>

              {currentQuestion?.task_requirements && (
                <>
                  <h3 style={{
                    fontWeight: 'bold',
                    color: '#111827',
                    marginBottom: '8px',
                    fontSize: '16px'
                  }}>
                    Task Requirements
                  </h3>
                  <div style={{
                    fontSize: '14px',
                    color: '#374151',
                    marginBottom: '16px',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap'
                  }}>
                    {currentQuestion.task_requirements}
                  </div>
                </>
              )}

              <h3 style={{
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '8px',
                fontSize: '16px'
              }}>
                Constraints
              </h3>
              <ul style={{
                listStyle: 'disc',
                paddingLeft: '20px',
                fontSize: '14px',
                color: '#374151',
                marginBottom: '16px'
              }}>
                {currentQuestion?.constraints?.map((c: string, i: number) => (
                  <li key={i} style={{ marginBottom: '8px', lineHeight: '1.4' }}>{c}</li>
                ))}
              </ul>

              <h3 style={{
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '8px',
                fontSize: '16px'
              }}>
                Deliverables
              </h3>
              <ul style={{
                listStyle: 'disc',
                paddingLeft: '20px',
                fontSize: '14px',
                color: '#374151',
                marginBottom: '16px'
              }}>
                {currentQuestion?.deliverables?.map((d: string, i: number) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{d}</li>
                ))}
              </ul>

              <h3 style={{
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '8px',
                fontSize: '16px'
              }}>
                Evaluation Criteria
              </h3>
              <ul style={{
                listStyle: 'disc',
                paddingLeft: '20px',
                fontSize: '14px',
                color: '#374151',
                marginBottom: '16px'
              }}>
                {currentQuestion?.evaluation_criteria?.map((e: string, i: number) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{e}</li>
                ))}
              </ul>


              
              <button
                onClick={handleSubmitQuestion}
                disabled={submittedQuestions.has(currentQuestion?._id || currentQuestion?.id)}
                style={{
                  width: '100%',
                  marginTop: '8px',
                  padding: '10px',
                  background: submittedQuestions.has(currentQuestion?._id || currentQuestion?.id) ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: submittedQuestions.has(currentQuestion?._id || currentQuestion?.id) ? 'not-allowed' : 'pointer',
                  opacity: submittedQuestions.has(currentQuestion?._id || currentQuestion?.id) ? 0.5 : 1
                }}
                onMouseOver={(e) => {
                  if (!submittedQuestions.has(currentQuestion?._id || currentQuestion?.id)) {
                    e.currentTarget.style.background = '#059669';
                  }
                }}
                onMouseOut={(e) => {
                  if (!submittedQuestions.has(currentQuestion?._id || currentQuestion?.id)) {
                    e.currentTarget.style.background = '#10b981';
                  }
                }}
              >
                {submittedQuestions.has(currentQuestion?._id || currentQuestion?.id) ? '✓ Submitted' : 'Submit Question'}
              </button>
            </>
          )}
        </div>

        {/* PENPOT WORKSPACE */}
        <div style={{
          flex: 1,
          background: '#1f2937'
        }}>
          {currentWorkspace?.workspace_url ? (
            <iframe
              ref={penpotIframeRef}
              key={currentQuestion?._id || currentQuestion?.id}
              src={currentWorkspace.workspace_url}
              style={{
                width: '100%',
                height: '100%',
                border: 'none'
              }}
              title="Penpot Design Workspace"
              allow="clipboard-read; clipboard-write"
            />
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#9ca3af',
              gap: '16px'
            }}>
              <div style={{
                width: '64px',
                height: '64px',
                border: '4px solid #e5e7eb',
                borderTop: '4px solid #7C3AED',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '8px'
                }}>
                  Loading workspace...
                </p>
                <p style={{
                  fontSize: '14px',
                  color: '#6b7280'
                }}>
                  This may take 10-15 seconds
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
