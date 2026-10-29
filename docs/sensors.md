# Sensors & time series

Phase 6 provides devices, datastreams, original readings and time-series charts. It is SensorThings-inspired, not a complete OGC SensorThings API.

## Model mapping

| SensorThings concept | EBiT record |
|---|---|
| Thing | Optional existing physical object linked to a sensor |
| Sensor | Registered device with name and description |
| Datastream | Device-linked stream, observed property, unit and rights |
| Observation | Append-only timestamp/value measurement |

There are no invented locations or measurements. Stream rights default to unknown; readings remain unverified. Charts display up to 100 actual readings on the current page, with pagination and UTC date filters.

## CSV/TSV and JSON originals

Upload through Ingestion. The registered `sensor-timeseries` adapter detects exact `timestamp` and `value` CSV headers, or JSON arrays / objects containing a `measurements` array. The adapter validates 1–1000 rows and extracts count and supplied time range. Imports are separate and explicit: choose a device stream, then Import original.

Required: an ISO timestamp with timezone (`Z` or offset) and a finite number. Zero and negative numbers are supported. Units and properties belong to the selected stream and are never inferred from a file. Extra columns/JSON properties remain in each measurement's original metadata. Stored files remain unchanged; their SHA-256 and size are rechecked before import. CSV/TSV originals require curator access, as do all sensor file imports.

```csv
timestamp,value,quality
2026-10-29T10:00:00Z,0,software-test
2026-10-29T10:01:00Z,2.5,software-test
```

These are illustrative software-test values, not real observations.

## Device ingestion

Curators/admins issue a key for a single stream. Copy it immediately; the full key is not stored and is shown only once. Revocation takes effect on later requests. Use HTTPS outside local development, do not embed keys in public clients, URLs or repositories.

`POST /api/public/sensors/ingest`

Headers: `Content-Type: application/json`, `Authorization: Bearer <device-key>`.

```json
{"measurements":[{"timestamp":"2026-10-29T10:02:00Z","value":3.2,"quality":"software-test"}]}
```

The key determines the organization and datastream; clients cannot select another stream. Response: `{"added":1,"skipped":0}`. No read endpoint is exposed here.

Limits: 256 KiB body, 1–1000 rows. Invalid data rejects the entire batch. Identical timestamps/values replay safely; a different value at an existing timestamp rejects the whole batch. Measurements cannot be overwritten or deleted through ordinary access.

Responses: 200 successful/replayed; 400 invalid body; 401 missing/invalid/revoked key; 409 invalid/conflicting batch; 413 body too large; 415 unsupported content type. There is no built-in request-rate limiter in this phase; protect keys and revoke compromised ones.

## Permissions and provenance

Members read organization-scoped devices, streams and readings. Contributors register devices/streams. Curators import originals and issue/revoke keys. Public and ordinary authenticated callers cannot directly mutate sensor tables or call device-ingestion RPCs. Imports and device submissions append audit entries in the same transaction; imports also append source-asset provenance, and device submissions append physical-object provenance when the sensor is linked to an object. Original row metadata is retained and may be sensitive; do not submit private location/person fields into shared measurement metadata.

## Extending the adapter

Add providers/formats as independent adapters under `src/adapters/`, register them, and implement the shared descriptor/validation/metadata contract. Reuse the sensor module's strict timestamp/value normalization only where the source actually supplies those fields. OGC discovery, MQTT, automatic polling, hardware drivers and broader developer APIs are not implemented.