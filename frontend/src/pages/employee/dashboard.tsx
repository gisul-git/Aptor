/**
 * Employee Dashboard Page
 * 
 * Dashboard for employees to view their information and assessments
 * Accessed after employee login
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/dsa/ui/card';
import { Button } from '../../components/dsa/ui/button';
import { User, Mail, Calendar, LogOut, FileText, Settings } from 'lucide-react';

interface EmployeeTestSummary {
  assessmentId: string;
  title: string;
  type: string;
  status?: string | null;
  inviteSentAt?: string | null;
}

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const [employeeData, setEmployeeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tests, setTests] = useState<EmployeeTestSummary[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [testsError, setTestsError] = useState<string | null>(null);

  useEffect(() => {
    // IMPORTANT: Employee dashboard should ONLY use employee tokens, not NextAuth tokens
    // Get employee data from storage - ONLY from employee_token key
    // Do NOT use NextAuth tokens or any other tokens
    const token = localStorage.getItem('employee_token') || sessionStorage.getItem('employee_token');
    const storedData = localStorage.getItem('employee_data') || sessionStorage.getItem('employee_data');
    
    console.log('🔵 [Employee Dashboard] Checking for employee token:', {
      hasToken: !!token,
      hasStoredData: !!storedData,
      tokenLength: token?.length || 0,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'none'
    });
    
    if (!token || !storedData) {
      // Not logged in as employee, redirect to employee login
      console.warn('⚠️ [Employee Dashboard] No employee token found, redirecting to employee login');
      router.push('/auth/employee-login');
      return;
    }
    
    

    try {
      const data = JSON.parse(storedData);
      
      // Validate that we have employee data (not org_admin data)
      if (!data.aaptorId || !data.organizationId) {
        console.error('Invalid employee data - missing aaptorId or organizationId:', data);
        // Clear invalid data and redirect
        localStorage.removeItem('employee_token');
        localStorage.removeItem('employee_data');
        sessionStorage.removeItem('employee_token');
        sessionStorage.removeItem('employee_data');
        router.push('/auth/employee-login');
        return;
      }
      
      setEmployeeData(data);

      // After we have employee data, load tests invited to this email from all competencies
      const fetchTests = async () => {
        try {
          setLoadingTests(true);
          setTestsError(null);
          
          // Re-fetch token to ensure we have the latest
          const token = localStorage.getItem('employee_token') || 
                        sessionStorage.getItem('employee_token');
          
          if (!token) {
            setTestsError('Authentication required');
            return;
          }
          
          // Validate token is not empty and looks like a JWT
          if (token.length < 50) {
            console.error('Token appears invalid (too short):', token.substring(0, 20) + '...');
            setTestsError('Invalid employee token. Please log in again.');
            // Clear invalid token
            localStorage.removeItem('employee_token');
            sessionStorage.removeItem('employee_token');
            router.push('/auth/employee-login');
            return;
          }
          
          // Decode token to verify it's an employee token (client-side check)
          try {
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              console.log('🔵 [Employee Dashboard] Token payload:', {
                type: payload.type,
                employeeId: payload.employeeId,
                aaptorId: payload.aaptorId,
                organizationId: payload.organizationId,
                allKeys: Object.keys(payload)
              });
              
              // Verify it's an employee token
              if (payload.type !== 'employee') {
                console.error('❌ [Employee Dashboard] Token is not an employee token! Type:', payload.type);
                setTestsError('Invalid employee token type. Please log in again.');
                localStorage.removeItem('employee_token');
                sessionStorage.removeItem('employee_token');
                router.push('/auth/employee-login');
                return;
              }
            }
          } catch (decodeError) {
            console.warn('⚠️ [Employee Dashboard] Could not decode token (non-fatal):', decodeError);
          }
          
          console.log('🔵 [Employee Dashboard] Using employee token (length:', token.length, ', preview:', token.substring(0, 30) + '...', ')');
          
          const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:80';
          
          // IMPORTANT: Use a fresh axios instance to avoid any global interceptors
          // Create a new axios instance for this request to ensure no interceptors interfere
          const employeeAxios = axios.create();
          
          // Call new aggregation endpoint that fetches from all services
          const response = await employeeAxios.get(`${baseURL}/api/v1/employee/all-tests`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('✅ [Employee Dashboard] Request sent with token:', token.substring(0, 30) + '...');
          
          const testsData = response.data?.data?.tests || [];
          setTests(testsData);
          
          // Log service status for debugging
          if (response.data?.data?.meta?.serviceStatus) {
            console.log('Service status:', response.data.data.meta.serviceStatus);
          }
        } catch (err: any) {
          console.error('Error fetching employee tests:', err);
          
          // If token error, clear and redirect
          if (err?.response?.status === 403 && err?.response?.data?.detail?.includes('token type')) {
            console.error('Invalid token type - clearing employee session');
            localStorage.removeItem('employee_token');
            localStorage.removeItem('employee_data');
            sessionStorage.removeItem('employee_token');
            sessionStorage.removeItem('employee_data');
            setTestsError('Invalid employee token. Please log in again.');
            setTimeout(() => {
              router.push('/auth/employee-login');
            }, 2000);
            return;
          }
          
          setTestsError(
            err?.response?.data?.detail ||
            err?.response?.data?.error ||
            err?.response?.data?.message ||
            err?.message ||
            'Failed to load assigned tests'
          );
        } finally {
          setLoadingTests(false);
        }
      };

      fetchTests();
    } catch (error) {
      console.error('Error parsing employee data:', error);
      // Clear invalid data
      localStorage.removeItem('employee_token');
      localStorage.removeItem('employee_data');
      sessionStorage.removeItem('employee_token');
      sessionStorage.removeItem('employee_data');
      router.push('/auth/employee-login');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('employee_token');
    localStorage.removeItem('employee_data');
    sessionStorage.removeItem('employee_token');
    sessionStorage.removeItem('employee_data');
    router.push('/auth/employee-login');
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f1dcba',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!employeeData) {
    return null;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#ffffff' }}>
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '2rem 1rem',
      }}>
        {/* Header */}
        <div style={{
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <h1 style={{
              margin: 0,
              marginBottom: '0.5rem',
              fontSize: '2rem',
              fontWeight: 700,
              color: '#1a1625',
            }}>Employee Dashboard</h1>
            <p style={{
              margin: 0,
              color: '#6b6678',
              fontSize: '0.875rem',
            }}>Welcome back, {employeeData.name}</p>
          </div>
          <Button variant="outline" onClick={handleLogout} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}>
            <LogOut style={{ width: '16px', height: '16px' }} />
            Logout
          </Button>
        </div>

        {/* Employee Information Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          marginBottom: '1.5rem',
        }}>
          <Card>
            <CardHeader>
              <CardTitle style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: 0,
              }}>
                <User style={{ width: '20px', height: '20px' }} />
                Aaptor ID
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{
                margin: 0,
                fontSize: '1.5rem',
                fontFamily: 'monospace',
                fontWeight: 700,
              }}>{employeeData.aaptorId}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: 0,
              }}>
                <Mail style={{ width: '20px', height: '20px' }} />
                Email
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 500,
              }}>{employeeData.email}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: 0,
              }}>
                <FileText style={{ width: '20px', height: '20px' }} />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{
                margin: 0,
                fontSize: '1rem',
                fontWeight: 500,
                textTransform: 'capitalize',
              }}>{employeeData.status}</p>
            </CardContent>
          </Card>
        </div>
        {/* Invited Tests */}
        <Card>
          <CardHeader>
            <CardTitle style={{ margin: 0 }}>Your Invited Tests</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingTests ? (
              <p style={{
                fontSize: '0.875rem',
                color: '#6b6678',
                margin: 0,
              }}>Loading your tests...</p>
            ) : testsError ? (
              <p style={{
                fontSize: '0.875rem',
                color: '#DC2626',
                margin: 0,
              }}>{testsError}</p>
            ) : tests.length === 0 ? (
              <p style={{
                fontSize: '0.875rem',
                color: '#6b6678',
                margin: 0,
              }}>
                You don't have any tests assigned yet. Please check back later or contact your administrator.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {tests.map((test) => (
                  <div
                    key={test.assessmentId}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: '0.5rem',
                      border: '1px solid #E8E0D0',
                      padding: '0.75rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div>
                      <p style={{
                        margin: 0,
                        marginBottom: '0.25rem',
                        fontWeight: 500,
                      }}>{test.title}</p>
                      <p style={{
                        margin: 0,
                        fontSize: '0.75rem',
                        color: '#6b6678',
                      }}>
                        Type: {test.type.toUpperCase()} • Status: {test.status || 'unknown'}
                      </p>
                      {test.inviteSentAt && (
                        <p style={{
                          margin: '0.25rem 0 0 0',
                          fontSize: '0.75rem',
                          color: '#6b6678',
                        }}>
                          Invited: {new Date(test.inviteSentAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}>
                      <FileText style={{ width: '16px', height: '16px', color: '#6b6678' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        {employeeData.lastLogin && (
          <Card style={{ marginTop: '1.5rem' }}>
            <CardHeader>
              <CardTitle style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                margin: 0,
              }}>
                <Calendar style={{ width: '20px', height: '20px' }} />
                Last Login
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p style={{
                margin: 0,
                color: '#6b6678',
                fontSize: '0.875rem',
              }}>
                {new Date(employeeData.lastLogin).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

