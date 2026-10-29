import { emptyMetadata, type Adapter } from "../types";
import { extensionOf } from "@/core/ingest";
import { isTimeseries, parseTimeseries } from "@/modules/sensors/timeseries";
const format = (name: string) => extensionOf(name) === ".json" ? "json" as const : "csv" as const;
export const sensorTimeseriesAdapter: Adapter = {
  descriptor: {
    id: "sensor-timeseries", version: "1.0.0", name: "Sensor time series",
    summary: "Validates timestamp/value readings for explicit import into a selected sensor datastream. Preserves original rows without assuming units, devices or verification.",
    formats: [{ mime: "text/csv", extensions: [".csv", ".tsv"] }, { mime: "application/json", extensions: [".json"] }], inputMethods: ["upload"],
    extracts: ["reading count", "source format", "earliest/latest supplied timestamp"], capabilities: ["1–1000 readings", "timezone required", "finite numeric values", "explicit stream import", "source metadata preserved"],
    errors: ["Missing timestamp/value", "Invalid timestamp or missing timezone", "Invalid numeric value", "Conflicting duplicate timestamp", "More than 1000 readings"], provenance: ["registered", "ingested", "metadata_extracted", "sensor_measurements_imported"],
  },
  detect: i => [".csv", ".tsv", ".json"].includes(extensionOf(i.fileName)) && isTimeseries(new TextDecoder().decode(i.bytes),format(i.fileName)),
  async validate(i) { try { parseTimeseries(new TextDecoder().decode(i.bytes),format(i.fileName)); return {ok:true,errors:[]}; } catch(e) {return {ok:false,errors:[e instanceof Error?e.message:"Invalid readings"]};} },
  async extractMetadata(i) { const rows=parseTimeseries(new TextDecoder().decode(i.bytes),format(i.fileName)); const times=rows.map(r=>r.timestamp).sort(); return {...emptyMetadata(),fields:{format:format(i.fileName),row_count:rows.length,first_timestamp:times[0],last_timestamp:times.at(-1)}}; },
};