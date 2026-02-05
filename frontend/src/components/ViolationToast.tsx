/**
 * ViolationToast Component
 * 
 * Displays toast notifications for proctoring violations.
 * Single toast at a time with 5-second gap between toasts.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface ToastPayload {
  id?: string;
  eventType: string;
  message: string;
  thumbnailUrl?: string;
  timestamp: string;
}

// Event type to title mapping
const titleMap: Record<string, string> = {
  GAZE_AWAY: 'Gaze Away Detected',
  MULTIPLE_FACES_DETECTED: 'Multiple Faces Detected',
  NO_FACE_DETECTED: 'No Face Detected',
  TAB_SWITCH: 'Tab Switch Detected',
  FOCUS_LOST: 'Focus Lost',
  FULLSCREEN_EXIT: 'Fullscreen Exited',
};

// Constants
const TOAST_DURATION = 3000; // 3 seconds
const TOAST_GAP = 5000; // 5 seconds between toasts

// Global toast state
let globalShowToast: ((payload: ToastPayload) => void) | null = null;

export function pushViolationToast(payload: ToastPayload) {
  if (globalShowToast) {
    globalShowToast(payload);
  } else {
    console.warn('[ViolationToast] Toast system not initialized');
  }
}

export function ViolationToast() {
  const [visible, setVisible] = useState(false);
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastToastTimeRef = useRef<number>(0);
  const queuedToastRef = useRef<ToastPayload | null>(null);
  const isToastVisibleRef = useRef(false);

  const showToast = useCallback((payload: ToastPayload) => {
    const now = Date.now();
    const timeSinceLastToast = now - lastToastTimeRef.current;

    // If toast is visible or gap hasn't passed, queue the toast
    if (isToastVisibleRef.current || timeSinceLastToast < TOAST_GAP) {
      queuedToastRef.current = payload;
      
      // Schedule queue check after gap
      const delay = Math.max(0, TOAST_GAP - timeSinceLastToast);
      setTimeout(() => {
        if (queuedToastRef.current && !isToastVisibleRef.current) {
          const queued = queuedToastRef.current;
          queuedToastRef.current = null;
          showToast(queued);
        }
      }, delay + 100);
      return;
    }

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Show the toast
    setToast(payload);
    setVisible(true);
    setIsAnimatingOut(false);
    isToastVisibleRef.current = true;
    lastToastTimeRef.current = now;

    // Auto-hide after duration
    timeoutRef.current = setTimeout(() => {
      setIsAnimatingOut(true);
      setTimeout(() => {
        setVisible(false);
        setToast(null);
        isToastVisibleRef.current = false;

        // Check queue
        if (queuedToastRef.current) {
          const queued = queuedToastRef.current;
          queuedToastRef.current = null;
          setTimeout(() => showToast(queued), 100);
        }
      }, 280); // Match toastSlideUp animation duration
    }, TOAST_DURATION);
  }, []);

  // Register global show function
  useEffect(() => {
    globalShowToast = showToast;
    return () => {
      globalShowToast = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [showToast]);

  if (!visible || !toast) return null;

  const title = titleMap[toast.eventType] || toast.eventType;

  return (
    <>
      <div
        className={`violation-toast ${isAnimatingOut ? 'toast-exit' : 'toast-enter'}`}
        role="status"
        aria-live="polite"
      >
        {toast.thumbnailUrl && (
          <div className="toast-thumbnail">
            <img src={toast.thumbnailUrl} alt="Snapshot" />
          </div>
        )}
        <div className="toast-content">
          <div className="toast-title">{title}</div>
          <div className="toast-message">{toast.message}</div>
        </div>
      </div>

      <style jsx>{`
        .violation-toast {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 9999;
          display: flex;
          align-items: center;
          gap: 14px;
          max-width: 360px;
          width: calc(100% - 32px);
          padding: 16px 20px;
          background: linear-gradient(145deg, #1e1b2e 0%, #2a2541 50%, #1f1c2f 100%);
          border: 1px solid rgba(139, 92, 246, 0.35);
          border-radius: 14px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.04) inset;
          color: #fff;
          backdrop-filter: blur(12px);
        }

        .toast-enter {
          animation: toastSlideDown 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .toast-exit {
          animation: toastSlideUp 0.28s cubic-bezier(0.4, 0, 1, 1) forwards;
        }

        @keyframes toastSlideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-24px) scale(0.92);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
        }

        @keyframes toastSlideUp {
          from {
            opacity: 1;
            transform: translateX(-50%) translateY(0) scale(1);
          }
          to {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px) scale(0.96);
          }
        }

        .toast-thumbnail {
          width: 52px;
          height: 52px;
          border-radius: 10px;
          overflow: hidden;
          flex-shrink: 0;
          background-color: rgba(255, 255, 255, 0.06);
        }

        .toast-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .toast-content {
          flex: 1;
          min-width: 0;
          text-align: center;
        }

        .toast-title {
          font-weight: 700;
          font-size: 14px;
          letter-spacing: 0.02em;
          color: #fbbf24;
          margin-bottom: 4px;
        }

        .toast-message {
          font-size: 13px;
          color: #e2e8f0;
          line-height: 1.45;
          word-wrap: break-word;
        }

        @media (max-width: 420px) {
          .violation-toast {
            max-width: calc(100vw - 32px);
            width: calc(100vw - 32px);
          }
        }
      `}</style>
    </>
  );
}

export default ViolationToast;
