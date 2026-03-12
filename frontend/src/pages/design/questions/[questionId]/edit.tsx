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
}

export default function EditQuestionPage() {
  const router = useRouter();
  const { questionId } = router.query;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Question>({
    _id: '',
    title: '',
    description: '',
    role: 'ui_designer',
    difficulty: 'beginner',
    task_type: 'landing_page',
    time_limit_minutes: 60,
    constraints: [''],
    deliverables: [''],
    evaluation_criteria: ['']
  });

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
        setFormData(data);
      }
    } catch (error) {
      console.error('Failed to fetch question:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/questions/${questionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        alert('Question updated successfully!');
        router.push('/design/questions');
      } else {
        alert('Failed to update question');
      }
    } catch (error) {
      alert('Failed to update question');
    } finally {
      setSaving(false);
    }
  };

  const addItem = (field: 'constraints' | 'deliverables' | 'evaluation_criteria') => {
    setFormData({ ...formData, [field]: [...formData[field], ''] });
  };

  const removeItem = (field: 'constraints' | 'deliverables' | 'evaluation_criteria', index: number) => {
    setFormData({ ...formData, [field]: formData[field].filter((_, i) => i !== index) });
  };

  const updateItem = (field: 'constraints' | 'deliverables' | 'evaluation_criteria', index: number, value: string) => {
    const updated = [...formData[field]];
    updated[index] = value;
    setFormData({ ...formData, [field]: updated });
  };

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', marginBottom: '1.5rem', color: '#9333EA' }}>
        Edit Design Question
      </h1>

      <form onSubmit={handleSubmit} style={{ background: 'white', padding: '2rem', borderRadius: '0.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#9333EA' }}>Title *</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #E8B4FA', borderRadius: '0.375rem' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#9333EA' }}>Description *</label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            rows={4}
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #E8B4FA', borderRadius: '0.375rem' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#9333EA' }}>Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #E8B4FA', borderRadius: '0.375rem' }}
            >
              <option value="ui_designer">UI Designer</option>
              <option value="ux_designer">UX Designer</option>
              <option value="product_designer">Product Designer</option>
              <option value="visual_designer">Visual Designer</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#9333EA' }}>Task Type</label>
            <select
              value={formData.task_type}
              onChange={(e) => setFormData({ ...formData, task_type: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #E8B4FA', borderRadius: '0.375rem' }}
            >
              <option value="landing_page">Landing Page</option>
              <option value="mobile_app">Mobile App</option>
              <option value="dashboard">Dashboard</option>
              <option value="component">Component</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#9333EA' }}>Difficulty</label>
            <select
              value={formData.difficulty}
              onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
              style={{ width: '100%', padding: '0.5rem', border: '1px solid #E8B4FA', borderRadius: '0.375rem' }}
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#9333EA' }}>Time Limit (minutes)</label>
          <input
            type="number"
            value={formData.time_limit_minutes}
            onChange={(e) => setFormData({ ...formData, time_limit_minutes: parseInt(e.target.value) })}
            min="1"
            style={{ width: '100%', padding: '0.5rem', border: '1px solid #E8B4FA', borderRadius: '0.375rem' }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#9333EA' }}>Constraints</label>
          {formData.constraints.map((constraint, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={constraint}
                onChange={(e) => updateItem('constraints', index, e.target.value)}
                style={{ flex: 1, padding: '0.5rem', border: '1px solid #E8B4FA', borderRadius: '0.375rem' }}
              />
              <button type="button" onClick={() => removeItem('constraints', index)} style={{ padding: '0.5rem 1rem', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addItem('constraints')} style={{ padding: '0.5rem 1rem', background: '#F3E8FF', color: '#9333EA', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
            + Add Constraint
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#9333EA' }}>Deliverables</label>
          {formData.deliverables.map((deliverable, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={deliverable}
                onChange={(e) => updateItem('deliverables', index, e.target.value)}
                style={{ flex: 1, padding: '0.5rem', border: '1px solid #E8B4FA', borderRadius: '0.375rem' }}
              />
              <button type="button" onClick={() => removeItem('deliverables', index)} style={{ padding: '0.5rem 1rem', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addItem('deliverables')} style={{ padding: '0.5rem 1rem', background: '#F3E8FF', color: '#9333EA', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
            + Add Deliverable
          </button>
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', color: '#9333EA' }}>Evaluation Criteria</label>
          {formData.evaluation_criteria.map((criteria, index) => (
            <div key={index} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                value={criteria}
                onChange={(e) => updateItem('evaluation_criteria', index, e.target.value)}
                style={{ flex: 1, padding: '0.5rem', border: '1px solid #E8B4FA', borderRadius: '0.375rem' }}
              />
              <button type="button" onClick={() => removeItem('evaluation_criteria', index)} style={{ padding: '0.5rem 1rem', background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" onClick={() => addItem('evaluation_criteria')} style={{ padding: '0.5rem 1rem', background: '#F3E8FF', color: '#9333EA', border: 'none', borderRadius: '0.375rem', cursor: 'pointer' }}>
            + Add Criteria
          </button>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button type="button" onClick={() => router.back()} style={{ flex: 1, padding: '0.75rem', background: '#E5E7EB', color: '#374151', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
            Cancel
          </button>
          <button type="submit" disabled={saving} style={{ flex: 1, padding: '0.75rem', background: '#9333EA', color: 'white', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '500' }}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
