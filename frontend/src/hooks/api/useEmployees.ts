/**
 * useEmployees Hook
 * 
 * React Query hook for employee management operations
 * Used by org_admins to manage employees in their organization
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import fastApiClient from '@/lib/fastapi';
import { useSession } from 'next-auth/react';

export interface Employee {
  id: string;
  aaptorId: string;
  organizationId: string;
  name: string;
  email: string;
  status: 'pending' | 'active' | 'inactive';
  isPasswordSet: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeListResponse {
  employees: Employee[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AddEmployeeRequest {
  name: string;
  email: string;
}

export interface UpdateEmployeeRequest {
  name?: string;
  email?: string;
  status?: 'pending' | 'active' | 'inactive';
}

// Fetch employees list
export function useEmployees(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}) {
  const { data: session } = useSession();
  
  return useQuery<EmployeeListResponse>({
    queryKey: ['employees', params],
    queryFn: async () => {
      const token = (session as any)?.backendToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const queryParams = new URLSearchParams();
      if (params?.page) queryParams.append('page', params.page.toString());
      if (params?.limit) queryParams.append('limit', params.limit.toString());
      if (params?.search) queryParams.append('search', params.search);
      if (params?.status) queryParams.append('status', params.status);

      const response = await fastApiClient.get(`/api/v1/employees?${queryParams.toString()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data?.data || response.data;
    },
    enabled: !!session?.backendToken,
    staleTime: 30000, // 30 seconds
  });
}

// Add employee mutation
export function useAddEmployee() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (data: AddEmployeeRequest) => {
      const token = (session as any)?.backendToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fastApiClient.post(
        '/api/v1/employees',
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data?.data || response.data;
    },
    onSuccess: () => {
      // Invalidate employees list to refetch
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

// Update employee mutation
export function useUpdateEmployee() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async ({ aaptorId, data }: { aaptorId: string; data: UpdateEmployeeRequest }) => {
      const token = (session as any)?.backendToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fastApiClient.put(
        `/api/v1/employees/${aaptorId}`,
        data,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data?.data || response.data;
    },
    onSuccess: () => {
      // Invalidate employees list to refetch
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

// Delete employee mutation
export function useDeleteEmployee() {
  const queryClient = useQueryClient();
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (aaptorId: string) => {
      const token = (session as any)?.backendToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fastApiClient.delete(
        `/api/v1/employees/${aaptorId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    },
    onSuccess: () => {
      // Invalidate employees list to refetch
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

// Resend welcome email mutation
export function useResendWelcomeEmail() {
  const { data: session } = useSession();

  return useMutation({
    mutationFn: async (aaptorId: string) => {
      const token = (session as any)?.backendToken;
      if (!token) {
        throw new Error('Not authenticated');
      }

      const response = await fastApiClient.post(
        `/api/v1/employees/${aaptorId}/resend`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    },
  });
}

