import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { apiKeyPrefix, createApiKey, hashApiKey } from "@/core/api-keys";

const orgSchema = z.object({ orgId: z.string().uuid() });

export const listApiKeys = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string }) => orgSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.from("api_keys")
      .select("id,name,key_prefix,rate_limit_per_minute,created_at,revoked_at,last_used_at")
      .eq("org_id", data.orgId).order("created_at", { ascending: false });
    if (error) throw new Error("Could not load API keys.");
    return rows ?? [];
  });

export const issueApiKey = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { orgId: string; name: string }) => orgSchema.extend({ name: z.string().trim().min(1).max(120) }).parse(d))
  .handler(async ({ data, context }) => {
    const key = createApiKey();
    const { error } = await context.supabase.rpc("issue_api_key", { _org: data.orgId, _name: data.name, _hash: await hashApiKey(key), _prefix: apiKeyPrefix(key) });
    if (error) throw new Error("Could not create key. Admin access is required.");
    return { key };
  });

export const revokeApiKey = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("revoke_api_key", { _id: data.id });
    if (error) throw new Error("Could not revoke key. Admin access is required.");
    return { ok: true };
  });
