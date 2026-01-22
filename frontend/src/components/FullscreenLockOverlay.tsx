// ============================================================================
// Fullscreen Lock Overlay Component
// ============================================================================
//
// PURPOSE:
// Hard blocks ALL user interaction when not in fullscreen mode.
// Only shows a centered prompt to re-enter fullscreen.
//
// BEHAVIOR:
// - position: fixed covering entire viewport
// - z-index: MAX (above everything including modals)
// - backdrop blur + dark overlay
// - Captures ALL pointer events
// - Disables keyboard input globally
// - Only "Enter Fullscreen" button is interactive
//
// ============================================================================

import React, { useEffect, useCallback, useRef } from 'react';

// ============================================================================
// Types
// ============================================================================

export interface FullscreenLockOverlayProps {
  /** Whether the overlay should be shown (true = NOT in fullscreen, show lock) */
  isLocked: boolean;
  /** Callback when user clicks "Enter Fullscreen" button */
  onRequestFullscreen: () => Promise<boolean>;
  /** Optional custom message */
  message?: string;
  /** Optional warning text for violations */
  warningText?: string;
  /** Current exit count to display */
  exitCount?: number;
}

// ============================================================================
// Component
// ============================================================================

/**
 * FullscreenLockOverlay - Blocks ALL interaction until fullscreen is entered
 *
 * When visible:
 * - Blurs/dims the underlying UI
 * - Blocks ALL keyboard input (except for the button)
 * - Blocks ALL mouse/touch events (except for the button)
 * - Prevents scrolling
 * - Prevents focus on any element behind the overlay
 */
export function FullscreenLockOverlay({
  isLocked,
  onRequestFullscreen,
  message = 'You must be in fullscreen mode to continue the assessment.',
  warningText,
  exitCount = 0,
}: FullscreenLockOverlayProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // ========== KEYBOARD BLOCKING ==========
  // Block ALL keyboard events when locked
  useEffect(() => {
    if (!isLocked) return;

    const blockKeyboard = (e: KeyboardEvent) => {
      // Block all keys except Tab (for accessibility to reach the button)
      // Even Tab is constrained to the overlay
      if (e.key !== 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    // Capture phase to intercept before any other handlers
    window.addEventListener('keydown', blockKeyboard, { capture: true });
    window.addEventListener('keyup', blockKeyboard, { capture: true });
    window.addEventListener('keypress', blockKeyboard, { capture: true });

    return () => {
      window.removeEventListener('keydown', blockKeyboard, { capture: true });
      window.removeEventListener('keyup', blockKeyboard, { capture: true });
      window.removeEventListener('keypress', blockKeyboard, { capture: true });
    };
  }, [isLocked]);

  // ========== FOCUS TRAPPING ==========
  // Keep focus within the overlay (only on the button)
  useEffect(() => {
    if (!isLocked) return;

    // Focus the button when overlay appears
    const timer = setTimeout(() => {
      buttonRef.current?.focus();
    }, 100);

    const trapFocus = (e: FocusEvent) => {
      // If focus tries to go outside overlay, bring it back to button
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        e.preventDefault();
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('focusin', trapFocus, { capture: true });

    return () => {
      clearTimeout(timer);
      document.removeEventListener('focusin', trapFocus, { capture: true });
    };
  }, [isLocked]);

  // ========== SCROLL BLOCKING ==========
  // Prevent scrolling when locked
  useEffect(() => {
    if (!isLocked) return;

    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalWidth = document.body.style.width;
    const originalTop = document.body.style.top;
    const scrollY = window.scrollY;

    // Lock body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.width = originalWidth;
      document.body.style.top = originalTop;
      window.scrollTo(0, scrollY);
    };
  }, [isLocked]);

  // ========== HANDLE FULLSCREEN REQUEST ==========
  const handleEnterFullscreen = useCallback(async () => {
    console.log('[FullscreenLockOverlay] Enter Fullscreen clicked');

    try {
      const success = await onRequestFullscreen();

      if (!success) {
        console.error('[FullscreenLockOverlay] Failed to enter fullscreen');
      }
    } catch (error) {
      console.error('[FullscreenLockOverlay] Error requesting fullscreen:', error);
    }
  }, [onRequestFullscreen]);

  // ========== RENDER ==========
  if (!isLocked) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      className="fullscreen-lock-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647, // Maximum z-index
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        // Ensure overlay captures ALL events
        pointerEvents: 'auto',
      }}
      // Prevent any click from bubbling through
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Modal Container */}
      <div
        style={{
          backgroundColor: '#1f2937',
          borderRadius: '12px',
          padding: '32px 40px',
          maxWidth: '480px',
          width: '90%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          textAlign: 'center',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Warning Icon */}
        <div
          style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 24px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            style={{ width: '36px', height: '36px', color: '#ef4444' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Title */}
        <h2
          style={{
            color: '#ffffff',
            fontSize: '24px',
            fontWeight: 600,
            marginBottom: '16px',
            lineHeight: 1.3,
          }}
        >
          Fullscreen Required
        </h2>

        {/* Message */}
        <p
          style={{
            color: '#9ca3af',
            fontSize: '16px',
            lineHeight: 1.6,
            marginBottom: '24px',
          }}
        >
          {message}
        </p>

        {/* Warning text (if any) */}
        {warningText && (
          <p
            style={{
              color: '#fbbf24',
              fontSize: '14px',
              lineHeight: 1.5,
              marginBottom: '24px',
              padding: '12px',
              backgroundColor: 'rgba(251, 191, 36, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(251, 191, 36, 0.2)',
            }}
          >
            {warningText}
          </p>
        )}

        {/* Exit count warning */}
        {exitCount > 0 && (
          <p
            style={{
              color: '#ef4444',
              fontSize: '14px',
              marginBottom: '24px',
            }}
          >
            ⚠️ You have exited fullscreen {exitCount} time{exitCount > 1 ? 's' : ''}.
            {exitCount >= 3 && ' Further exits may affect your assessment.'}
          </p>
        )}

        {/* Enter Fullscreen Button */}
        <button
          ref={buttonRef}
          onClick={handleEnterFullscreen}
          style={{
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            border: 'none',
            borderRadius: '8px',
            padding: '14px 32px',
            fontSize: '16px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2563eb';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#3b82f6';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.5)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          {/* Fullscreen Icon */}
          <svg
            style={{ width: '20px', height: '20px' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
            />
          </svg>
          Enter Fullscreen
        </button>

        {/* Help text */}
        <p
          style={{
            color: '#6b7280',
            fontSize: '12px',
            marginTop: '16px',
          }}
        >
          Press F11 or click the button above to enter fullscreen mode
        </p>
      </div>
    </div>
  );
}

export default FullscreenLockOverlay;
