# Rights & provenance

## Rights states

| State | Meaning | Can process (incl. AI) | Can publish / export |
|---|---|---|---|
| `unknown` | Default. Nothing is assumed. | No | No |
| `under_review` | Someone is checking the source and licence. | No | No |
| `permitted_processing` | May be processed inside the organisation. | Yes | No |
| `permitted_redistribution` | May be shared outside the organisation. | Yes | Yes |
| `restricted` | Must not be processed or shared. | No | No |

Allowed changes: `unknown → under_review | restricted`; `under_review → any`; `permitted_processing → permitted_redistribution | under_review | restricted`; `permitted_redistribution → under_review | restricted`; `restricted → under_review`. Nothing jumps straight from unknown to redistribution.

Data being publicly available on the internet does **not** grant redistribution or AI-training rights. AI training has its own flag (`ai_training_allowed`, default off).

## Provenance

Every ingestion, transformation, verification and publication writes an append-only event:

| Field | Example |
|---|---|
| `event_type` | `ingested`, `metadata_extracted`, `derived`, `verified`, `published` |
| `agent` | `user`, `adapter:image`, `provider:lovable-ai` |
| `software`, `software_version` | `adapter:image`, `1.0.0` |
| `inputs`, `outputs` | IDs of what went in and came out |
| `details` | hashes, errors, parameters |

Events cannot be edited or deleted, by anyone.
