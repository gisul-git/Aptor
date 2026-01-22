/**
 * EmployeeForm Component
 * 
 * Form for adding or editing employees
 * Used in employee management page for org_admins
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../dsa/ui/card';
import { Button } from '../dsa/ui/button';
import { Input } from '../dsa/ui/input';
import { Select } from '../dsa/ui/select';
import { useAddEmployee, useUpdateEmployee, type Employee, type AddEmployeeRequest, type UpdateEmployeeRequest } from '@/hooks/api/useEmployees';
import { X } from 'lucide-react';

interface EmployeeFormProps {
  employee?: Employee | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EmployeeForm({ employee, onClose, onSuccess }: EmployeeFormProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'pending' | 'active' | 'inactive'>('pending');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});

  const addEmployeeMutation = useAddEmployee();
  const updateEmployeeMutation = useUpdateEmployee();

  // Pre-fill form if editing
  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setEmail(employee.email);
      setStatus(employee.status);
    } else {
      // Reset form for new employee
      setName('');
      setEmail('');
      setStatus('pending');
    }
    setErrors({});
  }, [employee]);

  const validateForm = (): boolean => {
    const newErrors: { name?: string; email?: string } = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      if (employee) {
        // Update existing employee
        const updateData: UpdateEmployeeRequest = {};
        if (name !== employee.name) updateData.name = name;
        if (email !== employee.email) updateData.email = email;
        if (status !== employee.status) updateData.status = status;

        await updateEmployeeMutation.mutateAsync({
          aaptorId: employee.aaptorId,
          data: updateData,
        });
      } else {
        // Add new employee
        const addData: AddEmployeeRequest = {
          name: name.trim(),
          email: email.trim().toLowerCase(),
        };

        await addEmployeeMutation.mutateAsync(addData);
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      const errorMessage = error?.response?.data?.detail || error?.message || 'Operation failed';
      alert(errorMessage);
    }
  };

  const isLoading = addEmployeeMutation.isPending || updateEmployeeMutation.isPending;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{employee ? 'Edit Employee' : 'Add Employee'}</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({ ...errors, name: undefined });
                }}
                placeholder="Enter employee name"
                disabled={isLoading}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors({ ...errors, email: undefined });
                }}
                placeholder="Enter employee email"
                disabled={isLoading || !!employee}
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email}</p>}
              {employee && (
                <p className="text-xs text-muted-foreground mt-1">
                  Email cannot be changed after employee is created
                </p>
              )}
            </div>

            {employee && (
              <div>
                <label htmlFor="status" className="block text-sm font-medium mb-1">
                  Status
                </label>
                <Select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'pending' | 'active' | 'inactive')}
                  disabled={isLoading}
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </Select>
              </div>
            )}

            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isLoading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? 'Saving...' : employee ? 'Update' : 'Add Employee'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

