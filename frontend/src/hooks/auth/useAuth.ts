/**
 * useAuth Hook
 * 
 * Provides authentication utilities and helpers
 * Uses NextAuth session and Zustand auth store
 */

import React from 'react';
import { useSession } from 'next-auth/react';
import { useAuthStore } from '@/store/auth.store';

export function useAuth() {
  const { data: session, status } = useSession();
  const { user, isAuthenticated, setUser, logout } = useAuthStore();

  // Sync NextAuth session with Zustand store
  React.useEffect(() => {
    if (session?.user && !user) {
      setUser({
        id: session.user.id || '',
        name: session.user.name || '',
        email: session.user.email || '',
        role: (session.user as any).role || 'user',
      });
    } else if (!session && user) {
      logout();
    }
  }, [session, user, setUser, logout]);

  return {
    user: user || session?.user,
    isAuthenticated: isAuthenticated || status === 'authenticated',
    isLoading: status === 'loading',
    session,
    logout,
  };
}

export default useAuth;

