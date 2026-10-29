/**
 * Human-readable EBiT IDs. The database generates them (public.ebit_id),
 * this module parses and validates them in app code.
 * Format: PREFIX-XXXXXXXXXX (10 uppercase hex characters).
 */
export const ID_PREFIXES = {
  ORG: "organization",
  OBJ: "object",
  AST: "asset",
  OBS: "observation",
  DST: "dataset",
} as const;
export type IdPrefix = keyof typeof ID_PREFIXES;

const PATTERN = /^(ORG|OBJ|AST|OBS|DST)-[0-9A-F]{10}$/;

export function isEbitId(value: string): boolean {
  return PATTERN.test(value);
}

export function parseEbitId(value: string): { prefix: IdPrefix; entity: string } | null {
  if (!isEbitId(value)) return null;
  const prefix = value.slice(0, 3) as IdPrefix;
  return { prefix, entity: ID_PREFIXES[prefix] };
}
