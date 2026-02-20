import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAddEmployee, useUpdateEmployee, type Employee, type AddEmployeeRequest, type UpdateEmployeeRequest } from '@/hooks/api/useEmployees';
import { cn } from '@/lib/utils';

interface AddEmployeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  employee?: Employee | null;
}

export function AddEmployeeModal({ isOpen, onClose, onSuccess, employee }: AddEmployeeModalProps) {
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
      setName('');
      setEmail('');
      setStatus('pending');
    }
    setErrors({});
  }, [employee, isOpen]);

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
        const updateData: UpdateEmployeeRequest = {};
        if (name !== employee.name) updateData.name = name;
        if (email !== employee.email) updateData.email = email;
        if (status !== employee.status) updateData.status = status;

        await updateEmployeeMutation.mutateAsync({
          aaptorId: employee.aaptorId,
          data: updateData,
        });
      } else {
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
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white rounded-2xl shadow-xl border-2 border-mint-200 w-full max-w-md">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b-2 border-mint-200">
                <h2 className="text-2xl font-bold text-text-primary">
                  {employee ? 'Edit Employee' : 'Add Employee'}
                </h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-mint-50 rounded-lg transition-colors focus:ring-4 focus:ring-mint-100 outline-none"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold mb-2 text-text-primary">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors({ ...errors, name: undefined });
                    }}
                    placeholder="Enter employee name"
                    disabled={isLoading}
                    className={cn(
                      'w-full h-12 px-4 bg-white border-2 rounded-xl text-sm text-text-secondary placeholder:text-text-subtle focus:border-mint-300 focus:ring-4 focus:ring-mint-100 transition-all outline-none',
                      errors.name ? 'border-red-300' : 'border-gray-300'
                    )}
                  />
                  {errors.name && (
                    <p className="text-sm text-red-600 mt-1">{errors.name}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-semibold mb-2 text-text-primary">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors({ ...errors, email: undefined });
                    }}
                    placeholder="Enter employee email"
                    disabled={isLoading || !!employee}
                    className={cn(
                      'w-full h-12 px-4 bg-white border-2 rounded-xl text-sm text-text-secondary placeholder:text-text-subtle focus:border-mint-300 focus:ring-4 focus:ring-mint-100 transition-all outline-none',
                      errors.email ? 'border-red-300' : 'border-gray-300',
                      employee && 'bg-gray-50 cursor-not-allowed'
                    )}
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600 mt-1">{errors.email}</p>
                  )}
                  {employee && (
                    <p className="text-xs text-text-subtle mt-1">
                      Email cannot be changed after employee is created
                    </p>
                  )}
                </div>

                {employee && (
                  <div>
                    <label htmlFor="status" className="block text-sm font-semibold mb-2 text-text-primary">
                      Status
                    </label>
                    <select
                      id="status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as 'pending' | 'active' | 'inactive')}
                      disabled={isLoading}
                      className="w-full h-12 px-4 bg-white border-2 border-gray-300 rounded-xl text-sm font-medium text-text-secondary hover:border-mint-300 focus:border-mint-300 focus:ring-4 focus:ring-mint-100 transition-all outline-none cursor-pointer"
                    >
                      <option value="pending">Pending</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={isLoading}
                    className="flex-1 px-6 py-3 bg-white border-2 border-mint-300 text-text-primary font-medium rounded-xl hover:bg-mint-50 transition-all focus:ring-4 focus:ring-mint-100 outline-none disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-mint-100 to-mint-200 text-text-primary font-semibold rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-200 focus:ring-4 focus:ring-mint-100 outline-none disabled:opacity-50"
                  >
                    {isLoading ? 'Saving...' : employee ? 'Update' : 'Add Employee'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

