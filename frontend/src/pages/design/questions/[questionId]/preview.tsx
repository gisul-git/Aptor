import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { requireAuth } from '../../../../lib/auth';

interface Question {
  _id: string;
  title: string;
  description: string;
  role: string;
  difficulty: string;
  task_type: string;
  time_limit_minutes: number;
  constraints: string[];
  deliverables: string[];
  evaluation_criteria: string[];
  created_at: string;
}

export default function PreviewQuestionPage() {
  const router = useRouter();
  const { questionId } = router.query;
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_DESIGN_SERVICE_URL || 'http://localhost:3006/api/v1/design';

  useEffect(() => {
    if (questionId) {
      fetchQuestion();
    }
  }, [questionId]);

  const fetchQuestion = async () => {
    try {
      const response = await fetch(`${API_URL}/questions/${questionId}`);
      if (response.ok) {
        const data = await response.json();
        setQuestion(data);
      }
    } catch (error) {
      console.error('Failed to fetch question:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading...</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Question not found</p>
        <button onClick={() => router.back()} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#9333EA', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <button onClick={() => router.back()} style={{ marginBottom: '1rem', padding: '0.5rem 1rem', background: '#E8B4FA', color: '#9333EA', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
        ← Back
      </button>

      <div style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1rem', color: '#9333EA' }}>
          {question.title}
        </h1>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <span style={{ padding: '0.25rem 0.75rem', background: '#F3E8FF', color: '#9333EA', borderRadius: '9999px', fontSize: '0.875rem' }}>
            {question.difficulty}
          </span>
          <span style={{ padding: '0.25rem 0.75rem', background: '#E8B4FA', color: '#9333EA', borderRadius: '9999px', fontSize: '0.875rem' }}>
            {question.role}
          </span>
          <span style={{ padding: '0.25rem 0.75rem', background: '#F3E8FF', color: '#9333EA', borderRadius: '9999px', fontSize: '0.875rem' }}>
            {question.task_type}
          </span>
          <span style={{ padding: '0.25rem 0.75rem', background: '#E8B4FA', color: '#9333EA', borderRadius: '9999px', fontSize: '0.875rem' }}>
            {question.time_limit_minutes} minutes
          </span>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: '#9333EA' }}>Description</h2>
          <p style={{ color: '#4B5563', lineHeight: '1.6' }}>{question.description}</p>
        </div>

        {question.constraints && question.constraints.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: '#9333EA' }}>Constraints</h2>
            <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', color: '#4B5563' }}>
              {question.constraints.map((constraint, index) => (
                <li key={index} style={{ marginBottom: '0.25rem' }}>{constraint}</li>
              ))}
            </ul>
          </div>
        )}

        {question.deliverables && question.deliverables.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: '#9333EA' }}>Deliverables</h2>
            <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', color: '#4B5563' }}>
              {question.deliverables.map((deliverable, index) => (
                <li key={index} style={{ marginBottom: '0.25rem' }}>{deliverable}</li>
              ))}
            </ul>
          </div>
        )}

        {question.evaluation_criteria && question.evaluation_criteria.length > 0 && (
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: '#9333EA' }}>Evaluation Criteria</h2>
            <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', color: '#4B5563' }}>
              {question.evaluation_criteria.map((criteria, index) => (
                <li key={index} style={{ marginBottom: '0.25rem' }}>{criteria}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
