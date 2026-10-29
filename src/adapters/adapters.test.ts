import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { findAdapter, listAdapters, acceptedExtensions } from "./registry";
import type { AdapterInput } from "./types";
import { sha256Hex, safeFileName, toJsonSafe } from "@/core/ingest";

const fx = (name: string, mimeType: string | null = null): AdapterInput => ({
  fileName: name,
  mimeType,
  bytes: new Uint8Array(readFileSync(join(__dirname, "__fixtures__", name))),
});

async function run(input: AdapterInput) {
  const a = findAdapter(input);
  if (!a) throw new Error("no adapter");
  const v = await a.validate(input);
  return { id: a.descriptor.id, v, m: v.ok ? await a.extractMetadata(input) : null };
}

describe("adapter routing", () => {
  it("picks the right adapter for each format", async () => {
    expect((await run(fx("with-gps.jpg"))).id).toBe("image");
    expect((await run(fx("report.pdf"))).id).toBe("document");
    expect((await run(fx("sample.csv"))).id).toBe("csv");
    expect((await run(fx("sites.geojson"))).id).toBe("geojson");
    expect((await run(fx("records.json"))).id).toBe("json");
  });
  it("routes GeoJSON saved as .json to the GeoJSON adapter", () => {
    const i = fx("sites.geojson");
    expect(findAdapter({ ...i, fileName: "sites.json" })?.descriptor.id).toBe("geojson");
  });
  it("keeps the foundation formats alongside Darwin Core", () => {
    expect(acceptedExtensions()).toEqual(expect.arrayContaining([".jpg", ".png", ".webp", ".pdf", ".csv", ".json", ".geojson"]));
    expect(listAdapters().map((a) => a.descriptor.id)).toEqual(expect.arrayContaining(["image", "document", "csv", "json", "geojson", "darwin-core"]));
  });
});

describe("image adapter", () => {
  it("reads capture time, GPS and camera from EXIF", async () => {
    const { m } = await run(fx("with-gps.jpg"));
    expect(m!.capturedAt!.startsWith("2025-03-01")).toBe(true);
    expect(m!.latitude).toBeCloseTo(12.975, 3);
    expect(m!.longitude).toBeCloseTo(77.5833, 3);
    expect(m!.device).toBe("TestCam Field 1");
    expect(Object.keys(m!.original).length).toBeGreaterThan(0);
  });
  it("leaves time, place and device null when the photo has no EXIF", async () => {
    const { m } = await run(fx("no-exif.jpg"));
    expect(m!.capturedAt).toBeNull();
    expect(m!.latitude).toBeNull();
    expect(m!.longitude).toBeNull();
    expect(m!.device).toBeNull();
  });
  it("reads PNG dimensions", async () => {
    const { m } = await run(fx("plain.png"));
    expect(m!.fields).toMatchObject({ width: 32, height: 16 });
  });
  it("rejects a non-image renamed to .jpg", async () => {
    const { v } = await run({ ...fx("sample.csv"), fileName: "fake.jpg" });
    expect(v.ok).toBe(false);
  });
});

describe("document adapter", () => {
  it("reads PDF page count, title and creation date", async () => {
    const { m } = await run(fx("report.pdf"));
    expect(m!.fields).toMatchObject({ page_count: 1, title: "Field report", author: "EBiT" });
    expect(m!.capturedAt).toBe("2024-01-31T12:00:00.000Z");
  });
  it("rejects a fake PDF", async () => {
    const { v } = await run({ ...fx("sample.csv"), fileName: "x.pdf" });
    expect(v.ok).toBe(false);
  });
});

describe("csv adapter", () => {
  it("reads columns, rows and coordinate columns", async () => {
    const { m } = await run(fx("sample.csv"));
    expect(m!.fields).toMatchObject({ row_count: 2, latitude_column: "lat", longitude_column: "lon", time_column: "eventDate" });
  });
});

describe("geojson adapter", () => {
  it("computes feature count and bounding box", async () => {
    const { m } = await run(fx("sites.geojson"));
    expect(m!.fields).toMatchObject({ feature_count: 2, bbox: [77.59, 12.97, 77.61, 12.99] });
    expect(m!.original).toEqual({ type: "FeatureCollection", name: "sites" });
    expect(m!.latitude).toBeNull(); // several points: no single location is invented
  });
  it("rejects out-of-range coordinates", async () => {
    const bad = new TextEncoder().encode('{"type":"Point","coordinates":[200,10]}');
    const { v } = await run({ fileName: "bad.geojson", mimeType: null, bytes: bad });
    expect(v.ok).toBe(false);
  });
});

describe("json adapter", () => {
  it("describes arrays of records", async () => {
    const { m } = await run(fx("records.json"));
    expect(m!.fields).toMatchObject({ top_level: "array", record_count: 2, record_keys: ["id", "name", "value"] });
  });
  it("reports invalid JSON", async () => {
    const { v } = await run({ fileName: "x.json", mimeType: null, bytes: new TextEncoder().encode("{oops") });
    expect(v.ok).toBe(false);
  });
});

describe("ingest helpers", () => {
  it("hashes identically for identical bytes (duplicate detection)", async () => {
    const a = await sha256Hex(new TextEncoder().encode("same"));
    expect(a).toBe(await sha256Hex(new TextEncoder().encode("same")));
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
  it("makes storage-safe names", () => {
    expect(safeFileName("../Field Photo (1).JPG")).toBe("Field_Photo_1_.JPG");
  });
  it("converts dates and binary without inventing values", () => {
    expect(toJsonSafe({ d: new Date("2024-01-01T00:00:00Z"), b: new Uint8Array(3), n: undefined })).toEqual({
      d: "2024-01-01T00:00:00.000Z",
      b: "[binary 3 bytes]",
      n: null,
    });
  });
});
