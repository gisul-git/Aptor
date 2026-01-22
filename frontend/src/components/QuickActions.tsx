/**
 * Quick Actions Component
 * Displays competency cards for creating new assessments
 * Only shows cards for services that have existing assessments
 */

import { useRouter } from 'next/router';
import Link from 'next/link';

interface QuickActionsProps {
  hasAIAssessments?: boolean;
  hasCustomMCQAssessments?: boolean;
  hasDSAAssessments?: boolean;
  hasAIMLAssessments?: boolean;
  hasDesignAssessments?: boolean;
  hasDataEngineeringAssessments?: boolean;
  hasCloudAssessments?: boolean;
  hasDevOpsAssessments?: boolean;
}

export default function QuickActions({
  hasAIAssessments = true,
  hasCustomMCQAssessments = true,
  hasDSAAssessments = true,
  hasAIMLAssessments = true,
  hasDesignAssessments = true,
  hasDataEngineeringAssessments = true,
  hasCloudAssessments = true,
  hasDevOpsAssessments = true,
}: QuickActionsProps) {
  const router = useRouter();

  const handleAIAssessmentClick = () => {
    // Clear any draft from localStorage to ensure a fresh start
    try {
      localStorage.removeItem('currentDraftAssessmentId');
    } catch (err) {
      console.error("Error clearing draft ID:", err);
    }
  };

  return (
    <div>
      <h3 style={{
        margin: 0,
        marginBottom: "1rem",
        fontSize: "0.875rem",
        color: "#64748b",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}>
        Quick Actions
      </h3>
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(4, 1fr)", 
        gap: "1rem", 
        width: "100%",
      }}>
        {/* AI Assessment Service Card - Always show */}
        <Link 
          href="/assessments/create-new" 
          style={{ width: "100%" }}
          onClick={handleAIAssessmentClick}
        >
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "1.25rem",
              backgroundColor: "#ffffff",
              border: "1.5px solid #A8E8BC",
              borderRadius: "0.75rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 6px rgba(168, 232, 188, 0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.2)";
              e.currentTarget.style.borderColor = "#10b981";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(168, 232, 188, 0.1)";
              e.currentTarget.style.borderColor = "#A8E8BC";
            }}
            >
              <button 
                type="button" 
                style={{ 
                  marginTop: 0, 
                  width: "100%",
                  padding: "0.875rem 1.5rem",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.625rem",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#059669";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#10b981";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 185, 129, 0.2)";
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                Create New Assessment (AI)
              </button>
              <p style={{
                margin: 0,
                fontSize: "0.8125rem",
                color: "#64748b",
                lineHeight: 1.4,
                textAlign: "center",
              }}>
                AI-powered assessment creation with automated question generation
              </p>
            </div>
          </Link>
        
        {/* Custom MCQ Service Card - Always show */}
        <div
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "1.25rem",
              backgroundColor: "#ffffff",
              border: "1.5px solid #A8E8BC",
              borderRadius: "0.75rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 6px rgba(168, 232, 188, 0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.2)";
              e.currentTarget.style.borderColor = "#10b981";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(168, 232, 188, 0.1)";
              e.currentTarget.style.borderColor = "#A8E8BC";
            }}
          >
            <button
              type="button"
              onClick={() => router.push("/custom-mcq/create")}
              style={{
                marginTop: 0,
                width: "100%",
                padding: "0.875rem 1.5rem",
                backgroundColor: "#10b981",
                color: "#ffffff",
                border: "none",
                borderRadius: "0.625rem",
                fontSize: "0.9375rem",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.625rem",
                boxShadow: "0 2px 8px rgba(16, 185, 129, 0.2)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#059669";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#10b981";
                e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 185, 129, 0.2)";
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Create Custom MCQ/Subjective Test (CSV)
            </button>
            <p style={{
              margin: 0,
              fontSize: "0.8125rem",
              color: "#64748b",
              lineHeight: 1.4,
              textAlign: "center",
            }}>
              Upload CSV file to create custom MCQ and subjective questions
              </p>
          </div>
        
        {/* DSA Service Card - Always show */}
        <Link href="/dsa" style={{ width: "100%" }}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "1.25rem",
              backgroundColor: "#ffffff",
              border: "1.5px solid #A8E8BC",
              borderRadius: "0.75rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 6px rgba(168, 232, 188, 0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.2)";
              e.currentTarget.style.borderColor = "#10b981";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(168, 232, 188, 0.1)";
              e.currentTarget.style.borderColor = "#A8E8BC";
            }}
            >
              <button 
                type="button" 
                style={{ 
                  marginTop: 0, 
                  width: "100%",
                  padding: "0.875rem 1.5rem",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.625rem",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#059669";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#10b981";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 185, 129, 0.2)";
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 18 22 12 16 6" />
                  <polyline points="8 6 2 12 8 18" />
                </svg>
                Create DSA Competency
              </button>
              <p style={{
                margin: 0,
                fontSize: "0.8125rem",
                color: "#64748b",
                lineHeight: 1.4,
                textAlign: "center",
              }}>
                Data structures and algorithms coding assessments
              </p>
            </div>
          </Link>
        
        {/* AIML Service Card - Always show */}
        <Link href="/aiml" style={{ width: "100%" }}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "1.25rem",
              backgroundColor: "#ffffff",
              border: "1.5px solid #A8E8BC",
              borderRadius: "0.75rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 6px rgba(168, 232, 188, 0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.2)";
              e.currentTarget.style.borderColor = "#10b981";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(168, 232, 188, 0.1)";
              e.currentTarget.style.borderColor = "#A8E8BC";
            }}
            >
              <button 
                type="button" 
                style={{ 
                  marginTop: 0, 
                  width: "100%",
                  padding: "0.875rem 1.5rem",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.625rem",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#059669";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#10b981";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 185, 129, 0.2)";
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                Create AIML Competency
              </button>
              <p style={{
                margin: 0,
                fontSize: "0.8125rem",
                color: "#64748b",
                lineHeight: 1.4,
                textAlign: "center",
              }}>
                AI/ML libraries (numpy, matplotlib, pandas) coding assessments
              </p>
            </div>
          </Link>
        
        {/* Design Service Card - Always show */}
        <Link href="/design" style={{ width: "100%" }}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "1.25rem",
              backgroundColor: "#ffffff",
              border: "1.5px solid #A8E8BC",
              borderRadius: "0.75rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 6px rgba(168, 232, 188, 0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.2)";
              e.currentTarget.style.borderColor = "#10b981";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(168, 232, 188, 0.1)";
              e.currentTarget.style.borderColor = "#A8E8BC";
            }}
            >
              <button 
                type="button" 
                style={{ 
                  marginTop: 0, 
                  width: "100%",
                  padding: "0.875rem 1.5rem",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.625rem",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#059669";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#10b981";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 185, 129, 0.2)";
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Create Design Competency
              </button>
              <p style={{
                margin: 0,
                fontSize: "0.8125rem",
                color: "#64748b",
                lineHeight: 1.4,
                textAlign: "center",
              }}>
                UI/UX design and creative assessments
              </p>
            </div>
          </Link>
        
        {/* Data Engineering Service Card - Always show */}
        <Link href="/data-engineering" style={{ width: "100%" }}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "1.25rem",
              backgroundColor: "#ffffff",
              border: "1.5px solid #A8E8BC",
              borderRadius: "0.75rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 6px rgba(168, 232, 188, 0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.2)";
              e.currentTarget.style.borderColor = "#10b981";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(168, 232, 188, 0.1)";
              e.currentTarget.style.borderColor = "#A8E8BC";
            }}
            >
              <button 
                type="button" 
                style={{ 
                  marginTop: 0, 
                  width: "100%",
                  padding: "0.875rem 1.5rem",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.625rem",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#059669";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#10b981";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 185, 129, 0.2)";
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
                  <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                </svg>
                Create Data Engineering Competency
              </button>
              <p style={{
                margin: 0,
                fontSize: "0.8125rem",
                color: "#64748b",
                lineHeight: 1.4,
                textAlign: "center",
              }}>
                Data pipelines, ETL, and data processing assessments
              </p>
            </div>
          </Link>
        
        {/* Cloud Service Card - Always show */}
        <Link href="/cloud" style={{ width: "100%" }}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "1.25rem",
              backgroundColor: "#ffffff",
              border: "1.5px solid #A8E8BC",
              borderRadius: "0.75rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 6px rgba(168, 232, 188, 0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.2)";
              e.currentTarget.style.borderColor = "#10b981";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(168, 232, 188, 0.1)";
              e.currentTarget.style.borderColor = "#A8E8BC";
            }}
            >
              <button 
                type="button" 
                style={{ 
                  marginTop: 0, 
                  width: "100%",
                  padding: "0.875rem 1.5rem",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.625rem",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#059669";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#10b981";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 185, 129, 0.2)";
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.5 19H9a7 7 0 0 1-5.478-9.484A5 5 0 0 1 9 5h8.5a3.5 3.5 0 1 1 0 7h-2.5" />
                </svg>
                Create Cloud Competency
              </button>
              <p style={{
                margin: 0,
                fontSize: "0.8125rem",
                color: "#64748b",
                lineHeight: 1.4,
                textAlign: "center",
              }}>
                AWS, Azure, GCP cloud platform assessments
              </p>
            </div>
          </Link>
        
        {/* DevOps Service Card - Always show */}
        <Link href="/devops" style={{ width: "100%" }}>
            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              padding: "1.25rem",
              backgroundColor: "#ffffff",
              border: "1.5px solid #A8E8BC",
              borderRadius: "0.75rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              boxShadow: "0 2px 6px rgba(168, 232, 188, 0.1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.2)";
              e.currentTarget.style.borderColor = "#10b981";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 6px rgba(168, 232, 188, 0.1)";
              e.currentTarget.style.borderColor = "#A8E8BC";
            }}
            >
              <button 
                type="button" 
                style={{ 
                  marginTop: 0, 
                  width: "100%",
                  padding: "0.875rem 1.5rem",
                  backgroundColor: "#10b981",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "0.625rem",
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.625rem",
                  boxShadow: "0 2px 8px rgba(16, 185, 129, 0.2)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "#059669";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(16, 185, 129, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "#10b981";
                  e.currentTarget.style.boxShadow = "0 2px 8px rgba(16, 185, 129, 0.2)";
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" />
                </svg>
                Create DevOps Competency
              </button>
              <p style={{
                margin: 0,
                fontSize: "0.8125rem",
                color: "#64748b",
                lineHeight: 1.4,
                textAlign: "center",
              }}>
                CI/CD, infrastructure, and automation assessments
              </p>
            </div>
          </Link>
      </div>
    </div>
  );
}

