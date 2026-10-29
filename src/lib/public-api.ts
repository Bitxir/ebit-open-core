import { apiErrorStatus, bearerApiKey, hashApiKey, parsePage } from "@/core/api-keys";
import type { Json } from "@/integrations/supabase/types";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization",
  "Cache-Control": "no-store",
};

export const apiOptions = () => new Response(null, { status: 204, headers: CORS });

/** Shared handler for read-only public API endpoints. All rights/rate checks happen in the `api_read` database function. */
export async function apiRead(request: Request, resource: "datasets" | "items", dataset?: string): Promise<Response> {
  const key = bearerApiKey(request.headers.get("Authorization"));
  if (!key) return Response.json({ error: "A valid API key is required: Authorization: Bearer ebit_api_..." }, { status: 401, headers: CORS });
  const page = parsePage(new URL(request.url).searchParams.get("page"));
  if (page === null) return Response.json({ error: "page must be a positive integer." }, { status: 400, headers: CORS });
  if (dataset !== undefined && !/^[A-Z]{3}-[A-Za-z0-9-]{1,64}$/.test(dataset)) return Response.json({ error: "Invalid dataset ID." }, { status: 400, headers: CORS });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("api_read", { _hash: await hashApiKey(key), _resource: resource, ...(dataset ? { _dataset: dataset } : {}), _page: page });
  if (error) {
    const e = apiErrorStatus(error.code);
    return Response.json({ error: e.error }, { status: e.status, headers: CORS });
  }
  return Response.json(data as Json, { status: 200, headers: CORS });
}
