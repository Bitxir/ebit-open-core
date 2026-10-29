import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, keepPreviousData } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Search } from "lucide-react";
import { searchEntities, type SearchInput } from "@/functions/explorer.functions";
import { GRAPH_KINDS } from "@/core/graph";
import { RIGHTS_LABELS, RIGHTS_STATES } from "@/core/rights";
import { CreateEntityForm, EntityRow, KIND_META, selectClass, workspacesQuery } from "@/components/entity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const searchParams = z.object({
  kind: z.enum(GRAPH_KINDS).catch("asset"),
  q: z.string().optional().catch(undefined),
  rights: z.enum(RIGHTS_STATES).optional().catch(undefined),
  status: z.string().optional().catch(undefined),
  from: z.string().optional().catch(undefined),
  to: z.string().optional().catch(undefined),
  bbox: z.string().optional().catch(undefined),
  page: z.number().int().min(0).optional().catch(undefined),
});
type Params = z.infer<typeof searchParams>;

const searchQuery = (input: SearchInput) =>
  queryOptions({ queryKey: ["search", input], queryFn: () => searchEntities({ data: input }), placeholderData: keepPreviousData });

const STATUS_OPTIONS: Record<(typeof GRAPH_KINDS)[number], string[]> = {
  asset: ["awaiting_upload", "ready", "failed"],
  observation: ["unverified", "needs_review", "verified", "rejected"],
  dataset: ["draft", "published"],
  object: [],
};

export const Route = createFileRoute("/_authenticated/app/explorer")({
  validateSearch: searchParams,
  loader: ({ context }) => context.queryClient.ensureQueryData(workspacesQuery),
  head: () => ({ meta: [{ title: "Data Explorer | EBiT Open Core" }, { name: "description", content: "Search and filter workspace files, objects, observations and datasets." }, { property: "og:title", content: "Data Explorer | EBiT Open Core" }, { property: "og:description", content: "Search and filter workspace files, objects, observations and datasets." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: ExplorerPage,
  errorComponent: ({ error }) => <p role="alert" className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">Couldn't load explorer: {error instanceof Error ? error.message : String(error)}</p>,
});

function ExplorerPage() {
  const { data: ws } = useSuspenseQuery(workspacesQuery);
  if (!ws[0]) return <p className="text-muted-foreground">You are not a member of any workspace.</p>;
  return <Explorer orgId={ws[0].id} canEdit={ws[0].role !== "viewer"} />;
}

function Explorer({ orgId, canEdit }: { orgId: string; canEdit: boolean }) {
  const p = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const [draft, setDraft] = useState<Params>(p);
  const input: SearchInput = { orgId, kind: p.kind, q: p.q, rights: p.rights, status: p.status, from: p.from, to: p.to, bbox: p.bbox, page: p.page ?? 0 };
  const res = useQuery(searchQuery(input));
  const go = (next: Partial<Params>) => navigate({ search: (prev) => ({ ...prev, ...next }) });
  const clean = (s?: string) => (s?.trim() ? s.trim() : undefined);

  function apply(e: FormEvent) {
    e.preventDefault();
    go({ q: clean(draft.q), rights: draft.rights, status: clean(draft.status), from: clean(draft.from), to: clean(draft.to), bbox: clean(draft.bbox), page: undefined });
  }
  const page = p.page ?? 0;
  const total = res.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / (res.data?.pageSize ?? 25)));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="text-3xl font-bold">Data Explorer</h1>
      <p className="mt-1 text-sm text-muted-foreground">Search everything stored in your workspace. Open an item to see its links, rights and full history.</p>

      <div className="mt-5 flex gap-1 overflow-x-auto">
        {GRAPH_KINDS.map((k) => (
          <button key={k} onClick={() => { setDraft((d) => ({ ...d, status: undefined })); go({ kind: k, status: undefined, page: undefined }); }}
            className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm", p.kind === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
            {KIND_META[k].plural}
          </button>
        ))}
      </div>

      <section className="mt-4 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <form onSubmit={apply} className="space-y-3 rounded-2xl border border-border p-4">
            <div className="flex gap-2">
              <Input aria-label="Search" placeholder="Name, file name, type or EBiT ID" value={draft.q ?? ""} onChange={(e) => setDraft({ ...draft, q: e.target.value })} />
              <Button type="submit"><Search className="h-4 w-4" /> <span className="hidden sm:inline">Search</span></Button>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <div className="space-y-1"><Label htmlFor="f-rights" className="text-xs">Rights</Label>
                <select id="f-rights" className={selectClass} value={draft.rights ?? ""} onChange={(e) => setDraft({ ...draft, rights: (e.target.value || undefined) as Params["rights"] })}>
                  <option value="">Any</option>{RIGHTS_STATES.map((r) => <option key={r} value={r}>{RIGHTS_LABELS[r]}</option>)}
                </select></div>
              <div className="space-y-1"><Label htmlFor="f-status" className="text-xs">Status</Label>
                <select id="f-status" className={selectClass} disabled={!STATUS_OPTIONS[p.kind].length} value={draft.status ?? ""} onChange={(e) => setDraft({ ...draft, status: e.target.value || undefined })}>
                  <option value="">Any</option>{STATUS_OPTIONS[p.kind].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select></div>
              <div className="space-y-1"><Label htmlFor="f-from" className="text-xs">Added from</Label><Input id="f-from" type="date" value={draft.from ?? ""} onChange={(e) => setDraft({ ...draft, from: e.target.value })} /></div>
              <div className="space-y-1"><Label htmlFor="f-to" className="text-xs">Added to</Label><Input id="f-to" type="date" value={draft.to ?? ""} onChange={(e) => setDraft({ ...draft, to: e.target.value })} /></div>
              <div className="col-span-2 space-y-1 md:col-span-1"><Label htmlFor="f-bbox" className="text-xs">Area (W,S,E,N)</Label><Input id="f-bbox" placeholder="77.5,12.9,77.7,13.1" value={draft.bbox ?? ""} onChange={(e) => setDraft({ ...draft, bbox: e.target.value })} /></div>
            </div>
          </form>

          <div className="mt-4 rounded-2xl border border-border">
            {res.isError ? <p role="alert" className="p-4 text-sm text-destructive">{res.error.message}</p>
              : !res.data ? <p className="p-4 text-sm text-muted-foreground">Searching…</p>
              : res.data.rows.length === 0 ? <p className="p-6 text-center text-sm text-muted-foreground">Nothing matches. {p.kind === "asset" ? "Upload files in Ingestion." : canEdit ? "Create one on the right." : ""}</p>
              : <ul>{res.data.rows.map((e) => <EntityRow key={e.id} e={e} />)}</ul>}
          </div>
          {total > 0 && (
            <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
              <span>{total} result{total === 1 ? "" : "s"}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => go({ page: page - 1 || undefined })}>Previous</Button>
                <span>{page + 1} / {pages}</span>
                <Button variant="outline" size="sm" disabled={page + 1 >= pages} onClick={() => go({ page: page + 1 })}>Next</Button>
              </div>
            </div>
          )}
        </div>
        {canEdit && (
          <aside>
            <CreateEntityForm orgId={orgId} kinds={["object", "observation", "dataset"]}
              onCreated={(r) => navigate({ to: "/app/item/$kind/$id", params: { kind: r.kind, id: r.id } })} />
          </aside>
        )}
      </section>
    </div>
  );
}
