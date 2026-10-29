# Public REST API

A read-only API for **published datasets whose rights permit redistribution**. Everything else stays private.

## Authentication

Workspace admins create keys on **Developer** in the app. A key looks like `ebit_api_` + 64 hex characters, is shown once, and only its SHA-256 hash is stored. Keys can be revoked at any time and stop working immediately.

```
Authorization: Bearer ebit_api_...
```

## Rate limits

Each key allows 60 requests per minute by default. Exceeding it returns `429`; the counter resets each minute.

## Endpoints

### `GET /api/public/v1/datasets?page=1`

Published datasets in the key's workspace whose rights state is `permitted_redistribution`. 100 per page.

```json
{ "page": 1, "data": [ { "id": "DST-1A2B3C4D5E", "title": "...", "description": "...", "license": "CC0-1.0", "attribution": "...", "items": 152, "created_at": "..." } ] }
```

### `GET /api/public/v1/datasets/{id}/items?page=1`

Items in one dataset. An item is included only when **its own** rights also permit redistribution.

- `object`: id, name, type, description, latitude, longitude, license, attribution
- `observation`: id, type, observed_at, latitude, longitude, value, unit, verification_status, scientificName, sensitive, license, attribution
- `asset`: id, kind, MIME type, file name, size, SHA-256, license, attribution

Never returned: original files or download links, exact coordinates of sensitive species (only the generalised 0.1° cell stored on the observation), file GPS metadata, recorder details, original rows, and AI output.

## Errors

| Status | Meaning |
|---|---|
| 400 | Bad page number or dataset ID |
| 401 | Missing, malformed, invalid or revoked key |
| 404 | Dataset not found, unpublished, or rights do not permit redistribution |
| 429 | Rate limit exceeded |

All responses are JSON `{ "error": "..." }` on failure and send `Cache-Control: no-store`. CORS allows `GET` from any origin.

## Example

```bash
curl -H "Authorization: Bearer $EBIT_API_KEY" https://YOUR-HOST/api/public/v1/datasets
```

## How it is enforced

The endpoint hashes the key and calls one database function, `api_read`, which only the server can execute. It checks the key, counts usage, and applies the rights filters inside the database, so no other code path can widen access.
