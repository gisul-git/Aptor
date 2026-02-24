/**
 * FAANG-level assessment card with rich metadata, stats grid, progress bar, and action buttons
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useDashboardCard, type CardInput } from '@/hooks/useDashboardCard';
import type { AssessmentType } from '@/utils/cardConfig';
import { COMPETENCY_GRADIENTS, getAssignPath, TYPE_BADGES } from '@/utils/cardConfig';
import {
  FileText,
  Clock,
  Users,
  BarChart3,
  BarChart2,
  MoreVertical,
  Calendar,
  Play,
  Pause,
  Pencil,
  Trash2,
  Copy,
  UserPlus,
  ArrowRight,
  Code,
  Cpu,
  Cloud,
  Paintbrush,
  Server,
  Database,
  AlertTriangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

export interface AssessmentCardEnhancedProps extends CardInput {
  isMenuOpen: boolean;
  onMenuToggle: () => void;
  onPause: (id: string, e: React.MouseEvent) => void;
  onResume: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, title: string, type?: AssessmentType) => void;
  onClone: (id: string, title: string) => void;
  questionCount?: number | null;
  assignedCount?: number | null;
  totalAssigned?: number | null;
  avgScore?: number | null;
  assignedTo?: string[] | null;
  /** Completion % for progress bar (0-100). Derived from assigned/in-progress if not provided. */
  progressPercent?: number | null;
  index?: number;
  /** When true, card is in list view: horizontal stats (grid-cols-4), reduced padding/sizes */
  isListView?: boolean;
}

const COMPETENCY_ICONS: Record<AssessmentType, LucideIcon> = {
  assessment: FileText,
  dsa: Code,
  aiml: Cpu,
  custom_mcq: FileText,
  design: Paintbrush,
  data_engineering: Database,
  cloud: Cloud,
  devops: Server,
};

function getDisplayTitle(type: AssessmentType, title: string | undefined): string {
  const t = (title || '').trim();
  const lower = t.toLowerCase();
  const label = TYPE_BADGES[type].label;
  if (lower === 'dsa') return 'DSA Competency Assessment';
  if (lower === 'aiml' || lower === 'ai/ml') return `${label} Assessment`;
  if (t.length <= 4 || lower === type.replace('_', '') || lower === label.toLowerCase()) return `${label} Assessment`;
  if (lower.includes('new') && t.length < 15) return `${label} Assessment`;
  if (lower === 'dsa new' || (lower.startsWith('dsa') && t.length < 12)) return 'DSA Assessment';
  return t || `${label} Assessment`;
}

function formatDuration(minutes: number | undefined): string {
  if (minutes == null || minutes <= 0) return '—';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatRelativeTime(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return d.toLocaleDateString();
  } catch {
    return '';
  }
}

function formatScheduledTime(startTime: string | undefined): string {
  if (!startTime) return '';
  try {
    const d = new Date(startTime);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return startTime;
  }
}

function isNoActivity30Days(updatedAt: string | undefined): boolean {
  if (!updatedAt) return false;
  try {
    const d = new Date(updatedAt);
    const now = new Date();
    const diffDays = (now.getTime() - d.getTime()) / (24 * 60 * 60 * 1000);
    return diffDays >= 30;
  } catch {
    return false;
  }
}

