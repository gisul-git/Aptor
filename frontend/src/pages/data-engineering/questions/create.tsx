import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../../lib/auth";
import { ArrowLeft, Bot, PenTool, Sparkles, Loader2 } from "lucide-react";

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
  const [isAiGenerated, setIsAiGenerated] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [loadingTopics, setLoadingTopics] = useState(true);
  
  // AI Generation fields
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [experienceLevel, setExperienceLevel] = useState(5);
  
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
        difficulty: difficulty
      });

      const response = await fetch(`/api/v1/data-engineering/questions/generate?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to generate question");
      }

      const data = await response.json();
      console.log('Question generated:', data);
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
        <div style={{ marginBottom: "2.5rem" }}>
          <h1 style={{ 
            margin: "0 0 0.5rem 0", 
            color: "#111827",
            fontSize: "2.25rem",
            fontWeight: 800,
            letterSpacing: "-0.025em"
          }}>
            Create Data Engineering Question
          </h1>
          <p style={{ 
            color: "#6B7280", 
            fontSize: "1rem",
            margin: 0
          }}>
            Generate questions using AI or create them manually
          </p>
        </div>

        {/* Question Type Toggle */}
        <div style={{ 
          marginBottom: "2rem", 
          padding: "0.5rem", 
          borderRadius: "0.75rem",
          backgroundColor: "#F3F4F6",
          display: "flex",
          gap: "0.5rem"
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
          borderRadius: "1rem",
          border: "1px solid #E5E7EB",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          padding: "2.5rem",
          marginBottom: "4rem"
        }}>

          {isAiGenerated ? (
            /* AI Generation Form */
            <div>
              <div style={{ 
                marginBottom: "2rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem"
              }}>
                <div style={{ backgroundColor: "#F0F9F4", padding: "0.5rem", borderRadius: "0.5rem", color: "#00684A" }}>
                  <Bot size={24} />
                </div>
                <div>
                  <h2 style={{ margin: "0 0 0.25rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 700 }}>
                    AI Configuration
                  </h2>
                  <p style={{ color: "#6B7280", fontSize: "0.875rem", margin: 0 }}>
                    AI will generate a unique question based on your parameters
                  </p>
                </div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginBottom: "2rem" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600, color: "#374151", fontSize: "0.875rem" }}>
                    Topic <span style={{ color: "#DC2626" }}>*</span>
                  </label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    disabled={loadingTopics}
                    style={{
                      width: "100%", padding: "0.75rem 1rem", border: "1px solid #D1D5DB",
                      borderRadius: "0.5rem", fontSize: "0.95rem", backgroundColor: "#ffffff",
                      cursor: loadingTopics ? "wait" : "pointer", transition: "all 0.2s ease", outline: "none"
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = "#00684A"}
                    onBlur={(e) => e.currentTarget.style.borderColor = "#D1D5DB"}
                  >
                    {loadingTopics ? (
                      <option>Loading topics...</option>
                    ) : (
                      topics.map(t => (
                        <option key={t} value={t}>
                          {TOPIC_DISPLAY_NAMES[t] || t}
                        </option>
                      ))
                    )}
                  </select>
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
              </div>

              <button
                onClick={handleAiGenerate}
                disabled={generating}
                style={{
                  width: "100%",
                  padding: "1rem",
                  backgroundColor: generating ? "#9CA3AF" : "#00684A",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: generating ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem"
                }}
                onMouseOver={(e) => {
                  if (!generating) e.currentTarget.style.backgroundColor = "#005A3F";
                }}
                onMouseOut={(e) => {
                  if (!generating) e.currentTarget.style.backgroundColor = "#00684A";
                }}
              >
                {generating ? (
                  <>
                    <Loader2 size={20} className="animate-spin" style={{ animation: "spin 1s linear infinite" }} />
                    Generating Question...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generate Question
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Manual Creation Form */
            <div>
              <div style={{ 
                marginBottom: "2rem",
                display: "flex",
                alignItems: "center",
                gap: "0.75rem"
              }}>
                <div style={{ backgroundColor: "#F0F9F4", padding: "0.5rem", borderRadius: "0.5rem", color: "#00684A" }}>
                  <PenTool size={24} />
                </div>
                <div>
                  <h2 style={{ margin: "0 0 0.25rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 700 }}>
                    Manual Question
                  </h2>
                  <p style={{ color: "#6B7280", fontSize: "0.875rem", margin: 0 }}>
                    Create a custom question with your own specifications
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
                  padding: "1rem",
                  backgroundColor: "#00684A",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.5rem",
                  fontSize: "1rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.5rem"
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#005A3F"}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#00684A"}
              >
                <PenTool size={20} />
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
