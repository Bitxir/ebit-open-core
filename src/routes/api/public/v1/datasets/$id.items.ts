import { createFileRoute } from "@tanstack/react-router";
import { apiOptions, apiRead } from "@/lib/public-api";

export const Route = createFileRoute("/api/public/v1/datasets/$id/items")({
  server: { handlers: { GET: ({ request, params }) => apiRead(request, "items", params.id), OPTIONS: () => apiOptions() } },
});
