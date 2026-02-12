import React from 'react';

interface GenerationProgress {
  total: number;
  completed: number;
  failed: number;
  currentTopic: string;
  currentQuestionType: string;
  estimatedTimeRemaining: number; // in seconds
}

interface Props {
  progress: GenerationProgress;
  show: boolean;
}

export const QuestionGenerationSkeleton: React.FC<Props> = ({ progress, show }) => {
  if (!show) return null;

  const percentage = progress.total > 0 
    ? Math.round((progress.completed / progress.total) * 100) 
    : 0;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          padding: '2rem',
          maxWidth: '600px',
          width: '90%',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)',
        }}>
          {/* Header */}
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 1rem',
              borderRadius: '50%',
              border: '4px solid #e5e7eb',
              borderTopColor: '#6953a3',
              animation: 'spin 1s linear infinite',
            }} />
            
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#1a1625',
              marginBottom: '0.5rem',
              margin: 0,
            }}>
              Generating Questions
            </h2>
            
            <p style={{
              fontSize: '0.875rem',
              color: '#64748b',
              margin: 0,
            }}>
              AI is crafting your assessment questions...
            </p>
          </div>

          {/* Progress Bar */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '0.5rem',
            }}>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: 600,
                color: '#1e293b',
              }}>
                Progress
              </span>
              <span style={{
                fontSize: '1rem',
                fontWeight: 700,
                color: '#6953a3',
              }}>
                {percentage}%
              </span>
            </div>
            
            <div style={{
              width: '100%',
              height: '8px',
              backgroundColor: '#e5e7eb',
              borderRadius: '9999px',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${percentage}%`,
                height: '100%',
                backgroundColor: '#6953a3',
                transition: 'width 0.3s ease',
                borderRadius: '9999px',
              }} />
            </div>
            
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: '#64748b',
            }}>
              <span>
                {progress.completed} / {progress.total} questions
              </span>
              {progress.failed > 0 && (
                <span style={{ color: '#ef4444' }}>
                  {progress.failed} failed
                </span>
              )}
            </div>
          </div>

          {/* Current Task */}
          <div style={{
            padding: '1rem',
            backgroundColor: '#f8fafc',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
          }}>
            <div style={{
              fontSize: '0.75rem',
              fontWeight: 600,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: '0.25rem',
            }}>
              Current Task
            </div>
            <div style={{
              fontSize: '0.875rem',
              color: '#1e293b',
              fontWeight: 500,
            }}>
              {progress.currentTopic || 'Initializing...'}
            </div>
            {progress.currentQuestionType && (
              <div style={{
                fontSize: '0.75rem',
                color: '#64748b',
                marginTop: '0.25rem',
              }}>
                Type: {progress.currentQuestionType}
              </div>
            )}
          </div>

          {/* Estimated Time */}
          {progress.estimatedTimeRemaining > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.875rem',
              color: '#64748b',
            }}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>
                Estimated time remaining: {formatTime(progress.estimatedTimeRemaining)}
              </span>
            </div>
          )}

          {/* Animated Dots */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '0.5rem',
            marginTop: '1.5rem',
          }}>
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#6953a3',
                  animation: `bounce 1.4s infinite ease-in-out both`,
                  animationDelay: `${i * 0.16}s`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes bounce {
          0%, 80%, 100% {
            transform: scale(0);
          }
          40% {
            transform: scale(1);
          }
        }
      `}</style>
    </>
  );
};

