import Link from "next/link";
import { useDevOpsTests } from "@/hooks/api/useDevOps";

export default function DevOpsHomePage() {
  const { data: tests, isLoading, error } = useDevOpsTests();

  return (
    <main style={{ padding: "24px", fontFamily: "JetBrains Mono, monospace", background: "#0b0f14", minHeight: "100vh", color: "#c8d3df" }}>
      <h1 style={{ marginTop: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>DevOps Tests</h1>
      <p style={{ color: "#8fa1b4" }}>Open a test to run commands, Terraform, and lint tasks in the assessment IDE.</p>
      <p style={{ marginTop: "8px" }}>
        <Link href="/devops" style={{ color: "#4cc9f0", textDecoration: "none" }}>
          Open DevOps Cover Page
        </Link>
      </p>

      {isLoading && <p>Loading tests...</p>}
      {error && <p style={{ color: "#e5484d" }}>{(error as Error).message}</p>}

      {!isLoading && !error && (
        <div style={{ display: "grid", gap: "10px", maxWidth: "820px" }}>
          {(tests || []).map((test) => (
            <div key={test.id} style={{ border: "1px solid #273341", padding: "12px", background: "#131a22" }}>
              <div style={{ fontSize: "1rem", marginBottom: "6px" }}>{test.title}</div>
              <div style={{ display: "flex", gap: "12px", color: "#8fa1b4", fontSize: "0.82rem" }}>
                <span>{(test.questions || []).length} questions</span>
                <span>Duration {test.duration || "n/a"} mins</span>
              </div>
              <div style={{ marginTop: "10px" }}>
                <Link href={`/devops/tests/${test.id}/take`} style={{ color: "#ff9f1c", textDecoration: "none" }}>
                  Open Test IDE
                </Link>
              </div>
            </div>
          ))}

          {(tests || []).length === 0 && (
            <div style={{ border: "1px solid #273341", padding: "12px", background: "#131a22", color: "#8fa1b4" }}>
              No tests found. You can still open a sample IDE at{" "}
              <Link href="/devops/tests/sample/take" style={{ color: "#ff9f1c", textDecoration: "none" }}>
                /devops/tests/sample/take
              </Link>
              .
            </div>
          )}
        </div>
      )}
    </main>
  );
}
