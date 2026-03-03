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

interface EngineLikeResponse {
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  [key: string]: unknown;
}

const EXECUTION_API_BASE =
  process.env.DEVOPS_EXECUTION_API_URL || "http://127.0.0.1:8000";
const LINT_API_BASE = process.env.DEVOPS_LINT_API_URL || "http://127.0.0.1:8002";
const EXECUTION_BASE = EXECUTION_API_BASE.replace(/\/+$/, "").replace(/\/api$/, "");

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

function extractDetail(data: Record<string, unknown>, fallback: string): string {
  const detail = data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) return detail.map((row) => JSON.stringify(row)).join("; ");
  if (detail && typeof detail === "object") return JSON.stringify(detail);
  return fallback;
}

function asEngineResponse(data: Record<string, unknown>): EngineLikeResponse {
  return data as EngineLikeResponse;
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

      let response = await fetch(`${EXECUTION_BASE}/api/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: body.command }),
      });
      if (response.status === 404) {
        response = await fetch(`${EXECUTION_BASE}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: body.command }),
        });
      }
      let data = await safeJsonParse(response);
      // Compatibility fallback for services/cloud engine payload schema
      if (!response.ok && response.status === 422) {
        response = await fetch(`${EXECUTION_BASE}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: `devops-${Date.now()}`,
            mode: "aws",
            command: body.command,
          }),
        });
        data = await safeJsonParse(response);
      }

      if (!response.ok) {
        return res.status(response.status).json({
          ok: false,
          status: "error",
          engine: "execution",
          message: extractDetail(data, "Execution engine request failed"),
        });
      }

      const engineData = asEngineResponse(data);
      return res.status(200).json({
        ok: true,
        status: engineData.exit_code === 0 ? "success" : "error",
        engine: "execution",
        stdout: String(engineData.stdout || ""),
        stderr: String(engineData.stderr || ""),
        exitCode: Number(engineData.exit_code ?? 1),
      });
    }

    if (body.mode === "terraform") {
      const terraformAction = body.terraformAction || "plan";
      const terraformFiles =
        body.terraformFiles && Object.keys(body.terraformFiles).length > 0
          ? body.terraformFiles
          : { "main.tf": "" };

      let response = await fetch(`${EXECUTION_BASE}/api/terraform/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: terraformAction,
          terraform_files: terraformFiles,
          auto_approve: Boolean(body.autoApprove),
        }),
      });
      if (response.status === 404) {
        response = await fetch(`${EXECUTION_BASE}/terraform/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: terraformAction,
            terraform_files: terraformFiles,
            auto_approve: Boolean(body.autoApprove),
          }),
        });
      }
      let data = await safeJsonParse(response);
      // Compatibility fallback for services/cloud engine route/payload
      if (!response.ok && (response.status === 404 || response.status === 422)) {
        response = await fetch(`${EXECUTION_BASE}/execute`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            session_id: `devops-tf-${Date.now()}`,
            mode: "terraform",
            terraform_code: terraformFiles["main.tf"] || "",
            terraform_action: terraformAction,
          }),
        });
        data = await safeJsonParse(response);
      }

      if (!response.ok) {
        return res.status(response.status).json({
          ok: false,
          status: "error",
          engine: "terraform",
          message: extractDetail(data, "Terraform engine request failed"),
        });
      }

      const engineData = asEngineResponse(data);
      return res.status(200).json({
        ok: true,
        status: engineData.exit_code === 0 ? "success" : "error",
        engine: "terraform",
        stdout: String(engineData.stdout || ""),
        stderr: String(engineData.stderr || ""),
        exitCode: Number(engineData.exit_code ?? 1),
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
            message: extractDetail(data, "Lint engine request failed"),
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
