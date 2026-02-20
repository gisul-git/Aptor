import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/api/client';

export interface Organization {
  id: string;
  orgId: string;
  name: string;
  employeeCounter?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface OrganizationResponse {
  success: boolean;
  data: Organization;
  message?: string;
}

/**
 * Hook to fetch organization details by orgId
 */
export const useOrganization = (orgId: string | null | undefined) => {
  return useQuery({
    queryKey: ['organization', orgId],
    queryFn: async () => {
      if (!orgId) {
        return null;
      }

      try {
        const response = await apiClient.get<OrganizationResponse>(
          `/api/organizations/${orgId}`
        );
        return response.data.data;
      } catch (error: any) {
        console.warn('Failed to fetch organization:', error?.message || error);
        return null;
      }
    },
    enabled: !!orgId,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
  });
};

