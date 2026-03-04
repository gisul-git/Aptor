import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import { AnimatePresence, motion } from "framer-motion";
import { IBM_Plex_Serif, JetBrains_Mono } from "next/font/google";
import styles from "./take.module.css";
import { useDevOpsTest } from "@/hooks/api/useDevOps";
import type { DevOpsRunPayload, DevOpsRunResult } from "@/services/devops";
import { devopsRuntimeService } from "@/services/devops";
import {
  useUniversalProctoring,
  resolveUserIdForProctoring,
  type ProctoringViolation,
} from "@/universal-proctoring";
import WebcamPreview from "@/components/WebcamPreview";
import { FullscreenLockOverlay } from "@/components/FullscreenLockOverlay";
import { useFullscreenLock } from "@/hooks/proctoring/useFullscreenLock";
import { useActivityPatternProctor } from "@/hooks/proctoring/useActivityPatternProctor";
import { ViolationToast, pushViolationToast } from "@/components/ViolationToast";
import type { GeneratedDevOpsPayload } from "@/lib/devops/ai-question-generator";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

const headingFont = IBM_Plex_Serif({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-devops-heading",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-devops-mono",
});

type QuestionKind = "command" | "terraform" | "lint";
type Difficulty = "easy" | "medium" | "hard";
type LintType = "docker" | "kubernetes" | "github_actions";

interface RuntimeQuestion {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  points: number;
  kind: QuestionKind;
  starterCode: string;
  validationMode?: "runtime" | "content" | "hybrid";
  expectedSubmissionContains?: string[];
  expectedSubmissionRegex?: string;
  forbiddenSubmissionRegex?: string;
  expectedExitCode?: number;
  expectedStdoutContains?: string;
  expectedStdoutRegex?: string;
  forbiddenStderrRegex?: string;
  terraformAction?: "init" | "plan" | "apply" | "destroy";
  lintType?: LintType;
  minLintScore?: number;
  instructions: string[];
  constraints: string[];
  hints: string[];
}

interface QuestionAttempt {
  runCount: number;
  passed: boolean;
  score: number;
  reasons: string[];
  lastRun: DevOpsRunResult | null;
}

interface TerminalLine {
  type: "cmd" | "stdout" | "stderr" | "success" | "error";
  text: string;
}

interface SubmissionSummary {
  totalScore: number;
  maxScore: number;
  passedCount: number;
  totalCount: number;
}

const SAMPLE_QUESTIONS: RuntimeQuestion[] = [
  {
    id: "scenario-docker-node-fix",
    title: "Scenario: Node.js Docker startup failure",
    description:
      "A Node.js app fails to start in Docker with `Error: Cannot find module 'express'`. Fix the Dockerfile so dependencies install during build and the app starts.",
    difficulty: "easy",
    points: 35,
    kind: "lint",
    lintType: "docker",
    minLintScore: 80,
    validationMode: "content",
    starterCode:
      "FROM node:18\nWORKDIR /app\nCOPY . .\nEXPOSE 3000\nCMD [\"node\", \"app.js\"]\n",
    expectedSubmissionContains: [
      "FROM node:18",
      "WORKDIR /app",
      "COPY package*.json ./",
      "RUN npm install",
      "COPY . .",
      "EXPOSE 3000",
      "CMD [\"node\", \"app.js\"]",
    ],
    instructions: [
      "Identify why the container fails before app startup.",
      "Fix the Dockerfile to install dependencies in a cache-friendly order.",
      "Keep a runnable entrypoint for the Node app.",
    ],
    constraints: ["Use Dockerfile syntax only.", "Do not add unnecessary build stages."],
    hints: ["`COPY package*.json ./` should come before installing dependencies."],
  },
  {
    id: "scenario-runtime-inspection",
    title: "Scenario: Investigate unhealthy container",
    description:
      "Operations reports a container is flapping. Write one command that lists container names and status for triage.",
    difficulty: "easy",
    points: 30,
    kind: "command",
    starterCode: "docker ps --format '{{.Names}}\\t{{.Status}}'",
    validationMode: "hybrid",
    expectedSubmissionRegex: "^\\s*docker\\s+ps\\b.*--format\\s+['\\\"][^'\\\"]*\\{\\{\\.Names\\}\\}[^'\\\"]*\\{\\{\\.Status\\}\\}[^'\\\"]*['\\\"]\\s*$",
    expectedExitCode: 0,
    expectedStdoutRegex: ".+",
    instructions: [
      "Use one non-interactive shell command.",
      "Output must include both name and status.",
    ],
    constraints: ["No grep/awk required.", "Command must run in the sandbox runtime."],
    hints: ["`docker ps --format` is enough."],
  },
  {
    id: "scenario-terraform-plan",
    title: "Scenario: Validate infra change before apply",
    description: "Write minimal Terraform that can run `plan` successfully.",
    difficulty: "medium",
    points: 35,
    kind: "terraform",
    terraformAction: "plan",
    validationMode: "runtime",
    starterCode:
      'terraform {\n  required_version = ">= 1.3.0"\n}\n\nresource "null_resource" "example" {}\n',
    expectedExitCode: 0,
    instructions: [
      "Use the editor as `main.tf` content.",
      "The action is fixed to `plan`.",
    ],
    constraints: ["Do not add provider credentials.", "Keep config deterministic."],
    hints: ["A `null_resource` is sufficient here."],
  },
  {
    id: "scenario-lint-workflow",
    title: "Scenario: Harden CI workflow file",
    description: "Fix the GitHub Actions workflow so linting standards pass.",
    difficulty: "medium",
    points: 30,
    kind: "lint",
    lintType: "github_actions",
    minLintScore: 90,
    validationMode: "runtime",
    starterCode:
      "name: CI\non: [push]\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \"todo\"\n",
    instructions: [
      "Use the lint engine endpoint through Run.",
      "Improve workflow structure and action usage to pass checks.",
    ],
    constraints: ["Content must be valid GitHub Actions YAML."],
    hints: ["Use `actions/checkout` and explicit steps."],
  },
];

