/**
 * AssessmentTimer Component
 * 
 * Displays the overall assessment timer with visual indicators
 */

import React from 'react';

interface AssessmentTimerProps {
  timeRemaining: number; // in seconds
  totalTime?: number; // in seconds
  showWarning?: boolean;
  onExpire?: () => void;
  size?: 'small' | 'medium' | 'large';
}

export function AssessmentTimer({
  timeRemaining,
  totalTime,
  showWarning = true,
  onExpire,
  size = 'medium',
}: AssessmentTimerProps) {
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = (): string => {
    if (!totalTime) return '#1e293b';
    
    const percentRemaining = (timeRemaining / totalTime) * 100;
    if (percentRemaining <= 5) return '#dc2626'; // Red - critical
    if (percentRemaining <= 10) return '#ea580c'; // Orange - warning
    if (percentRemaining <= 25) return '#f59e0b'; // Yellow - caution
    return '#1e293b'; // Default
  };

  const getTimeBackgroundColor = (): string => {
    if (!totalTime) return '#f1f5f9';
    
    const percentRemaining = (timeRemaining / totalTime) * 100;
    if (percentRemaining <= 5) return '#fee2e2'; // Red background
    if (percentRemaining <= 10) return '#fed7aa'; // Orange background
    if (percentRemaining <= 25) return '#fef3c7'; // Yellow background
    return '#f1f5f9'; // Default
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          fontSize: '0.875rem',
          padding: '0.25rem 0.75rem',
        };
      case 'large':
        return {
          fontSize: '1.5rem',
          padding: '0.75rem 1.5rem',
        };
      default: // medium
        return {
          fontSize: '1.125rem',
          padding: '0.5rem 1rem',
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const timeColor = getTimeColor();
  const backgroundColor = getTimeBackgroundColor();
  const isLow = totalTime ? (timeRemaining / totalTime) * 100 <= 10 : false;
  const isCritical = totalTime ? (timeRemaining / totalTime) * 100 <= 5 : false;

  // Call onExpire when timer reaches 0
  React.useEffect(() => {
    if (timeRemaining <= 0 && onExpire) {
      onExpire();
    }
  }, [timeRemaining, onExpire]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: sizeStyles.padding,
        backgroundColor,
        borderRadius: '0.5rem',
        border: `1px solid ${isCritical ? '#dc2626' : isLow ? '#ea580c' : '#e2e8f0'}`,
        transition: 'all 0.3s',
      }}
    >
      <span style={{ fontSize: sizeStyles.fontSize }}>⏱️</span>
      <div style={{ textAlign: 'right' }}>
        <div
          style={{
            fontSize: sizeStyles.fontSize,
            fontFamily: 'monospace',
            fontWeight: 700,
            color: timeColor,
            lineHeight: 1.2,
          }}
        >
          {formatTime(timeRemaining)}
        </div>
        {size !== 'small' && (
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Time Remaining
          </div>
        )}
      </div>
      {showWarning && isCritical && (
        <span
          style={{
            fontSize: '0.75rem',
            color: '#dc2626',
            fontWeight: 600,
            marginLeft: '0.5rem',
            animation: 'pulse 2s infinite',
          }}
        >
          ⚠️ Critical
        </span>
      )}
      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default AssessmentTimer;

