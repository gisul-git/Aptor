/**
 * EmployeeList Component
 * 
 * Displays a list of employees with search, filter, and pagination
 * Used in employee management page for org_admins
 */

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../dsa/ui/card';
import { Button } from '../dsa/ui/button';
import { Input } from '../dsa/ui/input';
import { Select } from '../dsa/ui/select';
import { useEmployees, useDeleteEmployee, useResendWelcomeEmail, useAddEmployee, type Employee } from '@/hooks/api/useEmployees';
import { User, Mail, Trash2, Mail as MailIcon, Search, Filter, Plus, Upload } from 'lucide-react';

interface EmployeeListProps {
  onAddEmployee: () => void;
  onEditEmployee: (employee: Employee) => void;
}

export default function EmployeeList({ onAddEmployee, onEditEmployee }: EmployeeListProps) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [uploadingCsv, setUploadingCsv] = useState(false);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvSuccess, setCsvSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const limit = 10;

  const { data, isLoading, error, refetch } = useEmployees({
    page,
    limit,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const deleteEmployeeMutation = useDeleteEmployee();
  const resendEmailMutation = useResendWelcomeEmail();
  const addEmployeeMutation = useAddEmployee();

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
      alert('Email sent successfully! The employee will receive their Aaptor ID and password information.');
    } catch (error: any) {
      alert(error?.response?.data?.detail || error?.message || 'Failed to send email');
    }
  };

  const [sendingToAll, setSendingToAll] = useState(false);

  const handleSendEmailToAll = async () => {
    if (!employees || employees.length === 0) {
      alert('No employees to send emails to.');
      return;
    }

    if (!confirm(`Are you sure you want to send emails to all ${employees.length} employee(s)?`)) {
      return;
    }

    setSendingToAll(true);
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const employee of employees) {
      try {
        await resendEmailMutation.mutateAsync(employee.aaptorId);
        successCount++;
      } catch (error: any) {
        failCount++;
        const errorMsg = error?.response?.data?.detail || error?.message || 'Failed to send email';
        errors.push(`${employee.name} (${employee.email}): ${errorMsg}`);
      }
    }

    setSendingToAll(false);

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

    // Refetch to update any status changes
    await refetch();
  };

  const handleCsvUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setCsvError('Please upload a CSV file');
      setCsvSuccess(null);
      return;
    }

    setUploadingCsv(true);
    setCsvError(null);
    setCsvSuccess(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        setCsvError('CSV file is empty');
        setUploadingCsv(false);
        return;
      }

      // Parse header row
      const header = lines[0].split(',').map(h => h.trim().toLowerCase());
      const nameIndex = header.findIndex(h => h === 'name');
      const emailIndex = header.findIndex(h => h === 'email');

      if (nameIndex === -1 || emailIndex === -1) {
        setCsvError("CSV must contain 'name' and 'email' columns");
        setUploadingCsv(false);
        return;
      }

      // Get existing employees to check for duplicates
      const existingEmployees = data?.employees || [];
      const existingEmails = new Set(existingEmployees.map(e => e.email.toLowerCase()));

      // Parse data rows
      const employeesToAdd: Array<{ email: string; name: string }> = [];
      const duplicateEmails: string[] = [];
      const invalidRows: number[] = [];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map(cell => cell.trim());
        const email = row[emailIndex]?.trim().toLowerCase();
        const name = row[nameIndex]?.trim();

        // Validate email format and name
        if (!email || !name || !emailRegex.test(email)) {
          invalidRows.push(i + 1);
          continue;
        }

        // Check for duplicates in CSV
        if (employeesToAdd.some(e => e.email.toLowerCase() === email.toLowerCase())) {
          duplicateEmails.push(email);
          continue;
        }

        // Check for duplicates with existing employees
        if (existingEmails.has(email.toLowerCase())) {
          duplicateEmails.push(email);
          continue;
        }

        employeesToAdd.push({ email, name });
        existingEmails.add(email.toLowerCase());
      }

      if (employeesToAdd.length === 0) {
        let errorMsg = 'No valid employees found in CSV. ';
        if (invalidRows.length > 0) {
          errorMsg += `Invalid rows: ${invalidRows.slice(0, 5).join(', ')}${invalidRows.length > 5 ? '...' : ''}. `;
        }
        if (duplicateEmails.length > 0) {
          errorMsg += `Duplicate emails: ${duplicateEmails.slice(0, 5).join(', ')}${duplicateEmails.length > 5 ? '...' : ''}.`;
        }
        setCsvError(errorMsg);
        setUploadingCsv(false);
        return;
      }

      // Add employees one by one (same as single add)
      let successCount = 0;
      let failCount = 0;
      const errors: string[] = [];

      for (const employee of employeesToAdd) {
        try {
          await addEmployeeMutation.mutateAsync({
            name: employee.name,
            email: employee.email,
          });
          successCount++;
        } catch (err: any) {
          failCount++;
          const errorMsg = err?.response?.data?.detail || err?.message || 'Failed to add employee';
          errors.push(`${employee.email}: ${errorMsg}`);
        }
      }

      // Refetch employee list
      await refetch();

      // Show success message with warnings if any
      let message = `Successfully added ${successCount} employee(s).`;
      if (failCount > 0) {
        message += ` Failed to add ${failCount} employee(s).`;
      }
      if (invalidRows.length > 0) {
        message += ` Skipped ${invalidRows.length} invalid row(s).`;
      }
      if (duplicateEmails.length > 0) {
        message += ` Skipped ${duplicateEmails.length} duplicate email(s).`;
      }

      if (failCount > 0 && errors.length > 0) {
        setCsvError(message + '\n\nErrors:\n' + errors.slice(0, 5).join('\n') + (errors.length > 5 ? '...' : ''));
      } else {
        setCsvSuccess(message);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Error parsing CSV:', err);
      setCsvError(err?.message || 'Failed to process CSV file');
    } finally {
      setUploadingCsv(false);
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
      {/* CSV Upload Messages */}
      {csvError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-red-600 whitespace-pre-line">{csvError}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCsvError(null);
                setCsvSuccess(null);
              }}
              className="mt-2"
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}
      {csvSuccess && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4">
            <p className="text-sm text-green-600 whitespace-pre-line">{csvSuccess}</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCsvError(null);
                setCsvSuccess(null);
              }}
              className="mt-2"
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      )}

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
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
                id="csv-upload"
                disabled={uploadingCsv}
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingCsv}
                className="whitespace-nowrap"
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploadingCsv ? 'Uploading...' : 'Upload CSV'}
              </Button>
              {employees.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleSendEmailToAll}
                  disabled={sendingToAll || resendEmailMutation.isPending}
                  className="whitespace-nowrap"
                >
                  <MailIcon className="h-4 w-4 mr-2" />
                  {sendingToAll ? 'Sending...' : 'Send Email to All'}
                </Button>
              )}
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
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResendEmail(employee.aaptorId)}
                              disabled={resendEmailMutation.isPending}
                            >
                              <MailIcon className="h-4 w-4 mr-1" />
                              Send Email
                            </Button>
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

