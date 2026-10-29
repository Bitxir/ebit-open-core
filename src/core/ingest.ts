/** Framework-free ingestion helpers shared by browser and server. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function extensionOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i < 0 ? "" : fileName.slice(i).toLowerCase();
}

/** Storage-safe file name; the original name is kept separately on the asset. */
export function safeFileName(fileName: string): string {
  const cleaned = fileName.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_").slice(-120);
  return cleaned.replace(/^[._]+/, "") || "file";
}

/**
 * Make arbitrary parsed metadata safe to store as JSON without inventing anything:
 * Dates become ISO strings, binary blobs are summarised by length, functions dropped.
 */
export function toJsonSafe(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return null;
  if (depth > 8) return "[truncated]";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  if (value instanceof Uint8Array || value instanceof ArrayBuffer) return `[binary ${value.byteLength} bytes]`;
  if (Array.isArray(value)) return value.slice(0, 200).map((v) => toJsonSafe(v, depth + 1));
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") return value.length > 5000 ? value.slice(0, 5000) + "…" : value;
  if (typeof value === "boolean") return value;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (typeof v === "function") continue;
      out[k] = toJsonSafe(v, depth + 1);
    }
    return out;
  }
  return null;
}

export function isValidLatitude(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= -90 && n <= 90;
}
export function isValidLongitude(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= -180 && n <= 180;
}
