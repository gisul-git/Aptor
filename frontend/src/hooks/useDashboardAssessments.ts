/**
 * Dashboard Assessments Hook
 * Combines all assessments from different services and provides helper flags
 */

import { useMemo } from 'react';
import { useSession } from 'next-auth/react';
import { useAssessments } from './api/useAssessments';
import { useCustomMCQAssessments } from './api/useCustomMCQ';
import { useDSATests } from './api/useDSA';
import { useAIMLTests } from './api/useAIML';
import { useDesignTests } from './api/useDesign';
import { useDataEngineeringTests } from './api/useDataEngineering';
import { useCloudTests } from './api/useCloud';
import { useDevOpsTests } from './api/useDevOps';

export interface Assessment {
  id: string;
  title: string;
  status?: string;
  hasSchedule: boolean;
  scheduleStatus?: {
    startTime?: string;
    endTime?: string;
    duration?: number;
    isActive?: boolean;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  type?: 'assessment' | 'dsa' | 'custom_mcq' | 'aiml' | 'design' | 'data_engineering' | 'cloud' | 'devops';
  isDraft?: boolean;
  is_published?: boolean;
  is_active?: boolean;
  pausedAt?: string;
}

export interface UseDashboardAssessmentsReturn {
  // Combined assessments array
  assessments: Assessment[];
  
  // Service availability flags
  hasAIAssessments: boolean;
  hasCustomMCQAssessments: boolean;
  hasDSAAssessments: boolean;
  hasAIMLAssessments: boolean;
  hasDesignAssessments: boolean;
  hasDataEngineeringAssessments: boolean;
  hasCloudAssessments: boolean;
  hasDevOpsAssessments: boolean;
  
  // Loading states
  isLoading: boolean;
  
