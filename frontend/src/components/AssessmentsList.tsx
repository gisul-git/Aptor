/**
 * Assessments List - FAANG-level layout with stats, filters, search, and enhanced cards
 */

import { useState, useMemo } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import AssessmentCardEnhanced from './assessments/AssessmentCardEnhanced';
import type { Assessment } from '@/hooks/useDashboardAssessments';
import type { AssessmentType } from '@/utils/cardConfig';
import { getDisplayStatus } from '@/utils/cardConfig';
import {
  ClipboardList,
  CheckCircle,
  Clock,
  Target,
  LayoutGrid,
  List,
  Search,
  ChevronDown,
  FileText,
} from 'lucide-react';

type FilterPill = 'all' | 'active' | 'scheduled' | 'completed';
type SortOption = 'recent' | 'oldest' | 'name';
type ViewMode = 'grid' | 'list';

interface AssessmentsListProps {
  assessments: Assessment[];
  openMenuId: string | null;
  onMenuToggle: (id: string) => void;
  onPause: (id: string, e: React.MouseEvent) => void;
  onResume: (id: string, e: React.MouseEvent) => void;
  onDelete: (id: string, title: string, type?: AssessmentType) => void;
  onClone: (id: string, title: string) => void;
  isLoading?: boolean;
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-mint-200 p-6 animate-pulse shadow-sm">
      <div className="flex justify-between items-start gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gray-200" />
          <div className="h-6 bg-gray-200 rounded w-3/4 max-w-[180px]" />
        </div>
        <div className="flex gap-2">
          <div className="h-6 w-14 bg-gray-200 rounded-full" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
      </div>
      <div className="flex gap-4 mb-4">
        <div className="h-4 bg-gray-100 rounded w-24" />
        <div className="h-4 bg-gray-100 rounded w-20" />
      </div>
      <div className="grid grid-cols-2 gap-4 bg-gradient-to-br from-mint-50 via-mint-100/30 to-mint-50 rounded-xl p-5 border-2 border-mint-200 mb-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-gray-200 rounded" />
        ))}
      </div>
      <div className="h-4 bg-gray-100 rounded w-2/3 mb-4" />
      <div className="flex gap-2 pt-4 border-t-2 border-mint-100">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 flex-1 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function AssessmentsList({
  assessments,
  openMenuId,
  onMenuToggle,
  onPause,
  onResume,
  onDelete,
  onClone,
  isLoading = false,
}: AssessmentsListProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPill, setFilterPill] = useState<FilterPill>('all');
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  const stats = useMemo(() => {
    let total = assessments.length;
    let active = 0;
    let scheduled = 0;
    let completed = 0;
    assessments.forEach((a) => {
      const status = getDisplayStatus(a);
      if (status === 'active' || status === 'published') active++;
      else if (status === 'scheduled') scheduled++;
      else if (status === 'completed') completed++;
    });
    return { total, active, scheduled, completed };
  }, [assessments]);

  const filteredAndSorted = useMemo(() => {
    let list = assessments;

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((a) => a.title?.toLowerCase().includes(q));
    }

    if (filterPill !== 'all') {
      list = list.filter((a) => {
        const status = getDisplayStatus(a);
        if (filterPill === 'active')
          return status === 'active' || status === 'published';
        if (filterPill === 'scheduled') return status === 'scheduled';
        if (filterPill === 'completed') return status === 'completed';
        return true;
      });
    }

    const sorted = [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return (a.title || '').localeCompare(b.title || '');
      }
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return sortBy === 'recent' ? dateB - dateA : dateA - dateB;
    });
    return sorted;
  }, [assessments, searchQuery, filterPill, sortBy]);

  const sortLabel =
    sortBy === 'recent'
      ? 'Most Recent'
      : sortBy === 'oldest'
        ? 'Oldest First'
        : 'Name A–Z';

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-primary">Your Assessments</h1>
          <div className="h-10 w-24 bg-gray-200 rounded-full animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-mint-200 p-6 animate-pulse shadow-sm"
            >
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-4" />
              <div className="h-10 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (assessments.length === 0) {
    return (
      <div className="bg-mint-50 rounded-2xl p-12 flex flex-col items-center justify-center text-center max-w-2xl mx-auto">
        <div className="w-20 h-20 rounded-2xl bg-mint-200 flex items-center justify-center mb-6">
          <FileText className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-primary mb-2">
          No assessments yet
        </h2>
        <p className="text-secondary mb-8">
          Create your first assessment to get started with AI-powered topic and
          question generation.
        </p>
        <Link
          href="/assessments/create-new"
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-mint-200 to-mint-100 text-primary font-bold rounded-xl shadow-lg hover:shadow-xl transition-all border-2 border-mint-300 hover:scale-[1.02]"
        >
          Create Assessment
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header - more inviting */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-primary tracking-tight">Your Assessments</h1>
          <p className="text-secondary text-sm md:text-base mt-1">Manage and track all your assessments in one place</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortDropdownOpen((o) => !o)}
              aria-expanded={sortDropdownOpen}
              aria-haspopup="listbox"
              aria-label="Sort assessments"
              className="flex items-center gap-2 h-12 px-4 border-2 border-mint-300 rounded-xl font-medium text-primary hover:bg-mint-50 transition-colors min-w-[160px] justify-between focus:outline-none focus:ring-2 focus:ring-mint-300 focus:ring-offset-2"
            >
              <span>Sort: {sortLabel}</span>
              <ChevronDown className="w-5 h-5" />
            </button>
            {sortDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setSortDropdownOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="listbox"
                  aria-label="Sort options"
                  className="absolute right-0 top-full mt-1 w-48 bg-white border-2 border-mint-200 rounded-xl shadow-xl py-1 z-20"
                >
                  {(
                    [
                      { value: 'recent' as const, label: 'Most Recent' },
                      { value: 'oldest' as const, label: 'Oldest First' },
                      { value: 'name' as const, label: 'Name A–Z' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={sortBy === opt.value}
                      onClick={() => {
                        setSortBy(opt.value);
                        setSortDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm font-medium text-primary hover:bg-mint-50 rounded-lg"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <Link
            href="/assessments/create-new"
            className="flex items-center gap-2 h-12 px-6 bg-gradient-to-r from-mint-200 via-mint-100 to-forest-100 text-primary font-bold rounded-xl border-2 border-mint-300 shadow-mint-soft hover:shadow-mint-soft-lg hover:scale-[1.02] transition-all duration-300"
          >
            Create Assessment
          </Link>
          <span className="bg-mint-100 text-primary px-4 py-2 rounded-full text-sm font-semibold">
            {stats.total} Total
          </span>
        </div>
      </div>

      {/* Search - softer, on-tone */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" aria-hidden />
        <input
          type="search"
          placeholder="Search assessments..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search assessments by name"
          className="w-full h-12 pl-12 pr-4 bg-white/80 backdrop-blur-sm border-2 border-mint-200/80 rounded-xl text-primary font-medium placeholder:text-secondary/60 focus:border-mint-400 focus:ring-4 focus:ring-mint-200/50 outline-none transition-all shadow-sm"
        />
      </div>

      {/* Quick stats bar - mint cream gradient cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-white to-mint-50/60 rounded-2xl border border-mint-200/80 p-6 shadow-mint-soft hover:shadow-mint-soft-lg hover:border-mint-300/80 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-mint-100/50 rounded-bl-full" aria-hidden />
          <div className="absolute top-4 right-4 w-12 h-12 rounded-xl bg-mint-100 p-3 flex items-center justify-center shadow-sm">
            <ClipboardList className="w-6 h-6 text-primary" />
          </div>
          <p className="text-4xl font-bold text-primary mb-2">{stats.total}</p>
          <p className="text-sm font-medium text-secondary">Total Assessments</p>
        </div>
        <div className="bg-gradient-to-br from-white to-mint-50/60 rounded-2xl border border-mint-200/80 p-6 shadow-mint-soft hover:shadow-mint-soft-lg hover:border-mint-300/80 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-mint-100/50 rounded-bl-full" aria-hidden />
          <div className="absolute top-4 right-4 w-12 h-12 rounded-xl bg-mint-100 p-3 flex items-center justify-center shadow-sm">
            <CheckCircle className="w-6 h-6 text-primary" />
          </div>
          <p className="text-4xl font-bold text-primary mb-2">{stats.active}</p>
          <p className="text-sm font-medium text-secondary">Active Now</p>
        </div>
        <div className="bg-gradient-to-br from-white to-mint-50/60 rounded-2xl border border-mint-200/80 p-6 shadow-mint-soft hover:shadow-mint-soft-lg hover:border-mint-300/80 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-mint-100/50 rounded-bl-full" aria-hidden />
          <div className="absolute top-4 right-4 w-12 h-12 rounded-xl bg-mint-100 p-3 flex items-center justify-center shadow-sm">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <p className="text-4xl font-bold text-primary mb-2">{stats.scheduled}</p>
          <p className="text-sm font-medium text-secondary">Scheduled</p>
        </div>
        <div className="bg-gradient-to-br from-white to-mint-50/60 rounded-2xl border border-mint-200/80 p-6 shadow-mint-soft hover:shadow-mint-soft-lg hover:border-mint-300/80 transition-all duration-300 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-mint-100/50 rounded-bl-full" aria-hidden />
          <div className="absolute top-4 right-4 w-12 h-12 rounded-xl bg-mint-100 p-3 flex items-center justify-center shadow-sm">
            <Target className="w-6 h-6 text-primary" />
          </div>
          <p className="text-4xl font-bold text-primary mb-2">{stats.completed}</p>
          <p className="text-sm font-medium text-secondary">Completed</p>
        </div>
      </div>

      {/* Filter & view bar - subtle card feel */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-2 px-4 rounded-2xl bg-white/60 backdrop-blur-sm border border-mint-200/60 shadow-sm">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Filter by status"
        >
          {(
            [
              { value: 'all' as const, label: 'All' },
              { value: 'active' as const, label: 'Active' },
              { value: 'scheduled' as const, label: 'Scheduled' },
              { value: 'completed' as const, label: 'Completed' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="tab"
              aria-selected={filterPill === opt.value}
              onClick={() => setFilterPill(opt.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-mint-300 focus:ring-offset-2 ${
                filterPill === opt.value
                  ? 'bg-mint-100 border-2 border-mint-300 text-primary font-semibold'
                  : 'bg-white border border-gray-300 text-secondary font-medium hover:border-mint-200 hover:bg-mint-50'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-secondary hidden sm:inline">
            View:
          </span>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            aria-pressed={viewMode === 'grid'}
            aria-label="Grid view"
            className={`p-2 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-mint-300 focus:ring-offset-2 ${
              viewMode === 'grid'
                ? 'border-mint-300 bg-mint-50 text-primary'
                : 'border-gray-300 text-secondary hover:border-mint-200'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            aria-pressed={viewMode === 'list'}
            aria-label="List view"
            className={`p-2 rounded-lg border-2 transition-all focus:outline-none focus:ring-2 focus:ring-mint-300 focus:ring-offset-2 ${
              viewMode === 'list'
                ? 'border-mint-300 bg-mint-50 text-primary'
                : 'border-gray-300 text-secondary hover:border-mint-200'
            }`}
          >
            <List className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Cards grid or list */}
      {filteredAndSorted.length === 0 ? (
        <div className="bg-gradient-to-br from-mint-50 to-white rounded-2xl p-12 text-center border border-mint-200/80 shadow-sm">
          <p className="text-secondary font-medium">
            No assessments match your filters. Try changing the filter or
            search.
          </p>
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
              : 'flex flex-col gap-4'
          }
        >
          {filteredAndSorted.map((assessment, index) => (
            <AssessmentCardEnhanced
              key={assessment.id}
              {...assessment}
              type={(assessment.type || 'assessment') as AssessmentType}
              isMenuOpen={openMenuId === assessment.id}
              onMenuToggle={() => onMenuToggle(assessment.id)}
              onPause={onPause}
              onResume={onResume}
              onDelete={onDelete}
              onClone={onClone}
              index={index}
              isListView={viewMode === 'list'}
            />
          ))}
        </div>
      )}
    </div>
  );
}
