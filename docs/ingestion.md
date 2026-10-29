# Ingestion

Every file goes through the same steps, whatever its format.

```text
 1. Fingerprint   browser computes SHA-256 of the file
 2. Register      server validates name, type and size (max 50 MB),
                  checks for a duplicate, records rights, creates the asset
                  (status awaiting_upload) and an ingest job
 3. Upload        original stored unchanged in private storage:
                  originals/<organisation>/<asset>/<file>
 4. Process       server downloads the original, re-checks size and SHA-256,
                  picks the adapter, validates, extracts metadata
 5. Record        asset updated (status ready), original version 1 saved,
                  provenance events written, job marked succeeded
```

## Duplicates

The same bytes in the same organisation are stored once. Re-uploading a file returns the existing asset's EBiT ID instead of creating a copy. The database enforces this with a unique fingerprint per organisation, so two simultaneous uploads cannot both succeed.

If an earlier upload of the same file was interrupted, it is resumed rather than reported as a duplicate.

## Failures and retries

- A failed step never deletes or changes the stored original.
- The job records the error in plain language; the asset is marked `failed`.
- Each job can be attempted up to 3 times (**Retry** in the app). Retrying is safe: the original version and provenance are not duplicated.
- Every failure writes an `ingestion_failed` provenance event.

## What is recorded

| Where | What |
|---|---|
| Asset columns | file name, MIME type, size, SHA-256, storage path, source, capture time, latitude, longitude, device, status, adapter + version |
| `metadata` | the adapter's normalised fields (e.g. columns and row count for CSV) |
| `original_metadata` | metadata exactly as found (e.g. the full EXIF block) |
| Rights record | permission state, licence, attribution, source — chosen per upload batch, default *Unknown* |
| Provenance | `registered` → `ingested` → `metadata_extracted` (or `ingestion_failed`) |

Fields the file does not contain stay empty and are shown as *not recorded*.

## Permissions

Viewers can see uploads; contributors and above can upload and retry. Storage access follows the same organisation membership rules as the database.

## Limits (current)

- 50 MB per file, 20 files per batch, processed one at a time to keep memory and cost low.
- Upload from the app only. URL, API and webhook ingestion arrive with the public API (Phase 7).
