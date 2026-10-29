import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { searchEntities } from "@/functions/explorer.functions";
import { CreateEntityForm, EntityRow, workspacesQuery } from "@/components/entity";

export const Route = createFileRoute("/_authenticated/app/datasets")({
  loader: ({ context }) => context.queryClient.ensureQueryData(workspacesQuery),
  head: () => ({ meta: [{ title: "Datasets | EBiT Open Core" }, { name: "description", content: "Curate workspace datasets with rights-controlled publishing." }, { property: "og:title", content: "Datasets | EBiT Open Core" }, { property: "og:description", content: "Curate workspace datasets with rights-controlled publishing." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: DatasetsPage,
  errorComponent: ({ error }) => <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

function DatasetsPage() {
  const { data: ws } = useSuspenseQuery(workspacesQuery);
  const navigate = useNavigate();
  const w = ws[0];
  const res = useQuery({ queryKey: ["datasets", w?.id], queryFn: () => searchEntities({ data: { orgId: w!.id, kind: "dataset", page: 0 } }), enabled: !!w });
  if (!w) return <p className="text-muted-foreground">You are not a member of any workspace.</p>;
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold">Datasets</h1>
      <p className="mt-1 text-sm text-muted-foreground">Group files, objects and observations. A dataset can only be published when its rights permit redistribution.</p>
      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="rounded-2xl border border-border">
          {!res.data ? <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            : res.data.rows.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">No datasets yet.</p>
            : <ul>{res.data.rows.map((e) => <EntityRow key={e.id} e={e} />)}</ul>}
        </div>
        {w.role !== "viewer" && <CreateEntityForm orgId={w.id} kinds={["dataset"]} onCreated={(r) => navigate({ to: "/app/item/$kind/$id", params: { kind: r.kind, id: r.id } })} />}
      </section>
    </div>
  );
}
