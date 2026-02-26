import { Mail, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { StatusBadge } from './StatusBadge';
import { type Employee } from '@/hooks/api/useEmployees';

// Shared grid template for consistent alignment - flexible widths (Password Set column removed)
const GRID_TEMPLATE_DESKTOP = "minmax(150px, 180px) minmax(200px, 250px) minmax(250px, 1fr) minmax(140px, 160px) minmax(280px, 320px)";

interface EmployeeRowProps {
  employee: Employee;
  onEdit: (employee: Employee) => void;
  onDelete: (aaptorId: string, name: string) => void;
  onSendEmail: (aaptorId: string, name?: string) => void;
  isSendingEmail?: boolean;
  isDeleting?: boolean;
}

export function EmployeeRow({
  employee,
  onEdit,
  onDelete,
  onSendEmail,
  isSendingEmail = false,
  isDeleting = false,
}: EmployeeRowProps) {
  const initials = employee.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Varied avatar gradients for visual interest
  const avatarGradients = [
    'from-mint-200 to-mint-100',
    'from-powder to-mint-100',
    'from-butter to-mint-100',
  ];
  const avatarGradient = avatarGradients[employee.id.charCodeAt(0) % avatarGradients.length];

  return (
    <>
      {/* Desktop: Full 6-column grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="hidden lg:grid gap-6 px-6 py-6 items-center hover:bg-mint-50/80 hover:shadow-md transition-all duration-200 border-b border-mint-100/50"
        style={{ 
          gridTemplateColumns: GRID_TEMPLATE_DESKTOP,
          minHeight: "80px"
        }}
        tabIndex={0}
        role="row"
      >
        {/* Column 1: Aaptor ID - ALIGNED */}
        <div className="flex items-center justify-start">
          <span className="inline-block px-3 py-2 bg-mint-100 border-2 border-mint-300 rounded-lg font-mono text-sm font-semibold text-text-primary shadow-sm whitespace-nowrap">
            {employee.aaptorId}
          </span>
        </div>

        {/* Column 2: Name with Avatar - ALIGNED */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-text-primary font-bold text-base hover:scale-110 transition-transform duration-200`}>
            {initials}
          </div>
          <span className="font-semibold text-base text-text-primary truncate">
            {employee.name}
          </span>
        </div>

        {/* Column 3: Email - ALIGNED */}
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <Mail className="flex-shrink-0 w-4 h-4 text-text-subtle" />
          <span className="text-sm font-medium text-text-secondary truncate block overflow-hidden text-ellipsis whitespace-nowrap">
            {employee.email}
          </span>
        </div>

        {/* Column 4: Status Badge - ALIGNED */}
        <div className="flex items-center justify-start">
          <StatusBadge status={employee.status} />
        </div>

        {/* Column 5: Actions - ALIGNED RIGHT */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onSendEmail(employee.aaptorId, employee.name)}
            disabled={isSendingEmail}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-text-primary bg-white border-2 border-mint-400 rounded-lg hover:bg-mint-100 hover:border-mint-500 transition-all shadow-sm hover:shadow-md whitespace-nowrap focus:ring-4 focus:ring-mint-200 focus:ring-offset-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label={`Send email to ${employee.name}`}
            title="Send email to employee"
            tabIndex={0}
          >
            <Mail className="w-4 h-4" />
            Send Email
          </button>

          <button
            onClick={() => onEdit(employee)}
            className="flex-shrink-0 p-2.5 text-text-secondary bg-white border-2 border-gray-400 rounded-lg hover:bg-gray-100 hover:border-gray-500 transition-all shadow-sm focus:ring-4 focus:ring-mint-200 focus:ring-offset-2 outline-none group"
            aria-label={`Edit ${employee.name}`}
            title="Edit employee"
            tabIndex={0}
          >
            <Pencil className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          </button>

          <button
            onClick={() => onDelete(employee.aaptorId, employee.name)}
            disabled={isDeleting}
            className="flex-shrink-0 p-2.5 text-red-600 bg-white border-2 border-red-400 rounded-lg hover:bg-red-100 hover:border-red-500 transition-all shadow-sm focus:ring-4 focus:ring-red-200 focus:ring-offset-2 outline-none disabled:opacity-50 disabled:cursor-not-allowed group"
            aria-label={`Delete ${employee.name}`}
            title="Delete employee"
            tabIndex={0}
          >
            <Trash2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          </button>
        </div>
      </motion.div>

      {/* Tablet: 4-column grid (md to lg) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="hidden md:grid lg:hidden grid-cols-[120px_180px_1fr_200px] gap-4 px-4 py-5 min-h-[80px] border-b border-mint-100/50 hover:bg-mint-50/80 hover:shadow-md transition-all duration-200 items-center"
        tabIndex={0}
        role="row"
      >
        {/* Aaptor ID */}
        <div className="flex items-center">
          <span className="inline-block px-2.5 py-1.5 bg-mint-100 border-2 border-mint-300 rounded-lg font-mono text-xs font-semibold text-text-primary shadow-sm whitespace-nowrap">
            {employee.aaptorId}
          </span>
        </div>

        {/* Name with Avatar */}
        <div className="flex items-center gap-2 min-w-0">
          <div className={`flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-text-primary font-bold text-sm hover:scale-110 transition-transform duration-200`}>
            {initials}
          </div>
          <span className="text-sm font-semibold text-text-primary truncate">{employee.name}</span>
        </div>

        {/* Status Badge */}
        <div className="flex items-center justify-start">
          <StatusBadge status={employee.status} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => onSendEmail(employee.aaptorId, employee.name)}
            disabled={isSendingEmail}
            className="flex-shrink-0 p-2 text-text-primary bg-white border-2 border-mint-400 rounded-lg hover:bg-mint-100 hover:border-mint-500 transition-all shadow-sm hover:shadow-md active:scale-95 focus:ring-4 focus:ring-mint-200 focus:ring-offset-2 outline-none disabled:opacity-50"
            aria-label={`Send email to ${employee.name}`}
            title="Send email"
            tabIndex={0}
          >
            <Mail className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(employee)}
            className="flex-shrink-0 p-2 text-text-secondary bg-white border-2 border-gray-400 rounded-lg hover:bg-gray-100 hover:border-gray-500 transition-all shadow-sm active:scale-95 focus:ring-4 focus:ring-mint-200 focus:ring-offset-2 outline-none group"
            aria-label={`Edit ${employee.name}`}
            title="Edit employee"
            tabIndex={0}
          >
            <Pencil className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          </button>
          <button
            onClick={() => onDelete(employee.aaptorId, employee.name)}
            disabled={isDeleting}
            className="flex-shrink-0 p-2 text-red-600 bg-white border-2 border-red-400 rounded-lg hover:bg-red-100 hover:border-red-500 transition-all shadow-sm active:scale-95 focus:ring-4 focus:ring-red-200 focus:ring-offset-2 outline-none disabled:opacity-50 group"
            aria-label={`Delete ${employee.name}`}
            title="Delete employee"
            tabIndex={0}
          >
            <Trash2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          </button>
        </div>
      </motion.div>

      {/* Mobile: 2-column grid (sm and below) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="grid md:hidden grid-cols-[1fr_auto] gap-3 px-3 py-4 min-h-[80px] border-b border-mint-100/50 hover:bg-mint-50/80 hover:shadow-md transition-all duration-200"
        tabIndex={0}
        role="row"
      >
        {/* Employee Info */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br ${avatarGradient} flex items-center justify-center text-text-primary font-bold text-sm`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-text-primary truncate">{employee.name}</div>
            <div className="text-xs text-text-subtle truncate mt-0.5">{employee.email}</div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <StatusBadge status={employee.status} />
              <span className="text-xs text-text-subtle font-mono">{employee.aaptorId}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSendEmail(employee.aaptorId, employee.name)}
            disabled={isSendingEmail}
            className="flex-shrink-0 p-2 text-text-primary bg-white border-2 border-mint-400 rounded-lg hover:bg-mint-100 hover:border-mint-500 transition-all shadow-sm hover:shadow-md active:scale-95 focus:ring-4 focus:ring-mint-200 focus:ring-offset-2 outline-none disabled:opacity-50"
            aria-label={`Send email to ${employee.name}`}
            title="Send email"
            tabIndex={0}
          >
            <Mail className="w-4 h-4" />
          </button>
          <button
            onClick={() => onEdit(employee)}
            className="flex-shrink-0 p-2 text-text-secondary bg-white border-2 border-gray-400 rounded-lg hover:bg-gray-100 hover:border-gray-500 transition-all shadow-sm active:scale-95 focus:ring-4 focus:ring-mint-200 focus:ring-offset-2 outline-none group"
            aria-label={`Edit ${employee.name}`}
            title="Edit employee"
            tabIndex={0}
          >
            <Pencil className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          </button>
          <button
            onClick={() => onDelete(employee.aaptorId, employee.name)}
            disabled={isDeleting}
            className="flex-shrink-0 p-2 text-red-600 bg-white border-2 border-red-400 rounded-lg hover:bg-red-100 hover:border-red-500 transition-all shadow-sm active:scale-95 focus:ring-4 focus:ring-red-200 focus:ring-offset-2 outline-none disabled:opacity-50 group"
            aria-label={`Delete ${employee.name}`}
            title="Delete employee"
            tabIndex={0}
          >
            <Trash2 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
          </button>
        </div>
      </motion.div>
    </>
  );
}

