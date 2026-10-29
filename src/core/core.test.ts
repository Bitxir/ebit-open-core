import { describe, expect, it } from "vitest";
import { canPublish, canProcess, canTransition } from "./rights";
import { isEbitId, parseEbitId } from "./ids";
import { registerAdapter, listAdapters } from "@/adapters/registry";
import { emptyMetadata, type Adapter } from "@/adapters/types";

describe("rights", () => {
  it("only redistribution permission allows publishing", () => {
    expect(canPublish("permitted_redistribution")).toBe(true);
    expect(canPublish("permitted_processing")).toBe(false);
    expect(canPublish("unknown")).toBe(false);
    expect(canPublish("restricted")).toBe(false);
  });
  it("unknown rights do not allow processing", () => {
    expect(canProcess("unknown")).toBe(false);
    expect(canProcess("permitted_processing")).toBe(true);
  });
  it("unknown cannot jump straight to redistribution", () => {
    expect(canTransition("unknown", "permitted_redistribution")).toBe(false);
    expect(canTransition("unknown", "under_review")).toBe(true);
  });
  it("restricted records must go back through review", () => {
    expect(canTransition("restricted", "permitted_redistribution")).toBe(false);
    expect(canTransition("restricted", "under_review")).toBe(true);
  });
});

describe("EBiT IDs", () => {
  it("accepts the database format and rejects others", () => {
    expect(isEbitId("AST-0A1B2C3D4E")).toBe(true);
    expect(isEbitId("AST-0a1b2c3d4e")).toBe(false);
    expect(isEbitId("XYZ-0A1B2C3D4E")).toBe(false);
    expect(parseEbitId("OBS-0123456789")?.entity).toBe("observation");
  });
});

describe("adapter registry", () => {
  it("adds new adapters without touching the core and rejects duplicates", () => {
    const fake: Adapter = {
      descriptor: { id: "test-fake", version: "0.0.1", name: "Fake", summary: "", formats: [], inputMethods: ["upload"], extracts: [], capabilities: [], errors: [], provenance: [] },
      detect: () => true,
      validate: async () => ({ ok: true, errors: [] }),
      extractMetadata: async () => emptyMetadata(),
    };
    registerAdapter(fake);
    expect(listAdapters().some((a) => a.descriptor.id === "test-fake")).toBe(true);
    expect(() => registerAdapter(fake)).toThrow();
  });
  it("empty metadata never invents values", () => {
    const m = emptyMetadata();
    expect(m.capturedAt).toBeNull();
    expect(m.latitude).toBeNull();
    expect(m.device).toBeNull();
  });
});
