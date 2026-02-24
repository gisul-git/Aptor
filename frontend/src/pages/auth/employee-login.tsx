/**
 * Employee Login Page
 *
 * Allows employees to login with Aaptor ID/Email and password.
 * Links use NEXTAUTH_URL from .env (frontend domain) when set.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import Link from 'next/link';
import fastApiClient from '../../lib/fastapi';
import { getFrontendBaseUrl } from '../../lib/app-url';
import { LogIn, AlertCircle, Eye, EyeOff, User } from 'lucide-react';

export default function EmployeeLoginPage() {
  const router = useRouter();
  const [aaptorId, setAaptorId] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Pre-fill Aaptor ID from query if available (client-side only)
  useEffect(() => {
    setMounted(true);
    if (router.isReady) {
      const { aaptorId: queryAaptorId } = router.query;
      if (queryAaptorId && typeof queryAaptorId === 'string') {
        setAaptorId(queryAaptorId.toUpperCase());
      }
    }
  }, [router.isReady, router.query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!aaptorId.trim()) {
      setError('Aaptor ID is required');
      return;
    }

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fastApiClient.post('/api/v1/employees/login', {
        aaptorId: aaptorId.trim().toUpperCase(),
        email: email.trim().toLowerCase(),
        password: password.trim(),
      });

      // Handle both wrapped (response.data.data) and unwrapped (response.data) response structures
      const responseData = response.data?.data || response.data;
      const token = responseData?.token;
      const employee = responseData?.employee;

      if (token && employee) {
        // Store employee data and token
        if (typeof window !== 'undefined') {
          localStorage.setItem('employee_token', token);
          localStorage.setItem('employee_data', JSON.stringify(employee));
          // Also store in sessionStorage as backup
          sessionStorage.setItem('employee_token', token);
          sessionStorage.setItem('employee_data', JSON.stringify(employee));
        }

        // Redirect to employee dashboard
        router.push('/employee/dashboard');
      } else {
        console.error('Invalid response structure:', response.data);
        setError('Invalid response from server. Please try again.');
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || 
                          err?.response?.data?.message || 
                          err?.message || 
                          'Login failed. Please check your credentials and try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

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
            <LogIn style={{ width: '24px', height: '24px', color: '#2D7A52' }} />
          </div>
          <h1 style={{
            margin: 0,
            marginBottom: '0.5rem',
            fontSize: '1.5rem',
            fontWeight: 600,
            color: '#1a1625',
          }}>
            Employee Login
          </h1>
          <p style={{
            margin: 0,
            color: '#6b6678',
            fontSize: '0.875rem',
          }}>
            Sign in to access your employee portal
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
              Aaptor ID <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <User style={{
                position: 'absolute',
                left: '0.75rem',
                top: '50%',
                transform: 'translateY(-50%)',
                width: '18px',
                height: '18px',
                color: '#6b6678',
              }} />
              <input
                id="aaptorId"
                type="text"
                value={aaptorId}
                onChange={(e) => setAaptorId(e.target.value.toUpperCase())}
                required
                placeholder="AAP0010001"
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  paddingLeft: '2.5rem',
                  fontSize: '0.875rem',
                  border: '1px solid #A8E8BC',
                  borderRadius: '0.5rem',
                  fontFamily: 'monospace',
                  textTransform: 'uppercase',
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label htmlFor="email" style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 500,
              marginBottom: '0.25rem',
              color: '#1a1625',
            }}>
              Email <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              required
              placeholder="employee@example.com"
              style={{
                width: '100%',
                padding: '0.75rem',
                fontSize: '0.875rem',
                border: '1px solid #A8E8BC',
                borderRadius: '0.5rem',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label htmlFor="password" style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 500,
              marginBottom: '0.25rem',
              color: '#1a1625',
            }}>
              Password <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
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
                onClick={() => setShowPassword(!showPassword)}
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
                {showPassword ? (
                  <EyeOff style={{ width: '18px', height: '18px' }} />
                ) : (
                  <Eye style={{ width: '18px', height: '18px' }} />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              fontSize: '0.875rem',
              fontWeight: 600,
              backgroundColor: loading ? '#9CA3AF' : '#2D7A52',
              color: '#ffffff',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
              marginBottom: '1rem',
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#1e5a3b';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = '#2D7A52';
              }
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
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
              Need to set your password?{' '}
              <Link href={`${getFrontendBaseUrl()}/auth/set-password${aaptorId ? `?aaptorId=${encodeURIComponent(aaptorId)}` : ''}`} style={{
                color: '#2D7A52',
                fontWeight: 600,
                textDecoration: 'none',
              }}>
                Set Password
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

