/**
 * Dashboard Card Hook
 * Provides computed values and configuration for dashboard cards
 */

import { useMemo } from 'react';
import type { AssessmentType, DisplayStatus } from '@/utils/cardConfig';
import { 
  TYPE_BADGES, 
  STATUS_COLORS, 
  getNavigationPaths, 
  getButtonVisibility,
  type ButtonVisibility 
} from '@/utils/cardConfig';

export interface CardInput {
  id: string;
  title: string;
  status?: string;
  type?: AssessmentType;
  hasSchedule?: boolean;
  scheduleStatus?: {
    startTime?: string;
    endTime?: string;
    duration?: number;
    isActive?: boolean;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  isDraft?: boolean;
  is_published?: boolean;
  is_active?: boolean;
  pausedAt?: string;
}

export interface UseDashboardCardReturn {
  displayStatus: DisplayStatus;
  statusColors: { bg: string; text: string; border: string; icon?: string };
  schedule: {
    hasSchedule: boolean;
    startTime?: string;
    endTime?: string;
    duration?: number;
    isActive?: boolean;
  };
  cardStyle: {
    border: string;
    backgroundColor: string;
    boxShadow: string;
    hoverBoxShadow: string;
  };
  typeBadge: {
    label: string;
    colors: { bg: string; text: string; border: string };
  };
  actions: ButtonVisibility;
  navigation: {
    editPath: string;
    analyticsPath: string;
  };
  metadata: {
    formattedCreatedAt: string;
  };
}

/**
 * Hook to compute dashboard card display values
 */
export function useDashboardCard(input: CardInput): UseDashboardCardReturn {
  // Determine display status
  const displayStatus = useMemo((): DisplayStatus => {
    if (input.pausedAt) {
      return 'paused';
    }
    
    if (input.isDraft) {
      return 'draft';
    }
    
    if (input.status === 'ready' || input.status === 'draft') {
      return 'draft';
    }
    
    if (input.status === 'scheduled') {
      return 'scheduled';
    }
    
    if (input.status === 'active' || input.is_active) {
      return 'active';
    }
    
    if (input.is_published) {
      return 'published';
    }
    
    if (input.status === 'completed') {
      return 'completed';
    }
    
    // Default to draft if status is unclear
    return 'draft';
  }, [input.status, input.isDraft, input.is_published, input.is_active, input.pausedAt]);

  // Get status colors
  const statusColors = useMemo(() => {
    return STATUS_COLORS[displayStatus];
  }, [displayStatus]);

  // Get type badge
  const typeBadge = useMemo(() => {
    const type = input.type || 'assessment';
    return TYPE_BADGES[type];
  }, [input.type]);

  // Get schedule info
  const schedule = useMemo(() => {
    return {
      hasSchedule: input.hasSchedule || false,
      startTime: input.scheduleStatus?.startTime,
      endTime: input.scheduleStatus?.endTime,
      duration: input.scheduleStatus?.duration,
      isActive: input.scheduleStatus?.isActive,
    };
  }, [input.hasSchedule, input.scheduleStatus]);

  // Get navigation paths
  const navigation = useMemo(() => {
    const type = input.type || 'assessment';
    return getNavigationPaths(type, displayStatus, input.id);
  }, [input.type, displayStatus, input.id]);

  // Get button visibility
  const actions = useMemo(() => {
    return getButtonVisibility(displayStatus);
  }, [displayStatus]);

  // Format created date
  const formattedCreatedAt = useMemo(() => {
    if (!input.createdAt) return 'N/A';
    try {
      return new Date(input.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return input.createdAt;
    }
  }, [input.createdAt]);

  // Card styling
  const cardStyle = useMemo(() => {
    return {
      border: '1px solid #E8FAF0',
      backgroundColor: '#ffffff',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
      hoverBoxShadow: '0 4px 12px rgba(168, 232, 188, 0.2)',
    };
  }, []);

  return {
    displayStatus,
    statusColors,
    schedule,
    cardStyle,
    typeBadge,
    actions,
    navigation,
    metadata: {
      formattedCreatedAt,
    },
  };
}

