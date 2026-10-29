import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { occurrenceSchema, parseOccurrences, exportOccurrences, type OccurrenceInput } from "@/modules/biodiversity/darwin-core";
import { sha256Hex } from "@/core/ingest";
import type { Json } from "@/integrations/supabase/types";

const orgSchema = z.object({ orgId: z.string().uuid() });
export const getBiodiversity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; page?: number; q?: string; from?: string; to?: string; sensitive?: boolean }) => orgSchema.extend({ page: z.number().int().min(0).default(0), q: z.string().max(200).optional(), from: z.string().date().optional(), to: z.string().date().optional(), sensitive: z.boolean().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let query = context.supabase.from("biodiversity_observations").select("*, taxa!inner(scientific_name, family, kingdom, genus, taxon_rank), observations!inner(ebit_id, verification_status, rights_id, rights_records(state))", { count: "exact" }).eq("org_id", data.orgId);
    const term = data.q?.replace(/[%,()*\\]/g, " ").trim();
    if (term) query = query.ilike("taxa.scientific_name", `%${term}%`);
    if (data.from) query = query.gte("event_date", data.from);
    if (data.to) query = query.lte("event_date", `${data.to}T23:59:59.999Z`);
    if (data.sensitive !== undefined) query = query.eq("sensitive", data.sensitive);
    const { data: rows, error, count } = await query.order("created_at", { ascending: false }).range(data.page * 25, data.page * 25 + 24);
    if (error) { console.error("biodiversity list", error); throw new Error("Could not load species records"); }
    return { rows: rows ?? [], total: count ?? 0 };
  });
export type BiodiversityRow = Awaited<ReturnType<typeof getBiodiversity>>["rows"][number];

export const getBiodiversitySources = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => orgSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("assets").select("id, ebit_id, file_name").eq("org_id", data.orgId).eq("adapter", "darwin-core").eq("ingestion_status", "ready").order("created_at", { ascending: false }).limit(100);
    if (error) throw new Error("Could not load source files");
    return rows ?? [];
  });

export const createOccurrence = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; occurrence: OccurrenceInput }) => z.object({ orgId: z.string().uuid(), occurrence: occurrenceSchema }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc("import_biodiversity", { _org: data.orgId, _rows: [data.occurrence] as unknown as Json });
    if (error) { console.error("create occurrence", error); throw new Error("Could not save occurrence. Contributor access is required."); }
    return result;
  });

export const importOccurrences = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; assetId: string; allSensitive: boolean }) => orgSchema.extend({ assetId: z.string().uuid(), allSensitive: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: asset } = await context.supabase.from("assets").select("storage_path, sha256, byte_size").eq("id", data.assetId).eq("org_id", data.orgId).eq("adapter", "darwin-core").eq("ingestion_status", "ready").maybeSingle();
    if (!asset?.storage_path) throw new Error("A processed Darwin Core file and curator access are required.");
    const { data: blob, error: downloadError } = await context.supabase.storage.from("originals").download(asset.storage_path);
    if (downloadError || !blob) throw new Error("Could not read original file");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (bytes.length !== asset.byte_size || await sha256Hex(bytes) !== asset.sha256) throw new Error("Original file fingerprint mismatch");
    const rows = parseOccurrences(new TextDecoder().decode(bytes)).map((r) => ({ ...r, sensitive: data.allSensitive || r.sensitive }));
    const { data: result, error } = await context.supabase.rpc("import_biodiversity", { _org: data.orgId, _asset: data.assetId, _rows: rows as unknown as Json });
    if (error) { console.error("import occurrences", error); throw new Error("Import failed. No occurrences from this import were saved."); }
    return result;
  });

export const getOccurrenceDetails = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase.from("biodiversity_details").select("*").eq("id", data.id).maybeSingle();
    if (error) throw new Error("Could not load protected details");
    return row;
  });

export const exportBiodiversity = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => orgSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc("export_biodiversity", { _org: data.orgId });
    if (error) throw new Error("Export blocked: every occurrence and its original file must permit redistribution.");
    return { csv: exportOccurrences((rows ?? []) as Record<string, unknown>[]) };
  });