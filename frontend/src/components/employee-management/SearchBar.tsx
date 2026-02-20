import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchBar({ value, onChange, placeholder, className }: SearchBarProps) {
  return (
    <div className={cn('relative flex-1 max-w-md', className)}>
      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Search by name, email, or Aaptor ID...'}
        className="w-full h-14 pl-[52px] pr-4 bg-white border-2 border-gray-300 rounded-xl text-sm text-text-secondary placeholder:text-gray-400 focus:border-mint-300 focus:ring-4 focus:ring-mint-200 transition-all outline-none shadow-md"
        aria-label="Search employees"
      />
    </div>
  );
}

