import { Users, Plus, Upload } from 'lucide-react';
import { motion } from 'framer-motion';

interface EmptyStateProps {
  onAddEmployee: () => void;
  onUploadCSV: () => void;
  hasFilters?: boolean;
}

export function EmptyState({ onAddEmployee, onUploadCSV, hasFilters }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 px-8"
    >
      <div className="w-20 h-20 rounded-full bg-mint-100 flex items-center justify-center mb-6">
        <Users className="w-10 h-10 text-text-primary" />
      </div>
      <h3 className="text-2xl font-bold text-text-primary mb-2">
        {hasFilters ? 'No employees found' : 'No employees yet'}
      </h3>
      <p className="text-base text-text-secondary mb-8 text-center max-w-md">
        {hasFilters
          ? 'Try adjusting your search or filter criteria to find employees.'
          : 'Get started by adding your first employee or importing a CSV file with multiple employees.'}
      </p>
      {!hasFilters && (
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={onAddEmployee}
            className="px-6 py-3 bg-gradient-to-r from-mint-100 to-mint-200 text-text-primary font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 flex items-center gap-2 focus:ring-4 focus:ring-mint-100 outline-none"
          >
            <Plus className="w-5 h-5" />
            Add Employee
          </button>
          <button
            onClick={onUploadCSV}
            className="px-6 py-3 bg-white border-2 border-mint-300 text-text-primary font-medium rounded-xl hover:bg-mint-50 transition-all duration-200 flex items-center gap-2 focus:ring-4 focus:ring-mint-100 outline-none"
          >
            <Upload className="w-5 h-5" />
            Upload CSV
          </button>
        </div>
      )}
    </motion.div>
  );
}

