import Papa from "papaparse";
import { z } from "zod";
import { sha256Hex } from "@/core/ingest";

export const MAX_SENSOR_ROWS = 1000;
export const readingSchema = z.object({
  timestamp: z.string().datetime({ offset: true }).refine(s => Number.isFinite(Date.parse(s)), "Invalid timestamp"),
  value: z.number().finite(),
  original: z.record(z.unknown()),
});
export type Reading = z.infer<typeof readingSchema>;
export function normalizeReadings(rows: unknown[]): Reading[] {
  if (rows.length < 1 || rows.length > MAX_SENSOR_ROWS) throw new Error("Supply 1–1000 readings.");
  const seen = new Map<string, number>();
  return rows.map((r, index) => {
    if (!r || typeof r !== "object" || Array.isArray(r)) throw new Error(`Row ${index + 1}: expected an object.`);
    const row = r as Record<string, unknown>;
    const rawValue = row["value"];
    const value = typeof rawValue === "string" && rawValue.trim() !== "" ? Number(rawValue) : rawValue;
    const parsed = readingSchema.safeParse({ timestamp: row["timestamp"], value, original: row });
    if (!parsed.success) throw new Error(`Row ${index + 1}: ${parsed.error.issues.map(i => i.message).join("; ")}`);
    const timestamp = new Date(parsed.data.timestamp).toISOString();
    const old = seen.get(timestamp);
    if (old !== undefined && old !== parsed.data.value) throw new Error(`Row ${index + 1}: conflicting values at one timestamp.`);
    seen.set(timestamp, parsed.data.value);
    return { ...parsed.data, timestamp };
  });
}
export function parseTimeseries(text: string, format: "csv" | "json"): Reading[] {
  const clean = text.replace(/^\uFEFF/, "");
  if (format === "json") {
    const data: unknown = JSON.parse(clean);
    const rows = Array.isArray(data) ? data : data && typeof data === "object" ? (data as Record<string, unknown>)["measurements"] : null;
    if (!Array.isArray(rows)) throw new Error("Expected a measurements array or array of readings.");
    return normalizeReadings(rows);
  }
  const parsed = Papa.parse<Record<string, string>>(clean, { header: true, skipEmptyLines: "greedy", dynamicTyping: false });
  if (parsed.errors.length) throw new Error("Malformed sensor CSV.");
  if (!parsed.meta.fields?.includes("timestamp") || !parsed.meta.fields.includes("value")) throw new Error("CSV requires timestamp and value headers.");
  return normalizeReadings(parsed.data);
}
export function isTimeseries(text: string, format: "csv" | "json") {
  try {
    if (format === "json") {
      const data = JSON.parse(text);
      if (data && !Array.isArray(data) && Array.isArray(data.measurements)) return true;
      return Array.isArray(data) && data.length > 0 && data[0] && "timestamp" in data[0] && "value" in data[0];
    }
    const fields = Papa.parse(text, { header: true, preview: 1 }).meta.fields ?? [];
    return fields.includes("timestamp") && fields.includes("value");
  } catch { return false; }
}
export function createDeviceKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `ebit_sensor_${Array.from(bytes, b => b.toString(16).padStart(2,"0")).join("")}`;
}
export const hashDeviceKey = (key: string) => sha256Hex(new TextEncoder().encode(key));