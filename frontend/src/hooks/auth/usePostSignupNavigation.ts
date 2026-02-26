/**
 * usePostSignupNavigation Hook
 * 
 * Handles navigation logic after successful signup and email verification
 * For org_admin users, navigates to employee management page
 */

import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

interface UsePostSignupNavigationOptions {
  /**
   * Email that was verified
   */
  email?: string;
  /**
   * Whether email verification was successful
   */
  isVerified?: boolean;
  /**
   * Delay before navigation (in milliseconds)
   */
  delay?: number;
  /**
   * Custom redirect path (optional)
   */
  customRedirectPath?: string;
}

export function usePostSignupNavigation(options: UsePostSignupNavigationOptions = {}) {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { email, isVerified, delay = 1500, customRedirectPath } = options;
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    // Only navigate if verification is successful
    if (!isVerified) {
      return;
    }

    // Set navigating state
    setIsNavigating(true);

    const navigate = async () => {
      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, delay));

      // If custom path is provided, use it
      if (customRedirectPath) {
        router.push(customRedirectPath);
        return;
      }

      // Check if user is authenticated (session available)
      if (status === 'authenticated' && session?.user) {
        const userRole = (session.user as any)?.role;
        
        // For org_admin, navigate to dashboard
        if (userRole === 'org_admin') {
          router.push('/dashboard');
          return;
        }
        
        // For other roles, navigate to dashboard
        router.push('/dashboard');
        return;
      }

      // If not authenticated yet, redirect to signin with flag
      if (email) {
        router.push('/auth/signin?fromSignup=true');
        return;
      }

      // Fallback to signin
      router.push('/auth/signin?fromSignup=true');
    };

    navigate();
  }, [isVerified, email, session, status, router, delay, customRedirectPath]);

  return {
    isNavigating,
  };
}

export default usePostSignupNavigation;

