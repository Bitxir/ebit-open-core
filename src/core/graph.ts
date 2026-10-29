/**
 * Identity graph rules: which relationships may connect which kinds of entity.
 * Framework-free so it can be reused by any client or server.
 */
export const GRAPH_KINDS = ["object", "asset", "observation", "dataset"] as const;
export type GraphKind = (typeof GRAPH_KINDS)[number];

export const REL_TYPES = {
  depicts: { label: "depicts", from: ["asset"], to: ["object", "observation"] },
  evidence_for: { label: "is evidence for", from: ["asset"], to: ["observation"] },
  observed: { label: "observed", from: ["observation"], to: ["object"] },
  part_of: { label: "is part of", from: ["object"], to: ["object"] },
  located_at: { label: "is located at", from: ["object", "observation", "asset"], to: ["object"] },
  derived_from: { label: "is derived from", from: ["asset"], to: ["asset"] },
  related_to: { label: "is related to", from: GRAPH_KINDS, to: GRAPH_KINDS },
} as const satisfies Record<string, { label: string; from: readonly GraphKind[]; to: readonly GraphKind[] }>;
export type RelType = keyof typeof REL_TYPES;
export const REL_TYPE_IDS = Object.keys(REL_TYPES) as RelType[];

export type LinkCheck = { ok: true } | { ok: false; reason: string };

export function checkLink(fromKind: GraphKind, fromId: string, rel: RelType, toKind: GraphKind, toId: string): LinkCheck {
  const def = REL_TYPES[rel];
  if (!def) return { ok: false, reason: "Unknown relationship type." };
  if (fromKind === toKind && fromId === toId) return { ok: false, reason: "An item cannot be linked to itself." };
  if (!(def.from as readonly string[]).includes(fromKind)) return { ok: false, reason: `A ${fromKind} cannot "${def.label}" something.` };
  if (!(def.to as readonly string[]).includes(toKind)) return { ok: false, reason: `"${def.label}" cannot point to a ${toKind}.` };
  return { ok: true };
}

/** Relationship types valid between two kinds, for building link pickers. */
export function relTypesFor(fromKind: GraphKind, toKind: GraphKind): RelType[] {
  return REL_TYPE_IDS.filter((r) => (REL_TYPES[r].from as readonly string[]).includes(fromKind) && (REL_TYPES[r].to as readonly string[]).includes(toKind));
}

export type BBox = { minLat: number; minLng: number; maxLat: number; maxLng: number };

/** Parses "minLng,minLat,maxLng,maxLat" (GeoJSON order). Returns null if invalid. */
export function parseBBox(input: string): BBox | null {
  const parts = input.split(",").map((s) => Number(s.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return null;
  if (minLat > maxLat || minLng > maxLng) return null;
  return { minLat, minLng, maxLat, maxLng };
}
