import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import axios from "axios";
import { Shield, Download, Printer, Copy, CheckCircle2, AlertCircle, Loader2, Smartphone } from "lucide-react";

export default function MFASetupPage() {
  const router = useRouter();
  const { email: emailFromQuery } = router.query;
  
  // Try to get email from query param or sessionStorage
  const [email, setEmail] = useState<string>("");
  
  const [step, setStep] = useState<"qr" | "verify" | "backup">("qr");
  const [secret, setSecret] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedConfirmed, setSavedConfirmed] = useState(false);
  const [encryptedSecret, setEncryptedSecret] = useState("");
  const [hashedBackupCodes, setHashedBackupCodes] = useState<any[]>([]);
  const [initializing, setInitializing] = useState(true);

  // First useEffect: Get email from query or sessionStorage
  useEffect(() => {
    console.log("🔍 [MFA Setup] Email detection useEffect triggered");
    console.log("🔍 [MFA Setup] router.isReady:", router.isReady);
    console.log("🔍 [MFA Setup] emailFromQuery:", emailFromQuery);
    
    if (!router.isReady) {
      console.log("🔄 [MFA Setup] Router not ready yet, waiting...");
      return;
    }
    
    // Try to get email from query param first
    if (emailFromQuery && typeof emailFromQuery === "string") {
      console.log("✅ [MFA Setup] Email found in query:", emailFromQuery);
      setEmail(emailFromQuery);
      return;
    }
    
    // Fallback to sessionStorage
    if (typeof window !== "undefined") {
      const storedEmail = sessionStorage.getItem("mfa_setup_email");
      console.log("🔍 [MFA Setup] Checking sessionStorage for email:", storedEmail);
      
      if (storedEmail) {
        console.log("✅ [MFA Setup] Email found in sessionStorage:", storedEmail);
        setEmail(storedEmail);
        return;
      }
    }
    
    // If no email found after router is ready, redirect immediately
    console.log("❌ [MFA Setup] No email found, redirecting to signin");
    router.push("/auth/signin");
  }, [router.isReady, emailFromQuery]);

  // Second useEffect: Initialize MFA setup when email is available
  useEffect(() => {
    console.log("🔍 [MFA Setup] Initialization useEffect triggered");
    console.log("🔍 [MFA Setup] email:", email);
    console.log("🔍 [MFA Setup] initializing:", initializing);
    
    if (!email) {
      console.log("⏳ [MFA Setup] No email yet, waiting...");
      return;
    }
    
    if (!initializing) {
      console.log("⏭️ [MFA Setup] Already initialized, skipping...");
      return;
    }
    
    console.log("✅ [MFA Setup] Email available, initiating MFA setup...");
    setInitializing(false);
    initiateMFASetup();
  }, [email, initializing]);

  const initiateMFASetup = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log("🔵 [MFA Setup] Initiating setup for email:", email);
      
      // Get MFA setup token from sessionStorage
      const mfaSetupToken = typeof window !== "undefined" ? sessionStorage.getItem("mfa_setup_token") : null;
      
      if (!mfaSetupToken) {
        setError("Authentication token missing. Please sign in again.");
        console.error("❌ [MFA Setup] No MFA setup token found");
        return;
      }
      
      console.log("🔵 [MFA Setup] Using MFA setup token for API calls");
      
      // Step 1: Get secret
      const setupResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/mfa/setup`,
        {},
        {
          headers: {
            Authorization: `Bearer ${mfaSetupToken}`,
          }
        }
      );
      
      const secretKey = setupResponse.data.data.secret;
      setSecret(secretKey);
      
      // Step 2: Generate QR code
      const qrResponse = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/mfa/generate-qr`,
        null,
        {
          params: {
            email: email,
            secret: secretKey,
          },
          headers: {
            Authorization: `Bearer ${mfaSetupToken}`,
          }
        }
      );
      
      setQrCode(qrResponse.data.data.qrCode);
      console.log("✅ [MFA Setup] QR code generated successfully");
    } catch (err: any) {
      console.error("❌ [MFA Setup] Error:", err);
      const errorMessage = err.response?.data?.detail || "Failed to initiate MFA setup";
      setError(errorMessage);
      
      // If token is invalid, redirect to signin
      if (err.response?.status === 401 || err.response?.status === 403) {
        console.error("❌ [MFA Setup] Invalid token, redirecting to signin");
        setTimeout(() => router.push("/auth/signin"), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const verifySetup = async () => {
    if (verificationCode.length !== 6) {
      setError("Please enter a 6-digit code");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Get MFA setup token from sessionStorage
      const mfaSetupToken = typeof window !== "undefined" ? sessionStorage.getItem("mfa_setup_token") : null;
      
      if (!mfaSetupToken) {
        setError("Authentication token missing. Please sign in again.");
        console.error("❌ [MFA Setup] No MFA setup token found for verification");
        return;
      }
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/mfa/verify-setup`,
        {
          code: verificationCode,
          secret: secret,
        },
        {
          headers: {
            Authorization: `Bearer ${mfaSetupToken}`,
          }
        }
      );
      
      setBackupCodes(response.data.data.backupCodes);
      setEncryptedSecret(response.data.data.encryptedSecret);
      setHashedBackupCodes(response.data.data.hashedBackupCodes);
      setStep("backup");
      console.log("✅ [MFA Setup] Verification successful, showing backup codes");
    } catch (err: any) {
      console.error("❌ [MFA Setup] Verification error:", err);
      const errorMessage = err.response?.data?.detail || "Invalid verification code";
      setError(errorMessage);
      
      // If token is invalid, redirect to signin
      if (err.response?.status === 401 || err.response?.status === 403) {
        console.error("❌ [MFA Setup] Invalid token during verification, redirecting to signin");
        setTimeout(() => router.push("/auth/signin"), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const completeSetup = async () => {
    if (!savedConfirmed) {
      setError("Please confirm that you have saved your backup codes");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log("🔵 [MFA Setup] Completing setup for email:", email);
      
      // Get MFA setup token from sessionStorage
      const mfaSetupToken = typeof window !== "undefined" ? sessionStorage.getItem("mfa_setup_token") : null;
      
      if (!mfaSetupToken) {
        setError("Authentication token missing. Please sign in again.");
        console.error("❌ [MFA Setup] No MFA setup token found");
        return;
      }
      
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/mfa/complete-setup`,
        {
          email: email,
          encrypted_secret: encryptedSecret,
          hashed_backup_codes: hashedBackupCodes,
        },
        {
          headers: {
            Authorization: `Bearer ${mfaSetupToken}`,
          }
        }
      );
      
      console.log("✅ [MFA Setup] Setup completed successfully");
      
      // Get access and refresh tokens from response
      const { accessToken, refreshToken, user } = response.data.data;
      
      // Clear sessionStorage
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("mfa_setup_email");
        sessionStorage.removeItem("mfa_setup_token");
      }
      
      // Store tokens and redirect to dashboard
      // The tokens will be handled by NextAuth on the dashboard page
      if (typeof window !== "undefined") {
        // Store tokens in localStorage for NextAuth
        localStorage.setItem("access_token", accessToken);
        localStorage.setItem("refresh_token", refreshToken);
      }
      
      console.log("✅ [MFA Setup] Redirecting to dashboard");
      
      // Redirect to dashboard
      router.push("/dashboard");
    } catch (err: any) {
      console.error("❌ [MFA Setup] Complete setup error:", err);
      const errorMessage = err.response?.data?.detail || "Failed to complete MFA setup";
      setError(errorMessage);
      
      // If token is invalid, redirect to signin
      if (err.response?.status === 401 || err.response?.status === 403) {
        console.error("❌ [MFA Setup] Invalid token, redirecting to signin");
        setTimeout(() => router.push("/auth/signin"), 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadBackupCodes = () => {
    const content = `Aaptor Backup Codes\n\nEmail: ${email}\nGenerated: ${new Date().toLocaleString()}\n\n${backupCodes.join("\n")}\n\nIMPORTANT:\n- Each code can only be used once\n- Keep these codes in a safe place\n- Do not share these codes with anyone`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aaptor-backup-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
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
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
            <hr>
            ${backupCodes.map(code => `<div class="code">${code}</div>`).join("")}
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-mint-50 via-white to-mint-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Image src="/Aaptor%20Logo.png" alt="Aaptor" width={60} height={60} />
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Set Up Two-Factor Authentication
          </h1>
          <p className="text-text-secondary">
            Secure your account with an additional layer of protection
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step === "qr" ? "bg-mint-200 text-white" : "bg-mint-100 text-mint-200"}`}>
                1
              </div>
              <div className={`w-16 h-1 ${step !== "qr" ? "bg-mint-200" : "bg-gray-200"}`}></div>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step === "verify" ? "bg-mint-200 text-white" : step === "backup" ? "bg-mint-100 text-mint-200" : "bg-gray-200 text-gray-400"}`}>
                2
              </div>
              <div className={`w-16 h-1 ${step === "backup" ? "bg-mint-200" : "bg-gray-200"}`}></div>
              <div className={`flex items-center justify-center w-10 h-10 rounded-full ${step === "backup" ? "bg-mint-200 text-white" : "bg-gray-200 text-gray-400"}`}>
                3
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Step 1: QR Code */}
          {step === "qr" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-mint-100 rounded-full mb-4">
                  <Smartphone className="w-8 h-8 text-mint-200" />
                </div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">
                  Scan QR Code
                </h2>
                <p className="text-text-secondary text-sm">
                  Use Google Authenticator, Microsoft Authenticator, or Authy to scan this QR code
                </p>
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-mint-200 animate-spin" />
                </div>
              ) : qrCode ? (
                <div className="flex flex-col items-center space-y-4">
                  <div className="p-4 bg-white border-2 border-mint-100 rounded-xl">
                    <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                  </div>
                  
                  <div className="w-full max-w-md">
                    <p className="text-sm text-text-secondary text-center mb-2">
                      Or enter this code manually:
                    </p>
                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <code className="text-sm font-mono text-center block break-all">
                        {secret}
                      </code>
                    </div>
                  </div>

                  <button
                    onClick={() => setStep("verify")}
                    className="w-full max-w-md py-3 bg-mint-200 text-white rounded-lg font-medium hover:bg-mint-300 transition-colors"
                  >
                    Continue to Verification
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Step 2: Verify Code */}
          {step === "verify" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-mint-100 rounded-full mb-4">
                  <Shield className="w-8 h-8 text-mint-200" />
                </div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">
                  Verify Setup
                </h2>
                <p className="text-text-secondary text-sm">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-4">
                <div>
                  <input
                    type="text"
                    value={verificationCode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                      setVerificationCode(value);
                      setError(null);
                    }}
                    placeholder="000000"
                    className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border-2 border-gray-200 rounded-lg focus:border-mint-200 focus:outline-none"
                    maxLength={6}
                    autoFocus
                  />
                </div>

                <button
                  onClick={verifySetup}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full py-3 bg-mint-200 text-white rounded-lg font-medium hover:bg-mint-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify Code"
                  )}
                </button>

                <button
                  onClick={() => setStep("qr")}
                  className="w-full py-3 text-text-secondary hover:text-text-primary transition-colors"
                >
                  Back to QR Code
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Backup Codes */}
          {step === "backup" && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-mint-100 rounded-full mb-4">
                  <CheckCircle2 className="w-8 h-8 text-mint-200" />
                </div>
                <h2 className="text-xl font-semibold text-text-primary mb-2">
                  Save Your Backup Codes
                </h2>
                <p className="text-text-secondary text-sm">
                  Store these codes securely. Each can only be used once.
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Important:</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Save these codes in a safe place</li>
                      <li>Each code can only be used once</li>
                      <li>Use them when you don't have access to your authenticator app</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                {backupCodes.map((code, index) => (
                  <div key={index} className="font-mono text-sm text-center py-2 bg-white rounded border border-gray-200">
                    {code}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={downloadBackupCodes}
                  className="flex-1 py-3 bg-gray-100 text-text-primary rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download
                </button>
                <button
                  onClick={copyBackupCodes}
                  className="flex-1 py-3 bg-gray-100 text-text-primary rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Copy className="w-5 h-5" />
                  Copy
                </button>
                <button
                  onClick={printBackupCodes}
                  className="flex-1 py-3 bg-gray-100 text-text-primary rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Print
                </button>
              </div>

              <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="saved-confirmation"
                  checked={savedConfirmed}
                  onChange={(e) => {
                    setSavedConfirmed(e.target.checked);
                    setError(null);
                  }}
                  className="mt-1"
                />
                <label htmlFor="saved-confirmation" className="text-sm text-text-secondary cursor-pointer">
                  I have saved my backup codes securely and understand that I won't be able to see them again
                </label>
              </div>

              <button
                onClick={completeSetup}
                disabled={loading || !savedConfirmed}
                className="w-full py-3 bg-mint-200 text-white rounded-lg font-medium hover:bg-mint-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Completing Setup...
                  </>
                ) : (
                  "Complete Setup"
                )}
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-sm text-text-subtle">
            Need help? Contact{" "}
            <a href="mailto:support@aaptor.com" className="text-mint-200 hover:underline">
              support@aaptor.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
