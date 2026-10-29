/**
 * The universal data model. Each entity has a stable UUID, a readable EBiT ID,
 * typed columns for common fields and two JSON fields: `metadata` (normalised)
 * and `original_metadata` (exactly as received). Missing values stay null.
 */
export const ENTITY_KINDS = ["object", "asset", "observation", "dataset", "interpretation", "annotation"] as const;
export type EntityKind = (typeof ENTITY_KINDS)[number];

export interface EntityDescription {
  kind: string;
  table: string;
  summary: string;
  phase: number;
}

/** Single source of truth for the entity list shown in docs and the app. */
export const ENTITIES: EntityDescription[] = [
  { kind: "EBiTObject", table: "objects", summary: "A physical or conceptual thing with a persistent identity (a tree, a site, a sensor station).", phase: 1 },
  { kind: "Asset", table: "assets", summary: "An original file, recording or dataset. Originals are kept unchanged; versions record derived copies.", phase: 1 },
  { kind: "AssetVersion", table: "asset_versions", summary: "One version of an asset. The original version can never be changed or deleted.", phase: 1 },
  { kind: "Observation", table: "observations", summary: "A recorded measurement, sighting, event or report, optionally linked to an object.", phase: 1 },
  { kind: "Dataset", table: "datasets", summary: "A curated collection. It can be published only when its rights permit redistribution.", phase: 1 },
  { kind: "Relationship", table: "relationships", summary: "A typed link between any two entities (e.g. asset depicts object).", phase: 1 },
  { kind: "ProvenanceEvent", table: "provenance_events", summary: "Append-only record of ingestion, transformation, verification or publication.", phase: 1 },
  { kind: "RightsRecord", table: "rights_records", summary: "Source, licence, attribution, permitted uses and restrictions.", phase: 1 },
  { kind: "AuditLog", table: "audit_log", summary: "Append-only record of who changed what.", phase: 1 },
  { kind: "ProcessingJob", table: "processing_jobs", summary: "A trackable task with status, attempts and errors.", phase: 2 },
  { kind: "Interpretation", table: "interpretations", summary: "An AI or computed result, with model, version and confidence. Never a verified fact.", phase: 5 },
  { kind: "Annotation", table: "annotations", summary: "A label, box, transcript or classification.", phase: 5 },
  { kind: "VerificationEvent", table: "verification_events", summary: "A human or automated quality-control decision.", phase: 5 },
];
