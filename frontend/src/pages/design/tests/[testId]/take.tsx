/**
 * Design Assessment - Candidate Take Page
 * Route: /design/tests/[testId]/take
 * 
 * This page is accessed when a candidate clicks "Start Assessment" from dashboard
 * Auto-starts and shows split layout: Question (left) | Penpot workspace (right)
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function DesignAssessmentTakePage() {
  const router = useRouter();
  const { testId } = router.query;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<any>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(3600);

  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design';

  // Format time as MM:SS
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-start assessment on page load
  useEffect(() => {
    if (!testId) return;

    const startAssessment = async () => {
      setLoading(true);
      setError(null);

      try {
        // Step 1: Generate AI question
        const qResponse = await fetch(`${API_URL}/questions/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'ui_designer',
            difficulty: 'intermediate',
            task_type: 'dashboard',
            topic: 'food delivery',
            created_by: 'candidate'
          })
        });

        if (!qResponse.ok) {
          throw new Error('Failed to generate question');
        }
        const questionData = await qResponse.json();
        setQuestion(questionData);

        // Step 2: Create Penpot workspace
        const wResponse = await fetch(`${API_URL}/workspace/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: 'candidate_123',
            assessment_id: testId,
            question_id: questionData._id || questionData.id
          })
        });

        if (!wResponse.ok) {
          throw new Error('Failed to create workspace');
        }
        const workspaceData = await wResponse.json();
        setWorkspace(workspaceData);
        setTimeLeft(questionData.time_limit_minutes * 60);

      } catch (err: any) {
        console.error('Assessment start error:', err);
        setError(err.message || 'Failed to start assessment');
      } finally {
        setLoading(false);
      }
    };

    startAssessment();
  }, [testId]);

  // Timer countdown
  useEffect(() => {
    if (workspace && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            handleSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [workspace, timeLeft]);

  // Submit design
  const handleSubmit = () => {
    alert('Design submitted successfully!\n\n(Submission and evaluation logic will be implemented here)');
    // TODO: Implement actual submission
    // router.push(`/design/tests/${testId}/results`);
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
            {!question ? 'Generating your design challenge...' : 'Setting up your workspace...'}
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

  // ASSESSMENT SCREEN - SPLIT LAYOUT
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#f3f4f6'
    }}>
      {/* HEADER - Timer & Submit */}
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
              color: '#111827'
            }}>
              {question?.title || 'Design Challenge'}
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#6b7280'
            }}>
              {question?.role?.replace('_', ' ').toUpperCase()} • {question?.difficulty?.toUpperCase()}
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
                color: '#6b7280'
              }}>
                Time Remaining
              </p>
              <p style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: timeLeft < 300 ? '#dc2626' : '#111827'
              }}>
                {formatTime(timeLeft)}
              </p>
            </div>
            <button
              onClick={handleSubmit}
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
              Submit Design
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT - SPLIT LAYOUT */}
      <div style={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden'
      }}>
        {/* LEFT SIDE - Question Panel (320px) */}
        <div style={{
          width: '320px',
          background: 'white',
          borderRight: '1px solid #e5e7eb',
          padding: '24px',
          overflowY: 'auto'
        }}>
          <h3 style={{
            fontWeight: 'bold',
            color: '#111827',
            marginBottom: '12px',
            fontSize: '16px'
          }}>
            Challenge
          </h3>
          <p style={{
            fontSize: '14px',
            color: '#374151',
            marginBottom: '16px',
            lineHeight: '1.5'
          }}>
            {question?.description}
          </p>

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
            {question?.constraints?.map((c: string, i: number) => (
              <li key={i} style={{ marginBottom: '4px' }}>{c}</li>
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
            {question?.deliverables?.map((d: string, i: number) => (
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
            color: '#374151'
          }}>
            {question?.evaluation_criteria?.map((e: string, i: number) => (
              <li key={i} style={{ marginBottom: '4px' }}>{e}</li>
            ))}
          </ul>
        </div>

        {/* RIGHT SIDE - Penpot Workspace (remaining width) */}
        <div style={{
          flex: 1,
          background: '#1f2937'
        }}>
          {workspace?.workspace_url ? (
            <iframe
              src={workspace.workspace_url}
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
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: '#9ca3af'
            }}>
              Loading workspace...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
