import { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAddEmployee } from '@/hooks/api/useEmployees';
import { cn } from '@/lib/utils';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkUploadModal({ isOpen, onClose, onSuccess }: BulkUploadModalProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addEmployeeMutation = useAddEmployee();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      setSuccess(null);
      return;
    }

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter((line) => line.trim());

      if (lines.length === 0) {
        setError('CSV file is empty');
        setUploading(false);
        return;
      }

      // Parse header row
      const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
      const nameIndex = header.findIndex((h) => h === 'name');
      const emailIndex = header.findIndex((h) => h === 'email');

      if (nameIndex === -1 || emailIndex === -1) {
        setError("CSV must contain 'name' and 'email' columns");
        setUploading(false);
        return;
      }

      // Parse data rows
      const employeesToAdd: Array<{ email: string; name: string }> = [];
      const invalidRows: number[] = [];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(',').map((cell) => cell.trim());
        const email = row[emailIndex]?.trim().toLowerCase();
        const name = row[nameIndex]?.trim();

        if (!email || !name || !emailRegex.test(email)) {
          invalidRows.push(i + 1);
          continue;
        }

        // Check for duplicates in CSV
        if (employeesToAdd.some((e) => e.email.toLowerCase() === email.toLowerCase())) {
          continue;
        }

        employeesToAdd.push({ email, name });
      }

      if (employeesToAdd.length === 0) {
        setError('No valid employees found in CSV');
        setUploading(false);
        return;
      }

      // Add employees one by one with delays
      let successCount = 0;
      let failCount = 0;
      const errors: Array<{ email: string; name: string; error: string }> = [];

      for (let i = 0; i < employeesToAdd.length; i++) {
        const employee = employeesToAdd[i];

        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        try {
          await addEmployeeMutation.mutateAsync({
            name: employee.name,
            email: employee.email,
          });
          successCount++;
        } catch (err: any) {
          failCount++;
          const errorMsg = err?.response?.data?.detail || err?.message || 'Failed to add employee';
          errors.push({
            email: employee.email,
            name: employee.name,
            error: errorMsg,
          });
        }
      }

      setUploading(false);

      let message = `Successfully added ${successCount} employee(s).`;
      if (failCount > 0) {
        message += ` Failed to add ${failCount} employee(s).`;
      }
      if (invalidRows.length > 0) {
        message += ` Skipped ${invalidRows.length} invalid row(s).`;
      }

      if (failCount > 0 && errors.length > 0) {
        const errorDetails = errors
          .slice(0, 5)
          .map((e) => `• ${e.name || e.email}: ${e.error}`)
          .join('\n');
        const moreErrors = errors.length > 5 ? `\n... and ${errors.length - 5} more error(s)` : '';
        setError(message + '\n\nFailed employees:\n' + errorDetails + moreErrors);
      } else {
        setSuccess(message);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 2000);
      }

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Error parsing CSV:', err);
      setError(err?.message || 'Failed to process CSV file');
      setUploading(false);
    }
  };

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
                <h2 className="text-2xl font-bold text-text-primary">Upload CSV</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-mint-50 rounded-lg transition-colors focus:ring-4 focus:ring-mint-100 outline-none"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5 text-text-secondary" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6 space-y-4">
                {/* Instructions */}
                <div className="bg-mint-50 border border-mint-200 rounded-xl p-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    CSV Format Requirements
                  </h3>
                  <ul className="text-xs text-text-secondary space-y-1 list-disc list-inside">
                    <li>CSV must contain 'name' and 'email' columns</li>
                    <li>First row should be the header</li>
                    <li>Each row should contain valid name and email</li>
                    <li>Duplicate emails will be skipped</li>
                  </ul>
                </div>

                {/* File Input */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    disabled={uploading}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label
                    htmlFor="csv-upload"
                    className={cn(
                      'flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer transition-all',
                      uploading
                        ? 'border-mint-300 bg-mint-50 cursor-not-allowed'
                        : 'border-gray-300 hover:border-mint-300 hover:bg-mint-50/50'
                    )}
                  >
                    <Upload className={cn('w-8 h-8 mb-2', uploading ? 'text-mint-300' : 'text-text-subtle')} />
                    <span className="text-sm font-medium text-text-secondary">
                      {uploading ? 'Uploading...' : 'Click to upload CSV file'}
                    </span>
                    <span className="text-xs text-text-subtle mt-1">or drag and drop</span>
                  </label>
                </div>

                {/* Error Message */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-red-50 border border-red-200 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-red-800 mb-1">Upload Error</p>
                        <p className="text-sm text-red-700 whitespace-pre-line">{error}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Success Message */}
                {success && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-green-50 border border-green-200 rounded-xl p-4"
                  >
                    <div className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-green-800 mb-1">Upload Successful</p>
                        <p className="text-sm text-green-700">{success}</p>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={uploading}
                    className="flex-1 px-6 py-3 bg-white border-2 border-mint-300 text-text-primary font-medium rounded-xl hover:bg-mint-50 transition-all focus:ring-4 focus:ring-mint-100 outline-none disabled:opacity-50"
                  >
                    {success ? 'Close' : 'Cancel'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

