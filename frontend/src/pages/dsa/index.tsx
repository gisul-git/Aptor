import { useRouter } from "next/router";
import { GetServerSideProps } from "next";
import { requireAuth } from "../../lib/auth";
import Link from "next/link";

export default function DSAMainPage() {
  const router = useRouter();

  return (
    <div style={{ backgroundColor: "#ffffff", minHeight: "100vh" }}>
      <div className="container" style={{ paddingTop: "2rem", paddingBottom: "4rem" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto" }}>
          {/* Back Button */}
          <div style={{ marginBottom: "2rem" }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => router.push("/dashboard")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.5rem 1rem",
                fontSize: "0.875rem",
              }}
            >
              ← Back to Dashboard
            </button>
          </div>

          <h1 style={{ marginBottom: "3rem", color: "#1a1625", textAlign: "center", fontSize: "2.5rem" }}>
            DSA Competency Management
          </h1>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2rem", marginBottom: "2rem" }}>
            {/* Question Management Option */}
            <Link href="/dsa/questions" style={{ textDecoration: "none" }}>
              <div
                className="card"
                style={{
                  padding: "2.5rem",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  border: "2px solid #A8E8BC",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#2D7A52";
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow = "0 10px 25px rgba(45, 122, 82, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#A8E8BC";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ fontSize: "3rem", marginBottom: "1.5rem" }}>📚</div>
                <h2 style={{ marginBottom: "1.5rem", color: "#1a1625", fontSize: "1.5rem" }}>
                  Question Management
                </h2>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.875rem", color: "#2D7A52", backgroundColor: "#E8FAF0", padding: "0.25rem 0.75rem", borderRadius: "0.375rem" }}>
                    ✏️ Edit Questions
                  </span>
                  <span style={{ fontSize: "0.875rem", color: "#2D7A52", backgroundColor: "#E8FAF0", padding: "0.25rem 0.75rem", borderRadius: "0.375rem" }}>
                    📢 Publish/Unpublish
                  </span>
                </div>
              </div>
            </Link>
            {/* Create Questions Option */}
            <Link href="/dsa/questions/create" style={{ textDecoration: "none" }}>
              <div
                className="card"
                style={{
                  padding: "2.5rem",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  border: "2px solid #A8E8BC",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#2D7A52";
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow = "0 10px 25px rgba(45, 122, 82, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#A8E8BC";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ fontSize: "3rem", marginBottom: "1.5rem" }}>📝</div>
                <h2 style={{ marginBottom: "1.5rem", color: "#1a1625", fontSize: "1.5rem" }}>
                  Create Questions
                </h2>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.875rem", color: "#2D7A52", backgroundColor: "#E8FAF0", padding: "0.25rem 0.75rem", borderRadius: "0.375rem" }}>
                    ✨ AI Generation
                  </span>
                  <span style={{ fontSize: "0.875rem", color: "#2D7A52", backgroundColor: "#E8FAF0", padding: "0.25rem 0.75rem", borderRadius: "0.375rem" }}>
                    ✏️ Manual Creation
                  </span>
                </div>
              </div>
            </Link>

            {/* Create Assessment Option */}
            <Link href="/dsa/create" style={{ textDecoration: "none" }}>
              <div
                className="card"
                style={{
                  padding: "2.5rem",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "all 0.3s ease",
                  border: "2px solid #A8E8BC",
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#2D7A52";
                  e.currentTarget.style.transform = "translateY(-5px)";
                  e.currentTarget.style.boxShadow = "0 10px 25px rgba(45, 122, 82, 0.2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#A8E8BC";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <div style={{ fontSize: "3rem", marginBottom: "1.5rem" }}>📋</div>
                <h2 style={{ marginBottom: "1.5rem", color: "#1a1625", fontSize: "1.5rem" }}>
                  Create New Assessment
                </h2>
                <div style={{ display: "flex", gap: "0.5rem", justifyContent: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: "0.875rem", color: "#2D7A52", backgroundColor: "#E8FAF0", padding: "0.25rem 0.75rem", borderRadius: "0.375rem" }}>
                    ⏱️ Duration Settings
                  </span>
                  <span style={{ fontSize: "0.875rem", color: "#2D7A52", backgroundColor: "#E8FAF0", padding: "0.25rem 0.75rem", borderRadius: "0.375rem" }}>
                    📊 Question Selection
                  </span>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = requireAuth;

