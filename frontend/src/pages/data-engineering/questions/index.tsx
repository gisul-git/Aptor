import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../../lib/auth";
import { ArrowLeft, Plus, Search, Filter, Trash2, Eye } from "lucide-react";
import Link from "next/link";

interface Question {
  id: string;
  title: string;
  description: string;
  difficulty_level: number;
  topic: string;
  created_at: string;
  metadata?: {
    ai_generated?: boolean;
    experience_years?: number;
    test_question?: boolean;
    created_by?: string;
  };
}

export default function DataEngineeringQuestionsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch questions from API
  useEffect(() => {
    fetchQuestions();
  }, [difficultyFilter]);

  const fetchQuestions = async () => {
    setLoading(true);
    
    try {
      const params = new URLSearchParams({
        skip: '0',
        limit: '100'
      });
      
      if (difficultyFilter !== 'all') {
        params.append('difficulty', difficultyFilter);
      }
      
      const response = await fetch(`/api/v1/data-engineering/questions?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch questions');
      }
      
      const data = await response.json();
      console.log('Fetched questions:', data);
      setQuestions(data.questions || []);
    } catch (err: any) {
      console.error('Error fetching questions:', err);
      alert(err.message || 'Failed to load questions');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) {
      return;
    }
    
    try {
      const response = await fetch(`/api/v1/data-engineering/questions/${questionId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete question');
      }
      
      alert('Question deleted successfully!');
      fetchQuestions();
    } catch (err: any) {
      alert(err.message || 'Failed to delete question');
    }
  };

  const getDifficultyLabel = (level: number): string => {
    switch (level) {
      case 1:
        return 'Easy';
      case 2:
        return 'Medium';
      case 3:
        return 'Hard';
      default:
        return 'Unknown';
    }
  };

  // Filter questions by search query
  const filteredQuestions = questions.filter(q => 
    q.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    q.topic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getDifficultyColor = (level: number) => {
    switch (level) {
      case 1:
        return '#10B981';
      case 2:
        return '#F59E0B';
      case 3:
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  return (
    <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        
        {/* Back Button */}
        <div style={{ marginBottom: "2rem" }}>
          <button
            type="button"
            onClick={() => router.push("/data-engineering")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0",
              fontSize: "0.875rem",
              color: "#6B7280",
              backgroundColor: "transparent",
              border: "none",
              fontWeight: 600,
              cursor: "pointer",
              transition: "color 0.2s ease",
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = "#00684A"; }}
            onMouseOut={(e) => { e.currentTarget.style.color = "#6B7280"; }}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back
          </button>
        </div>

        {/* Page Header */}
        <div style={{ marginBottom: "2.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <h1 style={{ 
              margin: "0 0 0.5rem 0", 
              color: "#111827",
              fontSize: "2.25rem",
              fontWeight: 800,
              letterSpacing: "-0.025em"
            }}>
              Question Repository
            </h1>
            <p style={{ 
              color: "#6B7280", 
              fontSize: "1rem",
              margin: 0
            }}>
              Manage your data engineering questions
            </p>
          </div>
          
          <Link href="/data-engineering/questions/create">
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem 1.5rem",
                backgroundColor: "#00684A",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.5rem",
                fontSize: "0.95rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 4px rgba(0, 104, 74, 0.2)",
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "#005A3F";
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 8px rgba(0, 104, 74, 0.3)";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "#00684A";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 4px rgba(0, 104, 74, 0.2)";
              }}
            >
              <Plus size={20} strokeWidth={2.5} />
              Create Question
            </button>
          </Link>
        </div>

        {/* Filters */}
        <div style={{ 
          backgroundColor: "#ffffff", 
          padding: "1.5rem", 
          borderRadius: "1rem", 
          border: "1px solid #E5E7EB", 
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          marginBottom: "2rem"
        }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "1rem", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={20} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "#9CA3AF" }} />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem 0.75rem 3rem",
                  border: "1px solid #D1D5DB",
                  borderRadius: "0.5rem",
                  fontSize: "0.95rem",
                  outline: "none",
                  boxSizing: "border-box"
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
              />
            </div>
            
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              style={{
                padding: "0.75rem 1rem",
                border: "1px solid #D1D5DB",
                borderRadius: "0.5rem",
                fontSize: "0.95rem",
                backgroundColor: "#ffffff",
                cursor: "pointer",
                outline: "none"
              }}
            >
              <option value="all">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        {/* Questions List */}
        {loading ? (
          <div style={{
            backgroundColor: "#ffffff",
            padding: "4rem 2rem",
            borderRadius: "1rem",
            border: "1px solid #E5E7EB",
            textAlign: "center"
          }}>
            <p style={{ color: "#6B7280", fontSize: "0.95rem" }}>Loading questions...</p>
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div style={{
            backgroundColor: "#ffffff",
            padding: "4rem 2rem",
            borderRadius: "1rem",
            border: "2px dashed #E5E7EB",
            textAlign: "center"
          }}>
            <div style={{ marginBottom: "1rem", color: "#9CA3AF" }}>
              <Filter size={48} strokeWidth={1.5} style={{ margin: "0 auto" }} />
            </div>
            <h3 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600 }}>
              {questions.length === 0 ? "No questions yet" : "No matching questions"}
            </h3>
            <p style={{ color: "#6B7280", fontSize: "0.95rem", marginBottom: "1.5rem" }}>
              {questions.length === 0 
                ? "Create your first data engineering question to get started"
                : "Try adjusting your search or filters"}
            </p>
            {questions.length === 0 && (
              <Link href="/data-engineering/questions/create">
                <button
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.75rem 1.5rem",
                    backgroundColor: "#00684A",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "0.5rem",
                    fontSize: "0.95rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#005A3F"}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
                >
                  <Plus size={20} strokeWidth={2.5} />
                  Create Question
                </button>
              </Link>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {filteredQuestions.map((question) => (
              <div
                key={question.id}
                style={{
                  backgroundColor: "#ffffff",
                  padding: "1.5rem",
                  borderRadius: "0.75rem",
                  border: "1px solid #E5E7EB",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#00684A";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 104, 74, 0.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#E5E7EB";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.125rem", fontWeight: 600 }}>
                      {question.title}
                    </h3>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "0.25rem 0.75rem",
                          borderRadius: "0.375rem",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          backgroundColor: `${getDifficultyColor(question.difficulty_level)}20`,
                          color: getDifficultyColor(question.difficulty_level),
                        }}
                      >
                        {getDifficultyLabel(question.difficulty_level)}
                      </span>
                      <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                        {question.topic}
                      </span>
                      {question.metadata?.ai_generated && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            padding: "0.25rem 0.75rem",
                            borderRadius: "0.375rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            backgroundColor: "#F0F9F4",
                            color: "#00684A",
                          }}
                        >
                          AI Generated
                        </span>
                      )}
                      {question.metadata?.experience_years && (
                        <span style={{ fontSize: "0.875rem", color: "#6B7280" }}>
                          {question.metadata.experience_years} years exp
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button
                      onClick={() => router.push(`/data-engineering/questions/${question.id}`)}
                      style={{
                        padding: "0.5rem",
                        backgroundColor: "#F3F4F6",
                        color: "#374151",
                        border: "none",
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "#E5E7EB";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = "#F3F4F6";
                      }}
                      title="View question"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(question.id)}
                      style={{
                        padding: "0.5rem",
                        backgroundColor: "#FEE2E2",
                        color: "#DC2626",
                        border: "none",
                        borderRadius: "0.375rem",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.backgroundColor = "#FECACA";
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.backgroundColor = "#FEE2E2";
                      }}
                      title="Delete question"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#6B7280" }}>
                  Created: {new Date(question.created_at).toLocaleDateString()} at {new Date(question.created_at).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
