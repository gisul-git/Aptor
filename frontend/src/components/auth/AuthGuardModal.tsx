/**
 * AuthGuardModal Component
 * 
 * Displays a modal popup when user tries to access protected content
 * without proper authentication or authorization
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '../dsa/ui/card';
import { Button } from '../dsa/ui/button';
import { AlertCircle, LogIn, UserPlus, X, Shield } from 'lucide-react';
import type { AuthGuardReason } from '@/hooks/auth/useAuthGuard';

interface AuthGuardModalProps {
  /**
   * Whether the modal is visible
   */
  isOpen: boolean;
  /**
   * Reason for blocking access
   */
  reason: AuthGuardReason;
  /**
   * User's current role (if authenticated but wrong role)
   */
  userRole?: string;
  /**
   * User's email (if available)
   */
  userEmail?: string;
  /**
   * Required role(s) for access
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
   * Callback when modal is closed
   */
  onClose?: () => void;
  /**
   * Redirect path after authentication
   */
  redirectAfterAuth?: string;
}

export default function AuthGuardModal({
  isOpen,
  reason,
  userRole,
  userEmail,
  requiredRole,
  notAuthenticatedMessage,
  wrongRoleMessage,
  onClose,
  redirectAfterAuth,
}: AuthGuardModalProps) {
  const router = useRouter();

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen || !reason) {
    return null;
  }

  const handleSignIn = () => {
    const callbackUrl = redirectAfterAuth || router.asPath;
    router.push(`/auth/signin?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  const handleSignUp = () => {
    const callbackUrl = redirectAfterAuth || router.asPath;
    router.push(`/auth/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  };

  const handleGoToDashboard = () => {
    router.push('/dashboard');
    onClose?.();
  };

  const getTitle = (): string => {
    switch (reason) {
      case 'not_authenticated':
        return 'Authentication Required';
      case 'wrong_role':
        return 'Access Denied';
      case 'no_account':
        return 'Account Required';
      default:
        return 'Access Restricted';
    }
  };

  const getMessage = (): string => {
    if (reason === 'not_authenticated') {
      return (
        notAuthenticatedMessage ||
        'You need to sign in to access this page. Please sign in with your account or create a new account to continue.'
      );
    }

    if (reason === 'wrong_role') {
      const requiredRolesText = Array.isArray(requiredRole)
        ? requiredRole.join(' or ')
        : requiredRole || 'required role';
      
      return (
        wrongRoleMessage ||
        `This page is only accessible to users with ${requiredRolesText} role. Your current role is ${userRole || 'unknown'}.`
      );
    }

    if (reason === 'no_account') {
      return 'You need to create an account to access this page. Please sign up to continue.';
    }

    return 'You do not have permission to access this page.';
  };

  const getIcon = () => {
    switch (reason) {
      case 'not_authenticated':
        return <LogIn className="h-6 w-6 text-blue-500" />;
      case 'wrong_role':
        return <Shield className="h-6 w-6 text-orange-500" />;
      case 'no_account':
        return <UserPlus className="h-6 w-6 text-purple-500" />;
      default:
        return <AlertCircle className="h-6 w-6 text-red-500" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader className="relative">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">{getIcon()}</div>
            <div className="flex-1">
              <CardTitle className="text-xl">{getTitle()}</CardTitle>
              {userEmail && reason === 'wrong_role' && (
                <p className="text-sm text-muted-foreground mt-1">
                  Signed in as: {userEmail}
                </p>
              )}
            </div>
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="absolute top-4 right-4 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            {getMessage()}
          </p>

          <div className="flex flex-col gap-2 pt-2">
            {reason === 'not_authenticated' && (
              <>
                <Button onClick={handleSignIn} className="w-full">
                  <LogIn className="h-4 w-4 mr-2" />
                  Sign In
                </Button>
                <Button onClick={handleSignUp} variant="outline" className="w-full">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Account
                </Button>
              </>
            )}

            {reason === 'wrong_role' && (
              <>
                <Button onClick={handleGoToDashboard} className="w-full">
                  Go to Dashboard
                </Button>
                {onClose && (
                  <Button onClick={onClose} variant="outline" className="w-full">
                    Close
                  </Button>
                )}
              </>
            )}

            {reason === 'no_account' && (
              <Button onClick={handleSignUp} className="w-full">
                <UserPlus className="h-4 w-4 mr-2" />
                Create Account
              </Button>
            )}
          </div>

          {reason === 'not_authenticated' && (
            <p className="text-xs text-center text-muted-foreground pt-2 border-t">
              Don't have an account? Click "Create Account" to sign up.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

