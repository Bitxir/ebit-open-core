import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { searchEntities } from "@/functions/explorer.functions";
import { EntityRow, workspacesQuery } from "@/components/entity";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/app/graph")({
  loader: ({ context }) => context.queryClient.ensureQueryData(workspacesQuery),
  head: () => ({ meta: [{ title: "Identity Graph | EBiT Open Core" }, { name: "description", content: "Inspect persistent objects and their linked evidence." }, { property: "og:title", content: "Identity Graph | EBiT Open Core" }, { property: "og:description", content: "Inspect persistent objects and their linked evidence." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: GraphPage,
  errorComponent: ({ error }) => <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

function GraphPage() {
  const { data: ws } = useSuspenseQuery(workspacesQuery);
  const orgId = ws[0]?.id;
  const [q, setQ] = useState("");
  const res = useQuery({ queryKey: ["graph-objects", orgId, q], queryFn: () => searchEntities({ data: { orgId: orgId!, kind: "object", q: q || undefined, page: 0 } }), enabled: !!orgId });
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Identity Graph</h1>
      <p className="mt-1 text-sm text-muted-foreground">Every object has a permanent EBiT ID. Open one to see the files, observations and other objects linked to it.</p>
      <Input className="mt-5" placeholder="Find an object" aria-label="Find an object" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 rounded-2xl border border-border">
        {!res.data ? <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          : res.data.rows.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No objects yet. <Link to="/app/explorer" search={{ kind: "object" }} className="underline">Create one in the explorer.</Link></p>
          : <ul>{res.data.rows.map((e) => <EntityRow key={e.id} e={e} />)}</ul>}
      </div>
    </div>
  );
}
