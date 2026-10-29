# EBiT Open Core

EBiT Open Core is open-source infrastructure for **physical-world data**. It ingests files, datasets and sensor feeds; gives every object, asset and observation a persistent identity; connects them in an identity graph; and records where every piece of data came from, what was done to it, and who may use it.

It starts with biodiversity and environmental monitoring, and is designed so new domains plug in as modules without changing the core.

## Principles

- **Originals are never changed.** Every transformation creates a new version and a provenance record.
- **Missing metadata stays missing.** Adapters never invent dates, locations or devices.
- **AI is a suggestion, not a fact.** Machine results are stored as interpretations and stay separate from human-verified findings.
- **Public is not permission.** Rights default to *unknown*; publishing requires explicit redistribution rights.
- **Standards first.** Darwin Core for biodiversity, OGC SensorThings for sensors, STAC evaluated for geospatial assets.
- **Low cost.** Runs on one database, object storage and serverless functions. AI is optional.

## Status

This documentation only describes what is built and working. See the [roadmap](/docs/roadmap) for what is planned.

| Phase | Scope | Status |
|---|---|---|
| 1 | Foundation: identities, assets, observations, relationships, rights, provenance | Done |
| 2 | Ingestion: image, document, CSV, JSON, GeoJSON adapters | Done |
| 3 | Data explorer and identity graph | Planned |
| 4 | Biodiversity and Darwin Core | Planned |
| 5 | AI and verification | Planned |
| 6 | Sensors | Planned |
| 7 | Public API and release | Planned |

## Where to start

- [Architecture](/docs/architecture) — how the pieces fit
- [Data model](/docs/data-model) — every entity and table
- [Ingestion](/docs/ingestion) — how a file becomes an asset
- [Adapters](/docs/adapters) — the adapter contract, the built-in adapters and how to write one
- [Rights & provenance](/docs/rights-provenance)
- [Self-hosting](/docs/self-hosting)
