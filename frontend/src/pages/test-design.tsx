import React, { useState, useEffect } from 'react';

export default function TestDesignPage() {
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
      <div style={{ padding: '40px', fontFamily: 'Arial', textAlign: 'center' }}>
        <h1 style={{ color: '#dc2626' }}>❌ Error</h1>
        <p style={{ fontSize: '18px', color: '#666' }}>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          style={{
            marginTop: '20px',
            padding: '12px 24px',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontFamily: 'Arial',
        flexDirection: 'column'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '5px solid #e5e7eb',
          borderTop: '5px solid #3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
        <p style={{ marginTop: '20px', fontSize: '18px', color: '#666' }}>{status}</p>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', margin: 0, fontFamily: 'Arial' }}>
      {/* Header */}
      <div style={{ 
        padding: '20px 30px', 
        borderBottom: '2px solid #e5e7eb', 
        background: 'white',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px' }}>{question?.title || 'Design Challenge'}</h2>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#6b7280' }}>
            {question?.role} • {question?.difficulty}
          </p>
          <p style={{ 
            margin: '8px 0 0 0', 
            fontSize: '12px', 
            color: '#2563eb',
            fontFamily: 'monospace',
            fontWeight: 'bold'
          }}>
            🔒 File ID: {workspace?.file_id?.slice(-12) || 'Loading...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Time Remaining</p>
            <p style={{ margin: '5px 0 0 0', fontSize: '28px', fontWeight: 'bold' }}>60:00</p>
          </div>
          <button 
            onClick={() => alert('Submitted!')}
            style={{
              padding: '12px 24px',
              background: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Submit
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Sidebar */}
        <div style={{ 
          width: '320px', 
          padding: '20px', 
          borderRight: '2px solid #e5e7eb', 
          overflowY: 'auto',
          background: '#f9fafb'
        }}>
          <h3 style={{ marginTop: 0, fontSize: '18px' }}>📋 Challenge</h3>
          <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#374151' }}>
            {question?.description || 'Loading...'}
          </p>
          
          <h3 style={{ marginTop: '24px', fontSize: '18px' }}>⚠️ Constraints</h3>
          <ul style={{ fontSize: '13px', lineHeight: '1.8', color: '#374151', paddingLeft: '20px' }}>
            {question?.constraints?.map((c: string, i: number) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          
          <div style={{ 
            marginTop: '30px', 
            padding: '16px', 
            background: '#dbeafe', 
            borderRadius: '8px',
            border: '2px solid #3b82f6'
          }}>
            <h4 style={{ 
              margin: '0 0 12px 0', 
              fontSize: '14px', 
              color: '#1e40af',
              fontWeight: 'bold'
            }}>
              🔒 Workspace Info
            </h4>
            <div style={{ fontSize: '12px', color: '#1e3a8a' }}>
              <p style={{ margin: '8px 0' }}>
                <strong>User:</strong> {workspace?.user_id || 'test_user'}
              </p>
              <p style={{ margin: '8px 0' }}>
                <strong>File ID:</strong>
              </p>
              <p style={{ 
                margin: '4px 0',
                fontFamily: 'monospace',
                fontSize: '11px',
                wordBreak: 'break-all',
                background: 'white',
                padding: '8px',
                borderRadius: '4px'
              }}>
                {workspace?.file_id || 'Loading...'}
              </p>
              <p style={{ margin: '12px 0 0 0', color: '#059669', fontWeight: 'bold' }}>
                ✓ Isolated workspace
              </p>
            </div>
          </div>
        </div>
        
        {/* Penpot Workspace */}
        <div style={{ flex: 1, background: '#1f2937', position: 'relative' }}>
          {workspace?.workspace_url ? (
            <iframe
              src={workspace.workspace_url}
              style={{ 
                width: '100%', 
                height: '100%', 
                border: 'none',
                display: 'block'
              }}
              title="Penpot Workspace"
              allow="clipboard-read; clipboard-write; fullscreen"
            />
          ) : (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: '100%',
              color: 'white',
              fontSize: '18px'
            }}>
              Loading workspace...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
