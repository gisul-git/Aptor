/**
 * Design Assessment - Landing Page with Guidelines
 * Candidate sees this first before starting the assessment
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

export default function DesignAssessmentStart() {
  const router = useRouter();
  const { assessmentId } = router.query;
  
  const [hasCamera, setHasCamera] = useState(false);
  const [hasFullscreen, setHasFullscreen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const checkPermissions = async () => {
    setIsChecking(true);
    setError(null);
    
    try {
      // Check camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setHasCamera(true);
      
      // Check fullscreen capability
      if (document.fullscreenEnabled) {
        setHasFullscreen(true);
      }
      
      setIsChecking(false);
    } catch (err) {
      setError('Camera permission denied. Please allow camera access to continue.');
      setIsChecking(false);
    }
  };
  
  const startAssessment = async () => {
    if (!hasCamera) {
      alert('Please allow camera access first');
      return;
    }
    
    // Request fullscreen
    try {
      await document.documentElement.requestFullscreen();
    } catch (err) {
      console.warn('Fullscreen request failed:', err);
    }
    
    // Navigate to assessment
    router.push(`/design/assessment/${assessmentId}`);
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6">
          <h1 className="text-3xl font-bold text-white">Design Assessment</h1>
          <p className="text-blue-100 mt-2">Please read the guidelines carefully before starting</p>
        </div>
        
        {/* Content */}
        <div className="p-8">
          {/* Guidelines */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              📋 Assessment Guidelines
            </h2>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg">
                <span className="text-2xl">⏱️</span>
                <div>
                  <h3 className="font-semibold text-gray-900">Time Limit</h3>
                  <p className="text-sm text-gray-700">You will have 60 minutes to complete the design challenge</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-green-50 rounded-lg">
                <span className="text-2xl">🎨</span>
                <div>
                  <h3 className="font-semibold text-gray-900">Design Tool</h3>
                  <p className="text-sm text-gray-700">You will use Penpot (design tool) to create your solution</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-purple-50 rounded-lg">
                <span className="text-2xl">📹</span>
                <div>
                  <h3 className="font-semibold text-gray-900">Proctoring</h3>
                  <p className="text-sm text-gray-700">Your camera will be active throughout the assessment for proctoring purposes</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-orange-50 rounded-lg">
                <span className="text-2xl">🔒</span>
                <div>
                  <h3 className="font-semibold text-gray-900">Fullscreen Mode</h3>
                  <p className="text-sm text-gray-700">The assessment will run in fullscreen mode. Exiting fullscreen will be logged as a violation</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-lg">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-semibold text-gray-900">Important Rules</h3>
                  <ul className="text-sm text-gray-700 list-disc list-inside space-y-1 mt-1">
                    <li>Do not switch tabs or windows</li>
                    <li>Do not exit fullscreen mode</li>
                    <li>Keep your face visible to the camera</li>
                    <li>No external help or resources</li>
                    <li>Submit before time runs out</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
          
          {/* System Check */}
          <div className="mb-8 p-6 bg-gray-50 rounded-xl border-2 border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              🔧 System Check
            </h2>
            
            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Camera Access</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  hasCamera ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {hasCamera ? '✓ Granted' : '○ Not Checked'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-gray-700">Fullscreen Support</span>
                <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  hasFullscreen ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {hasFullscreen ? '✓ Supported' : '○ Not Checked'}
                </span>
              </div>
            </div>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            
            {!hasCamera && (
              <button
                onClick={checkPermissions}
                disabled={isChecking}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 transition"
              >
                {isChecking ? 'Checking...' : 'Check Permissions'}
              </button>
            )}
          </div>
          
          {/* Start Button */}
          <div className="space-y-4">
            <button
              onClick={startAssessment}
              disabled={!hasCamera}
              className="w-full px-8 py-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold text-lg hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition shadow-lg"
            >
              {hasCamera ? '🚀 Start Assessment' : '🔒 Complete System Check First'}
            </button>
            
            <p className="text-center text-sm text-gray-500">
              By clicking "Start Assessment", you agree to the proctoring terms and conditions
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
