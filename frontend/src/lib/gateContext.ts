export type GateFlowType = "ai" | "dsa" | "custom-mcq" | "aiml";

export interface GateContext {
  flowType: GateFlowType;
  assessmentId: string;
  token: string;
  candidateEmail?: string;
  candidateName?: string;
  candidateUserId?: string;
  /**
   * Where to send the candidate if they don't have a session (missing candidateEmail/name).
   * Example: `/test/${id}?token=...` or `/custom-mcq/entry/${id}?token=...`
   */
  entryUrl?: string;
  /**
   * Where to send the candidate after completing identity verification.
   * Example: `/test/${id}/take?...` or `/custom-mcq/take/${id}?token=...`
   */
  finalTakeUrl?: string;
}

const keyFor = (assessmentId: string) => `gateContext_${assessmentId}`;

export function setGateContext(ctx: GateContext) {
  if (typeof window === "undefined") return;
  if (!ctx?.assessmentId) return;
  try {
    sessionStorage.setItem(keyFor(ctx.assessmentId), JSON.stringify(ctx));
  } catch {
    // ignore
  }
}

export function getGateContext(assessmentId: string | null | undefined): GateContext | null {
  if (typeof window === "undefined") return null;
  if (!assessmentId) return null;
  try {
    const raw = sessionStorage.getItem(keyFor(assessmentId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GateContext;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearGateContext(assessmentId: string | null | undefined) {
  if (typeof window === "undefined") return;
  if (!assessmentId) return;
  try {
    sessionStorage.removeItem(keyFor(assessmentId));
  } catch {
    // ignore
  }
}


