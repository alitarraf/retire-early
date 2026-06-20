// /api/entitlement-status (PRD §10.5) — read-only entitlement snapshot for the
// UI: tier, prompts remaining (rolling 24h), and whether Ask Pro is active.
// Never meters. Powers the prompt counter, the Pro badge, and post-checkout
// polling (the success_url race — entitlement may lag the redirect).

import { json, readOrigin, originAllowed } from "./_lib/http.js";
import { peekEntitlement } from "./_lib/gate.js";

export const config = { path: "/api/entitlement-status" };

export default async function handler(req) {
  const origin = readOrigin(req);
  if (!originAllowed(origin)) return json(403, { error: "origin_not_allowed" });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" }, origin);

  try {
    const status = await peekEntitlement(req);
    return json(200, status, origin);
  } catch (e) {
    // Fail soft — the UI degrades to "unmetered" rather than erroring.
    return json(200, { configured: false, tier: "anon", active: false, remaining: null, limit: null, error: String(e?.message || e) }, origin);
  }
}
