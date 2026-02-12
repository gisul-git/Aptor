/**
 * useAuthGuard Hook
 * 
 * Checks authentication and authorization status
 * Returns state for displaying auth guard modal
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';

export type AuthGuardReason = 
  | 'not_authenticated' 
  | 'wrong_role' 
  | 'no_account' 
  | null;

export interface UseAuthGuardOptions {
  /**
   * Required role(s) to access the page
   * If not provided, any authenticated user can access
   */
  requiredRole?: string | string[];
  /**
   * Custom message for not authenticated
   */
  notAuthenticatedMessage?: string;
  /**
   * Custom message for wrong role
   */
  wrongRoleMessage?: string;
  /**
   * Redirect path after authentication (optional)
   */
  redirectAfterAuth?: string;
  /**
   * Whether to show modal instead of redirecting
   */
  showModal?: boolean;
}

export interface AuthGuardState {
  /**
   * Whether user is authenticated
   */
  isAuthenticated: boolean;
  /**
   * Whether auth check is loading
   */
  isLoading: boolean;
  /**
   * Reason for blocking access (null if access allowed)
   */
  reason: AuthGuardReason;
  /**
   * Whether to show the auth guard modal
   */
  showModal: boolean;
  /**
   * User's current role
   */
  userRole?: string;
  /**
   * User's email (if available)
   */
  userEmail?: string;
}

export function useAuthGuard(options: UseAuthGuardOptions = {}): AuthGuardState {
  const { data: session, status } = useSession();
  const router = useRouter();
  const {
    requiredRole,
    notAuthenticatedMessage,
    wrongRoleMessage,
    redirectAfterAuth,
    showModal: showModalOption = true,
  } = options;

  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState<AuthGuardReason>(null);

  const isLoading = status === 'loading';
  const isAuthenticated = status === 'authenticated' && !!session;
  const userRole = (session?.user as any)?.role;
  const userEmail = session?.user?.email || undefined;

  useEffect(() => {
    // Wait for session to load
    if (isLoading) {
      setShowModal(false);
      setReason(null);
      return;
    }

    // Check if user is authenticated
    if (!isAuthenticated) {
      setReason('not_authenticated');
      if (showModalOption) {
        setShowModal(true);
      } else {
        // Redirect to signin if modal is disabled
        const redirectPath = redirectAfterAuth || router.asPath;
        router.push(`/auth/signin?callbackUrl=${encodeURIComponent(redirectPath)}`);
      }
      return;
    }

    // Check role if required
    if (requiredRole) {
      const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
      const hasRequiredRole = userRole && requiredRoles.includes(userRole);

      if (!hasRequiredRole) {
        setReason('wrong_role');
        if (showModalOption) {
          setShowModal(true);
        } else {
          // Redirect to dashboard if wrong role
          router.push('/dashboard');
        }
        return;
      }
    }

    // All checks passed
    setReason(null);
    setShowModal(false);
  }, [
    isLoading,
    isAuthenticated,
    userRole,
    requiredRole,
    showModalOption,
    router,
    redirectAfterAuth,
  ]);

  return {
    isAuthenticated,
    isLoading,
    reason,
    showModal,
    userRole,
    userEmail,
  };
}

export default useAuthGuard;

