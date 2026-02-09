import React, { useState, useEffect } from 'react';

export default function SimpleTestPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('http://localhost:3006/api/v1/design/questions/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'ui_designer', difficulty: 'intermediate', task_type: 'dashboard', topic: 'food delivery', created_by: 'test' })
        });
        const q = await res.json();
        
        const res2 = await fetch('http://localhost:3006/api/v1/design/workspace/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: 'test', assessment_id: 'test', question_id: q._id || q.id })
        });
        const w = await res2.json();
        
        setData({ question: q, workspace: w });
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>;
  if (!data) return <div style={{ padding: '20px' }}>Error loading</div>;

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <div style={{ width: '300px', padding: '20px', background: '#f5f5f5', overflow: 'auto' }}>
        <h2>{data.question.title}</h2>
        <p>{data.question.description}</p>
      </div>
      <div style={{ flex: 1 }}>
        <iframe 
          src={data.workspace.workspace_url} 
          style={{ width: '100%', height: '100%', border: 'none' }}
          title="Penpot"
        />
      </div>
    </div>
  );
}
