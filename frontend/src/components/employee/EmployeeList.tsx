/**
 * EmployeeList Component
 * 
 * Displays a list of employees with search, filter, and pagination
 * Used in employee management page for org_admins
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../dsa/ui/card';
import { Button } from '../dsa/ui/button';
import { Input } from '../dsa/ui/input';
import { Select } from '../dsa/ui/select';
import { useEmployees, useDeleteEmployee, useResendWelcomeEmail, type Employee } from '@/hooks/api/useEmployees';
import { User, Mail, Trash2, Mail as MailIcon, Search, Filter, Plus } from 'lucide-react';

interface EmployeeListProps {
  onAddEmployee: () => void;
  onEditEmployee: (employee: Employee) => void;
}

export default function EmployeeList({ onAddEmployee, onEditEmployee }: EmployeeListProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const limit = 10;

  const { data, isLoading, error, refetch } = useEmployees({
    page,
    limit,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const deleteEmployeeMutation = useDeleteEmployee();
  const resendEmailMutation = useResendWelcomeEmail();

  const handleDelete = async (aaptorId: string, name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteEmployeeMutation.mutateAsync(aaptorId);
    } catch (error: any) {
      alert(error?.response?.data?.detail || error?.message || 'Failed to delete employee');
    }
  };

  const handleResendEmail = async (aaptorId: string) => {
    try {
      await resendEmailMutation.mutateAsync(aaptorId);
      alert('Welcome email resent successfully!');
    } catch (error: any) {
      alert(error?.response?.data?.detail || error?.message || 'Failed to resend email');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Loading employees...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-red-600">
            Error loading employees: {(error as any)?.message || 'Unknown error'}
          </p>
          <Button onClick={() => refetch()} variant="outline" className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const employees = data?.employees || [];
  const pagination = data?.pagination;

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, email, or Aaptor ID..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1); // Reset to first page on search
                }}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </Select>
              <Button onClick={onAddEmployee} className="whitespace-nowrap">
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employees Table */}
      <Card>
        <CardHeader>
          <CardTitle>Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">
                {search || statusFilter
                  ? 'No employees found matching your criteria.'
                  : 'No employees yet. Add your first employee to get started.'}
              </p>
              {!search && !statusFilter && (
                <Button onClick={onAddEmployee} className="mt-4">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Employee
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 text-sm font-medium">Aaptor ID</th>
                      <th className="text-left p-3 text-sm font-medium">Name</th>
                      <th className="text-left p-3 text-sm font-medium">Email</th>
                      <th className="text-left p-3 text-sm font-medium">Status</th>
                      <th className="text-left p-3 text-sm font-medium">Password Set</th>
                      <th className="text-right p-3 text-sm font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((employee) => (
                      <tr key={employee.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <code className="text-sm font-mono">{employee.aaptorId}</code>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{employee.name}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <span>{employee.email}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              employee.status === 'active'
                                ? 'bg-green-100 text-green-800'
                                : employee.status === 'pending'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                          >
                            {employee.status}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`text-sm ${
                              employee.isPasswordSet ? 'text-green-600' : 'text-yellow-600'
                            }`}
                          >
                            {employee.isPasswordSet ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-2">
                            {!employee.isPasswordSet && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResendEmail(employee.aaptorId)}
                                disabled={resendEmailMutation.isPending}
                              >
                                <MailIcon className="h-4 w-4 mr-1" />
                                Resend Email
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onEditEmployee(employee)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDelete(employee.aaptorId, employee.name)}
                              disabled={deleteEmployeeMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, pagination.total)} of{' '}
                    {pagination.total} employees
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {page} of {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                      disabled={page === pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

