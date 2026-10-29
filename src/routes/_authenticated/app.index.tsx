import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getOverview } from "@/functions/overview.functions";
import { SECTIONS, CURRENT_PHASE } from "@/lib/sections";

const overviewQuery = queryOptions({ queryKey: ["overview"], queryFn: () => getOverview() });

export const Route = createFileRoute("/_authenticated/app/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery),
  head: () => ({ meta: [{ title: "Overview | EBiT Open Core" }, { name: "description", content: "Workspace counts and recent provenance in EBiT Open Core." }, { property: "og:title", content: "Overview | EBiT Open Core" }, { property: "og:description", content: "Workspace counts and recent provenance in EBiT Open Core." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: Overview,
  errorComponent: ({ error }) => (
    <p className="rounded-lg border border-destructive/50 p-4 text-sm text-destructive">Couldn't load the overview: {error instanceof Error ? error.message : "unknown error"}</p>
  ),
});

const LABELS: Record<string, string> = {
  objects: "Objects",
  assets: "Assets",
  observations: "Observations",
  datasets: "Datasets",
  relationships: "Relationships",
  provenance_events: "Provenance events",
};

function Overview() {
  const { data } = useSuspenseQuery(overviewQuery);
  const ws = data.workspaces[0];
  const empty = Object.values(data.counts).every((n) => n === 0);

  return (
    <div className="mx-auto max-w-5xl">
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{ws?.ebitId}</p>
      <h1 className="mt-1 text-3xl font-bold">{ws?.name ?? "Workspace"}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Your role: {ws?.role ?? "—"} · Build phase {CURRENT_PHASE} of 7</p>

      <section aria-label="Stored records" className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Object.entries(data.counts).map(([k, v]) => (
          <div key={k} className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{LABELS[k] ?? k}</p>
            <p className="mt-1 font-display text-3xl font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </section>

      {empty && (
        <div className="mt-6 rounded-xl border border-dashed border-border p-6">
          <h2 className="text-lg font-semibold">Nothing stored yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The foundation is ready: identities, assets, observations, relationships, rights and provenance. File upload arrives in Phase 2.
          </p>
          <Link to="/docs/$slug" params={{ slug: "data-model" }} className="mt-3 inline-block text-sm text-water underline underline-offset-4">See the data model</Link>
        </div>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recent provenance</h2>
        {data.recent.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No events recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-xl border border-border">
            {data.recent.map((e) => (
              <li key={e.id} className="flex justify-between gap-4 px-4 py-2.5 text-sm">
                <span>{e.event_type} · {e.entity_kind}</span>
                <span className="text-muted-foreground">{new Date(e.occurred_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Build progress</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.slug} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span>{s.label}</span>
              <span className={s.phase <= CURRENT_PHASE ? "text-leaf" : "text-muted-foreground"}>
                {s.phase <= CURRENT_PHASE ? "Live" : `Phase ${s.phase}`}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
