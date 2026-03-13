import type { NextApiRequest, NextApiResponse } from "next";

type RunMode = "command" | "terraform" | "lint";
type LintType = "docker" | "kubernetes" | "github_actions";

interface RunRequestBody {
  mode: RunMode;
  command?: string;
  session_id?: string;
  sessionId?: string;
  testId?: string;
  candidateId?: string;
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
  sessionId?: string;
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
  session_id?: string;
  sessionId?: string;
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  exitCode?: number;
  code?: number;
  status_code?: number;
  status?: string;
  success?: boolean;
  output?: string;
  error?: string;
  result?: string;
  [key: string]: unknown;
}

function normalizeCommandInput(raw: string): string {
  let command = String(raw || "").trim();
  command = command.replace(/^(?:\$\s+|#\s+|PS>\s+)/i, "");
  command = command.replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim();
  return command;
}

function sanitizeTokenPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 80);
}

function readCookie(req: NextApiRequest, key: string): string | null {
  const cookieHeader = req.headers.cookie || "";
  if (!cookieHeader) return null;
  const rows = cookieHeader.split(";").map((row) => row.trim());
  for (const row of rows) {
    const idx = row.indexOf("=");
    if (idx <= 0) continue;
    const name = row.slice(0, idx).trim();
    if (name !== key) continue;
    const value = row.slice(idx + 1).trim();
    try {
      return decodeURIComponent(value || "");
    } catch {
      return value || "";
    }
  }
  return null;
}

function generateSessionId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const rand = Math.random() * 16;
    const value = ch === "x" ? rand : (rand % 4) + 8;
    return Math.floor(value).toString(16);
  });
}

function resolveExecutionSessionId(req: NextApiRequest, body: RunRequestBody): {
  sessionId: string;
  setCookie: boolean;
} {
  const querySession = Array.isArray(req.query.session_id)
    ? req.query.session_id[0]
    : req.query.session_id || req.query.sessionId;
  const headerSession = req.headers["x-session-id"];
  const explicit = String(
    body.session_id ||
      body.sessionId ||
      querySession ||
      (Array.isArray(headerSession) ? headerSession[0] : headerSession) ||
      ""
  ).trim();
  if (explicit) return { sessionId: explicit, setCookie: false };

  const cookieSession = readCookie(req, "cloud_exec_session_id");
  if (cookieSession) return { sessionId: cookieSession, setCookie: false };

  const generated = generateSessionId();
  return { sessionId: generated, setCookie: true };
}

function normalizeExecutionResponse(data: EngineLikeResponse): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  const asText = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      return value
        .map((row) => (typeof row === "string" ? row : JSON.stringify(row)))
        .join("\n");
    }
    if (value && typeof value === "object") return JSON.stringify(value);
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return "";
  };

  const stdout = asText(data.stdout) || asText(data.output) || asText(data.result);
  const stderr = asText(data.stderr) || asText(data.error);

  const explicitExit =
    typeof data.exit_code === "number"
      ? data.exit_code
      : typeof data.exitCode === "number"
        ? data.exitCode
        : typeof data.code === "number"
          ? data.code
          : typeof data.status_code === "number"
            ? data.status_code
          : null;

  if (explicitExit !== null) {
    return { stdout, stderr, exitCode: explicitExit };
  }

  const status = String(data.status || "").toLowerCase();
  if (data.success === true || ["ok", "success", "passed"].includes(status)) {
    return { stdout, stderr, exitCode: 0 };
  }
  if (data.success === false || ["error", "failed", "failure"].includes(status)) {
    return { stdout, stderr, exitCode: 1 };
  }

  if (stderr.trim()) {
    return { stdout, stderr, exitCode: 1 };
  }
  return { stdout, stderr, exitCode: 0 };
}

const EXECUTION_API_BASE =
  process.env.DEVOPS_EXECUTION_API_URL || process.env.CLOUD_EXECUTION_API_URL || "http://127.0.0.1:8010";
const COMMAND_EXECUTION_URL = "http://103.173.99.254:4040/execute";
const LINT_API_BASE =
  process.env.DEVOPS_LINT_API_URL || process.env.CLOUD_LINT_API_URL || "http://127.0.0.1:8002";
