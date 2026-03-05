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
        <div style={{ marginBottom: "3.5rem", textAlign: "center" }}>
          <div style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "0.75rem",
            marginBottom: "1rem",
            padding: "0.5rem 1.25rem",
            backgroundColor: "#F0F9F4",
            borderRadius: "2rem",
            border: "1px solid #D1F2E1"
          }}>
            <div style={{ 
              width: "8px", 
              height: "8px", 
              borderRadius: "50%", 
              backgroundColor: "#00684A",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }} />
            <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#00684A" }}>
              Data Engineering Platform
            </span>
          </div>
          <h1 style={{ 
            margin: "0 0 0.75rem 0", 
            color: "#111827", 
            fontSize: "2.5rem", 
            fontWeight: 800,
            letterSpacing: "-0.03em",
            lineHeight: "1.2"
          }}>
            Build Powerful Assessments
          </h1>
          <p style={{ 
            margin: "0 auto", 
            color: "#6B7280", 
            fontSize: "1.125rem",
            maxWidth: "600px",
            lineHeight: "1.6"
          }}>
            Create, manage, and deploy data engineering questions with AI-powered generation
          </p>
        </div>

        {/* Action Grid */}
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", 
          gap: "2rem",
          marginBottom: "2rem"
        }}>
          
          {/* 1. Question Management Option */}
          <Link href="/data-engineering/questions" style={{ textDecoration: "none" }}>
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "2.5rem",
                borderRadius: "1.25rem",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                border: "2px solid #E1F2E9",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
                position: "relative",
                overflow: "hidden"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#00684A";
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow = "0 20px 25px -5px rgba(0, 104, 74, 0.15), 0 10px 10px -5px rgba(0, 104, 74, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E1F2E9";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)";
              }}
            >
              <div style={{ 
                background: "linear-gradient(135deg, #00684A 0%, #00A86B 100%)",
                padding: "1.25rem", 
                borderRadius: "1rem", 
                color: "#ffffff",
                marginBottom: "1.75rem",
                boxShadow: "0 4px 12px rgba(0, 104, 74, 0.2)"
              }}>
                <BookOpen size={36} strokeWidth={2} />
              </div>
              <h2 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.375rem", fontWeight: 700, lineHeight: "1.3" }}>
                Question Repository
              </h2>
              <p style={{ margin: "0 0 1.5rem 0", color: "#6B7280", fontSize: "0.9rem", lineHeight: "1.5" }}>
                Browse, edit, and manage your question library
              </p>
              <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", marginTop: "auto" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "#00684A", backgroundColor: "#F0F9F4", padding: "0.5rem 0.875rem", borderRadius: "0.625rem", border: "1px solid #D1F2E1" }}>
                  <Edit3 size={14} /> Edit
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "#00684A", backgroundColor: "#F0F9F4", padding: "0.5rem 0.875rem", borderRadius: "0.625rem", border: "1px solid #D1F2E1" }}>
                  <Globe size={14} /> Publish
                </span>
              </div>
            </div>
          </Link>

          {/* 2. Create Questions Option */}
          <Link href="/data-engineering/questions/create" style={{ textDecoration: "none" }}>
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "2.5rem",
                borderRadius: "1.25rem",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                border: "2px solid #E1F2E9",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
                position: "relative",
                overflow: "hidden"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#7C3AED";
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow = "0 20px 25px -5px rgba(124, 58, 237, 0.15), 0 10px 10px -5px rgba(124, 58, 237, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E1F2E9";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)";
              }}
            >
              <div style={{ 
                background: "linear-gradient(135deg, #7C3AED 0%, #A78BFA 100%)",
                padding: "1.25rem", 
                borderRadius: "1rem", 
                color: "#ffffff",
                marginBottom: "1.75rem",
                boxShadow: "0 4px 12px rgba(124, 58, 237, 0.2)"
              }}>
                <FilePlus size={36} strokeWidth={2} />
              </div>
              <h2 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.375rem", fontWeight: 700, lineHeight: "1.3" }}>
                Generate Questions
              </h2>
              <p style={{ margin: "0 0 1.5rem 0", color: "#6B7280", fontSize: "0.9rem", lineHeight: "1.5" }}>
                AI-powered question generation with smart templates
              </p>
              <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", marginTop: "auto" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "#7C3AED", backgroundColor: "#F5F3FF", padding: "0.5rem 0.875rem", borderRadius: "0.625rem", border: "1px solid #E9D5FF" }}>
                  <Bot size={14} /> AI Powered
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "#7C3AED", backgroundColor: "#F5F3FF", padding: "0.5rem 0.875rem", borderRadius: "0.625rem", border: "1px solid #E9D5FF" }}>
                  <PenTool size={14} /> Custom
                </span>
              </div>
            </div>
          </Link>

          {/* 3. Create Assessment Option */}
          <Link href="/data-engineering/create" style={{ textDecoration: "none" }}>
            <div
              style={{
                backgroundColor: "#ffffff",
                padding: "2.5rem",
                borderRadius: "1.25rem",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                border: "2px solid #E1F2E9",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)",
                position: "relative",
                overflow: "hidden"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#0369A1";
                e.currentTarget.style.transform = "translateY(-6px)";
                e.currentTarget.style.boxShadow = "0 20px 25px -5px rgba(3, 105, 161, 0.15), 0 10px 10px -5px rgba(3, 105, 161, 0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E1F2E9";
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)";
              }}
            >
              <div style={{ 
                background: "linear-gradient(135deg, #0369A1 0%, #0EA5E9 100%)",
                padding: "1.25rem", 
                borderRadius: "1rem", 
                color: "#ffffff",
                marginBottom: "1.75rem",
                boxShadow: "0 4px 12px rgba(3, 105, 161, 0.2)"
              }}>
                <ClipboardList size={36} strokeWidth={2} />
              </div>
              <h2 style={{ margin: "0 0 0.5rem 0", color: "#111827", fontSize: "1.375rem", fontWeight: 700, lineHeight: "1.3" }}>
                Build Assessment
              </h2>
              <p style={{ margin: "0 0 1.5rem 0", color: "#6B7280", fontSize: "0.9rem", lineHeight: "1.5" }}>
                Compose tests from your published questions
              </p>
              <div style={{ display: "flex", gap: "0.625rem", flexWrap: "wrap", marginTop: "auto" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "#0369A1", backgroundColor: "#E0F2FE", padding: "0.5rem 0.875rem", borderRadius: "0.625rem", border: "1px solid #BAE6FD" }}>
                  <Timer size={14} /> Configure
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "#0369A1", backgroundColor: "#E0F2FE", padding: "0.5rem 0.875rem", borderRadius: "0.625rem", border: "1px solid #BAE6FD" }}>
                  <ListChecks size={14} /> Select
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
