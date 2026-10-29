import { emptyMetadata, type Adapter } from "../types";
import { extensionOf } from "@/core/ingest";

function parse(bytes: Uint8Array): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "")) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "invalid JSON" };
  }
}

export const jsonAdapter: Adapter = {
  descriptor: {
    id: "json",
    version: "1.0.0",
    name: "Structured data (JSON)",
    summary: "Any JSON document or array of records. Reports its shape; the content is kept unchanged in the original file. GeoJSON is handled by the GeoJSON adapter.",
    formats: [{ mime: "application/json", extensions: [".json"] }],
    inputMethods: ["upload"],
    extracts: ["top-level type (object or array)", "record count for arrays", "top-level keys", "keys found across array records"],
    capabilities: ["duplicate detection by SHA-256"],
    errors: ["File is empty", "Not valid JSON (with parser message)"],
    provenance: ["registered", "ingested", "metadata_extracted"],
  },
  detect: (i) => i.mimeType === "application/json" || extensionOf(i.fileName) === ".json",
  async validate(i) {
    if (i.bytes.length === 0) return { ok: false, errors: ["File is empty"] };
    const r = parse(i.bytes);
    return r.ok ? { ok: true, errors: [] } : { ok: false, errors: [`Not valid JSON: ${r.error}`] };
  },
  async extractMetadata(i) {
    const m = emptyMetadata();
    const r = parse(i.bytes);
    if (!r.ok) return m;
    const v = r.value;
    if (Array.isArray(v)) {
      const keys = new Set<string>();
      v.slice(0, 1000).forEach((x) => x && typeof x === "object" && !Array.isArray(x) && Object.keys(x).forEach((k) => keys.add(k)));
      m.fields = { format: "json", top_level: "array", record_count: v.length, record_keys: [...keys].slice(0, 200) };
    } else if (v && typeof v === "object") {
      m.fields = { format: "json", top_level: "object", keys: Object.keys(v).slice(0, 200) };
    } else {
      m.fields = { format: "json", top_level: typeof v };
    }
    return m;
  },
};
