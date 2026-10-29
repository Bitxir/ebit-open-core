import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type DragEvent } from "react";
import { FileUp, RotateCw, CheckCircle2, AlertTriangle, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { listIngestions, listWorkspaces, prepareIngest, processIngest } from "@/functions/ingest.functions";
import { acceptedExtensions } from "@/adapters/registry";
import { MAX_UPLOAD_BYTES, sha256Hex } from "@/core/ingest";
import { RIGHTS_LABELS, RIGHTS_STATES, type RightsState } from "@/core/rights";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const workspacesQuery = queryOptions({ queryKey: ["workspaces"], queryFn: () => listWorkspaces() });
const ingestionsQuery = (orgId: string) =>
  queryOptions({ queryKey: ["ingestions", orgId], queryFn: () => listIngestions({ data: { orgId } }) });

export const Route = createFileRoute("/_authenticated/app/ingestion")({
  loader: async ({ context }) => {
    const ws = await context.queryClient.ensureQueryData(workspacesQuery);
    if (ws[0]) await context.queryClient.ensureQueryData(ingestionsQuery(ws[0].id));
  },
  head: () => ({ meta: [{ title: "Ingestion | EBiT Open Core" }, { name: "description", content: "Register, upload and process original files in your EBiT workspace." }, { property: "og:title", content: "Ingestion | EBiT Open Core" }, { property: "og:description", content: "Register, upload and process original files in your EBiT workspace." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: IngestionPage,
  errorComponent: ({ error }) => (
    <p className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">
      Couldn't load ingestion: {error instanceof Error ? error.message : "unknown error"}
    </p>
  ),
});

type ItemState = { name: string; phase: "hashing" | "registering" | "uploading" | "processing" | "done" | "duplicate" | "failed"; message?: string };

const fmtBytes = (n: number | null) => (n == null ? "—" : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);

function IngestionPage() {
  const { data: workspaces } = useSuspenseQuery(workspacesQuery);
  const ws = workspaces[0];
  if (!ws) return <p className="text-muted-foreground">You are not a member of any workspace.</p>;
  return <Ingestion orgId={ws.id} canUpload={ws.role !== "viewer"} />;
}

function Ingestion({ orgId, canUpload }: { orgId: string; canUpload: boolean }) {
  const qc = useQueryClient();
  const { data: rows } = useSuspenseQuery(ingestionsQuery(orgId));
  const prepare = useServerFn(prepareIngest);
  const processFn = useServerFn(processIngest);
  const inputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<ItemState[]>([]);
  const [drag, setDrag] = useState(false);
  const [rightsState, setRightsState] = useState<RightsState>("unknown");
  const [license, setLicense] = useState("");
  const [attribution, setAttribution] = useState("");
  const [source, setSource] = useState("");
  const accepted = acceptedExtensions();

  const update = (i: number, patch: Partial<ItemState>) => setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const refresh = () => qc.invalidateQueries({ queryKey: ["ingestions", orgId] });

  async function ingest(file: File, i: number) {
    try {
      if (file.size === 0) return update(i, { phase: "failed", message: "File is empty." });
      if (file.size > MAX_UPLOAD_BYTES) return update(i, { phase: "failed", message: "File is larger than 50 MB." });
      update(i, { phase: "hashing" });
      const sha256 = await sha256Hex(new Uint8Array(await file.arrayBuffer()));
      update(i, { phase: "registering" });
      const res = await prepare({
        data: {
          orgId, fileName: file.name, mimeType: file.type || null, byteSize: file.size, sha256,
          rights: { state: rightsState, license: license.trim() || null, attribution: attribution.trim() || null, source: source.trim() || null },
        },
      });
      if (res.status === "rejected") return update(i, { phase: "failed", message: res.reason });
      if (res.status === "duplicate") return update(i, { phase: "duplicate", message: `Already stored as ${res.asset.ebit_id}` });

      update(i, { phase: "uploading" });
      const { error } = await supabase.storage.from("originals").upload(res.storagePath, file, { upsert: false, ...(file.type ? { contentType: file.type } : {}) });
      if (error && !/exists/i.test(error.message)) return update(i, { phase: "failed", message: "Upload failed. Try again." });

      update(i, { phase: "processing" });
      const out = await processFn({ data: { jobId: res.jobId } });
      update(i, out.status === "succeeded" ? { phase: "done", message: res.ebitId } : { phase: "failed", message: out.error ?? "Processing failed." });
    } catch (e) {
      update(i, { phase: "failed", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  async function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    const files = Array.from(list).slice(0, 20);
    const start = items.length;
    setItems((prev) => [...prev, ...files.map((f) => ({ name: f.name, phase: "hashing" as const }))]);
    for (const [k, f] of files.entries()) await ingest(f, start + k); // sequential keeps memory and cost low
    refresh();
  }

  async function retry(jobId: string) {
    const out = await processFn({ data: { jobId } });
    out.status === "succeeded" ? toast.success("Processed") : toast.error(out.error ?? "Still failing");
    refresh();
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    if (canUpload) handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-3xl font-bold">Ingestion</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Originals are stored unchanged. Each file is fingerprinted, checked for duplicates and read by its adapter. Nothing missing is filled in.
      </p>

      {!canUpload ? (
        <p className="mt-6 rounded-xl border border-border p-4 text-sm">You have view-only access. Ask an admin for contributor access to upload.</p>
      ) : (
        <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            className={cn("flex min-h-56 flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors", drag ? "border-primary bg-primary/10" : "border-border")}
          >
            <FileUp className="h-8 w-8 text-primary" aria-hidden />
            <p className="mt-3 font-medium">Drop files here</p>
            <p className="mt-1 text-xs text-muted-foreground">{accepted.join(" ")} · up to 50 MB · 20 files at a time</p>
            <Button className="mt-4" onClick={() => inputRef.current?.click()}>Choose files</Button>
            <input ref={inputRef} type="file" multiple hidden accept={accepted.join(",")} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
          </div>

          <fieldset className="space-y-3 rounded-2xl border border-border p-4">
            <legend className="px-1 text-sm font-semibold">Rights for this batch</legend>
            <div className="space-y-1.5">
              <Label htmlFor="rights">Permission</Label>
              <select id="rights" value={rightsState} onChange={(e) => setRightsState(e.target.value as RightsState)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
                {RIGHTS_STATES.map((s) => <option key={s} value={s}>{RIGHTS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="space-y-1.5"><Label htmlFor="license">Licence</Label><Input id="license" placeholder="e.g. CC BY 4.0" value={license} onChange={(e) => setLicense(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="attr">Attribution</Label><Input id="attr" value={attribution} onChange={(e) => setAttribution(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="source">Source</Label><Input id="source" placeholder="Who or where it came from" value={source} onChange={(e) => setSource(e.target.value)} /></div>
            <p className="text-xs text-muted-foreground">Leave as "Unknown" unless you know. Public availability is not permission.</p>
          </fieldset>
        </section>
      )}

      {items.length > 0 && (
        <ul className="mt-6 space-y-2" aria-live="polite">
          {items.map((it, i) => (
            <li key={i} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-sm">
              {it.phase === "done" ? <CheckCircle2 className="h-4 w-4 text-leaf" /> : it.phase === "failed" ? <AlertTriangle className="h-4 w-4 text-destructive" /> : it.phase === "duplicate" ? <Copy className="h-4 w-4 text-heritage" /> : <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{it.name}</span>
              <span className={cn("shrink-0 text-xs", it.phase === "failed" ? "text-destructive" : "text-muted-foreground")}>
                {it.phase === "done" ? `Stored · ${it.message}` : it.phase === "duplicate" ? it.message : it.phase === "failed" ? it.message : `${it.phase}…`}
              </span>
            </li>
          ))}
        </ul>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recent uploads</h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No files yet. Upload one above to see it here.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs text-muted-foreground">
                <tr><th className="px-3 py-2">File</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Size</th><th className="px-3 py-2">Captured</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => {
                  const job = r.processing_jobs[0];
                  return (
                    <tr key={r.id}>
                      <td className="px-3 py-2"><div className="max-w-56 truncate">{r.file_name}</div><div className="font-mono text-[11px] text-muted-foreground">{r.ebit_id}</div></td>
                      <td className="px-3 py-2">{r.kind}</td>
                      <td className="px-3 py-2 tabular-nums">{fmtBytes(r.byte_size)}</td>
                      <td className="px-3 py-2">{r.captured_at ? new Date(r.captured_at).toLocaleString() : <span className="text-muted-foreground">not recorded</span>}</td>
                      <td className="px-3 py-2 tabular-nums">{r.latitude != null && r.longitude != null ? `${r.latitude.toFixed(5)}, ${r.longitude.toFixed(5)}` : <span className="text-muted-foreground">not recorded</span>}</td>
                      <td className="px-3 py-2">
                        <span className={cn(r.ingestion_status === "ready" ? "text-leaf" : r.ingestion_status === "failed" ? "text-destructive" : "text-muted-foreground")}>{r.ingestion_status}</span>
                        {job?.error && <p className="max-w-56 text-xs text-muted-foreground">{job.error}</p>}
                        {r.ingestion_status === "failed" && job && job.attempts < job.max_attempts && canUpload && (
                          <Button size="sm" variant="ghost" className="mt-1 h-7 px-2" onClick={() => retry(job.id)}><RotateCw className="mr-1 h-3 w-3" />Retry ({job.attempts}/{job.max_attempts})</Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
