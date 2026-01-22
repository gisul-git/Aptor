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
      }, 200); // Animation duration
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
  const timestamp = new Date(toast.timestamp).toLocaleTimeString();

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
          <div className="toast-time">{timestamp}</div>
        </div>
        <button
          className="toast-close"
          onClick={() => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setIsAnimatingOut(true);
            setTimeout(() => {
              setVisible(false);
              setToast(null);
              isToastVisibleRef.current = false;
            }, 200);
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <style jsx>{`
        .violation-toast {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 9999;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          max-width: 320px;
          padding: 12px 16px;
          background: linear-gradient(135deg, #1a1625 0%, #2d2640 100%);
          border: 1px solid #6953a3;
          border-radius: 12px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
          color: #fff;
        }

        .toast-enter {
          animation: slideIn 0.2s ease-out forwards;
        }

        .toast-exit {
          animation: slideOut 0.2s ease-in forwards;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(100%);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes slideOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(100%);
          }
        }

        .toast-thumbnail {
          width: 56px;
          height: 56px;
          border-radius: 8px;
          overflow: hidden;
          flex-shrink: 0;
          background-color: #333;
        }

        .toast-thumbnail img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .toast-content {
          flex: 1;
          min-width: 0;
        }

        .toast-title {
          font-weight: 600;
          font-size: 14px;
          color: #f59e0b;
          margin-bottom: 4px;
        }

        .toast-message {
          font-size: 12px;
          color: #e2e8f0;
          margin-bottom: 4px;
          word-wrap: break-word;
        }

        .toast-time {
          font-size: 10px;
          color: #94a3b8;
        }

        .toast-close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 20px;
          height: 20px;
          border: none;
          background: transparent;
          color: #94a3b8;
          font-size: 18px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .toast-close:hover {
          background-color: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        @media (max-width: 420px) {
          .violation-toast {
            max-width: calc(100vw - 32px);
            right: 16px;
            left: 16px;
          }
        }
      `}</style>
    </>
  );
}

export default ViolationToast;
