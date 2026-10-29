/** Docs pages are the markdown files in /docs — the same files published in the repository. */
const files = import.meta.glob("/docs/*.md", { query: "?raw", import: "default", eager: true }) as Record<string, string>;

export const DOC_ORDER = [
  { slug: "overview", title: "Overview", description: "What EBiT Open Core is and its principles." },
  { slug: "architecture", title: "Architecture", description: "How ingestion, adapters, identity graph and verification fit together." },
  { slug: "data-model", title: "Data model", description: "Every entity, table and database guarantee." },
  { slug: "ingestion", title: "Ingestion", description: "How an uploaded file becomes a fingerprinted, documented asset." },
  { slug: "adapters", title: "Adapters", description: "The adapter contract, rules and how to write your own." },
  { slug: "explorer", title: "Explorer & identity graph", description: "Search, item pages, relationship types, datasets and audit." },
  { slug: "biodiversity", title: "Biodiversity & Darwin Core", description: "Occurrence mapping, import/export and sensitive location safeguards." },
  { slug: "ai-verification", title: "AI & human verification", description: "Optional analysis, provider interfaces, job recovery and evidence-backed review." },
  { slug: "sensors", title: "Sensors & time series", description: "Device registration, timestamp/value imports, scoped keys and measurement provenance." },
  { slug: "api", title: "Public REST API", description: "Read-only API keys, endpoints, rate limits and what is never returned." },
  { slug: "rights-provenance", title: "Rights & provenance", description: "Rights states, permitted uses and append-only provenance." },
  { slug: "security", title: "Security", description: "Access control, storage and vulnerability reporting." },
  { slug: "self-hosting", title: "Self-hosting", description: "Install, configure and run EBiT Open Core." },
  { slug: "contributing", title: "Contributing", description: "How to contribute code, adapters and docs." },
  { slug: "changelog", title: "Changelog", description: "Versioned release notes following Semantic Versioning." },
  { slug: "roadmap", title: "Roadmap", description: "Build phases and what each delivers." },
] as const;

export type DocSlug = (typeof DOC_ORDER)[number]["slug"];

export function getDoc(slug: string) {
  const meta = DOC_ORDER.find((d) => d.slug === slug);
  const body = files[`/docs/${slug}.md`];
  if (!meta || body === undefined) return null;
  return { ...meta, body };
}

export function searchDocs(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return DOC_ORDER.filter((d) => {
    const body = files[`/docs/${d.slug}.md`] ?? "";
    return d.title.toLowerCase().includes(q) || body.toLowerCase().includes(q);
  });
}
