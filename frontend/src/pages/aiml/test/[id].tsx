import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { setGateContext } from "../../../lib/gateContext";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:80";

export default function AIMLTestVerifyPage() {
  const router = useRouter();
  const { id: testId } = router.query;
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [testInfo, setTestInfo] = useState<{ title: string; duration: number } | null>(null);
  const [checkingToken, setCheckingToken] = useState(true);
  const [showStartTimePopup, setShowStartTimePopup] = useState(false);
  const [showEndTimePopup, setShowEndTimePopup] = useState(false);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;
    
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setError("Invalid test link - token missing");
      setCheckingToken(false);
      return;
    }

    // Verify the link token
    const verifyLink = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/v1/aiml/tests/${testId}/verify-link?token=${encodeURIComponent(token)}`);
        setTestInfo({
          title: response.data.title || "AIML Assessment",
          duration: response.data.duration_minutes || 60,
        });
        setError("");
      } catch (err: any) {
        setError(err.response?.data?.detail || "Invalid test link");
      } finally {
        setCheckingToken(false);
      }
    };

    verifyLink();
  }, [testId]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (verifying) return;
    
    setVerifying(true);
    setError("");

    try {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) {
        setError("Token missing");
        setVerifying(false);
        return;
      }

      // Verify candidate
      const verifyResponse = await axios.post(
        `${apiUrl}/api/v1/aiml/tests/${testId}/verify-candidate?email=${encodeURIComponent(email.trim())}&name=${encodeURIComponent(name.trim())}`
      );
      
      const candidateInfo = verifyResponse.data;

      // Check if test has ended
      if (candidateInfo.test_has_ended && candidateInfo.end_time) {
        // Test has ended - show popup
        setEndTime(candidateInfo.end_time);
        setShowEndTimePopup(true);
        setVerifying(false);
        return;
      }

      // Check if test has started
      if (!candidateInfo.test_has_started && candidateInfo.start_time) {
        // Test hasn't started yet - show popup
        setStartTime(candidateInfo.start_time);
        setShowStartTimePopup(true);
        setVerifying(false);
        return;
      }

      // Store candidate info for shared gate pages
      sessionStorage.setItem("candidateEmail", email.trim());
      sessionStorage.setItem("candidateName", name.trim());
      sessionStorage.setItem("candidateUserId", candidateInfo.user_id);

      // Store gate routing context so shared gate can route to AIML take page
      setGateContext({
        flowType: "aiml",
        assessmentId: String(testId),
        token,
        candidateEmail: email.trim(),
        candidateName: name.trim(),
        candidateUserId: candidateInfo.user_id,
        entryUrl: `/aiml/test/${testId}?token=${encodeURIComponent(token)}`,
        finalTakeUrl: `/aiml/test/${testId}/take?token=${encodeURIComponent(token)}&user_id=${encodeURIComponent(candidateInfo.user_id)}`,
      });

      // Redirect into unified gate (do NOT start test before gate)
      router.push(`/precheck/${testId}/${encodeURIComponent(token)}`);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to verify. Please check your name and email.");
      setVerifying(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying test link...</p>
        </div>
      </div>
    );
  }

  if (error && !testInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-white to-orange-50 p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Test Link</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="px-2 py-0.5 bg-white/20 rounded-full text-sm font-medium">AIML Assessment</span>
          </div>
          <h1 className="text-2xl font-bold">{testInfo?.title || "Assessment"}</h1>
          {testInfo?.duration && (
            <p className="text-emerald-100 mt-1 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Duration: {testInfo.duration} minutes
            </p>
          )}
        </div>
        
        {/* Form */}
        <div className="p-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Welcome, Candidate!</h2>
          <p className="text-gray-500 text-sm mb-6">Please enter your details to begin the assessment.</p>
          
          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter your full name"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              />
            </div>
            
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm flex items-start gap-2">
                <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
            
            <button
              type="submit"
              disabled={verifying || !name.trim() || !email.trim()}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {verifying ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Verifying...
                </>
              ) : (
                <>
                  Start Assessment
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Start Time Popup Modal */}
      {showStartTimePopup && startTime && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Test Not Started</h2>
            <p className="text-gray-600 mb-4">
              The test has not started yet. Please wait for the scheduled start time.
            </p>
            <div className="bg-amber-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-amber-800 font-semibold mb-1">Test will start at</p>
              <p className="text-lg text-amber-700 font-bold">
                {(() => {
                  // Convert UTC to IST (UTC+5:30) for display
                  const utcDate = new Date(startTime);
                  const istDate = new Date(utcDate.getTime() + (5 * 60 + 30) * 60 * 1000);
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const month = months[istDate.getMonth()];
                  const day = istDate.getDate();
                  const year = istDate.getFullYear();
                  const hours = istDate.getHours().toString().padStart(2, '0');
                  const minutes = istDate.getMinutes().toString().padStart(2, '0');
                  return `${month} ${day}, ${year} ${hours}:${minutes}`;
                })()}
              </p>
            </div>
            <button
              onClick={() => {
                setShowStartTimePopup(false);
                setStartTime(null);
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* End Time Popup Modal */}
      {showEndTimePopup && endTime && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Test Has Ended</h2>
            <p className="text-gray-600 mb-4">
              The test window has closed. You cannot take this assessment anymore.
            </p>
            <div className="bg-red-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-800 font-semibold mb-1">Test ended at</p>
              <p className="text-lg text-red-700 font-bold">
                {(() => {
                  // Convert UTC to IST (UTC+5:30) for display
                  const utcDate = new Date(endTime);
                  const istDate = new Date(utcDate.getTime() + (5 * 60 + 30) * 60 * 1000);
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  const month = months[istDate.getMonth()];
                  const day = istDate.getDate();
                  const year = istDate.getFullYear();
                  const hours = istDate.getHours().toString().padStart(2, '0');
                  const minutes = istDate.getMinutes().toString().padStart(2, '0');
                  return `${month} ${day}, ${year} ${hours}:${minutes}`;
                })()}
              </p>
            </div>
            <button
              onClick={() => {
                setShowEndTimePopup(false);
                setEndTime(null);
              }}
              className="w-full py-3 px-4 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold rounded-xl transition-all"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
