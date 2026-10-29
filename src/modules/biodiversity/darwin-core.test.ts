import { describe, expect, it } from "vitest";
import { exportOccurrences, parseOccurrences, publicLocation } from "./darwin-core";
import { findAdapter } from "@/adapters/registry";

describe("Darwin Core", () => {
  it("uses the dedicated adapter before general CSV", () => {
    expect(findAdapter({ fileName: "occurrences.csv", mimeType: "text/csv", bytes: new TextEncoder().encode("scientificName\nAnas platyrhynchos") })?.descriptor.id).toBe("darwin-core");
  });
  it("keeps missing metadata null and originals unchanged", () => {
    const [r] = parseOccurrences("scientificName,custom\nAnas platyrhynchos,source value");
    expect(r?.eventDate).toBeNull(); expect(r?.basisOfRecord).toBeNull(); expect(r?.decimalLatitude).toBeNull(); expect(r?.original["custom"]).toBe("source value");
  });
  it("requires latitude and longitude together", () => {
    expect(() => parseOccurrences("scientificName,decimalLatitude\nAnas platyrhynchos,12.97")).toThrow("both coordinates");
  });
  it("rejects out of range latitude", () => {
    expect(() => parseOccurrences("scientificName,decimalLatitude,decimalLongitude\nAnas platyrhynchos,91,77")).toThrow();
  });
  it("rejects out of range longitude", () => {
    expect(() => parseOccurrences("scientificName,decimalLatitude,decimalLongitude\nAnas platyrhynchos,12,181")).toThrow();
  });
  it("rejects unknown basis of record", () => {
    expect(() => parseOccurrences("scientificName,basisOfRecord\nAnas platyrhynchos,AI verified")).toThrow();
  });
  it("rejects imports over 500 occurrences", () => {
    expect(() => parseOccurrences("scientificName\n" + Array(501).fill("Anas platyrhynchos").join("\n"))).toThrow("1–500");
  });
  it("generalises sensitive coordinates to 0.1 degree cell centres", () => {
    const p = publicLocation({ sensitive: true, decimalLatitude: 12.973, decimalLongitude: 77.594 });
    expect(p.latitude).toBeCloseTo(12.95); expect(p.longitude).toBeCloseTo(77.55);
  });
  it("does not generalise non-sensitive coordinates", () => {
    expect(publicLocation({ sensitive: false, decimalLatitude: 12.973, decimalLongitude: 77.594 })).toEqual({ latitude: 12.973, longitude: 77.594 });
  });
  it("never invents a location for a sensitive record with missing coordinates", () => {
    expect(publicLocation({ sensitive: true, decimalLatitude: null, decimalLongitude: null })).toEqual({ latitude: null, longitude: null });
  });
  it("escapes formula-like spreadsheet values on export", () => {
    expect(exportOccurrences([{ scientificName: "=1+1" }])).toContain("'=1+1");
  });
});