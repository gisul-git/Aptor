import React, { useState, useEffect } from 'react';

export default function DesignTestSimplePage() {
  const [status, setStatus] = useState('Initializing...');
  const [question, setQuestion] = useState<any>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        setStatus('Generating question...');
        const qRes = await fetch('http://localhost:3006/api/v1/design/questions/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'ui_designer',
            difficulty: 'intermediate',
            task_type: 'dashboard',
            topic: 'food delivery',
            created_by: 'test'
          })
        });
        
        if (!qRes.ok) throw new Error('Question generation failed');
        const qData = await qRes.json();
        setQuestion(qData);
        
        setStatus('Creating workspace...');
        const wRes = await fetch('http://localhost:3006/api/v1/design/workspace/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: 'test_' + Date.now(),
            assessment_id: 'test_assessment',
            question_id: qData._id || qData.id
          })
        });
        
        if (!wRes.ok) throw new Error('Workspace creation failed');
        const wData = await wRes.json();
        setWorkspace(wData);
        setStatus('Ready!');
        
      } catch (err: any) {
        setError(err.message);
        setStatus('Error');
      }
    };
    
    init();
  }, []);

  if (error) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial' }}>
        <h1 style={{ color: 'red' }}>Error</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div style={{ padding: '20px', fontFamily: 'Arial' }}>
        <h1>Loading...</h1>
        <p>{status}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', margin: 0 }}>
      <div style={{ padding: '20px', borderBottom: '1px solid #ccc', background: 'white' }}>
        <h2>{question?.title || 'Design Challenge'}</h2>
        <p style={{ fontSize: '12px', color: '#666' }}>
          File ID: <strong style={{ color: 'blue' }}>{workspace?.file_id}</strong>
        </p>
      </div>
      
      <div style={{ display: 'flex', flex: 1 }}>
        <div style={{ width: '300px', padding: '20px', borderRight: '1px solid #ccc', overflowY: 'auto' }}>
          <h3>Challenge</h3>
          <p style={{ fontSize: '14px' }}>{question?.description}</p>
          
          <h3>Workspace Info</h3>
          <div style={{ background: '#e3f2fd', padding: '10px', borderRadius: '5px', fontSize: '12px' }}>
            <p><strong>User:</strong> test_{workspace?.user_id}</p>
            <p><strong>File ID:</strong></p>
            <p style={{ wordBreak: 'break-all', fontFamily: 'monospace' }}>{workspace?.file_id}</p>
          </div>
        </div>
        
        <div style={{ flex: 1, background: '#1a1a1a' }}>
          {workspace?.workspace_url ? (
            <iframe
              src={workspace.workspace_url}
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Penpot Workspace"
              allow="clipboard-read; clipboard-write; fullscreen"
            />
          ) : (
            <div style={{ color: 'white', padding: '20px' }}>Loading workspace...</div>
          )}
        </div>
      </div>
    </div>
  );
}
