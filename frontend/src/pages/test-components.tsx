/**
 * Test Page for New Components
 * 
 * This page verifies that the new service layer architecture components
 * (MCQQuestion and SubjectiveQuestion) render correctly.
 * 
 * Access at: /test-components
 */

import React, { useState } from 'react';
import Head from 'next/head';
import { MCQQuestion } from '@/components/features/assessment/take/questions/MCQQuestion';
import { SubjectiveQuestion } from '@/components/features/assessment/take/questions/SubjectiveQuestion';

export default function TestComponentsPage() {
  // State for MCQ question
  const [mcqAnswer, setMcqAnswer] = useState('');

  // State for Subjective question
  const [subjectiveAnswer, setSubjectiveAnswer] = useState('');

  // Sample MCQ question data
  const mcqQuestion = {
    id: 'test-mcq-1',
    title: 'Sample Multiple Choice Question',
    questionText: 'What is the capital of France?',
    options: ['London', 'Berlin', 'Paris', 'Madrid'],
    score: 5,
    difficulty: 'Easy',
  };

  // Sample Subjective question data
  const subjectiveQuestion = {
    id: 'test-subjective-1',
    title: 'Sample Subjective Question',
    questionText: 'Explain the concept of React Hooks in your own words. What are the benefits of using hooks?',
    score: 10,
    difficulty: 'Medium',
  };

  return (
    <>
      <Head>
        <title>Component Test Page - New Architecture</title>
        <meta name="description" content="Test page for new service layer architecture components" />
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
              Component Test Page
            </h1>
            <p style={{ color: '#6b7280', fontSize: '1rem' }}>
              Testing new service layer architecture components (MCQQuestion and SubjectiveQuestion)
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
              ✅ Dependencies Verified
            </h2>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#1e40af', fontSize: '0.875rem' }}>
              <li>zustand@4.5.7 ✓</li>
              <li>@tanstack/react-query@5.90.19 ✓</li>
              <li>axios@1.13.2 ✓</li>
            </ul>
          </div>

          {/* MCQ Question Section */}
          <div style={{ 
            marginBottom: '3rem',
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
              1. MCQ Question Component
            </h2>
            
            <MCQQuestion
              question={mcqQuestion}
              answer={mcqAnswer}
              onAnswerChange={setMcqAnswer}
              disabled={false}
            />

            {/* Display current answer */}
            {mcqAnswer && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '0.5rem',
              }}>
                <p style={{ margin: 0, color: '#166534', fontSize: '0.875rem' }}>
                  <strong>Selected Answer:</strong> {mcqAnswer}
                </p>
              </div>
            )}
          </div>

          {/* Subjective Question Section */}
          <div style={{ 
            marginBottom: '3rem',
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
              2. Subjective Question Component
            </h2>
            
            <SubjectiveQuestion
              question={subjectiveQuestion}
              answer={subjectiveAnswer}
              onAnswerChange={setSubjectiveAnswer}
              disabled={false}
              isPseudocode={false}
            />

            {/* Display answer stats */}
            {subjectiveAnswer && (
              <div style={{
                marginTop: '1rem',
                padding: '1rem',
                backgroundColor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '0.5rem',
              }}>
                <p style={{ margin: 0, color: '#166534', fontSize: '0.875rem' }}>
                  <strong>Answer Length:</strong> {subjectiveAnswer.length} characters ({subjectiveAnswer.split(/\s+/).filter(Boolean).length} words)
                </p>
              </div>
            )}
          </div>

          {/* Code Architecture Info */}
          <div style={{
            padding: '1.5rem',
            backgroundColor: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: '0.75rem',
            marginBottom: '2rem',
          }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#92400e', marginBottom: '0.75rem' }}>
              📁 Architecture Overview
            </h3>
            <div style={{ color: '#78350f', fontSize: '0.875rem', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <strong>Service Layer:</strong> All API calls are centralized in <code>src/services/</code>
              </p>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <strong>State Management:</strong> Zustand stores in <code>src/store/</code>
              </p>
              <p style={{ margin: '0 0 0.5rem 0' }}>
                <strong>React Query:</strong> API hooks in <code>src/hooks/api/</code>
              </p>
              <p style={{ margin: 0 }}>
                <strong>Components:</strong> Feature-based components in <code>src/components/features/</code>
              </p>
            </div>
          </div>

          {/* Quick Links */}
          <div style={{
            padding: '1rem',
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '0.5rem',
          }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.5rem' }}>
              Quick Links:
            </h3>
            <ul style={{ margin: 0, paddingLeft: '1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              <li><code>src/services/</code> - API service layer</li>
              <li><code>src/store/</code> - Zustand state stores</li>
              <li><code>src/hooks/api/</code> - React Query hooks</li>
              <li><code>src/components/features/assessment/take/</code> - Refactored components</li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}



