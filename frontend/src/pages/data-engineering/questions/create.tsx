import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../../lib/auth";
import { ArrowLeft, Bot, PenTool, Sparkles, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { dataEngineeringService } from "../../../services/data-engineering/data-engineering.service";

// Topic display names mapping
const TOPIC_DISPLAY_NAMES: Record<string, string> = {
  "transformations": "Data Transformations",
  "aggregations": "Aggregations",
  "joins": "Joins",
  "window_functions": "Window Functions",
  "performance_optimization": "Performance Optimization",
  "data_quality": "Data Quality",
  "streaming": "Streaming"
};

export default function CreateDataEngineeringQuestionPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isAiGenerated, setIsAiGenerated] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(true);
  const [loadingJobRoles, setLoadingJobRoles] = useState(true);
  
  // AI Generation fields
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [experienceLevel, setExperienceLevel] = useState(5);
  const [jobRoles, setJobRoles] = useState<Record<string, any>>({});
  const [jobRole, setJobRole] = useState("");
  const [customRequirements, setCustomRequirements] = useState("");
  const [suggestedTopics, setSuggestedTopics] = useState<string[]>([]);
  
  // Fetch available topics from backend
  useEffect(() => {
    const fetchTopics = async () => {
      try {
        const response = await fetch('/api/v1/data-engineering/questions/topics');
        if (response.ok) {
          const data = await response.json();
          setTopics(data);
          if (data.length > 0) {
            setTopic(data[0]); // Set first topic as default
          }
        }
      } catch (error) {
        console.error('Error fetching topics:', error);
        // Fallback to default topics if API fails
        setTopics(["transformations", "aggregations", "joins"]);
        setTopic("transformations");
      } finally {
        setLoadingTopics(false);
      }
    };
    
    fetchTopics();
  }, []);

  // Fetch job roles from backend
  useEffect(() => {
    const fetchJobRoles = async () => {
      try {
        const result = await dataEngineeringService.getJobRoles();
        setJobRoles(result.data.job_roles);
        // Set first job role as default
        const roleNames = Object.keys(result.data.job_roles);
        if (roleNames.length > 0) {
          setJobRole(roleNames[0]);
          setSuggestedTopics(result.data.job_roles[roleNames[0]].suggested_topics || []);
        }
      } catch (error) {
        console.error('Error fetching job roles:', error);
      } finally {
        setLoadingJobRoles(false);
      }
    };
    
    fetchJobRoles();
  }, []);

  // Update suggested topics when job role changes
  useEffect(() => {
    if (jobRole && jobRoles[jobRole]) {
      setSuggestedTopics(jobRoles[jobRole].suggested_topics || []);
    }
  }, [jobRole, jobRoles]);
  
  // Manual fields
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const handleAiGenerate = async () => {
    if (!topic || !difficulty) {
      alert("Please select topic and difficulty");
      return;
    }

    setGenerating(true);
    
    try {
      // Map difficulty to experience level
      // easy (1-2 years), medium (3-7 years), hard (8+ years)
      let experienceLevelForDifficulty = experienceLevel;
      if (difficulty === 'easy') {
        experienceLevelForDifficulty = Math.min(experienceLevel, 2);
      } else if (difficulty === 'medium') {
        experienceLevelForDifficulty = Math.max(3, Math.min(experienceLevel, 7));
      } else if (difficulty === 'hard') {
        experienceLevelForDifficulty = Math.max(8, experienceLevel);
      }
      
      // Build query parameters with user-selected values
      const params = new URLSearchParams({
        experience_level: experienceLevelForDifficulty.toString()
      });
      
      // Add topic - use the exact value from backend
      if (topic.trim()) {
        params.append('topic', topic);
      }
      
      console.log('Generating question with params:', {
        experience_level: experienceLevelForDifficulty,
        topic: topic,
        job_role: jobRole,
        custom_requirements: customRequirements
      });

      const result = await dataEngineeringService.generateQuestion({
        experience_level: experienceLevelForDifficulty,
        topic: topic.trim() || undefined,
        job_role: jobRole.trim() || undefined,
        custom_requirements: customRequirements.trim() || undefined
      });

      console.log('Question generated:', result.data);
      
      // Invalidate questions cache to refresh the list
      queryClient.invalidateQueries({ queryKey: ['data-engineering', 'questions'] });
      
      alert("Question generated and saved successfully!");
      router.push("/data-engineering/questions");
    } catch (error: any) {
      console.error('Error generating question:', error);
      alert(error.message || "Failed to generate question");
    } finally {
      setGenerating(false);
    }
  };

  const handleManualCreate = async () => {
    if (!title.trim() || !description.trim()) {
      alert("Title and description are required");
      return;
    }

    // TODO: Implement manual question creation API call
    alert("Manual question creation coming soon!");
  };

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FAFCFB", padding: "2rem 0", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "0 1.5rem" }}>
        
        {/* Back Button */}
        <div style={{ marginBottom: "2rem" }}>
          <button
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
            onMouseOver={(e) => e.currentTarget.style.color = "#00684A"}
            onMouseOut={(e) => e.currentTarget.style.color = "#6B7280"}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Questions
          </button>
        </div>

        {/* Page Header */}
        <div style={{ marginBottom: "3rem", textAlign: "center" }}>
          <div style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "0.5rem",
            marginBottom: "1rem",
            padding: "0.5rem 1rem",
            backgroundColor: "#F5F3FF",
            borderRadius: "2rem",
            border: "1px solid #E9D5FF"
          }}>
            <Sparkles size={16} color="#7C3AED" />
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#7C3AED" }}>
              Question Builder
            </span>
          </div>
          <h1 style={{ 
            margin: "0 0 0.75rem 0", 
            color: "#111827",
            fontSize: "2.75rem",
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: "1.1"
          }}>
            Create New Question
          </h1>
          <p style={{ 
            color: "#6B7280", 
            fontSize: "1.125rem",
            margin: "0 auto",
            maxWidth: "600px",
            lineHeight: "1.6"
          }}>
            Generate intelligent questions with AI or craft custom ones
          </p>
        </div>

        {/* Question Type Toggle */}
        <div style={{ 
          marginBottom: "2.5rem", 
          padding: "0.375rem", 
          borderRadius: "1rem",
          backgroundColor: "#F9FAFB",
          display: "flex",
          gap: "0.5rem",
          border: "1px solid #E5E7EB",
          maxWidth: "500px",
          margin: "0 auto 2.5rem auto"
        }}>
          <button
            type="button"
            onClick={() => setIsAiGenerated(false)}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              gap: "0.5rem", 
              cursor: "pointer",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: !isAiGenerated ? "#ffffff" : "transparent",
              boxShadow: !isAiGenerated ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s ease",
              flex: 1,
              color: !isAiGenerated ? "#00684A" : "#6B7280",
              fontWeight: 600,
              fontSize: "0.95rem"
            }}
          >
            <PenTool size={18} strokeWidth={!isAiGenerated ? 2.5 : 2} />
            Manual Creation
          </button>
          
          <button
            type="button"
            onClick={() => setIsAiGenerated(true)}
            style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              gap: "0.5rem", 
              cursor: "pointer",
              padding: "0.75rem 1rem",
              borderRadius: "0.5rem",
              border: "none",
              backgroundColor: isAiGenerated ? "#ffffff" : "transparent",
              boxShadow: isAiGenerated ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.2s ease",
              flex: 1,
              color: isAiGenerated ? "#00684A" : "#6B7280",
              fontWeight: 600,
              fontSize: "0.95rem"
            }}
          >
            <Sparkles size={18} strokeWidth={isAiGenerated ? 2.5 : 2} />
            AI Generated
          </button>
        </div>

        {/* Content Area */}
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "1.25rem",
          border: "2px solid #E5E7EB",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -2px rgba(0, 0, 0, 0.03)",
          padding: "3rem",
          marginBottom: "4rem",
          maxWidth: "900px",
          margin: "0 auto"
        }}>

          {isAiGenerated ? (
            /* AI Generation Form */
            <div>
              <div style={{ 
                marginBottom: "2.5rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                paddingBottom: "1.5rem",
                borderBottom: "2px solid #F3F4F6"
              }}>
                <div style={{ 
                  background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                  padding: "0.875rem", 
                  borderRadius: "0.875rem", 
                  color: "#ffffff",
                  boxShadow: "0 4px 12px rgba(124, 58, 237, 0.2)"
                }}>
                  <Bot size={28} strokeWidth={2} />
                </div>
                <div>
                  <h2 style={{ margin: "0 0 0.25rem 0", color: "#111827", fontSize: "1.5rem", fontWeight: 700 }}>
                    AI Question Generator
                  </h2>
                  <p style={{ color: "#6B7280", fontSize: "0.9rem", margin: 0, lineHeight: "1.5" }}>
                    Configure parameters and let AI create comprehensive questions
                  </p>
                </div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Job Role <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <select
                    value={jobRole}
                    onChange={(e) => setJobRole(e.target.value)}
                    disabled={loadingJobRoles}
                    style={{
                      width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem", fontSize: "0.95rem", backgroundColor: "#ffffff",
                      cursor: loadingJobRoles ? "wait" : "pointer", transition: "all 0.2s ease", outline: "none"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                  >
                    {Object.keys(jobRoles).map(role => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  {jobRole && jobRoles[jobRole] && (
                    <p style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.375rem", marginBottom: 0 }}>
                      {jobRoles[jobRole].description}
                    </p>
                  )}
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Difficulty <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    style={{
                      width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem", fontSize: "0.95rem", backgroundColor: "#ffffff",
                      cursor: "pointer", transition: "all 0.2s ease", outline: "none"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                  >
                    <option value="easy">Easy (Beginner)</option>
                    <option value="medium">Medium (Intermediate)</option>
                    <option value="hard">Hard (Advanced)</option>
                  </select>
                </div>

                {suggestedTopics.length > 0 && (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                      Suggested Topics for {jobRole}
                    </label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {suggestedTopics.map(t => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTopic(t)}
                          style={{
                            padding: "0.5rem 1rem",
                            borderRadius: "0.5rem",
                            border: topic === t ? "2px solid #00684A" : "1px solid #D1D5DB",
                            backgroundColor: topic === t ? "#F0FDF4" : "#ffffff",
                            color: topic === t ? "#00684A" : "#6B7280",
                            fontSize: "0.875rem",
                            fontWeight: topic === t ? 600 : 400,
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                          }}
                          onMouseOver={(e) => {
                            if (topic !== t) {
                              e.currentTarget.style.borderColor = "#00684A";
                              e.currentTarget.style.color = "#00684A";
                            }
                          }}
                          onMouseOut={(e) => {
                            if (topic !== t) {
                              e.currentTarget.style.borderColor = "#D1D5DB";
                              e.currentTarget.style.color = "#6B7280";
                            }
                          }}
                        >
                          {TOPIC_DISPLAY_NAMES[t] || t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Topic <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="text"
                      list="topic-suggestions"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder={loadingTopics ? "Loading topics..." : "Select or type a topic"}
                      disabled={loadingTopics}
                      style={{
                        width: "100%", 
                        padding: "0.75rem 1rem", 
                        border: "1px solid #D1D5DB",
                        borderRadius: "0.5rem", 
                        fontSize: "0.95rem", 
                        backgroundColor: "#ffffff",
                        cursor: loadingTopics ? "wait" : "text", 
                        transition: "all 0.2s ease", 
                        outline: "none",
                        boxSizing: "border-box"
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                      onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                    />
                    <datalist id="topic-suggestions">
                      {!loadingTopics && topics.map(t => (
                        <option key={t} value={t}>
                          {TOPIC_DISPLAY_NAMES[t] || t}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.375rem", marginBottom: 0 }}>
                    Select from suggestions or type your own
                  </p>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Experience Level (years): {experienceLevel}
                    <span style={{ color: "#6B7280", fontWeight: 400, marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                      (Optional - overrides difficulty)
                    </span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#00684A" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#6B7280", marginTop: "0.25rem" }}>
                    <span>1 year</span>
                    <span>15 years</span>
                  </div>
                </div>

                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Custom Requirements
                    <span style={{ color: "#6B7280", fontWeight: 400, marginLeft: "0.5rem", fontSize: "0.8rem" }}>
                      (Optional)
                    </span>
                  </label>
                  <textarea
                    value={customRequirements}
                    onChange={(e) => setCustomRequirements(e.target.value)}
                    placeholder="Describe specific scenarios, requirements, or context for the question. E.g., 'Focus on e-commerce data with customer orders and products' or 'Include data quality validation for null values'"
                    style={{
                      width: "100%", 
                      padding: "0.75rem 1rem", 
                      border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem", 
                      fontSize: "0.95rem", 
                      backgroundColor: "#ffffff",
                      minHeight: "100px",
                      fontFamily: "inherit",
                      resize: "vertical",
                      transition: "all 0.2s ease", 
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                  />
                  <p style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.375rem", marginBottom: 0 }}>
                    Provide specific requirements or scenarios to guide question generation
                  </p>
                </div>
              </div>

              <button
                onClick={handleAiGenerate}
                disabled={generating}
                style={{
                  width: "100%",
                  padding: "1.125rem",
                  background: generating ? "#9CA3AF" : "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.75rem",
                  fontSize: "1.0625rem",
                  fontWeight: 700,
                  cursor: generating ? "not-allowed" : "pointer",
                  transition: "all 0.3s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  boxShadow: generating ? "none" : "0 4px 12px rgba(124, 58, 237, 0.3)",
                  letterSpacing: "0.01em"
                }}
                onMouseOver={(e) => {
                  if (!generating) {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.boxShadow = "0 8px 20px rgba(124, 58, 237, 0.4)";
                  }
                }}
                onMouseOut={(e) => {
                  if (!generating) {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(124, 58, 237, 0.3)";
                  }
                }}
              >
                {generating ? (
                  <>
                    <Loader2 size={22} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                    Generating Question...
                  </>
                ) : (
                  <>
                    <Sparkles size={22} />
                    Generate with AI
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Manual Creation Form */
            <div>
              <div style={{ 
                marginBottom: "2.5rem",
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                paddingBottom: "1.5rem",
                borderBottom: "2px solid #F3F4F6"
              }}>
                <div style={{ 
                  background: "linear-gradient(135deg, #00684A 0%, #00A86B 100%)",
                  padding: "0.875rem", 
                  borderRadius: "0.875rem", 
                  color: "#ffffff",
                  boxShadow: "0 4px 12px rgba(0, 104, 74, 0.2)"
                }}>
                  <PenTool size={28} strokeWidth={2} />
                </div>
                <div>
                  <h2 style={{ margin: "0 0 0.25rem 0", color: "#111827", fontSize: "1.5rem", fontWeight: 700 }}>
                    Manual Question Builder
                  </h2>
                  <p style={{ color: "#6B7280", fontSize: "0.9rem", margin: 0, lineHeight: "1.5" }}>
                    Design custom questions with full control over specifications
                  </p>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem", marginBottom: "2rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Question Title <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Calculate Moving Average with Window Functions"
                    style={{
                      width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem", fontSize: "0.95rem", transition: "all 0.2s ease",
                      outline: "none", boxSizing: "border-box"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                  />
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Description <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the problem and requirements..."
                    style={{
                      width: "100%", padding: "1rem", border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem", minHeight: "150px", fontSize: "0.95rem", 
                      fontFamily: "inherit", resize: "vertical", transition: "all 0.2s ease",
                      outline: "none", boxSizing: "border-box"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                  />
                </div>
              </div>

              <button
                onClick={handleManualCreate}
                style={{
                  width: "100%",
                  padding: "1.125rem",
                  background: "linear-gradient(135deg, #00684A 0%, #00A86B 100%)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.75rem",
                  fontSize: "1.0625rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  boxShadow: "0 4px 12px rgba(0, 104, 74, 0.3)",
                  letterSpacing: "0.01em"
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 20px rgba(0, 104, 74, 0.4)";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 104, 74, 0.3)";
                }}
              >
                <PenTool size={22} />
                Create Question
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
