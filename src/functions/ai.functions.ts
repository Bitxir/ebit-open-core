import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { AI_TASKS, DECISIONS, analysisAllowed, retryDelay } from "@/core/verification";
import { sha256Hex } from "@/core/ingest";

const orgSchema = z.object({ orgId: z.string().uuid() });
export const getAiWorkspace = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof orgSchema>) => orgSchema.parse(data))
  .handler(async ({ data, context }) => {
    const [assets, jobs, results, controls] = await Promise.all([
      context.supabase.from("assets").select("id,ebit_id,file_name,kind,mime_type,byte_size,rights_records(state)").eq("org_id", data.orgId).eq("ingestion_status", "ready").in("kind", ["image", "document"]).limit(100),
      context.supabase.from("ai_jobs").select("*").eq("org_id", data.orgId).order("created_at", { ascending: false }).limit(100),
      context.supabase.from("interpretations").select("*,annotations(*),verification_events(*)").eq("org_id", data.orgId).order("created_at", { ascending: false }).limit(100),
      context.supabase.from("ai_controls").select("*").eq("org_id", data.orgId).maybeSingle(),
    ]);
    if (jobs.error || results.error) throw new Error("Could not load AI review records.");
    return { assets: assets.data ?? [], jobs: jobs.data ?? [], results: results.data ?? [], control: controls.data };
  });

const requestSchema = z.object({ orgId: z.string().uuid(), assetId: z.string().uuid(), task: z.enum(AI_TASKS), consent: z.literal(true) });
export const queueAnalysis = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof requestSchema>) => requestSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("is_org_member", { _org: data.orgId, _min: "curator" });
    if (!allowed) throw new Error("Curator access is required for private AI results.");
    const { data: asset } = await context.supabase.from("assets").select("*,rights_records(state)").eq("org_id", data.orgId).eq("id", data.assetId).single();
    if (!asset || asset.ingestion_status !== "ready" || !analysisAllowed(asset.kind, asset.mime_type, asset.rights_records?.state ?? "unknown", asset.byte_size ?? 0, data.task)) throw new Error("Select a supported original of 10 MB or less with processing rights.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: control } = await supabaseAdmin.from("ai_controls").select("*").eq("org_id", data.orgId).maybeSingle();
    if (control?.paused) throw new Error(control.reason ?? "AI is paused. An administrator must restore access.");
    const { data: job, error } = await supabaseAdmin.from("ai_jobs").upsert({ org_id: data.orgId, asset_id: data.assetId, task: data.task, consent_by: context.userId }, { onConflict: "org_id,asset_id,task", ignoreDuplicates: true }).select("id").maybeSingle();
    if (error) throw new Error("Could not queue analysis.");
    if (job) return job.id;
    const { data: existing } = await context.supabase.from("ai_jobs").select("id").eq("org_id", data.orgId).eq("asset_id", data.assetId).eq("task", data.task).single();
    if (!existing) throw new Error("Could not read existing job.");
    return existing.id;
  });

export const runAnalysis = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: job } = await context.supabase.from("ai_jobs").select("*").eq("id", data.jobId).single();
    if (!job) throw new Error("Job not found or curator access required.");
    if (job.status === "succeeded" || job.status === "running") return { status: job.status, error: null };
    if (job.status === "paused" || job.attempts >= job.max_attempts || (job.status === "failed" && !job.retry_at)) return { status: job.status, error: job.error };
    if (job.retry_at && new Date(job.retry_at).getTime() > Date.now()) return { status: "queued", error: "Retry is not due yet." };
    const { data: allowed } = await context.supabase.rpc("is_org_member", { _org: job.org_id, _min: "curator" });
    if (!allowed) throw new Error("Curator access required.");
    const { data: asset } = await context.supabase.from("assets").select("*,rights_records(state)").eq("id", job.asset_id).eq("org_id", job.org_id).single();
    if (!asset?.storage_path || !analysisAllowed(asset.kind, asset.mime_type, asset.rights_records?.state ?? "unknown", asset.byte_size ?? 0, z.enum(AI_TASKS).parse(job.task))) throw new Error("Original not eligible for AI processing.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: control } = await supabaseAdmin.from("ai_controls").select("*").eq("org_id", job.org_id).maybeSingle();
    if (control?.paused) return { status: "paused", error: control.reason };
    const { data: claimed } = await supabaseAdmin.from("ai_jobs").update({ status: "running", attempts: job.attempts + 1, retry_at: null }).eq("id", job.id).eq("status", job.status).eq("attempts", job.attempts).select("id").maybeSingle();
    if (!claimed) return { status: "running", error: null };
    try {
      const { data: blob, error } = await context.supabase.storage.from("originals").download(asset.storage_path);
      if (!blob || error) throw new Error("Could not read original.");
      const bytes = new Uint8Array(await blob.arrayBuffer());
      if (bytes.length !== asset.byte_size || await sha256Hex(bytes) !== asset.sha256) throw new Error("Original fingerprint mismatch.");
      const key = process.env["LOVABLE_API_KEY"];
      if (!key) throw new Error("AI connection is not configured.");
      const { lovableProvider } = await import("@/providers/lovable.server");
      const result = await lovableProvider(key).analyze({ bytes, mime: asset.mime_type ?? "", task: z.enum(AI_TASKS).parse(job.task), signal: getRequest().signal });
      const { error: saveError } = await supabaseAdmin.rpc("complete_ai_job", { _job: job.id, _output: result.output, _model: result.model, _version: result.version ?? "", _confidence: result.output.confidence ?? -1, _latency: result.latency, _run: result.runId ?? "" });
      if (saveError) throw new Error("AI completed but its result could not be saved. Do not rerun this job.");
      return { status: "succeeded", error: null };
    } catch (e) {
      const failure = e as { status?: number; message?: string };
      const status = failure.status ?? 422;
      const message = failure.message ?? "Analysis failed. Original preserved.";
      const delay = retryDelay(status, job.attempts + 1);
      const paused = status === 402 || status === 403 || status === 401;
      await supabaseAdmin.from("ai_jobs").update({ status: paused ? "paused" : "failed", error: message, error_status: status, retry_at: delay ? new Date(Date.now() + delay * 1000).toISOString() : null, finished_at: new Date().toISOString() }).eq("id", job.id);
      if (paused) await supabaseAdmin.from("ai_controls").upsert({ org_id: job.org_id, paused: true, reason: message });
      return { status: paused ? "paused" : "failed", error: message };
    }
  });

export const reviewAnalysis = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; decision: typeof DECISIONS[number]; evidence: string }) => z.object({ id: z.string().uuid(), decision: z.enum(DECISIONS), evidence: z.string().trim().min(1).max(4000) }).parse(data))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("review_interpretation", { _id: data.id, _decision: data.decision, _evidence: data.evidence });
    if (error) throw new Error("Could not save review. Curator access and evidence are required.");
    return { ok: true };
  });

export const resumeAi = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((data: z.input<typeof orgSchema>) => orgSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: allowed } = await context.supabase.rpc("is_org_member", { _org: data.orgId, _min: "admin" });
    if (!allowed) throw new Error("Administrator access required.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("ai_controls").upsert({ org_id: data.orgId, paused: false, reason: null });
    await supabaseAdmin.from("ai_jobs").update({ status: "queued", error: null, retry_at: null }).eq("org_id", data.orgId).eq("status", "paused");
    return { ok: true };
  });