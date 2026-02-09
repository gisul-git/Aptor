import React, { useState, useEffect } from 'react';

export default function DesignTestDirectPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<any>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(3600);

  const API_URL = 'http://localhost:3006/api/v1/design';

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const startAssessment = async () => {
      try {
        console.log('Starting assessment...');
        
        // Generate question
        const qResponse = await fetch(`${API_URL}/questions/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role: 'ui_designer',
            difficulty: 'intermediate',
            task_type: 'dashboard',
            topic: 'food delivery',
            created_by: 'test_candidate'
          })
        });
        
        if (!qResponse.ok) {
          throw new Error(`Question generation failed: ${qResponse.status}`);
        }
        
        const questionData = await qResponse.json();
        console.log('Question generated:', questionData);
        setQuestion(questionData);

        // Create workspace
        const wResponse = await fetch(`${API_URL}/workspace/create`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: 'test_123',
            assessment_id: 'test_456',
            question_id: questionData._id || questionData.id
          })
        });
        
        if (!wResponse.ok) {
          throw new Error(`Workspace creation failed: ${wResponse.status}`);
        }
        
        const workspaceData = await wResponse.json();
        console.log('Workspace created:', workspaceData);
        setWorkspace(workspaceData);
        setTimeLeft(questionData.time_limit_minutes * 60);
        
      } catch (err: any) {
        console.error('Assessment error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    startAssessment();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading design workspace...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-red-50 p-6 rounded-lg max-w-md">
          <h2 className="text-red-600 font-bold mb-2">Error</h2>
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold">{question?.title || 'Design Challenge'}</h2>
          <p className="text-sm text-gray-600">{question?.role} • {question?.difficulty}</p>
          {workspace?.file_id && (
            <p className="text-xs text-blue-600 mt-1 font-mono">
              File ID: {workspace.file_id.slice(-12)}
            </p>
          )}
        </div>
        <div className="flex gap-4 items-center">
          <div className="text-right">
            <p className="text-sm text-gray-600">Time</p>
            <p className="text-2xl font-bold">{formatTime(timeLeft)}</p>
          </div>
          <button 
            onClick={() => alert('Submitted!')} 
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700"
          >
            Submit
          </button>
        </div>
      </div>
      
      <div className="flex flex-1">
        <div className="w-80 bg-white border-r p-6 overflow-y-auto">
          <h3 className="font-bold mb-3">Challenge</h3>
          <p className="text-sm mb-4">{question?.description || 'Loading...'}</p>
          
          <h3 className="font-bold mb-2">Constraints</h3>
          <ul className="list-disc pl-5 text-sm mb-4">
            {question?.constraints?.map((c: string, i: number) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="text-xs font-bold text-blue-900 mb-2">🔒 Workspace Info</h4>
            <div className="space-y-1">
              <p className="text-xs text-blue-700">
                <strong>User:</strong> test_123
              </p>
              <p className="text-xs text-blue-700 font-mono break-all">
                <strong>File ID:</strong><br/>
                {workspace?.file_id || 'Loading...'}
              </p>
              <p className="text-xs text-green-600 mt-2">
                ✓ Isolated workspace
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex-1 bg-gray-900">
          {workspace?.workspace_url ? (
            <iframe
              src={workspace.workspace_url}
              className="w-full h-full border-0"
              title="Penpot Design Workspace"
              allow="clipboard-read; clipboard-write; fullscreen"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-white">Loading workspace...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
