import { Link } from "@tanstack/react-router";
import { queryOptions } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Box, FileText, Eye, Boxes, MapPin } from "lucide-react";
import { listWorkspaces } from "@/functions/ingest.functions";
import { createEntity, type EntitySummary } from "@/functions/explorer.functions";
import { RIGHTS_LABELS, type RightsState } from "@/core/rights";
import type { GraphKind } from "@/core/graph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export const workspacesQuery = queryOptions({ queryKey: ["workspaces"], queryFn: () => listWorkspaces() });

export const KIND_META: Record<GraphKind, { label: string; plural: string; icon: typeof Box }> = {
  object: { label: "Object", plural: "Objects", icon: Box },
  asset: { label: "File", plural: "Files", icon: FileText },
  observation: { label: "Observation", plural: "Observations", icon: Eye },
  dataset: { label: "Dataset", plural: "Datasets", icon: Boxes },
};

export const selectClass = "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export function RightsBadge({ state }: { state: string | null }) {
  const s = (state ?? "unknown") as RightsState;
  const tone = s === "permitted_redistribution" ? "border-primary/50 text-primary" : s === "restricted" ? "border-destructive/50 text-destructive" : "border-border text-muted-foreground";
  return <span className={cn("rounded-full border px-2 py-0.5 text-[11px]", tone)}>{RIGHTS_LABELS[s] ?? s}</span>;
}

export function EntityRow({ e, action }: { e: EntitySummary; action?: React.ReactNode }) {
  const Icon = KIND_META[e.kind].icon;
  return (
    <li className="flex items-center gap-3 border-b border-border px-3 py-3 last:border-0">
      <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
      <Link to="/app/item/$kind/$id" params={{ kind: e.kind, id: e.id }} className="min-w-0 flex-1 hover:underline">
        <p className="truncate text-sm font-medium">{e.label || e.ebit_id}</p>
        <p className="truncate text-xs text-muted-foreground">
          <span className="font-mono">{e.ebit_id}</span>
          {e.subtitle && <> · {e.subtitle}</>}
          {e.status && <> · {e.status}</>}
          {e.latitude != null && <> · <MapPin className="inline h-3 w-3" aria-label="has location" /></>}
        </p>
      </Link>
      <span className="hidden sm:inline"><RightsBadge state={e.rights} /></span>
      {action}
    </li>
  );
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));

/** Manual creation of objects, observations and datasets. Rights always start as "unknown". */
export function CreateEntityForm({ orgId, kinds, onCreated }: { orgId: string; kinds: ("object" | "observation" | "dataset")[]; onCreated: (r: { id: string; kind: GraphKind }) => void }) {
  const create = useServerFn(createEntity);
  const [kind, setKind] = useState<"object" | "observation" | "dataset">(kinds[0] ?? "object");
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const v = (k: string) => f[k] ?? "";
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const lat = num(v("lat")), lng = num(v("lng"));
    if ((lat == null) !== (lng == null)) { toast.error("Give both latitude and longitude, or neither."); return; }
    if ((lat != null && (Number.isNaN(lat) || lat < -90 || lat > 90)) || (lng != null && (Number.isNaN(lng) || lng < -180 || lng > 180))) { toast.error("Coordinates are out of range."); return; }
    setBusy(true);
    try {
      const payload =
        kind === "object" ? { kind: "object" as const, orgId, name: v("name"), objectType: v("type"), description: v("desc") || null, latitude: lat, longitude: lng }
        : kind === "observation" ? { kind: "observation" as const, orgId, observationType: v("type"), observedAt: v("at") ? new Date(v("at")).toISOString() : null, valueText: v("text") || null, valueNumeric: num(v("num")), unit: v("unit") || null, latitude: lat, longitude: lng }
        : { kind: "dataset" as const, orgId, title: v("name"), description: v("desc") || null };
      if (payload.kind === "observation" && payload.valueNumeric != null && Number.isNaN(payload.valueNumeric)) throw new Error("Value must be a number.");
      const r = await create({ data: payload });
      toast.success(`Created ${r.ebit_id}`);
      setF({});
      onCreated({ id: r.id, kind });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create");
    } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border p-4">
      <div className="flex gap-1">
        {kinds.map((k) => (
          <button type="button" key={k} onClick={() => setKind(k)} className={cn("rounded-md px-2.5 py-1 text-xs", k === kind ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent")}>
            New {KIND_META[k].label.toLowerCase()}
          </button>
        ))}
      </div>
      {kind !== "observation" && <div className="space-y-1.5"><Label htmlFor="c-name">{kind === "dataset" ? "Title" : "Name"}</Label><Input id="c-name" required maxLength={300} value={v("name")} onChange={set("name")} /></div>}
      {kind !== "dataset" && <div className="space-y-1.5"><Label htmlFor="c-type">Type</Label><Input id="c-type" required maxLength={80} placeholder={kind === "object" ? "e.g. tree, site, specimen" : "e.g. height, sighting, note"} value={v("type")} onChange={set("type")} /></div>}
      {kind === "observation" && (
        <>
          <div className="space-y-1.5"><Label htmlFor="c-at">Observed at</Label><Input id="c-at" type="datetime-local" value={v("at")} onChange={set("at")} /></div>
          <div className="grid grid-cols-[1fr_80px] gap-2">
            <div className="space-y-1.5"><Label htmlFor="c-num">Number</Label><Input id="c-num" inputMode="decimal" value={v("num")} onChange={set("num")} /></div>
            <div className="space-y-1.5"><Label htmlFor="c-unit">Unit</Label><Input id="c-unit" maxLength={40} value={v("unit")} onChange={set("unit")} /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="c-text">Text value or note</Label><Input id="c-text" maxLength={2000} value={v("text")} onChange={set("text")} /></div>
        </>
      )}
      {kind !== "observation" && <div className="space-y-1.5"><Label htmlFor="c-desc">Description</Label><textarea id="c-desc" maxLength={5000} rows={2} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={v("desc")} onChange={set("desc")} /></div>}
      {kind !== "dataset" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5"><Label htmlFor="c-lat">Latitude</Label><Input id="c-lat" inputMode="decimal" value={v("lat")} onChange={set("lat")} /></div>
          <div className="space-y-1.5"><Label htmlFor="c-lng">Longitude</Label><Input id="c-lng" inputMode="decimal" value={v("lng")} onChange={set("lng")} /></div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Rights start as “Unknown”. Change them on the item page.</p>
      <Button type="submit" disabled={busy} className="w-full">{busy ? "Creating…" : "Create"}</Button>
    </form>
  );
}
