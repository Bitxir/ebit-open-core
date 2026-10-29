import { z } from "zod";

export const AI_TASKS = ["image_description", "species_suggestion", "document_extraction"] as const;
export const DECISIONS = ["verified", "rejected", "needs_review"] as const;
export const analysisSchema = z.object({
  summary: z.string(),
  species: z.string().nullable(),
  confidence: z.number().nullable(),
  extractedText: z.string().nullable(),
  annotations: z.array(z.object({ label: z.string(), value: z.string().nullable() }).strict()),
}).strict();
export type Analysis = z.infer<typeof analysisSchema>;
export function analysisAllowed(kind: string, mime: string | null, rights: string, bytes: number, task: typeof AI_TASKS[number]) {
  if (!["permitted_processing", "permitted_redistribution"].includes(rights)) return false;
  if (bytes <= 0 || bytes > 10 * 1024 * 1024) return false;
  return task === "document_extraction"
    ? kind === "document" && ["text/plain", "application/pdf"].includes(mime ?? "")
    : kind === "image" && ["image/jpeg", "image/png", "image/webp"].includes(mime ?? "");
}
export function humanStatus(events: { decision: string; created_at: string }[]) {
  return [...events].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]?.decision ?? "unverified";
}
export function retryDelay(status: number, attempts: number) {
  return (status === 429 || status >= 500) && attempts < 3 ? Math.min(300, 30 * 2 ** (attempts - 1)) : null;
}