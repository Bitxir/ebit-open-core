import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { findAdapter, acceptedExtensions } from "@/adapters/registry";
import { MAX_UPLOAD_BYTES, extensionOf, safeFileName, sha256Hex, toJsonSafe } from "@/core/ingest";
import { RIGHTS_STATES } from "@/core/rights";
import type { Json } from "@/integrations/supabase/types";

const BUCKET = "originals";

export const listWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("organization_members")
      .select("role, organizations(id, ebit_id, name)")
      .eq("user_id", context.userId);
    if (error) throw new Error("Could not load your workspaces");
    return (data ?? []).flatMap((m) => (m.organizations ? [{ ...m.organizations, role: m.role }] : []));
  });

const prepareSchema = z.object({
  orgId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().max(150).nullable(),
  byteSize: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  rights: z.object({
    state: z.enum(RIGHTS_STATES),
    license: z.string().max(200).nullable(),
    attribution: z.string().max(500).nullable(),
    source: z.string().max(500).nullable(),
  }),
});

/** Step 1: register an upload. Detects duplicates before any bytes are stored. */
export const prepareIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof prepareSchema>) => prepareSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if ([".csv", ".tsv"].includes(extensionOf(data.fileName))) {
      const { data: allowed } = await supabase.rpc("is_org_member", { _org: data.orgId, _min: "curator" });
      if (!allowed) return { status: "rejected" as const, reason: "CSV and TSV originals require curator or admin access because they may contain sensitive locations." };
    }
    if (!acceptedExtensions().includes(extensionOf(data.fileName))) {
      return { status: "rejected" as const, reason: `Files of type "${extensionOf(data.fileName) || "unknown"}" are not supported yet.` };
    }

    const { data: existing } = await supabase
      .from("assets")
      .select("id, ebit_id, file_name, created_at, ingestion_status, storage_path, processing_jobs(id, attempts, max_attempts)")
      .eq("org_id", data.orgId)
      .eq("sha256", data.sha256)
      .maybeSingle();
    if (existing) {
      // An earlier attempt never finished: resume it instead of blocking the same file forever.
      const job = existing.processing_jobs[0];
      if (existing.ingestion_status !== "ready" && existing.storage_path && job && job.attempts < job.max_attempts) {
        return { status: "resume" as const, assetId: existing.id, ebitId: existing.ebit_id, storagePath: existing.storage_path, jobId: job.id };
      }
      const { processing_jobs: _j, storage_path: _p, ...asset } = existing;
      return { status: "duplicate" as const, asset };
    }

    const { data: rights, error: rErr } = await supabase
      .from("rights_records")
      .insert({ org_id: data.orgId, state: data.rights.state, license: data.rights.license, attribution: data.rights.attribution, source: data.rights.source, created_by: userId })
      .select("id")
      .single();
    if (rErr) return { status: "rejected" as const, reason: "You need contributor access to this workspace to upload." };

    const assetId = crypto.randomUUID();
    const storagePath = `${data.orgId}/${assetId}/${safeFileName(data.fileName)}`;
    const { data: asset, error: aErr } = await supabase
      .from("assets")
      .insert({
        id: assetId,
        org_id: data.orgId,
        kind: "pending",
        mime_type: data.mimeType,
        file_name: data.fileName,
        byte_size: data.byteSize,
        sha256: data.sha256,
        storage_path: storagePath,
        source: data.rights.source,
        ingestion_status: "awaiting_upload",
        rights_id: rights.id,
        created_by: userId,
      })
      .select("id, ebit_id")
      .single();
    if (aErr) {
      if (aErr.code === "23505") {
        const { data: dup } = await supabase.from("assets").select("id, ebit_id, file_name, created_at").eq("org_id", data.orgId).eq("sha256", data.sha256).single();
        if (dup) return { status: "duplicate" as const, asset: dup };
        return { status: "rejected" as const, reason: "Could not read the existing file." };
      }
      console.error("prepareIngest asset insert", aErr);
      return { status: "rejected" as const, reason: "Could not register this file." };
    }

    const { data: job, error: jErr } = await supabase
      .from("processing_jobs")
      .insert({ org_id: data.orgId, asset_id: asset.id, job_type: "ingest", idempotency_key: `ingest:${data.sha256}`, created_by: userId })
      .select("id")
      .single();
    if (jErr) {
      console.error("prepareIngest job insert", jErr);
      return { status: "rejected" as const, reason: "Could not queue this file." };
    }

    await supabase.from("provenance_events").insert({
      org_id: data.orgId,
      entity_kind: "asset",
      entity_id: asset.id,
      event_type: "registered",
      agent: "user",
      actor_id: userId,
      details: { file_name: data.fileName, sha256: data.sha256, byte_size: data.byteSize, rights_state: data.rights.state },
    });

    return { status: "ready" as const, assetId: asset.id, ebitId: asset.ebit_id, storagePath, jobId: job.id };
  });

