import Link from "next/link";

export default function DevOpsCoverPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "28px",
        background:
          "radial-gradient(circle at 20% 20%, rgba(201,244,212,0.35), transparent 45%), radial-gradient(circle at 80% 0%, rgba(157,232,176,0.28), transparent 42%), linear-gradient(160deg, #f8fcfa 0%, #eef8f2 55%, #e9f5ee 100%)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "1280px",
          minHeight: "calc(100vh - 56px)",
          margin: "0 auto",
          borderRadius: "24px",
          border: "1px solid rgba(16, 185, 129, 0.2)",
          background: "rgba(255,255,255,0.86)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 26px 80px rgba(6,95,70,0.12)",
          padding: "32px",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            borderBottom: "1px solid rgba(16, 185, 129, 0.16)",
            paddingBottom: "18px",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                fontSize: "0.74rem",
                fontWeight: 700,
                color: "#0A5F38",
              }}
            >
              Aaptor Interface
            </p>
            <h1
              style={{
                margin: "8px 0 0 0",
                fontSize: "clamp(1.7rem, 3vw, 2.55rem)",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                color: "#065F46",
              }}
            >
              DevOps Question Cover Page
            </h1>
          </div>
          <div
            style={{
              padding: "10px 14px",
              borderRadius: "999px",
              background: "#ECFDF5",
              color: "#065F46",
              fontSize: "0.82rem",
              fontWeight: 700,
              border: "1px solid #A7F3D0",
            }}
          >
            Formal Authoring Workspace
          </div>
        </header>

        <div
          style={{
            marginTop: "24px",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
            gap: "20px",
            alignItems: "stretch",
            flex: 1,
          }}
        >
          <div
            style={{
              borderRadius: "18px",
              border: "1px solid rgba(16, 185, 129, 0.16)",
              background: "#ffffff",
              padding: "24px",
            }}
          >
            <p
              style={{
                margin: 0,
                color: "#3e7261",
                fontSize: "1rem",
                lineHeight: 1.75,
                maxWidth: "760px",
              }}
            >
              Choose how you want to create DevOps assessment questions. Use AI for structured
              generation with proctoring and schedule controls, or move ahead with manual creation
              for direct authoring.
            </p>

            <div
              style={{
                marginTop: "22px",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "14px",
              }}
            >
              <div style={{ background: "#F5FFFA", border: "1px solid #C9F4D4", borderRadius: "14px", padding: "14px" }}>
                <div style={{ color: "#065F46", fontWeight: 700, fontSize: "1.12rem" }}>AIML-Like</div>
                <div style={{ color: "#3e7261", fontSize: "0.85rem" }}>Full Creation Workflow</div>
              </div>
              <div style={{ background: "#F5FFFA", border: "1px solid #C9F4D4", borderRadius: "14px", padding: "14px" }}>
                <div style={{ color: "#065F46", fontWeight: 700, fontSize: "1.12rem" }}>Proctoring</div>
                <div style={{ color: "#3e7261", fontSize: "0.85rem" }}>AI + Live Monitoring Config</div>
              </div>
              <div style={{ background: "#F5FFFA", border: "1px solid #C9F4D4", borderRadius: "14px", padding: "14px" }}>
                <div style={{ color: "#065F46", fontWeight: 700, fontSize: "1.12rem" }}>Custom</div>
                <div style={{ color: "#3e7261", fontSize: "0.85rem" }}>Add Custom Questions Too</div>
              </div>
            </div>
          </div>

          <div
            style={{
              borderRadius: "18px",
              border: "1px solid rgba(16, 185, 129, 0.16)",
              background: "linear-gradient(180deg, #ffffff 0%, #f7fcf9 100%)",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h2
              style={{
                margin: 0,
                color: "#065F46",
                fontSize: "1.22rem",
                fontWeight: 700,
              }}
            >
              Select Question Mode
            </h2>
            <p style={{ margin: "10px 0 16px 0", color: "#3e7261", fontSize: "0.92rem", lineHeight: 1.6 }}>
              Continue with one of the following modes.
            </p>

            <div style={{ display: "grid", gap: "12px", marginTop: "auto" }}>
              <Link
                href="/devops/create"
                style={{
                  display: "block",
                  borderRadius: "14px",
                  border: "1px solid #6AB08D",
                  background: "linear-gradient(145deg, #0A5F38 0%, #0f7a4a 100%)",
                  color: "#f1fff7",
                  padding: "16px 16px",
                  textDecoration: "none",
                  boxShadow: "0 10px 24px rgba(10,95,56,0.2)",
                }}
              >
                <div style={{ fontSize: "1rem", fontWeight: 700 }}>AI Question Generate</div>
                <div style={{ marginTop: "4px", fontSize: "0.84rem", opacity: 0.92 }}>
                  Open AIML-style creation frontend with full settings.
                </div>
              </Link>

              <Link
                href="/devops/manual-questions"
                style={{
                  display: "block",
                  borderRadius: "14px",
                  border: "1px solid #b7d7c3",
                  background: "#ffffff",
                  color: "#065F46",
                  padding: "16px 16px",
                  textDecoration: "none",
                  boxShadow: "0 8px 20px rgba(6,95,70,0.08)",
                }}
              >
                <div style={{ fontSize: "1rem", fontWeight: 700 }}>Manual Questions</div>
                <div style={{ marginTop: "4px", fontSize: "0.84rem", color: "#3e7261" }}>
                  Build questions manually with direct control over each field.
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