function normalizeDifficulty(value: unknown): Difficulty {
  if (value === "easy" || value === "medium" || value === "hard") return value;
  return "medium";
}

function pickKind(raw: Record<string, unknown>): QuestionKind {
  const explicitKind = String(raw.kind || raw.type || "").toLowerCase();
  if (explicitKind === "command" || explicitKind === "terraform" || explicitKind === "lint") {
    return explicitKind;
  }

  const title = String(raw.title || "").toLowerCase();
  const description = String(raw.description || "").toLowerCase();
  const combined = `${title} ${description}`;
  if (combined.includes("terraform")) return "terraform";
  if (
    combined.includes("dockerfile") ||
    combined.includes("kubernetes") ||
    combined.includes("github actions") ||
    combined.includes("lint")
  ) {
    return "lint";
  }
  return "command";
}

function normalizeLintType(raw: Record<string, unknown>): LintType {
  const value = String(raw.lintType || raw.lint_type || "").toLowerCase();
  if (value === "docker" || value === "kubernetes" || value === "github_actions") return value;

  const title = String(raw.title || "").toLowerCase();
  const description = String(raw.description || "").toLowerCase();
  const combined = `${title} ${description}`;
  if (combined.includes("kubernetes")) return "kubernetes";
  if (combined.includes("github actions")) return "github_actions";
  return "docker";
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const rows = value.filter((item): item is string => typeof item === "string");
  return rows.length > 0 ? rows : fallback;
}

function hashSeed(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash || 1;
}

function pickRandomizedQuestions(pool: RuntimeQuestion[], seedText: string, count = 3): RuntimeQuestion[] {
  const seeded = hashSeed(seedText);
  const ranked = [...pool]
    .map((question, idx) => ({
      question,
      rank: hashSeed(`${seeded}:${question.id}:${idx}`),
    }))
    .sort((a, b) => a.rank - b.rank)
    .map((row) => row.question);
  return ranked.slice(0, Math.min(count, ranked.length));
}

