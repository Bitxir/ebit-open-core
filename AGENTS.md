<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# EBiT Open Core rules
- Core logic (model, IDs, rights) lives in `src/core/` with no framework imports, so it can be published and unit-tested standalone.
- Every input format is an adapter in `src/adapters/<id>/` registered in `src/adapters/registry.ts`; the core never special-cases formats, so new formats need no core changes.
- Adapter docs are rendered from adapter descriptors, so docs cannot drift from code.
- Documentation lives as markdown in `/docs` and is rendered by `/docs/$slug`; one source for the site and the repository. Document only working features.
- Every table is org-scoped with RLS via `public.is_org_member(org, min_role)`; roles are never read from user-editable data.
- Provenance, audit log and original asset versions are append-only, enforced by database triggers.
- Dataset publishing is blocked in the database unless rights are `permitted_redistribution`.
- App sections are listed in `src/lib/sections.ts` with the phase they go live; unbuilt sections show an honest placeholder, never sample data.
- Client-callable server functions live in `src/functions/*.functions.ts`; `src/server/` is blocked from client bundles by the template.
- Ingestion is two-step (register → browser uploads original to private storage → server re-hashes and runs the adapter) so large files never pass through a server function and the stored original is verified.
- Allowed relationship types and their endpoint kinds live in `src/core/graph.ts` and are checked server-side before insert, so the UI and API share one rulebook.
- Biodiversity writes and exports use atomic database RPCs; exact locations and original rows live in curator-only details, while graph observations store only safe coordinates. This prevents alternate read paths leaking sensitive locations.
- Tabular originals and their asset records require curator access because CSV/TSV files can contain precise sensitive locations; map code loads lazily behind ClientOnly to keep Leaflet out of SSR.
- AI providers implement the server-only AnalysisProvider interface; AI jobs and results are separate from ingestion and source observations, with curator-only reads to contain sensitive inferred content.
- Human review is an append-only atomic RPC; interpretations never contain a mutable verified flag, so only separate review events establish human status.
- Sensor measurements are append-only and written through atomic RPCs; datastream-scoped device keys are hashed and only the service-role endpoint can redeem them, preventing direct or cross-stream writes.
- The public read API (`/api/public/v1/*`) authenticates hashed `ebit_api_` keys and applies rate limits and all rights/publication filters inside the service-role-only `api_read` database function, so route code cannot widen access.
- Real example datasets for every adapter live in `docs/examples/` with attribution in SOURCES.md and are covered by `src/adapters/examples.test.ts`, so adapters are tested against real data.
