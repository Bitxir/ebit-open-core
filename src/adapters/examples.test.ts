import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findAdapter } from "./registry";

/** Real open-licensed example files in docs/examples (see docs/examples/SOURCES.md). */
const cases: [string, string][] = [
  ["gbif-india-birds-cc0.csv", "darwin-core"],
  ["indian-peafowl-sharda-canal.jpg", "image"],
  ["darwin-origin-of-species.txt", "document"],
  ["co2-generic-table.csv", "csv"],
  ["co2-ppm-datapackage.json", "json"],
  ["south-asia-countries.geojson", "geojson"],
  ["mauna-loa-co2-sensor.csv", "sensor-timeseries"],
];

describe("real example datasets", () => {
  for (const [file, adapter] of cases) {
    it(`${file} is handled by ${adapter} and validates`, async () => {
      const input = { fileName: file, mimeType: null, bytes: new Uint8Array(readFileSync(join(__dirname, "../../docs/examples", file))) };
      const a = findAdapter(input);
      expect(a?.descriptor.id).toBe(adapter);
      const v = await a!.validate(input);
      expect(v.errors).toEqual([]);
      expect(v.ok).toBe(true);
    });
  }
});