function buildRuntimeQuestions(rawQuestions: Array<Record<string, unknown>>): RuntimeQuestion[] {
  return rawQuestions.map((raw, index) => {
    const kind = pickKind(raw);
    const lintType = kind === "lint" ? normalizeLintType(raw) : undefined;

    const starterFromPayload =
      typeof raw.starterCode === "string"
        ? raw.starterCode
        : typeof raw.template === "string"
          ? raw.template
          : typeof raw.starter_command === "string"
            ? raw.starter_command
            : "";

    const defaultStarter =
      kind === "terraform"
        ? 'terraform {\n  required_version = ">= 1.3.0"\n}\n\nresource "null_resource" "example" {}\n'
        : kind === "lint"
          ? lintType === "kubernetes"
            ? "apiVersion: v1\nkind: Pod\nmetadata:\n  name: sample\nspec:\n  containers:\n    - name: app\n      image: nginx:stable-alpine\n"
            : lintType === "github_actions"
              ? "name: CI\non: [push]\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo \"lint\"\n"
              : "FROM alpine:3.20\nRUN echo \"ready\"\n"
          : "echo \"run your command\"";

    return {
      id: String(raw.id || `q-${index + 1}`),
      title: String(raw.title || `DevOps Question ${index + 1}`),
      description: String(raw.description || "Solve the task using the execution panel."),
      difficulty: normalizeDifficulty(raw.difficulty),
      points: typeof raw.points === "number" ? raw.points : 20,
      kind,
      starterCode: starterFromPayload || defaultStarter,
      validationMode: (() => {
        const mode = String(raw.validationMode || "").toLowerCase();
        if (mode === "runtime" || mode === "content" || mode === "hybrid") return mode;
        return "runtime";
      })(),
      expectedSubmissionContains: Array.isArray(raw.expectedSubmissionContains)
        ? raw.expectedSubmissionContains.filter((item): item is string => typeof item === "string")
        : undefined,
      expectedSubmissionRegex:
        typeof raw.expectedSubmissionRegex === "string" ? raw.expectedSubmissionRegex : undefined,
      forbiddenSubmissionRegex:
        typeof raw.forbiddenSubmissionRegex === "string" ? raw.forbiddenSubmissionRegex : undefined,
      expectedExitCode: typeof raw.expectedExitCode === "number" ? raw.expectedExitCode : 0,
      expectedStdoutContains:
        typeof raw.expectedStdoutContains === "string" ? raw.expectedStdoutContains : undefined,
      expectedStdoutRegex:
        typeof raw.expectedStdoutRegex === "string" ? raw.expectedStdoutRegex : undefined,
      forbiddenStderrRegex:
        typeof raw.forbiddenStderrRegex === "string" ? raw.forbiddenStderrRegex : undefined,
      terraformAction:
        raw.terraformAction === "init" ||
        raw.terraformAction === "plan" ||
        raw.terraformAction === "apply" ||
        raw.terraformAction === "destroy"
          ? raw.terraformAction
          : kind === "terraform"
            ? "plan"
            : undefined,
      lintType,
      minLintScore: typeof raw.minLintScore === "number" ? raw.minLintScore : 100,
      instructions: asStringArray(raw.instructions, [
        "Read the question and execute using Run.",
        "Use Submit after validating every question.",
      ]),
      constraints: asStringArray(raw.constraints, ["Only sandbox-safe commands are allowed."]),
      hints: asStringArray(raw.hints, ["Validate command syntax before running."]),
    };
  });
}

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function safeRegexCheck(pattern: string, text: string): boolean {
  try {
    return new RegExp(pattern, "m").test(text);
  } catch {
    return false;
  }
}

function evaluateSubmission(
  question: RuntimeQuestion,
  submittedContent: string,
  result: DevOpsRunResult | null
): { passed: boolean; reasons: string[]; score: number } {
  const reasons: string[] = [];
  const validationMode = question.validationMode || "runtime";

  if (question.expectedSubmissionContains?.length) {
    question.expectedSubmissionContains.forEach((fragment) => {
      if (!submittedContent.includes(fragment)) {
        reasons.push(`Missing required content: "${fragment}".`);
      }
    });
  }

  if (question.expectedSubmissionRegex && !safeRegexCheck(question.expectedSubmissionRegex, submittedContent)) {
    reasons.push("Submitted content does not match expected pattern.");
  }

  if (question.forbiddenSubmissionRegex && safeRegexCheck(question.forbiddenSubmissionRegex, submittedContent)) {
    reasons.push("Submitted content contains forbidden pattern.");
  }

  if (validationMode === "content") {
    const passed = reasons.length === 0;
    return {
      passed,
      reasons: passed ? ["Content validation passed."] : reasons,
      score: passed ? question.points : 0,
    };
  }

  if (!result) {
    if (validationMode === "hybrid" && reasons.length === 0) {
      return {
        passed: true,
        reasons: ["Runtime unavailable; passed using content validation."],
        score: question.points,
      };
    }
    reasons.push("Execution result unavailable.");
    return { passed: false, reasons, score: 0 };
  }

  if (!result.ok) {
    if (validationMode === "hybrid" && reasons.length === 0) {
      return {
        passed: true,
        reasons: ["Execution engine unavailable; passed using content validation."],
        score: question.points,
      };
    }
    reasons.push(result.message || "Engine execution failed.");
    return { passed: false, reasons, score: 0 };
  }

  if (question.kind === "lint") {
    const minScore = question.minLintScore ?? 100;
    if (result.lintStatus !== "passed") {
      reasons.push("Lint status is not passed.");
    }
    if ((result.lintScore ?? 0) < minScore) {
      reasons.push(`Lint score is below threshold (${result.lintScore ?? 0}/${minScore}).`);
    }
    const passed = reasons.length === 0;
    return { passed, reasons: passed ? ["Lint validation passed."] : reasons, score: passed ? question.points : 0 };
  }

  const expectedExit = question.expectedExitCode ?? 0;
  if ((result.exitCode ?? 1) !== expectedExit) {
    reasons.push(`Expected exit code ${expectedExit}, received ${result.exitCode ?? "unknown"}.`);
  }

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  if (question.expectedStdoutContains && !stdout.includes(question.expectedStdoutContains)) {
    reasons.push(`Missing required output fragment: "${question.expectedStdoutContains}".`);
  }

  if (question.expectedStdoutRegex && !safeRegexCheck(question.expectedStdoutRegex, stdout)) {
    reasons.push("Output does not match expected pattern.");
  }

  if (question.forbiddenStderrRegex && safeRegexCheck(question.forbiddenStderrRegex, stderr)) {
    reasons.push("Detected forbidden error pattern.");
  }

  const passed = reasons.length === 0;
  return {
    passed,
    reasons: passed ? ["Validation passed successfully."] : reasons,
    score: passed ? question.points : 0,
  };
}

