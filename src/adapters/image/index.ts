import exifr from "exifr";
import { emptyMetadata, type Adapter } from "../types";
import { extensionOf, isValidLatitude, isValidLongitude, toJsonSafe } from "@/core/ingest";

const FORMATS = [
  { mime: "image/jpeg", extensions: [".jpg", ".jpeg"] },
  { mime: "image/png", extensions: [".png"] },
  { mime: "image/webp", extensions: [".webp"] },
];

function sniff(b: Uint8Array): "jpeg" | "png" | "webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  return null;
}

function pngSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length < 24) return null;
  const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
  return { width: v.getUint32(16), height: v.getUint32(20) };
}

export const imageAdapter: Adapter = {
  descriptor: {
    id: "image",
    version: "1.0.0",
    name: "Images (JPEG, PNG, WebP)",
    summary: "Photographs and still images. Reads EXIF metadata when present: capture time, GPS position, camera make and model.",
    formats: FORMATS,
    inputMethods: ["upload"],
    extracts: ["capture time (EXIF DateTimeOriginal)", "GPS latitude/longitude", "camera make and model", "pixel width and height", "full EXIF block as original metadata"],
    capabilities: ["duplicate detection by SHA-256", "map placement when GPS exists"],
    errors: ["File content is not a JPEG, PNG or WebP image", "File extension does not match the image content"],
    provenance: ["registered", "ingested", "metadata_extracted"],
  },
  detect: (i) => FORMATS.some((f) => f.mime === i.mimeType || f.extensions.includes(extensionOf(i.fileName))),
  async validate(i) {
    const kind = sniff(i.bytes);
    if (!kind) return { ok: false, errors: ["File content is not a JPEG, PNG or WebP image"] };
    const ext = extensionOf(i.fileName);
    const expected = FORMATS.find((f) => f.mime === `image/${kind}`)!;
    if (ext && !expected.extensions.includes(ext)) return { ok: false, errors: ["File extension does not match the image content"] };
    return { ok: true, errors: [] };
  },
  async extractMetadata(i) {
    const m = emptyMetadata();
    const kind = sniff(i.bytes);
    m.fields["format"] = kind;
    if (kind === "png") Object.assign(m.fields, pngSize(i.bytes) ?? {});

    let exif: Record<string, unknown> | undefined;
    try {
      exif = (await exifr.parse(i.bytes, { tiff: true, exif: true, gps: true, xmp: false, icc: false, iptc: false })) as Record<string, unknown> | undefined;
    } catch {
      exif = undefined; // No readable EXIF: leave everything null rather than guessing.
    }
    if (!exif) return m;

    m.original = toJsonSafe(exif) as Record<string, unknown>;
    const taken = exif["DateTimeOriginal"] ?? exif["CreateDate"];
    if (taken instanceof Date && !Number.isNaN(taken.getTime())) m.capturedAt = taken.toISOString();
    if (isValidLatitude(exif["latitude"]) && isValidLongitude(exif["longitude"])) {
      m.latitude = exif["latitude"] as number;
      m.longitude = exif["longitude"] as number;
    }
    const device = [exif["Make"], exif["Model"]].filter((v) => typeof v === "string" && v.trim()).join(" ").trim();
    m.device = device || null;
    if (typeof exif["ExifImageWidth"] === "number") m.fields["width"] = exif["ExifImageWidth"];
    if (typeof exif["ExifImageHeight"] === "number") m.fields["height"] = exif["ExifImageHeight"];
    return m;
  },
};
