import type { Analysis, AI_TASKS } from "@/core/verification";
export interface AnalysisProvider {
  analyze(input: { bytes: Uint8Array; mime: string; task: typeof AI_TASKS[number]; signal?: AbortSignal }): Promise<{ output: Analysis; model: string; version: string | null; runId: string | null; latency: number }>;
}