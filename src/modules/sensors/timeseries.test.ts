import { describe, it, expect } from "vitest";
import { parseTimeseries, normalizeReadings, isTimeseries, createDeviceKey, hashDeviceKey } from "./timeseries";
import { findAdapter } from "@/adapters/registry";
describe("sensor readings", () => {
  it("imports zero and preserves extra source fields", () => { const r=parseTimeseries("timestamp,value,quality\n2026-10-29T10:00:00Z,0,test", "csv")[0]; expect(r?.value).toBe(0); expect(r?.original["quality"]).toBe("test"); });
  it("normalizes timezone offsets", () => expect(parseTimeseries('[{"timestamp":"2026-10-29T10:00:00+05:30","value":2}]',"json")[0]?.timestamp).toBe("2026-10-29T04:30:00.000Z"));
  it("requires an explicit timezone", () => expect(()=>parseTimeseries('[{"timestamp":"2026-10-29T10:00:00","value":2}]',"json")).toThrow());
  it("rejects blank and nonfinite readings", () => { expect(()=>parseTimeseries("timestamp,value\n2026-10-29T10:00:00Z,", "csv")).toThrow(); expect(()=>normalizeReadings([{timestamp:"2026-10-29T10:00:00Z",value:Infinity}])).toThrow(); });
  it("rejects conflicting duplicate timestamps", () => expect(()=>normalizeReadings([{timestamp:"2026-10-29T10:00:00Z",value:1},{timestamp:"2026-10-29T10:00:00Z",value:2}])).toThrow());
  it("detects specific sensor formats without claiming arbitrary files", () => { expect(isTimeseries("timestamp,value\n2026-10-29T10:00:00Z,1","csv")).toBe(true); expect(isTimeseries('{"name":"sensor"}',"json")).toBe(false); });
  it("registers sensor CSV before generic CSV", () => expect(findAdapter({fileName:"readings.csv",mimeType:"text/csv",bytes:new TextEncoder().encode("timestamp,value\n2026-10-29T10:00:00Z,1")})?.descriptor.id).toBe("sensor-timeseries"));
  it("registers sensor JSON before generic JSON", () => expect(findAdapter({fileName:"readings.json",mimeType:"application/json",bytes:new TextEncoder().encode('{"measurements":[{"timestamp":"2026-10-29T10:00:00Z","value":1}]}')})?.descriptor.id).toBe("sensor-timeseries"));
  it("bounds batches at 1000 rows", () => expect(()=>normalizeReadings(Array.from({length:1001},()=>({timestamp:"2026-10-29T10:00:00Z",value:1})))).toThrow());
  it("creates unique random hashed device keys", async () => { const a=createDeviceKey(),b=createDeviceKey(); expect(a).not.toBe(b); expect(a.length).toBe(76); const hash=await hashDeviceKey(a); expect(hash).toMatch(/^[a-f0-9]{64}$/); expect(hash).not.toContain(a); expect(await hashDeviceKey(a)).toBe(hash); });
});