import apiClient from "../api/client";

export type DevOpsRunMode = "command" | "terraform" | "lint";
export type DevOpsLintType = "docker" | "kubernetes" | "github_actions";
export type TerraformAction = "init" | "plan" | "apply" | "destroy";

export interface DevOpsRunPayload {
  mode: DevOpsRunMode;
  command?: string;
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
};