export default function AssessmentCardEnhanced(props: AssessmentCardEnhancedProps) {
  const router = useRouter();
  const {
    displayStatus,
    statusColors,
    schedule,
    typeBadge,
    actions,
    navigation,
    metadata,
  } = useDashboardCard(props);

  const [progressWidth, setProgressWidth] = useState(0);
  const type = (props.type || 'assessment') as AssessmentType;
  const gradient = COMPETENCY_GRADIENTS[type];
  const assignPath = getAssignPath(type, props.id);

  const durationStr = formatDuration(schedule.duration);
  const updatedAgo = formatRelativeTime(props.updatedAt);
  const scheduledStr = formatScheduledTime(schedule.startTime);
  const questionCount = props.questionCount ?? null;
  const totalAssigned = props.totalAssigned ?? 0;
  const assignedCount = props.assignedCount ?? 0;
  const hasAssigned = totalAssigned > 0;
  const assignedLabel = hasAssigned
    ? `${assignedCount}/${totalAssigned}`
    : '—';
  const avgScoreStr =
    props.avgScore != null ? `${Math.round(props.avgScore)}%` : '—';
  const progressPercent =
    props.progressPercent != null
      ? props.progressPercent
      : hasAssigned && totalAssigned > 0
        ? Math.round((assignedCount / totalAssigned) * 100)
        : displayStatus === 'draft' || displayStatus === 'paused'
          ? 0
          : 73;
  const showNoActivityWarning = isNoActivity30Days(props.updatedAt);

  const viewDetailsPath =
    navigation.analyticsPath || navigation.editPath || assignPath;

  useEffect(() => {
    const t = setTimeout(() => setProgressWidth(progressPercent), 100);
    return () => clearTimeout(t);
  }, [progressPercent]);

  const handleCardClick = () => {
    if (type === 'dsa') {
      router.push(`/dsa/tests/${props.id}/edit`);
    } else if (type === 'aiml') {
      router.push(`/aiml/tests/${props.id}/edit`);
    } else if (type === 'design') {
      router.push(`/design/tests/${props.id}/edit`);
    } else if (type === 'data_engineering') {
      router.push(`/data-engineering/tests/${props.id}/edit`);
    } else if (type === 'cloud') {
      router.push(`/cloud/tests/${props.id}/edit`);
    } else if (type === 'devops') {
      router.push(`/devops/tests/${props.id}/edit`);
    } else if (displayStatus === 'draft') {
      if (type === 'custom_mcq') {
        router.push(`/custom-mcq/create?id=${props.id}`);
      } else {
        router.push(`/assessments/create-new?id=${props.id}`);
      }
    } else {
      if (type === 'custom_mcq') {
        router.push(`/custom-mcq/${props.id}`);
      } else if (navigation.analyticsPath) {
        router.push(navigation.analyticsPath);
      }
    }
  };

  const statusBorderClass =
    displayStatus === 'active' || displayStatus === 'published'
      ? 'border-l-4 border-l-green-500'
      : displayStatus === 'scheduled'
        ? 'border-l-4 border-l-orange-500'
        : displayStatus === 'draft' || displayStatus === 'paused'
          ? 'border-l-4 border-l-yellow-500'
          : displayStatus === 'completed'
            ? 'border-l-4 border-l-blue-500'
            : 'border-l-4 border-l-gray-400';

  const CompetencyIcon = COMPETENCY_ICONS[type];
  const displayTitle = getDisplayTitle(type, props.title);
  const isList = props.isListView === true;

  const handleCardKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick();
    }
  };

  return (
    <motion.div
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (props.index ?? 0) * 0.05, duration: 0.25 }}
      className={`
        bg-white rounded-2xl border border-mint-200 hover:border-mint-300
        shadow-md hover:shadow-2xl p-6 transition-all duration-300 cursor-pointer
        hover:-translate-y-1 hover:bg-mint-50/20
        focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-300 focus-visible:ring-offset-2
        flex flex-col gap-5 ${statusBorderClass}
      `}
      onClick={handleCardClick}
      onKeyDown={handleCardKeyDown}
      aria-label={`${displayTitle}, ${displayStatus}. View details`}
    >
      {/* Card header: competency icon + title + badges */}
      <div className="flex items-center gap-4">
        <div
          className={`w-14 h-14 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-lg ring-2 ring-black/10`}
        >
          <CompetencyIcon className="w-7 h-7 text-primary" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-xl font-bold text-primary truncate">
              {displayTitle}
            </h3>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className="px-3 py-1 rounded-full text-xs font-bold bg-mint-100 text-primary"
                style={{ border: `1px solid ${typeBadge.colors.border}` }}
              >
                {typeBadge.label}
              </span>
              <span
                className="px-3 py-1 rounded-full text-xs font-bold capitalize flex items-center gap-1"
                style={{
                  backgroundColor: statusColors.bg,
                  color: statusColors.text,
                  border: `1px solid ${statusColors.border}`,
                }}
              >
                {(displayStatus === 'active' || displayStatus === 'published') && (
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                  </span>
                )}
                {displayStatus}
              </span>
              <div className="relative" data-menu-id={props.id}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    props.onMenuToggle();
                  }}
                  aria-label="More options"
                  aria-expanded={props.isMenuOpen}
                  aria-haspopup="menu"
                  className="p-1.5 rounded-lg hover:bg-mint-50 text-secondary transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-300 focus-visible:ring-offset-2"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {props.isMenuOpen && (
                  <div
                    className="absolute top-full right-0 mt-1 w-48 bg-white border-2 border-gray-200 rounded-xl shadow-xl py-1 z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {(actions.showPause || actions.showResume) && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (actions.showResume) {
                            props.onResume(props.id, e);
                          } else {
                            props.onPause(props.id, e);
                          }
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-left hover:bg-mint-50 rounded-lg"
                      >
                        {actions.showResume ? (
                          <>
                            <Play className="w-4 h-4 text-green-600" />
                            Resume
                          </>
                        ) : (
                          <>
                            <Pause className="w-4 h-4" />
                            Pause
                          </>
                        )}
                      </button>
                    )}
                    {actions.showClone && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onClone(props.id, props.title);
                          props.onMenuToggle();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-left hover:bg-mint-50 rounded-lg"
                      >
                        <Copy className="w-4 h-4" />
                        Clone
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata: Created • Updated • Scheduled */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-secondary mt-0.5">
        <span className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-secondary" />
          Created: {metadata.formattedCreatedAt}
        </span>
        {updatedAgo && (
          <>
            <span className="text-gray-400">•</span>
            <span className="text-gray-500">Updated: {updatedAgo}</span>
          </>
        )}
        {schedule.hasSchedule && scheduledStr && (
          <>
            <span className="text-gray-400">•</span>
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-orange-600" />
              Scheduled: {scheduledStr}
            </span>
          </>
        )}
      </div>

      {/* Stats grid - gradient, border, icons above values */}
      <div
        className={`bg-gradient-to-br from-mint-50 via-mint-100/30 to-mint-50 rounded-xl border-2 border-mint-200 grid gap-4 ${
          isList ? 'grid-cols-4 p-4' : 'grid-cols-2 p-5'
        }`}
      >
        <div className="text-center rounded-lg hover:bg-white/60 transition-colors py-1">
          <FileText className="w-5 h-5 text-mint-300 mx-auto mb-2" />
          <p
            className={`mb-1 ${
              questionCount != null
                ? isList
                  ? 'text-xl font-bold text-primary'
                  : 'text-2xl font-bold text-primary'
                : isList
                  ? 'text-lg font-bold text-gray-400'
                  : 'text-xl font-bold text-gray-400'
            }`}
          >
            {questionCount != null ? questionCount : '—'}
          </p>
          <p className="text-xs font-medium text-secondary uppercase tracking-wide">
            Questions
          </p>
        </div>
        <div className="text-center rounded-lg hover:bg-white/60 transition-colors py-1">
          <Clock className="w-5 h-5 text-mint-300 mx-auto mb-2" />
          <p
            className={`mb-1 ${
              durationStr !== '—'
                ? isList
                  ? 'text-xl font-bold text-primary'
                  : 'text-2xl font-bold text-primary'
                : isList
                  ? 'text-lg font-bold text-gray-400'
                  : 'text-xl font-bold text-gray-400'
            }`}
          >
            {durationStr}
          </p>
          <p className="text-xs font-medium text-secondary uppercase tracking-wide">
            Duration
          </p>
        </div>
        <div className="text-center rounded-lg hover:bg-white/60 transition-colors py-1">
          <Users className="w-5 h-5 text-mint-300 mx-auto mb-2" />
          <p
            className={`mb-1 ${
              assignedLabel !== '—'
                ? isList
                  ? 'text-xl font-bold text-primary'
                  : 'text-2xl font-bold text-primary'
                : isList
                  ? 'text-lg font-bold text-gray-400'
                  : 'text-xl font-bold text-gray-400'
            }`}
          >
            {assignedLabel}
          </p>
          <p className="text-xs font-medium text-secondary uppercase tracking-wide">
            Assigned
          </p>
        </div>
        <div className="text-center rounded-lg hover:bg-white/80 transition-colors py-1">
          <BarChart2 className="w-5 h-5 text-mint-300 mx-auto mb-2" />
          <p
            className={`mb-1 ${
              avgScoreStr !== '—'
                ? isList
                  ? 'text-xl font-bold text-primary'
                  : 'text-2xl font-bold text-primary'
                : isList
                  ? 'text-lg font-bold text-gray-400'
                  : 'text-xl font-bold text-gray-400'
            }`}
          >
            {avgScoreStr}
          </p>
          <p className="text-xs font-medium text-secondary uppercase tracking-wide">
            Avg Score
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-1" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label="Progress">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-secondary">Progress</span>
          <span className="text-sm font-bold text-primary">
            {progressPercent}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-mint-400 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${progressWidth}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Assigned to */}
      {hasAssigned ? (
        <div className="flex items-center gap-2 bg-mint-50 px-3 py-2 rounded-lg border border-mint-200">
          <Users className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-primary">
            {totalAssigned} Employee{totalAssigned !== 1 ? 's' : ''} assigned
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span className="text-sm text-gray-500 italic">Not yet assigned</span>
        </div>
      )}

      {/* View Details - prominent, visible */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          router.push(viewDetailsPath);
        }}
        aria-label="View assessment details"
        className="inline-flex items-center justify-center gap-2 w-full sm:w-auto py-2.5 px-4 rounded-lg bg-mint-50 border-2 border-mint-300 text-primary font-semibold text-sm hover:bg-mint-100 hover:border-mint-400 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-300 focus-visible:ring-offset-2"
      >
        View Details
        <ArrowRight className="w-4 h-4 flex-shrink-0" />
      </button>

      {/* Warning: No activity in 30 days */}
      {showNoActivityWarning && (
        <div className="bg-orange-50 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-medium">
          ⚠️ No activity in 30 days
        </div>
      )}

      {/* Action buttons - single row, equal emphasis */}
      <div
        className="flex flex-nowrap gap-3 pt-4 mt-1 border-t-2 border-mint-100"
        onClick={(e) => e.stopPropagation()}
      >
        {actions.showAnalytics && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (navigation.analyticsPath) router.push(navigation.analyticsPath);
            }}
            aria-label="View Analytics"
            className="flex-1 min-w-0 h-11 px-3 rounded-lg bg-mint-100 border-2 border-mint-300 text-primary font-semibold text-sm flex items-center justify-center gap-2 hover:bg-mint-200 hover:border-mint-400 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-300 focus-visible:ring-offset-2"
          >
            <BarChart3 className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">View Analytics</span>
          </button>
        )}
        {actions.showEdit && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (navigation.editPath) router.push(navigation.editPath);
            }}
            aria-label="Edit assessment"
            className="flex-1 min-w-0 h-11 px-3 rounded-lg bg-white border-2 border-gray-300 text-secondary font-medium text-sm flex items-center justify-center gap-2 hover:border-mint-300 hover:bg-mint-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-300 focus-visible:ring-offset-2"
          >
            <Pencil className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Edit</span>
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            router.push(assignPath);
          }}
          aria-label="Assign candidates"
          className="flex-1 min-w-0 h-11 px-3 rounded-lg bg-white border-2 border-gray-300 text-secondary font-medium text-sm flex items-center justify-center gap-2 hover:border-mint-300 hover:bg-mint-50 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-300 focus-visible:ring-offset-2"
        >
          <UserPlus className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">Assign</span>
        </button>
        {actions.showDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              props.onDelete(props.id, props.title, type);
            }}
            aria-label="Delete assessment"
            className="flex-1 min-w-0 h-11 px-3 rounded-lg bg-white border-2 border-red-300 text-red-600 font-medium text-sm flex items-center justify-center gap-2 hover:bg-red-50 hover:border-red-400 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2"
          >
            <Trash2 className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">Delete</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
