import React from 'react';
import { CheckCircle } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  onConfirm: () => void;
}

export default function SuccessModal({
  isOpen,
  title = 'Success',
  message,
  confirmText = 'OK',
  onConfirm,
}: SuccessModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '2rem',
      }}
      onClick={onConfirm}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '2rem',
          maxWidth: '500px',
          width: '100%',
          border: '2px solid #10b981',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
            <CheckCircle size={48} color="#10b981" />
          </div>
          <h2 style={{ color: '#10b981', marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
            {title}
          </h2>
          <p style={{ color: '#1E5A3B', fontSize: '1rem', lineHeight: '1.6' }}>
            {message}
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              padding: '0.75rem 2rem',
              backgroundColor: '#10b981',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#ffffff',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