  // Error states
  error: string | null;
}

/**
 * Hook to combine all assessments from different services
 * and provide flags for which services have assessments
 */
export function useDashboardAssessments(): UseDashboardAssessmentsReturn {
  const { data: session } = useSession();
  
  // Fetch data from all services
  const { data: assessmentsData, isLoading: assessmentsLoading, error: assessmentsError } = useAssessments();
  const { data: customMCQData, isLoading: customMCQLoading, error: customMCQError } = useCustomMCQAssessments();
  const { data: dsaTestsData, isLoading: dsaLoading, error: dsaError } = useDSATests();
  const { data: aimlTestsData, isLoading: aimlLoading, error: aimlError } = useAIMLTests();
  const { data: designTestsData, isLoading: designLoading, error: designError } = useDesignTests();
  const { data: dataEngineeringTestsData, isLoading: dataEngineeringLoading, error: dataEngineeringError } = useDataEngineeringTests();
  const { data: cloudTestsData, isLoading: cloudLoading, error: cloudError } = useCloudTests();
  const { data: devopsTestsData, isLoading: devopsLoading, error: devopsError } = useDevOpsTests();

  // Get current user ID for filtering
  const currentUserId = useMemo(() => 
    (session?.user as any)?.id,
    [session]
  );

  // Check if each service has assessments
  const hasAIAssessments = useMemo(() => {
    return !!(assessmentsData && Array.isArray(assessmentsData) && assessmentsData.length > 0);
  }, [assessmentsData]);

  const hasCustomMCQAssessments = useMemo(() => {
    if (!customMCQData) return false;
    const assessmentsList = Array.isArray(customMCQData) ? customMCQData : [];
    return assessmentsList.length > 0;
  }, [customMCQData]);

  const hasDSAAssessments = useMemo(() => {
    if (!dsaTestsData || !currentUserId) return false;
    return dsaTestsData.some((test: any) => {
      const testCreatedBy = test.created_by;
      if (!testCreatedBy) return false;
      const testCreatedByStr = String(testCreatedBy).trim();
      const currentUserIdStr = String(currentUserId).trim();
      return testCreatedByStr === currentUserIdStr;
    });
  }, [dsaTestsData, currentUserId]);

  const hasAIMLAssessments = useMemo(() => {
    if (!aimlTestsData || !currentUserId) return false;
    return aimlTestsData.some((test: any) => {
      const testCreatedBy = test.created_by;
      if (!testCreatedBy) return false;
      const testCreatedByStr = String(testCreatedBy).trim();
      const currentUserIdStr = String(currentUserId).trim();
      return testCreatedByStr === currentUserIdStr;
    });
  }, [aimlTestsData, currentUserId]);

  const hasDesignAssessments = useMemo(() => {
    if (!designTestsData || !currentUserId) return false;
    return designTestsData.some((test: any) => {
      const testCreatedBy = test.created_by;
      if (!testCreatedBy) return false;
      const testCreatedByStr = String(testCreatedBy).trim();
      const currentUserIdStr = String(currentUserId).trim();
      return testCreatedByStr === currentUserIdStr;
    });
  }, [designTestsData, currentUserId]);

  const hasDataEngineeringAssessments = useMemo(() => {
    if (!dataEngineeringTestsData || !currentUserId) return false;
    return dataEngineeringTestsData.some((test: any) => {
      const testCreatedBy = test.created_by;
      if (!testCreatedBy) return false;
      const testCreatedByStr = String(testCreatedBy).trim();
      const currentUserIdStr = String(currentUserId).trim();
      return testCreatedByStr === currentUserIdStr;
    });
  }, [dataEngineeringTestsData, currentUserId]);

  const hasCloudAssessments = useMemo(() => {
    if (!cloudTestsData || !currentUserId) return false;
    return cloudTestsData.some((test: any) => {
      const testCreatedBy = test.created_by;
      if (!testCreatedBy) return false;
      const testCreatedByStr = String(testCreatedBy).trim();
      const currentUserIdStr = String(currentUserId).trim();
      return testCreatedByStr === currentUserIdStr;
    });
  }, [cloudTestsData, currentUserId]);

  const hasDevOpsAssessments = useMemo(() => {
    if (!devopsTestsData || !currentUserId) return false;
    return devopsTestsData.some((test: any) => {
      const testCreatedBy = test.created_by;
      if (!testCreatedBy) return false;
      const testCreatedByStr = String(testCreatedBy).trim();
      const currentUserIdStr = String(currentUserId).trim();
      return testCreatedByStr === currentUserIdStr;
    });
  }, [devopsTestsData, currentUserId]);

  // Combine all assessments into a single array
  const assessments = useMemo(() => {
    const allAssessments: Assessment[] = [];
    
    // Process regular assessments
    if (assessmentsData) {
      const regularAssessments = assessmentsData.map((a: any) => ({
        ...a,
        type: 'assessment' as const
      }));
      allAssessments.push(...regularAssessments);
    }
    
    // Process custom MCQ tests
    if (customMCQData) {
      const assessmentsList = Array.isArray(customMCQData) ? customMCQData : [];
      const customMcqTests = assessmentsList.map((test: any) => {
        let status = 'draft';
        if (test.pausedAt) {
          status = 'paused';
        } else {
          status = test.status || 'draft';
        }
        const isDraft = status === 'draft';
        
        const schedule = test.schedule || {};
        const hasSchedule = !!(schedule.startTime || schedule.endTime || test.startTime || test.endTime);
        const scheduleStatus = hasSchedule ? {
          startTime: schedule.startTime || test.startTime,
          endTime: schedule.endTime || test.endTime,
          duration: schedule.duration || test.duration,
          isActive: status === 'active',
        } : null;
        
        return {
          id: test.id,
          title: test.title || 'Untitled Custom MCQ/Subjective Test',
          status: status as 'draft' | 'active' | 'paused',
          isDraft: isDraft,
          hasSchedule: hasSchedule,
          scheduleStatus: scheduleStatus,
          createdAt: test.createdAt,
          updatedAt: test.updatedAt || test.createdAt,
          type: 'custom_mcq' as const,
          pausedAt: test.pausedAt,
        };
      });
      allAssessments.push(...customMcqTests);
    }
    
    // Process DSA tests
    if (dsaTestsData && currentUserId) {
      const dsaTests = dsaTestsData
        .filter((test: any) => {
          const testCreatedBy = test.created_by;
          if (!testCreatedBy) return false;
          const testCreatedByStr = String(testCreatedBy).trim();
          const currentUserIdStr = String(currentUserId).trim();
          return testCreatedByStr === currentUserIdStr;
        })
        .map((test: any) => {
          let status = 'draft';
          if (test.pausedAt) {
            status = 'paused';
          } else if (test.is_published) {
            status = 'active';
          }
          
          const schedule = test.schedule;
          const hasSchedule = schedule !== null && schedule !== undefined && !!(test.start_time && test.end_time);
          
          return {
            id: test.id || test._id,
            title: test.title || 'Untitled DSA Test',
            status: status as 'draft' | 'active' | 'paused',
            hasSchedule: hasSchedule,
            scheduleStatus: hasSchedule ? {
              startTime: test.start_time,
              endTime: test.end_time,
              duration: test.duration_minutes || 0,
              isActive: test.is_active || false
            } : null,
            createdAt: test.created_at || null,
            updatedAt: test.updated_at || null,
            type: 'dsa' as const,
            is_published: test.is_published,
            is_active: test.is_active,
            pausedAt: test.pausedAt
          };
        });
      allAssessments.push(...dsaTests);
    }
    
    // Process AIML tests
    if (aimlTestsData && currentUserId) {
      const aimlTests = aimlTestsData
        .filter((test: any) => {
          const testCreatedBy = test.created_by;
          if (!testCreatedBy) return false;
          const testCreatedByStr = String(testCreatedBy).trim();
          const currentUserIdStr = String(currentUserId).trim();
          return testCreatedByStr === currentUserIdStr;
        })
        .map((test: any) => {
          let status = 'draft';
          if (test.pausedAt) {
            status = 'paused';
          } else if (test.is_published) {
            status = 'active';
          }
          
          const schedule = test.schedule;
          const hasSchedule = schedule !== null && schedule !== undefined && !!(test.start_time && test.end_time);
          
          return {
            id: test.id || test._id,
            title: test.title || 'Untitled AIML Test',
            status: status as 'draft' | 'active' | 'paused',
            hasSchedule: hasSchedule,
            scheduleStatus: hasSchedule ? {
              startTime: test.start_time,
              endTime: test.end_time,
              duration: schedule?.duration || test.duration_minutes || 0,
              isActive: test.is_published || false
            } : null,
            createdAt: test.created_at || null,
            updatedAt: test.updated_at || null,
            type: 'aiml' as const,
            is_published: test.is_published,
            is_active: test.is_active,
            pausedAt: test.pausedAt
          };
        });
      allAssessments.push(...aimlTests);
    }
    
    // Process Design tests
    if (designTestsData && currentUserId) {
      const designTests = designTestsData
        .filter((test: any) => {
          const testCreatedBy = test.created_by;
          if (!testCreatedBy) return false;
          const testCreatedByStr = String(testCreatedBy).trim();
          const currentUserIdStr = String(currentUserId).trim();
          return testCreatedByStr === currentUserIdStr;
        })
        .map((test: any) => {
          let status = 'draft';
          if (test.pausedAt) {
            status = 'paused';
          } else if (test.is_published) {
            status = 'active';
          }
          
          const schedule = test.schedule;
          const hasSchedule = schedule !== null && schedule !== undefined && !!(test.start_time && test.end_time);
          
          return {
            id: test.id || test._id,
            title: test.title || 'Untitled Design Test',
            status: status as 'draft' | 'active' | 'paused',
            hasSchedule: hasSchedule,
            scheduleStatus: hasSchedule ? {
              startTime: test.start_time,
              endTime: test.end_time,
              duration: test.duration_minutes || 0,
              isActive: test.is_active || false
            } : null,
            createdAt: test.created_at || null,
            updatedAt: test.updated_at || null,
            type: 'design' as const,
            is_published: test.is_published,
            is_active: test.is_active,
            pausedAt: test.pausedAt
          };
        });
      allAssessments.push(...designTests);
    }
    
    // Process Data Engineering tests
    if (dataEngineeringTestsData && currentUserId) {
      const dataEngineeringTests = dataEngineeringTestsData
        .filter((test: any) => {
          const testCreatedBy = test.created_by;
          if (!testCreatedBy) return false;
          const testCreatedByStr = String(testCreatedBy).trim();
          const currentUserIdStr = String(currentUserId).trim();
          return testCreatedByStr === currentUserIdStr;
        })
        .map((test: any) => {
          let status = 'draft';
          if (test.pausedAt) {
            status = 'paused';
          } else if (test.is_published) {
            status = 'active';
          }
          
          const schedule = test.schedule;
          const hasSchedule = schedule !== null && schedule !== undefined && !!(test.start_time && test.end_time);
          
          return {
            id: test.id || test._id,
            title: test.title || 'Untitled Data Engineering Test',
            status: status as 'draft' | 'active' | 'paused',
            hasSchedule: hasSchedule,
            scheduleStatus: hasSchedule ? {
              startTime: test.start_time,
              endTime: test.end_time,
              duration: test.duration_minutes || 0,
              isActive: test.is_active || false
            } : null,
            createdAt: test.created_at || null,
            updatedAt: test.updated_at || null,
            type: 'data_engineering' as const,
            is_published: test.is_published,
            is_active: test.is_active,
            pausedAt: test.pausedAt
          };
        });
      allAssessments.push(...dataEngineeringTests);
    }
    
    // Process Cloud tests
    if (cloudTestsData && currentUserId) {
      const cloudTests = cloudTestsData
        .filter((test: any) => {
          const testCreatedBy = test.created_by;
          if (!testCreatedBy) return false;
          const testCreatedByStr = String(testCreatedBy).trim();
          const currentUserIdStr = String(currentUserId).trim();
          return testCreatedByStr === currentUserIdStr;
        })
        .map((test: any) => {
          let status = 'draft';
          if (test.pausedAt) {
            status = 'paused';
          } else if (test.is_published) {
            status = 'active';
          }
          
          const schedule = test.schedule;
          const hasSchedule = schedule !== null && schedule !== undefined && !!(test.start_time && test.end_time);
          
          return {
            id: test.id || test._id,
            title: test.title || 'Untitled Cloud Test',
            status: status as 'draft' | 'active' | 'paused',
            hasSchedule: hasSchedule,
            scheduleStatus: hasSchedule ? {
              startTime: test.start_time,
              endTime: test.end_time,
              duration: test.duration_minutes || 0,
              isActive: test.is_active || false
            } : null,
            createdAt: test.created_at || null,
            updatedAt: test.updated_at || null,
            type: 'cloud' as const,
            is_published: test.is_published,
            is_active: test.is_active,
            pausedAt: test.pausedAt
          };
        });
      allAssessments.push(...cloudTests);
    }
    
    // Process DevOps tests
    if (devopsTestsData && currentUserId) {
      const devopsTests = devopsTestsData
        .filter((test: any) => {
          const testCreatedBy = test.created_by;
          if (!testCreatedBy) return false;
          const testCreatedByStr = String(testCreatedBy).trim();
          const currentUserIdStr = String(currentUserId).trim();
          return testCreatedByStr === currentUserIdStr;
        })
        .map((test: any) => {
          let status = 'draft';
          if (test.pausedAt) {
            status = 'paused';
          } else if (test.is_published) {
            status = 'active';
          }
          
          const schedule = test.schedule;
          const hasSchedule = schedule !== null && schedule !== undefined && !!(test.start_time && test.end_time);
          
          return {
            id: test.id || test._id,
            title: test.title || 'Untitled DevOps Test',
            status: status as 'draft' | 'active' | 'paused',
            hasSchedule: hasSchedule,
            scheduleStatus: hasSchedule ? {
              startTime: test.start_time,
              endTime: test.end_time,
              duration: test.duration_minutes || 0,
              isActive: test.is_active || false
            } : null,
            createdAt: test.created_at || null,
            updatedAt: test.updated_at || null,
            type: 'devops' as const,
            is_published: test.is_published,
            is_active: test.is_active,
            pausedAt: test.pausedAt
          };
        });
      allAssessments.push(...devopsTests);
    }
    
    // Sort by creation date (newest first)
    allAssessments.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    
    return allAssessments;
  }, [assessmentsData, customMCQData, dsaTestsData, aimlTestsData, designTestsData, dataEngineeringTestsData, cloudTestsData, devopsTestsData, currentUserId]);

  // Combined loading state
  const isLoading = assessmentsLoading || customMCQLoading || dsaLoading || aimlLoading || designLoading || dataEngineeringLoading || cloudLoading || devopsLoading;

  // Combined error state
  const error = useMemo(() => {
    const errors = [
      assessmentsError?.message,
      customMCQError?.message,
      dsaError?.message,
      aimlError?.message,
      designError?.message,
      dataEngineeringError?.message,
      cloudError?.message,
      devopsError?.message
    ].filter(Boolean);
    return errors.length > 0 ? errors[0] || null : null;
  }, [assessmentsError, customMCQError, dsaError, aimlError, designError, dataEngineeringError, cloudError, devopsError]);

  return {
    assessments,
    hasAIAssessments,
    hasCustomMCQAssessments,
    hasDSAAssessments,
    hasAIMLAssessments,
    hasDesignAssessments,
    hasDataEngineeringAssessments,
    hasCloudAssessments,
    hasDevOpsAssessments,
    isLoading,
    error
  };
}

