import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const COUNTED = ["objects", "assets", "observations", "datasets", "relationships", "provenance_events"] as const;

/** Real counts from the caller's organisations (RLS-scoped). No placeholder numbers. */
export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: memberships, error } = await supabase
      .from("organization_members")
      .select("role, organizations(id, ebit_id, name)")
      .eq("user_id", userId);
    if (error) throw new Error("Could not load your workspaces");

    const counts: Record<string, number> = {};
    await Promise.all(
      COUNTED.map(async (table) => {
        const { count } = await supabase.from(table).select("*", { count: "exact", head: true });
        counts[table] = count ?? 0;
      }),
    );

    const { data: recent } = await supabase
      .from("provenance_events")
      .select("id, event_type, entity_kind, agent, occurred_at")
      .order("occurred_at", { ascending: false })
      .limit(10);

    return {
      workspaces: (memberships ?? []).map((m) => ({
        role: m.role,
        id: m.organizations?.id ?? "",
        ebitId: m.organizations?.ebit_id ?? "",
        name: m.organizations?.name ?? "",
      })),
      counts,
      recent: recent ?? [],
    };
  });
