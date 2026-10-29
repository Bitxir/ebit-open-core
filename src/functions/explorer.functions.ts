import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { GRAPH_KINDS, REL_TYPE_IDS, checkLink, parseBBox, type GraphKind } from "@/core/graph";
import { RIGHTS_STATES, canTransition } from "@/core/rights";
import type { Json } from "@/integrations/supabase/types";

const PAGE_SIZE = 25;
const TABLE = { object: "objects", asset: "assets", observation: "observations", dataset: "datasets" } as const;
const LABEL_COLS = {
  object: "name, object_type",
  asset: "file_name, kind, ingestion_status",
  observation: "observation_type, value_text, value_numeric, unit, verification_status, observed_at",
  dataset: "title, published",
} as const;
const SEARCH_COLS = { object: ["name", "object_type", "ebit_id"], asset: ["file_name", "kind", "ebit_id", "source"], observation: ["observation_type", "value_text", "ebit_id"], dataset: ["title", "ebit_id"] } as const;
const STATUS_COL = { asset: "ingestion_status", observation: "verification_status" } as const;
const HAS_GEO = { object: true, asset: true, observation: true, dataset: false } as const;

export type EntitySummary = {
  kind: GraphKind; id: string; ebit_id: string; label: string; subtitle: string | null; status: string | null;
  rights: string | null; latitude: number | null; longitude: number | null; created_at: string;
};

type Row = Record<string, unknown> & { id: string; ebit_id: string; created_at: string; rights_records?: { state: string } | null };

function summarize(kind: GraphKind, r: Row): EntitySummary {
  const s = (k: string) => (r[k] == null ? null : String(r[k]));
  const n = (k: string) => (typeof r[k] === "number" ? (r[k] as number) : null);
  let label = "", subtitle: string | null = null, status: string | null = null;
  if (kind === "object") { label = s("name") ?? ""; subtitle = s("object_type"); }
  if (kind === "asset") { label = s("file_name") ?? r.ebit_id; subtitle = s("kind"); status = s("ingestion_status"); }
  if (kind === "observation") {
    const v = r["value_numeric"] != null ? `${s("value_numeric")}${r["unit"] ? " " + s("unit") : ""}` : s("value_text");
    label = s("observation_type") ?? ""; subtitle = v; status = s("verification_status");
  }
  if (kind === "dataset") { label = s("title") ?? ""; status = r["published"] ? "published" : "draft"; }
  return { kind, id: r.id, ebit_id: r.ebit_id, label, subtitle, status, rights: r.rights_records?.state ?? null, latitude: n("latitude"), longitude: n("longitude"), created_at: r.created_at };
}

const kindSchema = z.enum(GRAPH_KINDS);
const searchSchema = z.object({
  orgId: z.string().uuid(),
  kind: kindSchema,
  q: z.string().max(200).optional(),
  rights: z.enum(RIGHTS_STATES).optional(),
  status: z.string().max(40).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  bbox: z.string().max(100).optional(),
  page: z.number().int().min(0).max(1000).default(0),
});
export type SearchInput = z.input<typeof searchSchema>;

export const searchEntities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SearchInput) => searchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { kind } = data;
    const geo = HAS_GEO[kind] ? ", latitude, longitude" : "";
    const rightsJoin = data.rights ? "rights_records!inner(state)" : "rights_records(state)";
    let q = context.supabase
      .from(TABLE[kind])
      .select(`id, ebit_id, created_at, ${LABEL_COLS[kind]}${geo}, ${rightsJoin}`, { count: "exact" })
      .eq("org_id", data.orgId);
    const term = data.q?.replace(/[%,()*\\]/g, " ").trim();
    if (term) q = q.or(SEARCH_COLS[kind].map((c) => `${c}.ilike.%${term}%`).join(","));
    if (data.rights) q = q.eq("rights_records.state", data.rights);
    if (data.status && (kind === "asset" || kind === "observation")) q = q.eq(STATUS_COL[kind] as "id", data.status);
    if (data.status && kind === "dataset") q = q.eq("published" as "id", String(data.status === "published"));
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lt("created_at", new Date(new Date(data.to).getTime() + 86400000).toISOString());
    if (data.bbox) {
      const b = parseBBox(data.bbox);
      if (!b) throw new Error("Area must be minLng,minLat,maxLng,maxLat");
      if (!HAS_GEO[kind]) return { rows: [] as EntitySummary[], total: 0, pageSize: PAGE_SIZE };
      q = q.gte("latitude", b.minLat).lte("latitude", b.maxLat).gte("longitude", b.minLng).lte("longitude", b.maxLng);
    }
    const { data: rows, error, count } = await q
      .order("created_at", { ascending: false })
      .range(data.page * PAGE_SIZE, data.page * PAGE_SIZE + PAGE_SIZE - 1);
    if (error) { console.error("searchEntities", error); throw new Error("Search failed"); }
    return { rows: ((rows ?? []) as unknown as Row[]).map((r) => summarize(kind, r)), total: count ?? 0, pageSize: PAGE_SIZE };
  });

