import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { SECTIONS } from "@/lib/sections";

export const Route = createFileRoute("/_authenticated/app/$section")({
  loader: ({ params }) => {
    const section = SECTIONS.find((s) => s.slug === params.section && s.slug !== "overview");
    if (!section) throw notFound();
    return { slug: section.slug };
  },
  component: SectionPlaceholder,
  head: ({ loaderData }) => {
    const s = SECTIONS.find((s) => s.slug === loaderData?.slug);
    const title = `${s?.label ?? "Section"} | EBiT Open Core`;
    const description = s?.summary ?? "EBiT Open Core planned workspace section.";
    return { meta: [{ title }, { name: "description", content: description }, { property: "og:title", content: title }, { property: "og:description", content: description }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] };
  },
});

function SectionPlaceholder() {
  const { slug } = Route.useLoaderData();
  const section = SECTIONS.find((s) => s.slug === slug);
  if (!section) return null;
  const Icon = section.icon;
  return (
    <div className="mx-auto max-w-2xl">
      <Icon className="h-8 w-8 text-primary" aria-hidden />
      <h1 className="mt-3 text-3xl font-bold">{section.label}</h1>
      <p className="mt-2 text-muted-foreground">{section.summary}</p>
      <div className="mt-6 rounded-xl border border-dashed border-border p-5 text-sm">
        <p className="font-medium">Not built yet — arrives in Phase {section.phase}.</p>
        <p className="mt-1 text-muted-foreground">No sample or placeholder data is shown here on purpose.</p>
      </div>
      <Link to="/docs/$slug" params={{ slug: "roadmap" }} className="mt-4 inline-block text-sm text-water underline underline-offset-4">View the roadmap</Link>
    </div>
  );
}
