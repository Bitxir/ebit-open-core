import { createFileRoute } from "@tanstack/react-router";
import { apiOptions, apiRead } from "@/lib/public-api";

export const Route = createFileRoute("/api/public/v1/datasets")({
  server: { handlers: { GET: ({ request }) => apiRead(request, "datasets"), OPTIONS: () => apiOptions() } },
});
