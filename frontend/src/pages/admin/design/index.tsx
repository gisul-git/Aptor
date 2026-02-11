/**
 * Design Assessment Admin Dashboard
 * Complete admin panel for managing design assessments
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

type Tab = 'questions' | 'candidates' | 'analytics' | 'links';

interface Question {
  _id: string;
  title: string;
  role: string;
  difficulty: string;
  task_type: string;
  created_at: string;
}

interface Candidate {
  _id: string;
  user_id: string;
  question_id: string;
  final_score: number;
  submitted_at: string;
  rule_based_score: number;
  ai_based_score: number;
}

interface Analytics {
  total_questions: number;
  total_candidates: number;
  average_score: number;
  completion_rate: number;
}

export default function DesignAdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('questions');
  const [loading, setLoading] = useState(false);
  
  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  
  // Candidates state
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [candidateSearch, setCandidateSearch] = useState('');
  
  // Analytics state
  const [analytics, setAnalytics] = useState<Analytics>({
    total_questions: 0,
    total_candidates: 0,
    average_score: 0,
    completion_rate: 0
  });
  
  // Generate question modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    role: 'ui_designer',
    difficulty: 'beginner',
    task_type: 'landing_page',
    topic: ''
  });
  
  const API_URL = 'http://localhost:3006/api/v1/design';
  
  // Load data on mount
  useEffect(() => {
    if (activeTab === 'questions') {
      loadQuestions();
    } else if (activeTab === 'candidates') {
      loadCandidates();
    } else if (activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [activeTab]);
  
  // Filter questions
  useEffect(() => {
    console.log('🔍 Filtering questions:', {
      totalQuestions: questions.length,
      questionSearch,
      roleFilter,
      difficultyFilter
    });
    
    // Debug: show first question's actual values
    if (questions.length > 0) {
      console.log('📋 Sample question data:', {
        role: questions[0].role,
        difficulty: questions[0].difficulty,
        title: questions[0].title
      });
    }
    
    let filtered = questions;
    
    if (questionSearch) {
      filtered = filtered.filter(q => 
        q.title.toLowerCase().includes(questionSearch.toLowerCase())
      );
    }
    
    if (roleFilter !== 'all') {
      console.log(`🔍 Filtering by role: "${roleFilter}"`);
      const beforeCount = filtered.length;
      filtered = filtered.filter(q => {
        console.log(`  Comparing: q.role="${q.role}" === roleFilter="${roleFilter}" = ${q.role === roleFilter}`);
        return q.role === roleFilter;
      });
      console.log(`  Role filter: ${beforeCount} → ${filtered.length} questions`);
    }
    
    if (difficultyFilter !== 'all') {
      console.log(`🔍 Filtering by difficulty: "${difficultyFilter}"`);
      const beforeCount = filtered.length;
      filtered = filtered.filter(q => {
        console.log(`  Comparing: q.difficulty="${q.difficulty}" === difficultyFilter="${difficultyFilter}" = ${q.difficulty === difficultyFilter}`);
        return q.difficulty === difficultyFilter;
      });
      console.log(`  Difficulty filter: ${beforeCount} → ${filtered.length} questions`);
    }
    
    console.log('✅ Filtered questions:', filtered.length);
    setFilteredQuestions(filtered);
  }, [questions, questionSearch, roleFilter, difficultyFilter]);
  
  // Filter candidates
  useEffect(() => {
    let filtered = candidates;
    
    if (candidateSearch) {
      filtered = filtered.filter(c => 
        c.user_id.toLowerCase().includes(candidateSearch.toLowerCase())
      );
    }
    
    setFilteredCandidates(filtered);
  }, [candidates, candidateSearch]);
  
  const loadQuestions = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching questions from:', `${API_URL}/questions?limit=100`);
      const res = await fetch(`${API_URL}/questions?limit=100`);
      console.log('📡 Response status:', res.status);
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('📊 Data received, is array:', Array.isArray(data), 'length:', data.length);
      
      // Ensure data is an array
      const questionsArray = Array.isArray(data) ? data : [];
      console.log('✅ Questions array length:', questionsArray.length);
      setQuestions(questionsArray);
      setFilteredQuestions(questionsArray);
    } catch (err) {
      console.error('❌ Failed to load questions:', err);
      setQuestions([]);
      setFilteredQuestions([]);
    }
    setLoading(false);
  };
  
  const loadCandidates = async () => {
    setLoading(true);
    try {
      // Get all submissions from backend
      const res = await fetch(`${API_URL}/admin/submissions`);
      const data = await res.json();
      
      // Ensure submissions is an array
      const submissionsArray = Array.isArray(data.submissions) ? data.submissions : [];
      setCandidates(submissionsArray);
      setFilteredCandidates(submissionsArray);
    } catch (err) {
      console.error('Failed to load candidates:', err);
      setCandidates([]);
      setFilteredCandidates([]);
    }
    setLoading(false);
  };
  
  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Get stats from backend
      const res = await fetch(`${API_URL}/admin/stats`);
      const data = await res.json();
      
      setAnalytics({
        total_questions: data.total_questions || 0,
        total_candidates: data.total_submissions || 0,
        average_score: data.average_score || 0,
        completion_rate: data.completion_rate || 0
      });
    } catch (err) {
      console.error('Failed to load analytics:', err);
    }
    setLoading(false);
  };
  
  const handleGenerateQuestion = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/questions/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...generateForm,
          created_by: 'admin'
        })
      });
      
      if (res.ok) {
        const newQuestion = await res.json();
        console.log('✅ Question generated:', newQuestion);
        console.log('📋 Generated question details:', {
          role: newQuestion.role,
          difficulty: newQuestion.difficulty,
          task_type: newQuestion.task_type
        });
        
        // Close modal
        setShowGenerateModal(false);
        
        // Show success message
        alert('✅ Question generated successfully!');
        
        // Reset filters to "all" to show all questions including the new one
        setRoleFilter('all');
        setDifficultyFilter('all');
        setQuestionSearch('');
        
        // Reload questions
        await loadQuestions();
      } else {
        const errorData = await res.json();
        console.error('❌ Generation failed:', errorData);
        alert('❌ Failed to generate question: ' + (errorData.detail || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to generate question:', err);
      alert('❌ Error generating question: ' + err.message);
    }
    setLoading(false);
  };
  
  const copyTestLink = (questionId: string) => {
    const link = `http://localhost:3001/design/assessment/${questionId}`;
    navigator.clipboard.writeText(link);
    alert('✅ Test link copied to clipboard!');
  };
  
  const exportToCSV = () => {
    // Simple CSV export
    const csv = [
      ['User ID', 'Question ID', 'Score', 'Rule Score', 'AI Score', 'Submitted At'],
      ...filteredCandidates.map(c => [
        c.user_id,
        c.question_id,
        c.final_score.toFixed(1),
        c.rule_based_score.toFixed(1),
        c.ai_based_score.toFixed(1),
        new Date(c.submitted_at).toLocaleString()
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidates_${Date.now()}.csv`;
    a.click();
  };
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Design Assessment Admin</h1>
              <p className="text-sm text-gray-500 mt-1">Manage questions, candidates, and analytics</p>
            </div>
            <button
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-gray-600 hover:text-gray-900"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-8">
            {[
              { id: 'questions', label: 'Questions', icon: '📝' },
              { id: 'candidates', label: 'Candidates', icon: '👥' },
              { id: 'analytics', label: 'Analytics', icon: '📊' },
              { id: 'links', label: 'Test Links', icon: '🔗' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'questions' && (
          <QuestionsTab
            questions={filteredQuestions}
            loading={loading}
            search={questionSearch}
            setSearch={setQuestionSearch}
            roleFilter={roleFilter}
            setRoleFilter={setRoleFilter}
            difficultyFilter={difficultyFilter}
            setDifficultyFilter={setDifficultyFilter}
            onGenerate={() => setShowGenerateModal(true)}
            onCopyLink={copyTestLink}
          />
        )}
        
        {activeTab === 'candidates' && (
          <CandidatesTab
            candidates={filteredCandidates}
            loading={loading}
            search={candidateSearch}
            setSearch={setCandidateSearch}
            onExport={exportToCSV}
          />
        )}
        
        {activeTab === 'analytics' && (
          <AnalyticsTab
            analytics={analytics}
            loading={loading}
          />
        )}
        
        {activeTab === 'links' && (
          <TestLinksTab
            questions={questions}
            onCopyLink={copyTestLink}
          />
        )}
      </div>
      
      {/* Generate Question Modal */}
      {showGenerateModal && (
        <GenerateQuestionModal
          form={generateForm}
          setForm={setGenerateForm}
          onGenerate={handleGenerateQuestion}
          onClose={() => setShowGenerateModal(false)}
          loading={loading}
        />
      )}
    </div>
  );
}

