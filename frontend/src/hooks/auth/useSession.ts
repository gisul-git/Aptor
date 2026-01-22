/**
 * useSession Hook
 * 
 * Wrapper around NextAuth's useSession with additional utilities
 */

import { useSession as useNextAuthSession } from 'next-auth/react';

export function useSession() {
  const { data: session, status, update } = useNextAuthSession();

  return {
    session,
    user: session?.user,
    isAuthenticated: status === 'authenticated',
    isLoading: status === 'loading',
    isError: status === 'unauthenticated',
    update,
  };
}

export default useSession;



