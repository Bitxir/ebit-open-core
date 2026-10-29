import { ClientOnly, createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useQueryClient, useSuspenseQuery, keepPreviousData } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { lazy, Suspense, useState, type FormEvent } from "react";
import { Download, Leaf, Map, Plus, Search, Shield, Upload } from "lucide-react";
import { toast } from "sonner";
import { createOccurrence, exportBiodiversity, getBiodiversity, getBiodiversitySources, getOccurrenceDetails, importOccurrences, type BiodiversityRow } from "@/functions/biodiversity.functions";
import { BASIS } from "@/modules/biodiversity/darwin-core";
import { RightsBadge, selectClass, workspacesQuery } from "@/components/entity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const SpeciesMap = lazy(() => import("@/components/biodiversity-map"));
const recordsQuery = (orgId: string, filters: { page: number; q: string; from?: string | undefined; to?: string | undefined; sensitive?: boolean | undefined }) => queryOptions({ queryKey: ["biodiversity", orgId, filters], queryFn: () => getBiodiversity({ data: { orgId, page: filters.page, q: filters.q, ...(filters.from ? { from: filters.from } : {}), ...(filters.to ? { to: filters.to } : {}), ...(filters.sensitive !== undefined ? { sensitive: filters.sensitive } : {}) } }), placeholderData: keepPreviousData });
export const Route = createFileRoute("/_authenticated/app/biodiversity")({
  loader: async ({ context }) => {
    const ws = await context.queryClient.ensureQueryData(workspacesQuery);
    if (ws[0]) await context.queryClient.ensureQueryData(recordsQuery(ws[0].id, { page: 0, q: "" }));
  },
  head: () => ({ meta: [{ title: "Biodiversity | EBiT Open Core" }, { name: "description", content: "Species occurrences, Darwin Core records and protected locations in your EBiT workspace." }, { property: "og:title", content: "Biodiversity | EBiT Open Core" }, { property: "og:description", content: "Species occurrences, Darwin Core records and protected locations." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: BiodiversityPage,
  errorComponent: ({ error }) => <p role="alert" className="text-destructive">{error instanceof Error ? error.message : "Could not load biodiversity"}</p>,
});

function BiodiversityPage() {
  const { data: ws } = useSuspenseQuery(workspacesQuery);
  if (!ws[0]) return <p className="text-muted-foreground">You are not a member of any workspace.</p>;
  return <Biodiversity orgId={ws[0].id} canEdit={ws[0].role !== "viewer"} canCurate={["admin", "curator"].includes(ws[0].role)} />;
}
function Biodiversity({ orgId, canEdit, canCurate }: { orgId: string; canEdit: boolean; canCurate: boolean }) {
  const qc = useQueryClient();
  const [filters, setFilters] = useState({ page: 0, q: "", from: "", to: "", sensitive: "" });
  const [term, setTerm] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [detail, setDetail] = useState<BiodiversityRow | null>(null);
  const [busy, setBusy] = useState(false);
  const { data, error, isFetching } = useQuery(recordsQuery(orgId, { page: filters.page, q: filters.q, from: filters.from || undefined, to: filters.to || undefined, sensitive: filters.sensitive ? filters.sensitive === "true" : undefined }));
  const exportFn = useServerFn(exportBiodiversity);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["biodiversity"] }); qc.invalidateQueries({ queryKey: ["search"] }); };
  async function download() {
    setBusy(true);
    try { const result = await exportFn({ data: { orgId } }); const url = URL.createObjectURL(new Blob([result.csv], { type: "text/csv;charset=utf-8" })); const a = document.createElement("a"); a.href = url; a.download = "ebit-darwin-core.csv"; a.click(); URL.revokeObjectURL(url); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Export failed"); } finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4"><div><div className="flex items-center gap-3"><Leaf className="h-7 w-7 text-leaf" /><h1 className="text-3xl font-bold">Biodiversity</h1></div><p className="mt-2 text-sm text-muted-foreground">{data?.total ?? 0} species records · workspace collection</p></div>
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy || !data?.total} onClick={download}><Download className="h-4 w-4" />Darwin Core CSV</Button>{canCurate && <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4" />Import</Button>}{canEdit && <Button onClick={() => setNewOpen(true)}><Plus className="h-4 w-4" />Occurrence</Button>}</div>
    </header>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); setFilters({ ...filters, q: term, page: 0 }); }}>
      <div className="min-w-48 flex-1"><Label htmlFor="species-search">Scientific name</Label><div className="mt-1 flex gap-2"><Input id="species-search" value={term} onChange={(e) => setTerm(e.target.value)} /><Button type="submit" size="icon" variant="outline" aria-label="Search species"><Search className="h-4 w-4" /></Button></div></div>
      {(["from", "to"] as const).map((k) => <div key={k}><Label htmlFor={`species-${k}`}>Event date {k}</Label><Input id={`species-${k}`} className="mt-1" type="date" value={filters[k]} onChange={(e) => setFilters({ ...filters, [k]: e.target.value, page: 0 })} /></div>)}
      <div><Label htmlFor="species-sensitive">Location access</Label><select id="species-sensitive" className={`${selectClass} mt-1`} value={filters.sensitive} onChange={(e) => setFilters({ ...filters, sensitive: e.target.value, page: 0 })}><option value="">All records</option><option value="true">Sensitive</option><option value="false">Not sensitive</option></select></div>
    </form>
    {error && <p role="alert" className="text-destructive">{error.message}</p>}
    {data && <section aria-label="Observation locations"><div className="mb-2 flex items-center justify-between text-xs text-muted-foreground"><span className="flex items-center gap-2"><Map className="h-4 w-4" />Locations on this page</span><span className="flex items-center gap-1"><Shield className="h-3 w-3" />Sensitive locations generalised</span></div><ClientOnly fallback={<div className="h-[420px] bg-muted" />}><Suspense fallback={<div className="h-[420px] bg-muted" />}><SpeciesMap rows={data.rows} /></Suspense></ClientOnly></section>}
    <section aria-label="Species records" aria-busy={isFetching}>
      {!data ? <p className="text-muted-foreground">Loading records…</p> : !data.rows.length ? <p className="border-y border-border py-8 text-sm text-muted-foreground">No species records {filters.q || filters.from || filters.to || filters.sensitive ? "match these filters." : "yet."}</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr>{["Scientific name", "Event date", "Basis of record", "Location", "Rights"].map((h) => <th key={h} className="px-3 py-3">{h}</th>)}</tr></thead><tbody>{data.rows.map((r) => <tr key={r.id} className="border-b border-border"><td className="px-3 py-3"><Button variant="link" className="h-auto px-0 text-leaf" onClick={() => setDetail(r)}>{r.taxa.scientific_name}</Button><p className="font-mono text-xs text-muted-foreground">{r.observations.ebit_id} · {r.observations.verification_status}</p></td><td className="whitespace-nowrap px-3 py-3">{r.event_date || "Not recorded"}</td><td className="px-3 py-3">{r.basis_of_record || "Not recorded"}</td><td className="whitespace-nowrap px-3 py-3">{r.latitude === null || r.longitude === null ? "Not recorded" : `${r.latitude.toFixed(2)}, ${r.longitude.toFixed(2)}`}{r.sensitive && <p className="text-xs text-heritage">Generalised · sensitive</p>}</td><td className="px-3 py-3"><RightsBadge state={r.observations.rights_records?.state ?? null} /></td></tr>)}</tbody></table></div>}
      {!!data?.total && <div className="mt-4 flex items-center justify-end gap-3 text-sm"><Button variant="outline" size="sm" disabled={!filters.page} onClick={() => setFilters({ ...filters, page: filters.page - 1 })}>Previous</Button><span>{filters.page + 1} / {Math.ceil(data.total / 25)}</span><Button variant="outline" size="sm" disabled={(filters.page + 1) * 25 >= data.total} onClick={() => setFilters({ ...filters, page: filters.page + 1 })}>Next</Button></div>}
    </section>
    <Dialog open={newOpen} onOpenChange={setNewOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>New occurrence</DialogTitle></DialogHeader><OccurrenceForm orgId={orgId} done={() => { refresh(); setNewOpen(false); }} /></DialogContent></Dialog>
    <Dialog open={importOpen} onOpenChange={setImportOpen}><DialogContent><DialogHeader><DialogTitle>Import Darwin Core occurrences</DialogTitle></DialogHeader>{importOpen && <ImportForm orgId={orgId} done={refresh} />}</DialogContent></Dialog>
    <Dialog open={!!detail} onOpenChange={(v) => { if (!v) setDetail(null); }}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{detail?.taxa.scientific_name}</DialogTitle></DialogHeader>{detail && <OccurrenceDetail row={detail} canCurate={canCurate} />}</DialogContent></Dialog>
  </div>;
}

function OccurrenceForm({ orgId, done }: { orgId: string; done: () => void }) {
  const save = useServerFn(createOccurrence);
  const [busy, setBusy] = useState(false);
  const [sensitive, setSensitive] = useState(true);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = new FormData(e.currentTarget); const s = (k: string) => String(form.get(k) ?? "").trim() || null;
    setBusy(true);
    try { await save({ data: { orgId, occurrence: { scientificName: s("scientificName") ?? "", eventDate: s("eventDate"), basisOfRecord: s("basisOfRecord") as (typeof BASIS)[number] | null, decimalLatitude: s("latitude") === null ? null : Number(s("latitude")), decimalLongitude: s("longitude") === null ? null : Number(s("longitude")), habitat: s("habitat"), locality: s("locality"), recordedBy: s("recordedBy"), sensitive } } }); toast.success("Occurrence saved · rights unknown"); done(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); }
  }
  return <form className="space-y-4" onSubmit={submit}><div><Label htmlFor="scientificName">Scientific name</Label><Input id="scientificName" name="scientificName" required maxLength={300} /></div><div className="grid grid-cols-2 gap-3"><div><Label htmlFor="eventDate">Event date</Label><Input id="eventDate" name="eventDate" type="date" /></div><div><Label htmlFor="basisOfRecord">Basis of record</Label><select id="basisOfRecord" name="basisOfRecord" className={selectClass}><option value="">Not recorded</option>{BASIS.map((v) => <option key={v}>{v}</option>)}</select></div></div><div className="grid grid-cols-2 gap-3">{["latitude", "longitude"].map((k) => <div key={k}><Label htmlFor={k}>{k === "latitude" ? "Latitude" : "Longitude"}</Label><Input id={k} name={k} type="number" step="any" min={k === "latitude" ? -90 : -180} max={k === "latitude" ? 90 : 180} /></div>)}</div>{["habitat", "locality", "recordedBy"].map((k) => <div key={k}><Label htmlFor={k}>{k === "recordedBy" ? "Recorded by" : k === "habitat" ? "Habitat" : "Locality"}</Label><Input id={k} name={k} maxLength={1000} /></div>)}<label className="flex items-center gap-2 text-sm"><Checkbox checked={sensitive} onCheckedChange={(v) => setSensitive(v === true)} />Sensitive location</label><Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Save occurrence"}</Button></form>;
}
function ImportForm({ orgId, done }: { orgId: string; done: () => void }) {
  const { data: sources, error } = useQuery({ queryKey: ["biodiversity-sources", orgId], queryFn: () => getBiodiversitySources({ data: { orgId } }) });
  const importFn = useServerFn(importOccurrences);
  const [assetId, setAssetId] = useState(""); const [allSensitive, setAllSensitive] = useState(true); const [busy, setBusy] = useState(false); const [result, setResult] = useState("");
  async function submit(e: FormEvent) { e.preventDefault(); setBusy(true); try { const r = await importFn({ data: { orgId, assetId, allSensitive } }) as { added: number; skipped: number }; setResult(`${r.added} imported · ${r.skipped} already present`); done(); } catch (e) { toast.error(e instanceof Error ? e.message : "Import failed"); } finally { setBusy(false); } }
  return <form onSubmit={submit} className="space-y-4">{error && <p role="alert" className="text-destructive">{error.message}</p>}<Label htmlFor="dwc-source">Stored original</Label><select id="dwc-source" className={selectClass} required value={assetId} onChange={(e) => setAssetId(e.target.value)}><option value="">Select a Darwin Core file</option>{sources?.map((s) => <option key={s.id} value={s.id}>{s.file_name} · {s.ebit_id}</option>)}</select><Button asChild variant="link" className="px-0"><Link to="/app/ingestion">Upload a CSV / TSV</Link></Button><label className="flex items-center gap-2 text-sm"><Checkbox checked={allSensitive} onCheckedChange={(v) => setAllSensitive(v === true)} />Mark every occurrence sensitive</label><Button type="submit" disabled={busy || !assetId}>{busy ? "Importing…" : "Import occurrences"}</Button>{result && <p role="status" className="text-sm text-leaf">{result}</p>}</form>;
}
function OccurrenceDetail({ row, canCurate }: { row: BiodiversityRow; canCurate: boolean }) {
  const { data: details } = useQuery({ queryKey: ["biodiversity-detail", row.id], queryFn: () => getOccurrenceDetails({ data: { id: row.id } }), enabled: canCurate });
  return <div className="space-y-4 text-sm"><p className="font-mono text-muted-foreground">{row.observations.ebit_id}</p><dl className="grid grid-cols-2 gap-3"><dt>Verification</dt><dd>{row.observations.verification_status}</dd><dt>Event date</dt><dd>{row.event_date || "Not recorded"}</dd><dt>Taxon rank</dt><dd>{row.taxa.taxon_rank || "Not recorded"}</dd><dt>Habitat</dt><dd>{row.habitat || (row.sensitive ? "Withheld" : "Not recorded")}</dd><dt>Location</dt><dd>{row.sensitive ? "Generalised · sensitive" : "Recorded"}</dd>{details && <><dt>Exact coordinates</dt><dd>{details.latitude === null ? "Not recorded" : `${details.latitude}, ${details.longitude}`}</dd><dt>Locality</dt><dd>{details.locality || "Not recorded"}</dd><dt>Recorded by</dt><dd>{details.recorded_by || "Not recorded"}</dd></>}</dl>{details && <details><summary className="cursor-pointer">Original row · restricted</summary><pre className="mt-2 max-h-48 overflow-auto bg-muted p-3 text-xs">{JSON.stringify(details.original_metadata, null, 2)}</pre></details>}<Button asChild variant="outline"><Link to="/app/item/$kind/$id" params={{ kind: "observation", id: row.id }}>Rights, links & provenance</Link></Button></div>;
}