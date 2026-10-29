# Explorer & identity graph

## Data Explorer
Search one kind at a time — **files** (assets), **objects**, **observations** or **datasets** — inside your workspace. Filters:

| Filter | Applies to | Notes |
|---|---|---|
| Text | all | Matches name / file name / type / EBiT ID (case-insensitive) |
| Rights | all | Rights state of the item's rights record |
| Status | files, observations, datasets | Ingestion status, verification status, or draft/published |
| Added from / to | all | By date the record was created |
| Area | files, objects, observations | `minLng,minLat,maxLng,maxLat` (GeoJSON order); only items with coordinates match |

Results are paginated, 25 per page. Filter state lives in the URL, so a search can be bookmarked or shared with workspace members.

Contributors can create **objects**, **observations** and **datasets** by hand. Their rights always start as `unknown`; history records a `created` event by a human.

## Item pages
Every item has a page at `/app/item/<kind>/<id>` showing its details, extracted metadata, links in both directions, the datasets it belongs to, its rights record and its full history (provenance events, oldest first). Files also list their versions; the original is locked.

Observations are shown with their verification status; anything not marked `verified` says so.

## Relationship types
Links are typed and directional. The allowed combinations are defined in `src/core/graph.ts` and enforced on the server:

| Type | From | To |
|---|---|---|
| depicts | file | object, observation |
| is evidence for | file | observation |
| observed | observation | object |
| is part of | object | object |
| is located at | object, observation, file | object |
| is derived from | file | file |
| is related to | any | any |

An item cannot link to itself, both ends must be in the same workspace, and duplicate links are rejected. Creating or removing a link writes a provenance event and an audit entry. Contributors can link; only curators and admins can remove links.

## Rights editing
Rights changes follow the allowed transitions (for example `unknown` must go to `under_review` before it can become `permitted_redistribution`). Every change records the reviewer and time and writes an audit entry.

## Datasets
A dataset groups files, objects and observations. Publishing is blocked by the database unless the dataset's own rights are `permitted_redistribution`. Export arrives with Darwin Core in Phase 4.

## Administration
Shows workspace members with their roles and the latest 100 audit log entries. The audit log is append-only. Inviting members is not built yet.
