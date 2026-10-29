import { emptyMetadata, type Adapter } from "../types";
import { extensionOf } from "@/core/ingest";

const FORMATS = [
  { mime: "application/pdf", extensions: [".pdf"] },
  { mime: "text/plain", extensions: [".txt", ".md"] },
  { mime: "text/markdown", extensions: [".md"] },
];

const isPdf = (b: Uint8Array) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF

/** PDF date "D:20240131120000+05'30'" → ISO, or null if unparseable. */
function pdfDate(raw: string | undefined): string | null {
  const m = raw?.match(/^D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/);
  if (!m) return null;
  const [, y, mo = "01", d = "01", h = "00", mi = "00", s = "00"] = m;
  const date = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function pdfInfo(text: string, key: string): string | undefined {
  const m = text.match(new RegExp(`/${key}\\s*\\(([^)]{0,500})\\)`));
  return m?.[1];
}

export const documentAdapter: Adapter = {
  descriptor: {
    id: "document",
    version: "1.0.0",
    name: "Documents (PDF, plain text)",
    summary: "Reports, field notes and papers. PDFs are checked and their basic information read; text files are measured.",
    formats: FORMATS,
    inputMethods: ["upload"],
    extracts: ["PDF version and page count", "PDF title, author, producer and creation date when stored uncompressed", "text line, word and character counts"],
    capabilities: ["duplicate detection by SHA-256"],
    errors: ["File is not a valid PDF", "Text file is not valid UTF-8", "File is empty"],
    provenance: ["registered", "ingested", "metadata_extracted"],
  },
  detect: (i) => FORMATS.some((f) => f.mime === i.mimeType || f.extensions.includes(extensionOf(i.fileName))),
  async validate(i) {
    if (i.bytes.length === 0) return { ok: false, errors: ["File is empty"] };
    if (extensionOf(i.fileName) === ".pdf" || i.mimeType === "application/pdf") {
      return isPdf(i.bytes) ? { ok: true, errors: [] } : { ok: false, errors: ["File is not a valid PDF"] };
    }
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(i.bytes);
      return { ok: true, errors: [] };
    } catch {
      return { ok: false, errors: ["Text file is not valid UTF-8"] };
    }
  },
  async extractMetadata(i) {
    const m = emptyMetadata();
    if (isPdf(i.bytes)) {
      const text = new TextDecoder("latin1").decode(i.bytes);
      const pages = text.match(/\/Type\s*\/Page(?![s\w])/g)?.length ?? 0;
      const info = {
        Title: pdfInfo(text, "Title"),
        Author: pdfInfo(text, "Author"),
        Producer: pdfInfo(text, "Producer"),
        Creator: pdfInfo(text, "Creator"),
        CreationDate: pdfInfo(text, "CreationDate"),
      };
      m.fields = {
        format: "pdf",
        pdf_version: text.slice(5, 8),
        page_count: pages > 0 ? pages : null, // null when pages are inside compressed streams
        title: info.Title ?? null,
        author: info.Author ?? null,
      };
      m.original = Object.fromEntries(Object.entries(info).filter(([, v]) => v !== undefined));
      m.capturedAt = pdfDate(info.CreationDate);
      return m;
    }
    const text = new TextDecoder().decode(i.bytes);
    m.fields = {
      format: "text",
      lines: text.split(/\r\n|\r|\n/).length,
      words: text.split(/\s+/).filter(Boolean).length,
      characters: text.length,
    };
    return m;
  },
};
