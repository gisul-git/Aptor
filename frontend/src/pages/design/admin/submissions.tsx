/**
 * Recruiter Dashboard - Design Submissions
 * Shows candidate scores, AI feedback, screenshots, replay, and behavior analytics
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import DesignReplayViewer from '../../../components/design/DesignReplayViewer';

interface Submission {
  _id: string;
  session_id: string;
  user_id: string;
  question_id: string;
  final_score: number;
  rule_based_score: number;
  ai_based_score: number;
  submitted_at: string;
  feedback?: any;
}

export default function DesignSubmissionsPage() {
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [showReplay, setShowReplay] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design';

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      const response = await fetch(`${API_URL}/admin/submissions`);
      const data = await response.json();
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error('Failed to fetch submissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubmissionDetails = async (submission: Submission) => {
    setSelectedSubmission(submission);
    setAnalytics(null);
    setEvents([]);
    setScreenshots([]);
    setShowReplay(false);

    try {
      // Fetch event analytics
      const analyticsResponse = await fetch(`${API_URL}/events/analytics/${submission.session_id}`);
      if (analyticsResponse.ok) {
        const analyticsData = await analyticsResponse.json();
        setAnalytics(analyticsData.analytics);
      }

      // Fetch events for replay
      const eventsResponse = await fetch(`${API_URL}/events/advanced/${submission.session_id}`);
      if (eventsResponse.ok) {
        const eventsData = await eventsResponse.json();
        setEvents(eventsData.events || []);
      }

      // Fetch screenshots
      const screenshotsResponse = await fetch(`${API_URL}/sessions/${submission.session_id}/screenshots`);
      if (screenshotsResponse.ok) {
        const screenshotsData = await screenshotsResponse.json();
        setScreenshots(screenshotsData.screenshots || []);
      }
    } catch (error) {
      console.error('Failed to fetch submission details:', error);
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return '#10b981';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#ef4444';
    return '#dc2626';
  };

  const getScoreLabel = (score: number): string => {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  };

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
            borderTop: '4px solid #7C3AED',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto'
          }} />
          <p style={{
            marginTop: '16px',
            color: '#6b7280',
            fontSize: '16px'
          }}>
            Loading submissions...
          </p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#f9fafb'
    }}>
      {/* Submissions List */}
      <div style={{
        width: '400px',
        background: 'white',
        borderRight: '1px solid #e5e7eb',
        overflowY: 'auto'
      }}>
        <div style={{
          padding: '24px',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h1 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: '#111827',
            margin: 0
          }}>
            Design Submissions
          </h1>
          <p style={{
            fontSize: '14px',
            color: '#6b7280',
            margin: '4px 0 0 0'
          }}>
            {submissions.length} total submissions
          </p>
        </div>

        <div style={{ padding: '16px' }}>
          {submissions.map((submission) => (
            <div
              key={submission._id}
              onClick={() => fetchSubmissionDetails(submission)}
              style={{
                padding: '16px',
                background: selectedSubmission?._id === submission._id ? '#f3f4f6' : 'white',
                border: `1px solid ${selectedSubmission?._id === submission._id ? '#7C3AED' : '#e5e7eb'}`,
                borderRadius: '8px',
                marginBottom: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (selectedSubmission?._id !== submission._id) {
                  e.currentTarget.style.background = '#f9fafb';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedSubmission?._id !== submission._id) {
                  e.currentTarget.style.background = 'white';
                }
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#111827'
                }}>
                  {submission.user_id}
                </span>
                <span style={{
                  fontSize: '20px',
                  fontWeight: 'bold',
                  color: getScoreColor(submission.final_score)
                }}>
                  {submission.final_score.toFixed(1)}
                </span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#6b7280'
              }}>
                <span>{new Date(submission.submitted_at).toLocaleDateString()}</span>
                <span style={{
                  padding: '2px 8px',
                  background: getScoreColor(submission.final_score) + '20',
                  color: getScoreColor(submission.final_score),
                  borderRadius: '4px',
                  fontWeight: 600
                }}>
                  {getScoreLabel(submission.final_score)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submission Details */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {selectedSubmission ? (
          <div style={{ padding: '24px' }}>
            {/* Header */}
            <div style={{
              background: 'white',
              padding: '24px',
              borderRadius: '12px',
              marginBottom: '24px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h2 style={{
                fontSize: '24px',
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: '8px'
              }}>
                {selectedSubmission.user_id}
              </h2>
              <p style={{
                fontSize: '14px',
                color: '#6b7280',
                marginBottom: '16px'
              }}>
                Submitted: {new Date(selectedSubmission.submitted_at).toLocaleString()}
              </p>

              {/* Score Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '16px'
              }}>
                <div style={{
                  padding: '16px',
                  background: '#f9fafb',
                  borderRadius: '8px'
                }}>
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginBottom: '4px'
                  }}>
                    Final Score
                  </p>
                  <p style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: getScoreColor(selectedSubmission.final_score),
                    margin: 0
                  }}>
                    {selectedSubmission.final_score.toFixed(1)}
                  </p>
                </div>
                <div style={{
                  padding: '16px',
                  background: '#f9fafb',
                  borderRadius: '8px'
                }}>
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginBottom: '4px'
                  }}>
                    Rule-Based
                  </p>
                  <p style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: '#3b82f6',
                    margin: 0
                  }}>
                    {selectedSubmission.rule_based_score.toFixed(1)}
                  </p>
                </div>
                <div style={{
                  padding: '16px',
                  background: '#f9fafb',
                  borderRadius: '8px'
                }}>
                  <p style={{
                    fontSize: '12px',
                    color: '#6b7280',
                    marginBottom: '4px'
                  }}>
                    AI-Based
                  </p>
                  <p style={{
                    fontSize: '32px',
                    fontWeight: 'bold',
                    color: '#8b5cf6',
                    margin: 0
                  }}>
                    {selectedSubmission.ai_based_score.toFixed(1)}
                  </p>
                </div>
              </div>
            </div>

            {/* Behavior Analytics */}
            {analytics && (
              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#111827',
                  marginBottom: '16px'
                }}>
                  📊 Behavior Analytics
                </h3>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '16px'
                }}>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      Planning Time
                    </p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                      {Math.floor(analytics.planning_time_seconds / 60)} minutes
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      Execution Time
                    </p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                      {Math.floor(analytics.execution_time_seconds / 60)} minutes
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      Design Iterations
                    </p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                      {analytics.design_iterations}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      Undo Ratio
                    </p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                      {(analytics.undo_ratio * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      Component Reuse
                    </p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                      {analytics.component_reuse_score > 0.5 ? 'High' : analytics.component_reuse_score > 0.2 ? 'Medium' : 'Low'}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                      Keyboard Shortcuts
                    </p>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                      {analytics.keyboard_shortcuts_used}
                    </p>
                  </div>
                </div>

                {/* Behavior Insights */}
                <div style={{ marginTop: '16px', padding: '12px', background: '#f0f9ff', borderRadius: '8px' }}>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#0c4a6e', marginBottom: '8px' }}>
                    Behavior Profile:
                  </p>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {analytics.is_methodical && (
                      <span style={{
                        padding: '4px 12px',
                        background: '#10b981',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        Methodical
                      </span>
                    )}
                    {analytics.is_efficient && (
                      <span style={{
                        padding: '4px 12px',
                        background: '#3b82f6',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        Efficient
                      </span>
                    )}
                    {analytics.is_organized && (
                      <span style={{
                        padding: '4px 12px',
                        background: '#8b5cf6',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        Organized
                      </span>
                    )}
                    {analytics.is_experimental && (
                      <span style={{
                        padding: '4px 12px',
                        background: '#f59e0b',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: 600
                      }}>
                        Experimental
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Design Replay Button */}
            {events.length > 0 && (
              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <button
                  onClick={() => setShowReplay(!showReplay)}
                  style={{
                    width: '100%',
                    padding: '16px',
                    background: showReplay ? '#ef4444' : '#7C3AED',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {showReplay ? '❌ Close Replay' : '▶️ Watch Design Replay'}
                </button>
              </div>
            )}

            {/* Design Replay Viewer */}
            {showReplay && events.length > 0 && (
              <div style={{
                background: 'white',
                borderRadius: '12px',
                marginBottom: '24px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                height: '600px'
              }}>
                <DesignReplayViewer
                  sessionId={selectedSubmission.session_id}
                  events={events}
                  apiUrl={API_URL}
                />
              </div>
            )}

            {/* Screenshots */}
            {screenshots.length > 0 && (
              <div style={{
                background: 'white',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 'bold',
                  color: '#111827',
                  marginBottom: '16px'
                }}>
                  📸 Screenshots ({screenshots.length})
                </h3>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '16px'
                }}>
                  {screenshots.map((screenshot, index) => (
                    <div
                      key={index}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        overflow: 'hidden'
                      }}
                    >
                      <img
                        src={screenshot.image_data}
                        alt={`Screenshot ${index + 1}`}
                        style={{
                          width: '100%',
                          height: '150px',
                          objectFit: 'cover'
                        }}
                      />
                      <div style={{
                        padding: '8px',
                        background: '#f9fafb',
                        fontSize: '11px',
                        color: '#6b7280'
                      }}>
                        {new Date(screenshot.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: '#9ca3af'
          }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '18px', fontWeight: 600 }}>
                Select a submission to view details
              </p>
              <p style={{ fontSize: '14px', marginTop: '8px' }}>
                Click on any submission from the list
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
