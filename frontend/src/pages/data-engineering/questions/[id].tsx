import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../../lib/auth";
import { ArrowLeft, Code, Database, CheckCircle, XCircle, Sparkles } from "lucide-react";

interface TestCase {
  description: string;
  input_data: {
    data: any[];
  };
  expected_output: {
    data: any[];
  };
}

interface Question {
  id: string;
  title: string;
  description: string;
  difficulty_level: number;
  topic: string;
  input_schema: Record<string, string>;
  sample_input: {
    data: any[];
  };
  expected_output: {
    data: any[];
  };
  test_cases: TestCase[];
  created_at: string;
  metadata?: {
    ai_generated?: boolean;
    experience_years?: number;
    requested_topic?: string;
    model?: string;
  };
}

export default function QuestionDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchQuestion();
    }
  }, [id]);

  const fetchQuestion = async () => {
    setLoading(true);
    
    try {
      const response = await fetch(`/api/v1/data-engineering/questions/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch question');
      }
      
      const data = await response.json();
      setQuestion(data);
    } catch (err: any) {
      console.error('Error fetching question:', err);
      alert(err.message || 'Failed to load question');
      router.push('/data-engineering/questions');
    } finally {
      setLoading(false);
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

  const formatTopicName = (topic: string): string => {
    return topic
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 1.5rem" }}>
          <div style={{
            backgroundColor: "#ffffff",
            padding: "4rem 2rem",
            borderRadius: "1rem",
            border: "1px solid #E5E7EB",
            textAlign: "center"
          }}>
            <p style={{ color: "#6B7280", fontSize: "0.95rem" }}>Loading question...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!question) {
    return null;
  }

  return (
    <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "3rem 1.5rem" }}>
        
        {/* Back Button */}
        <div style={{ marginBottom: "2rem" }}>
          <button
            type="button"
            onClick={() => router.push("/data-engineering/questions")}
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
            <ArrowLeft size={16} strokeWidth={2.5} /> Back to Questions
          </button>
        </div>

        {/* Question Header */}
        <div style={{
          backgroundColor: "#ffffff",
          padding: "2rem",
          borderRadius: "1rem",
          border: "1px solid #E5E7EB",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          marginBottom: "2rem"
        }}>
          <div style={{ marginBottom: "1rem" }}>
            <h1 style={{ 
              margin: "0 0 1rem 0", 
              color: "#111827",
              fontSize: "2rem",
              fontWeight: 700,
              lineHeight: 1.3
            }}>
              {question.title}
            </h1>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0.375rem 1rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  backgroundColor: `${getDifficultyColor(question.difficulty_level)}20`,
                  color: getDifficultyColor(question.difficulty_level),
                }}
              >
                {getDifficultyLabel(question.difficulty_level)}
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.375rem",
                  padding: "0.375rem 1rem",
                  borderRadius: "0.5rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  backgroundColor: "#F0F9F4",
                  color: "#00684A",
                }}
              >
                <Database size={16} />
                {formatTopicName(question.topic)}
              </span>
              {question.metadata?.ai_generated && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.375rem",
                    padding: "0.375rem 1rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    backgroundColor: "#EEF2FF",
                    color: "#6366F1",
                  }}
                >
                  <Sparkles size={16} />
                  AI Generated
                </span>
              )}
              {question.metadata?.experience_years && (
                <span style={{ fontSize: "0.875rem", color: "#6B7280", fontWeight: 500 }}>
                  {question.metadata.experience_years} years experience
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{
          backgroundColor: "#ffffff",
          padding: "2rem",
          borderRadius: "1rem",
          border: "1px solid #E5E7EB",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          marginBottom: "2rem"
        }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600 }}>
            Problem Description
          </h2>
          <p style={{ margin: 0, fontSize: "0.95rem", color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
            {question.description}
          </p>
        </div>

        {/* Input Schema */}
        <div style={{
          backgroundColor: "#ffffff",
          padding: "2rem",
          borderRadius: "1rem",
          border: "1px solid #E5E7EB",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          marginBottom: "2rem"
        }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Code size={20} />
            Input Schema
          </h2>
          <div style={{ 
            backgroundColor: "#F9FAFB", 
            padding: "1rem", 
            borderRadius: "0.5rem",
            border: "1px solid #E5E7EB",
            fontFamily: "monospace",
            fontSize: "0.875rem"
          }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #E5E7EB" }}>
                  <th style={{ padding: "0.5rem", textAlign: "left", color: "#6B7280", fontWeight: 600 }}>Column</th>
                  <th style={{ padding: "0.5rem", textAlign: "left", color: "#6B7280", fontWeight: 600 }}>Data Type</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(question.input_schema).map(([column, type]) => (
                  <tr key={column} style={{ borderBottom: "1px solid #E5E7EB" }}>
                    <td style={{ padding: "0.5rem", color: "#111827" }}>{column}</td>
                    <td style={{ padding: "0.5rem", color: "#6366F1" }}>{type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sample Input */}
        <div style={{
          backgroundColor: "#ffffff",
          padding: "2rem",
          borderRadius: "1rem",
          border: "1px solid #E5E7EB",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          marginBottom: "2rem"
        }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600 }}>
            Sample Input Data
          </h2>
          <div style={{ 
            backgroundColor: "#F9FAFB", 
            padding: "1rem", 
            borderRadius: "0.5rem",
            border: "1px solid #E5E7EB",
            overflowX: "auto"
          }}>
            <pre style={{ margin: 0, fontFamily: "monospace", fontSize: "0.875rem", color: "#111827" }}>
              {JSON.stringify(question.sample_input.data, null, 2)}
            </pre>
          </div>
        </div>

        {/* Expected Output */}
        <div style={{
          backgroundColor: "#ffffff",
          padding: "2rem",
          borderRadius: "1rem",
          border: "1px solid #E5E7EB",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          marginBottom: "2rem"
        }}>
          <h2 style={{ margin: "0 0 1rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <CheckCircle size={20} color="#10B981" />
            Expected Output
          </h2>
          <div style={{ 
            backgroundColor: "#F0FDF4", 
            padding: "1rem", 
            borderRadius: "0.5rem",
            border: "1px solid #BBF7D0",
            overflowX: "auto"
          }}>
            <pre style={{ margin: 0, fontFamily: "monospace", fontSize: "0.875rem", color: "#111827" }}>
              {JSON.stringify(question.expected_output.data, null, 2)}
            </pre>
          </div>
        </div>

        {/* Test Cases */}
        {question.test_cases && question.test_cases.length > 0 && (
          <div style={{
            backgroundColor: "#ffffff",
            padding: "2rem",
            borderRadius: "1rem",
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            marginBottom: "2rem"
          }}>
            <h2 style={{ margin: "0 0 1.5rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600 }}>
              Test Cases ({question.test_cases.length})
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {question.test_cases.map((testCase, index) => (
                <div key={index} style={{
                  padding: "1.5rem",
                  backgroundColor: "#F9FAFB",
                  borderRadius: "0.75rem",
                  border: "1px solid #E5E7EB"
                }}>
                  <h3 style={{ margin: "0 0 1rem 0", color: "#111827", fontSize: "1rem", fontWeight: 600 }}>
                    Test Case {index + 1}
                  </h3>
                  <p style={{ margin: "0 0 1rem 0", fontSize: "0.875rem", color: "#6B7280" }}>
                    {testCase.description}
                  </p>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                    <div>
                      <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
                        Input
                      </h4>
                      <div style={{ 
                        backgroundColor: "#ffffff", 
                        padding: "0.75rem", 
                        borderRadius: "0.5rem",
                        border: "1px solid #E5E7EB",
                        overflowX: "auto"
                      }}>
                        <pre style={{ margin: 0, fontFamily: "monospace", fontSize: "0.75rem", color: "#111827" }}>
                          {JSON.stringify(testCase.input_data.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                    
                    <div>
                      <h4 style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem", fontWeight: 600, color: "#374151" }}>
                        Expected Output
                      </h4>
                      <div style={{ 
                        backgroundColor: "#F0FDF4", 
                        padding: "0.75rem", 
                        borderRadius: "0.5rem",
                        border: "1px solid #BBF7D0",
                        overflowX: "auto"
                      }}>
                        <pre style={{ margin: 0, fontFamily: "monospace", fontSize: "0.75rem", color: "#111827" }}>
                          {JSON.stringify(testCase.expected_output.data, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metadata */}
        {question.metadata && (
          <div style={{
            backgroundColor: "#ffffff",
            padding: "2rem",
            borderRadius: "1rem",
            border: "1px solid #E5E7EB",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <h2 style={{ margin: "0 0 1rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600 }}>
              Metadata
            </h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem" }}>
              <div>
                <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, textTransform: "uppercase" }}>
                  Created
                </p>
                <p style={{ margin: 0, fontSize: "0.875rem", color: "#111827" }}>
                  {new Date(question.created_at).toLocaleDateString()} at {new Date(question.created_at).toLocaleTimeString()}
                </p>
              </div>
              {question.metadata.model && (
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, textTransform: "uppercase" }}>
                    AI Model
                  </p>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#111827" }}>
                    {question.metadata.model}
                  </p>
                </div>
              )}
              {question.metadata.requested_topic && (
                <div>
                  <p style={{ margin: "0 0 0.25rem 0", fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, textTransform: "uppercase" }}>
                    Requested Topic
                  </p>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#111827" }}>
                    {formatTopicName(question.metadata.requested_topic)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
