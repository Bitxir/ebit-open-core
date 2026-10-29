# Roadmap

| Phase | Delivers |
|---|---|
| **1 — Foundation** (done) | Organisations and roles, objects, assets, versions, observations, datasets, relationships, rights, provenance, audit log, private file storage, sign-in, docs site |
| **2 — Ingestion** (done) | Upload flow with hashing and duplicate detection; adapters for JPEG/PNG/WebP (EXIF), PDF/text, CSV, JSON, GeoJSON; processing jobs |
| **3 — Explorer & graph** (done) | Search and filters, item pages, relationship linking, rights editing, history timeline, datasets with guarded publishing, members and audit log |
| **4 — Biodiversity** (done) | Taxa and occurrences, atomic Darwin Core CSV/TSV import, rights-guarded CSV export, Leaflet/OpenStreetMap map, curator-only originals and exact details |
| **5 — AI & verification** (on-demand flow verified) | Server-only provider interface, optional image/PDF/text analysis, durable on-demand jobs with explicit backoff retries, immutable interpretations/annotations, evidence-backed curator review. Autonomous scheduling and interrupted-job recovery are not configured. |
| **6 — Sensors** (verified) | Device/stream registration, CSV/JSON original imports, append-only readings, UTC filters and charts, scoped revocable ingestion keys and endpoint |
| **7 — Public API & release** (released in v1.0.0) | Hashed, revocable read-only API keys; per-key rate limits; endpoints for published redistributable datasets and items; API reference; real CC0/PDDL example datasets for every adapter (`docs/examples`); Apache-2.0 code and CC BY 4.0 docs |

Future (not committed): eDNA, acoustic monitoring, camera traps, drone and satellite imagery, GBIF/OBIS connectors.