// Questions Tab Component
function QuestionsTab({ questions, loading, search, setSearch, roleFilter, setRoleFilter, difficultyFilter, setDifficultyFilter, onGenerate, onCopyLink }: any) {
  return (
    <div>
      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <input
              type="text"
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg flex-1 max-w-md"
            />
            
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Roles</option>
              <option value="ui_designer">UI Designer</option>
              <option value="ux_designer">UX Designer</option>
              <option value="product_designer">Product Designer</option>
              <option value="visual_designer">Visual Designer</option>
            </select>
            
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="all">All Difficulties</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          
          <button
            onClick={onGenerate}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            + Generate Question
          </button>
        </div>
      </div>
      
      {/* Questions Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="text-gray-500">Loading questions...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">📝</div>
            <p className="text-gray-500">No questions found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Difficulty</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Task Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {questions.map((q: any) => (
                <tr key={q._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{q.title}</div>
                    <div className="text-xs text-gray-500 mt-1 line-clamp-1">{q.description}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{q.role.replace('_', ' ')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      q.difficulty === 'advanced' ? 'bg-red-100 text-red-700' :
                      q.difficulty === 'intermediate' ? 'bg-orange-100 text-orange-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {q.difficulty}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{q.task_type.replace('_', ' ')}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => onCopyLink(q._id || q.id)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Copy Link
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      
      <div className="mt-4 text-sm text-gray-500">
        Showing {questions.length} question{questions.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

// Candidates Tab Component
function CandidatesTab({ candidates, loading, search, setSearch, onExport }: any) {
  return (
    <div>
      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex items-center justify-between gap-4">
          <input
            type="text"
            placeholder="Search candidates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg flex-1 max-w-md"
          />
          
          <button
            onClick={onExport}
            disabled={candidates.length === 0}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:bg-gray-400"
          >
            📥 Export CSV
          </button>
        </div>
      </div>
      
      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-blue-800">
          💡 <strong>Tip:</strong> To view candidate data, use the Python helper scripts:
          <code className="ml-2 px-2 py-1 bg-blue-100 rounded">python check_docker_mongodb.py</code>
        </p>
      </div>
      
      {/* Candidates Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin text-4xl mb-4">⏳</div>
            <p className="text-gray-500">Loading candidates...</p>
          </div>
        ) : candidates.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">👥</div>
            <p className="text-gray-500 mb-2">No candidates yet</p>
            <p className="text-sm text-gray-400">Candidates will appear here after taking tests</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">User ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Question</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rule Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">AI Score</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {candidates.map((c: any) => (
                <tr key={c._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">{c.user_id}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.question_id.substring(0, 8)}...</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-sm font-bold rounded ${
                      c.final_score >= 80 ? 'bg-green-100 text-green-700' :
                      c.final_score >= 60 ? 'bg-blue-100 text-blue-700' :
                      c.final_score >= 40 ? 'bg-orange-100 text-orange-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {c.final_score.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.rule_based_score.toFixed(1)}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{c.ai_based_score.toFixed(1)}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(c.submitted_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// Analytics Tab Component
function AnalyticsTab({ analytics, loading }: any) {
  return (
    <div>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-3xl mb-2">📝</div>
          <div className="text-2xl font-bold text-gray-900">{analytics.total_questions}</div>
          <div className="text-sm text-gray-500">Total Questions</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-3xl mb-2">👥</div>
          <div className="text-2xl font-bold text-gray-900">{analytics.total_candidates}</div>
          <div className="text-sm text-gray-500">Total Candidates</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-3xl mb-2">📊</div>
          <div className="text-2xl font-bold text-gray-900">{analytics.average_score.toFixed(1)}</div>
          <div className="text-sm text-gray-500">Average Score</div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="text-3xl mb-2">✅</div>
          <div className="text-2xl font-bold text-gray-900">{analytics.completion_rate}%</div>
          <div className="text-sm text-gray-500">Completion Rate</div>
        </div>
      </div>
      
      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">📊 Detailed Analytics</h3>
        <p className="text-sm text-blue-800 mb-4">
          For detailed analytics and data visualization, use the MongoDB helper scripts:
        </p>
        <div className="space-y-2">
          <div className="bg-white rounded p-3">
            <code className="text-sm text-gray-800">python check_docker_mongodb.py</code>
            <p className="text-xs text-gray-600 mt-1">View all data in MongoDB</p>
          </div>
          <div className="bg-white rounded p-3">
            <code className="text-sm text-gray-800">python view_complete_candidate_data.py [question_id]</code>
            <p className="text-xs text-gray-600 mt-1">View all candidates for a question</p>
          </div>
          <div className="bg-white rounded p-3">
            <code className="text-sm text-gray-800">python quick_check.py</code>
            <p className="text-xs text-gray-600 mt-1">Quick summary of all submissions</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Test Links Tab Component
function TestLinksTab({ questions, onCopyLink }: any) {
  // Ensure questions is an array
  const questionsArray = Array.isArray(questions) ? questions : [];
  
  return (
    <div>
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Test Links</h3>
          <p className="text-sm text-gray-500 mt-1">Copy and share these links with candidates</p>
        </div>
        
        {questionsArray.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-4xl mb-4">🔗</div>
            <p className="text-gray-500">No questions available</p>
            <p className="text-sm text-gray-400 mt-2">Generate questions first to get test links</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {questionsArray.map((q: any) => (
              <div key={q._id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{q.title}</h4>
                    <p className="text-sm text-gray-500 mt-1">
                      {q.role.replace('_', ' ')} • {q.difficulty} • {q.task_type.replace('_', ' ')}
                    </p>
                    <div className="mt-3 p-3 bg-gray-50 rounded border border-gray-200">
                      <code className="text-sm text-gray-700">
                        http://localhost:3001/design/assessment/{q._id || q.id}
                      </code>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => onCopyLink(q._id || q.id)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap"
                  >
                    📋 Copy Link
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Generate Question Modal Component
function GenerateQuestionModal({ form, setForm, onGenerate, onClose, loading }: any) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Generate New Question</h3>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="ui_designer">UI Designer</option>
              <option value="ux_designer">UX Designer</option>
              <option value="product_designer">Product Designer</option>
              <option value="visual_designer">Visual Designer</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Difficulty</label>
            <select
              value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Task Type</label>
            <select
              value={form.task_type}
              onChange={(e) => setForm({ ...form, task_type: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="landing_page">Landing Page</option>
              <option value="mobile_app">Mobile App</option>
              <option value="dashboard">Dashboard</option>
              <option value="component">Component</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Topic (Optional)</label>
            <input
              type="text"
              value={form.topic}
              onChange={(e) => setForm({ ...form, topic: e.target.value })}
              placeholder="e.g., E-commerce, Healthcare, Finance"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
        
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onGenerate}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
