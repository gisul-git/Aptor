import React, { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import axios from "axios";
import { Shield, Key, Smartphone, Download, Copy, Printer, AlertCircle, CheckCircle2, Loader2, RefreshCw, Eye, EyeOff } from "lucide-react";

interface MFAStatus {
  enabled: boolean;
  setup_date: string | null;
  last_used: string | null;
  backup_codes_remaining: number;
}

export default function MFAManagementPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [mfaStatus, setMfaStatus] = useState<MFAStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [showResetAuthModal, setShowResetAuthModal] = useState(false);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [password, setPassword] = useState("");
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [newQRCode, setNewQRCode] = useState("");
  const [newSecret, setNewSecret] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (session?.user?.email) {
      loadMFAStatus();
    }
  }, [session]);

  const loadMFAStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/mfa/status`,
        {
          params: { email: (session?.user as any)?.email },
          headers: {
            Authorization: `Bearer ${(session as any)?.backendToken}`,
          },
        }
      );
      
      setMfaStatus(response.data.data);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to load MFA status");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateBackupCodes = async () => {
    if (!password) {
      setError("Please enter your password");
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/mfa/regenerate-backup-codes`,
        { password },
        {
          params: { email: (session?.user as any)?.email },
          headers: {
            Authorization: `Bearer ${(session as any)?.backendToken}`,
          },
        }
      );
      
      setNewBackupCodes(response.data.data.backupCodes);
      setShowBackupCodes(true);
      setShowRegenerateModal(false);
      setPassword("");
      
      // Reload status
      await loadMFAStatus();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to regenerate backup codes");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetAuthenticator = async () => {
    if (!password) {
      setError("Please enter your password");
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/mfa/reset-authenticator`,
        { password },
        {
          params: { email: (session?.user as any)?.email },
          headers: {
            Authorization: `Bearer ${(session as any)?.backendToken}`,
          },
        }
      );
      
      setNewSecret(response.data.data.secret);
      setNewQRCode(response.data.data.qrCode);
      setShowResetAuthModal(false);
      setPassword("");
      
      alert("Authenticator reset successful. Please scan the new QR code with your authenticator app.");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to reset authenticator");
    } finally {
      setActionLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = `Aaptor Backup Codes\n\nEmail: ${(session?.user as any)?.email}\nGenerated: ${new Date().toLocaleString()}\n\n${newBackupCodes.join("\n")}\n\nIMPORTANT:\n- Each code can only be used once\n- Keep these codes in a safe place\n- Do not share these codes with anyone`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aaptor-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(newBackupCodes.join("\n"));
    alert("Backup codes copied to clipboard");
  };

  const printBackupCodes = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Aaptor Backup Codes</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 40px; }
              h1 { color: #1E5A3B; }
              .code { font-family: monospace; font-size: 18px; margin: 10px 0; }
              .warning { color: #ef4444; margin-top: 20px; }
            </style>
          </head>
          <body>
            <h1>Aaptor Backup Codes</h1>
            <p><strong>Email:</strong> ${(session?.user as any)?.email}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <hr>
            ${newBackupCodes.map(code => `<div class="code">${code}</div>`).join("")}
            <div class="warning">
              <p><strong>IMPORTANT:</strong></p>
              <ul>
                <li>Each code can only be used once</li>
                <li>Keep these codes in a safe place</li>
                <li>Do not share these codes with anyone</li>
              </ul>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-mint-200 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Two-Factor Authentication
          </h1>
          <p className="text-text-secondary">
            Manage your account security settings
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* MFA Status Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center ${mfaStatus?.enabled ? "bg-green-100" : "bg-gray-100"}`}>
                <Shield className={`w-8 h-8 ${mfaStatus?.enabled ? "text-green-600" : "text-gray-400"}`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-text-primary mb-1">
                  {mfaStatus?.enabled ? "MFA Enabled" : "MFA Disabled"}
                </h2>
                <p className="text-sm text-text-secondary">
                  {mfaStatus?.enabled 
                    ? "Your account is protected with two-factor authentication"
                    : "Enable MFA to secure your account"}
                </p>
              </div>
            </div>
            {mfaStatus?.enabled && (
              <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-full">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Active</span>
              </div>
            )}
          </div>

          {mfaStatus?.enabled && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6 border-t border-gray-100">
              <div>
                <p className="text-xs text-text-subtle mb-1">Setup Date</p>
                <p className="text-sm font-medium text-text-primary">
                  {mfaStatus.setup_date 
                    ? new Date(mfaStatus.setup_date).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-subtle mb-1">Last Used</p>
                <p className="text-sm font-medium text-text-primary">
                  {mfaStatus.last_used 
                    ? new Date(mfaStatus.last_used).toLocaleString()
                    : "Never"}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-subtle mb-1">Backup Codes Remaining</p>
                <p className={`text-sm font-medium ${mfaStatus.backup_codes_remaining < 3 ? "text-red-600" : "text-text-primary"}`}>
                  {mfaStatus.backup_codes_remaining} / 10
                  {mfaStatus.backup_codes_remaining < 3 && (
                    <span className="ml-2 text-xs text-red-600">(Low)</span>
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {mfaStatus?.enabled && (
          <>
            {/* Authenticator App Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                    <Smartphone className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">
                      Authenticator App
                    </h3>
                    <p className="text-sm text-text-secondary">
                      Use Google Authenticator, Microsoft Authenticator, or Authy
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowResetAuthModal(true)}
                  className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  Change App
                </button>
              </div>
            </div>

            {/* Backup Codes Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Key className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-1">
                      Backup Codes
                    </h3>
                    <p className="text-sm text-text-secondary">
                      {mfaStatus.backup_codes_remaining} unused codes remaining
                    </p>
                    {mfaStatus.backup_codes_remaining < 3 && (
                      <p className="text-sm text-red-600 mt-1">
                        ⚠️ You're running low on backup codes. Generate new ones.
                      </p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setShowRegenerateModal(true)}
                  className="px-4 py-2 text-sm font-medium text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </button>
              </div>
            </div>
          </>
        )}

        {/* Regenerate Backup Codes Modal */}
        {showRegenerateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-text-primary mb-4">
                Regenerate Backup Codes
              </h3>
              
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    This will invalidate all your existing backup codes. Make sure to save the new codes.
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Confirm your password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-200 focus:border-transparent"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRegenerateModal(false);
                    setPassword("");
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-text-primary rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRegenerateBackupCodes}
                  disabled={actionLoading || !password}
                  className="flex-1 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Regenerate"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Authenticator Modal */}
        {showResetAuthModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-text-primary mb-4">
                Change Authenticator App
              </h3>
              
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800">
                    You'll need to scan a new QR code with your authenticator app.
                  </p>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Confirm your password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-mint-200 focus:border-transparent"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowResetAuthModal(false);
                    setPassword("");
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-text-primary rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetAuthenticator}
                  disabled={actionLoading || !password}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    "Reset"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Show Backup Codes Modal */}
        {showBackupCodes && newBackupCodes.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full p-6">
              <h3 className="text-xl font-semibold text-text-primary mb-4">
                Your New Backup Codes
              </h3>
              
              <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-800">
                    Save these codes securely. Each can only be used once.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                {newBackupCodes.map((code, index) => (
                  <div key={index} className="font-mono text-sm text-center py-2 bg-white rounded border border-gray-200">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex gap-3 mb-4">
                <button
                  onClick={downloadBackupCodes}
                  className="flex-1 py-2 bg-gray-100 text-text-primary rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={copyBackupCodes}
                  className="flex-1 py-2 bg-gray-100 text-text-primary rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy
                </button>
                <button
                  onClick={printBackupCodes}
                  className="flex-1 py-2 bg-gray-100 text-text-primary rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </button>
              </div>

              <button
                onClick={() => {
                  setShowBackupCodes(false);
                  setNewBackupCodes([]);
                }}
                className="w-full py-2 bg-mint-200 text-white rounded-lg font-medium hover:bg-mint-300 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {/* Show New QR Code Modal */}
        {newQRCode && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-text-primary mb-4">
                Scan New QR Code
              </h3>
              
              <p className="text-sm text-text-secondary mb-6">
                Scan this QR code with your authenticator app to complete the change.
              </p>

              <div className="flex flex-col items-center space-y-4 mb-6">
                <div className="p-4 bg-white border-2 border-mint-100 rounded-xl">
                  <img src={newQRCode} alt="QR Code" className="w-64 h-64" />
                </div>
                
                <div className="w-full">
                  <p className="text-sm text-text-secondary text-center mb-2">
                    Or enter this code manually:
                  </p>
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <code className="text-sm font-mono text-center block break-all">
                      {newSecret}
                    </code>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setNewQRCode("");
                  setNewSecret("");
                }}
                className="w-full py-2 bg-mint-200 text-white rounded-lg font-medium hover:bg-mint-300 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
