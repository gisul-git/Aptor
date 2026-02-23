import React from 'react';
import { Award, Zap, ArrowRight } from 'lucide-react';

interface WelcomeSectionProps {
  userName: string;
  companyName: string;
  certCount: number;
  assessmentCount: number;
}

const WelcomeSection: React.FC<WelcomeSectionProps> = ({ userName, companyName, certCount, assessmentCount }) => {
  return (
    <div style={{ flex: 1 }}>
      <h1 style={{ margin: 0, fontSize: "2.5rem", fontWeight: 700, color: "#0F172A", marginBottom: "0.5rem" }}>
        Welcome back, {userName}
      </h1>

      <p style={{ margin: 0, color: "#64748B", fontSize: "1.1rem", marginBottom: "1.5rem" }}>
        Your capability journey at <span style={{ color: "#0F172A", fontWeight: 700 }}>{companyName}</span>
      </p>

      {/* Stat Pills */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "2rem" }}>
        <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            border: "1px solid #E2E8F0", borderRadius: "99px",
            padding: "0.5rem 1rem", backgroundColor: "#ffffff",
            fontSize: "0.85rem", fontWeight: 600, color: "#0F172A"
        }}>
            <Award size={16} color="#065F46" /> {certCount} Certifications
        </div>
        <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            border: "1px solid #E2E8F0", borderRadius: "99px",
            padding: "0.5rem 1rem", backgroundColor: "#ffffff",
            fontSize: "0.85rem", fontWeight: 600, color: "#0F172A"
        }}>
            <Zap size={16} fill="#10B981" color="#059669" /> {assessmentCount} Assessments
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: "1rem" }}>
        <button
          style={{
            backgroundColor: "#065F46", // Dark Forest
            color: "white", border: "none",
            padding: "0.75rem 1.5rem", borderRadius: "0.5rem",
            fontSize: "0.95rem", fontWeight: 600,
            display: "flex", alignItems: "center", gap: "0.5rem",
            cursor: "pointer", boxShadow: "0 4px 6px -1px rgba(6, 95, 70, 0.2)",
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#047857"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#065F46"}
        >
          Take Assessment <ArrowRight size={18} />
        </button>

        <button
          style={{
            backgroundColor: "#ffffff",
            color: "#334155",
            border: "1px solid #E2E8F0",
            padding: "0.75rem 1.5rem", borderRadius: "0.5rem",
            fontSize: "0.95rem", fontWeight: 600,
            cursor: "pointer",
            transition: "background-color 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#F8FAFC"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
        >
          View Learning Path
        </button>
      </div>
    </div>
  );
};

export default WelcomeSection;