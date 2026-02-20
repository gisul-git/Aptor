'use client';

import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface FilterBarProps {
  statusFilter: string;
  onStatusChange: (status: string) => void;
  className?: string;
}

export function FilterBar({ statusFilter, onStatusChange, className }: FilterBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={cn('relative', className)}>
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className={cn(
          'h-14 w-full pl-4 pr-10 bg-white border-2 border-gray-300 rounded-xl text-sm font-medium text-text-secondary hover:border-mint-300 focus:border-mint-300 focus:ring-4 focus:ring-mint-100 transition-all outline-none cursor-pointer shadow-sm appearance-none',
          className
        )}
        aria-label="Filter by status"
      >
        <option value="">All Status</option>
        <option value="active">Active</option>
        <option value="pending">Pending</option>
        <option value="inactive">Inactive</option>
      </select>
      <ChevronDown
        className={cn(
          'absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none transition-transform duration-200',
          isOpen && 'rotate-180'
        )}
      />
    </div>
  );
}

