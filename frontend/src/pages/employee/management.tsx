/**
 * Employee Management Page
 * 
 * For org_admins to manage employees in their organization
 * Allows adding, editing, deleting employees and resending welcome emails
 */

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/dsa/ui/card';
import { Button } from '../../components/dsa/ui/button';
import EmployeeList from '../../components/employee/EmployeeList';
import EmployeeForm from '../../components/employee/EmployeeForm';
import AuthGuardModal from '../../components/auth/AuthGuardModal';
import useAuthGuard from '../../hooks/auth/useAuthGuard';
import { useEmployees, type Employee } from '@/hooks/api/useEmployees';
import { Users, LogOut, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface EmployeeManagementPageProps {
  session: any;
}

export default function EmployeeManagementPage({ session: serverSession }: EmployeeManagementPageProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  // Use server session if available, fallback to client session
  const activeSession = serverSession || session;

  // Use auth guard hook to check authentication and role
  const authGuard = useAuthGuard({
    requiredRole: 'org_admin',
    showModal: true,
    redirectAfterAuth: '/employee/management',
    notAuthenticatedMessage: 'You need to sign in as an organization administrator to access the Employee Management page. Please sign in with your organization admin account or create a new account to continue.',
    wrongRoleMessage: 'This page is only accessible to organization administrators. Your current role does not have permission to manage employees.',
  });

  const handleAddEmployee = () => {
    setEditingEmployee(null);
    setShowAddForm(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setShowAddForm(true);
  };

  const handleFormSuccess = () => {
    setShowAddForm(false);
    setEditingEmployee(null);
  };

  const handleFormClose = () => {
    setShowAddForm(false);
    setEditingEmployee(null);
  };

  // Show loading state
  if (authGuard.isLoading || status === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  // If not authenticated or wrong role, show modal and don't render content
  if (!authGuard.isAuthenticated || authGuard.reason) {
    return (
      <>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">Checking access permissions...</p>
            </CardContent>
          </Card>
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

  const user = (activeSession as any)?.user;
  const orgId = (activeSession as any)?.organization || 'N/A';

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-4xl font-bold">Employee Management</h1>
              <p className="text-muted-foreground mt-1">
                Manage employees for {user?.organization || 'your organization'}
              </p>
              {orgId && orgId !== 'N/A' && (
                <p className="text-sm text-muted-foreground mt-1">
                  Organization ID: <code className="text-xs bg-muted px-1 py-0.5 rounded">{orgId}</code>
                </p>
              )}
            </div>
          </div>
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <LogOut className="h-4 w-4 mr-2" />
            Create Assessment
          </Button>
        </div>

        {/* Employee List */}
        <EmployeeList
          onAddEmployee={handleAddEmployee}
          onEditEmployee={handleEditEmployee}
        />

        {/* Add/Edit Employee Form Modal */}
        {showAddForm && (
          <EmployeeForm
            employee={editingEmployee}
            onClose={handleFormClose}
            onSuccess={handleFormSuccess}
          />
        )}
      </div>
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

