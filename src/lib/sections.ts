import { BarChart3, Boxes, Cpu, Database, FileUp, Leaf, Network, Radio, Search, Settings, ShieldCheck, Code2 } from "lucide-react";

/** App sections and the phase each becomes functional in. Phase-gated sections show an honest "not built yet" state. */
export const SECTIONS = [
  { slug: "overview", label: "Overview", icon: BarChart3, phase: 1, summary: "Live counts of what is stored in your workspace." },
  { slug: "explorer", label: "Data Explorer", icon: Search, phase: 3, summary: "Search and filter assets, observations, objects and datasets." },
  { slug: "ingestion", label: "Ingestion", icon: FileUp, phase: 2, summary: "Upload files and import datasets through adapters." },
  { slug: "graph", label: "Identity Graph", icon: Network, phase: 3, summary: "Inspect an object and everything connected to it." },
  { slug: "processing", label: "Processing", icon: Cpu, phase: 5, summary: "Jobs, outputs, errors and model details." },
  { slug: "verification", label: "Verification", icon: ShieldCheck, phase: 5, summary: "Review AI results: verify, reject or flag for review." },
  { slug: "biodiversity", label: "Biodiversity", icon: Leaf, phase: 4, summary: "Species observations, habitats and map views." },
  { slug: "sensors", label: "Sensors", icon: Radio, phase: 6, summary: "Time-series measurements from sensor adapters." },
  { slug: "datasets", label: "Datasets", icon: Boxes, phase: 3, summary: "Curate, document and export authorised datasets." },
  { slug: "developer", label: "Developer", icon: Code2, phase: 7, summary: "API keys, endpoints and integration examples." },
  { slug: "admin", label: "Administration", icon: Settings, phase: 3, summary: "Members, roles, audit log and system status." },
] as const;

export type SectionSlug = (typeof SECTIONS)[number]["slug"];
export const CURRENT_PHASE = 7;
export { Database };