/** Step 3: process the uploaded original. Safe to call again (retries); never alters the stored original. */
export const processIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { jobId: string }) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await supabase.from("processing_jobs").select("*").eq("id", data.jobId).maybeSingle();
    if (!job || !job.asset_id) return { status: "failed" as const, error: "Job not found." };
    if (job.status === "succeeded") return { status: "succeeded" as const, error: null };
    if (job.attempts >= job.max_attempts) return { status: "failed" as const, error: job.error ?? "No attempts left." };

    const { data: asset } = await supabase.from("assets").select("*").eq("id", job.asset_id).single();
    if (!asset?.storage_path) return { status: "failed" as const, error: "Asset not found." };

    const attempt = job.attempts + 1;
    await supabase.from("processing_jobs").update({ status: "running", attempts: attempt, started_at: new Date().toISOString(), error: null }).eq("id", job.id);

    const fail = async (message: string) => {
      const final = attempt >= job.max_attempts;
      await supabase.from("processing_jobs").update({ status: "failed", error: message, finished_at: new Date().toISOString() }).eq("id", job.id);
      await supabase.from("assets").update({ ingestion_status: "failed" }).eq("id", asset.id);
      await supabase.from("provenance_events").insert({
        org_id: asset.org_id, entity_kind: "asset", entity_id: asset.id, event_type: "ingestion_failed", agent: "system",
        actor_id: userId, details: { error: message, attempt, final },
      });
      return { status: "failed" as const, error: message };
    };

    const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(asset.storage_path);
    if (dlErr || !blob) return fail("The uploaded file could not be found in storage. Upload it again.");
    const bytes = new Uint8Array(await blob.arrayBuffer());

    const actualHash = await sha256Hex(bytes);
    if (actualHash !== asset.sha256 || bytes.byteLength !== asset.byte_size) {
      return fail("The stored file does not match what was registered (size or fingerprint differs).");
    }

    const input = { fileName: asset.file_name ?? "", mimeType: asset.mime_type, bytes };
    const adapter = findAdapter(input);
    if (!adapter) return fail("No adapter supports this file.");
    const { id: adapterId, version } = adapter.descriptor;

    try {
      const validation = await adapter.validate(input);
      if (!validation.ok) return fail(validation.errors.join("; "));
      const meta = await adapter.extractMetadata(input);

      const { error: upErr } = await supabase
        .from("assets")
        .update({
          kind: adapterId,
          ingestion_status: "ready",
          adapter: adapterId,
          adapter_version: version,
          captured_at: meta.capturedAt,
          latitude: meta.latitude,
          longitude: meta.longitude,
          device: meta.device,
          metadata: toJsonSafe(meta.fields) as Json,
          original_metadata: toJsonSafe(meta.original) as Json,
        })
        .eq("id", asset.id);
      if (upErr) throw upErr;

      const { data: hasOriginal } = await supabase.from("asset_versions").select("id").eq("asset_id", asset.id).eq("is_original", true).maybeSingle();
      if (!hasOriginal) {
        await supabase.from("asset_versions").insert({
          asset_id: asset.id, org_id: asset.org_id, version: 1, is_original: true,
          storage_path: asset.storage_path, sha256: actualHash, created_by: userId,
        });
      }

      await supabase.from("provenance_events").insert([
        { org_id: asset.org_id, entity_kind: "asset", entity_id: asset.id, event_type: "ingested", agent: "system", actor_id: userId,
          details: { storage_path: asset.storage_path, sha256: actualHash, verified_hash: true } },
        { org_id: asset.org_id, entity_kind: "asset", entity_id: asset.id, event_type: "metadata_extracted", agent: `adapter:${adapterId}`,
          software: `adapter:${adapterId}`, software_version: version, actor_id: userId,
          details: { fields_found: Object.keys(meta.fields), has_time: meta.capturedAt !== null, has_location: meta.latitude !== null } },
      ]);

      await supabase.from("processing_jobs").update({
        status: "succeeded", adapter: adapterId, adapter_version: version, finished_at: new Date().toISOString(),
        result: { kind: adapterId } as Json,
      }).eq("id", job.id);
      return { status: "succeeded" as const, error: null };
    } catch (e) {
      console.error("processIngest", e);
      return fail("Processing failed unexpectedly. The original file is kept; you can retry.");
    }
  });

export const listIngestions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("assets")
      .select("id, ebit_id, file_name, kind, byte_size, ingestion_status, captured_at, latitude, longitude, device, created_at, processing_jobs(id, status, attempts, max_attempts, error)")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error("Could not load uploads");
    return rows ?? [];
  });
