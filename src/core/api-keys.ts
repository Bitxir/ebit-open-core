import { sha256Hex } from "@/core/ingest";

/** Public read API keys: `ebit_api_` + 64 hex chars. Only the SHA-256 hash is stored. */
export const API_KEY_PATTERN = /^ebit_api_[a-f0-9]{64}$/;

export function createApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `ebit_api_${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export const hashApiKey = (key: string) => sha256Hex(new TextEncoder().encode(key));

/** Visible prefix shown in the UI so keys can be told apart without revealing them. */
export const apiKeyPrefix = (key: string) => key.slice(0, 17);

/** Extracts a well-formed key from an `Authorization: Bearer` header, or null. */
export function bearerApiKey(header: string | null): string | null {
  const m = header?.match(/^Bearer (\S+)$/);
  const key = m?.[1];
  return key && API_KEY_PATTERN.test(key) ? key : null;
}

/** Maps database error codes raised by `api_read` to HTTP statuses. */
export function apiErrorStatus(code: string | undefined): { status: number; error: string } {
  switch (code) {
    case "28000": return { status: 401, error: "Invalid or revoked API key." };
    case "54000": return { status: 429, error: "Rate limit exceeded. Try again next minute." };
    case "P0002": return { status: 404, error: "Dataset not found or not published with redistribution rights." };
    case "22023": return { status: 400, error: "Unknown resource." };
    default: return { status: 500, error: "Request failed." };
  }
}

export function parsePage(value: string | null): number | null {
  if (value === null) return 1;
  if (!/^\d{1,6}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 ? n : null;
}
