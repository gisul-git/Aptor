/**
 * SectionTimer Component
 * 
 * Displays per-section timer with visual indicators
 */

import React from 'react';
import { Lock } from 'lucide-react';

interface SectionTimerProps {
  timeRemaining: number; // in seconds
  sectionName: string;
  totalTime?: number; // in seconds
  isLocked?: boolean;
  size?: 'small' | 'medium';
}

export function SectionTimer({
  timeRemaining,
  sectionName,
  totalTime,
  isLocked = false,
  size = 'medium',
}: SectionTimerProps) {
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = (): string => {
    if (isLocked) return '#94a3b8';
    if (!totalTime) return '#1e293b';
    
    const percentRemaining = (timeRemaining / totalTime) * 100;
    if (percentRemaining <= 5) return '#dc2626';
    if (percentRemaining <= 10) return '#ea580c';
    if (percentRemaining <= 25) return '#f59e0b';
    return '#1e293b';
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          fontSize: '0.75rem',
          padding: '0.25rem 0.5rem',
        };
      default: // medium
        return {
          fontSize: '0.875rem',
          padding: '0.5rem 0.75rem',
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const timeColor = getTimeColor();

  if (isLocked) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: sizeStyles.padding,
          backgroundColor: '#f3f4f6',
          borderRadius: '0.375rem',
          border: '1px solid #d1d5db',
          color: '#94a3b8',
        }}
      >
        <Lock style={{ width: '14px', height: '14px' }} />
        <span style={{ fontSize: sizeStyles.fontSize, fontWeight: 500 }}>
          {sectionName} - Locked
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: sizeStyles.padding,
        backgroundColor: '#f8fafc',
        borderRadius: '0.375rem',
        border: '1px solid #e2e8f0',
      }}
    >
      <span style={{ fontSize: sizeStyles.fontSize }}>⏱️</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: sizeStyles.fontSize, fontWeight: 500, color: '#64748b' }}>
          {sectionName}:
        </span>
        <span
          style={{
            fontSize: sizeStyles.fontSize,
            fontFamily: 'monospace',
            fontWeight: 600,
            color: timeColor,
          }}
        >
          {formatTime(timeRemaining)}
        </span>
      </div>
    </div>
  );
}

export default SectionTimer;




