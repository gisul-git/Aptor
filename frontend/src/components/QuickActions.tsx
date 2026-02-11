/**
 * Quick Actions Component
 * Displays competency cards for creating new assessments
 */

import { useState } from 'react';
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

// --- Icons (SVG Components for cleanliness) ---
const Icons = {
  AI: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
  ),
  List: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
  ),
  Code: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
  ),
  Chart: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
  ),
  Design: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
  ),
  Database: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg>
  ),
  Cloud: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 0 1-5.478-9.484A5 5 0 0 1 9 5h8.5a3.5 3.5 0 1 1 0 7h-2.5" /></svg>
  ),
  Settings: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v6m0 6v6M5.64 5.64l4.24 4.24m4.24 4.24l4.24 4.24M1 12h6m6 0h6M5.64 18.36l4.24-4.24m4.24-4.24l4.24-4.24" /></svg>
  )
};

// --- Reusable Card Component ---
const ServiceCard = ({ 
  title, 
  description, 
  icon: Icon, 
  onClick 
}: { 
  title: string; 
  description: string; 
  icon: any; 
  onClick?: () => void 
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "1.5rem",
        backgroundColor: "#ffffff",
        border: isHovered ? "1px solid #10b981" : "1px solid #e2e8f0",
        borderRadius: "1rem",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: isHovered 
          ? "0 10px 15px -3px rgba(16, 185, 129, 0.1), 0 4px 6px -2px rgba(16, 185, 129, 0.05)" 
          : "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
        transform: isHovered ? "translateY(-4px)" : "translateY(0)",
        height: "100%",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Decorative background gradient on hover */}
      <div style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: "100px",
        height: "100px",
        background: "linear-gradient(135deg, transparent 50%, rgba(168, 232, 188, 0.2) 100%)",
        opacity: isHovered ? 1 : 0,
        transition: "opacity 0.3s ease",
        borderTopRightRadius: "1rem"
      }} />

      <div>
        <div style={{
          display: "inline-flex",
          padding: "0.75rem",
          borderRadius: "0.75rem",
          backgroundColor: isHovered ? "#ecfdf5" : "#f1f5f9",
          color: isHovered ? "#059669" : "#64748b",
          marginBottom: "1rem",
          transition: "all 0.3s ease"
        }}>
          <Icon />
        </div>
        <h4 style={{
          margin: "0 0 0.5rem 0",
          fontSize: "1.1rem",
          fontWeight: 700,
          color: "#1e293b",
          letterSpacing: "-0.01em"
        }}>
          {title}
        </h4>
      </div>
      
      <p style={{
        margin: 0,
        fontSize: "0.875rem",
        color: "#64748b",
        lineHeight: 1.5,
      }}>
        {description}
      </p>
    </div>
  );
};

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
    try {
      localStorage.removeItem('currentDraftAssessmentId');
    } catch (err) {
      console.error("Error clearing draft ID:", err);
    }
  };

  // Shared container style for the grid
  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", // Responsive grid
    gap: "1.5rem",
    width: "100%",
  };

  return (
    <div style={{ padding: "0.5rem 0" }}>
      <div style={{ 
        display: "flex", 
        alignItems: "center", 
        marginBottom: "1.5rem",
        gap: "0.5rem"
      }}>
        <div style={{ width: "4px", height: "24px", backgroundColor: "#10b981", borderRadius: "2px" }} />
        <h3 style={{
          margin: 0,
          fontSize: "1.25rem",
          color: "#1e293b",
          fontWeight: 700,
          letterSpacing: "-0.02em",
        }}>
          Quick Actions
        </h3>
      </div>

      <div style={gridStyle}>
        {/* AI Assessment Service Card */}
        <Link 
          href="/assessments/create-new" 
          style={{ textDecoration: 'none' }}
          onClick={handleAIAssessmentClick}
        >
          <ServiceCard 
            title="AI Assessment"
            description="AI-powered assessment creation with automated question generation."
            icon={Icons.AI}
          />
        </Link>
        
        {/* Custom MCQ Service Card - Note: Uses onClick router push logic from original */}
        <div onClick={() => router.push("/custom-mcq/create")} style={{ textDecoration: 'none' }}>
          <ServiceCard 
            title="Custom MCQ / Subjective"
            description="Upload CSV files to create custom MCQ and subjective question sets."
            icon={Icons.List}
          />
        </div>
        
        {/* DSA Service Card */}
        <Link href="/dsa" style={{ textDecoration: 'none' }}>
          <ServiceCard 
            title="DSA Competency"
            description="Data structures and algorithms coding assessments."
            icon={Icons.Code}
          />
        </Link>
        
        {/* AIML Service Card */}
        <Link href="/aiml" style={{ textDecoration: 'none' }}>
          <ServiceCard 
            title="AI/ML Competency"
            description="Evaluate skills in numpy, pandas, and machine learning models."
            icon={Icons.Chart}
          />
        </Link>
        
        {/* Design Service Card */}
        <Link href="/design" style={{ textDecoration: 'none' }}>
          <ServiceCard 
            title="Design Competency"
            description="UI/UX design, creative thinking, and prototyping assessments."
            icon={Icons.Design}
          />
        </Link>
        
        {/* Data Engineering Service Card */}
        <Link href="/data-engineering" style={{ textDecoration: 'none' }}>
          <ServiceCard 
            title="Data Engineering"
            description="Assess skills in data pipelines, ETL processes, and big data."
            icon={Icons.Database}
          />
        </Link>
        
        {/* Cloud Service Card */}
        <Link href="/cloud" style={{ textDecoration: 'none' }}>
          <ServiceCard 
            title="Cloud Architecture"
            description="AWS, Azure, and GCP cloud platform competency assessments."
            icon={Icons.Cloud}
          />
        </Link>
        
        {/* DevOps Service Card */}
        <Link href="/devops" style={{ textDecoration: 'none' }}>
          <ServiceCard 
            title="DevOps & CI/CD"
            description="Infrastructure as code, automation, and deployment pipelines."
            icon={Icons.Settings}
          />
        </Link>
      </div>
    </div>
  );
}