const EXECUTION_BASES = Array.from(
  new Set(
    [
      EXECUTION_API_BASE,
      "http://127.0.0.1:8010",
      "http://localhost:8010",
      "http://127.0.0.1:8000",
      "http://localhost:8000",
    ].map((v) => v.replace(/\/+$/, "").replace(/\/api$/, ""))
  )
);

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
  const text = await response.text();
  if (!text.trim()) return {};

  if (contentType.includes("application/json")) {
    return JSON.parse(text) as Record<string, unknown>;
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { detail: text };
  }
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

function resolveReturnedSessionId(data: EngineLikeResponse, fallback: string): string {
  const raw = data.session_id || data.sessionId;
  const parsed = typeof raw === "string" ? raw.trim() : "";
  return parsed || fallback;
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
      const normalizedCommand = normalizeCommandInput(body.command || "");
      const { sessionId: executionSessionId, setCookie } = resolveExecutionSessionId(req, body);
      if (!normalizedCommand) {
        return res.status(400).json({
          ok: false,
          status: "error",
          engine: "execution",
          message: "Command is required for mode=command",
        });
      }
      if (setCookie) {
        res.setHeader(
          "Set-Cookie",
          `cloud_exec_session_id=${encodeURIComponent(executionSessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
        );
      }

      let response: Response;
      let data: Record<string, unknown> = {};
      const commandForExecution = normalizedCommand;
      try {
        response = await fetch(COMMAND_EXECUTION_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Session-ID": executionSessionId,
            "X-Session-Id": executionSessionId,
          },
          body: JSON.stringify({
            session_id: executionSessionId,
            sessionId: executionSessionId,
            cmd: commandForExecution,
          }),
        });
        data = await safeJsonParse(response);
      } catch (err: any) {
        const lastError = err?.message || String(err);
        return res.status(503).json({
          ok: false,
          status: "error",
          engine: "execution",
          message: `Execution engine unreachable at ${COMMAND_EXECUTION_URL}. Last error: ${lastError}`,
        });
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
      const normalized = normalizeExecutionResponse(engineData);
      const resolvedSessionId = resolveReturnedSessionId(engineData, executionSessionId);
      return res.status(200).json({
        ok: true,
        status: normalized.exitCode === 0 ? "success" : "error",
        engine: "execution",
        sessionId: resolvedSessionId,
        stdout: normalized.stdout,
        stderr: normalized.stderr,
        exitCode: normalized.exitCode,
      });
    }

    if (body.mode === "terraform") {
      const terraformAction = body.terraformAction || "plan";
      const terraformFiles =
        body.terraformFiles && Object.keys(body.terraformFiles).length > 0
          ? body.terraformFiles
          : { "main.tf": "" };

      let response: Response | null = null;
      let data: Record<string, unknown> = {};
      let lastError = "";
      for (const base of EXECUTION_BASES) {
        try {
          response = await fetch(`${base}/api/terraform/execute`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: terraformAction,
              terraform_files: terraformFiles,
              auto_approve: Boolean(body.autoApprove),
            }),
          });
          if (response.status === 404) {
            response = await fetch(`${base}/terraform/execute`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                action: terraformAction,
                terraform_files: terraformFiles,
                auto_approve: Boolean(body.autoApprove),
              }),
            });
          }
          data = await safeJsonParse(response);
          if (response.ok) break;
          if (response.status === 404 || response.status === 422) {
            response = await fetch(`${base}/execute`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                session_id: `cloud-tf-${Date.now()}`,
                mode: "terraform",
                terraform_code: terraformFiles["main.tf"] || "",
                terraform_action: terraformAction,
              }),
            });
            data = await safeJsonParse(response);
            if (response.ok) break;
          }
        } catch (err: any) {
          lastError = err?.message || String(err);
          response = null;
        }
      }

      if (!response) {
        return res.status(503).json({
          ok: false,
          status: "error",
          engine: "terraform",
          message: `Terraform engine unreachable. Tried: ${EXECUTION_BASES.join(", ")}. Last error: ${lastError}`,
        });
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
    const errorMessage = error instanceof Error ? error.message : "Unexpected error while running Cloud task";
    return res.status(500).json({
      ok: false,
      status: "error",
      engine: body.mode === "lint" ? "lint" : body.mode === "terraform" ? "terraform" : "execution",
      message: errorMessage,
    });
  }
}
