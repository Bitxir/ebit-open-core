import { createFileRoute } from "@tanstack/react-router";
import { AiWorkspace, loadAi } from "@/components/ai-workspace";
export const Route = createFileRoute("/_authenticated/app/verification")({
  loader: ({ context }) => loadAi(context.queryClient),
  head: () => ({ meta: [{ title: "Human Verification | EBiT Open Core" }, { name: "description", content: "Evidence-backed curator review of unverified AI interpretations." }, { property: "og:title", content: "Human Verification | EBiT Open Core" }, { property: "og:description", content: "Evidence-backed curator review of unverified AI interpretations." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: () => <AiWorkspace reviewOnly/>,
});