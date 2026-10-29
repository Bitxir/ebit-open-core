import Papa from "papaparse";
import { z } from "zod";

export const BASIS = ["HumanObservation", "MachineObservation", "PreservedSpecimen", "LivingSpecimen", "FossilSpecimen", "MaterialSample", "MaterialCitation", "Occurrence"] as const;
const optionalText = z.string().trim().max(1000).nullable().default(null);
export const occurrenceSchema = z.object({
  occurrenceID: optionalText,
  scientificName: z.string().trim().min(1).max(300),
  kingdom: optionalText, family: optionalText, genus: optionalText, taxonRank: optionalText,
  eventDate: z.string().nullable().default(null).refine((v) => v === null || /^\d{4}-\d{2}-\d{2}(T.*)?$/.test(v) && Number.isFinite(Date.parse(v)), "eventDate must be an ISO date or timestamp"),
  basisOfRecord: z.enum(BASIS).nullable().default(null),
  decimalLatitude: z.number().finite().min(-90).max(90).nullable().default(null),
  decimalLongitude: z.number().finite().min(-180).max(180).nullable().default(null),
  coordinateUncertaintyInMeters: z.number().finite().min(0).nullable().default(null),
  recordedBy: optionalText, locality: optionalText, habitat: optionalText,
  sensitive: z.boolean().default(false),
  original: z.record(z.string()).default({}),
}).refine((r) => (r.decimalLatitude === null) === (r.decimalLongitude === null), "Give both coordinates, or neither");
export type OccurrenceInput = z.input<typeof occurrenceSchema>;
export type Occurrence = z.output<typeof occurrenceSchema>;
export const MAX_OCCURRENCES = 500;

export function isDarwinCore(text: string) {
  const header = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { preview: 1 }).data[0] ?? [];
  return header.includes("scientificName");
}

/** No inference, taxonomic resolution or automatic verification. Original values remain unchanged. */
export function parseOccurrences(text: string): Occurrence[] {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), { header: true, skipEmptyLines: "greedy", dynamicTyping: false });
  const errors = parsed.errors.filter((e) => e.code !== "UndetectableDelimiter");
  if (errors.length) throw new Error(`CSV parse error: ${errors[0]?.message}`);
  if (!parsed.meta.fields?.includes("scientificName")) throw new Error("Missing scientificName column");
  if (!parsed.data.length || parsed.data.length > MAX_OCCURRENCES) throw new Error(`Import must contain 1–${MAX_OCCURRENCES} occurrences`);
  const readNumber = (v: string | undefined) => v?.trim() ? Number(v) : null;
  return parsed.data.map((r, i) => {
    const s = (k: string) => r[k]?.trim() || null;
    if (s("sensitive") && !["true", "false", "1", "0"].includes(s("sensitive") ?? "")) throw new Error(`Row ${i + 2}: sensitive must be true, false, 1 or 0`);
    const result = occurrenceSchema.safeParse({
      occurrenceID: s("occurrenceID"), scientificName: s("scientificName"),
      kingdom: s("kingdom"), family: s("family"), genus: s("genus"), taxonRank: s("taxonRank"),
      eventDate: s("eventDate"), basisOfRecord: s("basisOfRecord"),
      decimalLatitude: readNumber(r["decimalLatitude"]), decimalLongitude: readNumber(r["decimalLongitude"]),
      coordinateUncertaintyInMeters: readNumber(r["coordinateUncertaintyInMeters"]),
      recordedBy: s("recordedBy"), locality: s("locality"), habitat: s("habitat"),
      sensitive: r["sensitive"] === "true" || r["sensitive"] === "1", original: r,
    });
    if (!result.success) throw new Error(`Row ${i + 2}: ${result.error.issues.map((e) => e.message).join("; ")}`);
    return result.data;
  });
}

/** Grid centres, not rounding to the edge of a cell. Never return exact metadata for sensitive records. */
export function publicLocation(r: Pick<Occurrence, "sensitive" | "decimalLatitude" | "decimalLongitude">) {
  if (r.decimalLatitude === null || r.decimalLongitude === null) return { latitude: null, longitude: null };
  if (!r.sensitive) return { latitude: r.decimalLatitude, longitude: r.decimalLongitude };
  return { latitude: Math.min(89.95, Math.floor(r.decimalLatitude * 10) / 10 + 0.05), longitude: Math.min(179.95, Math.floor(r.decimalLongitude * 10) / 10 + 0.05) };
}

export function exportOccurrences(rows: Record<string, unknown>[]) {
  const columns = ["occurrenceID", "scientificName", "eventDate", "basisOfRecord", "decimalLatitude", "decimalLongitude", "coordinateUncertaintyInMeters", "recordedBy", "locality", "habitat", "kingdom", "family", "genus", "taxonRank", "informationWithheld", "dataGeneralizations", "license", "rightsHolder"];
  return Papa.unparse({ fields: columns, data: rows.map((r) => columns.map((c) => r[c] ?? "")) }, { escapeFormulae: true });
}