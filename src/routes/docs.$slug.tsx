import { createFileRoute, notFound } from "@tanstack/react-router";
import { Markdown } from "@/components/markdown";
import { getDoc } from "@/lib/docs";
import { listAdapters } from "@/adapters/registry";

export const Route = createFileRoute("/docs/$slug")({
  loader: ({ params }) => {
    const doc = getDoc(params.slug);
    if (!doc) throw notFound();
    return doc;
  },
  head: ({ loaderData }) => {
    const title = loaderData ? `${loaderData.title} | EBiT Open Core Docs` : "Docs | EBiT Open Core";
    const description = loaderData?.description ?? "EBiT Open Core documentation.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: DocPage,
});

function AdapterList() {
  const adapters = listAdapters();
  if (adapters.length === 0) {
    return <p className="text-sm text-muted-foreground">No adapters are registered.</p>;
  }
  return (
    <div className="space-y-4">
      {adapters.map(({ descriptor: d }) => (
        <section key={d.id} className="rounded-xl border border-border p-4">
          <h3 className="font-semibold">{d.name} <span className="font-mono text-xs text-muted-foreground">{d.id}@{d.version}</span></h3>
          <p className="mt-1 text-sm text-muted-foreground">{d.summary}</p>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div><dt className="font-medium">Formats</dt><dd>{d.formats.map((f) => `${f.mime} (${f.extensions.join(", ")})`).join("; ")}</dd></div>
            <div><dt className="font-medium">Input methods</dt><dd>{d.inputMethods.join(", ")}</dd></div>
            <div><dt className="font-medium">Extracts</dt><dd>{d.extracts.join(", ") || "—"}</dd></div>
            <div><dt className="font-medium">Capabilities</dt><dd>{d.capabilities.join(", ") || "—"}</dd></div>
            <div><dt className="font-medium">Errors</dt><dd>{d.errors.join("; ") || "—"}</dd></div>
            <div><dt className="font-medium">Provenance</dt><dd>{d.provenance.join(", ") || "—"}</dd></div>
          </dl>
        </section>
      ))}
    </div>
  );
}

function DocPage() {
  const doc = Route.useLoaderData();
  return (
    <>
      <Markdown>{doc.body}</Markdown>
      {doc.slug === "adapters" && <AdapterList />}
    </>
  );
}
