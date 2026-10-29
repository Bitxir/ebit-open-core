import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { EbitBrand } from "@/components/brand";
import { Input } from "@/components/ui/input";
import { DOC_ORDER, searchDocs } from "@/lib/docs";

export const Route = createFileRoute("/docs")({
  component: DocsLayout,
});

function DocsLayout() {
  const [q, setQ] = useState("");
  const results = searchDocs(q);
  const list = q ? results : DOC_ORDER;
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <EbitBrand suffix="Docs" />
          <Link to="/app" className="text-sm text-muted-foreground hover:text-foreground">Open app →</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl gap-10 px-4 py-8 md:flex">
        <aside className="mb-8 md:sticky md:top-20 md:mb-0 md:h-fit md:w-56 md:shrink-0">
          <label htmlFor="doc-search" className="sr-only">Search docs</label>
          <Input id="doc-search" placeholder="Search docs…" value={q} onChange={(e) => setQ(e.target.value)} />
          <nav aria-label="Documentation" className="mt-4 flex gap-1 overflow-x-auto md:flex-col">
            {list.length === 0 && <p className="px-2 text-sm text-muted-foreground">No pages match.</p>}
            {list.map((d) => (
              <Link
                key={d.slug}
                to="/docs/$slug"
                params={{ slug: d.slug }}
                className="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                activeProps={{ className: "bg-accent text-foreground font-medium" }}
              >
                {d.title}
              </Link>
            ))}
          </nav>
        </aside>
        <article className="min-w-0 flex-1 pb-20">
          <Outlet />
        </article>
      </div>
    </div>
  );
}
