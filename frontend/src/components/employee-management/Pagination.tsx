import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export function Pagination({
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
  className,
}: PaginationProps) {
  const start = (currentPage - 1) * limit + 1;
  const end = Math.min(currentPage * limit, total);

  return (
    <div className={cn('bg-gradient-to-r from-mint-100 via-mint-50 to-mint-100 border-t-4 border-mint-300 px-8 py-6', className)}>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <span className="text-base font-medium text-text-primary">
          Showing <strong className="font-bold text-text-primary">{start}</strong> to <strong className="font-bold text-text-primary">{end}</strong> of <strong className="font-bold text-text-primary">{total}</strong> employees
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="h-11 px-6 py-2.5 text-sm font-bold text-text-secondary bg-white border-2 border-mint-400 rounded-lg hover:bg-mint-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 focus:ring-4 focus:ring-mint-200 focus:ring-offset-2 outline-none"
            aria-label="Previous page"
            tabIndex={0}
          >
            <ChevronLeft className="w-4 h-4 inline" />
            Previous
          </button>

          <div className="px-5 py-2.5 text-sm font-bold text-text-primary bg-mint-200 border-2 border-mint-400 rounded-lg">
            Page {currentPage} of {totalPages}
          </div>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="h-11 px-6 py-2.5 text-sm font-bold text-text-secondary bg-white border-2 border-mint-400 rounded-lg hover:bg-mint-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95 focus:ring-4 focus:ring-mint-200 focus:ring-offset-2 outline-none"
            aria-label="Next page"
            tabIndex={0}
          >
            Next
            <ChevronRight className="w-4 h-4 inline" />
          </button>
        </div>
      </div>
    </div>
  );
}

