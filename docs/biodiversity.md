# Biodiversity & Darwin Core

Phase 4 adds an organisation-scoped occurrence collection, manual entry, explicit import from stored Darwin Core originals, and an OpenStreetMap map. Every occurrence is also a universal observation with an EBiT ID, rights, relationships and append-only provenance. Names are supplied by the source: no taxonomy lookup, identification or verification is performed.

## Import

Curators/admins upload CSV or TSV through Ingestion. A `scientificName` header selects the dedicated `darwin-core` adapter before the general CSV adapter. Files contain 1–500 rows; malformed rows reject the file, without discarding the stored original. Uploads retain the existing 50 MB limit.

In Biodiversity, choose Import and a processed original. The server rechecks its SHA-256 and size before parsing. All rows save in one transaction, together with rights and provenance. Repeat imports skip existing source-row pairs and occurrence IDs rather than multiplying observations. Unknown columns and exact original strings remain in the restricted original row and unchanged stored file.

Imports default to marking every occurrence sensitive. Disable that option only after reviewing the source; a row with `sensitive=true` or `1` remains sensitive regardless. Contributors can add manual occurrences; curators/admins are required to upload and import tabular originals. All CSV/TSV asset rows and original files, including earlier uploads, now require curator access because they can contain sensitive coordinates.

## Field mapping

| Darwin Core column | Stored field |
|---|---|
| scientificName | taxa.scientific_name; observations.value_text |
| kingdom, family, genus, taxonRank | taxa fields; no inferred values |
| occurrenceID | stable source identifier (generated if absent; opaque if sensitive) |
| eventDate | biodiversity_observations.event_date; ISO date/timestamp, preserving date precision |
| basisOfRecord | biodiversity_observations.basis_of_record; standard supported values |
| decimalLatitude / decimalLongitude | curator-only biodiversity_details; safe coordinates in observations and biodiversity_observations |
| coordinateUncertaintyInMeters | non-negative uncertainty; at least 16,000 m for generalised coordinates |
| recordedBy, locality | curator-only biodiversity_details |
| habitat | public workspace field for non-sensitive records; withheld for sensitive records |
| sensitive | EBiT extension: true/false or 1/0 |
| all original columns | biodiversity_details.original_metadata, unchanged strings |

Coordinates must be provided together, latitude −90..90 and longitude −180..180. Missing dates, coordinates and basis of record remain null. Existing taxon names are reused per organisation; conflicting classifications are preserved in original rows, not silently overwritten.

## Location protection

Sensitive locations are represented by centres of 0.1-degree cells, not exact coordinates. The map, explorer, graph and universal observation details read the same generalised values. Exact locations, locality, recorder and source rows are in a separate table with curator/admin-only read policies. Direct writes to biodiversity tables are not available to ordinary clients. Original tabular files are also protected in storage. No sample observations are inserted.

Sensitivity is a source/reviewer decision; EBiT does not automatically identify threatened taxa. This phase protects imported tabular occurrences, not arbitrary pre-existing photo EXIF or other files that were never marked as biodiversity records. Review those originals before sharing workspace access.

## Export

The Darwin Core CSV button exports the entire workspace occurrence collection, not just the filtered page. The database blocks export unless **every occurrence and each source original** explicitly permits redistribution. Update occurrence rights through its Rights, links & provenance page; update source rights on its file page. Unknown and restricted rights never qualify.

Sensitive exports remain generalised even for admins. Precise location, locality, recorder, habitat and original rows are withheld; `informationWithheld` and `dataGeneralizations` document the loss of precision. Formula-like spreadsheet values are escaped. Export is CSV Occurrence core, not a zipped Darwin Core Archive. No GBIF publishing or public occurrence API is included in this phase.

## Map and browsing

Search by scientific name and filter by event date or sensitivity. Results are paginated at 25; the map shows only the current page's located records, with distinct sensitive markers. It uses Leaflet and free OpenStreetMap tiles with attribution, native zoom/pan and tile-failure feedback. Records without coordinates remain in the list.