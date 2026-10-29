import { APP_VERSION } from "@/lib/version";
import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Fingerprint, GitBranch, Layers, ShieldCheck, Workflow } from "lucide-react";
import { EbitBrand } from "@/components/brand";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EBiT Open Core — open infrastructure for physical-world data" },
      { name: "description", content: "Ingest, identify, connect and verify physical-world data with full provenance. Open source, starting with biodiversity." },
      { property: "og:title", content: "EBiT Open Core — open infrastructure for physical-world data" },
      { property: "og:description", content: "Ingest, identify, connect and verify physical-world data with full provenance. Open source, starting with biodiversity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const PILLARS = [
  { icon: Layers, title: "Any input", text: "Files, datasets, APIs and sensors through swappable adapters." },
  { icon: Fingerprint, title: "Persistent identity", text: "Every object, asset and observation gets a stable EBiT ID." },
  { icon: GitBranch, title: "Identity graph", text: "Typed links between places, things, events and files." },
  { icon: Workflow, title: "Full provenance", text: "Append-only history of every ingestion and transformation." },
  { icon: ShieldCheck, title: "Rights first", text: "Nothing is published without explicit redistribution rights." },
  { icon: BookOpen, title: "Open source", text: "Documented contracts so anyone can add a format or domain." },
];

function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <EbitBrand />
        <nav className="flex items-center gap-4 text-sm">
          <Link to="/docs" className="text-muted-foreground hover:text-foreground">Docs</Link>
          <Button asChild size="sm"><Link to="/app">Open app</Link></Button>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4">
        <section className="py-16 md:py-28">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-water">Open core · v{APP_VERSION}</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
            Trustworthy data about the physical world.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            EBiT Open Core ingests photos, documents, datasets and sensor readings, gives each a persistent identity,
            and records exactly where it came from and who may use it. Starting with biodiversity.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to="/docs/$slug" params={{ slug: "overview" }}>Read the docs</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/docs/$slug" params={{ slug: "adapters" }}>Write an adapter</Link></Button>
          </div>
        </section>
        <section aria-label="What it does" className="grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-border bg-card p-5">
              <Icon className="h-5 w-5 text-leaf" aria-hidden />
              <h2 className="mt-3 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>
      </main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">EBiT Open Core v{APP_VERSION} · code Apache-2.0 · docs CC BY 4.0 · <Link to="/docs/$slug" params={{ slug: "changelog" }} className="underline">Changelog</Link></footer>
    </div>
  );
}
