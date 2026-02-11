/**
 * Design Assessment Page - Clean Version
 * Question Generation + Penpot Integration
 */

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';

interface Question {
  _id?: string;
  id?: string;
  title: string;
  description: string;
  role: string;
  difficulty: string;
  constraints: string[];
  time_limit_minutes: number;
}

interface Workspace {
  session_id: string;
  workspace_url: string;
  file_id: string;
  project_id: string;
  user_id?: string;
}

export default function DesignAssessmentPage() {
  const router = useRouter();
  const { assessmentId } = router.query;
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(60 * 60); // 60 minutes
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestScreenshot, setLatestScreenshot] = useState<string | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const screenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const idleCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Initialize assessment
  useEffect(() => {
    if (!assessmentId) return;
    initializeAssessment();
  }, [assessmentId]);
  
  const initializeAssessment = async () => {
    try {
      setLoading(true);
      
      // Fetch question
      const questionRes = await fetch(`http://localhost:3006/api/v1/design/questions/${assessmentId}`);
      if (!questionRes.ok) throw new Error('Failed to fetch question');
      const questionData = await questionRes.json();
      setQuestion(questionData);
      
      // Create workspace
      const workspaceRes = await fetch('http://localhost:3006/api/v1/design/workspace/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: 'candidate-' + Date.now(),
          assessment_id: assessmentId,
          question_id: assessmentId
        })
      });
      
      if (!workspaceRes.ok) throw new Error('Failed to create workspace');
      const workspaceData = await workspaceRes.json();
      setWorkspace(workspaceData);
      
      // Set timer based on question time limit
      if (questionData.time_limit_minutes) {
        setTimeRemaining(questionData.time_limit_minutes * 60);
      }
      
      // Start timer
      startTimer();
      
      // Start screenshot capture for evaluation
      startScreenshotCapture();
      
      // Start event tracking
      startEventTracking();
      
      setLoading(false);
    } catch (err: any) {
      console.error('Initialization error:', err);
      setError(err.message);
      setLoading(false);
    }
  };
  
  const startTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    
    timerIntervalRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };
  
  const startScreenshotCapture = () => {
    // Capture screenshot every 30 seconds for evaluation
    if (screenshotIntervalRef.current) {
      clearInterval(screenshotIntervalRef.current);
    }
    
    console.log('📸 Screenshot capture started (for evaluation)');
    
    // Capture first screenshot immediately
    captureScreenshot();
    
    // Then every 30 seconds
    screenshotIntervalRef.current = setInterval(() => {
      captureScreenshot();
    }, 30000);
  };
  
  const captureScreenshot = async () => {
    if (!workspace) return;
    
    try {
      // Get the Penpot iframe
      const iframe = document.querySelector('iframe[title="Penpot Design Workspace"]') as HTMLIFrameElement;
      if (!iframe) {
        console.warn('Penpot iframe not found');
        return;
      }
      
      // Create canvas to capture iframe content
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Set canvas size
      canvas.width = iframe.offsetWidth;
      canvas.height = iframe.offsetHeight;
      
      // Draw iframe content (note: cross-origin restrictions may apply)
      // For now, we'll capture a placeholder and rely on Penpot export
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#333';
      ctx.font = '20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Design Screenshot', canvas.width / 2, canvas.height / 2);
      
      // Convert to base64
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      setLatestScreenshot(imageData);
      
      console.log('📸 Screenshot captured for evaluation');
      
      // Send to backend for evaluation
      await fetch('http://localhost:3006/api/v1/design/screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: workspace.session_id,
          timestamp: new Date().toISOString(),
          image_data: imageData
        })
      });
      
    } catch (err) {
      console.error('Screenshot capture error:', err);
    }
  };
  
  const startEventTracking = () => {
    console.log('🎯 Event tracking started');
    
    // Track mouse clicks
    document.addEventListener('click', handleClick);
    
    // Track keyboard events (for undo/redo)
    document.addEventListener('keydown', handleKeyDown);
    
    // Track mouse movement (for activity detection)
    document.addEventListener('mousemove', handleMouseMove);
    
    // Check for idle time every 10 seconds
    idleCheckIntervalRef.current = setInterval(checkIdleTime, 10000);
  };
  
  const handleClick = (e: MouseEvent) => {
    const event = {
      type: 'click',
      timestamp: new Date().toISOString(),
      x: e.clientX,
      y: e.clientY,
      target: (e.target as HTMLElement)?.tagName || 'unknown'
    };
    
    setEvents(prev => [...prev, event]);
    lastActivityRef.current = Date.now();
    
    // Send to backend
    sendEvent(event);
  };
  
  const handleKeyDown = (e: KeyboardEvent) => {
    // Track undo/redo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      const event = {
        type: e.shiftKey ? 'redo' : 'undo',
        timestamp: new Date().toISOString()
      };
      
      setEvents(prev => [...prev, event]);
      lastActivityRef.current = Date.now();
      sendEvent(event);
    }
  };
  
  const handleMouseMove = () => {
    lastActivityRef.current = Date.now();
  };
  
  const checkIdleTime = () => {
    const idleTime = Date.now() - lastActivityRef.current;
    const idleSeconds = Math.floor(idleTime / 1000);
    
    // If idle for more than 30 seconds, log it
    if (idleSeconds > 30) {
      const event = {
        type: 'idle',
        timestamp: new Date().toISOString(),
        idle_seconds: idleSeconds
      };
      
      console.log(`⏸️ Idle detected: ${idleSeconds}s`);
      setEvents(prev => [...prev, event]);
      sendEvent(event);
      
      // Reset activity time
      lastActivityRef.current = Date.now();
    }
  };
  
  const sendEvent = async (event: any) => {
    if (!workspace) return;
    
    try {
      await fetch('http://localhost:3006/api/v1/design/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: workspace.session_id,
          ...event
        })
      });
    } catch (err) {
      console.error('Failed to send event:', err);
    }
  };
  
  const handleSubmit = async () => {
    if (isSubmitting || !workspace) return;
    
    try {
      setIsSubmitting(true);
      
      // Stop timer
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      
      // Stop screenshot capture
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      
      // Stop event tracking
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
      }
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleMouseMove);
      
      console.log('📤 Submitting design...');
      console.log(`📊 Total events captured: ${events.length}`);
      
      // Submit design with events
      const submitRes = await fetch('http://localhost:3006/api/v1/design/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: workspace.session_id,
          user_id: workspace.user_id || 'candidate-' + Date.now(),
          question_id: assessmentId,
          file_id: workspace.file_id,
          time_taken: (question?.time_limit_minutes || 60) * 60 - timeRemaining,
          events: events  // Send all captured events
        })
      });
      
      if (!submitRes.ok) throw new Error('Submission failed');
      
      const result = await submitRes.json();
      console.log('✅ Submission successful:', result);
      
      // Redirect to results
      router.push(`/design/results/${result.submission_id}`);
      
    } catch (err: any) {
      console.error('❌ Submission error:', err);
      alert('Submission failed: ' + err.message);
      setIsSubmitting(false);
    }
  };
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const getTimerColor = () => {
    if (timeRemaining <= 300) return 'text-red-600'; // 5 min
    if (timeRemaining <= 600) return 'text-orange-600'; // 10 min
    return 'text-green-600';
  };
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
      if (screenshotIntervalRef.current) {
        clearInterval(screenshotIntervalRef.current);
      }
      if (idleCheckIntervalRef.current) {
        clearInterval(idleCheckIntervalRef.current);
      }
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin text-6xl mb-4">⏳</div>
          <h2 className="text-2xl font-semibold text-gray-700">Loading Assessment...</h2>
          <p className="text-gray-500 mt-2">Setting up your workspace</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h2 className="text-2xl font-semibold text-red-600">Error</h2>
          <p className="text-gray-600 mt-2">{error}</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top Status Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold text-gray-800">
            {question?.title || 'Design Assessment'}
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Difficulty:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              question?.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
              question?.difficulty === 'medium' ? 'bg-orange-100 text-orange-700' :
              'bg-green-100 text-green-700'
            }`}>
              {question?.difficulty || 'Medium'}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Timer */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">⏱️</span>
            <span className={`text-2xl font-bold ${getTimerColor()}`}>
              {formatTime(timeRemaining)}
            </span>
          </div>
          
          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Design'}
          </button>
        </div>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Question Details */}
        <div className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Question Details</h2>
            
            {/* Description */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Description</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                {question?.description}
              </p>
            </div>
            
            {/* Role */}
            {question?.role && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Role</h3>
                <p className="text-sm text-gray-600">{question.role}</p>
              </div>
            )}
            
            {/* Constraints */}
            {question?.constraints && question.constraints.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Constraints</h3>
                <ul className="space-y-2">
                  {question.constraints.map((constraint, idx) => (
                    <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-blue-600 mt-1">•</span>
                      <span>{constraint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Time Limit */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Time Limit</h3>
              <p className="text-sm text-gray-600">
                {question?.time_limit_minutes || 60} minutes
              </p>
            </div>
            
            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">📝 Instructions</h3>
              <ul className="space-y-1 text-xs text-blue-700">
                <li>• Design in Penpot (right panel)</li>
                <li>• Follow all constraints</li>
                <li>• Submit before time runs out</li>
                <li>• Your work is auto-saved</li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Right Panel - Penpot Workspace */}
        <div className="flex-1 bg-gray-100">
          {workspace ? (
            <>
              <iframe
                src={workspace.workspace_url}
                className="w-full h-full border-0"
                title="Penpot Design Workspace"
                allow="clipboard-read; clipboard-write"
              />
              {/* Hidden canvas for screenshot capture */}
              <canvas ref={canvasRef} className="hidden" />
            </>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin text-4xl mb-4">⏳</div>
                <p className="text-gray-600">Loading workspace...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
