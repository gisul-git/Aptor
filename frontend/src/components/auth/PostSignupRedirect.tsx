/**
 * PostSignupRedirect Component
 * 
 * Handles redirect after successful signup and email verification
 * Shows loading state and navigates to appropriate page based on user role
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import usePostSignupNavigation from '@/hooks/auth/usePostSignupNavigation';

interface PostSignupRedirectProps {
  /**
   * Email that was verified
   */
  email: string;
  /**
   * Whether email verification was successful
   */
  isVerified: boolean;
  /**
   * Custom success message
   */
  successMessage?: string;
  /**
   * Custom redirect path (optional)
   */
  redirectPath?: string;
}

export default function PostSignupRedirect({
  email,
  isVerified,
  successMessage = "Email verified successfully! Redirecting...",
  redirectPath,
}: PostSignupRedirectProps) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [message, setMessage] = useState(successMessage);
  const { isNavigating } = usePostSignupNavigation({
    email,
    isVerified,
    delay: 1500,
    customRedirectPath: redirectPath,
  });

  // Update message based on navigation state
  useEffect(() => {
    if (isNavigating && status === 'authenticated') {
      const userRole = (session?.user as any)?.role;
      if (userRole === 'org_admin') {
        setMessage("Email verified! Redirecting to Employee Management...");
      } else {
        setMessage("Email verified! Redirecting to Dashboard...");
      }
    }
  }, [isNavigating, status, session]);

  if (!isVerified) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          backgroundColor: '#d1fae5',
          borderLeft: '4px solid #10b981',
          padding: '1rem',
          borderRadius: '0.5rem',
          marginBottom: '1rem',
          maxWidth: '400px',
        }}
      >
        <p style={{ margin: 0, color: '#065f46', fontSize: '0.875rem', fontWeight: 500 }}>
          {message}
        </p>
      </div>
      
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '4px solid #e5e7eb',
          borderTop: '4px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

