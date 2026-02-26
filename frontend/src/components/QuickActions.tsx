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

// Icon gradient color mapping
type IconGradient = {
  from: string;
  to: string;
};

const ICON_GRADIENTS: Record<string, IconGradient> = {
  AI: { from: '#a855f7', to: '#9333ea' }, // purple-400 to purple-600
  CustomMCQ: { from: '#60a5fa', to: '#2563eb' }, // blue-400 to blue-600
  DSA: { from: '#86efac', to: '#16a34a' }, // mint-400 to mint-600
  AIML: { from: '#fb923c', to: '#ea580c' }, // orange-400 to orange-600
  Design: { from: '#f472b6', to: '#db2777' }, // pink-400 to pink-600
  DataEngineering: { from: '#2dd4bf', to: '#0d9488' }, // teal-400 to teal-600
  Cloud: { from: '#38bdf8', to: '#0284c7' }, // sky-400 to sky-600
  DevOps: { from: '#818cf8', to: '#4f46e5' }, // indigo-400 to indigo-600
};

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
  ),
  Zap: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
  ),
  Grid: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg>
  ),
  PlusCircle: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
  ),
};

// --- Reusable Card Component ---
const ServiceCard = ({ 
  title, 
  description, 
  icon: Icon, 
  onClick,
  gradientKey,
  href
}: { 
  title: string; 
  description: string; 
  icon: any; 
  onClick?: () => void;
  gradientKey: string;
  href?: string;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const gradient = ICON_GRADIENTS[gradientKey] || ICON_GRADIENTS.AI;

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const cardContent = (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "2rem",
        backgroundColor: "#ffffff",
        border: isHovered ? "2px solid #86efac" : "2px solid #e5e7eb",
        borderRadius: "1rem",
        cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        boxShadow: isHovered 
          ? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" 
          : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        transform: isHovered ? "scale(1.03) translateY(-8px)" : "scale(1) translateY(0)",
        minHeight: "240px",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: isHovered 
          ? "linear-gradient(135deg, rgba(232, 250, 240, 0.5) 0%, #ffffff 100%)" 
          : "#ffffff",
        textDecoration: "none",
        color: "inherit",
        outline: "none",
      }}
      onClick={handleClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      onFocus={(e) => {
        setIsHovered(true);
        e.currentTarget.style.boxShadow = "0 0 0 4px rgba(134, 239, 172, 0.3)";
      }}
      onBlur={(e) => {
        setIsHovered(false);
        e.currentTarget.style.boxShadow = isHovered 
          ? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" 
          : "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)";
      }}
      role="button"
      aria-label={`Create ${title} assessment`}
    >
      {/* Decorative background gradient on hover */}
      <div style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: "100%",
        height: "100%",
        background: `linear-gradient(135deg, transparent 50%, rgba(134, 239, 172, 0.1) 100%)`,
        opacity: isHovered ? 1 : 0,
        transition: "opacity 0.3s ease",
        borderRadius: "1rem",
        pointerEvents: "none",
      }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Icon with gradient background */}
        <div style={{
          display: "inline-flex",
          width: "64px",
          height: "64px",
          padding: "1rem",
          borderRadius: "1rem",
          background: `linear-gradient(135deg, ${gradient.from} 0%, ${gradient.to} 100%)`,
          color: "#ffffff",
          marginBottom: "1.25rem",
          transition: "all 0.3s ease",
          transform: isHovered ? "scale(1.1) rotate(3deg)" : "scale(1) rotate(0deg)",
          boxShadow: isHovered 
            ? `0 10px 20px -5px ${gradient.from}40` 
            : "0 4px 12px -2px rgba(0, 0, 0, 0.15)",
        }}>
          <Icon />
        </div>

        {/* Title */}
        <h4 style={{
          margin: "0 0 0.75rem 0",
          fontSize: "1.25rem",
          fontWeight: 700,
          letterSpacing: "-0.01em",
          transition: "color 0.2s ease",
          color: isHovered ? "#86efac" : "#1E5A3B",
        }}>
          {title}
        </h4>

        {/* Description */}
        <p style={{
          margin: 0,
          fontSize: "0.875rem",
          color: "#64748b",
          lineHeight: 1.6,
          opacity: isHovered ? 1 : 0.8,
          transition: "opacity 0.2s ease",
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          {description}
        </p>
      </div>

      {/* Hidden CTA Button - Appears on hover */}
      <button
        style={{
          marginTop: "1.5rem",
          width: "100%",
          padding: "0.75rem 1rem",
          backgroundColor: "#E8FAF0",
          color: "#1E5A3B",
          border: "2px solid #86efac",
          borderRadius: "0.75rem",
          fontSize: "0.9375rem",
          fontWeight: 600,
          cursor: "pointer",
          transition: "all 0.3s ease",
          opacity: isHovered ? 1 : 0,
          transform: isHovered ? "translateY(0)" : "translateY(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          position: "relative",
          zIndex: 1,
          pointerEvents: isHovered ? "auto" : "none",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#C9F4D4";
          e.currentTarget.style.borderColor = "#86efac";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "#E8FAF0";
          e.currentTarget.style.borderColor = "#86efac";
        }}
        onClick={(e) => {
          e.stopPropagation();
          handleClick();
        }}
      >
        <Icons.PlusCircle />
        Create Assessment
      </button>
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}>
        {cardContent}
      </Link>
    );
  }

  return cardContent;
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

  return (
    <div style={{ padding: "0.5rem 0" }}>
      {/* Enhanced Section Header */}
      <div style={{ 
        marginBottom: "1rem",
      }}>
        <div style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: "0.75rem",
          marginBottom: "0.5rem",
        }}>
          <div style={{ width: "4px", height: "28px", backgroundColor: "#86efac", borderRadius: "2px" }} />
          <div style={{
            display: "inline-flex",
            width: "28px",
            height: "28px",
            padding: "0.5rem",
            borderRadius: "0.5rem",
            backgroundColor: "#E8FAF0",
            color: "#86efac",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Icons.Grid />
          </div>
          <h3 style={{
            margin: 0,
            fontSize: "1.5rem",
            color: "#1E5A3B",
            fontWeight: 700,
            letterSpacing: "-0.02em",
          }}>
            Assessment Types
          </h3>
        </div>
        <p style={{
          margin: "0.25rem 0 0 0",
          fontSize: "0.875rem",
          color: "#64748b",
          paddingLeft: "2.5rem",
        }}>
          Choose an assessment type to get started
        </p>
      </div>

      {/* Responsive Grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: "1.5rem",
        width: "100%",
      }}>
        {/* AI Assessment Service Card */}
        <ServiceCard 
          title="AI Assessment"
          description="AI-powered assessment creation with automated question generation."
          icon={Icons.AI}
          gradientKey="AI"
          href="/assessments/create-new"
          onClick={handleAIAssessmentClick}
        />
        
        {/* Custom MCQ Service Card */}
        <ServiceCard 
          title="Custom MCQ / Subjective"
          description="Upload CSV files to create custom MCQ and subjective question sets."
          icon={Icons.List}
          gradientKey="CustomMCQ"
          onClick={() => router.push("/custom-mcq/create")}
        />
        
        {/* DSA Service Card */}
        <ServiceCard 
          title="DSA Competency"
          description="Data structures and algorithms coding assessments."
          icon={Icons.Code}
          gradientKey="DSA"
          href="/dsa"
        />
        
        {/* AIML Service Card */}
        <ServiceCard 
          title="AI/ML Competency"
          description="Evaluate skills in numpy, pandas, and machine learning models."
          icon={Icons.Chart}
          gradientKey="AIML"
          href="/aiml"
        />
        
        {/* Design Service Card */}
        <ServiceCard 
          title="Design Competency"
          description="UI/UX design, creative thinking, and prototyping assessments."
          icon={Icons.Design}
          gradientKey="Design"
          href="/design"
        />
        
        {/* Data Engineering Service Card */}
        <ServiceCard 
          title="Data Engineering"
          description="Assess skills in data pipelines, ETL processes, and big data."
          icon={Icons.Database}
          gradientKey="DataEngineering"
          href="/data-engineering"
        />
        
        {/* Cloud Service Card */}
        <ServiceCard 
          title="Cloud Architecture"
          description="AWS, Azure, and GCP cloud platform competency assessments."
          icon={Icons.Cloud}
          gradientKey="Cloud"
          href="/cloud"
        />
        
        {/* DevOps Service Card */}
        <ServiceCard 
          title="DevOps & CI/CD"
          description="Infrastructure as code, automation, and deployment pipelines."
          icon={Icons.Settings}
          gradientKey="DevOps"
          href="/devops"
        />
      </div>
    </div>
  );
}
