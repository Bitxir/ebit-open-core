# AI & human verification

Phase 5 adds optional on-demand analysis. Uploading a file never calls AI.

## Supported tasks

- Image description and species suggestion: JPEG, PNG, WebP.
- Document extraction: PDF and plain text. Plain-text requests include at most 40,000 characters.
- Inputs must be ready, no larger than 10 MB, and have `permitted_processing` or `permitted_redistribution` rights. CSV/TSV, JSON, GeoJSON and biodiversity details are not AI inputs.
- Curators and administrators must explicitly confirm permission to send private content to Lovable AI. Calls consume workspace credits. Processing permission is not AI-training permission; the training flag is unchanged.

## Provider interface

`src/providers/types.ts` defines `AnalysisProvider`. Implement `analyze` in a server-only module returning a validated structured interpretation, model identity, nullable reported version, gateway run ID and elapsed milliseconds. The built-in implementation uses the Lovable AI Gateway Responses API with streamed structured output, request-local tracing, no SDK retries and server-only credentials.

Outputs contain a summary, nullable suggested species, nullable model-estimated confidence, nullable extracted text and up to 12 label/value annotations. Confidence is uncalibrated, not a verification score. No timestamps, taxonomy validation or missing metadata are invented. Model version remains absent if not reported.

## Durable jobs

`ai_jobs` stores explicit requests separately from adapter jobs. One organization/asset/task combination is unique. Compare-and-set claiming prevents concurrent workers from billing duplicate requests. The current runner executes when the user requests analysis or presses Run; it is not an autonomous scheduler and does not continue after a disconnected or terminated request. A job left running needs operational inspection rather than an automatic billed replay.

Only 429 and 5xx permit another attempt, with 30 then 60 seconds of minimum backoff, capped at three attempts. The UI enables explicit retry after its due time. No automatic background retry is configured. Permanent invalid/empty/failed-schema outputs are terminal. 401/402/403 pause organization AI work durably; an administrator restores access and explicitly resumes work. Denials must be resolved before resuming. Original files and successful results are never overwritten.

## Human review

Processing and Verification pages show original model outputs as **AI prediction**, separately from **Human status**. Status is unverified until an authorized curator or administrator submits verify/reject/needs-review with non-empty evidence. Each decision is appended to `verification_events` with reviewer and timestamp; provenance and audit entries are written atomically. Earlier decisions remain visible.

Interpretations and annotations are immutable. Human decisions do not rewrite original observations or assert that a species identification has independent taxonomic validation. Reads require curator access because inferred content and review evidence may contain sensitive information.

## Limits and verification

Private originals may contain sensitive content, including visible location clues and personal information. Review and authorize them before analysis; do not submit confidential content that must not reach an AI provider. There is no automatic privacy-redaction guarantee. Precise biodiversity details and tabular originals are excluded.

End-to-end authenticated ingestion, biodiversity import/export and AI review require a real signed-in account. Unit tests cover rights exclusion, format/task eligibility, missing predictions, review status and retry semantics. Live verification status is recorded in the project roadmap, not implied by passing unit tests.