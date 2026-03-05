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
  const [questionPanelCollapsed, setQuestionPanelCollapsed] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
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
      
      // Create isolated Penpot workspace via backend API
      const userId = 'candidate-' + Date.now();
      
      console.log('🔧 Creating isolated Penpot workspace...');
      const workspaceRes = await fetch('http://localhost:3006/api/v1/design/workspace/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          assessment_id: assessmentId,
          question_id: questionData._id || questionData.id || assessmentId
        })
      });
      
      if (!workspaceRes.ok) {
        const errorData = await workspaceRes.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(`Failed to create workspace: ${errorData.detail || workspaceRes.statusText}`);
      }
      
      const workspaceData = await workspaceRes.json();
      console.log('✅ Workspace created:', workspaceData);
      
      setWorkspace({
        session_id: workspaceData.session_id,
        workspace_url: workspaceData.workspace_url,
        file_id: workspaceData.file_id,
        project_id: workspaceData.project_id,
        user_id: userId
      });
      
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
      console.error('❌ Initialization error:', err);
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
      console.log('📸 Capturing screenshot via Penpot export...');
      
      // Use Penpot's export API to get the design as an image
      // This is more reliable than trying to capture iframe content
      const exportUrl = `http://localhost:6060/api/export/${workspace.file_id}/page/latest`;
      
      try {
        // Try to fetch the exported image from Penpot
        const response = await fetch(exportUrl, {
          method: 'GET',
          credentials: 'include'
        });
        
        if (response.ok) {
          const blob = await response.blob();
          const reader = new FileReader();
          
          reader.onloadend = async () => {
            const imageData = reader.result as string;
            setLatestScreenshot(imageData);
            
            console.log('📸 Screenshot captured from Penpot export');
            
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
          };
          
          reader.readAsDataURL(blob);
        } else {
          // Fallback: Create a metadata screenshot
          console.log('📸 Using metadata screenshot (Penpot export not available)');
          await captureMetadataScreenshot();
        }
      } catch (exportError) {
        console.warn('Penpot export failed, using metadata screenshot:', exportError);
        await captureMetadataScreenshot();
      }
      
    } catch (err) {
      console.error('Screenshot capture error:', err);
    }
  };
  
  const captureMetadataScreenshot = async () => {
    // Create a canvas with metadata about the design session
    const canvas = canvasRef.current;
    if (!canvas || !workspace) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = 800;
    canvas.height = 600;
    
    // Draw background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw border
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    
    // Draw title
    ctx.fillStyle = '#333';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Design Assessment Screenshot', canvas.width / 2, 60);
    
    // Draw metadata
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#666';
    
    const metadata = [
      `Session ID: ${workspace.session_id.substring(0, 20)}...`,
      `File ID: ${workspace.file_id}`,
      `Timestamp: ${new Date().toLocaleString()}`,
      `Time Remaining: ${formatTime(timeRemaining)}`,
      '',
      'Note: This is a metadata screenshot.',
      'Actual design will be evaluated from Penpot file data.'
    ];
    
    let y = 120;
    metadata.forEach(line => {
      ctx.fillText(line, 40, y);
      y += 30;
    });
    
    // Draw Penpot logo text
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#3b82f6';
    ctx.textAlign = 'center';
    ctx.fillText('🎨 Penpot Design Workspace', canvas.width / 2, canvas.height - 40);
    
    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.9);
    setLatestScreenshot(imageData);
    
    console.log('📸 Metadata screenshot created');
    
    // Send to backend
    await fetch('http://localhost:3006/api/v1/design/screenshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: workspace.session_id,
        timestamp: new Date().toISOString(),
        image_data: imageData
      })
    });
  };
  
  const startEventTracking = () => {
    console.log('🎯 Event tracking started');
    
    // Track mouse clicks on the entire page
    document.addEventListener('click', handleClick, true); // Use capture phase
    
    // Track keyboard events (for undo/redo)
    document.addEventListener('keydown', handleKeyDown, true);
    
    // Track mouse movement (for activity detection)
    document.addEventListener('mousemove', handleMouseMove);
    
    // Track focus on Penpot iframe (indicates user is designing)
    const iframe = document.querySelector('iframe[title="Penpot Design Workspace"]');
    if (iframe) {
      iframe.addEventListener('mouseenter', () => {
        console.log('🎨 User entered Penpot workspace');
        const event = {
          type: 'workspace_enter',
          timestamp: new Date().toISOString()
        };
        setEvents(prev => [...prev, event]);
        sendEvent(event);
      });
    }
    
    // Check for idle time every 10 seconds
    idleCheckIntervalRef.current = setInterval(checkIdleTime, 10000);
    
    console.log('✅ Event tracking initialized - capturing clicks, keyboard, and activity');
  };
  
  const handleClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const isIframe = target.tagName === 'IFRAME';
    const isPenpotArea = target.closest('iframe[title="Penpot Design Workspace"]') !== null;
    
    const event = {
      type: 'click',
      timestamp: new Date().toISOString(),
      x: e.clientX,
      y: e.clientY,
      target: target.tagName || 'unknown',
      is_penpot_area: isIframe || isPenpotArea
    };
    
    setEvents(prev => [...prev, event]);
    lastActivityRef.current = Date.now();
    
    // Log to console for debugging
    if (isIframe || isPenpotArea) {
      console.log('🎨 Click on Penpot workspace detected');
    }
    
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
      const response = await fetch('http://localhost:3006/api/v1/design/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: workspace.session_id,
          ...event
        })
      });
      
      if (response.ok) {
        console.log(`✅ Event sent: ${event.type}`);
      } else {
        console.warn(`⚠️ Event send failed: ${response.status}`);
      }
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
      
      if (!submitRes.ok) {
        const errorData = await submitRes.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Submission failed');
      }
      
      const result = await submitRes.json();
      console.log('✅ Submission successful:', result);
      
      // Show success modal instead of redirecting to results
      setShowSuccessModal(true);
      
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
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown, true);
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
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-xl">
            <div className="text-center">
              <div className="text-6xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Test Submitted Successfully!</h2>
              <p className="text-gray-600 mb-6">
                Your design has been submitted and is being evaluated. You will be notified of the results soon.
              </p>
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  router.push('/design');
                }}
                className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium w-full"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
      
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
          {/* Tracking Status Indicator */}
          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 border border-green-200 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-xs text-green-700 font-medium">
              Recording: {events.length} events
            </span>
          </div>
          
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
        <div 
          className={`bg-white border-r border-gray-200 overflow-y-auto transition-all duration-300 ${
            questionPanelCollapsed ? 'w-12' : 'w-80'
          }`}
        >
          {questionPanelCollapsed ? (
            /* Collapsed State - Show Toggle Button Only */
            <div className="h-full flex items-center justify-center">
              <button
                onClick={() => setQuestionPanelCollapsed(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Show Question Details"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ) : (
            /* Expanded State - Show Full Content */
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800">Question Details</h2>
                <button
                  onClick={() => setQuestionPanelCollapsed(true)}
                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                  title="Hide Question Details"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
              </div>
            
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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="text-sm font-semibold text-blue-800 mb-2">📝 Instructions</h3>
              <ul className="space-y-1 text-xs text-blue-700">
                <li>• Design in Penpot (right panel)</li>
                <li>• Follow all constraints</li>
                <li>• Submit before time runs out</li>
                <li>• Your work is auto-saved</li>
              </ul>
            </div>
            
            {/* Tracking Status */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-green-800 mb-2">📊 Activity Tracking</h3>
              <div className="space-y-2 text-xs text-green-700">
                <div className="flex items-center justify-between">
                  <span>Events Captured:</span>
                  <span className="font-semibold">{events.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Screenshots:</span>
                  <span className="font-semibold">{latestScreenshot ? 'Active ✓' : 'Starting...'}</span>
                </div>
                <div className="text-xs text-green-600 mt-2 pt-2 border-t border-green-200">
                  Your design activity is being recorded for evaluation purposes.
                </div>
              </div>
            </div>
          )}
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
