import { describe, expect, it } from "vitest";
import { analysisAllowed, analysisSchema, humanStatus, retryDelay } from "./verification";
describe("AI and human verification boundaries", () => {
  it("never treats an AI result as verified without human events", () => expect(humanStatus([])).toBe("unverified"));
  it("uses the latest human decision", () => expect(humanStatus([{ decision: "verified", created_at: "2026-01-01" }, { decision: "rejected", created_at: "2026-02-01" }])).toBe("rejected"));
  it("blocks unknown rights", () => expect(analysisAllowed("image", "image/png", "unknown", 100, "species_suggestion")).toBe(false));
  it("blocks curator-only tabular originals", () => expect(analysisAllowed("darwin-core", "text/csv", "permitted_processing", 100, "document_extraction")).toBe(false));
  it("blocks images from document extraction", () => expect(analysisAllowed("image", "image/png", "permitted_processing", 100, "document_extraction")).toBe(false));
  it("preserves missing predictions", () => expect(analysisSchema.parse({ summary: "No species detected", species: null, confidence: null, extractedText: null, annotations: [] }).confidence).toBeNull());
  it("retries transient errors with backoff only", () => { expect(retryDelay(429, 1)).toBe(30); expect(retryDelay(500, 2)).toBe(60); expect(retryDelay(500, 3)).toBeNull(); });
  it("does not retry denied or invalid calls", () => { expect(retryDelay(403, 1)).toBeNull(); expect(retryDelay(400, 1)).toBeNull(); expect(retryDelay(402, 1)).toBeNull(); });
});