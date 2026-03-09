// This file contains the UI rendering for the design test taking page
// Split from main component due to file size

export const LoadingState = () => (
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
        borderTop: '4px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '0 auto'
      }} />
      <p style={{
        marginTop: '16px',
        color: '#6b7280',
        fontSize: '16px'
      }}>
        Loading your design challenges...
      </p>
    </div>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export const ErrorState = ({ error }: { error: string }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: '#f9fafb'
  }}>
    <div style={{
      background: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: '8px',
      padding: '24px',
      maxWidth: '400px'
    }}>
      <h3 style={{
        color: '#991b1b',
        fontWeight: 600,
        marginBottom: '8px'
      }}>
        Error Loading Assessment
      </h3>
      <p style={{
        color: '#dc2626',
        marginBottom: '16px'
      }}>
        {error}
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          padding: '8px 16px',
          background: '#dc2626',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 600
        }}
      >
        Reload Page
      </button>
    </div>
  </div>
);

export const SuccessState = () => (
  <div style={{
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(to bottom right, #d1fae5, #a7f3d0)'
  }}>
    <div style={{
      textAlign: 'center',
      background: 'white',
      padding: '48px',
      borderRadius: '16px',
      boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
      maxWidth: '500px',
      width: '90%'
    }}>
      <div style={{
        width: '80px',
        height: '80px',
        background: '#d1fae5',
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 24px'
      }}>
        <svg style={{ width: '40px', height: '40px', color: '#059669' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 style={{
        fontSize: '32px',
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: '16px'
      }}>
        Test Submitted!
      </h1>
      <p style={{
        fontSize: '18px',
        color: '#6b7280',
        marginBottom: '16px'
      }}>
        Your designs have been recorded and are being evaluated.
      </p>
      <p style={{
        fontSize: '14px',
        color: '#9ca3af'
      }}>
        You may close this window now.
      </p>
    </div>
  </div>
);
