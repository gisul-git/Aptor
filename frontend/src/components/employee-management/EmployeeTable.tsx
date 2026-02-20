import { motion } from 'framer-motion';
import { EmployeeRow } from './EmployeeRow';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';
import { Pagination } from './Pagination';
import { type Employee } from '@/hooks/api/useEmployees';

interface EmployeeTableProps {
  employees: Employee[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  onEdit: (employee: Employee) => void;
  onDelete: (aaptorId: string, name: string) => void;
  onSendEmail: (aaptorId: string, name?: string) => void;
  onAddEmployee: () => void;
  onUploadCSV: () => void;
  isSendingEmail?: boolean;
  isDeleting?: boolean;
  hasFilters?: boolean;
}

// Shared grid template for consistent alignment - flexible widths (Password Set column removed)
const GRID_TEMPLATE_DESKTOP = "minmax(150px, 180px) minmax(200px, 250px) minmax(250px, 1fr) minmax(140px, 160px) minmax(280px, 320px)";

export function EmployeeTable({
  employees,
  isLoading,
  currentPage,
  totalPages,
  total,
  limit,
  onPageChange,
  onEdit,
  onDelete,
  onSendEmail,
  onAddEmployee,
  onUploadCSV,
  isSendingEmail = false,
  isDeleting = false,
  hasFilters = false,
}: EmployeeTableProps) {
  return (
    <div className="bg-white rounded-xl md:rounded-2xl shadow-lg md:shadow-xl border border-mint-200 overflow-hidden w-full">
      {/* Table Header - Sticky */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-mint-100 to-mint-200 border-b-4 border-mint-300">
        {/* Desktop: Full 6-column grid */}
        <div 
          className="hidden lg:grid gap-6 px-6 py-5 items-center"
          style={{ gridTemplateColumns: GRID_TEMPLATE_DESKTOP }}
        >
          <div className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center">
            Aaptor ID
          </div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center">
            Name
          </div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center">
            Email
          </div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center">
            Status
          </div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-text-primary text-right flex items-center justify-end">
            Actions
          </div>
        </div>
        {/* Tablet: 4-column grid (md to lg) */}
        <div className="hidden md:grid lg:hidden grid-cols-[120px_180px_1fr_200px] gap-4 px-4 py-5 items-center">
          <div className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center">
            Aaptor ID
          </div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center">
            Name
          </div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center">
            Status
          </div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-text-primary text-right flex items-center justify-end">
            Actions
          </div>
        </div>
        {/* Mobile: 2-column grid (sm and below) */}
        <div className="grid md:hidden grid-cols-[1fr_auto] gap-4 px-3 py-4 items-center">
          <div className="text-xs font-extrabold uppercase tracking-wider text-text-primary flex items-center">
            Employee
          </div>
          <div className="text-xs font-extrabold uppercase tracking-wider text-text-primary text-right flex items-center justify-end">
            Actions
          </div>
        </div>
      </div>

      {/* Table Body */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {isLoading ? (
          <div className="p-6">
            <LoadingState />
          </div>
        ) : employees.length === 0 ? (
          <div className="p-6">
            <EmptyState
              onAddEmployee={onAddEmployee}
              onUploadCSV={onUploadCSV}
              hasFilters={hasFilters}
            />
          </div>
        ) : (
          <div className="divide-y divide-mint-100">
            {employees.map((employee) => (
              <EmployeeRow
                key={employee.id}
                employee={employee}
                onEdit={onEdit}
                onDelete={onDelete}
                onSendEmail={onSendEmail}
                isSendingEmail={isSendingEmail}
                isDeleting={isDeleting}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* Pagination Footer */}
      {!isLoading && employees.length > 0 && totalPages > 1 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          total={total}
          limit={limit}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

