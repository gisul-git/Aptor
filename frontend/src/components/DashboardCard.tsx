/**
 * Universal Dashboard Card Component
 * Renders a consistent card for all assessment types (AI Assessment, DSA, AIML, Custom MCQ)
 */

import { useRouter } from 'next/router';
import { useDashboardCard, type CardInput } from '@/hooks/useDashboardCard';
import type { DisplayStatus, AssessmentType } from '../utils/cardConfig';

interface DashboardCardProps extends CardInput {
  // Menu state (controlled by parent)
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  
  // Actions (handled by parent)
  onPause: (id: string, e: React.MouseEvent) => void;
  onResume: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, title: string, type?: AssessmentType) => void;
  onClone: (id: string, title: string) => void;
}

export default function DashboardCard(props: DashboardCardProps) {
  const router = useRouter();
  const {
    displayStatus,
    statusColors,
    schedule,
    cardStyle,
    typeBadge,
    actions,
    navigation,
    metadata
  } = useDashboardCard(props);

  // Handle card click navigation
  const handleCardClick = () => {
    if (props.type === 'dsa') {
      router.push(`/dsa/tests/${props.id}/edit`);
    } else if (props.type === 'aiml') {
      router.push(`/aiml/tests/${props.id}/edit`);
    } else if (props.type === 'design') {
      router.push(`/design/tests/${props.id}/edit`);
    } else if (props.type === 'data_engineering') {
      router.push(`/data-engineering/tests/${props.id}/edit`);
    } else if (props.type === 'cloud') {
      router.push(`/cloud/tests/${props.id}/edit`);
    } else if (props.type === 'devops') {
      router.push(`/devops/tests/${props.id}/edit`);
    } else if (displayStatus === 'draft') {
      if (props.type === 'custom_mcq') {
        router.push(`/custom-mcq/create?id=${props.id}`);
      } else {
        router.push(`/assessments/create-new?id=${props.id}`);
      }
    } else {
      // For active/paused/completed, go to analytics
      if (props.type === 'custom_mcq') {
        router.push(`/custom-mcq/${props.id}`);
      } else if (navigation.analyticsPath) {
        router.push(navigation.analyticsPath);
      } else {
        console.error('[DashboardCard] Analytics path is missing for card click:', props.id, props.type);
      }
    }
  };

   const getScheduleIndicator = () => {
    if (!schedule.hasSchedule) {
      return (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ color: '#94a3b8', fontWeight: 500 }}>Not Scheduled</span>
        </>
      );
    }

    // If schedule exists, show "Scheduled" (status is shown in the status badge above)
    return (
      <>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        <span style={{ color: '#f59e0b', fontWeight: 500 }}>Scheduled</span>
      </>
    );
  };

  return (
    <div
      className="card-hover"
      style={{
        border: cardStyle.border,
        borderRadius: '1rem',
        padding: '1.5rem',
        backgroundColor: cardStyle.backgroundColor,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: cardStyle.boxShadow,
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-3px)';
        e.currentTarget.style.boxShadow = cardStyle.hoverBoxShadow;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = cardStyle.boxShadow;
      }}
      onClick={handleCardClick}
    >
      {/* Header Section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
          marginBottom: '1rem',
          position: 'relative',
        }}
      >
        <h3
          style={{
            margin: 0,
            color: '#1a1625',
            fontSize: '1.125rem',
            fontWeight: 600,
            flex: 1,
          }}
        >
          {props.title}
        </h3>
        
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Type Badge */}
          <span
            className="badge"
            style={{
              backgroundColor: typeBadge.colors.bg,
              color: typeBadge.colors.text,
              border: `1px solid ${typeBadge.colors.border}`,
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
              fontWeight: 600,
              borderRadius: '0.375rem',
            }}
          >
            {typeBadge.label}
          </span>

          {/* Status Badge */}
          <span
            className="badge"
            style={{
              backgroundColor: statusColors.bg,
              color: statusColors.text,
              border: `1px solid ${statusColors.border}`,
              textTransform: 'capitalize',
              display: 'flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontWeight: 600,
              fontSize: '0.75rem',
              padding: '0.375rem 0.75rem',
              borderRadius: '0.375rem',
            }}
          >
            {displayStatus === 'paused' && statusColors.icon && statusColors.icon}
            {displayStatus}
          </span>

          {/* Overflow Menu - Positioned AFTER badges */}
          <div style={{ position: 'relative' }} data-menu-id={props.id}>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                props.onMenuToggle();
              }}
              style={{
                background: props.isMenuOpen ? '#f1f5f9' : 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0.375rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#64748b',
                borderRadius: '0.375rem',
                transition: 'all 0.2s ease',
                width: '28px',
                height: '28px',
              }}
              onMouseEnter={(e) => {
                if (!props.isMenuOpen) {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.color = '#475569';
                }
              }}
              onMouseLeave={(e) => {
                if (!props.isMenuOpen) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }
              }}
              title="More options"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>

            {/* Menu Dropdown */}
            {props.isMenuOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 0.5rem)',
                  right: 0,
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.75rem',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)',
                  minWidth: '200px',
                  zIndex: 1000,
                  padding: '0.5rem',
                  animation: 'fadeIn 0.15s ease-out',
                }}
              >
                <style dangerouslySetInnerHTML={{__html: `
                  @keyframes fadeIn {
                    from {
                      opacity: 0;
                      transform: translateY(-4px);
                    }
                    to {
                      opacity: 1;
                      transform: translateY(0);
                    }
                  }
                `}} />

                {/* Pause/Resume Menu Item */}
                {(actions.showPause || actions.showResume) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (actions.showResume) {
                        props.onResume(props.id, e);
                      } else {
                        props.onPause(props.id, e);
                      }
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.625rem 0.875rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: actions.showResume ? '#059669' : '#1e293b',
                      fontWeight: 500,
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = actions.showResume ? '#ecfdf5' : '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {actions.showResume ? (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        Resume Assessment
                      </>
                    ) : (
                      <>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                        Pause Assessment
                      </>
                    )}
                  </button>
                )}

                {/* Divider */}
                {(actions.showPause || actions.showResume) && (
                  <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '0.375rem 0' }} />
                )}

                {/* Clone Menu Item */}
                {actions.showClone && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      props.onClone(props.id, props.title);
                      props.onMenuToggle();
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '0.625rem 0.875rem',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      color: '#1e293b',
                      fontWeight: 500,
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.625rem',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f8fafc';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Clone Assessment
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Information Section */}
      <div style={{ 
        color: '#64748b', 
        fontSize: '0.875rem', 
        marginBottom: '0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}>
        {/* Created Date */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem',
          color: '#475569',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span><strong>Created:</strong> {metadata.formattedCreatedAt}</span>
        </div>

        {/* Schedule Status */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          {getScheduleIndicator()}
        </div>
      </div>

      {/* Action Buttons Section */}
      <div style={{ 
        marginTop: '1rem', 
        display: 'flex', 
        flexDirection: 'row', 
        gap: '0.5rem', 
        paddingTop: '1rem', 
        borderTop: '1px solid #E8FAF0' 
      }}>
        {/* Edit Button (Draft/Paused) */}
        {actions.showEdit && (
          <button
            type="button"
            className="btn-secondary"
            style={{
              fontSize: '0.875rem',
              padding: '0.625rem 1rem',
              marginTop: 0,
              flex: 1,
              fontWeight: 600,
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              borderRadius: '0.5rem',
              border: '1px solid #A8E8BC',
              backgroundColor: '#ffffff',
              color: '#2D7A52',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (navigation.editPath) {
                router.push(navigation.editPath);
              } else {
                console.error('[DashboardCard] Edit path is missing for assessment:', props.id, props.type);
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(168, 232, 188, 0.3)';
              e.currentTarget.style.backgroundColor = '#f0fdf4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
        )}

        {/* Analytics Button (Active/Published/Scheduled/Completed) */}
        {actions.showAnalytics && (
          <button
            type="button"
            className="btn-secondary"
            style={{
              fontSize: '0.875rem',
              padding: '0.625rem 1rem',
              marginTop: 0,
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontWeight: 600,
              transition: 'all 0.15s ease',
              borderRadius: '0.5rem',
              border: '1px solid #A8E8BC',
              backgroundColor: '#ffffff',
              color: '#2D7A52',
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (navigation.analyticsPath) {
                router.push(navigation.analyticsPath);
              } else {
                console.error('[DashboardCard] Analytics path is missing for assessment:', props.id, props.type);
              }
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(168, 232, 188, 0.3)';
              e.currentTarget.style.backgroundColor = '#f0fdf4';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.backgroundColor = '#ffffff';
            }}
          >
            <svg 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
            Analytics
          </button>
        )}

        {/* Delete Button (Always visible) */}
        {actions.showDelete && (
          <button
            type="button"
            style={{
              fontSize: '0.875rem',
              padding: '0.625rem 1rem',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              flex: 1,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#dc2626';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 2px 6px rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#ef4444';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete(props.id, props.title, props.type);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

