# Architecture

```text
 Input Gateway      uploads · URLs · APIs · webhooks · sensor feeds
        |
 Ingestion Engine   validate · SHA-256 hash · duplicate check · store original · assign EBiT ID
        |
 Adapter Registry   one adapter per format (image, csv, geojson, darwin-core, sensor, ...)
        |
 Metadata Engine    typed columns + normalised JSON + original JSON (never invented)
        |
 Processing Jobs    queued, retried, idempotent
        |  \
        |   AI Providers   interchangeable; optional
        |
 Identity Graph     objects · assets · observations · datasets · typed relationships
        |
 Verification       interpretations vs annotations vs verified findings
        |
 Data Products      explorer · maps · datasets · exports · public API
```

Rights and provenance cut across every layer: each step writes a provenance event, and every record can carry a rights record.

## Stack

| Layer | Technology |
|---|---|
| UI and server | TanStack Start (React 19, TypeScript), server functions |
| Database | PostgreSQL with row-level security |
| Files | Private object storage bucket `originals` (50 MB per file in the MVP) |
| Auth | Email/password and Google |
| Validation | Zod at every server boundary |

## Code layout

```text
src/core/        data model, IDs, rights rules (framework-free, unit-tested)
src/adapters/    adapter contract + registry; one folder per adapter
src/providers/   AI providers behind one interface (Phase 5)
src/functions/   server functions (*.functions.ts)
src/routes/      pages; /docs is this documentation; /api for the public API (Phase 7)
src/modules/     domain modules, e.g. biodiversity (Phase 4)
docs/            these pages as markdown — the same files the site renders
```

## Multi-organisation

Every record belongs to an organisation. Members have one of four roles:

| Role | Can |
|---|---|
| viewer | read |
| contributor | read, create, edit |
| curator | contributor + delete |
| admin | curator + manage the organisation |

Access is enforced in the database, not just the UI. A personal workspace is created for each new account.
