# Data model

Every entity has:

- `id` — a UUID, stable forever
- `ebit_id` — a readable ID like `AST-3F9A01C2B7` (prefixes `ORG`, `OBJ`, `AST`, `OBS`, `DST`)
- `org_id` — owning organisation
- `metadata` — normalised fields (JSON)
- `original_metadata` — metadata exactly as received (JSON)
- `created_by`, `created_at`, `updated_at`

Frequently queried fields (time, latitude, longitude, type, status) are typed columns with indexes. Everything domain-specific goes in JSON, so no domain is forced into a rigid schema.

## Entities

| Entity | Table | Purpose |
|---|---|---|
| EBiTObject | `objects` | A physical or conceptual thing with a persistent identity. Supports parent/child (`parent_id`). |
| Asset | `assets` | An original file or resource: kind, MIME type, size, SHA-256, storage path, source, capture time, location, device, ingestion status, adapter and version. |
| AssetVersion | `asset_versions` | Versions of an asset. The row marked `is_original` cannot be changed or deleted. |
| Observation | `observations` | A measurement, sighting or event: type, time, location, numeric/text value, unit, verification status. Optional `object_id`. |
| Dataset | `datasets` + `dataset_items` | A curated collection of any entities. |
| Relationship | `relationships` | `from_kind/from_id —rel_type→ to_kind/to_id`. Duplicate and self links are rejected. |
| RightsRecord | `rights_records` | State, licence, attribution, source, permitted uses, restrictions, AI-training flag, reviewer. |
| ProvenanceEvent | `provenance_events` | Append-only: event type, agent, software + version, inputs, outputs, details. |
| AuditLog | `audit_log` | Append-only: actor, action, target, details. |

| ProcessingJob | `processing_jobs` | One per task: type, idempotency key (unique per organisation), status `queued/running/succeeded/failed`, attempts (max 3), adapter + version, error, result. |

Phase 5 adds `ai_jobs` (consent, attempts, retry time and durable status), `ai_controls` (organization pause state), immutable `interpretations` (model, input, output, confidence and latency), immutable `annotations` (AI labels and values), and append-only `verification_events` (human decision, reviewer and evidence). These tables require curator access. See [AI & human verification](/docs/ai-verification).

Phase 6 adds `sensors` (optional physical-object link), `datastreams` (property, unit, rights), `measurements` (append-only timestamp/value and original row metadata), and `sensor_keys` (stream-scoped hash, prefix and revocation). Composite foreign keys enforce organization ownership; stream/timestamp uniqueness prevents duplicate readings. See [Sensors & time series](/docs/sensors).

Phase 4 adds `taxa` (source-supplied names/classification), `biodiversity_observations` (one per universal observation, safe coordinates and Darwin Core fields), and `biodiversity_details` (curator-only exact coordinates, locality, recorder and original row). See [Biodiversity & Darwin Core](/docs/biodiversity) for mappings and export safeguards.

## Guarantees enforced by the database

- One asset per file per organisation: a unique index on `(org_id, sha256)` detects duplicate uploads.
- Provenance and audit rows cannot be updated or deleted.
- Original asset versions cannot be updated or deleted.
- A dataset cannot be marked `published` unless its rights record is `permitted_redistribution`.
- Coordinates must be valid (latitude −90..90, longitude −180..180).
- Row-level security limits every read and write to members of the owning organisation.

## Relationships: examples

| From | Type | To |
|---|---|---|
| asset | `depicts` | object |
| asset | `evidence_for` | observation |
| observation | `observes` | object |
| object | `located_within` | object |
| asset | `derived_from` | asset |

## Public API

| Table | Purpose |
|---|---|
| `api_keys` | Workspace-scoped read-only keys: name, visible prefix, SHA-256 hash (never readable by app users), per-minute limit, revocation time, last use. Admin-only reads; created and revoked through `issue_api_key` / `revoke_api_key`. |
| `api_usage` | Per-key, per-minute request counters used for rate limiting. Server-only; rows older than an hour are pruned. |
