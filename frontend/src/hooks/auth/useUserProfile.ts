import { useQuery } from '@tanstack/react-query';
import { authService } from '@/services/auth';

/**
 * Get current user profile
 * Returns null on error instead of throwing, so dashboard can still render
 */
export const useUserProfile = () => {
  return useQuery({
    queryKey: ['user', 'profile'],
    queryFn: async () => {
      try {
        const response = await authService.getCurrentUser();
        return response.data;
      } catch (error: any) {
        // Log error but don't throw - allow dashboard to render with fallback
        console.warn('Failed to fetch user profile:', error?.message || error);
        return null;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
    retryOnMount: false, // Don't retry on mount if it failed before
  });
};

