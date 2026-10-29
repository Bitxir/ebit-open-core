import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BookOpen, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { EbitBrand } from "@/components/brand";
import { SECTIONS, CURRENT_PHASE } from "@/lib/sections";
import { useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({
    meta: [
      { title: "Workspace | EBiT Open Core" },
      { name: "description", content: "Your EBiT Open Core workspace." },
      { property: "og:title", content: "Workspace | EBiT Open Core" },
      { property: "og:description", content: "Your EBiT Open Core workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AppLayout,
});

function NavItem({ slug, label, icon: Icon, phase }: (typeof SECTIONS)[number]) {
  const live = phase <= CURRENT_PHASE;
  const linkClass = "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground";
  const active = { className: "bg-sidebar-accent text-foreground font-medium" };
  const inner = (
    <>
      <Icon className="h-4 w-4" aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
      {!live && <span className="ml-auto hidden font-mono text-[10px] text-muted-foreground/70 md:inline">P{phase}</span>}
    </>
  );
  return slug === "overview" ? (
    <Link to="/app" activeOptions={{ exact: true }} className={linkClass} activeProps={active}>{inner}</Link>
  ) : (
    <Link to="/app/$section" params={{ section: slug }} className={linkClass} activeProps={active}>{inner}</Link>
  );
}

function AppLayout() {
  const { user } = useSession();
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-sidebar-border bg-sidebar md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:border-b-0 md:border-r">
        <div className="flex items-center justify-between px-4 py-4">
          <EbitBrand />
        </div>
        <nav aria-label="Workspace sections" className={cn("flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-y-auto")}>
          {SECTIONS.map((s) => <NavItem key={s.slug} {...s} />)}
        </nav>
        <div className="hidden border-t border-sidebar-border p-3 md:block">
          <Link to="/docs" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
            <BookOpen className="h-4 w-4" /> Documentation
          </Link>
          <button
            onClick={() => supabase.auth.signOut().then(() => window.location.assign("/"))}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
          <p className="truncate px-3 pt-2 text-xs text-muted-foreground">{user?.email}</p>
        </div>
      </aside>
      <main className="flex-1 px-4 py-6 md:px-10 md:py-10">
        <Outlet />
      </main>
    </div>
  );
}
