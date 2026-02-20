/**
 * Employee Management Page - FAANG-Level UI/UX Redesign
 * 
 * For org_admins to manage employees in their organization
 * Allows adding, editing, deleting employees and resending welcome emails
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]';
import { motion } from 'framer-motion';
import { Building2, PlusCircle, Upload, Mail, UserPlus } from 'lucide-react';
import AuthGuardModal from '../../components/auth/AuthGuardModal';
import useAuthGuard from '../../hooks/auth/useAuthGuard';
import { useEmployees, useDeleteEmployee, useResendWelcomeEmail, type Employee } from '@/hooks/api/useEmployees';
import { useUserProfile } from '@/hooks/auth';
import { useOrganization } from '@/hooks/api/useOrganization';
import {
  EmployeeTable,
  SearchBar,
  FilterBar,
  AddEmployeeModal,
  BulkUploadModal,
} from '../../components/employee-management';

interface EmployeeManagementPageProps {
  session: any;
}

export default function EmployeeManagementPage({ session: serverSession }: EmployeeManagementPageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const limit = 10;

  // Use server session if available, fallback to client session
  const activeSession = serverSession || session;

  // Use auth guard hook to check authentication and role
  const authGuard = useAuthGuard({
    requiredRole: 'org_admin',
    showModal: true,
    redirectAfterAuth: '/employee/management',
    notAuthenticatedMessage:
      'You need to sign in as an organization administrator to access the Employee Management page. Please sign in with your organization admin account or create a new account to continue.',
    wrongRoleMessage:
      'This page is only accessible to organization administrators. Your current role does not have permission to manage employees.',
  });

  const { data, isLoading, error, refetch } = useEmployees({
    page,
    limit,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const deleteEmployeeMutation = useDeleteEmployee();
  const resendEmailMutation = useResendWelcomeEmail();

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setShowAddModal(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowAddModal(true);
  };

  const handleFormSuccess = () => {
    setShowAddModal(false);
    setEditingEmployee(null);
    refetch();
  };

  const handleFormClose = () => {
    setShowAddModal(false);
    setEditingEmployee(null);
  };

  const handleDelete = async (aaptorId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteEmployeeMutation.mutateAsync(aaptorId);
      await refetch();
    } catch (error: any) {
      alert(error?.response?.data?.detail || error?.message || 'Failed to delete employee');
    }
  };

  const handleResendEmail = async (aaptorId: string, employeeName?: string) => {
    const employee = data?.employees?.find((emp) => emp.aaptorId === aaptorId);
    const displayName = employeeName || employee?.name || 'employee';

    try {
      await resendEmailMutation.mutateAsync(aaptorId);
      alert(
        `Email sent successfully to ${displayName} (${employee?.email || 'employee'})! The employee will receive their Aaptor ID and password information.`
      );
      await refetch();
    } catch (error: any) {
      const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to send email';
      alert(`Failed to send email to ${displayName}: ${errorMsg}`);
    }
  };

  const handleSendEmailToAll = async () => {
    const employees = data?.employees || [];
    if (employees.length === 0) {
      alert('No employees to send emails to.');
      return;
    }

    if (!confirm(`Are you sure you want to send emails to all ${employees.length} employee(s)?`)) {
      return;
    }

    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];

      if (i > 0) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      try {
        await resendEmailMutation.mutateAsync(employee.aaptorId);
        successCount++;
      } catch (error: any) {
        failCount++;
        const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to send email';
        errors.push(`${employee.name} (${employee.email}): ${errorMsg}`);
      }
    }

    if (failCount === 0) {
      alert(`Successfully sent emails to all ${successCount} employee(s)!`);
    } else {
      let message = `Sent emails to ${successCount} employee(s). Failed to send to ${failCount} employee(s).`;
      if (errors.length > 0) {
        message += '\n\nErrors:\n' + errors.slice(0, 5).join('\n');
        if (errors.length > 5) {
          message += `\n... and ${errors.length - 5} more`;
        }
      }
      alert(message);
    }

    await refetch();
  };

  const handleUploadSuccess = () => {
    setShowUploadModal(false);
    refetch();
  };

  // Show loading state
  if (authGuard.isLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-mint-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-mint-200 border-t-mint-300 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated or wrong role, show modal and don't render content
  if (!authGuard.isAuthenticated || authGuard.reason) {
    return (
      <>
        <div className="min-h-screen bg-mint-50 flex items-center justify-center">
          <div className="text-center">
            <p className="text-text-secondary">Checking access permissions...</p>
          </div>
        </div>
        {authGuard.reason && (
          <AuthGuardModal
            isOpen={true}
            reason={authGuard.reason}
            userRole={authGuard.userRole}
            userEmail={authGuard.userEmail}
            requiredRole="org_admin"
            redirectAfterAuth="/employee/management"
            notAuthenticatedMessage="You need to sign in as an organization administrator to access the Employee Management page. Please sign in with your organization admin account or create a new account to continue."
            wrongRoleMessage="This page is only accessible to organization administrators. Your current role does not have permission to manage employees."
          />
        )}
      </>
    );
  }

  // Get user profile to fetch orgId
  const { data: userProfile } = useUserProfile();
  const user = (activeSession as any)?.user;
  
  // Get orgId from user profile or session
  const orgId = (userProfile as any)?.orgId || (user as any)?.orgId || (user as any)?.organization;
  
  // Fetch organization details from database using orgId
  const { data: organization } = useOrganization(orgId);
  
  // Extract organization name
  const orgName = organization?.name || orgId || 'your organization';
  const employees = data?.employees || [];
  const pagination = data?.pagination;

  return (
    <div className="min-h-screen bg-mint-50">
      {/* Page Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-white via-mint-50 to-mint-100 border-b-2 border-mint-200 shadow-sm mb-8"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          {/* Breadcrumb */}
          <nav className="text-sm text-text-secondary font-medium mb-3" aria-label="Breadcrumb">
            <span className="hover:text-text-primary transition-colors cursor-pointer">Organization</span> / <span className="font-medium text-text-primary">Employee Management</span>
          </nav>

          {/* Main Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-text-primary tracking-tight mb-2">
                Employee Management
              </h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="text-sm sm:text-base text-text-secondary">Manage employees for</span>
                <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-mint-100 text-text-primary text-sm font-bold w-fit">
                  <Building2 className="w-4 h-4 mr-2" />
                  {orgName}
                </span>
              </div>
            </div>

            {/* Primary Action - More Prominent */}
            <button
              onClick={() => router.push('/competency')}
              className="flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-mint-200 to-mint-100 hover:from-mint-300 hover:to-mint-200 text-text-primary font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 focus:ring-4 focus:ring-mint-200 outline-none border-2 border-mint-300/50 w-full sm:w-auto"
            >
              <PlusCircle className="w-5 h-5" />
              <span className="hidden sm:inline">Create Assessment</span>
              <span className="sm:hidden">Create</span>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Filters & Actions Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6"
      >
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          {/* Left: Search & Filter */}
          <div className="flex flex-col sm:flex-row flex-1 gap-3 w-full lg:w-auto">
            <SearchBar
              value={search}
              onChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              className="w-full sm:flex-1"
            />
            <FilterBar
              statusFilter={statusFilter}
              onStatusChange={(value) => {
                setStatusFilter(value);
                setPage(1);
              }}
              className="w-full sm:w-auto"
            />
          </div>

          {/* Right: Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center justify-center gap-2 px-5 h-12 bg-white border-2 border-mint-300 text-text-primary text-sm font-semibold rounded-xl hover:bg-mint-50 transition-all shadow-md hover:shadow-lg active:scale-95 focus:ring-4 focus:ring-mint-100 outline-none w-full sm:w-auto"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload CSV</span>
              <span className="sm:hidden">Upload</span>
            </button>

            {employees.length > 0 && (
              <button
                onClick={handleSendEmailToAll}
                disabled={resendEmailMutation.isPending}
                className="flex items-center justify-center gap-2 px-5 h-12 bg-white border-2 border-mint-300 text-text-primary text-sm font-semibold rounded-xl hover:bg-mint-50 transition-all shadow-md hover:shadow-lg active:scale-95 focus:ring-4 focus:ring-mint-100 outline-none disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
              >
                <Mail className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {resendEmailMutation.isPending ? 'Sending...' : 'Send Email to All'}
                </span>
                <span className="sm:hidden">Email All</span>
              </button>
            )}

            <button
              onClick={handleAddEmployee}
              className="flex items-center justify-center gap-2 px-5 h-12 bg-white border-2 border-mint-300 text-text-primary text-sm font-semibold rounded-xl hover:bg-mint-50 transition-all shadow-md hover:shadow-lg active:scale-95 focus:ring-4 focus:ring-mint-100 outline-none w-full sm:w-auto"
            >
              <UserPlus className="w-4 h-4" />
              Add Employee
            </button>
          </div>
        </div>
      </motion.div>

      {/* Data Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 sm:pb-8 mt-6 sm:mt-8"
      >
        {error ? (
          <div className="bg-white rounded-2xl shadow-lg border border-red-200 p-6">
            <p className="text-sm text-red-600 mb-4">
              Error loading employees: {(error as any)?.message || 'Unknown error'}
            </p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-mint-100 text-text-primary font-medium rounded-lg hover:bg-mint-200 transition-all"
            >
              Retry
            </button>
          </div>
        ) : (
          <EmployeeTable
            employees={employees}
            isLoading={isLoading}
            currentPage={page}
            totalPages={pagination?.totalPages || 1}
            total={pagination?.total || 0}
            limit={limit}
            onPageChange={setPage}
            onEdit={handleEditEmployee}
            onDelete={handleDelete}
            onSendEmail={handleResendEmail}
            onAddEmployee={handleAddEmployee}
            onUploadCSV={() => setShowUploadModal(true)}
            isSendingEmail={resendEmailMutation.isPending}
            isDeleting={deleteEmployeeMutation.isPending}
            hasFilters={!!(search || statusFilter)}
          />
        )}
      </motion.div>

      {/* Modals */}
      <AddEmployeeModal
        isOpen={showAddModal}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        employee={editingEmployee}
      />

      <BulkUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onSuccess={handleUploadSuccess}
      />
    </div>
  );
}

// Server-side authentication check - but allow page to render for modal display
export const getServerSideProps: GetServerSideProps = async (context) => {
  // Try to get session, but don't redirect - let client-side handle it with modal
  const session = await getServerSession(context.req, context.res, authOptions);

  return {
    props: {
      session: session ? JSON.parse(JSON.stringify(session)) : null, // Serialize session for client
    },
  };
};
