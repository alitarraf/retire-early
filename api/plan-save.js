// /api/plan-save — upsert the signed-in user's plan inputs (account sync).
// Signed-in users only. Server-authoritative write via the secret-key client.
// Validates the body is a plain object and caps its size so the endpoint can't
// be used to stash arbitrary blobs. One row per user, keyed on user_id.

import { json, readOrigin, originAllowed } from "./_lib/http.js";
import { getServiceClient, isSupabaseConfigured } from "./_lib/supabase.js";
import { getUserFromRequest } from "./_lib/auth.js";

export const config = { path: "/api/plan-save" };

const MAX_BYTES = 64 * 1024; // a plan is a small flat object; 64 KB is generous.

export default async function handler(req) {
  const origin = readOrigin(req);
  if (!originAllowed(origin)) return json(403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" }, origin);

  const sb = isSupabaseConfigured() ? getServiceClient() : null;
  if (!sb) return json(200, { configured: false, ok: false }, origin);

  const user = await getUserFromRequest(sb, req);
  if (!user) return json(401, { error: "auth_required" }, origin);

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "bad_json" }, origin);
  }
  const data = body?.data;
  // Must be a plain (non-array, non-null) object, within the size cap.
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return json(400, { error: "invalid_data" }, origin);
  }
  if (JSON.stringify(data).length > MAX_BYTES) {
    return json(400, { error: "too_large" }, origin);
  }

  try {
    const updatedAt = new Date().toISOString();
    await sb
      .from("plans")
      .upsert({ user_id: user.id, data, updated_at: updatedAt }, { onConflict: "user_id" });
    return json(200, { ok: true, updatedAt }, origin);
  } catch (e) {
    return json(500, { error: "write_failed", detail: String(e?.message || e) }, origin);
  }
}
