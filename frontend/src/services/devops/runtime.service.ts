import apiClient from "../api/client";

export type DevOpsRunMode = "command" | "terraform" | "lint";
export type DevOpsLintType = "docker" | "kubernetes" | "github_actions";
export type TerraformAction = "init" | "plan" | "apply" | "destroy";

export interface DevOpsRunPayload {
  mode: DevOpsRunMode;
  command?: string;
  session_id?: string;
  sessionId?: string;
  testId?: string;
  candidateId?: string;
  terraformAction?: TerraformAction;
  terraformFiles?: Record<string, string>;
  autoApprove?: boolean;
  lintType?: DevOpsLintType;
  content?: string;
}

export interface DevOpsRunResult {
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

export const devopsRuntimeService = {
  run: async (payload: DevOpsRunPayload): Promise<DevOpsRunResult> => {
    const response = await apiClient.post<DevOpsRunResult>("/api/devops/run", payload);
    return response.data;
  },
  resetSession: async (sessionId: string): Promise<{ ok: boolean; message?: string }> => {
    const response = await apiClient.post<{ ok: boolean; message?: string }>("/api/devops/reset-session", {
      session_id: sessionId,
      sessionId,
    });
    return response.data;
  },
};
