import { emptyMetadata, type Adapter } from "../types";
import { extensionOf } from "@/core/ingest";

const TYPES = new Set(["FeatureCollection", "Feature", "Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon", "GeometryCollection"]);

type Json = Record<string, unknown>;

function tryParse(bytes: Uint8Array): Json | null {
  try {
    const v = JSON.parse(new TextDecoder().decode(bytes).replace(/^\uFEFF/, ""));
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null;
  } catch {
    return null;
  }
}

function geometries(g: Json): Json[] {
  if (g["type"] === "FeatureCollection") return ((g["features"] as Json[]) ?? []).flatMap(geometries);
  if (g["type"] === "Feature") return g["geometry"] ? geometries(g["geometry"] as Json) : [];
  if (g["type"] === "GeometryCollection") return ((g["geometries"] as Json[]) ?? []).flatMap(geometries);
  return [g];
}

function positions(c: unknown, out: number[][] = []): number[][] {
  if (Array.isArray(c) && typeof c[0] === "number") out.push(c as number[]);
  else if (Array.isArray(c)) c.forEach((x) => positions(x, out));
  return out;
}

export function summarize(doc: Json) {
  const geoms = geometries(doc);
  const pts = geoms.flatMap((g) => positions(g["coordinates"]));
  const bad = pts.filter(([x, y]) => !(typeof x === "number" && typeof y === "number" && x >= -180 && x <= 180 && y >= -90 && y <= 90));
  const xs = pts.map((p) => p[0]!), ys = pts.map((p) => p[1]!);
  return {
    featureCount: doc["type"] === "FeatureCollection" ? ((doc["features"] as unknown[]) ?? []).length : doc["type"] === "Feature" ? 1 : 0,
    geometryTypes: [...new Set(geoms.map((g) => String(g["type"])))],
    positionCount: pts.length,
    invalidPositions: bad.length,
    bbox: pts.length && !bad.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null,
  };
}

export const geojsonAdapter: Adapter = {
  descriptor: {
    id: "geojson",
    version: "1.0.0",
    name: "Geospatial (GeoJSON)",
    summary: "Points, lines and areas in GeoJSON (RFC 7946, WGS 84 longitude/latitude). Validates coordinates and computes the bounding box.",
    formats: [{ mime: "application/geo+json", extensions: [".geojson"] }],
    inputMethods: ["upload"],
    extracts: ["feature count", "geometry types", "bounding box", "centre point for single-point files", "top-level members other than features (e.g. name, crs) as original metadata"],
    capabilities: ["duplicate detection by SHA-256", "map display (Phase 4)"],
    errors: ["Not valid JSON", "Not a GeoJSON object (unknown or missing type)", "Coordinates outside longitude −180..180 / latitude −90..90"],
    provenance: ["registered", "ingested", "metadata_extracted"],
  },
  detect(i) {
    if (i.mimeType === "application/geo+json" || extensionOf(i.fileName) === ".geojson") return true;
    if (extensionOf(i.fileName) !== ".json" || i.bytes.length === 0) return false;
    const doc = tryParse(i.bytes);
    return !!doc && TYPES.has(String(doc["type"]));
  },
  async validate(i) {
    const doc = tryParse(i.bytes);
    if (!doc) return { ok: false, errors: ["Not valid JSON"] };
    if (!TYPES.has(String(doc["type"]))) return { ok: false, errors: ["Not a GeoJSON object (unknown or missing type)"] };
    if (summarize(doc).invalidPositions > 0) return { ok: false, errors: ["Coordinates outside longitude −180..180 / latitude −90..90"] };
    return { ok: true, errors: [] };
  },
  async extractMetadata(i) {
    const m = emptyMetadata();
    const doc = tryParse(i.bytes)!;
    const s = summarize(doc);
    m.fields = { format: "geojson", feature_count: s.featureCount, geometry_types: s.geometryTypes, position_count: s.positionCount, bbox: s.bbox };
    const { features: _f, geometry: _g, coordinates: _c, ...rest } = doc;
    m.original = rest;
    if (s.positionCount === 1 && s.bbox) {
      m.longitude = s.bbox[0]!;
      m.latitude = s.bbox[1]!;
    }
    return m;
  },
};
