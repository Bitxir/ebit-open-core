import Papa from "papaparse";
import { emptyMetadata, type Adapter } from "../types";
import { extensionOf } from "@/core/ingest";

const FORMATS = [{ mime: "text/csv", extensions: [".csv", ".tsv"] }];
const LAT = /^(lat|latitude|decimallatitude|y)$/i;
const LON = /^(lon|lng|long|longitude|decimallongitude|x)$/i;
const TIME = /^(date|datetime|time|timestamp|eventdate|observed_at)$/i;

function parse(bytes: Uint8Array) {
  const text = new TextDecoder().decode(bytes).replace(/^\uFEFF/, "");
  return Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, dynamicTyping: false });
}

export const csvAdapter: Adapter = {
  descriptor: {
    id: "csv",
    version: "1.0.0",
    name: "Tabular data (CSV, TSV)",
    summary: "Spreadsheets exported as delimited text. Reads the header, counts rows and spots coordinate and date columns. Rows are kept unchanged in the original file.",
    formats: FORMATS,
    inputMethods: ["upload"],
    extracts: ["column names", "row count", "detected delimiter", "likely latitude/longitude/date columns (by header name only)", "first 5 rows as a preview"],
    capabilities: ["duplicate detection by SHA-256", "Darwin Core headers are handled by the dedicated occurrence adapter"],
    errors: ["File is empty", "No header row found", "Rows could not be parsed"],
    provenance: ["registered", "ingested", "metadata_extracted"],
  },
  detect: (i) => i.mimeType === "text/csv" || [".csv", ".tsv"].includes(extensionOf(i.fileName)),
  async validate(i) {
    if (i.bytes.length === 0) return { ok: false, errors: ["File is empty"] };
    const r = parse(i.bytes);
    const fields = r.meta.fields ?? [];
    if (fields.length === 0) return { ok: false, errors: ["No header row found"] };
    if (r.data.length === 0 && r.errors.length > 0) return { ok: false, errors: ["Rows could not be parsed"] };
    return { ok: true, errors: [] };
  },
  async extractMetadata(i) {
    const m = emptyMetadata();
    const r = parse(i.bytes);
    const columns = r.meta.fields ?? [];
    m.fields = {
      format: "csv",
      columns,
      row_count: r.data.length,
      delimiter: r.meta.delimiter,
      latitude_column: columns.find((c) => LAT.test(c.trim())) ?? null,
      longitude_column: columns.find((c) => LON.test(c.trim())) ?? null,
      time_column: columns.find((c) => TIME.test(c.trim())) ?? null,
      parse_warnings: r.errors.slice(0, 20).map((e) => `row ${e.row ?? "?"}: ${e.message}`),
      preview: r.data.slice(0, 5),
    };
    return m;
  },
};
