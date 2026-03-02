import type { NextApiRequest, NextApiResponse } from "next";

type RunMode = "command" | "terraform" | "lint";
type LintType = "docker" | "kubernetes" | "github_actions";

interface RunRequestBody {
  mode: RunMode;
  command?: string;
  terraformAction?: "init" | "plan" | "apply" | "destroy";
  terraformFiles?: Record<string, string>;
  autoApprove?: boolean;
  lintType?: LintType;
  content?: string;
}

interface UnifiedRunResponse {
  ok: boolean;
  status: "success" | "error";
  engine: "execution" | "terraform" | "lint";
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  lintStatus?: string;
  lintScore?: number;
  lintErrors?: string[];
  lintWarnings?: string[];
  message?: string;
}

const EXECUTION_API_BASE =
  process.env.DEVOPS_EXECUTION_API_URL || "http://127.0.0.1:8000";
const LINT_API_BASE = process.env.DEVOPS_LINT_API_URL || "http://127.0.0.1:8002";

function lintGithubActionsFallback(content: string): {
  status: "passed" | "failed";
  errors: string[];
  warnings: string[];
  score: number;
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  const hasName = /^\s*name\s*:/m.test(content);
  const hasOn = /^\s*on\s*:/m.test(content);
  const hasJobs = /^\s*jobs\s*:/m.test(content);

  if (!hasName) errors.push("Missing top-level 'name' field.");
  if (!hasOn) errors.push("Missing top-level 'on' trigger block.");
  if (!hasJobs) errors.push("Missing top-level 'jobs' block.");

  const hasUsesCheckout = /uses\s*:\s*actions\/checkout@/m.test(content);
  if (!hasUsesCheckout) warnings.push("Recommended: include 'actions/checkout' in workflow steps.");

  const hasRunsOn = /^\s*runs-on\s*:/m.test(content);
  if (!hasRunsOn) errors.push("Missing 'runs-on' for job execution environment.");

  const hasSteps = /^\s*steps\s*:/m.test(content);
  if (!hasSteps) errors.push("Missing job 'steps' block.");

  const score = Math.max(0, 100 - errors.length * 20 - warnings.length * 5);
  return {
    status: errors.length === 0 ? "passed" : "failed",
    errors,
    warnings,
    score,
  };
}

async function safeJsonParse(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await response.text();
    return { detail: text };
  }
  return response.json();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UnifiedRunResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      status: "error",
      engine: "execution",
      message: "Method not allowed",
    });
  }

  const body = req.body as RunRequestBody;
  if (!body?.mode) {
    return res.status(400).json({
      ok: false,
      status: "error",
      engine: "execution",
      message: "Missing mode",
    });
  }

  try {
    if (body.mode === "command") {
      if (!body.command?.trim()) {
        return res.status(400).json({
          ok: false,
          status: "error",
          engine: "execution",
          message: "Command is required for mode=command",
        });
      }

      const response = await fetch(`${EXECUTION_API_BASE}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: body.command }),
      });
      const data = await safeJsonParse(response);

      if (!response.ok) {
        return res.status(response.status).json({
          ok: false,
          status: "error",
          engine: "execution",
          message: data?.detail || "Execution engine request failed",
        });
      }

      return res.status(200).json({
        ok: true,
        status: data.exit_code === 0 ? "success" : "error",
        engine: "execution",
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        exitCode: Number(data.exit_code ?? 1),
      });
    }

    if (body.mode === "terraform") {
      const terraformAction = body.terraformAction || "plan";
      const terraformFiles =
        body.terraformFiles && Object.keys(body.terraformFiles).length > 0
          ? body.terraformFiles
          : { "main.tf": "" };

      const response = await fetch(`${EXECUTION_API_BASE}/api/terraform/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: terraformAction,
          terraform_files: terraformFiles,
          auto_approve: Boolean(body.autoApprove),
        }),
      });
      const data = await safeJsonParse(response);

      if (!response.ok) {
        return res.status(response.status).json({
          ok: false,
          status: "error",
          engine: "terraform",
          message: data?.detail || "Terraform engine request failed",
        });
      }

      return res.status(200).json({
        ok: true,
        status: data.exit_code === 0 ? "success" : "error",
        engine: "terraform",
        stdout: data.stdout || "",
        stderr: data.stderr || "",
        exitCode: Number(data.exit_code ?? 1),
      });
    }

    if (body.mode === "lint") {
      if (!body.lintType || !body.content?.trim()) {
        return res.status(400).json({
          ok: false,
          status: "error",
          engine: "lint",
          message: "lintType and content are required for mode=lint",
        });
      }

      try {
        const response = await fetch(`${LINT_API_BASE}/api/devops/lint`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lint_type: body.lintType,
            content: body.content,
          }),
        });
        const data = await safeJsonParse(response);

        if (!response.ok) {
          if (body.lintType === "github_actions") {
            const fallback = lintGithubActionsFallback(body.content);
            return res.status(200).json({
              ok: true,
              status: fallback.status === "passed" ? "success" : "error",
              engine: "lint",
              lintStatus: fallback.status,
              lintScore: fallback.score,
              lintErrors: fallback.errors,
              lintWarnings: [
                ...fallback.warnings,
                `Lint service returned ${response.status}; used built-in GitHub Actions fallback checks.`,
              ],
            });
          }

          return res.status(response.status).json({
            ok: false,
            status: "error",
            engine: "lint",
            message: data?.detail || "Lint engine request failed",
          });
        }

        return res.status(200).json({
          ok: true,
          status: data.status === "passed" ? "success" : "error",
          engine: "lint",
          lintStatus: data.status,
          lintScore: Number(data.score ?? 0),
          lintErrors: Array.isArray(data.errors) ? data.errors : [],
          lintWarnings: Array.isArray(data.warnings) ? data.warnings : [],
        });
      } catch {
        if (body.lintType === "github_actions") {
          const fallback = lintGithubActionsFallback(body.content);
          return res.status(200).json({
            ok: true,
            status: fallback.status === "passed" ? "success" : "error",
            engine: "lint",
            lintStatus: fallback.status,
            lintScore: fallback.score,
            lintErrors: fallback.errors,
            lintWarnings: [
              ...fallback.warnings,
              `Lint service unavailable at ${LINT_API_BASE}; used built-in GitHub Actions fallback checks.`,
            ],
          });
        }

        return res.status(503).json({
          ok: false,
          status: "error",
          engine: "lint",
          message: `Lint service unavailable at ${LINT_API_BASE}`,
        });
      }
    }

    return res.status(400).json({
      ok: false,
      status: "error",
      engine: "execution",
      message: "Unsupported mode",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unexpected error while running DevOps task";
    return res.status(500).json({
      ok: false,
      status: "error",
      engine: body.mode === "lint" ? "lint" : body.mode === "terraform" ? "terraform" : "execution",
      message: errorMessage,
    });
  }
}
