import { useMemo, useState } from "react";

type CloudQuestion = {
  id: string;
  title: string;
  prompt: string;
  starterCommand: string;
  rightCommand: string;
  mode: "aws" | "terraform";
  terraformAction?: "init" | "plan" | "apply" | "destroy" | "validate";
};

type RunResult = {
  exit_code: number;
};

type TaskResult = {
  hasRun: boolean;
  passed: boolean;
  message: string;
};

const QUESTIONS: CloudQuestion[] = [
  {
    id: "q1",
    title: "Identity Check",
    prompt:
      "Task 1: Verify active identity in LocalStack.",
    starterCommand: "sts get-caller-identity",
    rightCommand: "sts get-caller-identity",
    mode: "aws",
  },
  {
    id: "q2",
    title: "EC2 Region Discovery",
    prompt:
      "Task 2: List EC2 regions in us-east-1.",
    starterCommand: "ec2 describe-regions --region us-east-1",
    rightCommand: "ec2 describe-regions --region us-east-1",
    mode: "aws",
  },
  {
    id: "q3",
    title: "Terraform Validate",
    prompt: "Task 3: Submit the exact Terraform configuration and run validate.",
    starterCommand: 'terraform { required_version = ">= 1.3.0" }',
    rightCommand: 'terraform { required_version = ">= 1.3.0" }',
    mode: "terraform",
    terraformAction: "validate",
  },
];

function normalizeCommand(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

function isCloudCommand(input: string): boolean {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return false;
  const cloudPrefixes = ["sts ", "ec2 ", "s3 ", "iam ", "lambda ", "dynamodb ", "cloudformation "];
  return cloudPrefixes.some((prefix) => trimmed.startsWith(prefix));
}

function normalizeTerraformCode(input: string): string {
  return input.trim().replace(/\s+/g, " ").toLowerCase();
}

export default function CloudPlaygroundPage() {
  const [activeId, setActiveId] = useState<string>(QUESTIONS[0].id);
  const localstackHost = "localstack";
  const [commands, setCommands] = useState<Record<string, string>>(
    Object.fromEntries(QUESTIONS.map((q) => [q.id, q.starterCommand]))
  );
  const [results, setResults] = useState<Record<string, TaskResult>>(
    Object.fromEntries(QUESTIONS.map((q) => [q.id, { hasRun: false, passed: false, message: "" }]))
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
    const currentCommand = commands[activeQuestion.id] || "";

    if (activeQuestion.mode === "aws" && !isCloudCommand(currentCommand)) {
      setResults((prev) => ({
        ...prev,
        [activeQuestion.id]: {
          hasRun: true,
          passed: false,
          message: "Command could not run.",
        },
      }));
      setIsRunning(false);
      return;
    }

    const inputMatches =
      activeQuestion.mode === "aws"
        ? normalizeCommand(currentCommand) === normalizeCommand(activeQuestion.rightCommand)
        : normalizeTerraformCode(currentCommand) === normalizeTerraformCode(activeQuestion.rightCommand);

    if (!inputMatches) {
      setResults((prev) => ({
        ...prev,
        [activeQuestion.id]: {
          hasRun: true,
          passed: false,
          message: "Command could not run.",
        },
      }));
      setIsRunning(false);
      return;
    }

    try {
      const response = await fetch("/api/cloud-execution/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          activeQuestion.mode === "aws"
            ? {
                session_id: `demo-${activeQuestion.id}-${Date.now()}`,
                mode: "aws",
                command: currentCommand,
                localstack_host: localstackHost,
              }
            : {
                session_id: `demo-${activeQuestion.id}-${Date.now()}`,
                mode: "terraform",
                terraform_action: activeQuestion.terraformAction || "validate",
                terraform_code: currentCommand,
              }
        ),
      });

      const data = (await response.json()) as RunResult & { detail?: string; error?: string };
      if (!response.ok) {
        setResults((prev) => ({
          ...prev,
          [activeQuestion.id]: {
            hasRun: true,
            passed: false,
            message: "Command could not run.",
          },
        }));
        return;
      }

      setResults((prev) => ({
        ...prev,
        [activeQuestion.id]: {
          hasRun: true,
          passed: data.exit_code === 0,
          message: data.exit_code === 0 ? "Command run successful." : "Command could not run.",
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown client error";
      setResults((prev) => ({
        ...prev,
        [activeQuestion.id]: { hasRun: true, passed: false, message: message ? "Command could not run." : "" },
      }));
    } finally {
      setIsRunning(false);
    }
  };

  const submitAll = () => {
    const scoreCard = QUESTIONS.map((question) => results[question.id]);

    const passedCount = scoreCard.filter((item) => item.passed).length;
    const missingRuns = scoreCard.filter((item) => !item.hasRun).length;

    if (missingRuns > 0) {
      setSubmitSummary(
        `Submit blocked: run all tasks first (${QUESTIONS.length - missingRuns}/${QUESTIONS.length} completed).`
      );
      return;
    }

    if (passedCount === QUESTIONS.length) {
      setSubmitSummary("All tasks submitted successfully.");
      return;
    }

    setSubmitSummary(`Whole submission completed. Result: ${passedCount}/${QUESTIONS.length} tasks passed.`);
  };

  const activeResult = results[activeQuestion.id];

  return (
    <main style={{ minHeight: "100vh", background: "#0a0f14", color: "#dce6ef", padding: "20px" }}>
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontSize: "1.8rem" }}>Cloud Command Playground</h1>
        <p style={{ marginTop: "8px", color: "#8da2b8" }}>
          Task-based cloud command runner. Each task requires one exact valid cloud command.
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
                  <div style={{ marginTop: "4px", fontSize: "0.75rem", color: results[question.id]?.passed ? "#7ae7a2" : "#9db4c8" }}>
                    {results[question.id]?.hasRun
                      ? results[question.id]?.passed
                        ? "Passed"
                        : "Failed"
                      : "Not Run"}
                  </div>
                </button>
              ))}
            </div>

            <h3 style={{ marginBottom: "8px", fontSize: "1rem" }}>{activeQuestion.title}</h3>
            <p style={{ marginTop: 0, color: "#9cb1c6", lineHeight: 1.5 }}>{activeQuestion.prompt}</p>
            <div style={{ color: "#8ca3ba", fontSize: "0.85rem" }}>
              Required {activeQuestion.mode === "terraform" ? "Terraform code" : "command"}: <code>{activeQuestion.rightCommand}</code>
            </div>
          </section>

          <section style={{ border: "1px solid #1f2a35", background: "#111922", borderRadius: "10px", padding: "14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "10px", flexWrap: "wrap" }}>
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
                <div style={{ fontSize: "0.75rem", color: "#8da2b8", marginBottom: "5px" }}>Run Status</div>
                <pre
                  style={{
                    margin: 0,
                    minHeight: "80px",
                    background: "#0b1219",
                    border: "1px solid #233140",
                    borderRadius: "8px",
                    padding: "10px",
                    color: activeResult?.passed ? "#7ae7a2" : "#f2c2c2",
                    fontFamily: "JetBrains Mono, monospace",
                  }}
                >
                  {activeResult?.message || "(run a command)"}
                </pre>
              </div>
            </div>

            <div style={{ marginTop: "10px", color: "#8da2b8" }}>
              Output logs hidden in demo mode.
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