const refSchema = z.object({ kind: kindSchema, id: z.string().uuid() });

async function loadSummaries(supabase: import("@supabase/supabase-js").SupabaseClient, refs: { kind: GraphKind; id: string }[]) {
  const out = new Map<string, EntitySummary>();
  for (const kind of GRAPH_KINDS) {
    const ids = [...new Set(refs.filter((r) => r.kind === kind).map((r) => r.id))];
    if (!ids.length) continue;
    const geo = HAS_GEO[kind] ? ", latitude, longitude" : "";
    const { data } = await supabase.from(TABLE[kind]).select(`id, ebit_id, created_at, ${LABEL_COLS[kind]}${geo}, rights_records(state)`).in("id", ids);
    for (const r of (data ?? []) as unknown as Row[]) out.set(`${kind}:${r.id}`, summarize(kind, r));
  }
  return out;
}

export const getEntity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof refSchema>) => refSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: row, error } = await sb.from(TABLE[data.kind]).select("*, rights_records(*)").eq("id", data.id).maybeSingle();
    if (error) { console.error("getEntity", error); throw new Error("Could not load item"); }
    if (!row) return null;
    const r = row as unknown as Row & { org_id: string; metadata: unknown; original_metadata?: unknown; rights_records: Record<string, unknown> | null };

    const [outRel, inRel, prov, versions, items] = await Promise.all([
      sb.from("relationships").select("id, rel_type, to_kind, to_id, created_at").eq("from_kind", data.kind).eq("from_id", data.id),
      sb.from("relationships").select("id, rel_type, from_kind, from_id, created_at").eq("to_kind", data.kind).eq("to_id", data.id),
      sb.from("provenance_events").select("id, event_type, agent, software, software_version, details, occurred_at").eq("entity_kind", data.kind).eq("entity_id", data.id).order("occurred_at"),
      data.kind === "asset" ? sb.from("asset_versions").select("version, is_original, derivation, sha256, created_at").eq("asset_id", data.id).order("version") : Promise.resolve({ data: [] }),
      data.kind === "dataset" ? sb.from("dataset_items").select("entity_kind, entity_id, added_at").eq("dataset_id", data.id) : Promise.resolve({ data: [] }),
    ]);
    const memberOf = await sb.from("dataset_items").select("dataset_id").eq("entity_kind", data.kind).eq("entity_id", data.id);

    type RelRow = { id: string; rel_type: string; created_at: string };
    const outs = (outRel.data ?? []) as (RelRow & { to_kind: GraphKind; to_id: string })[];
    const ins = (inRel.data ?? []) as (RelRow & { from_kind: GraphKind; from_id: string })[];
    const itemRows = (items.data ?? []) as { entity_kind: GraphKind; entity_id: string; added_at: string }[];
    const memberRows = (memberOf.data ?? []) as { dataset_id: string }[];
    const sums = await loadSummaries(sb, [
      ...outs.map((o) => ({ kind: o.to_kind, id: o.to_id })),
      ...ins.map((i) => ({ kind: i.from_kind, id: i.from_id })),
      ...itemRows.filter((i) => (GRAPH_KINDS as readonly string[]).includes(i.entity_kind)).map((i) => ({ kind: i.entity_kind, id: i.entity_id })),
      ...memberRows.map((m) => ({ kind: "dataset" as const, id: m.dataset_id })),
    ]);
    const { rights_records: rights, ...fields } = r;
    return {
      kind: data.kind,
      summary: summarize(data.kind, r),
      fields: JSON.parse(JSON.stringify(fields)) as Record<string, Json>,
      rights: rights ? (JSON.parse(JSON.stringify(rights)) as Record<string, Json>) : null,
      links: [
        ...outs.map((o) => ({ id: o.id, direction: "out" as const, rel_type: o.rel_type, other: sums.get(`${o.to_kind}:${o.to_id}`) ?? null })),
        ...ins.map((i) => ({ id: i.id, direction: "in" as const, rel_type: i.rel_type, other: sums.get(`${i.from_kind}:${i.from_id}`) ?? null })),
      ],
      provenance: JSON.parse(JSON.stringify(prov.data ?? [])) as { id: string; event_type: string; agent: string; software: string | null; software_version: string | null; details: Json; occurred_at: string }[],
      versions: (versions.data ?? []) as { version: number; is_original: boolean; derivation: string | null; sha256: string | null; created_at: string }[],
      datasetItems: itemRows.map((i) => sums.get(`${i.entity_kind}:${i.entity_id}`)).filter((x): x is EntitySummary => !!x),
      inDatasets: memberRows.map((m) => sums.get(`dataset:${m.dataset_id}`)).filter((x): x is EntitySummary => !!x),
    };
  });

