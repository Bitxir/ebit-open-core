import { createFileRoute } from "@tanstack/react-router";
import { AiWorkspace, loadAi } from "@/components/ai-workspace";
export const Route = createFileRoute("/_authenticated/app/processing")({
  loader: ({ context }) => loadAi(context.queryClient),
  head: () => ({ meta: [{ title: "AI Processing | EBiT Open Core" }, { name: "description", content: "Optional original-file analysis and durable AI jobs." }, { property: "og:title", content: "AI Processing | EBiT Open Core" }, { property: "og:description", content: "Optional original-file analysis and durable AI jobs." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <AiWorkspace/>,
});