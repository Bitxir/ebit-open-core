import { emptyMetadata, type Adapter } from "../types";
import { extensionOf } from "@/core/ingest";
import { isDarwinCore, parseOccurrences } from "@/modules/biodiversity/darwin-core";

export const darwinCoreAdapter: Adapter = {
  descriptor: {
    id: "darwin-core", version: "1.0.0", name: "Darwin Core occurrences",
    summary: "Validates Darwin Core CSV/TSV occurrences without inferring taxonomy or missing values. Original files are restricted to curators and admins; import is a separate, explicit step.",
    formats: [{ mime: "text/csv", extensions: [".csv", ".tsv"] }], inputMethods: ["upload"],
    extracts: ["row count", "scientificName", "eventDate", "basisOfRecord", "coordinates", "taxonomic fields", "locality", "habitat", "recordedBy", "sensitive flag"],
    capabilities: ["1–500 rows per import", "strict validation", "immutable original", "explicit occurrence import", "sensitive location protection"],
    errors: ["Missing scientificName column", "Invalid date, basis of record or coordinates", "Malformed CSV", "More than 500 rows"],
    provenance: ["registered", "ingested", "metadata_extracted", "biodiversity_imported"],
  },
  detect: (i) => [".csv", ".tsv"].includes(extensionOf(i.fileName)) && isDarwinCore(new TextDecoder().decode(i.bytes)),
  async validate(i) {
    try { parseOccurrences(new TextDecoder().decode(i.bytes)); return { ok: true, errors: [] }; }
    catch (e) { return { ok: false, errors: [e instanceof Error ? e.message : "Invalid Darwin Core file"] }; }
  },
  async extractMetadata(i) {
    const rows = parseOccurrences(new TextDecoder().decode(i.bytes));
    return { ...emptyMetadata(), fields: { format: "darwin-core", row_count: rows.length } };
  },
};