const optNum = (min: number, max: number) => z.number().min(min).max(max).nullable().optional();
const createSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("object"), orgId: z.string().uuid(), name: z.string().trim().min(1).max(300), objectType: z.string().trim().min(1).max(80), description: z.string().max(5000).nullable().optional(), latitude: optNum(-90, 90), longitude: optNum(-180, 180) }),
  z.object({ kind: z.literal("observation"), orgId: z.string().uuid(), observationType: z.string().trim().min(1).max(80), observedAt: z.string().datetime({ offset: true }).nullable().optional(), valueText: z.string().max(2000).nullable().optional(), valueNumeric: z.number().finite().nullable().optional(), unit: z.string().max(40).nullable().optional(), latitude: optNum(-90, 90), longitude: optNum(-180, 180) }),
  z.object({ kind: z.literal("dataset"), orgId: z.string().uuid(), title: z.string().trim().min(1).max(300), description: z.string().max(5000).nullable().optional() }),
]);

export const createEntity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof createSchema>) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    if (data.kind !== "dataset" && (data.latitude == null) !== (data.longitude == null)) throw new Error("Give both latitude and longitude, or neither.");
    const { data: rights, error: rErr } = await sb.from("rights_records").insert({ org_id: data.orgId, state: "unknown", created_by: userId }).select("id").single();
    if (rErr || !rights) throw new Error("You need contributor access to add items.");
    let res;
    if (data.kind === "object") {
      res = await sb.from("objects").insert({ org_id: data.orgId, name: data.name, object_type: data.objectType, description: data.description || null, latitude: data.latitude ?? null, longitude: data.longitude ?? null, rights_id: rights.id, created_by: userId }).select("id, ebit_id").single();
    } else if (data.kind === "observation") {
      res = await sb.from("observations").insert({ org_id: data.orgId, observation_type: data.observationType, observed_at: data.observedAt ?? null, value_text: data.valueText || null, value_numeric: data.valueNumeric ?? null, unit: data.unit || null, latitude: data.latitude ?? null, longitude: data.longitude ?? null, source: "manual", rights_id: rights.id, created_by: userId }).select("id, ebit_id").single();
    } else {
      res = await sb.from("datasets").insert({ org_id: data.orgId, title: data.title, description: data.description || null, rights_id: rights.id, created_by: userId }).select("id, ebit_id").single();
    }
    if (res.error || !res.data) { console.error("createEntity", res.error); throw new Error("Could not create item"); }
    await sb.from("provenance_events").insert({ org_id: data.orgId, entity_kind: data.kind, entity_id: res.data.id, event_type: "created", agent: "human", actor_id: userId, details: { source: "manual_entry" } });
    await sb.from("audit_log").insert({ org_id: data.orgId, actor_id: userId, action: `create_${data.kind}`, target_table: TABLE[data.kind], target_id: res.data.id });
    return res.data;
  });

const linkSchema = z.object({ from: refSchema, relType: z.enum(REL_TYPE_IDS as [string, ...string[]]), to: refSchema });

export const linkEntities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof linkSchema>) => linkSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    const check = checkLink(data.from.kind, data.from.id, data.relType as never, data.to.kind, data.to.id);
    if (!check.ok) return { ok: false as const, reason: check.reason };
    const [a, b] = await Promise.all([
      sb.from(TABLE[data.from.kind]).select("org_id").eq("id", data.from.id).maybeSingle(),
      sb.from(TABLE[data.to.kind]).select("org_id").eq("id", data.to.id).maybeSingle(),
    ]);
    if (!a.data || !b.data) return { ok: false as const, reason: "Item not found." };
    if (a.data.org_id !== b.data.org_id) return { ok: false as const, reason: "Items must be in the same workspace." };
    const { data: rel, error } = await sb.from("relationships").insert({ org_id: a.data.org_id, from_kind: data.from.kind, from_id: data.from.id, rel_type: data.relType, to_kind: data.to.kind, to_id: data.to.id, created_by: userId }).select("id").single();
    if (error) return { ok: false as const, reason: error.code === "23505" ? "These items are already linked that way." : "You need contributor access to link items." };
    await sb.from("provenance_events").insert({ org_id: a.data.org_id, entity_kind: data.from.kind, entity_id: data.from.id, event_type: "linked", agent: "human", actor_id: userId, details: { rel_type: data.relType, to_kind: data.to.kind, to_id: data.to.id } });
    await sb.from("audit_log").insert({ org_id: a.data.org_id, actor_id: userId, action: "link", target_table: "relationships", target_id: rel.id });
    return { ok: true as const };
  });

