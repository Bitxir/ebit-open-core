import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { workspacesQuery } from "@/components/entity";
import { issueApiKey, listApiKeys, revokeApiKey } from "@/functions/developer.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const META = "Create read-only API keys for published, redistributable datasets.";
export const Route = createFileRoute("/_authenticated/app/developer")({
  loader: ({ context }) => context.queryClient.ensureQueryData(workspacesQuery),
  head: () => ({ meta: [{ title: "Developer API | EBiT Open Core" }, { name: "description", content: META }, { property: "og:title", content: "Developer API | EBiT Open Core" }, { property: "og:description", content: META }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: DeveloperPage,
  errorComponent: ({ error }) => <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

function DeveloperPage() {
  const { data: ws } = useSuspenseQuery(workspacesQuery);
  const [orgId, setOrgId] = useState(ws[0]?.id ?? "");
  const w = ws.find((x) => x.id === orgId);
  const qc = useQueryClient();
  const keys = useQuery({ queryKey: ["api-keys", orgId], queryFn: () => listApiKeys({ data: { orgId } }), enabled: !!orgId && w?.role === "admin" });
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!w) return <p className="text-muted-foreground">You are not a member of any workspace.</p>;
  const base = typeof window === "undefined" ? "" : window.location.origin;

  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    try { const r = await issueApiKey({ data: { orgId, name } }); setCreated(r.key); setName(""); await qc.invalidateQueries({ queryKey: ["api-keys", orgId] }); }
    catch (x) { setErr(x instanceof Error ? x.message : "Failed."); } finally { setBusy(false); }
  }
  async function revoke(id: string) {
    if (!confirm("Revoke this key? Apps using it will stop working immediately.")) return;
    try { await revokeApiKey({ data: { id } }); await qc.invalidateQueries({ queryKey: ["api-keys", orgId] }); } catch (x) { setErr(x instanceof Error ? x.message : "Failed."); }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold">Developer API</h1>
      <p className="mt-1 text-sm text-muted-foreground">Read-only access to <strong>published datasets whose rights permit redistribution</strong>. Originals, exact sensitive locations and unreviewed AI output are never returned. <Link to="/docs/$slug" params={{ slug: "api" }} className="text-primary underline">API reference</Link></p>
      {ws.length > 1 && (
        <label className="mt-4 block text-sm">Workspace{" "}
          <select className="ml-2 rounded-md border border-input bg-background px-2 py-1" value={orgId} onChange={(e) => { setOrgId(e.target.value); setCreated(null); }}>
            {ws.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
        </label>
      )}
      {w.role !== "admin" ? <p className="mt-6 rounded-xl border border-border p-4 text-sm text-muted-foreground">Only workspace admins can manage API keys.</p> : (
        <>
          <form onSubmit={create} className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Input aria-label="Key name" placeholder="Key name, e.g. Research portal" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} />
            <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create key"}</Button>
          </form>
          {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
          {created && (
            <div className="mt-4 rounded-xl border border-primary/50 bg-primary/5 p-4">
              <p className="text-sm font-medium">Copy this key now — it will not be shown again.</p>
              <code className="mt-2 block break-all rounded bg-muted p-2 font-mono text-xs">{created}</code>
            </div>
          )}
          <ul className="mt-6 divide-y divide-border rounded-2xl border border-border">
            {!keys.data ? <li className="p-4 text-sm text-muted-foreground">Loading…</li>
              : keys.data.length === 0 ? <li className="p-6 text-center text-sm text-muted-foreground">No API keys yet.</li>
              : keys.data.map((k) => (
                <li key={k.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <p className="font-medium">{k.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{k.key_prefix}… · {k.rate_limit_per_minute}/min · {k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleString()}` : "never used"}</p>
                  </div>
                  {k.revoked_at ? <span className="text-xs text-muted-foreground">Revoked</span> : <Button variant="outline" size="sm" onClick={() => revoke(k.id)}>Revoke</Button>}
                </li>
              ))}
          </ul>
        </>
      )}
      <section className="mt-8 rounded-2xl border border-border p-4">
        <h2 className="font-semibold">Quick start</h2>
        <pre className="mt-2 overflow-x-auto rounded bg-muted p-3 font-mono text-xs">{`curl -H "Authorization: Bearer ebit_api_..." \\
  ${base}/api/public/v1/datasets

curl -H "Authorization: Bearer ebit_api_..." \\
  ${base}/api/public/v1/datasets/DST-XXXXXXXXXX/items?page=1`}</pre>
      </section>
    </div>
  );
}
