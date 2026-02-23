/**
 * Universal Dashboard Card Configuration
 * Provides consistent configuration for all assessment type cards
 */

export type AssessmentType = 'assessment' | 'dsa' | 'aiml' | 'custom_mcq' | 'design' | 'data_engineering' | 'cloud' | 'devops';
export type DisplayStatus = 'draft' | 'active' | 'paused' | 'completed' | 'scheduled' | 'published';

export interface TypeBadgeConfig {
  label: string;
  colors: {
    bg: string;
    text: string;
    border: string;
  };
}

/**
 * Type badge configuration for all assessment types
 */
export const TYPE_BADGES: Record<AssessmentType, TypeBadgeConfig> = {
  'assessment': {
    label: 'AI Assessment',
    colors: {
      bg: '#DBEAFE',
      text: '#1E40AF',
      border: '#3B82F6'
    }
  },
  'dsa': {
    label: 'DSA',
    colors: {
      bg: '#E8FAF0',
      text: '#2D7A52',
      border: '#A8E8BC'
    }
  },
  'aiml': {
    label: 'AIML',
    colors: {
      bg: '#C9F4D4',
      text: '#1E5A3B',
      border: '#A8E8BC'
    }
  },
  'custom_mcq': {
    label: 'Custom MCQ',
    colors: {
      bg: '#EDE9FE',
      text: '#7C3AED',
      border: '#C4B5FD'
    }
  },
  'design': {
    label: 'Design',
    colors: {
      bg: '#FEF3C7',
      text: '#92400E',
      border: '#FCD34D'
    }
  },
  'data_engineering': {
    label: 'Data Engineering',
    colors: {
      bg: '#DBEAFE',
      text: '#1E40AF',
      border: '#60A5FA'
    }
  },
  'cloud': {
    label: 'Cloud',
    colors: {
      bg: '#E0E7FF',
      text: '#4338CA',
      border: '#818CF8'
    }
  },
  'devops': {
    label: 'DevOps',
    colors: {
      bg: '#FCE7F3',
      text: '#9F1239',
      border: '#F472B6'
    }
  }
};

/**
 * Status color configuration
 */
export const STATUS_COLORS: Record<DisplayStatus, { bg: string; text: string; border: string; icon?: string }> = {
  'draft': {
    bg: 'rgba(201, 244, 212, 0.2)',
    text: '#1E5A3B',
    border: '#C9F4D4'
  },
  'scheduled': {
    bg: 'rgba(201, 244, 212, 0.2)',
    text: '#1E5A3B',
    border: '#C9F4D4'
  },
  'active': {
    bg: '#dbeafe',
    text: '#1e40af',
    border: '#3b82f6'
  },
  'paused': {
    bg: '#fef3c7',
    text: '#92400e',
    border: '#f59e0b',
    icon: '⏸️'
  },
  'published': {
    bg: '#dbeafe',
    text: '#1e40af',
    border: '#3b82f6'
  },
  'completed': {
    bg: '#f3f4f6',
    text: '#6b7280',
    border: '#9ca3af'
  }
};

/**
 * Get navigation paths based on assessment type and status
 */
export function getNavigationPaths(type: AssessmentType, status: DisplayStatus, id: string) {
  const paths = {
    editPath: '',
    analyticsPath: ''
  };

  if (type === 'dsa') {
    paths.editPath = `/dsa/tests/${id}/edit`;
    paths.analyticsPath = `/dsa/tests/${id}/analytics`;
  } else if (type === 'aiml') {
    paths.editPath = `/aiml/tests/${id}/edit`;
    paths.analyticsPath = `/aiml/tests/${id}/analytics`;
  } else if (type === 'custom_mcq') {
    paths.editPath = `/custom-mcq/create?id=${id}`;
    paths.analyticsPath = `/custom-mcq/${id}`;
  } else if (type === 'design') {
    paths.editPath = `/design/tests/${id}/edit`;
    paths.analyticsPath = `/design/tests/${id}/analytics`;
  } else if (type === 'data_engineering') {
    paths.editPath = `/data-engineering/tests/${id}/edit`;
    paths.analyticsPath = `/data-engineering/tests/${id}/analytics`;
  } else if (type === 'cloud') {
    paths.editPath = `/cloud/tests/${id}/edit`;
    paths.analyticsPath = `/cloud/tests/${id}/analytics`;
  } else if (type === 'devops') {
    paths.editPath = `/devops/tests/${id}/edit`;
    paths.analyticsPath = `/devops/tests/${id}/analytics`;
  } else {
    // Regular assessment
    paths.editPath = `/assessments/create-new?id=${id}`;
    paths.analyticsPath = `/assessments/${id}/analytics`;
  }

  return paths;
}

/**
 * Get button visibility rules based on status
 */
export interface ButtonVisibility {
  showEdit: boolean;
  showAnalytics: boolean;
  showDelete: boolean;
  showPause: boolean;
  showResume: boolean;
  showClone: boolean;
}

export function getButtonVisibility(status: DisplayStatus): ButtonVisibility {
  return {
    showEdit: status === 'draft' || status === 'paused',
    showAnalytics: status === 'active' || status === 'published' || status === 'scheduled' || status === 'completed',
    showDelete: true, // Always show delete
    showPause: status === 'active' || status === 'scheduled',
    showResume: status === 'paused',
    showClone: true // Always show clone
  };
}