export const unlinkEntities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { relationshipId: string }) => z.object({ relationshipId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    const { data: rel } = await sb.from("relationships").select("*").eq("id", data.relationshipId).maybeSingle();
    if (!rel) return { ok: false as const, reason: "Link not found." };
    const { data: deleted } = await sb.from("relationships").delete().eq("id", data.relationshipId).select("id");
    if (!deleted?.length) return { ok: false as const, reason: "Only curators and admins can remove links." };
    await sb.from("provenance_events").insert({ org_id: rel.org_id, entity_kind: rel.from_kind, entity_id: rel.from_id, event_type: "unlinked", agent: "human", actor_id: userId, details: { rel_type: rel.rel_type, to_kind: rel.to_kind, to_id: rel.to_id } });
    await sb.from("audit_log").insert({ org_id: rel.org_id, actor_id: userId, action: "unlink", target_table: "relationships", target_id: rel.id, details: { rel_type: rel.rel_type } });
    return { ok: true as const };
  });

const itemSchema = z.object({ datasetId: z.string().uuid(), item: refSchema });
export const addToDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof itemSchema>) => itemSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    if (data.item.kind === "dataset") return { ok: false as const, reason: "Datasets cannot contain datasets." };
    const [ds, it] = await Promise.all([
      sb.from("datasets").select("org_id").eq("id", data.datasetId).maybeSingle(),
      sb.from(TABLE[data.item.kind]).select("org_id").eq("id", data.item.id).maybeSingle(),
    ]);
    if (!ds.data || !it.data || ds.data.org_id !== it.data.org_id) return { ok: false as const, reason: "Item and dataset must be in the same workspace." };
    const { error } = await sb.from("dataset_items").insert({ dataset_id: data.datasetId, org_id: ds.data.org_id, entity_kind: data.item.kind, entity_id: data.item.id });
    if (error) return { ok: false as const, reason: error.code === "23505" ? "Already in this dataset." : "You need contributor access." };
    await sb.from("audit_log").insert({ org_id: ds.data.org_id, actor_id: userId, action: "dataset_add_item", target_table: "datasets", target_id: data.datasetId, details: { kind: data.item.kind, id: data.item.id } });
    return { ok: true as const };
  });

export const setDatasetPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { datasetId: string; published: boolean }) => z.object({ datasetId: z.string().uuid(), published: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    const { data: ds, error } = await sb.from("datasets").update({ published: data.published }).eq("id", data.datasetId).select("org_id").maybeSingle();
    if (error) return { ok: false as const, reason: /redistribution/.test(error.message) ? "Can't publish: the dataset's rights must permit redistribution." : "Could not update dataset." };
    if (!ds) return { ok: false as const, reason: "You need contributor access." };
    await sb.from("audit_log").insert({ org_id: ds.org_id, actor_id: userId, action: data.published ? "dataset_publish" : "dataset_unpublish", target_table: "datasets", target_id: data.datasetId });
    return { ok: true as const };
  });

export const getAdminView = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => z.object({ orgId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const [members, audit] = await Promise.all([
      sb.from("organization_members").select("user_id, role, created_at").eq("org_id", data.orgId).order("created_at"),
      sb.from("audit_log").select("id, actor_id, action, target_table, target_id, occurred_at").eq("org_id", data.orgId).order("occurred_at", { ascending: false }).limit(100),
    ]);
    if (members.error) throw new Error("Could not load members");
    return { me: context.userId, members: members.data ?? [], audit: audit.data ?? [] };
  });

const rightsSchema = z.object({
  rightsId: z.string().uuid(), state: z.enum(RIGHTS_STATES),
  license: z.string().max(200).nullable(), attribution: z.string().max(500).nullable(), source: z.string().max(500).nullable(),
});
export const updateRights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.input<typeof rightsSchema>) => rightsSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase: sb, userId } = context;
    const { data: cur } = await sb.from("rights_records").select("state, org_id").eq("id", data.rightsId).maybeSingle();
    if (!cur) return { ok: false as const, reason: "Rights record not found." };
    if (cur.state !== data.state && !canTransition(cur.state, data.state))
      return { ok: false as const, reason: `Rights can't move from "${cur.state}" straight to "${data.state}". Mark it under review first.` };
    const { data: upd } = await sb.from("rights_records").update({ state: data.state, license: data.license, attribution: data.attribution, source: data.source, reviewed_by: userId, reviewed_at: new Date().toISOString() }).eq("id", data.rightsId).select("id");
    if (!upd?.length) return { ok: false as const, reason: "You need contributor access." };
    await sb.from("audit_log").insert({ org_id: cur.org_id, actor_id: userId, action: "rights_update", target_table: "rights_records", target_id: data.rightsId, details: { from: cur.state, to: data.state } });
    return { ok: true as const };
  });
