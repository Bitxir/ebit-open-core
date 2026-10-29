import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Play, RotateCw, ShieldCheck, X, Flag } from "lucide-react";
import { toast } from "sonner";
import { getAiWorkspace, queueAnalysis, runAnalysis, reviewAnalysis, resumeAi } from "@/functions/ai.functions";
import { listWorkspaces } from "@/functions/ingest.functions";
import { AI_TASKS, analysisAllowed, humanStatus, type Analysis, type DECISIONS } from "@/core/verification";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const aiWorkspacesQuery = queryOptions({ queryKey: ["workspaces"], queryFn: () => listWorkspaces() });
export const aiQuery = (orgId: string) => queryOptions({ queryKey: ["ai", orgId], queryFn: () => getAiWorkspace({ data: { orgId } }) });
export async function loadAi(queryClient: import("@tanstack/react-query").QueryClient) {
  const ws = await queryClient.ensureQueryData(aiWorkspacesQuery);
  if (ws[0]) await queryClient.ensureQueryData(aiQuery(ws[0].id));
}
const TASK_LABELS = { image_description: "Image description", species_suggestion: "Species suggestion", document_extraction: "Document extraction" };

export function AiWorkspace({ reviewOnly = false }: { reviewOnly?: boolean }) {
  const { data: workspaces } = useSuspenseQuery(aiWorkspacesQuery);
  const ws = workspaces[0];
  if (!ws) return <p>No workspace membership.</p>;
  if (!["admin", "curator"].includes(ws.role)) return <p className="text-muted-foreground">Curator access is required to view private AI results and review evidence.</p>;
  return <AiPanel orgId={ws.id} admin={ws.role === "admin"} reviewOnly={reviewOnly} />;
}
function AiPanel({ orgId, admin, reviewOnly }: { orgId: string; admin: boolean; reviewOnly: boolean }) {
  const qc = useQueryClient();
  const { data } = useSuspenseQuery(aiQuery(orgId));
  const queue = useServerFn(queueAnalysis);
  const run = useServerFn(runAnalysis);
  const resume = useServerFn(resumeAi);
  const [assetId, setAssetId] = useState("");
  const [task, setTask] = useState<typeof AI_TASKS[number]>("image_description");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["ai", orgId] });
  async function execute(jobId?: string) {
    setBusy(true);
    try {
      const id = jobId ?? await queue({ data: { orgId, assetId, task, consent: true } });
      await refresh();
      const result = await run({ data: { jobId: id } });
      if (result.error) toast.error(result.error);
      else if (result.status === "succeeded") toast.success("AI interpretation saved for human review.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Analysis failed."); }
    finally { setBusy(false); await refresh(); }
  }
  const eligible = data.assets.filter(a => analysisAllowed(a.kind, a.mime_type, a.rights_records?.state ?? "unknown", a.byte_size ?? 0, task));
  return <div className="max-w-5xl space-y-8">
    <header><h1 className="font-display text-3xl font-bold">{reviewOnly ? "Human verification" : "AI processing"}</h1><p className="mt-2 text-sm text-muted-foreground">{data.results.length} interpretations · {data.jobs.filter(j => j.status === "running" || j.status === "queued").length} active jobs</p></header>
    {data.control?.paused && <div role="alert" className="border-l-2 border-destructive pl-4"><p className="text-destructive">{data.control.reason}</p>{admin && <Button variant="outline" className="mt-3" onClick={async () => { try { await resume({ data: { orgId } }); await refresh(); } catch(e) { toast.error(String(e)); } }}><RotateCw className="h-4 w-4"/>Resume after restoring access</Button>}</div>}
    {!reviewOnly && <form className="space-y-4 border-y border-border py-6" onSubmit={e => { e.preventDefault(); execute(); }}>
      <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="ai-task">Analysis</Label><select id="ai-task" className="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm" value={task} onChange={e => { setTask(e.target.value as typeof task); setAssetId(""); }}>{AI_TASKS.map(t => <option key={t} value={t}>{TASK_LABELS[t]}</option>)}</select></div>
      <div><Label htmlFor="ai-original">Original</Label><select id="ai-original" className="mt-2 w-full rounded-md border border-input bg-background p-2 text-sm" value={assetId} onChange={e => setAssetId(e.target.value)} required><option value="">Select original</option>{eligible.map(a => <option key={a.id} value={a.id}>{a.file_name ?? a.ebit_id}</option>)}</select></div></div>
      {!eligible.length && <p className="text-sm text-muted-foreground">No eligible originals. Image or PDF/text files must be 10 MB or less and have processing rights.</p>}
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={e => setConsent(e.target.checked)}/><span>I have permission to send this original to Lovable AI. This analysis uses workspace credits and may contain private content.</span></label>
      <Button disabled={busy || !assetId || !consent || data.control?.paused === true}><Play className="h-4 w-4"/>{busy ? "Analyzing…" : "Analyze original"}</Button>
    </form>}
    {!reviewOnly && <section><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">Jobs</h2><Button variant="ghost" size="icon" aria-label="Refresh jobs" onClick={refresh}><RotateCw className="h-4 w-4"/></Button></div>
      {!data.jobs.length && <p className="text-sm text-muted-foreground">No AI requests yet.</p>}
      {data.jobs.map(job => <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3"><div className="min-w-0"><p className="text-sm">{TASK_LABELS[job.task as typeof task]} · {job.status} · attempt {job.attempts}/{job.max_attempts}</p>{job.error && <p className="mt-1 break-words text-sm text-destructive">{job.error}</p>}{job.retry_at && <p className="text-xs text-muted-foreground">Retry available {new Date(job.retry_at).toLocaleString()}</p>}</div>
      {(job.status === "queued" || (job.status === "failed" && job.retry_at)) && <Button variant="outline" disabled={busy || (!!job.retry_at && new Date(job.retry_at).getTime() > Date.now())} onClick={() => execute(job.id)}><Play className="h-4 w-4"/>Run</Button>}</div>)}
    </section>}
    <section><h2 className="mb-4 text-xl font-semibold">{reviewOnly ? "Review queue" : "Interpretations"}</h2>{!data.results.length && <p className="text-sm text-muted-foreground">No interpretations awaiting review.</p>}
      {data.results.map(result => <Interpretation key={result.id} result={result} refresh={refresh}/>)}
    </section>
  </div>;
}
type Result = Awaited<ReturnType<typeof getAiWorkspace>>["results"][number];
function Interpretation({ result, refresh }: { result: Result; refresh: () => Promise<unknown> }) {
  const review = useServerFn(reviewAnalysis);
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const output = result.output as unknown as Analysis;
  const status = humanStatus(result.verification_events);
  async function decide(decision: typeof DECISIONS[number]) {
    setBusy(true);
    try { await review({ data: { id: result.id, decision, evidence } }); setEvidence(""); await refresh(); toast.success("Human review saved."); }
    catch(e) { toast.error(e instanceof Error ? e.message : "Review failed."); }
    finally { setBusy(false); }
  }
  return <article className="mb-6 border-b border-border pb-6">
    <div className="flex flex-wrap items-center gap-3"><ShieldCheck className="h-5 w-5 text-water"/><h3 className="font-mono text-sm">{result.ebit_id}</h3><span className="text-sm text-heritage">AI prediction</span><span className="text-sm text-leaf">Human status: {status.replaceAll("_", " ")}</span></div>
    <p className="mt-3 whitespace-pre-wrap break-words">{output.summary}</p>
    {output.species && <p className="mt-2 text-sm">Suggested species: <i>{output.species}</i></p>}
    <p className="mt-2 text-xs text-muted-foreground">Model: {result.model} · version: {result.model_version || "not reported"} · {result.latency_ms} ms · confidence: {result.confidence === null ? "not reported" : `${Math.round(result.confidence * 100)}% (model estimate)`}</p>
    {output.extractedText && <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-words bg-muted p-3 text-sm">{output.extractedText}</pre>}
    {result.annotations.length > 0 && <dl className="mt-3 grid gap-1 text-sm">{result.annotations.map(a => <div key={a.id}><dt className="inline font-semibold">{a.label}: </dt><dd className="inline break-words text-muted-foreground">{a.value ?? "not reported"}</dd></div>)}</dl>}
    <Label className="mt-4 block" htmlFor={`evidence-${result.id}`}>Review evidence</Label><Textarea id={`evidence-${result.id}`} value={evidence} onChange={e=>setEvidence(e.target.value)} maxLength={4000} className="mt-2"/>
    <div className="mt-3 flex flex-wrap gap-2"><Button disabled={busy || !evidence.trim()} onClick={()=>decide("verified")}><Check className="h-4 w-4"/>Verify</Button><Button variant="outline" disabled={busy || !evidence.trim()} onClick={()=>decide("rejected")}><X className="h-4 w-4"/>Reject</Button><Button variant="outline" disabled={busy || !evidence.trim()} onClick={()=>decide("needs_review")}><Flag className="h-4 w-4"/>Needs review</Button></div>
    {result.verification_events.length > 0 && <details className="mt-4 text-sm"><summary className="cursor-pointer">Review history ({result.verification_events.length})</summary><ol className="mt-2 space-y-2">{[...result.verification_events].sort((a,b)=>b.created_at.localeCompare(a.created_at)).map(e=><li key={e.id} className="break-words"><strong>{e.decision.replaceAll("_"," ")}</strong> · {new Date(e.created_at).toLocaleString()}<p className="text-muted-foreground">{e.evidence}</p></li>)}</ol></details>}
  </article>;
}