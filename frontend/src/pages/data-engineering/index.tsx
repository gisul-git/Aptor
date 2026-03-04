import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../lib/auth";
import Link from "next/link";
import { 
  ArrowLeft, 
  BookOpen, 
  Edit3, 
  Globe, 
  FilePlus, 
  Bot, 
  PenTool, 
  ClipboardList, 
  Timer, 
  ListChecks 
} from "lucide-react";

export default function DataEngineeringMainPage() {
  const router = useRouter();

  return (
    <div style={{ backgroundColor: "#FAFCFB", minHeight: "100vh", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div className="container" style={{ paddingTop: "3rem", paddingBottom: "4rem", maxWidth: "1100px", margin: "0 auto", padding: "3rem 2rem" }}>
        
        {/* Back Button */}
        <div style={{ marginBottom: "2rem" }}>
          <button
            type="button"
            onClick={() => router.push("/competency")}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0",
              fontSize: "0.875rem",
              color: "#4B5563",
              backgroundColor: "transparent",
              border: "none",
              fontWeight: 500,
              cursor: "pointer",
              transition: "color 0.2s",
            }}
            onMouseOver={(e) => e.currentTarget.style.color = "#00684A"}
            onMouseOut={(e) => e.currentTarget.style.color = "#4B5563"}
          >
            <ArrowLeft size={16} strokeWidth={2.5} /> Back to Dashboard
          </button>
        </div>

        {/* Dashboard Header */}
        <div style={{ marginBottom: "3rem" }}>
          <h1 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "2rem", fontWeight: 700 }}>
            Data Engineering Management
          </h1>
          <p style={{ margin: 0, color: "#6B7280", fontSize: "1rem" }}>
            Create, manage, and configure your data engineering assessments.
          </p>
        </div>

        {/* Action Grid */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
          gap: "1.5rem" 
        }}>
          
          {/* 1. Question Management Option */}
          <Link href="/data-engineering/questions" style={{ textDecoration: "none" }}>
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "2rem",
                borderRadius: "1rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
                border: "1px solid #E1F2E9",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#00684A";
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 10px 25px rgba(0, 104, 74, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E1F2E9";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
              }}
            >
              <div style={{ 
                backgroundColor: "#F0F9F4", 
                padding: "1rem", 
                borderRadius: "0.75rem", 
                color: "#00684A",
                marginBottom: "1.5rem" 
              }}>
                <BookOpen size={32} strokeWidth={1.5} />
              </div>
              <h2 style={{ margin: "0 0 1rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600 }}>
                Question Management
              </h2>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "auto" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "#00684A", backgroundColor: "#F0F9F4", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E1F2E9" }}>
                  <Edit3 size={14} /> Edit Questions
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "#00684A", backgroundColor: "#F0F9F4", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E1F2E9" }}>
                  <Globe size={14} /> Publish/Unpublish
                </span>
              </div>
            </div>
          </Link>

          {/* 2. Create Questions Option */}
          <Link href="/data-engineering/questions/create" style={{ textDecoration: "none" }}>
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "2rem",
                borderRadius: "1rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
                border: "1px solid #E1F2E9",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#00684A";
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 10px 25px rgba(0, 104, 74, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E1F2E9";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
              }}
            >
              <div style={{ 
                backgroundColor: "#F0F9F4", 
                padding: "1rem", 
                borderRadius: "0.75rem", 
                color: "#00684A",
                marginBottom: "1.5rem" 
              }}>
                <FilePlus size={32} strokeWidth={1.5} />
              </div>
              <h2 style={{ margin: "0 0 1rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600 }}>
                Create Questions
              </h2>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "auto" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "#00684A", backgroundColor: "#F0F9F4", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E1F2E9" }}>
                  <Bot size={14} /> AI Generation
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "#00684A", backgroundColor: "#F0F9F4", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E1F2E9" }}>
                  <PenTool size={14} /> Manual Creation
                </span>
              </div>
            </div>
          </Link>

          {/* 3. Create Assessment Option */}
          <Link href="/data-engineering/create" style={{ textDecoration: "none" }}>
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "2rem",
                borderRadius: "1rem",
                cursor: "pointer",
                transition: "all 0.2s ease",
                border: "1px solid #E1F2E9",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#00684A";
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 10px 25px rgba(0, 104, 74, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E1F2E9";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)";
              }}
            >
              <div style={{ 
                backgroundColor: "#F0F9F4", 
                padding: "1rem", 
                borderRadius: "0.75rem", 
                color: "#00684A",
                marginBottom: "1.5rem" 
              }}>
                <ClipboardList size={32} strokeWidth={1.5} />
              </div>
              <h2 style={{ margin: "0 0 1rem 0", color: "#111827", fontSize: "1.25rem", fontWeight: 600 }}>
                Create New Assessment
              </h2>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "auto" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "#00684A", backgroundColor: "#F0F9F4", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E1F2E9" }}>
                  <Timer size={14} /> Duration Settings
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "#00684A", backgroundColor: "#F0F9F4", padding: "0.375rem 0.75rem", borderRadius: "0.5rem", border: "1px solid #E1F2E9" }}>
                  <ListChecks size={14} /> Question Selection
                </span>
              </div>
            </div>
          </Link>

        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;
