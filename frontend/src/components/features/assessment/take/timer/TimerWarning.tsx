/**
 * TimerWarning Component
 * 
 * Displays warning when time is running low
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface TimerWarningProps {
  timeRemaining: number; // in seconds
  totalTime: number; // in seconds
  onDismiss?: () => void;
  showAtPercentage?: number; // Show warning when time is below this percentage
}

export function TimerWarning({
  timeRemaining,
  totalTime,
  onDismiss,
  showAtPercentage = 10,
}: TimerWarningProps) {
  const [isVisible, setIsVisible] = React.useState(true);
  const [hasShown, setHasShown] = React.useState(false);

  const percentRemaining = (timeRemaining / totalTime) * 100;
  const shouldShow = percentRemaining <= showAtPercentage && timeRemaining > 0;

  React.useEffect(() => {
    if (shouldShow && !hasShown) {
      setHasShown(true);
      setIsVisible(true);
    }
  }, [shouldShow, hasShown]);

  const handleDismiss = () => {
    setIsVisible(false);
    if (onDismiss) {
      onDismiss();
    }
  };

  if (!shouldShow || !isVisible) {
    return null;
  }

  const isCritical = percentRemaining <= 5;
  const backgroundColor = isCritical ? '#fee2e2' : '#fef3c7';
  const borderColor = isCritical ? '#dc2626' : '#f59e0b';
  const textColor = isCritical ? '#991b1b' : '#92400e';

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '1rem',
        backgroundColor,
        border: `2px solid ${borderColor}`,
        borderRadius: '0.5rem',
        marginBottom: '1rem',
        animation: 'slideDown 0.3s ease-out',
      }}
    >
      <AlertTriangle
        style={{
          width: '24px',
          height: '24px',
          color: borderColor,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: '1rem',
            fontWeight: 600,
            color: textColor,
            marginBottom: '0.25rem',
          }}
        >
          {isCritical ? '⚠️ Time Running Out!' : '⏰ Time Warning'}
        </div>
        <div style={{ fontSize: '0.875rem', color: textColor }}>
          {isCritical
            ? `Only ${formatTime(timeRemaining)} remaining. Please submit your assessment soon.`
            : `You have ${formatTime(timeRemaining)} remaining. Please manage your time wisely.`}
        </div>
      </div>
      {onDismiss && (
        <button
          onClick={handleDismiss}
          style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: 'transparent',
            border: 'none',
            color: textColor,
            cursor: 'pointer',
            fontSize: '1.25rem',
            lineHeight: 1,
          }}
          aria-label="Dismiss warning"
        >
          ×
        </button>
      )}
      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default TimerWarning;