export default function DevOpsTakePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const testId = typeof router.query.id === "string" ? router.query.id : undefined;
  const { data: testData, isLoading, error } = useDevOpsTest(testId);
  const thumbVideoRef = useRef<HTMLVideoElement>(null);
  const [cameraProctorEnabled, setCameraProctorEnabled] = useState(true);
  const [debugMode] = useState(false);
  const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState<Array<Record<string, unknown>>>([]);
  const [isGeneratedLoading, setIsGeneratedLoading] = useState(false);
  const [generatedFetchError, setGeneratedFetchError] = useState<string | null>(null);
  const isGeneratedRoute = testId === "ai-generated" || router.query.generated === "1";

  useEffect(() => {
    if (!isGeneratedRoute || typeof window === "undefined") return;

    let active = true;
    const loadDynamically = async () => {
      setIsGeneratedLoading(true);
      setGeneratedFetchError(null);

      let payloadMeta: any = null;
      let title = "DevOps AI Assessment";
      let description = "";

      const rawPayload = sessionStorage.getItem("devopsAIGeneratedPayload");
      if (rawPayload) {
        try {
          const parsed = JSON.parse(rawPayload) as GeneratedDevOpsPayload & {
            title?: string;
            description?: string;
            metadata?: Record<string, unknown>;
          };
          if (Array.isArray(parsed.questions) && parsed.questions.length > 0) {
            setAiGeneratedQuestions(parsed.questions as Array<Record<string, unknown>>);
          }
          payloadMeta = parsed.metadata || null;
          title = parsed.title || title;
          description = parsed.description || description;
        } catch {
          setAiGeneratedQuestions([]);
        }
      }

      const rawMeta = sessionStorage.getItem("devopsAIGenerationMeta");
      if (rawMeta) {
        try {
          const parsedMeta = JSON.parse(rawMeta);
          title = parsedMeta?.title || title;
          description = parsedMeta?.description || description;
        } catch {
          // Ignore malformed session meta
        }
      }

      const requestBody = {
        yearsOfExperience: payloadMeta?.yearsOfExperience || "2-4",
        difficulty: payloadMeta?.difficulty || "intermediate",
        topicsRequired: payloadMeta?.topicsRequired || "CI/CD pipelines, Docker, Kubernetes",
        questionCount: Number(payloadMeta?.questionCount || 10),
        jobRole: payloadMeta?.jobRole || "DevOps Engineer",
        timeLimit: Number(payloadMeta?.timeLimit || 60),
        focusArea: payloadMeta?.focusArea || "balanced",
        title,
        description,
      };

      try {
        const response = await fetch("/api/devops/generate-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          const data = await response.json();
          if (active && Array.isArray(data?.questions) && data.questions.length > 0) {
            setAiGeneratedQuestions(data.questions as Array<Record<string, unknown>>);
            const existingPayload = rawPayload ? JSON.parse(rawPayload) : {};
            sessionStorage.setItem(
              "devopsAIGeneratedPayload",
              JSON.stringify({
                ...existingPayload,
                title,
                description,
                metadata: requestBody,
                questions: data.questions,
                generatedAt: new Date().toISOString(),
                source: "ai-form",
              })
            );
          }
        } else if (active) {
          const err = await response.json().catch(() => null);
          setGeneratedFetchError(String(err?.error || err?.details || "Failed to fetch generated questions."));
        }
      } catch {
        if (active) {
          setGeneratedFetchError("Failed to fetch generated questions. Please regenerate from DevOps Create page.");
        }
      } finally {
        if (active) setIsGeneratedLoading(false);
      }
    };

    loadDynamically();
    return () => {
      active = false;
    };
  }, [isGeneratedRoute]);

  const questions = useMemo(() => {
    if (aiGeneratedQuestions.length > 0) {
      return buildRuntimeQuestions(aiGeneratedQuestions);
    }

    if (isGeneratedRoute) {
      return [];
    }

    const runtimeSource = Array.isArray((testData as { questions?: unknown[] } | undefined)?.questions)
      ? ((testData as { questions: unknown[] }).questions as Array<Record<string, unknown>>)
      : [];
    if (runtimeSource.length === 0) {
      return pickRandomizedQuestions(SAMPLE_QUESTIONS, `devops:${testId || "local"}:${new Date().toDateString()}`);
    }
    return buildRuntimeQuestions(runtimeSource);
  }, [testData, testId, aiGeneratedQuestions, isGeneratedRoute]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [editorByQuestion, setEditorByQuestion] = useState<Record<string, string>>({});
  const [attempts, setAttempts] = useState<Record<string, QuestionAttempt>>({});
  const [terminalByQuestion, setTerminalByQuestion] = useState<Record<string, TerminalLine[]>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [submission, setSubmission] = useState<SubmissionSummary | null>(null);
  const submitted = !!submission;

  const getViolationMessage = (eventType: string): string => {
    const messages: Record<string, string> = {
      GAZE_AWAY: "Please keep your eyes on the screen",
      MULTIPLE_FACES_DETECTED: "Multiple faces detected in frame",
      NO_FACE_DETECTED: "Please stay in front of the camera",
      TAB_SWITCH: "Tab switch detected",
      FOCUS_LOST: "Window focus lost",
      FULLSCREEN_EXIT: "Exited fullscreen mode",
      RAPID_CLICKING: "Suspicious rapid clicking detected",
      COPY_PASTE_DETECTED: "Copy-paste activity detected",
      EXCESSIVE_MOUSE_MOVEMENT: "Excessive mouse movement detected",
      PROLONGED_INACTIVITY: "Prolonged inactivity detected",
      EXCESSIVE_SCROLLING: "Excessive scrolling detected",
    };
    return messages[eventType] || "Violation detected";
  };

  const {
    isLocked: isFullscreenLocked,
    setIsLocked: setFullscreenLocked,
    exitCount: fullscreenExitCount,
    incrementExitCount: incrementFullscreenExitCount,
    requestFullscreen: requestFullscreenLock,
  } = useFullscreenLock();

  const handleUniversalViolation = useCallback(
    (violation: ProctoringViolation) => {
      pushViolationToast({
        id: `${violation.eventType}-${Date.now()}`,
        eventType: violation.eventType,
        message: getViolationMessage(violation.eventType),
        timestamp: violation.timestamp,
      });

      if (violation.eventType === "FULLSCREEN_EXIT" && cameraProctorEnabled) {
        setFullscreenLocked(true);
        incrementFullscreenExitCount();
      }
    },
    [cameraProctorEnabled, incrementFullscreenExitCount, setFullscreenLocked]
  );

  const handleUniversalWarning = useCallback((warning: any) => {
    if (warning?.type === "FACE_NOT_CLEARLY_VISIBLE") {
      pushViolationToast({
        id: `warning-${warning.type}-${Date.now()}`,
        eventType: warning.type,
        message: warning.message || "Face not clearly visible",
        timestamp: new Date(warning.timestamp || Date.now()).toISOString(),
        isWarning: true,
      });
    }
  }, []);

  const handleRequestFullscreen = useCallback(async (): Promise<boolean> => {
    const success = await requestFullscreenLock();
    if (success) setFullscreenLocked(false);
    return success;
  }, [requestFullscreenLock, setFullscreenLocked]);

  const { state: proctoringState, isRunning: isProctoringRunning, startProctoring, stopProctoring } =
    useUniversalProctoring({
      onViolation: handleUniversalViolation,
      onWarning: handleUniversalWarning,
      debug: debugMode,
    });

  useEffect(() => {
    const settings = (testData as any)?.proctoringSettings;
    if (settings && typeof settings === "object") {
      setCameraProctorEnabled(settings.aiProctoringEnabled === true);
    }
    if (typeof window !== "undefined") {
      const rawMeta = sessionStorage.getItem("devopsAIGenerationMeta");
      if (rawMeta) {
        try {
          const parsed = JSON.parse(rawMeta);
          if (parsed?.proctoringSettings && typeof parsed.proctoringSettings === "object") {
            setCameraProctorEnabled(parsed.proctoringSettings.aiProctoringEnabled === true);
          }
        } catch {
          // Ignore bad session payloads
        }
      }
    }
  }, [testData]);

  const proctoringUserId = useMemo(
    () =>
      resolveUserIdForProctoring((session?.user as any)?.id || null, {
        email: (session?.user as any)?.email || null,
      }),
    [session]
  );

  useEffect(() => {
    if (!cameraProctorEnabled) return;
    if (!questions.length || submitted || isProctoringRunning || !thumbVideoRef.current) return;
    if (!testId || !proctoringUserId) return;

    startProctoring({
      settings: { aiProctoringEnabled: true, liveProctoringEnabled: false },
      session: { userId: proctoringUserId, assessmentId: String(testId) },
      videoElement: thumbVideoRef.current,
    });
  }, [
    cameraProctorEnabled,
    questions.length,
    submitted,
    isProctoringRunning,
    testId,
    proctoringUserId,
    startProctoring,
  ]);

  useEffect(() => {
    if (submitted) {
      stopProctoring();
      setFullscreenLocked(false);
    }
  }, [submitted, stopProctoring, setFullscreenLocked]);

  useEffect(() => {
    return () => {
      stopProctoring();
    };
  }, [stopProctoring]);

  useActivityPatternProctor({
    userId: proctoringUserId || "",
    assessmentId: String(testId || ""),
    enabled: !!proctoringUserId && !!testId && !submitted,
    copyPasteThreshold: 20,
    onViolation: (violation) => {
      handleUniversalViolation({
        eventType: violation.eventType as any,
        timestamp: violation.timestamp,
        assessmentId: violation.assessmentId,
        userId: violation.userId,
        metadata: violation.metadata,
      });
    },
  });

  useEffect(() => {
    setEditorByQuestion((prev) => {
      const next = { ...prev };
      questions.forEach((question) => {
        if (!next[question.id]) next[question.id] = question.starterCode;
      });
      return next;
    });
  }, [questions]);

  useEffect(() => {
    if (currentIndex >= questions.length) {
      setCurrentIndex(0);
    }
  }, [currentIndex, questions.length]);

  const currentQuestion = questions[currentIndex];
  const currentValue = currentQuestion ? editorByQuestion[currentQuestion.id] || "" : "";
  const terminalLines = currentQuestion ? terminalByQuestion[currentQuestion.id] || [] : [];
  const scoreNow = questions.reduce((total, question) => total + (attempts[question.id]?.score || 0), 0);
  const scoreMax = questions.reduce((total, question) => total + question.points, 0);

  const runQuestion = async () => {
    if (!currentQuestion || isRunning) return;

    setIsRunning(true);
    setSubmission(null);

    const content = editorByQuestion[currentQuestion.id] || "";

    const validationMode = currentQuestion.validationMode || "runtime";
    const shouldExecuteRuntime = validationMode !== "content";
    const payload: DevOpsRunPayload | null = shouldExecuteRuntime
      ? currentQuestion.kind === "command"
        ? { mode: "command", command: content }
        : currentQuestion.kind === "terraform"
          ? {
              mode: "terraform",
              terraformAction: currentQuestion.terraformAction || "plan",
              terraformFiles: { "main.tf": content },
            }
          : {
              mode: "lint",
              lintType: currentQuestion.lintType || "docker",
              content,
            }
      : null;

    const nextLines: TerminalLine[] = [
      {
        type: "cmd",
        text:
          currentQuestion.kind === "command"
            ? `$ ${content}`
            : currentQuestion.kind === "terraform"
              ? `$ terraform ${currentQuestion.terraformAction || "plan"} (main.tf)`
              : `$ lint:${currentQuestion.lintType || "docker"}`,
      },
    ];

    try {
      const result = payload ? await devopsRuntimeService.run(payload) : null;
      const evaluation = evaluateSubmission(currentQuestion, content, result);

      if (!result) {
        nextLines.push({
          type: evaluation.passed ? "success" : "error",
          text: "Content-only validation mode (runtime execution skipped).",
        });
      } else if (result.engine === "lint") {
        nextLines.push({
          type: result.status === "success" ? "success" : "error",
          text: `Lint status=${result.lintStatus} score=${result.lintScore ?? 0}`,
        });
        (result.lintErrors || []).forEach((row) => nextLines.push({ type: "stderr", text: row }));
        (result.lintWarnings || []).forEach((row) => nextLines.push({ type: "stdout", text: row }));
      } else {
        if (result.stdout) nextLines.push({ type: "stdout", text: result.stdout.trimEnd() });
        if (result.stderr) nextLines.push({ type: "stderr", text: result.stderr.trimEnd() });
        nextLines.push({
          type: result.status === "success" ? "success" : "error",
          text: `exit_code=${result.exitCode ?? "unknown"}`,
        });
      }

      evaluation.reasons.forEach((reason) =>
        nextLines.push({
          type: evaluation.passed ? "success" : "error",
          text: evaluation.passed ? `SUCCESS: ${reason}` : `ERROR: ${reason}`,
        })
      );

      setTerminalByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: [...(prev[currentQuestion.id] || []), ...nextLines],
      }));

      setAttempts((prev) => {
        const before = prev[currentQuestion.id];
        return {
          ...prev,
          [currentQuestion.id]: {
            runCount: (before?.runCount || 0) + 1,
            passed: evaluation.passed,
            score: evaluation.score,
            reasons: evaluation.reasons,
            lastRun: result || null,
          },
        };
      });
    } catch (runError: unknown) {
      const message = runError instanceof Error ? runError.message : "Run failed unexpectedly.";
      setTerminalByQuestion((prev) => ({
        ...prev,
        [currentQuestion.id]: [
          ...(prev[currentQuestion.id] || []),
          ...nextLines,
          { type: "error", text: `ERROR: ${message}` },
        ],
      }));

      setAttempts((prev) => {
        const before = prev[currentQuestion.id];
        return {
          ...prev,
          [currentQuestion.id]: {
            runCount: (before?.runCount || 0) + 1,
            passed: false,
            score: 0,
            reasons: [message],
            lastRun: null,
          },
        };
      });
    } finally {
      setIsRunning(false);
    }
  };

  const submitAssessment = () => {
    const summary = questions.reduce(
      (acc, question) => {
        const attempt = attempts[question.id];
        const passed = !!attempt?.passed;
        const score = passed ? question.points : 0;
        return {
          totalScore: acc.totalScore + score,
          maxScore: acc.maxScore + question.points,
          passedCount: acc.passedCount + (passed ? 1 : 0),
          totalCount: acc.totalCount + 1,
        };
      },
      { totalScore: 0, maxScore: 0, passedCount: 0, totalCount: 0 }
    );

    setSubmission(summary);
  };

  if (isLoading || (isGeneratedRoute && isGeneratedLoading && aiGeneratedQuestions.length === 0)) {
    return (
      <div className={cx(styles.page, monoFont.className)}>
        <div className={styles.shell}>Loading DevOps assessment...</div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className={cx(styles.page, monoFont.className)}>
        <div className={styles.shell}>
          {generatedFetchError || "Failed to load test. No question data available."}
        </div>
      </div>
    );
  }

  const assessmentTitle = isGeneratedRoute
    ? "AI Generated DevOps Assessment"
    : String((testData as { title?: string } | undefined)?.title || "DevOps Assessment");
  const currentAttempt = attempts[currentQuestion.id];

  return (
    <div className={cx(styles.page, headingFont.variable, monoFont.variable)}>
      <ViolationToast />
      {cameraProctorEnabled && (
        <WebcamPreview
          ref={thumbVideoRef}
          cameraOn={proctoringState.isCameraOn}
          faceMeshStatus={proctoringState.isModelLoaded ? "loaded" : proctoringState.modelError ? "error" : "loading"}
          facesCount={proctoringState.facesCount}
          visible={false}
        />
      )}
      <motion.div
        className={cx(styles.shell, monoFont.className)}
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: {
            opacity: 1,
            transition: { staggerChildren: 0.08, delayChildren: 0.05 },
          },
        }}
      >
        <motion.header
          className={styles.topbar}
          variants={{ hidden: { y: -12, opacity: 0 }, show: { y: 0, opacity: 1 } }}
        >
          <div className={styles.titleBlock}>
            <h1 className={styles.title} style={{ fontFamily: "var(--font-devops-heading)" }}>
              {assessmentTitle}
            </h1>
            <div className={styles.meta}>
              <span className={styles.chip}>Scenario {currentIndex + 1}/{questions.length}</span>
              <span className={styles.chip}>Mode {currentQuestion.kind}</span>
              <span className={styles.chip}>Difficulty {currentQuestion.difficulty}</span>
            </div>
          </div>

          <div className={styles.scoreBox}>
            <div className={styles.scoreText}>Current Score</div>
            <div className={styles.scoreValue}>
              {scoreNow} / {scoreMax}
            </div>
          </div>
        </motion.header>

        {error && (
          <motion.div
            className={styles.panel}
            style={{ padding: "10px 12px", color: "#ffb2b5", borderColor: "#5b2a30" }}
            variants={{ hidden: { opacity: 0, y: -6 }, show: { opacity: 1, y: 0 } }}
          >
            DevOps test API is unavailable or unauthorized. Running in local sample mode.
          </motion.div>
        )}

        <motion.section
          className={styles.mainGrid}
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
        >
          <motion.aside
            className={cx(styles.panel, styles.questionPanel)}
            variants={{ hidden: { x: -18, opacity: 0 }, show: { x: 0, opacity: 1 } }}
          >
            <div className={styles.questionHeader}>
              <h2 className={styles.questionTitle} style={{ fontFamily: "var(--font-devops-heading)" }}>
                {currentQuestion.title}
              </h2>
              <p className={styles.questionDesc}>{currentQuestion.description}</p>
            </div>

            <div className={styles.questionNav}>
              {questions.map((question, idx) => (
                <button
                  key={question.id}
                  type="button"
                  className={cx(
                    styles.questionBtn,
                    idx === currentIndex && styles.questionBtnActive
                  )}
                  onClick={() => setCurrentIndex(idx)}
                >
                  S{idx + 1}
                </button>
              ))}
            </div>

            <div className={styles.questionBody}>
              <h3 className={styles.sectionTitle}>Instructions</h3>
              <ul className={styles.sectionList}>
                {currentQuestion.instructions.map((item, idx) => (
                  <li key={`inst-${idx}`}>{item}</li>
                ))}
              </ul>

              <h3 className={styles.sectionTitle}>Constraints</h3>
              <ul className={styles.sectionList}>
                {currentQuestion.constraints.map((item, idx) => (
                  <li key={`con-${idx}`}>{item}</li>
                ))}
              </ul>

              <h3 className={styles.sectionTitle}>Hints</h3>
              <ul className={styles.sectionList}>
                {currentQuestion.hints.map((item, idx) => (
                  <li key={`hint-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          </motion.aside>

          <motion.section
            className={cx(styles.panel, styles.editorPanel)}
            variants={{ hidden: { x: 22, opacity: 0 }, show: { x: 0, opacity: 1 } }}
          >
            <div className={styles.editorBar}>
              <div className={styles.editorMeta}>
                <span>{currentQuestion.kind === "command" ? "Shell Input" : "Workspace File"}</span>
                <span>Points {currentQuestion.points}</span>
                <span>Runs {currentAttempt?.runCount || 0}</span>
              </div>

              <div className={styles.btnRow}>
                <button
                  type="button"
                  className={cx(styles.btn, styles.btnRun)}
                  onClick={runQuestion}
                  disabled={isRunning}
                >
                  {isRunning ? "Running..." : "Run"}
                </button>
                <button
                  type="button"
                  className={cx(styles.btn, styles.btnSubmit)}
                  onClick={submitAssessment}
                  disabled={isRunning}
                >
                  Submit
                </button>
              </div>
            </div>

            <div className={styles.editorWrap}>
              <MonacoEditor
                height="100%"
                theme="vs-dark"
                defaultLanguage={currentQuestion.kind === "command" ? "shell" : "yaml"}
                language={currentQuestion.kind === "command" ? "shell" : "yaml"}
                value={currentValue}
                onChange={(value) =>
                  setEditorByQuestion((prev) => ({
                    ...prev,
                    [currentQuestion.id]: value ?? "",
                  }))
                }
                options={{
                  minimap: { enabled: false },
                  fontFamily: "var(--font-devops-mono)",
                  fontSize: 14,
                  lineNumbers: currentQuestion.kind === "command" ? "off" : "on",
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 16 },
                }}
              />
            </div>
          </motion.section>
        </motion.section>

        <motion.section
          className={styles.terminalPanel}
          variants={{ hidden: { y: 18, opacity: 0 }, show: { y: 0, opacity: 1 } }}
        >
          <div className={styles.terminalHead}>
            <span>Execution Output</span>
            <span>{currentAttempt?.passed ? "Validated" : "Awaiting validation"}</span>
          </div>

          <pre className={styles.terminalBody}>
            {terminalLines.length === 0 ? (
              <span className={styles.lineStdout}>No execution yet. Use Run to evaluate this question.</span>
            ) : (
              terminalLines.map((line, idx) => (
                <span
                  key={`${line.type}-${idx}`}
                  className={cx(
                    styles.line,
                    line.type === "cmd" && styles.lineCmd,
                    line.type === "stdout" && styles.lineStdout,
                    line.type === "stderr" && styles.lineStderr,
                    line.type === "success" && styles.lineSuccess,
                    line.type === "error" && styles.lineError
                  )}
                >
                  {line.text}
                  {"\n"}
                </span>
              ))
            )}
          </pre>

          <AnimatePresence mode="wait">
            {submission && (
              <motion.div
                key={`${submission.totalScore}-${submission.maxScore}`}
                className={styles.submitResult}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.2 }}
              >
                <span>
                  Final Score: {submission.totalScore} / {submission.maxScore}
                </span>
                <span className={submission.passedCount === submission.totalCount ? styles.statusPass : styles.statusFail}>
                  Passed {submission.passedCount} of {submission.totalCount}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </motion.div>
      {cameraProctorEnabled && (
        <FullscreenLockOverlay
          isLocked={isFullscreenLocked}
          onRequestFullscreen={handleRequestFullscreen}
          exitCount={fullscreenExitCount}
          message="You must be in fullscreen mode to continue the DevOps test."
          warningText={fullscreenExitCount > 0 ? "Exiting fullscreen is recorded as a violation." : undefined}
        />
      )}
    </div>
  );
}
