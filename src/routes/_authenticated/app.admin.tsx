import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { getAdminView } from "@/functions/explorer.functions";
import { workspacesQuery } from "@/components/entity";

export const Route = createFileRoute("/_authenticated/app/admin")({
  loader: ({ context }) => context.queryClient.ensureQueryData(workspacesQuery),
  head: () => ({ meta: [{ title: "Administration | EBiT Open Core" }, { name: "description", content: "Workspace members, roles and recorded actions." }, { property: "og:title", content: "Administration | EBiT Open Core" }, { property: "og:description", content: "Workspace members, roles and recorded actions." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: AdminPage,
  errorComponent: ({ error }) => <p role="alert" className="text-sm text-destructive">{error instanceof Error ? error.message : String(error)}</p>,
});

function AdminPage() {
  const { data: ws } = useSuspenseQuery(workspacesQuery);
  const w = ws[0];
  const res = useQuery({ queryKey: ["admin", w?.id], queryFn: () => getAdminView({ data: { orgId: w!.id } }), enabled: !!w });
  if (!w) return <p className="text-muted-foreground">You are not a member of any workspace.</p>;
  const who = (id: string | null) => (!id ? "system" : id === res.data?.me ? "You" : `member ${id.slice(0, 8)}`);
  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-3xl font-bold">Administration</h1>
      <p className="mt-1 text-sm text-muted-foreground">{w.name} · <span className="font-mono">{w.ebit_id}</span> · your role: {w.role}</p>
      <section className="mt-6 rounded-2xl border border-border p-4">
        <h2 className="text-sm font-semibold">Members</h2>
        <ul className="mt-2 divide-y divide-border text-sm">
          {res.data?.members.map((m) => <li key={m.user_id} className="flex justify-between py-2"><span>{who(m.user_id)}</span><span className="text-muted-foreground">{m.role}</span></li>)}
        </ul>
        <p className="mt-2 text-xs text-muted-foreground">Inviting members is not built yet.</p>
      </section>
      <section className="mt-6 rounded-2xl border border-border p-4">
        <h2 className="text-sm font-semibold">Audit log (latest 100, cannot be edited)</h2>
        {res.data && res.data.audit.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No actions recorded yet.</p> : (
          <ul className="mt-2 divide-y divide-border text-sm">
            {res.data?.audit.map((a) => (
              <li key={a.id} className="py-2"><span className="font-medium">{a.action.replace(/_/g, " ")}</span> <span className="text-muted-foreground">· {who(a.actor_id)} · {new Date(a.occurred_at).toLocaleString()}</span></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
