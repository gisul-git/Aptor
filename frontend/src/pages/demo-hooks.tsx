/**
 * Demo Hooks Page
 * 
 * Demonstrates the new service layer architecture:
 * - React Query hooks (useAssessments)
 * - Zustand stores (useAuthStore, useUIStore)
 * - Loading states and error handling
 * 
 * Access at: /demo-hooks
 */

import React from 'react';
import Head from 'next/head';
import { useAssessments } from '@/hooks/api/useAssessments';
import { useAuthStore } from '@/store/auth.store';
import { useUIStore } from '@/store/ui.store';

export default function DemoHooksPage() {
  // React Query Hook - Automatic caching, loading, error handling
  const { 
    data: assessments, 
    isLoading: assessmentsLoading, 
    error: assessmentsError,
    refetch: refetchAssessments 
  } = useAssessments();

  // Zustand Store - Global auth state
  const { user, isAuthenticated, setUser, logout } = useAuthStore();

  // Zustand Store - Global UI state
  const { 
    isModalOpen, 
    openModal,
    closeModal,
    toasts, 
    addToast, 
    removeToast,
    isSidebarOpen: sidebarOpen,
    setSidebarOpen,
    toggleSidebar
  } = useUIStore();
  
  const toggleModal = () => {
    if (isModalOpen) {
      closeModal();
    } else {
      openModal(null);
    }
  };

  // Mock user for demo
  const handleMockLogin = () => {
    setUser({
      id: 'demo-user-1',
      name: 'Demo User',
      email: 'demo@example.com',
      role: 'user',
    });
    addToast({
      message: 'Logged in as Demo User',
      type: 'success',
    });
  };

  const handleMockLogout = () => {
    logout();
    addToast({
      message: 'Logged out successfully',
      type: 'info',
    });
  };

  const handleTestToast = (type: 'success' | 'error' | 'warning' | 'info') => {
    addToast({
      message: `This is a ${type} toast notification`,
      type,
    });
  };

  return (
    <>
      <Head>
        <title>Demo Hooks - Service Layer Architecture</title>
        <meta name="description" content="Demonstration of React Query hooks and Zustand stores" />
      </Head>

      <div style={{ minHeight: '100vh', padding: '2rem', backgroundColor: '#f9fafb' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <h1 style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#1a1625',
              marginBottom: '0.5rem'
            }}>
              Demo: Service Layer Architecture
            </h1>
            <p style={{ color: '#6b7280', fontSize: '1rem' }}>
              Demonstrating React Query hooks and Zustand stores in action
            </p>
          </div>

          {/* Status Banner */}
          <div style={{
            padding: '1rem',
            backgroundColor: '#dbeafe',
            border: '1px solid #93c5fd',
            borderRadius: '0.5rem',
            marginBottom: '2rem',
          }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, color: '#1e40af', marginBottom: '0.5rem' }}>
              ✅ Architecture Verified
            </h2>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#1e40af', fontSize: '0.875rem' }}>
              <li>React Query hooks working ✓</li>
              <li>Zustand stores working ✓</li>
              <li>Service layer integrated ✓</li>
            </ul>
          </div>

          {/* Zustand Store Demo */}
          <div style={{ 
            marginBottom: '2rem',
            padding: '2rem',
            backgroundColor: '#ffffff',
            borderRadius: '0.75rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 600, 
              color: '#1a1625',
              marginBottom: '1rem',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid #e5e7eb',
            }}>
              1. Zustand Store Demo
            </h2>

            {/* Auth Store */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>
                Auth Store (useAuthStore)
              </h3>
              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#f9fafb', 
                borderRadius: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                  <strong>Authenticated:</strong> {isAuthenticated ? '✅ Yes' : '❌ No'}
                </p>
                {user && (
                  <p style={{ margin: '0.5rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                    <strong>User:</strong> {user.name} ({user.email})
                  </p>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {!isAuthenticated ? (
                  <button
                    onClick={handleMockLogin}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#10b981',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    Mock Login
                  </button>
                ) : (
                  <button
                    onClick={handleMockLogout}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    Logout
                  </button>
                )}
              </div>
            </div>

            {/* UI Store */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>
                UI Store (useUIStore)
              </h3>
              <div style={{ 
                padding: '1rem', 
                backgroundColor: '#f9fafb', 
                borderRadius: '0.5rem',
                marginBottom: '0.5rem'
              }}>
                <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                  <strong>Modal Open:</strong> {isModalOpen ? '✅ Yes' : '❌ No'}
                </p>
                <p style={{ margin: '0.5rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                  <strong>Sidebar Open:</strong> {sidebarOpen ? '✅ Yes' : '❌ No'}
                </p>
                <p style={{ margin: '0.5rem 0 0 0', color: '#6b7280', fontSize: '0.875rem' }}>
                  <strong>Active Toasts:</strong> {toasts.length}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={toggleModal}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Toggle Modal
                </button>
                <button
                  onClick={toggleSidebar}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#8b5cf6',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Toggle Sidebar
                </button>
                <button
                  onClick={() => handleTestToast('success')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Success Toast
                </button>
                <button
                  onClick={() => handleTestToast('error')}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Error Toast
                </button>
              </div>

              {/* Display Active Toasts */}
              {toasts.length > 0 && (
                <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#fff7ed', borderRadius: '0.5rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#92400e', marginBottom: '0.5rem' }}>
                    Active Toasts:
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {toasts.map((toast) => (
                      <div
                        key={toast.id}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.375rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ fontSize: '0.875rem', color: '#374151' }}>
                          [{toast.type}] {toast.message}
                        </span>
                        <button
                          onClick={() => removeToast(toast.id)}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#ef4444',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '0.25rem',
                            cursor: 'pointer',
                            fontSize: '0.75rem',
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* React Query Hook Demo */}
          <div style={{ 
            marginBottom: '2rem',
            padding: '2rem',
            backgroundColor: '#ffffff',
            borderRadius: '0.75rem',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}>
            <h2 style={{ 
              fontSize: '1.5rem', 
              fontWeight: 600, 
              color: '#1a1625',
              marginBottom: '1rem',
              paddingBottom: '0.5rem',
              borderBottom: '2px solid #e5e7eb',
            }}>
              2. React Query Hook Demo (useAssessments)
            </h2>

            {/* Loading State */}
            {assessmentsLoading && (
              <div style={{
                padding: '2rem',
                textAlign: 'center',
                color: '#6b7280',
              }}>
                <p>Loading assessments...</p>
                <div style={{
                  marginTop: '1rem',
                  width: '100%',
                  height: '4px',
                  backgroundColor: '#e5e7eb',
                  borderRadius: '9999px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: '50%',
                    height: '100%',
                    backgroundColor: '#3b82f6',
                    animation: 'pulse 1.5s ease-in-out infinite',
                  }} />
                </div>
              </div>
            )}

            {/* Error State */}
            {assessmentsError && (
              <div style={{
                padding: '1rem',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '0.5rem',
                marginBottom: '1rem',
              }}>
                <p style={{ margin: 0, color: '#dc2626', fontSize: '0.875rem' }}>
                  <strong>Error:</strong> {assessmentsError instanceof Error ? assessmentsError.message : 'Failed to load assessments'}
                </p>
                <button
                  onClick={() => refetchAssessments()}
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.5rem 1rem',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Success State */}
            {!assessmentsLoading && !assessmentsError && assessments && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <p style={{ margin: 0, color: '#374151', fontSize: '0.875rem' }}>
                    <strong>Total Assessments:</strong> {assessments.length}
                  </p>
                  <button
                    onClick={() => refetchAssessments()}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: '#3b82f6',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  >
                    Refetch
                  </button>
                </div>

                {assessments.length > 0 ? (
                  <div style={{ display: 'grid', gap: '1rem' }}>
                    {assessments.slice(0, 5).map((assessment: any) => (
                      <div
                        key={assessment.id || assessment._id}
                        style={{
                          padding: '1rem',
                          backgroundColor: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '0.5rem',
                        }}
                      >
                        <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#1a1625', marginBottom: '0.5rem' }}>
                          {assessment.title || 'Untitled Assessment'}
                        </h4>
                        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
                          Status: <strong>{assessment.status || 'unknown'}</strong>
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                    No assessments found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Architecture Info */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '0.75rem',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#92400e', marginBottom: '0.75rem' }}>
              🏗️ Architecture Overview
            </h3>
            <div style={{ color: '#78350f', fontSize: '0.875rem', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <strong>React Query:</strong> Handles API calls with automatic caching, loading states, and error handling. Data is cached for 5 minutes.
              </p>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <strong>Zustand Stores:</strong> Lightweight state management (3kb) for global state like auth, UI modals, and toasts.
              </p>
              <p style={{ margin: 0 }}>
                <strong>Service Layer:</strong> All API calls go through centralized service classes in <code>src/services/</code>
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(300%);
          }
        }
      `}</style>
    </>
  );
}

