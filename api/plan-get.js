// /api/plan-get — return the signed-in user's saved plan inputs (account sync).
// Signed-in users only. Server-authoritative read via the secret-key client;
// RLS denies the publishable key, so this function is the only way to read the
// `plans` table. Returns { data: null } when the user has nothing saved yet.

import { json, readOrigin, originAllowed } from "./_lib/http.js";
import { getServiceClient, isSupabaseConfigured } from "./_lib/supabase.js";
import { getUserFromRequest } from "./_lib/auth.js";

export const config = { path: "/api/plan-get" };

export default async function handler(req) {
  const origin = readOrigin(req);
  if (!originAllowed(origin)) return json(403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" }, origin);

  const sb = isSupabaseConfigured() ? getServiceClient() : null;
  if (!sb) return json(200, { configured: false, data: null }, origin);

  const user = await getUserFromRequest(sb, req);
  if (!user) return json(401, { error: "auth_required" }, origin);

  try {
    const { data: row } = await sb
      .from("plans")
      .select("data, updated_at")
      .eq("user_id", user.id)
      .maybeSingle();
    return json(200, { data: row?.data ?? null, updatedAt: row?.updated_at ?? null }, origin);
  } catch (e) {
    return json(500, { error: "read_failed", detail: String(e?.message || e) }, origin);
  }
}
