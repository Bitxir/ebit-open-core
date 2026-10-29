import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { Json } from "@/integrations/supabase/types";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Link2, Trash2 } from "lucide-react";
import { addToDataset, getEntity, linkEntities, searchEntities, setDatasetPublished, unlinkEntities, updateRights } from "@/functions/explorer.functions";
import { GRAPH_KINDS, REL_TYPES, relTypesFor, type GraphKind, type RelType } from "@/core/graph";
import { RIGHTS_LABELS, RIGHTS_STATES, canTransition, type RightsState } from "@/core/rights";
import { EntityRow, KIND_META, RightsBadge, selectClass, workspacesQuery } from "@/components/entity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const entityQuery = (kind: GraphKind, id: string) => queryOptions({ queryKey: ["entity", kind, id], queryFn: () => getEntity({ data: { kind, id } }) });

export const Route = createFileRoute("/_authenticated/app/item/$kind/$id")({
  loader: async ({ context, params }) => {
    if (!(GRAPH_KINDS as readonly string[]).includes(params.kind)) throw notFound();
    await context.queryClient.ensureQueryData(workspacesQuery);
    const e = await context.queryClient.ensureQueryData(entityQuery(params.kind as GraphKind, params.id));
    if (!e) throw notFound();
  },
  head: () => ({ meta: [{ title: "Item | EBiT Open Core" }, { name: "description", content: "Workspace item details, rights, relationships and provenance." }, { property: "og:title", content: "Item | EBiT Open Core" }, { property: "og:description", content: "Workspace item details, rights, relationships and provenance." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: ItemPage,
  notFoundComponent: () => <p className="text-muted-foreground">This item doesn't exist or you don't have access. <Link to="/app/explorer" search={{ kind: "asset" }} className="underline">Back to explorer</Link></p>,
  errorComponent: ({ error }) => <p role="alert" className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">Couldn't load item: {error instanceof Error ? error.message : String(error)}</p>,
});

const SKIP = new Set(["id", "org_id", "rights_id", "metadata", "original_metadata", "created_by", "storage_path", "parent_id", "object_id"]);

function ItemPage() {
  const { kind, id } = Route.useParams() as { kind: GraphKind; id: string };
  const { data: e } = useSuspenseQuery(entityQuery(kind, id));
  const { data: ws } = useSuspenseQuery(workspacesQuery);
  const canEdit = !!ws[0] && ws[0].role !== "viewer";
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ["entity"] });
  if (!e) return null;
  const Icon = KIND_META[kind].icon;
  const fields = Object.entries(e.fields).filter(([k, v]) => !SKIP.has(k) && v !== null && v !== "" && typeof v !== "object");
  const meta = e.fields["metadata"] as Record<string, unknown> | undefined;

  return (
    <div className="mx-auto max-w-5xl">
      <Link to="/app/explorer" search={{ kind }} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {KIND_META[kind].plural}</Link>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        <Icon className="mt-1 h-7 w-7 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-bold md:text-3xl">{e.summary.label || e.summary.ebit_id}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{e.summary.ebit_id} · {KIND_META[kind].label}</p>
        </div>
        <RightsBadge state={e.summary.rights} />
      </div>
      {kind === "observation" && e.summary.status !== "verified" && (
        <p className="mt-3 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground">Status: <strong>{e.summary.status}</strong>. This observation has not been verified by a reviewer.</p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Details">
            <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
              {fields.map(([k, v]) => (<Fragment key={k}><dt className="text-muted-foreground">{k.replace(/_/g, " ")}</dt><dd className="break-all">{String(v)}</dd></Fragment>))}
            </dl>
            {meta && Object.keys(meta).length > 0 && (
              <details className="mt-3 text-sm"><summary className="cursor-pointer text-muted-foreground">Extracted metadata</summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{JSON.stringify(meta, null, 2)}</pre></details>
            )}
          </Panel>

          <Panel title={`Links (${e.links.length})`}>
            {e.links.length === 0 ? <p className="text-sm text-muted-foreground">Not linked to anything yet.</p> : (
              <ul className="-mx-3">
                {e.links.map((l) => l.other && (
                  <div key={l.id}>
                    <p className="flex items-center gap-1 px-3 pt-2 text-xs text-muted-foreground">
                      {l.direction === "out" ? <>this {REL_TYPES[l.rel_type as RelType]?.label ?? l.rel_type} <ArrowRight className="h-3 w-3" /></> : <><ArrowLeft className="h-3 w-3" /> {REL_TYPES[l.rel_type as RelType]?.label ?? l.rel_type} this</>}
                    </p>
                    <EntityRow e={l.other} action={canEdit ? <UnlinkButton id={l.id} onDone={refresh} /> : null} />
                  </div>
                ))}
              </ul>
            )}
            {canEdit && ws[0] && <LinkForm fromKind={kind} fromId={id} orgId={ws[0].id} onDone={refresh} />}
          </Panel>

          {kind === "dataset" && (
            <Panel title={`Contents (${e.datasetItems.length})`}>
              {e.datasetItems.length === 0 ? <p className="text-sm text-muted-foreground">Empty. Add items from their own page.</p> : <ul className="-mx-3">{e.datasetItems.map((x) => <EntityRow key={x.id} e={x} />)}</ul>}
            </Panel>
          )}

          <Panel title="History">
            {e.provenance.length === 0 ? <p className="text-sm text-muted-foreground">No history recorded.</p> : (
              <ol className="space-y-3 border-l border-border pl-4">
                {e.provenance.map((p) => (
                  <li key={p.id} className="text-sm">
                    <p className="font-medium">{p.event_type.replace(/_/g, " ")}</p>
                    <p className="text-xs text-muted-foreground">{new Date(p.occurred_at).toLocaleString()} · by {p.agent}{p.software ? ` · ${p.software} ${p.software_version ?? ""}` : ""}</p>
                  </li>
                ))}
              </ol>
            )}
            {e.versions.length > 0 && (
              <div className="mt-4 text-sm"><p className="font-medium">Versions</p>
                <ul className="mt-1 space-y-1 font-mono text-xs text-muted-foreground">{e.versions.map((v) => <li key={v.version}>v{v.version}{v.is_original ? " · original (locked)" : ""} · {v.sha256?.slice(0, 16)}…</li>)}</ul></div>
            )}
          </Panel>
        </div>

        <aside className="space-y-6">
          <RightsPanel rights={e.rights} canEdit={canEdit} onDone={refresh} />
          {kind === "dataset" ? <PublishPanel id={id} published={!!e.fields["published"]} rights={e.summary.rights} canEdit={canEdit} onDone={refresh} />
            : <DatasetPanel item={{ kind, id }} inDatasets={e.inDatasets} orgId={ws[0]?.id} canEdit={canEdit} onDone={refresh} />}
        </aside>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-2xl border border-border p-4"><h2 className="mb-3 text-sm font-semibold">{title}</h2>{children}</section>;
}

function UnlinkButton({ id, onDone }: { id: string; onDone: () => void }) {
  const unlink = useServerFn(unlinkEntities);
  return (
    <button aria-label="Remove link" className="rounded p-1 text-muted-foreground hover:text-destructive"
      onClick={async () => { const r = await unlink({ data: { relationshipId: id } }); r.ok ? (toast.success("Link removed"), onDone()) : toast.error(r.reason); }}>
      <Trash2 className="h-4 w-4" />
    </button>
  );
}

function LinkForm({ fromKind, fromId, orgId, onDone }: { fromKind: GraphKind; fromId: string; orgId: string; onDone: () => void }) {
  const link = useServerFn(linkEntities);
  const [open, setOpen] = useState(false);
  const [toKind, setToKind] = useState<GraphKind>(fromKind === "asset" ? "object" : "object");
  const [q, setQ] = useState("");
  const types = relTypesFor(fromKind, toKind);
  const [rel, setRel] = useState<RelType | "">("");
  const relValue: RelType = rel && types.includes(rel) ? rel : (types[0] ?? "related_to");
  const results = useQuery({ queryKey: ["link-search", orgId, toKind, q], queryFn: () => searchEntities({ data: { orgId, kind: toKind, q: q || undefined, page: 0 } }), enabled: open });
  if (!open) return <Button variant="outline" size="sm" className="mt-3" onClick={() => setOpen(true)}><Link2 className="h-4 w-4" /> Link to…</Button>;
  return (
    <div className="mt-4 space-y-2 rounded-xl border border-dashed border-border p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><Label htmlFor="l-kind" className="text-xs">Link to a</Label>
          <select id="l-kind" className={selectClass} value={toKind} onChange={(e) => setToKind(e.target.value as GraphKind)}>
            {GRAPH_KINDS.filter((k) => relTypesFor(fromKind, k).length).map((k) => <option key={k} value={k}>{KIND_META[k].label}</option>)}
          </select></div>
        <div className="space-y-1"><Label htmlFor="l-rel" className="text-xs">This item…</Label>
          <select id="l-rel" className={selectClass} value={relValue} onChange={(e) => setRel(e.target.value as RelType)}>
            {types.map((t) => <option key={t} value={t}>{REL_TYPES[t].label}</option>)}
          </select></div>
      </div>
      <Input placeholder={`Search ${KIND_META[toKind].plural.toLowerCase()}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search items to link" />
      <ul className="-mx-3 max-h-64 overflow-auto">
        {results.data?.rows.filter((r) => !(r.kind === fromKind && r.id === fromId)).map((r) => (
          <EntityRow key={r.id} e={r} action={<Button size="sm" onClick={async () => {
            const res = await link({ data: { from: { kind: fromKind, id: fromId }, relType: relValue, to: { kind: toKind, id: r.id } } });
            res.ok ? (toast.success("Linked"), onDone()) : toast.error(res.reason);
          }}>Link</Button>} />
        ))}
        {results.data?.rows.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No {KIND_META[toKind].plural.toLowerCase()} found.</p>}
      </ul>
      <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>Done</Button>
    </div>
  );
}

function RightsPanel({ rights, canEdit, onDone }: { rights: Record<string, Json> | null; canEdit: boolean; onDone: () => void }) {
  const save = useServerFn(updateRights);
  const cur = (rights?.["state"] as RightsState) ?? "unknown";
  const [state, setState] = useState<RightsState>(cur);
  const [license, setLicense] = useState((rights?.["license"] as string) ?? "");
  const [attribution, setAttribution] = useState((rights?.["attribution"] as string) ?? "");
  const [source, setSource] = useState((rights?.["source"] as string) ?? "");
  if (!rights) return <Panel title="Rights"><p className="text-sm text-muted-foreground">No rights record — treat as unknown.</p></Panel>;
  const options = RIGHTS_STATES.filter((s) => s === cur || canTransition(cur, s));
  return (
    <Panel title="Rights">
      <div className="space-y-2">
        <select aria-label="Rights state" disabled={!canEdit} className={selectClass} value={state} onChange={(e) => setState(e.target.value as RightsState)}>
          {options.map((s) => <option key={s} value={s}>{RIGHTS_LABELS[s]}</option>)}
        </select>
        <Input aria-label="Licence" placeholder="Licence" disabled={!canEdit} value={license} onChange={(e) => setLicense(e.target.value)} />
        <Input aria-label="Attribution" placeholder="Attribution" disabled={!canEdit} value={attribution} onChange={(e) => setAttribution(e.target.value)} />
        <Input aria-label="Source" placeholder="Source" disabled={!canEdit} value={source} onChange={(e) => setSource(e.target.value)} />
        {rights["reviewed_at"] ? <p className="text-xs text-muted-foreground">Last reviewed {new Date(String(rights["reviewed_at"])).toLocaleString()}</p> : null}
        {canEdit && <Button size="sm" className="w-full" onClick={async () => {
          const r = await save({ data: { rightsId: String(rights["id"]), state, license: license.trim() || null, attribution: attribution.trim() || null, source: source.trim() || null } });
          r.ok ? (toast.success("Rights saved"), onDone()) : toast.error(r.reason);
        }}>Save rights</Button>}
      </div>
    </Panel>
  );
}

function DatasetPanel({ item, inDatasets, orgId, canEdit, onDone }: { item: { kind: GraphKind; id: string }; inDatasets: { id: string; label: string; ebit_id: string }[]; orgId: string | undefined; canEdit: boolean; onDone: () => void }) {
  const add = useServerFn(addToDataset);
  const ds = useQuery({ queryKey: ["datasets-pick", orgId], queryFn: () => searchEntities({ data: { orgId: orgId!, kind: "dataset", page: 0 } }), enabled: !!orgId && canEdit });
  const [pick, setPick] = useState("");
  const available = (ds.data?.rows ?? []).filter((d) => !inDatasets.some((x) => x.id === d.id));
  return (
    <Panel title="Datasets">
      {inDatasets.length === 0 ? <p className="text-sm text-muted-foreground">Not in any dataset.</p> : (
        <ul className="space-y-1 text-sm">{inDatasets.map((d) => <li key={d.id}><Link to="/app/item/$kind/$id" params={{ kind: "dataset", id: d.id }} className="hover:underline">{d.label}</Link></li>)}</ul>
      )}
      {canEdit && available.length > 0 && (
        <div className="mt-3 flex gap-2">
          <select aria-label="Choose dataset" className={selectClass} value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">Add to dataset…</option>{available.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
          <Button size="sm" disabled={!pick} onClick={async () => { const r = await add({ data: { datasetId: pick, item } }); r.ok ? (toast.success("Added"), setPick(""), onDone()) : toast.error(r.reason); }}>Add</Button>
        </div>
      )}
    </Panel>
  );
}

function PublishPanel({ id, published, rights, canEdit, onDone }: { id: string; published: boolean; rights: string | null; canEdit: boolean; onDone: () => void }) {
  const set = useServerFn(setDatasetPublished);
  const allowed = rights === "permitted_redistribution";
  return (
    <Panel title="Publishing">
      <p className="text-sm">{published ? "Published." : "Not published."}</p>
      {!allowed && !published && <p className="mt-1 text-xs text-muted-foreground">Publishing needs rights set to “Permitted for redistribution”.</p>}
      {canEdit && <Button size="sm" variant="outline" className="mt-3 w-full" disabled={!published && !allowed}
        onClick={async () => { const r = await set({ data: { datasetId: id, published: !published } }); r.ok ? (toast.success(published ? "Unpublished" : "Published"), onDone()) : toast.error(r.reason); }}>
        {published ? "Unpublish" : "Publish"}</Button>}
    </Panel>
  );
}
