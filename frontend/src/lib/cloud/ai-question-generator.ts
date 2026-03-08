export type {
  DevopsDifficulty,
  DevopsFocusArea,
  DevopsDifficulty as CloudDifficulty,
  DevopsFocusArea as CloudFocusArea,
  DevOpsAIGenerationInput as CloudAIGenerationInput,
  GeneratedDevOpsQuestion as GeneratedCloudQuestion,
  GeneratedDevOpsPayload as GeneratedCloudPayload,
} from "@/lib/devops/ai-question-generator";

export { buildDevOpsAIGeneratedPayload as buildCloudAIGeneratedPayload } from "@/lib/devops/ai-question-generator";
