import { useMemo, useState } from "react";

type CloudQuestion = {
  id: string;
  title: string;
  prompt: string;
  starterCommand: string;
  expectedTokens: string[];
};

type RunResult = {
  stdout: string;
  stderr: string;
  exit_code: number;
};

const QUESTIONS: CloudQuestion[] = [
  {
    id: "q1",
    title: "Identity Check",
    prompt:
      "Run an AWS command to verify the active identity in LocalStack. Expected output should include UserId, Account, and Arn.",
    starterCommand: "sts get-caller-identity",
    expectedTokens: ["UserId", "Account", "Arn"],
  },
  {
    id: "q2",
    title: "EC2 Region Discovery",
    prompt:
      "Run a command to list available EC2 regions. The output should contain a Regions array and at least one RegionName.",
    starterCommand: "ec2 describe-regions --region us-east-1",
    expectedTokens: ["Regions", "RegionName"],
  },
];

export default function CloudPlaygroundPage() {
  const [activeId, setActiveId] = useState<string>(QUESTIONS[0].id);
  const [localstackHost, setLocalstackHost] = useState<string>("localstack");
  const [commands, setCommands] = useState<Record<string, string>>(
    Object.fromEntries(QUESTIONS.map((q) => [q.id, q.starterCommand]))
  );
  const [results, setResults] = useState<Record<string, RunResult | null>>(
    Object.fromEntries(QUESTIONS.map((q) => [q.id, null]))
  );
  const [isRunning, setIsRunning] = useState(false);
  const [submitSummary, setSubmitSummary] = useState<string>("");

  const activeQuestion = useMemo(
    () => QUESTIONS.find((question) => question.id === activeId) || QUESTIONS[0],
    [activeId]
  );

  const runCommand = async () => {
    setIsRunning(true);
    setSubmitSummary("");

    try {
      const response = await fetch("/api/cloud-execution/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: `demo-${activeQuestion.id}-${Date.now()}`,
          command: commands[activeQuestion.id] || "",
          localstack_host: localstackHost,
        }),
      });

      const data = (await response.json()) as RunResult & { detail?: string; error?: string };
      if (!response.ok) {
        setResults((prev) => ({
          ...prev,
          [activeQuestion.id]: {
            stdout: "",
            stderr: data.detail || data.error || "Execution failed",
            exit_code: 1,
          },
        }));
        return;
      }

      setResults((prev) => ({ ...prev, [activeQuestion.id]: data }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown client error";
      setResults((prev) => ({
        ...prev,
        [activeQuestion.id]: { stdout: "", stderr: message, exit_code: 1 },
      }));
    } finally {
      setIsRunning(false);
    }
  };

  const submitAll = () => {
    const scoreCard = QUESTIONS.map((question) => {
      const result = results[question.id];
      const hasRun = !!result;
      const successExit = result?.exit_code === 0;
      const output = result?.stdout || "";
      const tokensOk = question.expectedTokens.every((token) => output.includes(token));
      return {
        questionId: question.id,
        passed: hasRun && successExit && tokensOk,
        hasRun,
      };
    });

    const passedCount = scoreCard.filter((item) => item.passed).length;
    const missingRuns = scoreCard.filter((item) => !item.hasRun).length;

    if (missingRuns > 0) {
      setSubmitSummary(
        `Submit blocked: run all questions first (${QUESTIONS.length - missingRuns}/${QUESTIONS.length} completed).`
      );
      return;
    }

    setSubmitSummary(`Submitted. Score: ${passedCount}/${QUESTIONS.length} passed.`);
  };

  const activeResult = results[activeQuestion.id];

  return (
    <main style={{ minHeight: "100vh", background: "#0a0f14", color: "#dce6ef", padding: "20px" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Cloud Command Playground</h1>
        <p style={{ marginTop: "8px", color: "#8da2b8" }}>
          LeetCode-style demo: left panel question, right panel command runner powered by your execution engine.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: "16px", marginTop: "16px" }}>
          <section style={{ border: "1px solid #1f2a35", background: "#111922", borderRadius: "10px", padding: "14px" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Questions</h2>
            <div style={{ display: "grid", gap: "8px", marginBottom: "14px" }}>
              {QUESTIONS.map((question, index) => (
                <button
                  key={question.id}
                  onClick={() => setActiveId(question.id)}
                  style={{
                    textAlign: "left",
                    background: question.id === activeId ? "#1b2632" : "#0e151d",
                    color: "#dce6ef",
                    border: question.id === activeId ? "1px solid #2f4358" : "1px solid #1f2a35",
                    borderRadius: "8px",
                    padding: "10px",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "0.75rem", color: "#91a8bf" }}>Question {index + 1}</div>
                  <div>{question.title}</div>
                </button>
              ))}
            </div>

            <h3 style={{ marginBottom: "8px", fontSize: "1rem" }}>{activeQuestion.title}</h3>
            <p style={{ marginTop: 0, color: "#9cb1c6", lineHeight: 1.5 }}>{activeQuestion.prompt}</p>
            <div style={{ color: "#8ca3ba", fontSize: "0.85rem" }}>
              Expected tokens: {activeQuestion.expectedTokens.join(", ")}
            </div>
          </section>

          <section style={{ border: "1px solid #1f2a35", background: "#111922", borderRadius: "10px", padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", color: "#9cb1c6" }}>
                LocalStack Host
                <input
                  value={localstackHost}
                  onChange={(e) => setLocalstackHost(e.target.value)}
                  style={{
                    background: "#0d141b",
                    border: "1px solid #263443",
                    borderRadius: "6px",
                    color: "#dce6ef",
                    padding: "6px 8px",
                  }}
                />
              </label>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={runCommand}
                  disabled={isRunning}
                  style={{
                    border: "1px solid #2b6cb0",
                    background: "#184b7a",
                    color: "#e6f3ff",
                    borderRadius: "6px",
                    padding: "7px 14px",
                    cursor: "pointer",
                  }}
                >
                  {isRunning ? "Running..." : "Run"}
                </button>
                <button
                  onClick={submitAll}
                  disabled={isRunning}
                  style={{
                    border: "1px solid #2f855a",
                    background: "#1f6f46",
                    color: "#e8fff1",
                    borderRadius: "6px",
                    padding: "7px 14px",
                    cursor: "pointer",
                  }}
                >
                  Submit
                </button>
              </div>
            </div>

            <textarea
              value={commands[activeQuestion.id] || ""}
              onChange={(e) =>
                setCommands((prev) => ({
                  ...prev,
                  [activeQuestion.id]: e.target.value,
                }))
              }
              spellCheck={false}
              style={{
                width: "100%",
                minHeight: "120px",
                resize: "vertical",
                borderRadius: "8px",
                border: "1px solid #263443",
                background: "#0b1219",
                color: "#dce6ef",
                fontFamily: "JetBrains Mono, monospace",
                padding: "10px",
              }}
            />

            <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "#8da2b8", marginBottom: "5px" }}>STDOUT</div>
                <pre
                  style={{
                    margin: 0,
                    minHeight: "110px",
                    maxHeight: "220px",
                    overflow: "auto",
                    background: "#0b1219",
                    border: "1px solid #233140",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "#bfecce",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {activeResult?.stdout || "(empty)"}
                </pre>
              </div>

              <div>
                <div style={{ fontSize: "0.75rem", color: "#8da2b8", marginBottom: "5px" }}>STDERR / Logs</div>
                <pre
                  style={{
                    margin: 0,
                    minHeight: "110px",
                    maxHeight: "220px",
                    overflow: "auto",
                    background: "#0b1219",
                    border: "1px solid #233140",
                    borderRadius: "8px",
                    padding: "10px",
                    color: "#f2c2c2",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {activeResult?.stderr || "(empty)"}
                </pre>
              </div>
            </div>

            <div style={{ marginTop: "10px", color: "#8da2b8" }}>
              Exit code: {typeof activeResult?.exit_code === "number" ? activeResult.exit_code : "-"}
            </div>

            {submitSummary && (
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px",
                  borderRadius: "8px",
                  border: "1px solid #304154",
                  background: "#0f1822",
                  color: "#d7e8f9",
                }}
              >
                {submitSummary}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

