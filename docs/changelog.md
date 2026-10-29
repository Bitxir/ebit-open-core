# Changelog

All notable changes are recorded here. Versions follow [Semantic Versioning](https://semver.org): MAJOR for breaking API or data-model changes, MINOR for new features, PATCH for fixes. The format follows [Keep a Changelog](https://keepachangelog.com).

## [1.0.0] — 2026-10-29

First public release of EBiT Open Core.

### Added
- **Foundation:** workspaces with admin/curator/contributor/viewer roles, persistent EBiT IDs, objects, files, observations, datasets, relationships, rights records, append-only provenance and audit log, private storage of originals.
- **Ingestion:** fingerprinted uploads with duplicate detection and resumable processing; adapters for images (EXIF), PDF/text documents, CSV, JSON, GeoJSON, Darwin Core and sensor time series.
- **Explorer & identity graph:** search and filters, item pages, typed links, rights editing, datasets that can only be published with redistribution rights.
- **Biodiversity:** Darwin Core import/export, taxa, map, generalised public coordinates for sensitive species with curator-only exact details.
- **AI & verification:** optional, consented image/document/species analysis; immutable AI predictions; evidence-backed human review.
- **Sensors:** devices, datastreams, file imports, charts, revocable stream-scoped device keys and ingestion endpoint.
- **Public REST API v1:** hashed, revocable read-only keys, 60 requests/minute per key, endpoints for published redistributable datasets and their items.
- **Example data:** real CC0, ODC-PDDL and public-domain files for every adapter in `docs/examples` with sources.
- **Licensing:** code Apache-2.0, documentation CC BY 4.0.

### Known limitations
- AI jobs run on demand; there is no automatic background runner yet.
- Files are limited to 50 MB; video, audio and satellite imagery adapters are not included.
