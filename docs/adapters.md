# Adapters

An adapter teaches EBiT one input format. The core never special-cases formats — it only calls the adapter contract. Adding a format means adding one module and registering it.

## The contract

```ts
interface Adapter {
  descriptor: AdapterDescriptor;            // documentation + capabilities
  detect(input: AdapterInput): boolean;     // "is this mine?"
  validate(input: AdapterInput): Promise<ValidationResult>;
  extractMetadata(input: AdapterInput): Promise<NormalizedMetadata>;
}

interface AdapterInput { fileName: string; mimeType: string | null; bytes: Uint8Array }

interface NormalizedMetadata {
  capturedAt: string | null;  // ISO 8601, or null if the source has none
  latitude: number | null;
  longitude: number | null;
  device: string | null;
  fields: Record<string, unknown>;    // normalised, adapter-specific
  original: Record<string, unknown>;  // exactly as found in the source
}
```

The `descriptor` lists formats, input methods, extracted fields, capabilities, possible errors and provenance requirements. **The adapter pages on this site are generated from descriptors**, so the docs always match the code.

## Rules every adapter follows

1. **Never invent values.** If the file has no date, `capturedAt` is `null`. Start from `emptyMetadata()`.
2. **Keep the original.** Put the raw metadata in `original`, untouched.
3. **Validate before anything is stored.** Return clear, human-readable errors.
4. **Be deterministic.** The same bytes give the same output (needed for duplicate detection and retries).
5. **Declare a version.** It is recorded in provenance with every asset the adapter handles.
6. **No network calls in `detect` or `validate`.**

## Writing your own adapter

1. Create `src/adapters/<id>/index.ts`.
2. Export an object implementing `Adapter`.
3. Register it in `src/adapters/registry.ts` with `registerAdapter(...)`.
4. Add a test with a small sample file in `src/adapters/<id>/`.
5. Its documentation page appears automatically.

```ts
import { emptyMetadata, type Adapter } from "@/adapters/types";

export const plainTextAdapter: Adapter = {
  descriptor: {
    id: "text", version: "1.0.0", name: "Plain text",
    summary: "UTF-8 text files.",
    formats: [{ mime: "text/plain", extensions: [".txt"] }],
    inputMethods: ["upload"],
    extracts: ["line count", "character count"],
    capabilities: ["full-text search"],
    errors: ["Not valid UTF-8"],
    provenance: ["ingested", "metadata_extracted"],
  },
  detect: (i) => i.mimeType === "text/plain" || i.fileName.endsWith(".txt"),
  validate: async (i) => {
    try { new TextDecoder("utf-8", { fatal: true }).decode(i.bytes); return { ok: true, errors: [] }; }
    catch { return { ok: false, errors: ["Not valid UTF-8"] }; }
  },
  extractMetadata: async (i) => {
    const text = new TextDecoder().decode(i.bytes);
    const m = emptyMetadata();
    m.fields = { lines: text.split("\n").length, characters: text.length };
    return m;
  },
};
```

## Registered adapters

The list below is generated from the registry.
