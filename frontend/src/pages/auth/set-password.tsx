/**
 * Employee Set Password Page
 * 
 * Allows employees to set their password using temporary password from welcome email
 * Accessed via: /auth/set-password?aaptorId=AAP0010001
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import fastApiClient from '../../lib/fastapi';
import { Lock, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function SetPasswordPage() {
  const router = useRouter();
  const { aaptorId } = router.query;
  const [tempPassword, setTempPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showTempPassword, setShowTempPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!aaptorId) {
      setError('Aaptor ID is required. Please use the link from your welcome email.');
    }
  }, [aaptorId]);

  const validatePassword = (password: string): { valid: boolean; message?: string } => {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    if (!/(?=.*[a-z])/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/(?=.*\d)/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    if (!/(?=.*[!@#$%^&*(),.?":{}|<>])/.test(password)) {
      return { valid: false, message: 'Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)' };
    }
    return { valid: true };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!aaptorId || typeof aaptorId !== 'string') {
      setError('Aaptor ID is required. Please use the link from your welcome email.');
      return;
    }

    if (!tempPassword.trim()) {
      setError('Temporary password is required');
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      setError(passwordValidation.message || 'Invalid password');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const response = await fastApiClient.post('/api/v1/employees/set-password', {
        aaptorId: aaptorId.trim().toUpperCase(),
        tempPassword: tempPassword.trim(),
        newPassword: newPassword.trim(),
      });

      if (response.data?.success) {
        setSuccess(true);
        // Redirect to login page after 2 seconds
        setTimeout(() => {
          router.push(`/auth/employee-login?aaptorId=${encodeURIComponent(aaptorId)}`);
        }, 2000);
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || 
                          err?.response?.data?.message || 
                          err?.message || 
                          'Failed to set password. Please check your temporary password and try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f1dcba',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}>
        <div style={{
          width: '100%',
          maxWidth: '420px',
          backgroundColor: '#ffffff',
          borderRadius: '0.75rem',
          padding: '2rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          textAlign: 'center',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '1rem',
          }}>
            <CheckCircle style={{ width: '48px', height: '48px', color: '#10b981' }} />
          </div>
          <h2 style={{
            marginTop: 0,
            marginBottom: '0.5rem',
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#1a1625',
          }}>
            Password Set Successfully!
          </h2>
          <p style={{
            color: '#6b6678',
            marginBottom: '1.5rem',
            fontSize: '0.875rem',
          }}>
            Your password has been set. Redirecting to login page...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f1dcba',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        backgroundColor: '#ffffff',
        borderRadius: '0.75rem',
        padding: '1.5rem',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            backgroundColor: '#E8FAF0',
            marginBottom: '1rem',
          }}>
            <Lock style={{ width: '24px', height: '24px', color: '#2D7A52' }} />
          </div>
          <h1 style={{
            margin: 0,
            marginBottom: '0.5rem',
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#1a1625',
          }}>
            Set Your Password
          </h1>
          <p style={{
            margin: 0,
            color: '#6b6678',
            fontSize: '0.875rem',
          }}>
            {aaptorId ? `Aaptor ID: ${aaptorId}` : 'Enter your temporary password to set a new password'}
          </p>
        </div>

        {error && (
          <div style={{
            padding: '0.75rem',
            marginBottom: '1rem',
            backgroundColor: '#FEE2E2',
            borderLeft: '4px solid #EF4444',
            borderRadius: '0.375rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <AlertCircle style={{ width: '16px', height: '16px', color: '#EF4444', flexShrink: 0 }} />
            <p style={{
              margin: 0,
              color: '#DC2626',
              fontSize: '0.875rem',
            }}>
              {error}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ margin: 0 }}>
          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="aaptorId" style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 500,
              marginBottom: '0.25rem',
              color: '#1a1625',
            }}>
              Aaptor ID
            </label>
            <input
              id="aaptorId"
              type="text"
              value={aaptorId || ''}
              disabled
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.875rem',
                border: '1px solid #A8E8BC',
                borderRadius: '0.5rem',
                backgroundColor: '#F9FAFB',
                color: '#6b6678',
                fontFamily: 'monospace',
                textTransform: 'uppercase',
              }}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="tempPassword" style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 500,
              marginBottom: '0.25rem',
              color: '#1a1625',
            }}>
              Temporary Password <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="tempPassword"
                type={showTempPassword ? 'text' : 'password'}
                value={tempPassword}
                onChange={(e) => setTempPassword(e.target.value)}
                required
                placeholder="Enter temporary password from email"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '2.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #A8E8BC',
                  borderRadius: '0.5rem',
                }}
              />
              <button
                type="button"
                onClick={() => setShowTempPassword(!showTempPassword)}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#6b6678',
                }}
              >
                {showTempPassword ? (
                  <EyeOff style={{ width: '18px', height: '18px' }} />
                ) : (
                  <Eye style={{ width: '18px', height: '18px' }} />
                )}
              </button>
            </div>
            <p style={{
              margin: '0.25rem 0 0 0',
              fontSize: '0.75rem',
              color: '#6b6678',
            }}>
              Check your welcome email for the temporary password
            </p>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="newPassword" style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 500,
              marginBottom: '0.25rem',
              color: '#1a1625',
            }}>
              New Password <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Enter new password"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '2.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #A8E8BC',
                  borderRadius: '0.5rem',
                }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#6b6678',
                }}
              >
                {showNewPassword ? (
                  <EyeOff style={{ width: '18px', height: '18px' }} />
                ) : (
                  <Eye style={{ width: '18px', height: '18px' }} />
                )}
              </button>
            </div>
            <p 
              suppressHydrationWarning
              style={{
                margin: '0.25rem 0 0 0',
                fontSize: '0.75rem',
                color: '#6b6678',
              }}
            >
              Must be at least 8 characters with uppercase, lowercase, number, and special character
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="confirmPassword" style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 500,
              marginBottom: '0.25rem',
              color: '#1a1625',
            }}>
              Confirm New Password <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm new password"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingRight: '2.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #A8E8BC',
                  borderRadius: '0.5rem',
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: 'absolute',
                  right: '0.5rem',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  color: '#6b6678',
                }}
              >
                {showConfirmPassword ? (
                  <EyeOff style={{ width: '18px', height: '18px' }} />
                ) : (
                  <Eye style={{ width: '18px', height: '18px' }} />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !aaptorId}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              backgroundColor: loading || !aaptorId ? '#9CA3AF' : '#2D7A52',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: loading || !aaptorId ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
              marginBottom: '1rem',
            }}
            onMouseEnter={(e) => {
              if (!loading && aaptorId) {
                e.currentTarget.style.backgroundColor = '#1e5a3b';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && aaptorId) {
                e.currentTarget.style.backgroundColor = '#2D7A52';
              }
            }}
          >
            {loading ? 'Setting Password...' : 'Set Password'}
          </button>

          <div style={{
            textAlign: 'center',
            paddingTop: '1rem',
            borderTop: '1px solid #E8E0D0',
          }}>
            <p style={{
              margin: 0,
              fontSize: '0.8125rem',
              color: '#6b6678',
            }}>
              Already set your password?{' '}
              <Link href={`/auth/employee-login${aaptorId ? `?aaptorId=${encodeURIComponent(aaptorId as string)}` : ''}`} style={{
                color: '#2D7A52',
                fontWeight: 600,
                textDecoration: 'none',
              }}>
                Sign In
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

