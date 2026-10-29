import { describe, expect, it } from "vitest";
import { apiErrorStatus, bearerApiKey, createApiKey, hashApiKey, parsePage } from "./api-keys";

describe("public API keys", () => {
  it("creates unique well-formed keys", () => {
    const a = createApiKey(), b = createApiKey();
    expect(a).toMatch(/^ebit_api_[a-f0-9]{64}$/);
    expect(a).not.toBe(b);
  });
  it("hashes deterministically to 64 hex chars", async () => {
    const k = createApiKey();
    expect(await hashApiKey(k)).toBe(await hashApiKey(k));
    expect(await hashApiKey(k)).toMatch(/^[a-f0-9]{64}$/);
  });
  it("rejects malformed bearer headers and sensor keys", () => {
    expect(bearerApiKey(null)).toBeNull();
    expect(bearerApiKey("Bearer ebit_sensor_" + "a".repeat(64))).toBeNull();
    expect(bearerApiKey("Basic x")).toBeNull();
    const k = createApiKey();
    expect(bearerApiKey(`Bearer ${k}`)).toBe(k);
  });
  it("maps revoked keys to 401 and rate limit to 429", () => {
    expect(apiErrorStatus("28000").status).toBe(401);
    expect(apiErrorStatus("54000").status).toBe(429);
    expect(apiErrorStatus("P0002").status).toBe(404);
  });
  it("validates page numbers", () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage("3")).toBe(3);
    expect(parsePage("0")).toBeNull();
    expect(parsePage("-1")).toBeNull();
  });
});
