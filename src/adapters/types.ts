/**
 * The adapter contract. Every input format (image, CSV, GeoJSON, sensor feed, ...)
 * is handled by one adapter implementing this interface. The core never
 * special-cases a format; it only calls these methods.
 */
export interface AdapterInput {
  fileName: string;
  mimeType: string | null;
  bytes: Uint8Array;
}

export interface NormalizedMetadata {
  capturedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  device: string | null;
  /** Normalised, adapter-specific fields. */
  fields: Record<string, unknown>;
  /** Metadata exactly as found in the source, unmodified. */
  original: Record<string, unknown>;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export interface AdapterDescriptor {
  id: string;
  version: string;
  name: string;
  summary: string;
  formats: { mime: string; extensions: string[] }[];
  inputMethods: ("upload" | "url" | "api" | "webhook")[];
  extracts: string[];
  capabilities: string[];
  errors: string[];
  provenance: string[];
}

export interface Adapter {
  descriptor: AdapterDescriptor;
  detect(input: AdapterInput): boolean;
  validate(input: AdapterInput): Promise<ValidationResult>;
  extractMetadata(input: AdapterInput): Promise<NormalizedMetadata>;
}

/** Helper for adapters: build metadata where anything not found stays null. */
export function emptyMetadata(): NormalizedMetadata {
  return { capturedAt: null, latitude: null, longitude: null, device: null, fields: {}, original: {} };
}
