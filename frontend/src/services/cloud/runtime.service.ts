import apiClient from "../api/client";

export type CloudRunMode = "command" | "terraform" | "lint";
export type CloudLintType = "docker" | "kubernetes" | "github_actions";
export type TerraformAction = "init" | "plan" | "apply" | "destroy";

export interface CloudRunPayload {
  mode: CloudRunMode;
  command?: string;
  session_id?: string;
  sessionId?: string;
  testId?: string;
  candidateId?: string;
  terraformAction?: TerraformAction;
  terraformFiles?: Record<string, string>;
  autoApprove?: boolean;
  lintType?: CloudLintType;
  content?: string;
}

export interface CloudRunResult {
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

export const cloudRuntimeService = {
  run: async (payload: CloudRunPayload): Promise<CloudRunResult> => {
    const response = await apiClient.post<CloudRunResult>("/api/cloud/run", payload);
    return response.data;
  },
  resetSession: async (sessionId: string): Promise<{ ok: boolean; message?: string }> => {
    const response = await apiClient.post<{ ok: boolean; message?: string }>("/api/cloud/reset-session", {
      session_id: sessionId,
      sessionId,
    });
    return response.data;
  },
};

